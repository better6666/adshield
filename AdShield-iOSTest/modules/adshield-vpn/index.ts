// Re-export the native module. On web, it will be resolved to AdShieldVpnModule.web.ts
// and on native platforms to AdShieldVpnModule.ts
export { default } from './src/AdShieldVpnModule';
export * from './src/AdShieldVpn.types';
