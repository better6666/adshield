/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "content-blocker",
  name: "AdShieldSafari",
  displayName: "AdShield Safari 防护",
  bundleIdentifier: ".safari",
  deploymentTarget: "15.1",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.app.adshieldmobile"],
  },
};
