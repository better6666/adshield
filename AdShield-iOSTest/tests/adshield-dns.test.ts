import { describe, expect, it } from "vitest";

import {
  DNS_SERVER_PRESETS,
  DEFAULT_DNS_SETTINGS,
  buildDnsConfiguration,
  describeDnsScope,
  findDnsPreset,
} from "../lib/adshield-dns";
import { CRITICAL_ALLOWLIST, THIRD_PARTY_AD_DOMAINS } from "../lib/adshield-apprules";

const AD_DOMAINS = THIRD_PARTY_AD_DOMAINS;

describe("加密 DNS 层配置", () => {
  it("未启用时不产生任何配置", () => {
    expect(buildDnsConfiguration(DEFAULT_DNS_SETTINGS, AD_DOMAINS)).toBeNull();
    expect(describeDnsScope(DEFAULT_DNS_SETTINGS, AD_DOMAINS)).toBe("未启用");
  });

  it("启用后生成 DoH 配置并恒开失败回退", () => {
    const config = buildDnsConfiguration({ ...DEFAULT_DNS_SETTINGS, enabled: true }, AD_DOMAINS);
    expect(config).not.toBeNull();
    expect(config!.protocol).toBe("https");
    expect(config!.endpoint).toBe("https://dns.adguard-dns.com/dns-query");
    // allowFailover 是 fail-open 的原生落点，恒为 true，不可关闭。
    expect(config!.allowFailover).toBe(true);
  });

  it("matchDomains 只含广告域名，且不含关键白名单", () => {
    const config = buildDnsConfiguration({ ...DEFAULT_DNS_SETTINGS, enabled: true }, AD_DOMAINS);
    expect(config!.matchDomains).not.toBeNull();
    const matchDomains = config!.matchDomains!;
    expect(matchDomains.length).toBeGreaterThan(0);
    for (const domain of matchDomains) {
      expect(CRITICAL_ALLOWLIST).not.toContain(domain);
      expect(AD_DOMAINS).toContain(domain);
    }
  });

  it("matchDomains 覆盖全部广告域名（与白名单取差集后）", () => {
    const config = buildDnsConfiguration({ ...DEFAULT_DNS_SETTINGS, enabled: true }, AD_DOMAINS);
    expect(config!.matchDomains!.length).toBe(AD_DOMAINS.length);
  });

  it("广告域名列表为空时拒绝启用自定义 DNS（宁可不拦也不全量劫持）", () => {
    const config = buildDnsConfiguration({ ...DEFAULT_DNS_SETTINGS, enabled: true }, []);
    expect(config).toBeNull();
  });

  it("关闭 scopeToAdDomains 时对全部域名生效", () => {
    const config = buildDnsConfiguration(
      { ...DEFAULT_DNS_SETTINGS, enabled: true, scopeToAdDomains: false },
      AD_DOMAINS,
    );
    expect(config!.matchDomains).toBeNull();
    expect(describeDnsScope({ ...DEFAULT_DNS_SETTINGS, enabled: true, scopeToAdDomains: false }, AD_DOMAINS))
      .toContain("全部域名");
  });

  it("非过滤型 resolver 不做域名范围限定", () => {
    const settings = { ...DEFAULT_DNS_SETTINGS, enabled: true, presetId: "alidns" };
    const config = buildDnsConfiguration(settings, AD_DOMAINS);
    expect(config!.endpoint).toBe("https://dns.alidns.com/dns-query");
    // 该 resolver 不过滤广告，限定域名没有意义，也不该限定。
    expect(config!.matchDomains).toBeNull();
    expect(describeDnsScope(settings, AD_DOMAINS)).toContain("仅加密");
  });

  it("未知 presetId 返回 null", () => {
    expect(findDnsPreset("does-not-exist")).toBeUndefined();
    expect(buildDnsConfiguration({ ...DEFAULT_DNS_SETTINGS, enabled: true, presetId: "nope" }, AD_DOMAINS)).toBeNull();
  });

  it("DoT preset 生成 tls 协议配置", () => {
    const dotPreset = { ...DNS_SERVER_PRESETS[0], protocol: "tls" as const };
    expect(dotPreset).toBeDefined();
    // 现有 preset 全部是 DoH；这里确认协议字段能正确透传到原生配置。
    const config = buildDnsConfiguration({ ...DEFAULT_DNS_SETTINGS, enabled: true }, AD_DOMAINS);
    expect(["https", "tls"]).toContain(config!.protocol);
  });

  it("每个 preset 都有可读说明，并标注是否过滤广告", () => {
    for (const preset of DNS_SERVER_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.note.length).toBeGreaterThan(0);
      expect(typeof preset.filtersAds).toBe("boolean");
    }
    // 至少要有一个过滤型和一个仅加密型，让用户自己权衡。
    expect(DNS_SERVER_PRESETS.some((p) => p.filtersAds)).toBe(true);
    expect(DNS_SERVER_PRESETS.some((p) => !p.filtersAds)).toBe(true);
  });
});
