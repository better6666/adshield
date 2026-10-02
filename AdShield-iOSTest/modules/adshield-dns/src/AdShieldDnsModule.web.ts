// Web/Android stub — 系统级 DNS 配置是 iOS 独有能力。

const AdShieldDnsModule = {
  async isAvailableAsync(): Promise<{ available: boolean; reason: string | null }> {
    return { available: false, reason: "系统级 DNS 配置是 iOS 独有能力" };
  },
  async configureAsync(_options: {
    protocol: string;
    endpoint: string;
    matchDomains: string[] | null;
    allowFailover: boolean;
  }): Promise<{ saved: boolean; enabled: boolean }> {
    return { saved: false, enabled: false };
  },
  async getStateAsync(): Promise<{ available: boolean; enabled: boolean; error: string | null }> {
    return { available: false, enabled: false, error: null };
  },
  async disableAsync(): Promise<boolean> {
    return false;
  },
  async openDnsSettingsAsync(): Promise<boolean> {
    return false;
  },
};

export default AdShieldDnsModule;
