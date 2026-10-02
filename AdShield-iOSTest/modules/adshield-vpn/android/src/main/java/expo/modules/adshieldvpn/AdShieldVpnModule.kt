package expo.modules.adshieldvpn

import android.content.Intent
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AdShieldVpnModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AdShieldVpn")
    Events("onStatusChange")

    AsyncFunction("getStatusAsync") { status() }

    AsyncFunction("requestSystemPermissionAsync") { promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.reject("E_NO_CONTEXT", "Android context is unavailable", null)
        return@AsyncFunction
      }
      val intent = VpnService.prepare(context)
      if (intent == null) {
        promise.resolve(status())
        return@AsyncFunction
      }
      val activity = appContext.currentActivity ?: run {
        promise.reject("E_NO_ACTIVITY", "Open AdShield to confirm VPN permission", null)
        return@AsyncFunction
      }
      activity.runOnUiThread { activity.startActivity(intent) }
      promise.resolve(status())
    }

    AsyncFunction("startAsync") { promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.reject("E_NO_CONTEXT", "Android context is unavailable", null)
        return@AsyncFunction
      }
      if (VpnService.prepare(context) != null) {
        promise.reject("E_VPN_PERMISSION", "Confirm Android VPN permission first", null)
        return@AsyncFunction
      }
      val preferences = context.getSharedPreferences(AdShieldVpnService.PREFS, 0)
      if (preferences.contains(AdShieldVpnService.KEY_TARGET_PACKAGES)
        && preferences.getStringSet(AdShieldVpnService.KEY_TARGET_PACKAGES, emptySet()).isNullOrEmpty()) {
        promise.reject("E_NO_TARGET_APPS", "请至少选择一个需要保护的应用", null)
        return@AsyncFunction
      }
      val serviceIntent = Intent(context, AdShieldVpnService::class.java)
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) context.startForegroundService(serviceIntent) else context.startService(serviceIntent)
      promise.resolve(status())
    }

    AsyncFunction("stopAsync") { promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.reject("E_NO_CONTEXT", "Android context is unavailable", null)
        return@AsyncFunction
      }
      context.stopService(Intent(context, AdShieldVpnService::class.java))
      promise.resolve(status())
    }

    AsyncFunction("setTargetPackagesAsync") { packages: List<String> ->
      val context = appContext.reactContext ?: return@AsyncFunction status()
      val preferences = context.getSharedPreferences(AdShieldVpnService.PREFS, 0)
      preferences.edit().putStringSet(AdShieldVpnService.KEY_TARGET_PACKAGES, packages.toSet()).apply()
      restartIfRunning(context)
      val nextStatus = status()
      sendEvent("onStatusChange", nextStatus)
      nextStatus
    }

    AsyncFunction("getInstalledAppsAsync") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, String>>()
      val packageManager = context.packageManager
      val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val resolved = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        packageManager.queryIntentActivities(launcherIntent, PackageManager.ResolveInfoFlags.of(0L))
      } else {
        @Suppress("DEPRECATION")
        packageManager.queryIntentActivities(launcherIntent, 0)
      }
      resolved
        .mapNotNull { info ->
          val packageName = info.activityInfo?.packageName ?: return@mapNotNull null
          if (packageName == context.packageName) return@mapNotNull null
          mapOf(
            "packageName" to packageName,
            "appName" to info.loadLabel(packageManager).toString().ifBlank { packageName },
          )
        }
        .distinctBy { it["packageName"] }
        .sortedBy { it["appName"]?.lowercase() }
    }

    AsyncFunction("setRulesAsync") { blockedDomains: List<String>, whitelist: List<String> ->
      val context = appContext.reactContext ?: return@AsyncFunction status()
      context.getSharedPreferences(AdShieldVpnService.PREFS, 0).edit()
        .putBoolean(AdShieldVpnService.KEY_RULES_CONFIGURED, true)
        .putStringSet(AdShieldVpnService.KEY_BLOCKED_DOMAINS, blockedDomains.toSet())
        .putStringSet(AdShieldVpnService.KEY_WHITELIST, whitelist.toSet())
        .apply()
      restartIfRunning(context)
      val nextStatus = status()
      sendEvent("onStatusChange", nextStatus)
      nextStatus
    }

    AsyncFunction("setWhitelistAsync") { domains: List<String> ->
      appContext.reactContext?.getSharedPreferences(AdShieldVpnService.PREFS, 0)?.edit()?.putStringSet(AdShieldVpnService.KEY_WHITELIST, domains.toSet())?.apply()
    }

    AsyncFunction("getAdAssistStatusAsync") { adAssistStatus() }

    AsyncFunction("openAdAssistSettingsAsync") { promise: Promise ->
      val activity = appContext.currentActivity ?: run {
        promise.reject("E_NO_ACTIVITY", "Open AdShield to manage accessibility access", null)
        return@AsyncFunction
      }
      activity.runOnUiThread { activity.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
      promise.resolve(adAssistStatus())
    }

    AsyncFunction("setAdAssistEnabledAsync") { enabled: Boolean ->
      appContext.reactContext?.getSharedPreferences(AdShieldAdAssistService.PREFS, 0)?.edit()?.putBoolean(AdShieldAdAssistService.KEY_ENABLED, enabled)?.apply()
      adAssistStatus()
    }
  }

  private fun status(): Map<String, Any> {
    val context = appContext.reactContext
    val preferences = context?.getSharedPreferences(AdShieldVpnService.PREFS, 0)
    val targetPackages = preferences?.getStringSet(AdShieldVpnService.KEY_TARGET_PACKAGES, emptySet())?.sorted() ?: emptyList()
    val protectsAllApps = preferences?.contains(AdShieldVpnService.KEY_TARGET_PACKAGES) == false
    val prepared = context?.let { VpnService.prepare(it) == null } ?: false
    val running = preferences?.getBoolean("running", false) ?: false
    val blockedCount = preferences?.getLong("blocked_count", 0L) ?: 0L
    val ruleCount = preferences?.getStringSet(AdShieldVpnService.KEY_BLOCKED_DOMAINS, emptySet())?.size ?: 0
    return mapOf(
      "available" to true,
      "prepared" to prepared,
      "running" to running,
      "packageCount" to targetPackages.size,
      "targetPackages" to targetPackages,
      "protectsAllApps" to protectsAllApps,
      "ruleCount" to ruleCount,
      "blockedCount" to blockedCount,
    )
  }

  private fun restartIfRunning(context: android.content.Context) {
    val preferences = context.getSharedPreferences(AdShieldVpnService.PREFS, 0)
    if (!preferences.getBoolean("running", false)) return
    context.stopService(Intent(context, AdShieldVpnService::class.java))
    val targets = preferences.getStringSet(AdShieldVpnService.KEY_TARGET_PACKAGES, null)
    if (preferences.contains(AdShieldVpnService.KEY_TARGET_PACKAGES) && targets.isNullOrEmpty()) return
    val intent = Intent(context, AdShieldVpnService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
  }

  private fun adAssistStatus(): Map<String, Any> {
    val context = appContext.reactContext
    val enabledServices = Settings.Secure.getString(context?.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty()
    val component = context?.packageName + "/" + AdShieldAdAssistService::class.java.name
    val connected = enabledServices.contains(component, ignoreCase = true)
    val preferences = context?.getSharedPreferences(AdShieldAdAssistService.PREFS, 0)
    return mapOf(
      "available" to true,
      "enabled" to (preferences?.getBoolean(AdShieldAdAssistService.KEY_ENABLED, false) ?: false),
      "connected" to connected,
      "detections" to (preferences?.getLong(AdShieldAdAssistService.KEY_DETECTIONS, 0L) ?: 0L),
    )
  }
}
