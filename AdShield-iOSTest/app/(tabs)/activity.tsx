import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { BlockRecord, formatRecordTime } from "@/lib/adshield-engine";
import { useAdShield } from "@/lib/adshield-context";
import { useColors } from "@/hooks/use-colors";

const categoryNames: Record<string, string> = {
  ads: "广告请求",
  trackers: "跟踪器",
  popups: "弹窗与重定向",
  cosmetic: "页面净化",
  appAds: "应用内广告",
  redirects: "诱导跳转",
  sync: "规则同步",
};

const categoryIcons: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  ads: "block",
  trackers: "visibility-off",
  popups: "open-in-new",
  cosmetic: "auto-fix-high",
  appAds: "phone-android",
  redirects: "link-off",
  sync: "sync",
};

export default function ActivityScreen() {
  const colors = useColors();
  const { records, vpnStatus, safariRuleCount, clearRecords } = useAdShield();
  const confirmClear = () => Alert.alert("清空记录", "此操作只会删除本机记录，无法恢复。", [{ text: "取消", style: "cancel" }, { text: "清空", style: "destructive", onPress: clearRecords }]);
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, records.length === 0 && styles.emptyContent]}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text className="text-3xl font-bold text-foreground">防护记录</Text>
                <Text className="mt-1 text-base text-muted">规则同步与拦截状态。</Text>
              </View>
              {records.length > 0 && <Pressable onPress={confirmClear} style={({ pressed }) => [styles.clearButton, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={{ color: colors.error, fontWeight: "600" }}>清空</Text></Pressable>}
            </View>
            {/* Real-time stats */}
            <View style={styles.statsRow}>
              {Platform.OS === "ios" && (
                <View style={[styles.statCard, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}22` }]}>
                  <MaterialIcons name="language" size={18} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{safariRuleCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>Safari 活跃规则</Text>
                </View>
              )}
              {Platform.OS === "android" && (
                <View style={[styles.statCard, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}22` }]}>
                  <MaterialIcons name="vpn-key" size={18} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{vpnStatus?.blockedCount ?? 0}</Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>VPN 已拦截</Text>
                </View>
              )}
              <View style={[styles.statCard, { backgroundColor: `${colors.success}10`, borderColor: `${colors.success}22` }]}>
                <MaterialIcons name="history" size={18} color={colors.success} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>{records.length}</Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>同步记录</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => <RecordRow record={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}10` }]}><MaterialIcons name="history" size={36} color={colors.primary} /></View>
            <Text className="mt-5 text-xl font-bold text-foreground">还没有防护记录</Text>
            <Text className="mt-2 max-w-xs text-center text-base leading-6 text-muted">开启防护后，规则同步和拦截事件会显示在这里。</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

function RecordRow({ record }: { record: BlockRecord }) {
  const colors = useColors();
  const isSync = record.category === "sync";
  const iconColor = isSync ? colors.primary : colors.error;
  const iconBg = isSync ? `${colors.primary}12` : `${colors.error}12`;
  const iconName = categoryIcons[record.category] || "block";
  return (
    <View className="mt-3 flex-row items-center rounded-2xl border border-border bg-surface p-4">
      <View style={[styles.recordIcon, { backgroundColor: iconBg }]}><MaterialIcons name={iconName} size={20} color={iconColor} /></View>
      <View style={styles.recordCopy}>
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>{record.domain}</Text>
        <Text className="mt-1 text-sm text-muted">{categoryNames[record.category] ?? record.category}</Text>
      </View>
      <Text className="text-xs text-muted">{formatRecordTime(record.createdAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 32 },
  emptyContent: { flexGrow: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  clearButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, alignItems: "center", gap: 4 },
  statValue: { fontSize: 22, fontWeight: "700" },
  statLabel: { fontSize: 11 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 90 },
  emptyIcon: { width: 76, height: 76, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  recordIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  recordCopy: { flex: 1, marginLeft: 12 },
  pressed: { opacity: 0.65 },
});
