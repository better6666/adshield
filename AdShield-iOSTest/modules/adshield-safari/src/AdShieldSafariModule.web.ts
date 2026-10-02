// Web/Android stub — Safari Content Blocker is iOS only.

const AdShieldSafariModule = {
  async updateBlockerRulesAsync(_rulesJSON: string): Promise<number> {
    return 0;
  },
  async isAvailableAsync(): Promise<boolean> {
    return false;
  },
  async getCurrentRuleCountAsync(): Promise<number> {
    return 0;
  },
  async getExtensionStateAsync(): Promise<{ available: boolean; enabled: boolean; error: string | null }> {
    return { available: false, enabled: false, error: null };
  },
  async openSafariExtensionSettingsAsync(): Promise<boolean> {
    return false;
  },
};

export default AdShieldSafariModule;
