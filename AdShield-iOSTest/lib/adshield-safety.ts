/**
 * 安全引擎。
 *
 * 核心原则："宁可漏掉一条广告，也不能把正常 App 弄坏。" 因此每一条判断都按同一个
 * 优先级顺序求值，前一条否决后一条：
 *
 *   1. 暂停中            → 一律放行（用户主动暂停）
 *   2. 关键白名单命中     → 一律放行（系统、支付、银行、登录、验证码、地图、云同步、CDN）
 *   3. 熔断已触发        → 一律放行（本版本规则出现大面积失败，自动回退）
 *   4. 规则命中          → 拦截
 *
 * 这个顺序保证任何异常状态下系统都朝"放行"收敛，而不是朝"全拦"收敛。
 */

export type PauseDuration = "5m" | "30m" | "1h" | "today";

export type SafetyState = {
  /** 暂停截止时间戳（毫秒）；null 表示未暂停。 */
  pausedUntil: number | null;
  /** 当前生效的规则版本号，熔断回退时递减。 */
  ruleVersion: number;
  /** 熔断触发后回退到的版本号；null 表示未触发。 */
  circuitBreakerTrippedVersion: number | null;
  /** 连续失败计数。 */
  consecutiveFailures: number;
  /** 熔断期间的连续成功计数，用于自动恢复。 */
  consecutiveSuccesses: number;
  /** 触发熔断的连续失败阈值。 */
  failureThreshold: number;
};

export const INITIAL_SAFETY_STATE: SafetyState = {
  pausedUntil: null,
  ruleVersion: 1,
  circuitBreakerTrippedVersion: null,
  consecutiveFailures: 0,
  consecutiveSuccesses: 0,
  failureThreshold: 5,
};

export const PAUSE_OPTIONS: { value: PauseDuration; label: string }[] = [
  { value: "5m", label: "暂停 5 分钟" },
  { value: "30m", label: "暂停 30 分钟" },
  { value: "1h", label: "暂停 1 小时" },
  { value: "today", label: "暂停到今天结束" },
];

export function isPaused(state: SafetyState, now: number): boolean {
  return state.pausedUntil !== null && state.pausedUntil > now;
}

/**
 * 计算暂停截止时间。now 显式传入以便测试，不读系统时钟。
 */
export function resolvePauseUntil(duration: PauseDuration, now: number): number {
  const date = new Date(now);
  switch (duration) {
    case "5m":
      return now + 5 * 60 * 1000;
    case "30m":
      return now + 30 * 60 * 1000;
    case "1h":
      return now + 60 * 60 * 1000;
    case "today": {
      // 暂停到本地时间的次日 00:00。
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
      return endOfDay.getTime();
    }
  }
}

export function pause(state: SafetyState, duration: PauseDuration, now: number): SafetyState {
  return { ...state, pausedUntil: resolvePauseUntil(duration, now) };
}

export function resume(state: SafetyState): SafetyState {
  return { ...state, pausedUntil: null };
}

/** 暂停到期后自动恢复；未到期或未暂停时原样返回。 */
export function expirePauseIfNeeded(state: SafetyState, now: number): SafetyState {
  if (state.pausedUntil !== null && state.pausedUntil <= now) {
    return { ...state, pausedUntil: null };
  }
  return state;
}

/**
 * 归一化域名，与 adshield-engine 的规则保持一致：
 * 去协议、去 www、只保留主机名、小写。
 */
export function normalizeHost(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\s/g, "");
}

/** 主机名是否命中白名单（含子域名）。 */
export function matchesAllowlist(host: string, allowlist: string[]): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  return allowlist.some((domain) => {
    const d = normalizeHost(domain);
    return normalized === d || normalized.endsWith(`.${d}`);
  });
}

/**
 * 熔断：连续失败达到阈值时，把规则版本回退到上一个版本并清零计数。
 * 回退是单调的（版本号只减不增），避免在故障期间反复切换。
 */
export function registerFailure(state: SafetyState): SafetyState {
  const consecutiveFailures = state.consecutiveFailures + 1;
  if (consecutiveFailures < state.failureThreshold) {
    return { ...state, consecutiveFailures, consecutiveSuccesses: 0 };
  }
  return {
    ...state,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    ruleVersion: Math.max(0, state.ruleVersion - 1),
    circuitBreakerTrippedVersion: state.ruleVersion,
  };
}

/**
 * 熔断后不会自己一直坏下去：连续成功同样次数就自动恢复。
 * 否则一次偶发的写盘失败会让防护永久停在最小规则集，比漏拦广告更糟。
 */
export function registerSuccess(state: SafetyState): SafetyState {
  if (state.circuitBreakerTrippedVersion === null) {
    if (state.consecutiveFailures === 0) return state;
    return { ...state, consecutiveFailures: 0 };
  }
  const consecutiveSuccesses = state.consecutiveSuccesses + 1;
  if (consecutiveSuccesses < state.failureThreshold) {
    return { ...state, consecutiveFailures: 0, consecutiveSuccesses };
  }
  return {
    ...state,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    circuitBreakerTrippedVersion: null,
  };
}

/** 熔断是否仍在生效（此时应退回最小规则集，而不是继续下发完整规则）。 */
export function isCircuitBreakerTripped(state: SafetyState): boolean {
  return state.circuitBreakerTrippedVersion !== null;
}

/**
 * 一次拦截判定。返回是否拦截，以及被哪一层规则否决——
 * 返回原因让 UI 能解释"为什么这条没拦"，也方便定位误杀。
 */
export type BlockDecision =
  | { block: false; reason: "paused" | "allowlisted" | "circuit-breaker" | "protection-off" | "no-match" }
  | { block: true; reason: "rule-match" };

export function decideBlock(input: {
  host: string;
  blockedDomains: string[];
  allowlist: string[];
  state: SafetyState;
  now: number;
  protectionEnabled: boolean;
}): BlockDecision {
  const { host, blockedDomains, allowlist, state, now, protectionEnabled } = input;

  if (!protectionEnabled) return { block: false, reason: "protection-off" };
  if (isPaused(state, now)) return { block: false, reason: "paused" };
  // 关键白名单优先于一切拦截规则。
  if (matchesAllowlist(host, allowlist)) return { block: false, reason: "allowlisted" };
  if (state.circuitBreakerTrippedVersion !== null) return { block: false, reason: "circuit-breaker" };
  if (matchesAllowlist(host, blockedDomains)) return { block: true, reason: "rule-match" };
  return { block: false, reason: "no-match" };
}

/** 供 UI 展示的暂停剩余时间。 */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "已恢复";
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes} 分钟`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} 小时` : `${hours} 小时 ${minutes} 分钟`;
}
