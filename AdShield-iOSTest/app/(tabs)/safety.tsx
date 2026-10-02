import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { useAdShield } from "@/lib/adshield-context";
import { useColors } from "@/hooks/use-colors";
import { APP_RULE_PACKS, TIER_LABELS, type RuleTier } from "@/lib/adshield-apprules";
import { PAUSE_OPTIONS, formatRemaining } from "@/lib/adshield-safety";
import { DNS_SERVER_PRESETS, describeDnsScope } from "@/lib/adshield-dns";
import { collectEnabledNetworkDomains } from "@/lib/adshield-engine";

const TIER_ORDER: RuleTier[] = ["safe", "balanced", "aggressive"];

export default function SafetyScreen() {
  const colors = useColors();
  const {
    settings, ruleTier, whitelist, setRuleTier, dnsSettings, setDnsEnabled, setDnsPreset, setDnsScopeToAdDomains,
    dnsAvailable, dnsUnavailableReason, dnsState, safetyState, paused, circuitBreakerTripped, pauseProtection, resumeProtection, blockedDomainCount, openDnsSettings,
  } = useAdShield();
  const [showApps, setShowApps] = useState(false);
  const dnsBlocked = !dnsAvailable;
  // DNS 的 matchDomains 必须与界面显示的范围同源并扣除白名单，否则"只对 N 个
  // 域名生效"和实际写进系统的不是一回事（见 context 的 applyDnsConfiguration）。
  const dnsAdDomains = useMemo(
    () => collectEnabledNetworkDomains(settings, ruleTier, whitelist),
    [settings, ruleTier, whitelist],
  );

  const remaining = safetyState.pausedUntil !== null ? safetyState.pausedUntil - Date.now() : 0;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold text-foreground">安全</Text>
        <Text className="mt-1 text-base text-muted">规则强度、一键暂停与系统级加密 DNS。</Text>

        {paused && (
          <View style={[styles.banner, { backgroundColor: `${colors.warning}18`, borderColor: colors.warning }]}>
            <MaterialIcons name="pause-circle-filled" size={22} color={colors.warning} />
            <View style={styles.bannerCopy}>
              <Text style={[styles.bannerTitle, { color: colors.foreground }]}>防护已暂停</Text>
              <Text style={[styles.bannerBody, { color: colors.muted }]}>剩余 {formatRemaining(remaining)}，期间不会拦截任何请求。</Text>
            </View>
            <Pressable onPress={resumeProtection} style={({ pressed }) => [styles.bannerButton, { backgroundColor: colors.warning }, pressed && styles.pressed]}>
              <Text style={styles.bannerButtonText}>立即恢复</Text>
            </Pressable>
          </View>
        )}

        {circuitBreakerTripped && (
          <View style={[styles.banner, { backgroundColor: `${colors.error}18`, borderColor: colors.error }]}>
            <MaterialIcons name="report-problem" size={22} color={colors.error} />
            <View style={styles.bannerCopy}>
              <Text style={[styles.bannerTitle, { color: colors.foreground }]}>规则已自动回退</Text>
              <Text style={[styles.bannerBody, { color: colors.muted }]}>
                规则连续写入失败，已回退到上一个版本并暂停下发完整规则。连续同步成功 {safetyState.failureThreshold} 次后自动恢复。
              </Text>
            </View>
            <Pressable onPress={resumeProtection} style={({ pressed }) => [styles.bannerButton, { backgroundColor: colors.error }, pressed && styles.pressed]}>
              <Text style={styles.bannerButtonText}>立即重试</Text>
            </Pressable>
          </View>
        )}

        <Text className="mt-7 text-sm font-semibold text-muted">一键暂停</Text>
        <Text className="mt-2 text-sm leading-5 text-muted">遇到 App 功能异常时，先暂停而不是关掉防护——暂停期间所有请求直接放行，方便判断是不是规则的问题。</Text>
        <View style={styles.pauseRow}>
          {PAUSE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => pauseProtection(option.value)}
              style={({ pressed }) => [styles.pauseButton, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}
            >
              <Text style={[styles.pauseButtonText, { color: colors.foreground }]}>{option.label.replace("暂停 ", "")}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="mt-7 text-sm font-semibold text-muted">规则强度</Text>
        <Text className="mt-2 text-sm leading-5 text-muted">当前档位收录域名 {blockedDomainCount} 个。Android VPN 会按规则开关同步其中可用于 DNS 匹配的域名；iOS 仅同步到 Safari。</Text>
        {TIER_ORDER.map((tier) => {
          const meta = TIER_LABELS[tier];
          const active = ruleTier === tier;
          const riskColor = meta.risk === "low" ? colors.success : meta.risk === "medium" ? colors.warning : colors.error;
          return (
            <Pressable
              key={tier}
              onPress={() => setRuleTier(tier)}
              style={({ pressed }) => [styles.tierCard, { borderColor: active ? colors.primary : colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}
            >
              <View style={styles.tierHead}>
                <View style={[styles.tierDot, { backgroundColor: riskColor }]} />
                <Text style={[styles.tierTitle, { color: colors.foreground }]}>{meta.title}</Text>
                {active && <MaterialIcons name="check-circle" size={20} color={colors.primary} />}
              </View>
              <Text style={[styles.tierBody, { color: colors.muted }]}>{meta.description}</Text>
              {tier === "aggressive" && (
                <Text style={[styles.tierWarn, { color: colors.error }]}>激进档的域名集与均衡档相同，选它不会比均衡档拦得更多。</Text>
              )}
            </Pressable>
          );
        })}

        <Pressable onPress={() => setShowApps((value) => !value)} style={({ pressed }) => [styles.expandRow, pressed && styles.pressed]}>
          <MaterialIcons name={showApps ? "expand-less" : "expand-more"} size={22} color={colors.primary} />
          <Text style={[styles.expandText, { color: colors.primary }]}>
            {showApps ? "收起" : `展开中国 App 规则包（${APP_RULE_PACKS.length} 个 App）`}
          </Text>
        </Pressable>
        {showApps && APP_RULE_PACKS.map((pack) => (
          <View key={pack.name} style={[styles.appCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.appHead}>
              <Text style={[styles.appName, { color: colors.foreground }]}>{pack.name}</Text>
              <View style={[styles.appBadge, { backgroundColor: pack.verified ? `${colors.success}18` : `${colors.warning}18` }]}>
                <Text style={[styles.appBadgeText, { color: pack.verified ? colors.success : colors.warning }]}>
                  {pack.adDomains.length > 0 ? "有广告规则" : pack.verified ? "仅核心域名" : "待采集"}
                </Text>
              </View>
            </View>
            <Text style={[styles.appMeta, { color: colors.muted }]}>
              核心接口放行 {pack.protectedDomains.length} 个域名{pack.adDomains.length > 0 ? ` · 广告域名 ${pack.adDomains.length} 个` : ""}
            </Text>
            {pack.note && <Text style={[styles.appNote, { color: colors.muted }]}>{pack.note}</Text>}
          </View>
        ))}
        {showApps && (
          <Text style={[styles.appHint, { color: colors.muted }]}>
            “核心域名”只用于避免误伤，不代表已经能去除该 App 广告。没有专属广告域名的 App 仅使用通用第三方 SDK 规则；同源信息流和运营活动广告仍可能显示。
          </Text>
        )}

        <Text className="mt-7 text-sm font-semibold text-muted">系统级加密 DNS</Text>
        <Text className="mt-2 text-sm leading-5 text-muted">
          {dnsAvailable ? describeDnsScope(dnsSettings, dnsAdDomains) : "本机无法写入系统 DNS 设置，这一层已停用。"}
        </Text>
        {dnsBlocked && (
          <View style={[styles.blockedCard, { borderColor: colors.warning, backgroundColor: `${colors.warning}12` }]}>
            <MaterialIcons name="info-outline" size={20} color={colors.warning} />
            <Text style={[styles.blockedText, { color: colors.foreground }]}>
              写入系统 DNS 需要 Apple 的 Network Extensions 能力，当前签名账号拿不到该能力（Xcode 明确提示“个人团队不支持 Network Extensions”）。
              因此加密 DNS 层在当前账号下不可用， Safari 内容拦截与规则包不受影响。
              升级到付费开发者账号后重新签名即可打开这一层。
            </Text>
          </View>
        )}
        <View style={[styles.dnsCard, dnsBlocked && styles.dnsCardDisabled, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.dnsRow}>
            <View style={styles.dnsCopy}>
              <Text style={[styles.dnsTitle, { color: colors.foreground }]}>启用加密 DNS</Text>
              <Text style={[styles.dnsBody, { color: colors.muted }]}>
                {dnsBlocked ? "当前账号不支持，无法启用" : dnsState?.enabled ? "已在系统中开启" : "写入配置后需在 设置 → 通用 → VPN 与网络 → DNS 手动开启"}
              </Text>
            </View>
            <Switch
              value={dnsSettings.enabled}
              onValueChange={(value) => setDnsEnabled(value)}
              disabled={dnsBlocked}
              trackColor={{ false: colors.border, true: colors.success }}
            />
          </View>

          <View style={styles.dnsRow}>
            <View style={styles.dnsCopy}>
              <Text style={[styles.dnsTitle, { color: colors.foreground }]}>只对广告域名生效</Text>
              <Text style={[styles.dnsBody, { color: colors.muted }]}>
                开启后只有广告域名走过滤解析，App 自有接口仍走系统 DNS。强烈建议保持开启。
              </Text>
            </View>
            <Switch
              value={dnsSettings.scopeToAdDomains}
              onValueChange={(value) => setDnsScopeToAdDomains(value)}
              disabled={dnsBlocked}
              trackColor={{ false: colors.border, true: colors.success }}
            />
          </View>

          <Text style={[styles.dnsSectionLabel, { color: colors.muted }]}>解析服务器</Text>
          {DNS_SERVER_PRESETS.map((preset) => {
            const active = dnsSettings.presetId === preset.id;
            return (
              <Pressable
                key={preset.id}
                onPress={() => setDnsPreset(preset.id)}
                disabled={dnsBlocked}
                style={({ pressed }) => [styles.presetRow, { borderColor: active ? colors.primary : colors.border }, dnsBlocked && styles.presetRowDisabled, pressed && styles.pressed]}
              >
                <View style={styles.presetHead}>
                  <Text style={[styles.presetName, { color: colors.foreground }]}>{preset.label}</Text>
                  {preset.filtersAds && (
                    <View style={[styles.appBadge, { backgroundColor: `${colors.primary}18` }]}>
                      <Text style={[styles.appBadgeText, { color: colors.primary }]}>过滤广告</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.presetNote, { color: colors.muted }]}>{preset.note}</Text>
                {active && <MaterialIcons name="check-circle" size={18} color={colors.primary} style={styles.presetCheck} />}
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => openDnsSettings().then((opened) => { if (!opened) Alert.alert("无法打开", "请手动前往 设置 → 通用 → VPN 与网络 → DNS 开启。"); })}
            disabled={dnsBlocked}
            style={({ pressed }) => [styles.openButton, dnsBlocked && styles.openButtonDisabled, { borderColor: colors.primary }, pressed && styles.pressed]}
          >
            <MaterialIcons name="open-in-new" size={18} color={colors.primary} />
            <Text style={[styles.openButtonText, { color: colors.primary }]}>前往系统 DNS 设置</Text>
          </Pressable>
        </View>

        <Text className="mt-7 text-sm font-semibold text-muted">安全保证</Text>
        <View style={[styles.guaranteeCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Guarantee colors={colors} icon="lock" text="不拦截 VPN 流量，不劫持 HTTPS，不安装根证书。" />
          <Guarantee colors={colors} icon="verified-user" text="Apple、iCloud、APNs、支付、银行、登录、验证码、地图、系统更新与主流 CDN 永不拦截。" />
          <Guarantee colors={colors} icon="pause-circle-outline" text="服务异常时默认放行（fail-open），宁可漏掉一条广告，也不把正常 App 弄坏。" />
          <Guarantee colors={colors} icon="history" text="连续失败会自动回退规则版本，熔断期间一律放行。" />
        </View>

        <Text style={[styles.footnote, { color: colors.muted }]}>
          iOS 平台限制：信息流里和 App 原生界面中的广告（AdBannerView）、摇一摇跳转、推送广告无法由第三方 App 拦截。
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function Guarantee({ colors, icon, text }: { colors: ReturnType<typeof useColors>; icon: string; text: string }) {
  return (
    <View style={styles.guaranteeRow}>
      <MaterialIcons name={icon as never} size={18} color={colors.success} />
      <Text style={[styles.guaranteeText, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 34 },
  banner: { marginTop: 18, borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  bannerCopy: { flex: 1 },
  bannerTitle: { fontSize: 15, fontWeight: "700" },
  bannerBody: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  bannerButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  bannerButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  pauseRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pauseButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  pauseButtonText: { fontSize: 14, fontWeight: "600" },
  tierCard: { marginTop: 10, borderWidth: 1, borderRadius: 16, padding: 14 },
  tierHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  tierDot: { width: 9, height: 9, borderRadius: 5 },
  tierTitle: { flex: 1, fontSize: 16, fontWeight: "700" },
  tierBody: { marginTop: 6, fontSize: 13, lineHeight: 19 },
  tierWarn: { marginTop: 6, fontSize: 12, lineHeight: 18 },
  expandRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 4 },
  expandText: { fontSize: 14, fontWeight: "600" },
  appCard: { marginTop: 8, borderWidth: 1, borderRadius: 14, padding: 12 },
  appHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  appName: { fontSize: 15, fontWeight: "600" },
  appBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  appBadgeText: { fontSize: 11, fontWeight: "700" },
  appMeta: { marginTop: 5, fontSize: 12, lineHeight: 17 },
  appNote: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  appHint: { marginTop: 10, fontSize: 12, lineHeight: 18 },
  dnsCard: { marginTop: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  blockedCard: { marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start" },
  blockedText: { flex: 1, fontSize: 12, lineHeight: 19 },
  dnsCardDisabled: { opacity: 0.55 },
  presetRowDisabled: { opacity: 0.6 },
  openButtonDisabled: { opacity: 0.6 },
  dnsRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  dnsCopy: { flex: 1 },
  dnsTitle: { fontSize: 15, fontWeight: "600" },
  dnsBody: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  dnsSectionLabel: { marginTop: 10, fontSize: 12, fontWeight: "600" },
  presetRow: { marginTop: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  presetHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  presetName: { flex: 1, fontSize: 14, fontWeight: "600" },
  presetNote: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  presetCheck: { position: "absolute", right: 10, top: 10 },
  openButton: { marginTop: 12, borderWidth: 1, borderRadius: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  openButtonText: { fontSize: 14, fontWeight: "700" },
  guaranteeCard: { marginTop: 10, borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  guaranteeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  guaranteeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  footnote: { marginTop: 16, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
