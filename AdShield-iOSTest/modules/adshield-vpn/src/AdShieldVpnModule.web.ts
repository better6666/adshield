import type { AdAssistStatus, VpnStatus } from './AdShieldVpn.types';

let packages: string[] = [];
let rules: string[] = [];
const getStatusAsync = async (): Promise<VpnStatus> => ({
  available: false,
  prepared: false,
  running: false,
  packageCount: packages.length,
  blockedCount: 0,
  targetPackages: packages,
  protectsAllApps: packages.length === 0,
  ruleCount: rules.length,
});
const getAdAssistStatusAsync = async (): Promise<AdAssistStatus> => ({ available: false, enabled: false, connected: false, detections: 0 });

const AdShieldVpnModule = {
  getStatusAsync,
  requestSystemPermissionAsync: getStatusAsync,
  startAsync: getStatusAsync,
  stopAsync: getStatusAsync,
  async setTargetPackagesAsync(packageNames: string[]): Promise<VpnStatus> {
    packages = packageNames;
    return getStatusAsync();
  },
  async setWhitelistAsync(): Promise<void> {},
  async getInstalledAppsAsync() { return []; },
  async setRulesAsync(blockedDomains: string[]): Promise<VpnStatus> {
    rules = blockedDomains;
    return getStatusAsync();
  },
  getAdAssistStatusAsync,
  openAdAssistSettingsAsync: getAdAssistStatusAsync,
  async setAdAssistEnabledAsync(): Promise<AdAssistStatus> { return getAdAssistStatusAsync(); },
};

export default AdShieldVpnModule;
