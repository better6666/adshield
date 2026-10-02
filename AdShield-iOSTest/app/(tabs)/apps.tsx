import { useState, useEffect } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View, Pressable, Switch, Button } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import type { InstalledApp, VpnStatus } from "@/modules/adshield-vpn";

// Android 应用包名管理模块
type AppManagerModuleType = {
  getStatusAsync(): Promise<VpnStatus>;
  getInstalledAppsAsync(): Promise<InstalledApp[]>;
  setTargetPackagesAsync(packages: string[]): Promise<unknown>;
};
let AppManagerModule: AppManagerModuleType | null = null;
if (Platform.OS === "android") {
  try {
    AppManagerModule = require("@/modules/adshield-vpn/src/AdShieldVpnModule").default;
  } catch (e) {
    console.warn("Failed to load app manager:", e);
  }
}

export default function AppsScreen() {
  const colors = useColors();

  // Android 特有状态
  const [targetApps, setTargetApps] = useState<string[]>([]);
  const [installedApps, setInstalledApps] = useState<(InstalledApp & { selected: boolean })[]>([]);
  // iOS 没有可枚举的已安装应用，loading 必须为 false，否则页面永远停在转圈。
  const [loading, setLoading] = useState(Platform.OS !== "android");
  const [scanning, setScanning] = useState(false);

  // 加载已安装应用列表
  useEffect(() => {
    if (Platform.OS !== "android" || !AppManagerModule) {
      setLoading(false);
      return;
    }

    loadInstalledApps();
  }, []);

  const loadInstalledApps = async () => {
    setScanning(true);
    try {
      if (!AppManagerModule) return;
      const [apps, status] = await Promise.all([
        AppManagerModule.getInstalledAppsAsync(),
        AppManagerModule.getStatusAsync(),
      ]);
      const selectedPackages = status.protectsAllApps
        ? apps.map((app) => app.packageName)
        : status.targetPackages;
      setTargetApps(selectedPackages);
      setInstalledApps(apps.map((app) => ({
        ...app,
        selected: selectedPackages.includes(app.packageName),
      })));
    } catch (e) {
      console.error("Failed to scan apps:", e);
    } finally {
      setScanning(false);
      setLoading(false);
    }
  };

  const toggleAppSelection = async (packageName: string, selected: boolean) => {
    const newApps = installedApps.map(app => 
      app.packageName === packageName ? { ...app, selected } : app
    );
    setInstalledApps(newApps);
    
    if (Platform.OS === "android" && AppManagerModule) {
      try {
        const selectedPackages = newApps.filter(app => app.selected).map(app => app.packageName);
        await AppManagerModule.setTargetPackagesAsync(selectedPackages);
        setTargetApps(selectedPackages);
      } catch (e: any) {
        Alert.alert("保存失败", e.message || "请重试");
        // 恢复原状
        loadInstalledApps();
      }
    }
  };

  const selectAll = async () => {
    const allSelected = installedApps.every(app => app.selected);
    const newApps = installedApps.map(app => ({ ...app, selected: !allSelected }));
    setInstalledApps(newApps);
    
    if (Platform.OS === "android" && AppManagerModule) {
      const packages = newApps.filter(app => app.selected).map(app => app.packageName);
      try {
        await AppManagerModule.setTargetPackagesAsync(packages);
        setTargetApps(packages);
      } catch (e: any) {
        Alert.alert("保存失败", e.message || "请重试");
        loadInstalledApps();
      }
    }
  };

  if (loading || scanning) {
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
        <Text className="text-3xl font-bold text-foreground">受保护应用</Text>
        <Text className="mt-1 text-base text-muted">
          {Platform.OS === "ios" 
            ? "iOS 版本目前仅支持 Safari 浏览器广告拦截。"
            : "选择需要经过本地 DNS 广告域名过滤的应用。修改后，运行中的防护会自动重启并应用新范围。"}
        </Text>

        {/* Android 说明 */}
        {Platform.OS === "android" && targetApps.length > 0 && (
          <View style={[styles.infoCard, { backgroundColor: `${colors.success}10`, borderColor: `${colors.success}22` }]}>
            <MaterialIcons name="info-outline" size={20} color={colors.success} />
            <Text style={[styles.infoText, { color: colors.foreground }]}>
              当前选择 {targetApps.length} 个应用。可拦截独立广告域名；与正常内容共用接口的信息流、活动位和离线广告仍可能显示。
            </Text>
          </View>
        )}

        {/* iOS 提示 */}
        {Platform.OS === "ios" && (
          <View style={[styles.notice, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}22` }]}>
            <MaterialIcons name="info-outline" size={20} color={colors.primary} />
            <Text style={[styles.noticeText, { color: colors.foreground }]}>
              iOS 的广告拦截仅作用于 Safari 浏览器。盒马、微博、知乎等原生 App 内广告不在当前防护范围内。
            </Text>
          </View>
        )}

        {/* Android 应用列表 */}
        {Platform.OS === "android" && (
          <>
            <View style={styles.sectionHeader}>
              <Text className="text-lg font-bold text-foreground">可用应用</Text>
              <Button onPress={selectAll} title={installedApps.some(app => !app.selected) ? "全选" : "取消全选"} color={colors.primary} />
            </View>
            
            {installedApps.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="apps" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted }}>未检测到可用应用</Text>
              </View>
            ) : (
              <View style={styles.appList}>
                {installedApps.map((app) => (
                  <AppItem
                    key={app.packageName}
                    appName={app.appName}
                    packageName={app.packageName}
                    selected={app.selected}
                    onToggle={(selected) => toggleAppSelection(app.packageName, selected)}
                    colors={colors}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function AppItem({ appName, packageName, selected, onToggle, colors }: { 
  appName: string; 
  packageName: string; 
  selected: boolean;
  onToggle: (selected: boolean) => void;
  colors: any;
}) {
  return (
    <Pressable 
      onPress={() => onToggle(!selected)}
      style={({ pressed }) => [
        styles.appItem,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed
      ]}
    >
      <View style={[styles.appIcon, { backgroundColor: selected ? colors.primary : `${colors.muted}10` }]}>
        <MaterialIcons 
          name={selected ? "check-circle" : "radio-button-unchecked"} 
          size={24} 
          color={selected ? "#FFFFFF" : colors.muted} 
        />
      </View>
      <View style={styles.appInfo}>
        <Text className="text-base font-medium text-foreground">{appName}</Text>
        <Text style={[styles.packageName, { color: colors.muted }]}>{packageName}</Text>
      </View>
      <Switch
        value={selected}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 18, gap: 16 },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, padding: 14, borderRadius: 16 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, padding: 14, borderRadius: 16 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 8, marginBottom: 4 },
  appList: { gap: 10 },
  appItem: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  appIcon: { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  appInfo: { flex: 1 },
  packageName: { fontSize: 12, marginTop: 2 },
  emptyState: { padding: 40, alignItems: "center" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
