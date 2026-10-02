import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { BlockRecord, DEFAULT_SETTINGS, ProtectionSettings, RuleKey, collectEnabledNetworkDomains, createSyncRecord, generateBlockerRulesJSON, normalizeDomain } from "@/lib/adshield-engine";
import { collectProtectedDomains, type RuleTier } from "@/lib/adshield-apprules";import { DEFAULT_DNS_SETTINGS, buildDnsConfiguration, type DnsSettings } from "@/lib/adshield-dns";
import {
  INITIAL_SAFETY_STATE,
  expirePauseIfNeeded,
  isCircuitBreakerTripped,
  isPaused,
  registerFailure,
  registerSuccess,
  resume as resumeSafety,
  pause as pauseSafety,
  type PauseDuration,
  type SafetyState,
} from "@/lib/adshield-safety";
import type { AdShieldExtensionState } from "@/modules/adshield-safari";
import type { DnsAvailability, DnsState } from "@/modules/adshield-dns";

// v2 enables protection by default and replaces the earlier preview-only state.
const STORAGE_KEY = "adshield-local-state-v2";
type StoredState = { settings: ProtectionSettings; whitelist: string[]; records: BlockRecord[]; ruleTier: RuleTier; dnsSettings: DnsSettings; safetyState: SafetyState };
export type VpnStatus = { available: boolean; prepared: boolean; running: boolean; packageCount: number; blockedCount: number; targetPackages: string[]; protectsAllApps: boolean; ruleCount: number };
export type AdAssistStatus = { available: boolean; enabled: boolean; connected: boolean; detections: number };
type NativeVpn = { getStatusAsync(): Promise<VpnStatus>; requestSystemPermissionAsync(): Promise<VpnStatus>; startAsync(): Promise<VpnStatus>; stopAsync(): Promise<VpnStatus>; setWhitelistAsync(domains: string[]): Promise<void>; setRulesAsync(blockedDomains: string[], whitelist: string[]): Promise<VpnStatus>; getAdAssistStatusAsync(): Promise<AdAssistStatus>; openAdAssistSettingsAsync(): Promise<AdAssistStatus>; setAdAssistEnabledAsync(enabled: boolean): Promise<AdAssistStatus> };
type NativeSafari = { updateBlockerRulesAsync(rulesJSON: string): Promise<number>; isAvailableAsync(): Promise<boolean>; getCurrentRuleCountAsync(): Promise<number>; getExtensionStateAsync(): Promise<AdShieldExtensionState>; openSafariExtensionSettingsAsync(): Promise<boolean> };
type NativeDns = { isAvailableAsync(): Promise<DnsAvailability>; configureAsync(options: { protocol: string; endpoint: string; matchDomains: string[] | null; allowFailover: boolean }): Promise<{ saved: boolean; enabled: boolean }>; getStateAsync(): Promise<DnsState>; disableAsync(): Promise<boolean>; openDnsSettingsAsync(): Promise<boolean> };

type AdShieldContextValue = StoredState & {
  hydrated: boolean;
  vpnStatus: VpnStatus | null;
  adAssistStatus: AdAssistStatus | null;
  safariAvailable: boolean;
  safariRuleCount: number;
  safariExtensionState: AdShieldExtensionState | null;
  dnsAvailable: boolean;
  /** dnsAvailable 为 false 时的原因，直接展示给用户。 */
  dnsUnavailableReason: string | null;
  dnsState: DnsState | null;
  /** 当前档位下会被拦截的域名数（含通用第三方广告 SDK）。 */
  blockedDomainCount: number;
  /** 当前是否处于一键暂停中。 */
  paused: boolean;
  /** 熔断是否仍生效：规则连续写坏后自动回退，此时只下发最小规则集。 */
  circuitBreakerTripped: boolean;
  setProtectionEnabled: (enabled: boolean) => Promise<number>;
  setRuleEnabled: (key: RuleKey, enabled: boolean) => void;
  setRuleTier: (tier: RuleTier) => void;
  setDnsEnabled: (enabled: boolean) => Promise<void>;
  setDnsPreset: (presetId: string) => Promise<void>;
  setDnsScopeToAdDomains: (scoped: boolean) => Promise<void>;
  pauseProtection: (duration: PauseDuration) => void;
  resumeProtection: () => void;
  setAutoStart: (enabled: boolean) => void;
  setNotifications: (enabled: boolean) => void;
  setAppTrafficProtection: (enabled: boolean) => void;
  setShakeRiskAlerts: (enabled: boolean) => void;
  openAdAssistSettings: () => Promise<AdAssistStatus | null>;
  requestVpnPermission: () => Promise<VpnStatus | null>;
  startVpn: () => Promise<VpnStatus | null>;
  stopVpn: () => Promise<VpnStatus | null>;
  addWhitelistDomain: (domain: string) => boolean;
  removeWhitelistDomain: (domain: string) => void;
  syncSafariRules: () => Promise<number>;
  openSafariExtensionSettings: () => Promise<boolean>;
  openDnsSettings: () => Promise<boolean>;
  clearRecords: () => void;
};

const defaultState: StoredState = {
  settings: DEFAULT_SETTINGS,
  whitelist: [],
  records: [],
  ruleTier: "safe",
  dnsSettings: DEFAULT_DNS_SETTINGS,
  safetyState: INITIAL_SAFETY_STATE,
};
const AdShieldContext = createContext<AdShieldContextValue | null>(null);

function loadNativeVpn(): NativeVpn | null {
  if (Platform.OS !== "android") return null;
  try { return require("@/modules/adshield-vpn").default as NativeVpn; } catch { return null; }
}

function loadNativeSafari(): NativeSafari | null {
  if (Platform.OS !== "ios") return null;
  try { return require("@/modules/adshield-safari").default as NativeSafari; } catch { return null; }
}

function loadNativeDns(): NativeDns | null {
  if (Platform.OS !== "ios") return null;
  try { return require("@/modules/adshield-dns").default as NativeDns; } catch { return null; }
}

export function AdShieldProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<StoredState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [vpnStatus, setVpnStatus] = useState<VpnStatus | null>(null);
  const [adAssistStatus, setAdAssistStatus] = useState<AdAssistStatus | null>(null);
  const [safariAvailable, setSafariAvailable] = useState(false);
  const [safariRuleCount, setSafariRuleCount] = useState(0);
  const [safariExtensionState, setSafariExtensionState] = useState<AdShieldExtensionState | null>(null);
  const [dnsAvailable, setDnsAvailable] = useState(false);
  const [dnsUnavailableReason, setDnsUnavailableReason] = useState<string | null>(null);
  const [dnsState, setDnsState] = useState<DnsState | null>(null);
  const nativeVpn = useMemo(loadNativeVpn, []);
  const nativeSafari = useMemo(loadNativeSafari, []);
  const nativeDns = useMemo(loadNativeDns, []);

  // Use ref to access latest state in callbacks without stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<StoredState>;
      setState({
        settings: { ...DEFAULT_SETTINGS, ...saved.settings, rules: { ...DEFAULT_SETTINGS.rules, ...saved.settings?.rules } },
        whitelist: Array.isArray(saved.whitelist) ? saved.whitelist : [],
        records: Array.isArray(saved.records) ? saved.records : [],
        ruleTier: saved.ruleTier ?? "safe",
        dnsSettings: { ...DEFAULT_DNS_SETTINGS, ...saved.dnsSettings },
        safetyState: { ...INITIAL_SAFETY_STATE, ...saved.safetyState },
      });
    }).catch(() => undefined).finally(() => setHydrated(true));
  }, []);

  useEffect(() => { if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined); }, [hydrated, state]);
  useEffect(() => { nativeVpn?.getStatusAsync().then(setVpnStatus).catch(() => undefined); }, [nativeVpn]);
  useEffect(() => { nativeVpn?.getAdAssistStatusAsync().then(setAdAssistStatus).catch(() => undefined); }, [nativeVpn]);
  const refreshSafariState = useCallback(() => {
    if (!nativeSafari) return;
    nativeSafari.getCurrentRuleCountAsync().then(setSafariRuleCount).catch(() => undefined);
    nativeSafari.getExtensionStateAsync().then(setSafariExtensionState).catch(() => undefined);
  }, [nativeSafari]);

  useEffect(() => {
    nativeSafari?.isAvailableAsync().then(setSafariAvailable).catch(() => undefined);
    refreshSafariState();
  }, [nativeSafari, refreshSafariState]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        nativeVpn?.getAdAssistStatusAsync().then(setAdAssistStatus).catch(() => undefined);
        refreshSafariState();
        // DNS 是否在系统里被用户打开，只能回前台时才知道。
        nativeDns?.getStateAsync().then(setDnsState).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [nativeVpn, nativeDns, refreshSafariState]);
  // Android's native VPN owns the live DNS matcher. Keep it synchronized with
  // every setting that changes the effective rule set, including pause and
  // circuit-breaker state. An empty set intentionally means "allow all".
  useEffect(() => {
    if (!hydrated || !nativeVpn) return;
    const safetyAllowsBlocking = !isPaused(state.safetyState, Date.now())
      && !isCircuitBreakerTripped(state.safetyState);
    // 关键白名单 + 用户白名单合成一份，规则域名单和白名单都从这里出，
    // 两边才不会互相打架（白名单放行的域名不该再出现在待拦截清单里）。
    const whitelist = [...new Set([...collectProtectedDomains(), ...state.whitelist])];
    const blockedDomains = safetyAllowsBlocking
      ? collectEnabledNetworkDomains(state.settings, state.ruleTier, whitelist)
      : [];
    nativeVpn.setRulesAsync(blockedDomains, whitelist).then(setVpnStatus).catch(() => undefined);
  }, [hydrated, nativeVpn, state.settings, state.ruleTier, state.safetyState, state.whitelist]);

  // 暂停到期后自动恢复，避免用户忘了自己暂停过。
  // 同一个定时器也推进 now，让"剩余时间"显示会走动。
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hydrated) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      setState((prev) => {
        const next = expirePauseIfNeeded(prev.safetyState, current);
        return next === prev.safetyState ? prev : { ...prev, safetyState: next };
      });
    }, 30 * 1000);
    return () => clearInterval(timer);
  }, [hydrated]);

  /**
   * Core function: sync current rules to Safari Content Blocker via App Group.
   * Returns the number of rules written, or 0 if not on iOS.
   *
   * 这里是安全引擎唯一的真实失败信号源：App 没有 VPN、没有网络扩展，
   * 观察不到任何一次具体的网络请求，能观察到的"规则是不是好的"只有
   * 写盘与 reload 是否成功（编译失败会以 WKError 6 抛出来）。
   * 因此同步失败就 registerFailure，成功就 registerSuccess。
   */
  const syncSafariRules = useCallback(async (): Promise<number> => {
    if (!nativeSafari) return 0;
    const current = stateRef.current;
    try {
      // 熔断期间不再下发完整规则，退回一条永远不匹配的占位规则：
      // 规则连续写坏时让 Safari 至少拿到一份能编译的东西，而不是反复失败。
      const tripped = isCircuitBreakerTripped(current.safetyState);
      const rulesJSON = tripped
        ? generateBlockerRulesJSON({ ...current.settings, enabled: false }, current.whitelist, current.ruleTier)
        : generateBlockerRulesJSON(current.settings, current.whitelist, current.ruleTier);
      const count = await nativeSafari.updateBlockerRulesAsync(rulesJSON);
      setSafariRuleCount(count);
      setState((prev) => ({ ...prev, safetyState: registerSuccess(prev.safetyState) }));
      return count;
    } catch (error) {
      console.warn("[AdShield] Safari rule sync failed:", error);
      setState((prev) => ({ ...prev, safetyState: registerFailure(prev.safetyState) }));
      return 0;
    }
  }, [nativeSafari]);

  // Keep the extension useful immediately after installation. iOS still asks
  // the user to enable the Safari content blocker once in system settings.
  // 同步不依赖开关状态：关闭防护时必须也写一次（占位规则），
  // 否则冷启动时扩展会沿用上一次的拦截规则，用户关了防护却仍在被拦截。
  useEffect(() => {
    if (hydrated && Platform.OS === "ios") {
      syncSafariRules().catch(() => undefined);
    }
    // 白名单也在依赖里：白名单决定 ignore-previous-rules 规则的内容，
    // 变了就必须重写，不能只依赖添加/删除入口里的 setTimeout 兜底。
  }, [hydrated, state.settings.enabled, state.ruleTier, state.whitelist, syncSafariRules]);

  const setProtectionEnabled = useCallback(async (enabled: boolean): Promise<number> => {
    setState((current) => ({ ...current, settings: { ...current.settings, enabled } }));
    // Wait a tick for stateRef to update, then sync rules
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (Platform.OS === "ios") {
      // Update stateRef manually for immediate sync
      stateRef.current = { ...stateRef.current, settings: { ...stateRef.current.settings, enabled } };
      const count = await syncSafariRules();
      if (count > 0) {
        const record = createSyncRecord(count, "Safari");
        setState((current) => ({ ...current, records: [record, ...current.records].slice(0, 200) }));
      }
      return count;
    }
    return 0;
  }, [syncSafariRules]);

  const setRuleEnabled = useCallback((key: RuleKey, enabled: boolean) => {
    setState((current) => ({ ...current, settings: { ...current.settings, rules: { ...current.settings.rules, [key]: enabled } } }));
    // Auto-sync Safari rules after rule change
    if (Platform.OS === "ios") {
      setTimeout(() => syncSafariRules(), 100);
    }
  }, [syncSafariRules]);

  const setRuleTier = useCallback((tier: RuleTier) => {
    setState((current) => ({ ...current, ruleTier: tier }));
    if (Platform.OS === "ios") {
      setTimeout(() => syncSafariRules(), 100);
    }
  }, [syncSafariRules]);

  // ── 加密 DNS 层 ────────────────────────────────────────────────
  // 配置只在"能生成合法配置"时才写系统：buildDnsConfiguration 返回 null 表示
  // 当前设置下不该启用（例如 preset 不存在，或限定域名后集合为空），
  // 这时直接关掉而不是写一份会把全部域名都送进过滤 resolver 的配置。
  const applyDnsConfiguration = useCallback(async (next: DnsSettings) => {
    if (!nativeDns) return;
    // matchDomains 必须先扣除白名单：被放行的域名（如 bcebos.com）不该被路由进
    // 过滤 resolver，否则等于绕过了白名单承诺。
    const allowlist = [...new Set([...collectProtectedDomains(), ...stateRef.current.whitelist])];
    const configuration = buildDnsConfiguration(next, collectEnabledNetworkDomains(stateRef.current.settings, stateRef.current.ruleTier, allowlist));
    if (!configuration) {
      try { await nativeDns.disableAsync(); } catch { /* 系统里本来就没有配置 */ }
      setDnsState(await nativeDns.getStateAsync().catch(() => null));
      return;
    }
    try {
      await nativeDns.configureAsync({
        protocol: configuration.protocol,
        endpoint: configuration.endpoint,
        matchDomains: configuration.matchDomains,
        allowFailover: configuration.allowFailover,
      });
    } catch (error) {
      console.warn("[AdShield] DNS configuration failed:", error);
      // 写失败时把开关退回关闭状态，避免 UI 显示"已开启"但系统并没有生效。
      setState((current) => ({ ...current, dnsSettings: { ...next, enabled: false } }));
      setDnsUnavailableReason(error instanceof Error ? error.message : String(error));
    }
    setDnsState(await nativeDns.getStateAsync().catch(() => null));
  }, [nativeDns]);

  useEffect(() => {
    if (!hydrated || !nativeDns) return;
    // isAvailableAsync 内部真的去 loadFromPreferences 一次：NEDNSSettingsManager 是
    // 公开 API，但没有 Network Extensions 能力时它照样编译、照样调用，只是返回
    // 权限错误。可用性只能这样实测，界面据此告诉用户为什么这一层用不了。
    nativeDns.isAvailableAsync().then((result) => {
      setDnsAvailable(result.available);
      setDnsUnavailableReason(result.available ? null : result.reason);
    }).catch((error: unknown) => {
      setDnsAvailable(false);
      setDnsUnavailableReason(error instanceof Error ? error.message : String(error));
    });
    nativeDns.getStateAsync().then(setDnsState).catch(() => undefined);
  }, [hydrated, nativeDns]);

  const setDnsEnabled = useCallback(async (enabled: boolean) => {
    setState((current) => {
      const next = { ...current.dnsSettings, enabled };
      applyDnsConfiguration(next).catch(() => undefined);
      return { ...current, dnsSettings: next };
    });
  }, [applyDnsConfiguration]);

  const setDnsPreset = useCallback(async (presetId: string) => {
    setState((current) => {
      const next = { ...current.dnsSettings, presetId };
      applyDnsConfiguration(next).catch(() => undefined);
      return { ...current, dnsSettings: next };
    });
  }, [applyDnsConfiguration]);

  const setDnsScopeToAdDomains = useCallback(async (scoped: boolean) => {
    setState((current) => {
      const next = { ...current.dnsSettings, scopeToAdDomains: scoped };
      applyDnsConfiguration(next).catch(() => undefined);
      return { ...current, dnsSettings: next };
    });
  }, [applyDnsConfiguration]);

  // ── 安全引擎：一键暂停与熔断 ────────────────────────────────────
  const pauseProtection = useCallback((duration: PauseDuration) => {
    setState((current) => ({ ...current, safetyState: pauseSafety(current.safetyState, duration, Date.now()) }));
  }, []);

  const resumeProtection = useCallback(() => {
    setState((current) => ({ ...current, safetyState: resumeSafety(current.safetyState) }));
  }, []);

  const setAutoStart = useCallback((autoStart: boolean) => setState((current) => ({ ...current, settings: { ...current.settings, autoStart } })), []);
  const setNotifications = useCallback((notifications: boolean) => setState((current) => ({ ...current, settings: { ...current.settings, notifications } })), []);
  const setAppTrafficProtection = useCallback((enabled: boolean) => {
    setState((current) => ({ ...current, settings: { ...current.settings, appTrafficProtection: enabled } }));
    if (enabled) nativeVpn?.startAsync().then(setVpnStatus).catch(() => setState((current) => ({ ...current, settings: { ...current.settings, appTrafficProtection: false } })));
    else nativeVpn?.stopAsync().then(setVpnStatus).catch(() => undefined);
  }, [nativeVpn]);
  const setShakeRiskAlerts = useCallback((shakeRiskAlerts: boolean) => {
    setState((current) => ({ ...current, settings: { ...current.settings, shakeRiskAlerts } }));
    nativeVpn?.setAdAssistEnabledAsync(shakeRiskAlerts).then(setAdAssistStatus).catch(() => undefined);
  }, [nativeVpn]);
  const openAdAssistSettings = useCallback(() => nativeVpn ? nativeVpn.openAdAssistSettingsAsync().then((next) => { setAdAssistStatus(next); return next; }).catch(() => null) : Promise.resolve(null), [nativeVpn]);
  const requestVpnPermission = useCallback(() => nativeVpn ? nativeVpn.requestSystemPermissionAsync().then((next) => { setVpnStatus(next); return next; }).catch(() => null) : Promise.resolve(null), [nativeVpn]);
  const startVpn = useCallback(() => nativeVpn ? nativeVpn.startAsync().then((next) => { setVpnStatus(next); return next; }) : Promise.resolve(null), [nativeVpn]);
  const stopVpn = useCallback(() => nativeVpn ? nativeVpn.stopAsync().then((next) => { setVpnStatus(next); return next; }) : Promise.resolve(null), [nativeVpn]);

  const addWhitelistDomain = useCallback((input: string) => {
    const domain = normalizeDomain(input);
    if (!domain.includes(".") || domain.length > 253) return false;
    let added = false;
    setState((current) => { if (current.whitelist.includes(domain)) return current; added = true; const nextWhitelist = [...current.whitelist, domain].sort(); nativeVpn?.setWhitelistAsync(nextWhitelist).catch(() => undefined); return { ...current, whitelist: nextWhitelist }; });
    // Auto-sync Safari rules after whitelist change
    if (added && Platform.OS === "ios") {
      setTimeout(() => syncSafariRules(), 100);
    }
    return added;
  }, [nativeVpn, syncSafariRules]);

  const removeWhitelistDomain = useCallback((domain: string) => {
    setState((current) => { const nextWhitelist = current.whitelist.filter((item) => item !== domain); nativeVpn?.setWhitelistAsync(nextWhitelist).catch(() => undefined); return { ...current, whitelist: nextWhitelist }; });
    // Auto-sync Safari rules after whitelist change
    if (Platform.OS === "ios") {
      setTimeout(() => syncSafariRules(), 100);
    }
  }, [nativeVpn, syncSafariRules]);

  const openSafariExtensionSettings = useCallback(async (): Promise<boolean> => {
    if (!nativeSafari) return false;
    try {
      return await nativeSafari.openSafariExtensionSettingsAsync();
    } catch {
      return false;
    }
  }, [nativeSafari]);

  const openDnsSettings = useCallback(async (): Promise<boolean> => {
    if (!nativeDns) return false;
    try {
      return await nativeDns.openDnsSettingsAsync();
    } catch {
      return false;
    }
  }, [nativeDns]);

  const clearRecords = useCallback(() => setState((current) => ({ ...current, records: [] })), []);

  const value = useMemo(() => ({
    ...state,
    hydrated,
    vpnStatus,
    adAssistStatus,
    safariAvailable,
    safariRuleCount,
    safariExtensionState,
    dnsAvailable,
    dnsUnavailableReason,
    dnsState,
    blockedDomainCount: collectEnabledNetworkDomains(
      state.settings,
      state.ruleTier,
      [...new Set([...collectProtectedDomains(), ...state.whitelist])],
    ).length,
    paused: isPaused(state.safetyState, now),
    circuitBreakerTripped: isCircuitBreakerTripped(state.safetyState),
    setProtectionEnabled,
    setRuleEnabled,
    setRuleTier,
    setDnsEnabled,
    setDnsPreset,
    setDnsScopeToAdDomains,
    pauseProtection,
    resumeProtection,
    setAutoStart,
    setNotifications,
    setAppTrafficProtection,
    setShakeRiskAlerts,
    openAdAssistSettings,
    requestVpnPermission,
    startVpn,
    stopVpn,
    addWhitelistDomain,
    removeWhitelistDomain,
    syncSafariRules,
    openSafariExtensionSettings,
    openDnsSettings,
    clearRecords,
  }), [state, hydrated, vpnStatus, adAssistStatus, safariAvailable, safariRuleCount, safariExtensionState, dnsAvailable, dnsUnavailableReason, dnsState, now, setProtectionEnabled, setRuleEnabled, setRuleTier, setDnsEnabled, setDnsPreset, setDnsScopeToAdDomains, pauseProtection, resumeProtection, setAutoStart, setNotifications, setAppTrafficProtection, setShakeRiskAlerts, openAdAssistSettings, requestVpnPermission, startVpn, stopVpn, addWhitelistDomain, removeWhitelistDomain, syncSafariRules, openSafariExtensionSettings, openDnsSettings, clearRecords]);
  return <AdShieldContext.Provider value={value}>{children}</AdShieldContext.Provider>;
}

export function useAdShield() { const context = useContext(AdShieldContext); if (!context) throw new Error("useAdShield must be used inside AdShieldProvider"); return context; }
