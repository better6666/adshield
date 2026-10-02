import { NativeModule, requireNativeModule } from "expo";

export type AdShieldExtensionState = {
  /** 扩展是否已被系统检测到（未安装扩展或查询 API 不可用时为 false）。 */
  available: boolean;
  /** 扩展是否已在 Safari 设置中开启。 */
  enabled: boolean;
  error: string | null;
};

declare class AdShieldSafariModule extends NativeModule {
  /**
   * Write blocker rules JSON to the App Group shared container
   * and reload the Safari Content Blocker extension.
   * Returns the number of rules written.
   */
  updateBlockerRulesAsync(rulesJSON: string): Promise<number>;

  /**
   * Check if the Content Blocker extension is available
   * (i.e. running on iOS and the extension identifier is configured).
   */
  isAvailableAsync(): Promise<boolean>;

  /**
   * Get the current rules count from the shared container.
   * Returns 0 if no dynamic rules have been written.
   */
  getCurrentRuleCountAsync(): Promise<number>;

  /**
   * Query the real enabled state of the content blocker from the system
   * (requires iOS 15.4+; otherwise available=false with an error message).
   */
  getExtensionStateAsync(): Promise<AdShieldExtensionState>;

  /**
   * Try to open the Safari extension settings page
   * (falls back to the app's own settings page on failure).
   */
  openSafariExtensionSettingsAsync(): Promise<boolean>;

}

export default requireNativeModule<AdShieldSafariModule>("AdShieldSafari");
