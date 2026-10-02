package expo.modules.adshieldvpn

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * A user-controlled accessibility assistant for text-exposed shake-ad screens.
 * It never performs a click until the user presses the visible AdShield helper button.
 * Only aggregate local detection counts are saved; screen text is never persisted or sent.
 */
class AdShieldAdAssistService : AccessibilityService() {
  companion object {
    const val PREFS = "adshield_ad_assist"
    const val KEY_ENABLED = "enabled"
    const val KEY_DETECTIONS = "detections"
    private const val OVERLAY_TIMEOUT_MS = 6500L
    private const val WECHAT_PACKAGE = "com.tencent.mm"
    private val AD_MARKERS = listOf("摇一摇", "摇动手机", "扭转手机", "转动手机", "跳过广告", "关闭广告")
    private val SKIP_MARKERS = listOf("关闭广告", "跳过广告", "跳过")
    private val WECHAT_SKIP_PATTERN = Regex("跳过\\s*(\\d{1,2}\\s*[s秒])?")
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private var overlay: View? = null
  private var lastDetectionSignature = ""
  private var lastDetectionAt = 0L

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null || !isEnabled()) return
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) return

    val root = rootInActiveWindow ?: return
    val packageName = event.packageName?.toString() ?: "unknown"
    val visibleText = collectVisibleText(root).lowercase()
    val marker = findAdMarker(visibleText, packageName) ?: return
    val signature = "$packageName:$marker"
    val now = System.currentTimeMillis()
    if (signature == lastDetectionSignature && now - lastDetectionAt < 3000L) return

    lastDetectionSignature = signature
    lastDetectionAt = now
    incrementDetections()
    showUserControlledOverlay(marker, packageName == WECHAT_PACKAGE)
  }

  override fun onInterrupt() {
    hideOverlay()
  }

  override fun onDestroy() {
    hideOverlay()
    super.onDestroy()
  }

  private fun isEnabled(): Boolean = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)

  private fun incrementDetections() {
    val preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    preferences.edit().putLong(KEY_DETECTIONS, preferences.getLong(KEY_DETECTIONS, 0L) + 1L).apply()
  }

  private fun collectVisibleText(node: AccessibilityNodeInfo?, depth: Int = 0): String {
    if (node == null || depth > 14) return ""
    val parts = ArrayList<String>()
    node.text?.toString()?.let(parts::add)
    node.contentDescription?.toString()?.let(parts::add)
    for (index in 0 until node.childCount) parts.add(collectVisibleText(node.getChild(index), depth + 1))
    return parts.joinToString(" ")
  }

  /**
   * "跳过" is deliberately scoped to the WeChat host package.  Elsewhere this
   * generic word is too common and would create unwanted prompts.  WeChat's
   * mini-program cover ads may expose a countdown label such as "跳过 3s".
   */
  private fun findAdMarker(visibleText: String, packageName: String): String? {
    AD_MARKERS.firstOrNull { visibleText.contains(it) }?.let { return it }
    if (packageName == WECHAT_PACKAGE) {
      WECHAT_SKIP_PATTERN.find(visibleText)?.value?.let { return it.trim() }
    }
    return null
  }

  private fun showUserControlledOverlay(marker: String, isWeChatMiniProgram: Boolean) {
    mainHandler.post {
      hideOverlay()
      val windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
      val container = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(28, 22, 28, 22)
        background = GradientDrawable().apply { setColor(Color.rgb(18, 45, 69)); cornerRadius = 28f }
      }
      val title = TextView(this).apply {
        text = if (isWeChatMiniProgram) "AdShield 检测到微信小程序广告" else "AdShield 检测到可能的诱导广告"
        setTextColor(Color.WHITE)
        textSize = 15f
      }
      val description = TextView(this).apply {
        text = "发现“$marker”。请由你确认是否尝试跳过。"
        setTextColor(Color.rgb(220, 235, 246))
        textSize = 13f
        setPadding(0, 10, 0, 16)
      }
      val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.END }
      val dismiss = Button(this).apply {
        text = "不处理"
        setOnClickListener { hideOverlay() }
      }
      val skip = Button(this).apply {
        text = "尝试跳过"
        setOnClickListener { performUserRequestedSkip(); hideOverlay() }
      }
      actions.addView(dismiss)
      actions.addView(skip)
      container.addView(title)
      container.addView(description)
      container.addView(actions)

      val params = WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        android.graphics.PixelFormat.TRANSLUCENT,
      ).apply { gravity = Gravity.TOP; y = 80 }

      try {
        windowManager.addView(container, params)
        overlay = container
        mainHandler.postDelayed({ hideOverlay() }, OVERLAY_TIMEOUT_MS)
      } catch (_: Exception) {
        overlay = null
      }
    }
  }

  private fun performUserRequestedSkip() {
    val root = rootInActiveWindow ?: return
    val candidate = findSkipNode(root) ?: return
    if (candidate.isClickable) candidate.performAction(AccessibilityNodeInfo.ACTION_CLICK)
    else candidate.parent?.takeIf { it.isClickable }?.performAction(AccessibilityNodeInfo.ACTION_CLICK)
  }

  private fun findSkipNode(node: AccessibilityNodeInfo?, depth: Int = 0): AccessibilityNodeInfo? {
    if (node == null || depth > 14) return null
    val label = "${node.text ?: ""} ${node.contentDescription ?: ""}".lowercase()
    if (SKIP_MARKERS.any { label.contains(it) }) return node
    for (index in 0 until node.childCount) {
      findSkipNode(node.getChild(index), depth + 1)?.let { return it }
    }
    return null
  }

  private fun hideOverlay() {
    mainHandler.removeCallbacksAndMessages(null)
    val view = overlay ?: return
    overlay = null
    try { (getSystemService(WINDOW_SERVICE) as WindowManager).removeView(view) } catch (_: Exception) { }
  }
}
