import type { StyleProp, ViewStyle } from 'react-native';

export type OnLoadEventPayload = {
  url: string;
};

export type AdShieldVpnModuleEvents = {
  onStatusChange: (params: VpnStatus) => void;
};

export type VpnStatus = {
  available: boolean;
  prepared: boolean;
  running: boolean;
  packageCount: number;
  blockedCount: number;
  targetPackages: string[];
  protectsAllApps: boolean;
  ruleCount: number;
};

export type InstalledApp = {
  packageName: string;
  appName: string;
};

export type AdAssistStatus = {
  available: boolean;
  enabled: boolean;
  connected: boolean;
  detections: number;
};

export type AdShieldVpnViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
};
