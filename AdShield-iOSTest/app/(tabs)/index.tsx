import { useMemo, useState, useEffect } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, Button } from "react-native";
import * as Haptics from "expo-haptics";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { countEnabledRules, buildBlockerRules, collectEnabledNetworkDomains } from "@/lib/adshield-engine";
import { useAdShield } from "@/lib/adshield-context";
import { useColors } from "@/hooks/use-colors";

// 引入 Android VPN 模块
let AdShieldVpnModule: any = null;
if (Platform.OS === "android") {
  try {
    AdShieldVpnModule = require("@/modules/adshield-vpn/src/AdShieldVpnModule").default;
  } catch (e) {
    console.warn("Failed to load Android VPN module:", e);
  }
}

export default function ProtectionScreen() {
  const colors = useColors();
  const { settings, ruleTier, setProtectionEnabled, hydrated, whitelist, safariExtensionState, openSafariExtensionSettings } = useAdShield();
  const enabledRuleCount = useMemo(() => countEnabledRules(settings), [settings]);
  // 与 Safari 实际下发的规则同源（resolveRuleGroups），并扣除白名单放行的域名，
  // 显示多少就真的拦多少。
  const enabledDomainCount = useMemo(
    () => collectEnabledNetworkDomains(settings, ruleTier, whitelist).length,
    [settings, ruleTier, whitelist],
  );
  const syncedRuleCount = useMemo(() => buildBlockerRules(settings, whitelist, ruleTier).length, [settings, whitelist, ruleTier]);
  
  // Android VPN 特有状态
  const [vpnStatus, setVpnStatus] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPrepared, setIsPrepared] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  const [packageCount, setPackageCount] = useState(0);
  // loading 只对 Android 的 VPN 状态查询有意义；iOS 没有可查询的服务，
  // 必须立刻置为 false，否则加载中的分支永远不退出，页面会一直转圈。
  const [loading, setLoading] = useState(Platform.OS !== "android");
  const [syncing, setSyncing] = useState(false);
  const [shakeDetection, setShakeDetection] = useState(false);

  // 加载 VPN 状态
  useEffect(() => {
    if (Platform.OS !== "android" || !AdShieldVpnModule) {
      setLoading(false);
      return;
    }
    
    const loadStatus = async () => {
      try {
        const status = await AdShieldVpnModule.getStatusAsync();
        setVpnStatus(status);
        setIsRunning(status.running || false);
        setIsPrepared(status.prepared || false);
        setBlockedCount(status.blockedCount || 0);
        setPackageCount(status.packageCount || 0);
      } catch (e) {
        console.error("Failed to load VPN status:", e);
      } finally {
        setLoading(false);
      }
    };
    
    loadStatus();
    
    // 监听状态变化
    AdShieldVpnModule.addListener("onStatusChange", (status: any) => {
      setVpnStatus(status);
      setIsRunning(status.running || false);
      setIsPrepared(status.prepared || false);
      setBlockedCount(status.blockedCount || 0);
      setPackageCount(status.packageCount || 0);
    });
    
    return () => {
      AdShieldVpnModule?.removeAllListeners("onStatusChange");
    };
  }, []);

  // 摇一摇检测状态
  useEffect(() => {
    if (Platform.OS !== "android" || !AdShieldVpnModule) return;
    
    const loadShakeStatus = async () => {
      try {
        const status = await AdShieldVpnModule.getAdAssistStatusAsync();
        setShakeDetection(status.enabled && status.connected);
      } catch (e) {
        console.error("Failed to load shake detection status:", e);
      }
    };
    
    loadShakeStatus();
  }, []);

  // 切换防护开关：iOS 走 Safari 规则同步，Android 走 VPN
  const toggleProtection = async () => {
    if (Platform.OS === "ios") {
      const next = !settings.enabled;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const count = await setProtectionEnabled(next);
      if (next) {
        Alert.alert("防护已开启", count > 0 ? `已向 Safari 内容拦截器同步 ${count} 条规则。若拦截未生效，请在 设置 → App → Safari → 扩展 中启用“AdShield Safari 防护”。` : "规则已保存，但未能同步到 Safari 内容拦截器。请确认扩展已安装并在系统中启用。");
      }
      return;
    }
    if (Platform.OS !== "android" || !AdShieldVpnModule) return;

    if (isRunning) {
      stopVpn();
    } else {
      startVpn();
    }
  };

  const startVpn = async () => {
    if (!AdShieldVpnModule) return;

    setLoading(true);
    try {
      // 系统授权弹窗是异步的：requestSystemPermissionAsync 在弹窗弹出的瞬间就会返回
      // prepared=false（用户还没来得及点"允许"），所以这里轮询等待授权完成，
      // 而不是立刻弹"权限未授予"误导用户。
      let status = await AdShieldVpnModule.requestSystemPermissionAsync();
      for (let i = 0; !status.prepared && i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        status = await AdShieldVpnModule.getStatusAsync();
      }
      if (!status.prepared) {
        Alert.alert(
          "权限未授予",
          "开启保护需要允许 AdShield 建立 VPN 连接：请在系统弹窗中点\"允许\"，然后重新点击\"开启保护\"。"
        );
        return;
      }
      const result = await AdShieldVpnModule.startAsync();
      setIsRunning(result.running || true);
      if (settings.notifications) {
        Alert.alert("防护已启动", "DNS 广告拦截服务已运行。");
      }
    } catch (e: any) {
      Alert.alert("启动失败", e.message || "请重试");
    } finally {
      setLoading(false);
    }
  };

  const stopVpn = async () => {
    if (!AdShieldVpnModule) return;
    
    setLoading(true);
    try {
      const result = await AdShieldVpnModule.stopAsync();
      setIsRunning(result.running || false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      Alert.alert("防护已暂停", "DNS 拦截服务已停止。");
    } catch (e: any) {
      Alert.alert("停止失败", e.message || "请重试");
    } finally {
      setLoading(false);
    }
  };

  // 同步规则到 Android
  // 两端行为都是真实的：iOS 走 setProtectionEnabled 重新生成 Safari 规则；
  // Android 改 settings 会触发 context 里监听 state.settings 的 effect，
  // 用 setRulesAsync 把规则和白名单重新下发给 VPN 服务。
  const syncRulesNow = async () => {
    setSyncing(true);
    try {
      const ruleCount = await setProtectionEnabled(settings.enabled);
      Alert.alert(
        "规则已重新下发",
        Platform.OS === "ios" ? `已写入 Safari 内容拦截器 ${ruleCount} 条规则。` : "已把当前规则与白名单下发给本机过滤服务。",
      );
    } catch (e: any) {
      Alert.alert("同步失败", e.message || "请稍后重试");
    } finally {
      setSyncing(false);
    }
  };

  // 切换摇一摇检测
  const toggleShakeDetection = async (enabled: boolean) => {
    if (Platform.OS !== "android" || !AdShieldVpnModule) return;
    
    try {
      await AdShieldVpnModule.setAdAssistEnabledAsync(enabled);
      setShakeDetection(enabled);
      Alert.alert(
        enabled ? "摇一摇检测已开启" : "摇一摇检测已关闭",
        enabled ? "检测到诱导广告时将显示辅助按钮" : "已关闭摇一摇广告检测"
      );
    } catch (e: any) {
      Alert.alert("操作失败", e.message || "请重试");
    }
  };

  if (loading || !hydrated) {
    return (
      <ScreenContainer className="items-center justify-center" containerClassName="bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text className="text-3xl font-bold text-foreground">AdShield</Text>
            <Text className="mt-1 text-base text-muted">
              {Platform.OS === "ios" ? "Safari 广告拦截" : "DNS 广告拦截与摇一摇检测"}
            </Text>
          </View>
          <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="security" size={25} color="#FFFFFF" />
          </View>
        </View>

        {/* Status Card - Android */}
        {Platform.OS === "android" && vpnStatus && (
          <View style={[styles.statusCard, { backgroundColor: isRunning ? colors.primary : colors.surface, borderColor: isRunning ? colors.primary : colors.border }]}>
            <View style={styles.statusTopLine}>
              <View style={[styles.statusIcon, { backgroundColor: isRunning ? "rgba(255,255,255,0.18)" : `${colors.warning}20` }]}>
                <MaterialIcons name={isRunning ? "verified-user" : "shield"} size={34} color={isRunning ? "#FFFFFF" : colors.warning} />
              </View>
              <View style={styles.statusCopy}>
                <Text style={[styles.statusEyebrow, { color: isRunning ? "rgba(255,255,255,0.72)" : colors.muted }]}>
                  {isRunning ? "VPN 服务运行中" : "服务未启动"}
                </Text>
                <Text style={[styles.statusTitle, { color: isRunning ? "#FFFFFF" : colors.foreground }]}>
                  {isRunning ? "保护中" : "已暂停"}
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: isRunning ? colors.success : colors.warning }]} />
            </View>
            
            {isRunning && (
              <Text style={[styles.statusDescription, { color: "rgba(255,255,255,0.82)" }]}>
                已拦截 {blockedCount} 个广告请求 | 保护 {packageCount} 个应用 | 覆盖 {enabledDomainCount} 个域名
              </Text>
            )}
            
            <Button
              onPress={toggleProtection}
              disabled={loading || !isPrepared}
              color={isRunning ? "#FFFFFF" : colors.primary}
              title={loading ? "正在操作..." : isRunning ? "暂停保护" : "开启保护（需授权）"}
            />
            {!isPrepared && isRunning === false && !loading && (
              <Text style={styles.noticeText}>请先点击“开启保护”并确认系统弹窗中的权限请求。</Text>
            )}
          </View>
        )}

        {/* iOS Status Card */}
        {Platform.OS === "ios" && (
          <View style={[styles.statusCard, { backgroundColor: settings.enabled ? colors.primary : colors.surface, borderColor: settings.enabled ? colors.primary : colors.border }]}>
            <View style={styles.statusTopLine}>
              <View style={[styles.statusIcon, { backgroundColor: settings.enabled ? "rgba(255,255,255,0.18)" : `${colors.warning}20` }]}>
                <MaterialIcons name={settings.enabled ? "verified-user" : "shield"} size={34} color={settings.enabled ? "#FFFFFF" : colors.warning} />
              </View>
              <View style={styles.statusCopy}>
                <Text style={[styles.statusEyebrow, { color: settings.enabled ? "rgba(255,255,255,0.72)" : colors.muted }]}>
                  {settings.enabled ? "防护已启用" : "防护暂未启用"}
                </Text>
                <Text style={[styles.statusTitle, { color: settings.enabled ? "#FFFFFF" : colors.foreground }]}>
                  {settings.enabled ? "保护中" : "已暂停"}
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: settings.enabled ? colors.success : colors.warning }]} />
            </View>
            <Text style={[styles.statusDescription, { color: settings.enabled ? "rgba(255,255,255,0.82)" : colors.muted }]}>
              {settings.enabled
                ? `Safari 内容拦截器已同步 ${syncedRuleCount} 条规则。`
                : "开启后将生成 Safari 内容拦截规则，屏蔽网页中的广告与弹窗。"}
            </Text>
            {settings.enabled && safariExtensionState?.enabled === false && (
              <Pressable
                onPress={() => openSafariExtensionSettings().then((opened) => {
                  if (!opened) Alert.alert("请手动打开设置", "请在 iOS 设置 → App → Safari → 扩展 中启用“AdShield Safari 防护”。");
                })}
                style={({ pressed }) => [styles.extensionWarning, pressed && styles.pressed]}
              >
                <MaterialIcons name="warning-amber" size={20} color={colors.warning} />
                <Text style={[styles.extensionWarningText, { color: colors.foreground }]}>
                  扩展尚未在系统中启用，Safari 不会拦截任何内容。点击此处前往 设置 → Safari → 扩展 开启。
                </Text>
              </Pressable>
            )}
            <Button
              onPress={toggleProtection}
              color={settings.enabled ? "#FFFFFF" : colors.primary}
              title={settings.enabled ? "暂停保护" : "开启保护"}
            />
          </View>
        )}

        {/* Metrics */}
        <View style={styles.sectionHeader}>
          <Text className="text-lg font-bold text-foreground">本机概览</Text>
          <Text className="text-sm text-muted">数据仅保存在本机</Text>
        </View>
        
        <View style={styles.metricsRow}>
          <MetricCard icon="tune" label="启用规则组" value={enabledRuleCount.toString()} color={colors.primary} />
          <MetricCard icon="language" label="拦截域名" value={enabledDomainCount.toString()} color={colors.error} />
          <MetricCard icon="checklist" label="白名单" value={whitelist.length.toString()} color={colors.success} />
        </View>

        {/* Android 特有设置 */}
        {Platform.OS === "android" && vpnStatus && (
          <View style={[styles.toggleSection, { backgroundColor: colors.surface, borderRadius: 16, padding: 18 }]}>
            <Text className="text-base font-bold text-foreground mb-2">摇一摇广告检测</Text>
            <Text style={[styles.desc, { color: colors.muted }]}>
              基于无障碍服务检测诱导性广告文字（如“摇一摇”、“跳转广告”），并提供“尝试跳过”辅助按钮。
            </Text>
            
            <View style={styles.toggleRow}>
              <View style={[styles.toggleSwitch, { backgroundColor: shakeDetection ? colors.primary : `${colors.muted}20`, padding: 4 }]}>
                <View style={[styles.toggleKnob, { transform: [{ translateX: shakeDetection ? 28 : 0 }] }]}>
                  <MaterialIcons name={shakeDetection ? "check" : "add"} size={16} color="#FFFFFF" />
                </View>
              </View>
              <Text style={[styles.toggleLabel, { color: shakeDetection ? colors.primary : colors.muted }]}>
                {shakeDetection ? "已开启" : "未开启"}
              </Text>
              <Button
                onPress={() => toggleShakeDetection(!shakeDetection)}
                title={!shakeDetection ? "开启" : "关闭"}
                color={colors.primary}
              />
            </View>
            
            {!shakeDetection && (
              <Text style={styles.noticeText}>点击下方“开启”按钮后，需在系统设置中手动授权“无障碍服务”。</Text>
            )}
          </View>
        )}

        {/* Sync Rules */}
        <View style={styles.actionSection}>
          <Button
            onPress={syncRulesNow}
            disabled={syncing}
            color={colors.primary}
            title={syncing ? "重新下发中..." : Platform.OS === "ios" ? "重新生成本机规则" : "重新下发拦截规则"}
          />
          <Text style={styles.noticeText}>
            {Platform.OS === "ios"
              ? "用当前档位、白名单与 App 规则包在手机上重新生成一份规则并写入 Safari 内容拦截器。"
              : "把当前档位与白名单重新下发给本机 VPN 过滤服务。"}
            规则全部来自本机内置清单，不联网、不上传任何数据。
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function MetricCard({ icon, label, value, color }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string; color: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-border bg-surface p-3">
      <MaterialIcons name={icon} size={20} color={color} />
      <Text className="mt-4 text-2xl font-bold text-foreground">{value}</Text>
      <Text className="mt-1 text-xs text-muted">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 18, gap: 22 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandMark: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  statusCard: { borderWidth: 1, borderRadius: 28, padding: 22 },
  statusTopLine: { flexDirection: "row", alignItems: "center" },
  statusIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statusCopy: { flex: 1, marginLeft: 14 },
  statusEyebrow: { fontSize: 13, lineHeight: 18 },
  statusTitle: { fontSize: 28, lineHeight: 35, fontWeight: "700", marginTop: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, alignSelf: "flex-start", marginTop: 3 },
  statusDescription: { fontSize: 15, lineHeight: 22, marginTop: 20 },
  extensionWarning: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 14, padding: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.16)" },
  extensionWarningText: { flex: 1, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.8 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 10 },
  metricsRow: { flexDirection: "row", gap: 10 },
  toggleSection: { paddingVertical: 16 },
  desc: { fontSize: 13, marginBottom: 12 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  toggleSwitch: { width: 56, height: 32, borderRadius: 16, backgroundColor: "#ccc", position: "relative" },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", position: "absolute", top: 4, left: 4 },
  toggleLabel: { fontSize: 14 },
  actionSection: { marginTop: 12 },
  noticeText: { fontSize: 12, color: "#999", marginTop: 8 },
});
