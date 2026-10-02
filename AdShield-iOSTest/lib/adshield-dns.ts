/**
 * 系统级加密 DNS 层（iOS 26.5 实测可用）。
 *
 * API 依据（本地 SDK /Applications/Xcode.app/.../iPhoneOS26.5.sdk）：
 *   NEDNSSettingsManager.h —— "used to directly configure DNS settings on the system"，
 *     iOS 14.0+，saveToPreferences 后"DNS settings must be enabled by the user in Settings"。
 *   NEDNSSettings.h —— NEDNSOverHTTPSSettings.serverURL / NEDNSOverTLSSettings.serverName，
 *     iOS 14.0+；`allowFailover` iOS 26.0+（解析失败时回退系统解析器）。
 *   NEDNSSettings.matchDomains —— "If this property is non-nil, the DNS settings will
 *     only be used to resolve host names within the specified domains."
 *
 * 这个 matchDomains 语义是本层安全性的关键：我们把过滤型 DoH 的 matchDomains 设成
 * 规则包里的广告域名集合，于是只有广告域名走过滤 resolver，App 自有的登录、支付、
 * 地图、下载接口仍然走系统解析器。过滤 resolver 挂掉或返回错误结果时，最坏情况只是
 * 少拦几条广告，不可能让任何 App 不可用。
 */

import { CRITICAL_ALLOWLIST } from "./adshield-apprules";

export type DnsProtocol = "https" | "tls";

export type DnsServerPreset = {
  id: string;
  label: string;
  protocol: DnsProtocol;
  /** DoH 填 serverURL，DoT 填 serverName（用于证书校验）。 */
  endpoint: string;
  /** 该 resolver 是否过滤广告域名。false 表示只做加密，不过滤。 */
  filtersAds: boolean;
  note: string;
};

export const DNS_SERVER_PRESETS: DnsServerPreset[] = [
  {
    id: "adguard-default",
    label: "AdGuard DNS（默认过滤）",
    protocol: "https",
    endpoint: "https://dns.adguard-dns.com/dns-query",
    filtersAds: true,
    note: "过滤广告与跟踪域名。中国大陆网络可能不稳定，已开启失败回退。",
  },
  {
    id: "adguard-unfiltered",
    label: "AdGuard DNS（仅加密）",
    protocol: "https",
    endpoint: "https://unfiltered.adguard-dns.com/dns-query",
    filtersAds: false,
    note: "只加密不外泄 DNS，不过滤任何域名。最稳。",
  },
  {
    id: "alidns",
    label: "阿里公共 DNS（仅加密）",
    protocol: "https",
    endpoint: "https://dns.alidns.com/dns-query",
    filtersAds: false,
    note: "中国大陆访问最快，只加密不过滤。",
  },
  {
    id: "dnspod-doh",
    label: "DNSPod DoH（仅加密）",
    protocol: "https",
    endpoint: "https://doh.pub/dns-query",
    filtersAds: false,
    note: "腾讯 DNSPod，中国大陆访问快。",
  },
  {
    id: "quad9-doh",
    label: "Quad9 DoH（恶意域名过滤）",
    protocol: "https",
    endpoint: "https://dns.quad9.net/dns-query",
    filtersAds: false,
    note: "过滤恶意与钓鱼域名，不过滤广告。",
  },
  {
    id: "cloudflare-doh",
    label: "Cloudflare DoH（仅加密）",
    protocol: "https",
    endpoint: "https://cloudflare-dns.com/dns-query",
    filtersAds: false,
    note: "中国大陆访问不稳定。",
  },
];

export type DnsSettings = {
  enabled: boolean;
  presetId: string;
  /** 只把过滤 resolver 用于广告域名；关闭则对全部域名生效（不推荐）。 */
  scopeToAdDomains: boolean;
  /** 解析失败时回退系统解析器。恒为 true， Safety Engine 的 fail-open 要求。 */
  allowFailover: boolean;
};

export const DEFAULT_DNS_SETTINGS: DnsSettings = {
  enabled: false,
  presetId: "adguard-default",
  scopeToAdDomains: true,
  allowFailover: true,
};

export function findDnsPreset(id: string): DnsServerPreset | undefined {
  return DNS_SERVER_PRESETS.find((preset) => preset.id === id);
}

/** 待同步到 NEDNSSettingsManager 的原生配置，由原生模块消费。 */
export type DnsConfiguration = {
  protocol: DnsProtocol;
  endpoint: string;
  /** 传 null 表示对全部域名生效。 */
  matchDomains: string[] | null;
  allowFailover: boolean;
};

/**
 * 组装原生 DNS 配置。
 * adDomains 来自规则包（safe 档），并且与关键白名单取差集——白名单里的域名
 * 永远不会被送进过滤 resolver。
 */
export function buildDnsConfiguration(settings: DnsSettings, adDomains: string[]): DnsConfiguration | null {
  if (!settings.enabled) return null;
  const preset = findDnsPreset(settings.presetId);
  if (!preset) return null;

  let matchDomains: string[] | null = null;
  if (settings.scopeToAdDomains && preset.filtersAds) {
    matchDomains = [...new Set(adDomains)].filter((domain) => !CRITICAL_ALLOWLIST.includes(domain));
    // matchDomains 为空等于"对全部域名生效"，这与 scopeToAdDomains 的意图相反，
    // 所以这种情况下宁可不启用自定义 DNS。
    if (matchDomains.length === 0) return null;
  }

  return {
    protocol: preset.protocol,
    endpoint: preset.endpoint,
    matchDomains,
    allowFailover: settings.allowFailover,
  };
}

/** 界面用的一句话说明当前 DNS 配置会覆盖哪些域名。 */
export function describeDnsScope(settings: DnsSettings, adDomains: string[]): string {
  const preset = findDnsPreset(settings.presetId);
  if (!settings.enabled || !preset) return "未启用";
  if (!preset.filtersAds) return `仅加密 DNS，不过滤任何域名（${preset.endpoint}）`;
  if (!settings.scopeToAdDomains) return `全部域名都走 ${preset.endpoint}，解析失败会影响所有 App`;
  const scoped = [...new Set(adDomains)].filter((domain) => !CRITICAL_ALLOWLIST.includes(domain));
  return `仅 ${scoped.length} 个广告域名走过滤解析，其余域名仍用系统 DNS`;
}
