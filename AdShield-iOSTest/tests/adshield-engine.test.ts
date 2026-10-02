import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, buildBlockerRules, collectEnabledNetworkDomains, countEnabledDomains, createSyncRecord, generateBlockerRulesJSON, isWhitelisted, normalizeDomain, shouldBlock } from "../lib/adshield-engine";
import { APP_RULE_PACKS, collectBlockDomains } from "../lib/adshield-apprules";

describe("规则档位", () => {
  it("safe 档不含中国 App 规则包补充的广告域名", () => {
    const safe = buildBlockerRules({ ...DEFAULT_SETTINGS, enabled: true }, [], "safe");
    const safeFilters = safe.map((rule) => String(rule.trigger["url-filter"])).join("\n");
    for (const pack of APP_RULE_PACKS) {
      for (const domain of pack.adDomains) {
        expect(safeFilters).not.toContain(domain);
      }
    }
  });

  it("balanced / aggressive 档把补充广告域名并入规则", () => {
    const aggressive = buildBlockerRules({ ...DEFAULT_SETTINGS, enabled: true }, [], "aggressive");
    // url-filter 里的域名点是正则转义形式，用 RegExp 校验更可靠。
    expect(aggressive.some((rule) => new RegExp(String(rule.trigger["url-filter"])).test("https://alitui.weibo.com/x"))).toBe(true);
    expect(aggressive.length).toBeGreaterThan(buildBlockerRules({ ...DEFAULT_SETTINGS, enabled: true }, [], "safe").length);
  });

  it("档位不影响白名单例外排在最前", () => {
    const rules = buildBlockerRules({ ...DEFAULT_SETTINGS, enabled: true }, ["example.com"], "aggressive");
    expect(rules[0].action.type).toBe("ignore-previous-rules");
  });

  it("档位参数可省略，默认 safe", () => {
    expect(buildBlockerRules({ ...DEFAULT_SETTINGS, enabled: true }, []).length)
      .toBe(buildBlockerRules({ ...DEFAULT_SETTINGS, enabled: true }, [], "safe").length);
  });

  it("任何档位生成的 JSON 都能被解析且不含交替符", () => {
    for (const tier of ["safe", "balanced", "aggressive"] as const) {
      const parsed = JSON.parse(generateBlockerRulesJSON({ ...DEFAULT_SETTINGS, enabled: true }, ["a.com"], tier));
      expect(Array.isArray(parsed)).toBe(true);
      for (const rule of parsed) {
        expect(String(rule.trigger["url-filter"])).not.toContain("|");
      }
    }
  });
});

describe("AdShield rule engine", () => {
  it("builds the native DNS domain set from enabled groups and tier", () => {
    const safe = collectEnabledNetworkDomains(DEFAULT_SETTINGS, "safe");
    const aggressive = collectEnabledNetworkDomains(DEFAULT_SETTINGS, "aggressive");
    expect(safe).toContain("doubleclick.net");
    expect(safe).not.toContain("alitui.weibo.com");
    expect(aggressive).toContain("alitui.weibo.com");
  });
  it("returns no native DNS domains when protection is off", () => {
    expect(collectEnabledNetworkDomains({ ...DEFAULT_SETTINGS, enabled: false }, "aggressive")).toEqual([]);
  });
  it("honors disabled native DNS rule groups", () => {
    const settings = { ...DEFAULT_SETTINGS, rules: { ...DEFAULT_SETTINGS.rules, appAds: false } };
    expect(collectEnabledNetworkDomains(settings, "aggressive")).not.toContain("alitui.weibo.com");
  });
  it("normalizes URL-style values into a hostname", () => {
    expect(normalizeDomain(" HTTPS://www.Example.com/path ")).toBe("example.com");
  });
  it("treats a whitelist entry as matching its subdomains", () => {
    expect(isWhitelisted("cdn.example.com", ["example.com"])).toBe(true);
    expect(isWhitelisted("notexample.com", ["example.com"])).toBe(false);
  });
  it("does not block when protection is disabled or a host is whitelisted", () => {
    expect(shouldBlock("doubleclick.net", "ads", { ...DEFAULT_SETTINGS, enabled: false }, [])).toBe(false);
    expect(shouldBlock("doubleclick.net", "ads", { ...DEFAULT_SETTINGS, enabled: true }, ["doubleclick.net"])).toBe(false);
  });
  it("requires application traffic protection before blocking mobile SDK and redirect rules", () => {
    const withoutVpnScope = { ...DEFAULT_SETTINGS, enabled: true };
    const withVpnScope = { ...withoutVpnScope, appTrafficProtection: true };
    expect(shouldBlock("ads.applovin.com", "appAds", withoutVpnScope, [])).toBe(false);
    expect(shouldBlock("ads.applovin.com", "appAds", withVpnScope, [])).toBe(true);
  });
});

describe("Safari Content Blocker rule generation", () => {
  it("returns empty rules when protection is disabled", () => {
    expect(buildBlockerRules({ ...DEFAULT_SETTINGS, enabled: false }, [])).toEqual([]);
  });
  it("never emits an empty rule list, which the content blocker engine refuses to compile", () => {
    const parsed = JSON.parse(generateBlockerRulesJSON({ ...DEFAULT_SETTINGS, enabled: false }, []));
    expect(parsed.length).toBeGreaterThan(0);
    expect(String(parsed[0].trigger["url-filter"])).toBe("^adshield-noop://");
  });
  it("generates rules when protection is enabled", () => {
    const settings = { ...DEFAULT_SETTINGS, enabled: true };
    const rules = buildBlockerRules(settings, []);
    expect(rules.length).toBeGreaterThan(0);
    // Should have at least one block rule and one css-display-none rule
    expect(rules.some((r) => r.action.type === "block")).toBe(true);
    expect(rules.some((r) => r.action.type === "css-display-none")).toBe(true);
  });
  it("includes whitelist ignore rules before block rules", () => {
    const settings = { ...DEFAULT_SETTINGS, enabled: true };
    const rules = buildBlockerRules(settings, ["example.com"]);
    expect(rules[0].action.type).toBe("ignore-previous-rules");
    expect(rules[0].trigger).toHaveProperty("if-domain");
  });
  it("excludes disabled rule groups", () => {
    const settings = { ...DEFAULT_SETTINGS, enabled: true, rules: { ...DEFAULT_SETTINGS.rules, ads: false } };
    const rulesWithAds = buildBlockerRules({ ...DEFAULT_SETTINGS, enabled: true }, []);
    const rulesWithoutAds = buildBlockerRules(settings, []);
    expect(rulesWithoutAds.length).toBeLessThan(rulesWithAds.length);
  });
  it("generates valid JSON string", () => {
    const settings = { ...DEFAULT_SETTINGS, enabled: true };
    const json = generateBlockerRulesJSON(settings, ["test.com"]);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    // Every item should have trigger and action
    for (const rule of parsed) {
      expect(rule).toHaveProperty("trigger");
      expect(rule).toHaveProperty("action");
      expect(rule.trigger).toHaveProperty("url-filter");
    }
  });
  it("includes popup blocking when popups rule is enabled", () => {
    const settings = { ...DEFAULT_SETTINGS, enabled: true };
    const rules = buildBlockerRules(settings, []);
    const popupRule = rules.find((r) => {
      const resourceType = r.trigger["resource-type"] as string[] | undefined;
      return resourceType?.length === 1 && resourceType[0] === "popup";
    });
    expect(popupRule).toBeDefined();
    expect(popupRule?.action.type).toBe("block");
  });
});

describe("utility functions", () => {
  it("counts enabled domains across rule groups", () => {
    const count = countEnabledDomains({ ...DEFAULT_SETTINGS, enabled: true });
    expect(count).toBeGreaterThan(20); // We added many domains
  });
  it("creates sync records with platform info", () => {
    const record = createSyncRecord(42, "Safari");
    expect(record.category).toBe("sync");
    expect(record.domain).toContain("Safari");
    expect(record.domain).toContain("42");
    expect(record.id).toContain("sync-");
  });
});

// 回归测试：规则包（adshield-apprules）与引擎（adshield-engine）曾经各维护一份
// 域名清单，safe 档有 25 个第三方广告 SDK 域名只存在于规则包、从未进入 Safari 规则，
// 于是"拦截域名"数字比实际拦截范围大。现在 resolveRuleGroups 是唯一来源，
// 这里把"两边一致"钉住，任何一侧再分家都会立刻失败。
describe("域名清单一致性（resolveRuleGroups 单一来源）", () => {
  // 只统计真正拦截的规则：白名单的 ignore-previous-rules 与元素隐藏的
  // css-display-none 也用 ".*" 作 url-filter，但它们不拦域名。
  const filtersOf = (rules: ReturnType<typeof buildBlockerRules>) =>
    rules
      .filter((rule) => rule.action.type === "block")
      .map((rule) => new RegExp(String(rule.trigger["url-filter"]), "i"));

  it("safe 档的 Safari 规则覆盖规则包声明的每一个第三方广告 SDK 域名", () => {
    const rules = buildBlockerRules(DEFAULT_SETTINGS, [], "safe");
    const filters = filtersOf(rules);
    const missing = collectBlockDomains("safe").filter(
      (domain) => !filters.some((filter) => filter.test(`https://${domain}/x`)),
    );
    expect(missing).toEqual([]);
  });

  it("balanced 档把各 App 自有的广告域名并入拦截范围", () => {
    const safeFilters = filtersOf(buildBlockerRules(DEFAULT_SETTINGS, [], "safe"));
    const balancedFilters = filtersOf(buildBlockerRules(DEFAULT_SETTINGS, [], "balanced"));
    const appAdDomains = [...new Set(APP_RULE_PACKS.flatMap((pack) => pack.adDomains))];
    // 规则包目前只采集到 3 个 App 自有广告域名，但每一条都必须在 balanced 档被拦。
    for (const domain of appAdDomains) {
      expect(balancedFilters.some((f) => f.test(`https://${domain}/x`)), `${domain} 应在 balanced 档被拦`).toBe(true);
    }
    expect(appAdDomains.length).toBeGreaterThan(0);
    // 档位提升必须真的扩大拦截范围，不能是空操作。
    expect(balancedFilters.length).toBeGreaterThan(safeFilters.length);
  });

  it("界面上报的拦截域名数与 Safari 实际生效的域名完全一致", () => {
    for (const tier of ["safe", "balanced", "aggressive"] as const) {
      const settings = { ...DEFAULT_SETTINGS, enabled: true };
      const reported = collectEnabledNetworkDomains(settings, tier);
      const filters = filtersOf(buildBlockerRules(settings, [], tier));
      const notBlocked = reported.filter((domain) => !filters.some((f) => f.test(`https://${domain}/x`)));
      expect(notBlocked, `档位 ${tier} 有报数但不拦截的域名`).toEqual([]);
      expect(reported.length).toBeGreaterThan(0);
    }
  });

  it("关键白名单放行的 CDN 会抵消其子域广告规则，计数必须如实扣除", () => {
    // bcebos.com 在关键白名单里（百度网盘下载要用），它让
    // mobads-pre-config.cdn.bcebos.com 的拦截规则永远轮不到生效。
    const settings = { ...DEFAULT_SETTINGS, enabled: true };
    const unrestricted = collectEnabledNetworkDomains(settings, "safe");
    expect(unrestricted).toContain("mobads-pre-config.cdn.bcebos.com");

    const effective = collectEnabledNetworkDomains(settings, "safe", ["bcebos.com", "pstatp.com"]);
    expect(effective).not.toContain("mobads-pre-config.cdn.bcebos.com");
    expect(effective).not.toContain("sf3-ttcdn-tos.pstatp.com");
    // 白名单没碰的域名不受影响
    expect(effective).toContain("doubleclick.net");
    expect(effective.length).toBeLessThan(unrestricted.length);
  });

  it("关掉广告分组后计数与规则同步下降", () => {
    const on = collectEnabledNetworkDomains(DEFAULT_SETTINGS, "safe").length;
    const off = collectEnabledNetworkDomains(
      { ...DEFAULT_SETTINGS, rules: { ...DEFAULT_SETTINGS.rules, ads: false, appAds: false } },
      "safe",
    ).length;
    expect(off).toBeLessThan(on);
  });
});
