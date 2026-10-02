# AdShield Mobile 运行说明

## 当前版本

本项目为可在 Expo 环境中运行的移动端首版，优先设计 Android 使用体验，同时提供 iOS Safari 内容拦截测试版。应用已实现本地规则分类、启停开关、白名单、拦截记录、设置项与 AsyncStorage 持久化。

## 本地启动

在项目根目录运行 `pnpm dev`，然后使用 Android 设备上的 Expo Go 扫描开发二维码。也可以运行 `pnpm android` 在已配置的 Android 模拟器或设备中打开。

iOS Safari 拦截扩展需要用原生开发构建（Expo Go 不包含扩展 target），在可用的 Apple 签名环境执行：

```bash
ADSHIELD_ENABLE_IOS_TARGETS=1 npx expo run:ios
```

构建前需在 `app.config.ts` 的 `appleTeamId` 与 Xcode 工程的 Development Team 中填入你的 Apple Team。主 App 与扩展共享 App Group `group.com.appshieldmobile`，两边的 entitlements 已由 prebuild 插件与 `targets/adshield-safari/expo-target.config.js` 声明，重新 prebuild 不会丢失。

安装后仍需手动启用一次扩展：iOS 设置 → App → Safari → 扩展 → “AdShield Safari 防护”，选择“所有网站”。应用内设置页会显示扩展的真实启用状态（iOS 15.4+），并可以一键跳转该设置页。

## 规则同步链路（iOS）

1. JS 侧 `buildBlockerRules(settings, whitelist)` 根据总开关、规则分组与白名单生成 Safari Content Blocker 规则（白名单 `ignore-previous-rules` 规则排最前）。
2. `generateBlockerRulesJSON` 在规则数为 0（防护关闭）时改写一条永远匹配不到任何 URL 的占位规则：内容拦截器拒绝编译空列表，会以 `WKErrorDomain error 6` 让 reload 失败。
3. `AdShieldSafariModule.updateBlockerRulesAsync` 将规则 JSON 写入 App Group 共享容器的 `blocker_rules.json`，并调用 `SFContentBlockerManager.reloadContentBlocker` 让 Safari 立即重载。
4. 扩展端 `ContentBlockerRequestHandler` 优先读取共享容器中的动态规则；只有从未同步过时才回退到随扩展打包的 `BlockerList.json`（该静态文件由引擎默认输出生成，与动态默认行为一致）。防护关闭时同步的是占位规则，同样不会再回退拦截。
5. 冷启动即按当前开关状态同步一次（关闭时也同步，避免扩展沿用上一次的拦截规则）；总开关、规则分组、白名单任一变更都会自动重新同步；应用回到前台时刷新扩展启用状态与规则数。

## 验证

规则引擎与 Safari 规则生成测试共 64 项通过、1 项跳过，覆盖域名规范化、子域名白名单、关闭保护时不拦截、按规则分组过滤、白名单 ignore 优先、popup 规则、JSON 结构、"任何开关状态下都不会产出空规则列表"，以及中国 App 规则包的三档域名集合、安全引擎的暂停/白名单/熔断决策、DNS 配置生成与 matchDomains 限定。运行 `pnpm test` 复验，`npx tsc --noEmit` 也已通过。注意 vitest 只覆盖 JS 引擎层；原生模块与扩展需真机构建后验证，清单见 `todo.md`。

### 真机验证结果（iPhone 14 Pro / iOS 26.6.2）

Release 构建安装并启动成功，Safari 扩展进程随系统加载。设备侧实测：

- 开启防护：`blocker_rules.json` 写入 App Group 容器（150 条规则，56026 字节），读回一致，`reloadContentBlocker` 无错误返回。
- 关闭防护：写入 1 条永远不匹配任何 URL 的占位规则，`reloadContentBlocker` 同样无错误；此前写空列表 `[]` 会以 `WKErrorDomain error 6` 编译失败。
- 扩展端 `ContentBlockerRequestHandler` 与主 App 通过 App Group 读到同一份规则，主 App 自己列出的容器内容包含 `blocker_rules.json`。
- 首页 iOS 卡片显示"已同步 150 条规则"、74 个拦截域名；扩展未启用时显示警告横幅并可跳转系统设置。

注意 `xcrun devicectl device info files --domain-type appGroupDataContainer` 列不出该容器里的 `blocker_rules.json`（只显示 `Library` 子树，上传也会报 `CoreDeviceError 7000`），这是 devicectl 文件服务的局限，不是 App Group 未生效；判断依据是 App 自己 `contentsOfDirectory` 的结果与读回校验。

### 5+1 分层架构的两层原生结论（2026-09-21 实测）

对 NEURLFilter（iOS 26）与 NEDNSSettingsManager（iOS 14.0+）都做了编译期与运行期的双重验证，结论都是"API 真实存在，但这个 Apple 账号用不了"：

**NEURLFilter（iOS 26）**：`/tmp/neurlfilter-probe/probe.swift` 用 iOS 26 SDK 真实编译通过（`xcrun --sdk iphoneos swiftc -target arm64-apple-ios26.0 -typecheck`，exit 0），API 表面是真实的。但它作为系统层不可交付：`NEURLFilter.verdict(for:)` 对不使用 Apple 网络框架的 App 只是"自愿"调用；`NEURLFilterManager.setConfiguration` 要求调用方自己搭 PIR 服务器与 Privacy Pass 颁发方（swiftdoc 原文 "URL filter App implementation must set up a PIR server"）；符号表里的 `NEURLFilterManagerPrivate`、`enableConfig(_:serviceID:)`、`isFromMDM`、`isFromProfile` 说明它被服务注册/MDM 门槛把着；SDK 里也查不到对应的 entitlement 字符串。

**NEDNSSettingsManager（iOS 14.0+）**：公开 API、普通 App 可调用，`matchDomains` 的语义（"只对指定域名使用这套 DNS 设置"）正好支撑"只让广告域名走过滤解析器"的安全设计。但它同样要 Network Extensions 能力，这一点在构建期与运行期都被证死：

- 构建期（Xcode 原文）：`Cannot create a iOS App Development provisioning profile for "com.app.adshieldmobile". Personal development teams, including "文健 殷", do not support the Network Extensions capability.`
- 运行期（真机探针）：`loadFromPreferences` 返回 `NEConfigurationErrorDomain Code=10 "permission denied"`，`saveToPreferences` 返回 `NEDNSSettingsErrorDomain Code=3`，`enabled=false`。

也就是说这套 API 能编译、能调用，但权限被系统拒绝。因此已把 App 的 `com.apple.developer.networking.networkextension` entitlement 撤回（构建恢复正常），prebuild 插件改为仅在 `ADSHIELD_ENABLE_NETWORK_EXTENSION=1` 时写入该 entitlement。`AdShieldDnsModule.isAvailableAsync` 改为真机实测——真的去 `loadFromPreferences` 一次，把 permission denied 的原因回传 JS；"安全"tab 据此显示说明卡片并禁用开关与预设，不再给用户一个点了没反应的死开关。DNS 层的全部代码（原生模块、podspec、6 个 DoH/DoT 预设、matchDomains 限定、fail-open 回退）都保留，升级到付费开发者账号后重新签名即可打开。

## 域名清单的唯一来源

`lib/adshield-engine.ts` 的 `resolveRuleGroups(tier)` 是全 App 唯一的域名来源，Safari 规则、界面上的拦截计数、Android DNS 过滤器、iOS DNS 的 matchDomains 全部由它派生。第三方广告 SDK 域名（`THIRD_PARTY_AD_DOMAINS`）与 App 自有接口无关，任何档位都并入"广告"组；balanced / aggressive 才额外把中国 App 规则包里各 App 的自有广告域名并入"应用内广告"组。

这条不变量由 `tests/adshield-engine.test.ts` 的"域名清单一致性"一组测试钉住：safe 档的 Safari 规则必须覆盖 `collectBlockDomains("safe")` 的每一个域名，界面上报的每个域名都必须真的出现在拦截规则里。此前引擎与规则包各维护一份清单，safe 档 62 个第三方 SDK 域名只有 37 个进入 Safari 规则，百度广告联盟、淘宝广告、AppLovin、友盟、神策等 25 个从未被拦，而界面显示的数字比实际拦截范围大。

## 安全引擎的失败信号

App 没有 VPN、没有网络扩展，观察不到任何一次具体的网络请求，能观察到的"规则是不是好的"只有写盘与 reload 是否成功（编译失败会以 `WKErrorDomain error 6` 抛出）。因此 `syncSafariRules` 把同步失败接到 `registerFailure`、成功接到 `registerSuccess`，熔断期间退回一条永远不匹配的占位规则，并在"安全"tab 显示"规则已自动回退"横幅。

熔断不会一直坏下去：连续成功 `failureThreshold`（默认 5）次后自动恢复。此前 `circuitBreakerTrippedVersion` 一旦置上就永不清除，一次偶发的写盘失败会让防护永久停在最小规则集，比漏拦广告更糟。

## 系统级拦截范围

当前版本已加入 Android DNS-only 本地 VPN 数据面：建立虚拟 DNS 地址、读取 IPv4 UDP/53 查询、按广告域名和白名单判断、命中时返回拒绝响应、未命中时通过受保护的上游 DNS 转发，并以低优先级前台通知维持服务。它不添加默认路由，因此不会把普通 TCP/UDP 流量导入未实现的黑洞。DoH、DoT、应用自带 DNS 和离线内置广告不在该模式覆盖范围内。

iOS 侧的能力边界：Safari 内容拦截只作用于 Safari 浏览器内的资源与弹窗，无法拦截其他 App（含微信小程序）内的广告，也不会读取其他 App 的界面内容；“摇一摇”无障碍辅助仅实现于 Android。iOS 上系统级的 NEURLFilter 与加密 DNS 两层在当前 Apple 账号下不可用，原因见上一节；18 个中国 App 的自有广告域名规则已就绪，但只对 Safari 内的请求生效。

## 安装包

- **Android**：`AdShield-v1.0.0-android.apk`（项目根目录，48MB，minSdk 24 / Android 7.0+，targetSdk 36，debug keystore 签名可直装）。传到手机点开安装，或在 `android/` 目录用 `JAVA_HOME="/Users/better/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" ANDROID_HOME="$HOME/Android/Sdk" ./gradlew assembleRelease` 重新构建。注意本机默认 JDK 是 11，Android Studio 自带的 JBR 25 也不被 RN 插件接受，必须用 Homebrew 的 openjdk@17。
- **iOS**：无法像 Android 一样交付独立安装包——个人团队签名的 App 只能由 Xcode/devicectl 直接装到已配对设备。当前最新版已安装到 iPhone 14 Pro；重装命令：`xcodebuild -workspace ios/AdShield.xcworkspace -scheme AdShield -configuration Release -destination 'platform=iOS,id=<设备UDID>' -allowProvisioningUpdates build`，产物在 DerivedData 的 `Release-iphoneos/AdShield.app`，用 `xcrun devicectl device install app` 安装。

## 发布下载站（Cloudflare）

- **地址**：https://adshield-download.2333333434.workers.dev（Cloudflare 边缘网络，无源服务器）
- **架构**：Worker `adshield-download` 提供下载页，安装包存在 R2 桶 `adshield-downloads`，经 Worker 流式下载（支持 Range 断点续传）
- **Android v1.0.1**（2026-09-25 更新）：`/AdShield-v1.0.1-android.apk`（48MB，SHA-256 4823be4e…fdc2）。修复了首次开启保护时的误导性"权限未授予"弹窗——原来 `requestSystemPermissionAsync` 在系统授权弹窗弹出的瞬间就返回 prepared=false，导致 App 在用户还没点"允许"时就说权限未授予；现在会轮询等待授权完成并自动启动服务。旧包 v1.0.0 仍在 R2 里但页面已不再链接。
- **iOS v1.0.1**（2026-09-25 更新）：`/AdShield-v1.0.1-ios.ipa`（11MB，SHA-256 c93c9a21…2b47），与 Android 版本号对齐；含元素隐藏防误伤、计数诚实化、白名单抵消扣除等全部修复。注意：Expo 打 iOS 包时会按平台裁剪掉 `Platform.OS === "android"` 分支，验证 iOS 包内容不能用 Android 专属字符串（如 startVpn 弹窗文案），否则会误判为缺代码。旧包 v1.0.0 仍在 R2 但页面不再链接。
- **ipa 来源**：真机构建产物 `Release-iphoneos/AdShield.app` 打包为 Payload zip，含个人团队描述文件；侧载工具会重签替换
- **绑定 adshield.dpdns.org**：API 令牌没有建 zone 权限，需要先在 Cloudflare 面板添加该域名（免费计划），然后在 Workers → adshield-download → Settings → Domains & Routes 添加 Custom Domain
- **发布前安全检查**：安装包内无内嵌密钥/证书（已扫描 index.android.bundle）；部署用的临时上传通道已从最终版 Worker 移除，仅保留 GET/HEAD

## 发布说明

Android 发布配置可独立构建，不请求 Apple Developer Portal 登录（`@bacons/apple-targets` 仅在 iOS 构建或 `ADSHIELD_ENABLE_IOS_TARGETS=1` 时加载）。iOS 需要有效的 Apple Team ID、签名凭据，并在真机上完成一次扩展启用，EAS/本地构建产物才能实际拦截。
