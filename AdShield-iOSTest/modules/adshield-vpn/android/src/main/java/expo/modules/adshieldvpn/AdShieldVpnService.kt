package expo.modules.adshieldvpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Base64
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.LinkedHashMap
import java.util.concurrent.atomic.AtomicBoolean

class AdShieldVpnService : VpnService() {
  private data class CachedDnsResponse(val bytes: ByteArray, val storedAt: Long)

  private var tun: ParcelFileDescriptor? = null
  private var worker: Thread? = null
  private val running = AtomicBoolean(false)
  private val virtualDns = InetAddress.getByName("10.0.0.2")
  private val gateway = InetAddress.getByName("10.0.0.1")
  private val upstreams by lazy {
    listOf("223.5.5.5", "119.29.29.29", "1.1.1.1").map(InetAddress::getByName)
  }
  private val rulePatterns = mutableSetOf<String>()
  private val dnsCache = object : LinkedHashMap<String, CachedDnsResponse>(128, 0.75f, true) {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, CachedDnsResponse>?): Boolean = size > CACHE_MAX_SIZE
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (VpnService.prepare(this) != null) {
      stopSelf()
      return START_NOT_STICKY
    }

    val preferences = getSharedPreferences(PREFS, MODE_PRIVATE)
    val hasExplicitTargets = preferences.contains(KEY_TARGET_PACKAGES)
    val targetPackages = preferences.getStringSet(KEY_TARGET_PACKAGES, emptySet()).orEmpty()
    if (hasExplicitTargets && targetPackages.isEmpty()) {
      markRunning(false)
      stopSelf()
      return START_NOT_STICKY
    }

    startForegroundNotification()
    if (running.getAndSet(true)) return START_STICKY

    val builder = Builder()
      .setSession("AdShield DNS 防护")
      .setMtu(1500)
      .addAddress(gateway, 32)
      .addDnsServer(virtualDns)
      .addRoute(virtualDns, 32)

    if (hasExplicitTargets) {
      targetPackages.forEach { packageName ->
        try {
          builder.addAllowedApplication(packageName)
        } catch (_: Exception) {
          // The app may have been uninstalled after selection.
        }
      }
    }

    tun = builder.establish()
    if (tun == null) {
      running.set(false)
      markRunning(false)
      stopSelf()
      return START_NOT_STICKY
    }

    loadRules()
    markRunning(true)
    worker = Thread(::packetLoop, "AdShieldDnsLoop").also { it.start() }
    return START_STICKY
  }

  private fun packetLoop() {
    val descriptor = tun ?: return
    val input = FileInputStream(descriptor.fileDescriptor)
    val output = FileOutputStream(descriptor.fileDescriptor)
    val packet = ByteArray(32767)
    try {
      while (running.get()) {
        val length = input.read(packet)
        if (length > 0) handlePacket(packet, length, output)
      }
    } catch (_: Exception) {
      if (running.get()) markRunning(false)
    } finally {
      try { input.close() } catch (_: Exception) { }
      try { output.close() } catch (_: Exception) { }
    }
  }

  private fun handlePacket(packet: ByteArray, length: Int, output: FileOutputStream) {
    if (length < 28 || (packet[0].toInt() and 0xF0) != 0x40) return
    val ihl = (packet[0].toInt() and 0x0F) * 4
    if (ihl < 20 || ihl + 8 > length || (packet[9].toInt() and 0xFF) != 17) return
    if (!packet.copyOfRange(16, 20).contentEquals(virtualDns.address)) return
    if (u16(packet, ihl + 2) != 53) return

    val dnsOffset = ihl + 8
    val query = packet.copyOfRange(dnsOffset, length)
    val domain = readQuestionName(query) ?: return
    val blocked = isBlocked(domain)
    if (blocked) incrementBlockedCount()
    val response = if (blocked) blockedResponse(query) else forwardDns(query)
    if (response == null) return

    val reply = packet.copyOf(dnsOffset + response.size)
    val sourceAddress = packet.copyOfRange(12, 16)
    System.arraycopy(packet, 16, reply, 12, 4)
    System.arraycopy(sourceAddress, 0, reply, 16, 4)

    val oldSourcePort = packet.copyOfRange(ihl, ihl + 2)
    System.arraycopy(packet, ihl + 2, reply, ihl, 2)
    System.arraycopy(oldSourcePort, 0, reply, ihl + 2, 2)
    val udpLength = 8 + response.size
    reply[ihl + 4] = (udpLength shr 8).toByte()
    reply[ihl + 5] = udpLength.toByte()
    reply[ihl + 6] = 0
    reply[ihl + 7] = 0
    System.arraycopy(response, 0, reply, dnsOffset, response.size)

    val ipLength = ihl + udpLength
    reply[2] = (ipLength shr 8).toByte()
    reply[3] = ipLength.toByte()
    reply[10] = 0
    reply[11] = 0
    writeChecksum(reply, 0, ihl, 10)
    output.write(reply, 0, ipLength)
  }

  private fun forwardDns(query: ByteArray): ByteArray? {
    if (query.size <= 2) return null
    val cacheKey = Base64.encodeToString(query, 2, query.size - 2, Base64.NO_WRAP)
    synchronized(dnsCache) {
      val cached = dnsCache[cacheKey]
      if (cached != null && System.currentTimeMillis() - cached.storedAt < CACHE_TTL_MS) {
        return cached.bytes.copyOf().also {
          it[0] = query[0]
          it[1] = query[1]
        }
      }
      if (cached != null) dnsCache.remove(cacheKey)
    }

    for (upstream in upstreams) {
      try {
        DatagramSocket().use { socket ->
          protect(socket)
          socket.soTimeout = UPSTREAM_TIMEOUT_MS
          socket.send(DatagramPacket(query, query.size, upstream, 53))
          val buffer = ByteArray(4096)
          val response = DatagramPacket(buffer, buffer.size)
          socket.receive(response)
          val result = response.data.copyOf(response.length)
          synchronized(dnsCache) {
            dnsCache[cacheKey] = CachedDnsResponse(result.copyOf(), System.currentTimeMillis())
          }
          return result
        }
      } catch (_: Exception) {
        // Try the next resolver. If all fail, Android will retry the query.
      }
    }
    return null
  }

  private fun blockedResponse(query: ByteArray): ByteArray {
    val response = query.copyOf()
    if (response.size < 12) return response
    response[2] = ((response[2].toInt() and 0xFF) or 0x80).toByte()
    response[3] = ((response[3].toInt() and 0xF0) or 0x80 or 0x03).toByte()
    // Preserve QDCOUNT and the question; clear answer/authority/additional.
    for (index in 6..11) response[index] = 0
    return response
  }

  private fun isBlocked(domain: String): Boolean {
    val normalized = normalizeDomain(domain)
    val whitelist = getSharedPreferences(PREFS, MODE_PRIVATE)
      .getStringSet(KEY_WHITELIST, emptySet())
      .orEmpty()
      .map(::normalizeDomain)
    if (whitelist.any { normalized == it || normalized.endsWith(".$it") }) return false
    return rulePatterns.any { normalized == it || normalized.endsWith(".$it") }
  }

  private fun readQuestionName(query: ByteArray): String? {
    if (query.size < 13) return null
    var index = 12
    val labels = mutableListOf<String>()
    while (index < query.size) {
      val size = query[index].toInt() and 0xFF
      index++
      if (size == 0) break
      if (size > 63 || index + size > query.size) return null
      labels.add(String(query, index, size, Charsets.US_ASCII))
      index += size
    }
    return labels.takeIf { it.isNotEmpty() }?.joinToString(".")?.let(::normalizeDomain)
  }

  private fun loadRules() {
    val preferences = getSharedPreferences(PREFS, MODE_PRIVATE)
    val configured = preferences.getBoolean(KEY_RULES_CONFIGURED, false)
    val domains = if (configured) {
      preferences.getStringSet(KEY_BLOCKED_DOMAINS, emptySet()).orEmpty()
    } else {
      DEFAULT_RULES
    }
    rulePatterns.clear()
    domains.mapTo(rulePatterns, ::normalizeDomain)
  }

  private fun normalizeDomain(value: String): String = value
    .trim()
    .lowercase()
    .removePrefix("https://")
    .removePrefix("http://")
    .removePrefix("www.")
    .substringBefore('/')

  private fun startForegroundNotification() {
    val channelId = "adshield-vpn"
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel(channelId, "AdShield DNS 防护", NotificationManager.IMPORTANCE_LOW))
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, channelId) else Notification.Builder(this)
    startForeground(
      2137,
      builder
        .setContentTitle("AdShield 正在保护")
        .setContentText("正在拦截已知广告域名")
        .setSmallIcon(android.R.drawable.ic_secure)
        .setOngoing(true)
        .build(),
    )
  }

  private fun markRunning(value: Boolean) {
    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("running", value).apply()
  }

  private fun incrementBlockedCount() {
    val preferences = getSharedPreferences(PREFS, MODE_PRIVATE)
    preferences.edit().putLong("blocked_count", preferences.getLong("blocked_count", 0L) + 1L).apply()
  }

  private fun u16(data: ByteArray, offset: Int): Int =
    ((data[offset].toInt() and 0xFF) shl 8) or (data[offset + 1].toInt() and 0xFF)

  private fun writeChecksum(data: ByteArray, offset: Int, length: Int, checksumOffset: Int) {
    var sum = 0L
    var index = offset
    while (index + 1 < offset + length) {
      if (index != checksumOffset) sum += u16(data, index)
      index += 2
    }
    while (sum ushr 16 != 0L) sum = (sum and 0xFFFF) + (sum ushr 16)
    val checksum = sum.inv() and 0xFFFF
    data[checksumOffset] = (checksum shr 8).toByte()
    data[checksumOffset + 1] = checksum.toByte()
  }

  override fun onDestroy() {
    running.set(false)
    worker?.interrupt()
    worker = null
    try { tun?.close() } catch (_: Exception) { }
    tun = null
    markRunning(false)
    super.onDestroy()
  }

  companion object {
    const val PREFS = "adshield_vpn"
    const val KEY_TARGET_PACKAGES = "target_packages"
    const val KEY_BLOCKED_DOMAINS = "blocked_domains"
    const val KEY_WHITELIST = "whitelist"
    const val KEY_RULES_CONFIGURED = "rules_configured"
    private const val CACHE_MAX_SIZE = 1000
    private const val CACHE_TTL_MS = 60_000L
    private const val UPSTREAM_TIMEOUT_MS = 1_500
    private val DEFAULT_RULES = setOf(
      "doubleclick.net", "googlesyndication.com", "googleadservices.com",
      "adservice.google.com", "mobads.baidu.com", "pangolin-sdk-toutiao.com",
      "pglstatp-toutiao.com", "ad.oceanengine.com", "e.qq.com", "gdt.qq.com",
      "sdk.e.qq.com", "alimama.com", "adashx.m.taobao.com", "applovin.com",
      "unityads.unity3d.com", "inmobi.com", "umeng.com", "growingio.com",
    )
  }
}
