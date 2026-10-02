const { withEntitlementsPlist } = require("@expo/config-plugins");

const APP_GROUP = "group.com.app.adshieldmobile";

// 系统级加密 DNS（NEDNSSettingsManager）需要 Network Extensions 能力。
// 个人（免费）开发者账号不提供该能力：Xcode 会直接报错
// "Personal development teams do not support the Network Extensions capability"，
// 导致整个 App 无法签名构建。因此默认不写入该 entitlement，
// 只在显式开启开关（且账号是付费团队）时才加。
const ENABLE_NETWORK_EXTENSION = process.env.ADSHIELD_ENABLE_NETWORK_EXTENSION === "1";

// 主 App 与 Safari 扩展需要共享 App Group 才能传递动态拦截规则。
module.exports = function withAdShieldEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    const groups = config.modResults["com.apple.security.application-groups"] ?? [];
    if (!groups.includes(APP_GROUP)) {
      config.modResults["com.apple.security.application-groups"] = [...groups, APP_GROUP];
    }

    if (ENABLE_NETWORK_EXTENSION) {
      const networkExtension = config.modResults["com.apple.developer.networking.networkextension"] ?? [];
      if (!networkExtension.includes("dns-settings")) {
        config.modResults["com.apple.developer.networking.networkextension"] = [
          ...networkExtension,
          "dns-settings",
        ];
      }
    }
    return config;
  });
};
