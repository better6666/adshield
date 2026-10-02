import { describe, expect, it } from "vitest";

import {
  INITIAL_SAFETY_STATE,
  decideBlock,
  expirePauseIfNeeded,
  formatRemaining,
  isPaused,
  matchesAllowlist,
  normalizeHost,
  pause,
  isCircuitBreakerTripped,
  registerFailure,
  registerSuccess,
  resolvePauseUntil,
  resume,
} from "../lib/adshield-safety";
import { CRITICAL_ALLOWLIST } from "../lib/adshield-apprules";

const NOW = new Date(2026, 8, 21, 14, 30, 0).getTime(); // 2026-09-21 14:30 本地时间

describe("安全引擎判定顺序", () => {
  const base = {
    host: "ads.doubleclick.net",
    blockedDomains: ["doubleclick.net"],
    allowlist: CRITICAL_ALLOWLIST,
    now: NOW,
    protectionEnabled: true,
  };

  it("规则命中时拦截", () => {
    expect(decideBlock({ ...base, state: INITIAL_SAFETY_STATE })).toEqual({
      block: true,
      reason: "rule-match",
    });
  });

  it("未命中任何规则时放行", () => {
    expect(decideBlock({ ...base, host: "example.com", state: INITIAL_SAFETY_STATE })).toEqual({
      block: false,
      reason: "no-match",
    });
  });

  it("防护关闭时一律放行", () => {
    expect(decideBlock({ ...base, protectionEnabled: false, state: INITIAL_SAFETY_STATE })).toEqual({
      block: false,
      reason: "protection-off",
    });
  });

  it("暂停中一律放行，即使域名在拦截名单里", () => {
    const state = pause(INITIAL_SAFETY_STATE, "1h", NOW);
    expect(decideBlock({ ...base, state })).toEqual({ block: false, reason: "paused" });
  });

  it("关键白名单优先于拦截规则：支付域名永不被拦", () => {
    // 这是最重要的一条不变量——任何误配置都不能把支付/银行/地图弄坏。
    const state = { ...INITIAL_SAFETY_STATE, blockedDomains: ["alipay.com", "restapi.amap.com"] };
    expect(decideBlock({ ...base, host: "alipay.com", state })).toEqual({
      block: false,
      reason: "allowlisted",
    });
    expect(decideBlock({ ...base, host: "restapi.amap.com", state })).toEqual({
      block: false,
      reason: "allowlisted",
    });
  });

  it("暂停与熔断同时存在时，关键白名单域名仍然放行", () => {
    // 判定顺序是 暂停 → 白名单 → 熔断 → 规则；前三条都通向放行，
    // 所以这里真正要保证的不变量是"结果一定是放行"，而不是某一条特定的 reason。
    const pausedAndTripped = {
      ...pause(INITIAL_SAFETY_STATE, "1h", NOW),
      circuitBreakerTrippedVersion: 3,
    };
    const decision = decideBlock({ ...base, host: "push.apple.com", state: pausedAndTripped });
    expect(decision.block).toBe(false);
    expect(["paused", "allowlisted", "circuit-breaker"]).toContain(decision.reason);
  });

  it("熔断触发后一律放行（fail-open）", () => {
    const state = { ...INITIAL_SAFETY_STATE, circuitBreakerTrippedVersion: 3 };
    expect(decideBlock({ ...base, state })).toEqual({ block: false, reason: "circuit-breaker" });
  });
});

describe("一键暂停", () => {
  it("5m / 30m / 1h 分别对应正确的截止时间", () => {
    expect(resolvePauseUntil("5m", NOW)).toBe(NOW + 5 * 60 * 1000);
    expect(resolvePauseUntil("30m", NOW)).toBe(NOW + 30 * 60 * 1000);
    expect(resolvePauseUntil("1h", NOW)).toBe(NOW + 60 * 60 * 1000);
  });

  it("暂停到今天结束指向本地时间次日零点", () => {
    const until = resolvePauseUntil("today", NOW);
    const date = new Date(until);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getDate()).toBe(22); // 2026-09-21 → 次日
    expect(until).toBeGreaterThan(NOW);
  });

  it("到期后自动恢复", () => {
    const state = pause(INITIAL_SAFETY_STATE, "5m", NOW);
    expect(isPaused(state, NOW + 60 * 1000)).toBe(true);
    expect(isPaused(state, NOW + 6 * 60 * 1000)).toBe(false);
    expect(expirePauseIfNeeded(state, NOW + 6 * 60 * 1000).pausedUntil).toBeNull();
  });

  it("恢复后重新开始拦截", () => {
    const state = expirePauseIfNeeded(pause(INITIAL_SAFETY_STATE, "5m", NOW), NOW + 6 * 60 * 1000);
    expect(decideBlock({
      host: "doubleclick.net",
      blockedDomains: ["doubleclick.net"],
      allowlist: [],
      state,
      now: NOW + 6 * 60 * 1000,
      protectionEnabled: true,
    }).block).toBe(true);
  });

  it("resume 清掉暂停状态", () => {
    expect(resume(pause(INITIAL_SAFETY_STATE, "1h", NOW)).pausedUntil).toBeNull();
  });

  it("剩余时间可读", () => {
    expect(formatRemaining(5 * 60 * 1000)).toBe("5 分钟");
    expect(formatRemaining(60 * 60 * 1000)).toBe("1 小时");
    expect(formatRemaining(90 * 60 * 1000)).toBe("1 小时 30 分钟");
    expect(formatRemaining(0)).toBe("已恢复");
  });
});

describe("熔断与回滚", () => {
  it("连续失败达到阈值才触发，并回退一个规则版本", () => {
    let state = INITIAL_SAFETY_STATE;
    for (let i = 0; i < INITIAL_SAFETY_STATE.failureThreshold - 1; i++) {
      state = registerFailure(state);
    }
    expect(state.circuitBreakerTrippedVersion).toBeNull();
    expect(state.consecutiveFailures).toBe(INITIAL_SAFETY_STATE.failureThreshold - 1);

    state = registerFailure(state);
    expect(state.circuitBreakerTrippedVersion).toBe(1);
    expect(state.ruleVersion).toBe(0);
    expect(state.consecutiveFailures).toBe(0);
  });

  it("回退后版本号不会低于 0", () => {
    let state = { ...INITIAL_SAFETY_STATE, ruleVersion: 0 };
    for (let i = 0; i < INITIAL_SAFETY_STATE.failureThreshold; i++) {
      state = registerFailure(state);
    }
    expect(state.ruleVersion).toBe(0);
  });

  it("一次成功清零失败计数", () => {
    const state = registerSuccess({ ...INITIAL_SAFETY_STATE, consecutiveFailures: 3 });
    expect(state.consecutiveFailures).toBe(0);
  });

  it("没有失败时 registerSuccess 不产生新对象", () => {
    expect(registerSuccess(INITIAL_SAFETY_STATE)).toBe(INITIAL_SAFETY_STATE);
  });

  // 回归测试：熔断曾经没有恢复路径——circuitBreakerTrippedVersion 一旦置上就再也
  // 不清除，一次偶发的写盘失败会让防护永久停在最小规则集，比漏拦广告更糟。
  it("熔断后连续成功同样次数即自动恢复", () => {
    let state = INITIAL_SAFETY_STATE;
    for (let i = 0; i < INITIAL_SAFETY_STATE.failureThreshold; i++) {
      state = registerFailure(state);
    }
    expect(isCircuitBreakerTripped(state)).toBe(true);

    for (let i = 0; i < INITIAL_SAFETY_STATE.failureThreshold - 1; i++) {
      state = registerSuccess(state);
      expect(isCircuitBreakerTripped(state), `第 ${i + 1} 次成功还不该恢复`).toBe(true);
    }
    state = registerSuccess(state);
    expect(isCircuitBreakerTripped(state)).toBe(false);
    expect(state.circuitBreakerTrippedVersion).toBeNull();
    expect(state.consecutiveSuccesses).toBe(0);
    // 恢复后判定回到正常放行/拦截逻辑
    expect(decideBlock({ host: "doubleclick.net", blockedDomains: ["doubleclick.net"], allowlist: [], state, now: 0, protectionEnabled: true })).toEqual({ block: true, reason: "rule-match" });
  });

  it("熔断期间又来一次失败会重新开始计恢复进度", () => {
    let state = INITIAL_SAFETY_STATE;
    for (let i = 0; i < INITIAL_SAFETY_STATE.failureThreshold; i++) state = registerFailure(state);
    for (let i = 0; i < INITIAL_SAFETY_STATE.failureThreshold - 1; i++) state = registerSuccess(state);
    state = registerFailure(state);
    expect(isCircuitBreakerTripped(state)).toBe(true);
    expect(state.consecutiveSuccesses).toBe(0);
  });

  it("isCircuitBreakerTripped 反映真实状态", () => {
    expect(isCircuitBreakerTripped(INITIAL_SAFETY_STATE)).toBe(false);
    expect(isCircuitBreakerTripped({ ...INITIAL_SAFETY_STATE, circuitBreakerTrippedVersion: 0 })).toBe(true);
  });
});

describe("域名归一化与白名单匹配", () => {
  it("归一化协议、www、路径与大小写", () => {
    expect(normalizeHost(" HTTPS://WWW.Example.com/a/b?c=1 ")).toBe("example.com");
  });

  it("白名单匹配子域名但不匹配同后缀域名", () => {
    expect(matchesAllowlist("cdn.example.com", ["example.com"])).toBe(true);
    expect(matchesAllowlist("notexample.com", ["example.com"])).toBe(false);
    expect(matchesAllowlist("example.com.evil.net", ["example.com"])).toBe(false);
  });

  it("空主机不命中任何白名单", () => {
    expect(matchesAllowlist("", ["example.com"])).toBe(false);
  });
});
