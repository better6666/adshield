import { describe, expect, it } from "vitest";

import {
  CRITICAL_ALLOWLIST,
  APP_RULE_PACKS,
  THIRD_PARTY_AD_DOMAINS,
  collectBlockDomains,
  collectProtectedDomains,
  findAppRulePack,
  TIER_LABELS,
} from "../lib/adshield-apprules";
import { matchesAllowlist } from "../lib/adshield-safety";

describe("中国 App 规则包", () => {
  it("覆盖用户提交的全部 18 个 App", () => {
    const expected = [
      "盒马", "叮咚买菜", "高德地图", "闲鱼", "铁路12306", "豆瓣", "知乎",
      "中国联通", "雪球", "国元点金", "美柚", "赫兹", "微博", "苏e行",
      "迅雷", "百度网盘", "Soul", "实习僧",
    ];
    expect(APP_RULE_PACKS.map((pack) => pack.name).sort()).toEqual([...expected].sort());
  });

  it("没有任何 App 的核心接口域名被自己的规则拦掉", () => {
    // 这是"不能把正常 App 弄坏"的硬性不变量：受保护域名绝不允许出现在拦截集合里。
    const blocked = new Set(collectBlockDomains("aggressive"));
    for (const pack of APP_RULE_PACKS) {
      for (const domain of pack.protectedDomains) {
        expect(blocked.has(domain)).toBe(false);
        expect(matchesAllowlist(domain, CRITICAL_ALLOWLIST) || !THIRD_PARTY_AD_DOMAINS.includes(domain)).toBe(true);
      }
    }
  });

  it("通用第三方广告 SDK 域名不与关键白名单重叠", () => {
    // 重叠意味着同一个域名既是广告又是系统/支付/地图服务，必须由白名单胜出。
    const overlap = THIRD_PARTY_AD_DOMAINS.filter((domain) => CRITICAL_ALLOWLIST.includes(domain));
    expect(overlap).toEqual([]);
  });

  it("safe 档是 balanced / aggressive 档的子集", () => {
    const safe = new Set(collectBlockDomains("safe"));
    for (const tier of ["balanced", "aggressive"] as const) {
      const wider = new Set(collectBlockDomains(tier));
      for (const domain of safe) {
        expect(wider.has(domain)).toBe(true);
      }
    }
  });

  it("aggressive 档比 safe 档多拦微博的广告域名", () => {
    const safe = collectBlockDomains("safe");
    const aggressive = collectBlockDomains("aggressive");
    expect(aggressive.length).toBeGreaterThan(safe.length);
    expect(aggressive).toContain("alitui.weibo.com");
  });

  it("券商 App 被标记为未采集，规则保持极端保守", () => {
    const guoyuan = findAppRulePack("国元点金");
    expect(guoyuan).toBeDefined();
    expect(guoyuan!.verified).toBe(false);
    expect(guoyuan!.adDomains).toEqual([]);
    expect(guoyuan!.note).toContain("券商");
  });

  it("受保护域名集合包含全部 App 的核心接口", () => {
    const protectedDomains = collectProtectedDomains();
    for (const domain of ["restapi.amap.com", "kyfw.12306.cn", "pan.baidu.com", "api.zhihu.com", "m.weibo.cn"]) {
      expect(protectedDomains).toContain(domain);
    }
  });

  it("三档都有可展示的说明且风险递增", () => {
    expect(TIER_LABELS.safe.risk).toBe("low");
    expect(TIER_LABELS.balanced.risk).toBe("medium");
    expect(TIER_LABELS.aggressive.risk).toBe("high");
    for (const tier of ["safe", "balanced", "aggressive"] as const) {
      expect(TIER_LABELS[tier].title.length).toBeGreaterThan(0);
      expect(TIER_LABELS[tier].description.length).toBeGreaterThan(0);
    }
  });
});

describe("关键白名单", () => {
  it("包含 Apple 系统服务、证书与时间同步", () => {
    // 拦掉 ocsp / time 会让大量 App 直接不可用，属于不可接受的误杀。
    for (const domain of ["apple.com", "icloud.com", "push.apple.com", "ocsp.apple.com", "time.apple.com"]) {
      expect(CRITICAL_ALLOWLIST).toContain(domain);
    }
  });

  it("包含支付、银行与登录", () => {
    for (const domain of ["alipay.com", "icbc.com.cn", "unionpay.com", "open.weixin.qq.com"]) {
      expect(CRITICAL_ALLOWLIST).toContain(domain);
    }
  });

  it("包含地图定位与主流内容 CDN", () => {
    for (const domain of ["restapi.amap.com", "apis.map.qq.com", "qlogo.cn", "sinajs.cn", "doubanio.com"]) {
      expect(CRITICAL_ALLOWLIST).toContain(domain);
    }
  });

  it("白名单命中覆盖子域名", () => {
    expect(matchesAllowlist("api.restapi.amap.com", CRITICAL_ALLOWLIST)).toBe(true);
    expect(matchesAllowlist("ads.doubleclick.net", CRITICAL_ALLOWLIST)).toBe(false);
  });
});
