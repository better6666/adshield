import { NativeModule, requireNativeModule } from "expo";

import { AdAssistStatus, AdShieldVpnModuleEvents, InstalledApp, VpnStatus } from "./AdShieldVpn.types";

declare class AdShieldVpnModule extends NativeModule<AdShieldVpnModuleEvents> {
  getStatusAsync(): Promise<VpnStatus>;
  requestSystemPermissionAsync(): Promise<VpnStatus>;
  startAsync(): Promise<VpnStatus>;
  stopAsync(): Promise<VpnStatus>;
  setTargetPackagesAsync(packageNames: string[]): Promise<VpnStatus>;
  getInstalledAppsAsync(): Promise<InstalledApp[]>;
  setRulesAsync(blockedDomains: string[], whitelist: string[]): Promise<VpnStatus>;
  setWhitelistAsync(domains: string[]): Promise<void>;
  getAdAssistStatusAsync(): Promise<AdAssistStatus>;
  openAdAssistSettingsAsync(): Promise<AdAssistStatus>;
  setAdAssistEnabledAsync(enabled: boolean): Promise<AdAssistStatus>;
}

export default requireNativeModule<AdShieldVpnModule>("AdShieldVpn");
