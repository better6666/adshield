import { NativeModule, requireNativeModule } from "expo";

export type DnsConfiguration = {
  protocol: "https" | "tls";
  endpoint: string;
  /** null 表示对全部域名生效；非空表示只对这些域名生效。 */
  matchDomains: string[] | null;
  allowFailover: boolean;
};

export type DnsState = {
  available: boolean;
  enabled: boolean;
  error: string | null;
};

export type DnsAvailability = {
  /** false 表示本机无法写入系统 DNS 设置（通常是没有 Network Extensions 能力）。 */
  available: boolean;
  reason: string | null;
};

declare class AdShieldDnsModule extends NativeModule {
  /** 真机实测系统级 DNS 配置是否可用。返回可用性与失败原因。 */
  isAvailableAsync(): Promise<DnsAvailability>;

  /** 写入系统 DNS 偏好。返回 saved 与系统当前 enabled 状态。 */
  configureAsync(options: DnsConfiguration): Promise<{ saved: boolean; enabled: boolean }>;

  /** 查询系统里 DNS 配置的真实启用状态。 */
  getStateAsync(): Promise<DnsState>;

  /** 移除 DNS 配置。 */
  disableAsync(): Promise<boolean>;

  /** 打开本 App 的设置页（iOS 没有直达 DNS 设置的公开 URL scheme）。 */
  openDnsSettingsAsync(): Promise<boolean>;
}

export default requireNativeModule<AdShieldDnsModule>("AdShieldDns");
