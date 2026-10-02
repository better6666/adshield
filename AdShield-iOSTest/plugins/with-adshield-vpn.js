const { withAndroidManifest } = require("expo/config-plugins");

const VPN_SERVICE_NAME = "expo.modules.adshieldvpn.AdShieldVpnService";

module.exports = function withAdShieldVpn(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const manifest = nextConfig.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    const hasForegroundPermission = manifest["uses-permission"].some(
      (permission) => permission.$?.["android:name"] === "android.permission.FOREGROUND_SERVICE",
    );
    if (!hasForegroundPermission) {
      manifest["uses-permission"].push({ $: { "android:name": "android.permission.FOREGROUND_SERVICE" } });
    }

    const application = manifest.application?.[0];
    if (!application) throw new Error("Android application node is missing");
    application.service = application.service || [];
    const hasVpnService = application.service.some((service) => service.$?.["android:name"] === VPN_SERVICE_NAME);
    if (!hasVpnService) {
      application.service.push({
        $: {
          "android:name": VPN_SERVICE_NAME,
          "android:exported": "false",
          "android:permission": "android.permission.BIND_VPN_SERVICE",
        },
        "intent-filter": [
          { action: [{ $: { "android:name": "android.net.VpnService" } }] },
        ],
      });
    }
    return nextConfig;
  });
};
