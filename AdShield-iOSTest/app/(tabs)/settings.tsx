import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { useAdShield } from "@/lib/adshield-context";
import { useColors } from "@/hooks/use-colors";

export default function SettingsScreen() {
  const colors = useColors();
  const { settings, vpnStatus, adAssistStatus, setAutoStart, setNotifications, setAppTrafficProtection, setShakeRiskAlerts, openAdAssistSettings, requestVpnPermission } = useAdShield();
  const changeAppTrafficProtection = (enabled: boolean) => {
    setAppTrafficProtection(enabled);
    if (enabled) {
      Alert.alert("需要 Android 系统授权", "应用内网络防护将使用本地 VPN 处理你选择的应用请求。该功能只能在 Android 原生开发构建中启用；Expo Go 和 iOS 预览不会接管其他 App 的流量。");
    }
  };
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold text-foreground">设置</Text>
        <Text className="mt-1 text-base text-muted">管理 AdShield 在本机的工作方式。</Text>
        <Text className="mt-8 text-sm font-semibold text-muted">防护行为</Text>
        <View className="mt-3 rounded-2xl border border-border bg-surface">
          <ToggleRow icon="power-settings-new" title="启动时自动保护" description="打开应用时自动恢复上次的防护状态。" value={settings.autoStart} onChange={setAutoStart} />
          <View className="ml-16 h-px bg-border" />
          <ToggleRow icon="notifications-none" title="拦截通知" description="在有重要拦截事件时显示提醒。" value={settings.notifications} onChange={setNotifications} />
        </View>
        <Text className="mt-8 text-sm font-semibold text-muted">{Platform.OS === "ios" ? "Safari 网页防护" : "应用内广告防护"}</Text>
        <View className="mt-3 rounded-2xl border border-border bg-surface">
          {Platform.OS === "ios" ? <SafariContentBlockerCard /> : <>
          <ToggleRow icon="vpn-key" title="Android 本地 VPN 防护" description="过滤你选择的应用的广告、推广 SDK 与已知跳转域名。" value={settings.appTrafficProtection} onChange={changeAppTrafficProtection} />
          <Pressable onPress={() => requestVpnPermission().then(() => Alert.alert("请完成系统授权", "返回 AdShield 后，再打开上面的 Android 本地 VPN 防护开关。"))} style={({ pressed }) => [styles.permissionButton, { borderColor: colors.border }, pressed && styles.pressed]}><MaterialIcons name="vpn-key" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: "700" }}>申请系统 VPN 权限</Text></Pressable>
          <Text className="px-4 pb-3 text-xs text-muted">状态：{vpnStatus?.running ? "正在运行" : vpnStatus?.prepared ? "已授权，未运行" : "未授权或等待原生构建"} · 原生已拦截 {vpnStatus?.blockedCount ?? 0} 次</Text>
          <View className="ml-16 h-px bg-border" />
          <ToggleRow icon="vibration" title="广告与小程序跳过辅助" description="检测摇一摇诱导文字，以及微信小程序的“关闭广告”或“跳过 3s”等可读控件；由你确认后才尝试跳过。" value={settings.shakeRiskAlerts} onChange={setShakeRiskAlerts} />
          <Pressable onPress={() => openAdAssistSettings().then(() => Alert.alert("开启无障碍辅助", "请在系统设置中启用 AdShield 广告辅助。该服务只在你打开开关后检测可能的广告文本；微信小程序仅对“关闭广告”或带倒计时的“跳过”提示进行专门识别。不上传屏幕内容，也不会后台自动点击。"))} style={({ pressed }) => [styles.permissionButton, { borderColor: colors.border }, pressed && styles.pressed]}><MaterialIcons name="accessibility-new" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: "700" }}>打开无障碍授权设置</Text></Pressable>
          <Text className="px-4 pb-3 text-xs text-muted">状态：{adAssistStatus?.connected ? "系统已授权" : "尚未授权"} · 本机检测 {adAssistStatus?.detections ?? 0} 次</Text>
          <Pressable onPress={() => Alert.alert("微信小程序真机测试", "1. 打开“广告与小程序跳过辅助”，并在系统中启用 AdShield 广告辅助。\n\n2. 在微信内进入含封面广告或激励视频广告的小程序。\n\n3. 如果系统无障碍树暴露“关闭广告”或“跳过 3s”等文字，AdShield 会显示确认提示；点击“尝试跳过”才会执行一次点击。\n\n4. 没有提示通常表示广告使用了图片/画布或未暴露文字，AdShield 不会静默操作。")} style={({ pressed }) => [styles.permissionButton, { borderColor: colors.border }, pressed && styles.pressed]}><MaterialIcons name="fact-check" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: "700" }}>查看微信小程序测试方法</Text></Pressable>
          </>}
        </View>
        <View style={[styles.boundary, { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}35` }]}>
          <MaterialIcons name="privacy-tip" size={20} color={colors.warning} />
          <Text style={[styles.boundaryText, { color: colors.foreground }]}>{Platform.OS === "ios" ? "iOS 不能对其他 App 的广告或摇一摇逻辑做通用拦截；可用范围以 Safari 内容拦截为主。" : "微信小程序广告会优先识别“关闭广告”与倒计时“跳过”控件；无障碍辅助只能读取系统暴露的文本，不能保证识别图片、画布或未暴露文字的广告，也不会替你静默点击。"}</Text>
        </View>
        <Text className="mt-8 text-sm font-semibold text-muted">关于保护</Text>
        <View className="mt-3 rounded-2xl border border-border bg-surface p-4">
          <View style={styles.aboutTitle}><View style={[styles.aboutIcon, { backgroundColor: colors.primary }]}><MaterialIcons name="security" size={21} color="#FFFFFF" /></View><View><Text className="text-base font-semibold text-foreground">AdShield Mobile</Text><Text className="mt-1 text-sm text-muted">本地优先的广告与弹窗防护</Text></View></View>
          <Text className="mt-4 text-sm leading-6 text-muted">{Platform.OS === "ios" ? "iOS 测试版提供 Safari 内容拦截扩展，用于阻止 Safari 网页中的已知广告与弹窗资源。它不能拦截微信小程序或其他 App 内广告，也不会读取其他 App 的界面内容。" : "当前版本提供本地规则、DNS 域名过滤和用户主动开启的无障碍广告辅助。微信小程序的广告资源可能受 DNS 规则影响；对于系统暴露“关闭广告”或“跳过”的广告控件，AdShield 会提示你决定是否使用跳过辅助。"}</Text>
          <Pressable onPress={() => Alert.alert("隐私说明", "AdShield 首版不会上传白名单、规则选择或拦截记录；相关数据仅存储在此设备。")} style={({ pressed }) => [styles.privacyButton, { borderColor: colors.border }, pressed && styles.pressed]}><MaterialIcons name="privacy-tip" size={19} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: "700" }}>查看隐私说明</Text></Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function ToggleRow({ icon, title, description, value, onChange }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  const colors = useColors();
  return <View style={styles.toggleRow}><View style={[styles.rowIcon, { backgroundColor: `${colors.primary}10` }]}><MaterialIcons name={icon} size={20} color={colors.primary} /></View><View style={styles.toggleCopy}><Text className="text-base font-semibold text-foreground">{title}</Text><Text className="mt-1 text-sm leading-5 text-muted">{description}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.success }} /></View>;
}

function SafariContentBlockerCard() {
  const colors = useColors();
  const { settings, safariRuleCount, safariExtensionState, openSafariExtensionSettings, syncSafariRules } = useAdShield();
  const extensionEnabled = safariExtensionState?.enabled ?? null;

  const statusLabel = extensionEnabled === null ? "扩展状态未知（需 iOS 15.4+）" : extensionEnabled ? "扩展已在 Safari 中启用" : "扩展尚未在 Safari 中启用";
  const statusColor = extensionEnabled ? colors.success : colors.warning;

  const goEnable = () => {
    openSafariExtensionSettings().then((opened) => {
      if (!opened) {
        Alert.alert("请手动打开设置", "请在 iOS 设置 → App → Safari → 扩展 中启用“AdShield Safari 防护”，并选择允许在所有网站上运行。");
      }
    });
  };

  return <>
    <View style={styles.toggleRow}><View style={[styles.rowIcon, { backgroundColor: `${colors.primary}10` }]}><MaterialIcons name="language" size={20} color={colors.primary} /></View><View style={styles.toggleCopy}><Text className="text-base font-semibold text-foreground">AdShield Safari 防护</Text><Text className="mt-1 text-sm leading-5 text-muted">通过 Safari 内容拦截扩展过滤网页中的已知广告、第三方资源与弹窗。</Text></View></View>
    <View style={styles.safariStatusRow}>
      <MaterialIcons name={extensionEnabled ? "check-circle" : "info-outline"} size={17} color={statusColor} />
      <Text style={[styles.safariStatusText, { color: statusColor }]}>{statusLabel}</Text>
      <Text style={[styles.safariStatusText, { color: colors.muted }]}>已同步 {safariRuleCount} 条规则 · 防护{settings.enabled ? "已开启" : "已关闭"}</Text>
    </View>
    {extensionEnabled === false && (
      <Pressable onPress={goEnable} style={({ pressed }) => [styles.permissionButton, { borderColor: colors.warning }, pressed && styles.pressed]}><MaterialIcons name="open-in-new" size={18} color={colors.warning} /><Text style={{ color: colors.warning, fontWeight: "700" }}>前往 Safari 设置启用扩展</Text></Pressable>
    )}
    <Pressable onPress={goEnable} style={({ pressed }) => [styles.permissionButton, { borderColor: colors.border }, pressed && styles.pressed]}><MaterialIcons name="open-in-new" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: "700" }}>打开 Safari 扩展设置</Text></Pressable>
    <Pressable onPress={() => syncSafariRules().then((count) => Alert.alert("规则已同步", `已把当前规则（${count} 条）写入 Safari 内容拦截器。若扩展已启用，新的拦截行为会立即生效。`))} style={({ pressed }) => [styles.permissionButton, { borderColor: colors.border }, pressed && styles.pressed]}><MaterialIcons name="sync" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: "700" }}>手动重新同步规则</Text></Pressable>
    <Text className="px-4 pb-3 text-xs leading-5 text-muted">首次使用需要授权：在 Safari 扩展设置中启用后，选择“所有网站”允许。该功能只作用于 Safari 浏览器，不拦截其他 App 内广告。</Text>
  </>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 34 },
  toggleRow: { flexDirection: "row", alignItems: "center", padding: 16 },
  rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  toggleCopy: { flex: 1, marginHorizontal: 12 },
  aboutTitle: { flexDirection: "row", alignItems: "center", gap: 12 },
  aboutIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  privacyButton: { height: 44, borderWidth: 1, borderRadius: 13, marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  boundary: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12 },
  boundaryText: { flex: 1, fontSize: 13, lineHeight: 19 },
  permissionButton: { height: 42, borderWidth: 1, borderRadius: 12, marginHorizontal: 16, marginTop: 2, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  safariStatusRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  safariStatusText: { fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.7 },
});
