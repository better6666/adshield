export type RuleKey = "ads" | "trackers" | "popups" | "cosmetic" | "appAds" | "redirects";

export type ProtectionSettings = {
  enabled: boolean;
  autoStart: boolean;
  notifications: boolean;
  appTrafficProtection: boolean;
  shakeRiskAlerts: boolean;
  rules: Record<RuleKey, boolean>;
};

export type BlockRecord = {
  id: string;
  domain: string;
  category: RuleKey | "sync";
  createdAt: string;
};

export type RuleGroup = {
  key: RuleKey;
  title: string;
  description: string;
  domains: string[];
};

export const RULE_GROUPS: RuleGroup[] = [
  {
    key: "ads",
    title: "广告请求",
    description: "拦截常见广告网络、横幅与插页请求。",
    domains: [
      "doubleclick.net",
      "googlesyndication.com",
      "googleadservices.com",
      "adservice.google.com",
      "adsrvr.org",
      "pagead2.googlesyndication.com",
      "adclick.g.doubleclick.net",
      "ad.doubleclick.net",
      "cpro.baidu.com",
      "pos.baidu.com",
      "eclick.baidu.com",
      "hmma.baidu.com",
      "cbjs.baidu.com",
      "cpro2.baidustatic.com",
      "mobads.baidu.com",
      "mobads-pre-config.cdn.bcebos.com",
      "union.bytedance.com",
      "ad.oceanengine.com",
      "sf3-ttcdn-tos.pstatp.com",
      "pangolin-sdk-toutiao.com",
      "pglstatp-toutiao.com",
      "ads.stickyadstv.com",
      "adx.ads-pixiv.net",
      "adtago.s3.amazonaws.com",
      "tanx.com",
      "alimama.com",
      "adashx.m.taobao.com",
    ],
  },
  {
    key: "trackers",
    title: "跟踪器",
    description: "阻止跨站统计、重定向像素与用户画像脚本。",
    domains: [
      "google-analytics.com",
      "segment.io",
      "mixpanel.com",
      "hotjar.com",
      "clarity.ms",
      "hm.baidu.com",
      "tongji.baidu.com",
      "cnzz.com",
      "umeng.com",
      "growingio.com",
      "sensors.data",
      "analytics.tiktok.com",
      "log.bytedance.com",
      "sentry.io",
      "bugsnag.com",
      "app-measurement.com",
    ],
  },
  {
    key: "popups",
    title: "弹窗与重定向",
    description: "拦截推广弹窗、可疑新窗口与跳转域名。",
    domains: [
      "popads.net",
      "popcash.net",
      "push-notifications.net",
      "onclickads.net",
      "propellerads.com",
      "exoclick.com",
      "juicyads.com",
      "adcash.com",
      "trafficjunky.net",
      "clickadu.com",
    ],
  },
  {
    key: "cosmetic",
    title: "页面净化",
    description: "隐藏网页中可识别的广告容器和促销浮层。",
    domains: [],
  },
  {
    key: "appAds",
    title: "应用内广告与推广 SDK",
    description: "匹配常见移动广告、归因和推广 SDK 的网络请求。",
    domains: [
      "admob.com",
      "unityads.unity3d.com",
      "applovin.com",
      "pangle.io",
      "e.qq.com",
      "gdt.qq.com",
      "mi.gdt.qq.com",
      "sdk.e.qq.com",
      "adsmind.gdtimg.com",
      "qzs.gdtimg.com",
      "is.snssdk.com",
      "pangolin.snssdk.com",
      "open.e.kuaishou.com",
      "adx.kuaishou.com",
      "api-access.pangolin-sdk-toutiao.com",
      "toblog.ctobsnssdk.com",
      "ad.partner.gifshow.com",
      "ads-api.twitter.com",
    ],
  },
  {
    key: "redirects",
    title: "诱导跳转与落地页",
    description: "阻断已知推广短链、强制下载与可疑跳转域名。",
    domains: [
      "click.linksynergy.com",
      "go2cloud.org",
      "track.adform.net",
    ],
  },
];

export const DEFAULT_SETTINGS: ProtectionSettings = {
  enabled: true,
  autoStart: true,
  notifications: true,
  appTrafficProtection: false,
  shakeRiskAlerts: true,
  rules: { ads: true, trackers: true, popups: true, cosmetic: true, appAds: true, redirects: true },
};

export function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/\s/g, "");
}

export function isWhitelisted(host: string, whitelist: string[]): boolean {
  const normalizedHost = normalizeDomain(host);
  return whitelist.some((domain) => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`));
}

export function shouldBlock(host: string, category: RuleKey, settings: ProtectionSettings, whitelist: string[]): boolean {
  const needsAppTrafficProtection = category === "appAds" || category === "redirects";
  return settings.enabled && settings.rules[category] && (!needsAppTrafficProtection || settings.appTrafficProtection) && !isWhitelisted(host, whitelist);
}

/**
 * Create a record entry for a rule sync event (not a fake blocking record).
 */
export function createSyncRecord(ruleCount: number, platform: string): BlockRecord {
  const now = new Date();
  return {
    id: `sync-${now.getTime()}-${platform}`,
    domain: `${platform}: ${ruleCount} 条规则已同步`,
    category: "sync",
    createdAt: now.toISOString(),
  };
}

export function countEnabledRules(settings: ProtectionSettings): number {
  return RULE_GROUPS.filter((group) => settings.rules[group.key]).length;
}

/**
 * Count total individual domain rules across all enabled groups.
 */
export function countEnabledDomains(settings: ProtectionSettings): number {
  return RULE_GROUPS.filter((group) => settings.rules[group.key]).reduce((sum, group) => sum + group.domains.length, 0);
}

export function formatRecordTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(isoTimestamp));
}

// ── Safari Content Blocker rule generation ──────────────────────────

import type { RuleTier } from "./adshield-apprules";
import { APP_RULE_PACKS, THIRD_PARTY_AD_DOMAINS } from "./adshield-apprules";

export type SafariBlockerAction = { type: "block" } | { type: "ignore-previous-rules" } | { type: "css-display-none"; selector: string };

export type SafariBlockerRule = {
  trigger: Record<string, unknown>;
  action: SafariBlockerAction;
};

/**
 * 页面净化选择器。关键约束：这条规则对 Safari 里每一个文档生效，选择器宁可漏
 * 也不能误伤——`[class*='ad-']` 这类裸子串匹配会把 load-bar、read-more、head-nav、
 * thread-head 这类无辜类名一起藏掉。因此 ad- 前缀类一律用"词边界"写法：
 * ^='ad-' 抓开头、*=' ad-' 抓空格后的整词，两者合起来等价于整词匹配，
 * 且永远不会命中 a-d 出现在词中间的情况。
 */
const COSMETIC_SELECTOR = [
  ".ad", ".ads", ".advert", ".advertisement", ".sponsor",
  "[id^='ad-']", "[id*=' ad-']",
  "[class^='ad-']", "[class*=' ad-']",
  "[class*='advert']", "[class*='sponsor']", "[id*='sponsor']",
  ".ad-banner", ".ad-wrapper", ".ad-container",
  "[data-ad]", "[data-ad-slot]", "[data-google-query-id]",
  ".adsbygoogle", "ins.adsbygoogle",
  ".ad-placeholder", ".ad-slot",
].join(", ");

const DOMAIN_BLOCK_RESOURCE_TYPES = ["script", "image", "raw", "fetch", "ping", "other"];

function escapeRegex(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function domainFilters(domain: string): string[] {
  // Safari applies url-filter to the complete URL, not only to its hostname.
  // Anchor the expression at the URL scheme so a domain cannot match inside a
  // path or query string (for example example.com/?next=doubleclick.net), and
  // require a separator after the host so lookalikes like
  // doubleclick.network are not blocked.
  // The content-extension regex engine does not support alternation, so each
  // domain gets its own rules instead of one combined pattern.
  const prefix = `^https?://([^/]+\\.)?${escapeRegex(domain)}`;
  return [`${prefix}[/:?#]`, `${prefix}$`];
}

/**
 * 按规则档位解析出实际生效的规则组。
 *
 * 这是全 App 唯一的域名来源：Safari 规则、拦截计数、DNS 的 matchDomains
 * 全部由它派生，避免出现"清单 A 和清单 B 部分重叠"导致某一边漏拦。
 *
 * 第三方广告 SDK 域名（THIRD_PARTY_AD_DOMAINS）与 App 自有接口无关，
 * 任何档位都并入"广告"组；balanced / aggressive 才额外把中国 App 规则包里
 * 各 App 补充的自有广告域名并入"应用内广告"组——那些域名由 App 自己运营，
 * 误杀风险随档位升高。
 */
export function resolveRuleGroups(tier: RuleTier = "safe"): RuleGroup[] {
  const thirdParty = THIRD_PARTY_AD_DOMAINS;
  if (tier === "safe") {
    return RULE_GROUPS.map((group) =>
      group.key === "ads" ? { ...group, domains: [...new Set([...group.domains, ...thirdParty])] } : group,
    );
  }
  const appAdDomains = [...new Set(APP_RULE_PACKS.flatMap((pack) => pack.adDomains))];
  if (appAdDomains.length === 0) {
    return RULE_GROUPS.map((group) =>
      group.key === "ads" ? { ...group, domains: [...new Set([...group.domains, ...thirdParty])] } : group,
    );
  }
  return RULE_GROUPS.map((group) => {
    if (group.key === "appAds") {
      return { ...group, domains: [...new Set([...group.domains, ...appAdDomains])] };
    }
    if (group.key === "ads") {
      return { ...group, domains: [...new Set([...group.domains, ...thirdParty])] };
    }
    return group;
  });
}

/**
 * Resolve the exact domain set used by Android's DNS filter. Unlike the
 * 当前档位下真实会被拦截的域名集合。
 *
 * 这是界面上唯一允许展示的"拦截域名数"：它与 buildBlockerRules 用的是同一个
 * resolveRuleGroups，所以显示多少就真的拦多少。cosmetic 与 popups 组靠选择器
 * 和全局弹窗规则生效，本身没有域名，天然不出现在这里。Android 的 DNS 过滤器
 * 和 iOS 的 DNS matchDomains 也用这一份。
 *
 * allowlist 用来做诚实化扣除：Safari 的白名单规则（ignore-previous-rules）和
 * 关键白名单都排在拦截规则前面，后缀命中白名单条目的域名实际拦不住——比如
 * 白名单放行 bcebos.com 后，mobads-pre-config.cdn.bcebos.com 就拦不住了。
 * 传入 allowlist 把这些域名从集合里剔除，显示才与实际一致；DNS 侧剔除则让
 * 被放行的域名继续走系统解析器，不被过滤 resolver 误伤。
 */
export function collectEnabledNetworkDomains(
  settings: ProtectionSettings,
  tier: RuleTier = "safe",
  allowlist: string[] = [],
): string[] {
  if (!settings.enabled) return [];
  const domains = [
    ...new Set(
      resolveRuleGroups(tier)
        .filter((group) => settings.rules[group.key] && group.key !== "cosmetic")
        .flatMap((group) => group.domains)
        .map(normalizeDomain)
        .filter(Boolean),
    ),
  ];
  return allowlist.length === 0 ? domains.sort() : domains.filter((domain) => !isWhitelisted(domain, allowlist)).sort();
}

/**
 * 根据防护开关与白名单生成 Safari 内容拦截规则。
 * 白名单 ignore 规则必须排在最前：内容拦截器按顺序取第一个命中的规则。
 * tier 默认 safe，保持既有行为不变。
 */
export function buildBlockerRules(settings: ProtectionSettings, whitelist: string[], tier: RuleTier = "safe"): SafariBlockerRule[] {
  if (!settings.enabled) return [];
  const rules: SafariBlockerRule[] = [];

  if (whitelist.length > 0) {
    // ignore-previous-rules 是合法 action；"ignore" 会让整份规则编译失败。
    const domains = whitelist.flatMap((domain) => [normalizeDomain(domain), `*.${normalizeDomain(domain)}`]);
    rules.push({
      trigger: { "url-filter": ".*", "url-filter-is-case-sensitive": false, "if-domain": [...new Set(domains.filter(Boolean))] },
      action: { type: "ignore-previous-rules" },
    });
  }

  for (const group of resolveRuleGroups(tier)) {
    if (!settings.rules[group.key]) continue;
    if (group.key === "cosmetic") {
      rules.push({
        trigger: { "url-filter": ".*", "url-filter-is-case-sensitive": false, "resource-type": ["document"] },
        action: { type: "css-display-none", selector: COSMETIC_SELECTOR },
      });
      continue;
    }
    if (group.domains.length === 0) continue;
    for (const domain of group.domains) {
      for (const urlFilter of domainFilters(domain)) {
        rules.push({
          trigger: {
            "url-filter": urlFilter,
            "url-filter-is-case-sensitive": false,
            "load-type": ["third-party"],
            "resource-type": DOMAIN_BLOCK_RESOURCE_TYPES,
          },
          action: { type: "block" },
        });
      }
    }
  }

  if (settings.rules.popups) {
    rules.push({
      trigger: { "url-filter": ".*", "url-filter-is-case-sensitive": false, "resource-type": ["popup"] },
      action: { type: "block" },
    });
  }

  return rules;
}

/**
 * 内容拦截器拒绝空规则列表：编译 `[]` 会以 WKErrorDomain error 6 失败，
 * 关闭防护时 reloadContentBlocker 就会报错。改用一条永远匹配不到任何 URL 的
 * 占位规则，"不拦截"的语义不变，且列表始终可以编译。
 */
const DISABLED_PLACEHOLDER_RULE: SafariBlockerRule = {
  trigger: { "url-filter": "^adshield-noop://" },
  action: { type: "block" },
};

/**
 * 将 buildBlockerRules 结果序列化为符合 Safari Content Blocker 格式的 JSON 字符串。
 * 可直接写入 App Group 共享容器或作为 BlockerList.json 内容。
 */
export function generateBlockerRulesJSON(settings: ProtectionSettings, whitelist: string[], tier: RuleTier = "safe"): string {
  const rules = buildBlockerRules(settings, whitelist, tier);
  return JSON.stringify(rules.length > 0 ? rules : [DISABLED_PLACEHOLDER_RULE], null, 2);
}
