import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { RULE_GROUPS } from "@/lib/adshield-engine";
import { useAdShield } from "@/lib/adshield-context";
import { useColors } from "@/hooks/use-colors";

export default function RulesScreen() {
  const colors = useColors();
  const { settings, whitelist, setRuleEnabled, addWhitelistDomain, removeWhitelistDomain } = useAdShield();
  const [domain, setDomain] = useState("");
  const addDomain = () => {
    if (addWhitelistDomain(domain)) { setDomain(""); return; }
    Alert.alert("无法添加", "请输入有效域名，例如 example.com；已存在的域名无需重复添加。");
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold text-foreground">规则中心</Text>
        <Text className="mt-1 text-base text-muted">调整本地拦截策略与网站例外。</Text>
        <Text className="mt-7 text-sm font-semibold text-muted">防护规则</Text>
        {RULE_GROUPS.map((group) => (
          <View key={group.key} className="mt-3 rounded-2xl border border-border bg-surface p-4">
            <View style={styles.ruleRow}>
              <View style={[styles.ruleIcon, { backgroundColor: `${colors.primary}10` }]}><MaterialIcons name={group.key === "ads" ? "block" : group.key === "trackers" ? "visibility-off" : group.key === "popups" ? "open-in-new" : "auto-fix-high"} size={22} color={colors.primary} /></View>
              <View style={styles.ruleCopy}><Text className="text-base font-semibold text-foreground">{group.title}</Text><Text className="mt-1 text-sm leading-5 text-muted">{group.description}</Text></View>
              <Switch value={settings.rules[group.key]} onValueChange={(value) => setRuleEnabled(group.key, value)} trackColor={{ false: colors.border, true: colors.success }} />
            </View>
            <Text className="mt-3 text-xs text-muted">覆盖 {group.domains.length} 类本地匹配项</Text>
          </View>
        ))}
        <Text className="mt-7 text-sm font-semibold text-muted">白名单</Text>
        <Text className="mt-2 text-sm leading-5 text-muted">加入白名单的网站将跳过本地过滤，适合需要保留完整页面功能的网站。</Text>
        {whitelist.map((item) => <WhitelistItem key={item} domain={item} onRemove={() => removeWhitelistDomain(item)} />)}
        {whitelist.length === 0 && <Text className="mt-3 text-sm text-muted">尚未添加例外网站。</Text>}
        <View className="mt-3 rounded-2xl border border-border bg-surface p-3">
          <TextInput value={domain} onChangeText={setDomain} onSubmitEditing={addDomain} returnKeyType="done" placeholder="添加域名，例如 example.com" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
          <Pressable onPress={addDomain} style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><MaterialIcons name="add" size={20} color="#FFFFFF" /><Text style={styles.addText}>加入白名单</Text></Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function WhitelistItem({ domain, onRemove }: { domain: string; onRemove: () => void }) {
  const colors = useColors();
  return <View className="mt-3 flex-row items-center rounded-2xl border border-border bg-surface p-4"><View style={[styles.ruleIcon, { backgroundColor: `${colors.success}16` }]}><MaterialIcons name="check-circle" size={21} color={colors.success} /></View><Text className="ml-3 flex-1 text-base font-medium text-foreground">{domain}</Text><Pressable accessibilityLabel={`移除 ${domain}`} onPress={onRemove} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}><MaterialIcons name="close" size={20} color={colors.error} /></Pressable></View>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 34 },
  ruleRow: { flexDirection: "row", alignItems: "center" },
  ruleIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  ruleCopy: { flex: 1, marginHorizontal: 12 },
  input: { height: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 15 },
  addButton: { height: 46, borderRadius: 13, marginTop: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  addText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  removeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
});
