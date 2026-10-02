# Android 应用内广告与诱导行为防护架构

## 可实施能力

Android 的 `VpnService` 可建立本地虚拟网卡，并在用户首次确认后将设备或选定应用的网络流量路由至本地防护引擎。该服务需要以前台服务运行，并向用户显示持续通知；同一用户配置文件同时只能有一个活动 VPN。[1] [2]

当前 Android 版本采用“本地 VPN + DNS/域名规则”架构。规则引擎只读取必要的 DNS 主机名，匹配广告网络、推广 SDK、跟踪器和已知恶意跳转域名；命中后返回本地拒绝结果。该方式能够减少使用独立广告域名的应用内广告与推广请求，但不会解密 HTTPS 内容，也不会修改第三方 App 的界面。

仓库中的 Mihomo 文档是后续调研记录，不是当前已启用能力。Mihomo 本身也不能在不进行 TLS 解密的情况下识别与正常内容共用同一 HTTPS 接口的信息流广告。

| 能力 | Android 实现方式 | 用户可见边界 |
|---|---|---|
| 应用内广告/推广 SDK 请求 | 本地 VPN 中按 DNS 域名和 IP 目标匹配规则 | 仅对命中的网络请求有效；离线内置素材不能拦截。 |
| 可疑跳转和落地页 | 拦截已知短链、推广与重定向域名 | 不能判断所有正常业务跳转，规则必须可撤销并支持白名单。 |
| 应用级范围 | `VpnService.Builder.addAllowedApplication()` 配置允许列表 | 列表变化需要重新建立 VPN；选择的应用必须已安装。[1] |
| 摇一摇诱导广告 | 显示风险说明、提供系统级传感器访问提示与可疑广告域名防护 | 不能从本应用直接禁止其他 App 使用加速度计或改写其“摇一摇”逻辑。 |
| 已安装应用列表 | 最小化包可见性；优先由用户手动选择或只声明必要包名 | Android 11+ 默认限制已安装应用可见性；`QUERY_ALL_PACKAGES` 应只在必要且合规时使用。[3] [4] |

## “摇一摇”防护策略

Android 设备具备加速度计等运动传感器，第三方应用可能把动作识别作为广告跳转触发条件。AdShield 不尝试监听或干预其他 App 的传感器事件，因为这既不可靠，也不符合最小权限原则。相反，应用将提供“摇一摇诱导风险”说明、针对推广域名的网络拦截、受保护应用清单与受阻断请求记录。用户可以针对容易出现此类广告的应用启用 VPN 路由保护。

## 隐私与权限原则

本地 VPN 设计不上传原始流量、请求正文、账号信息或完整浏览历史。规则命中记录仅保留域名、规则类别、时间和用户明确选择的应用范围。启用前必须解释 Android 的 VPN 授权、前台通知、与其他 VPN 的互斥关系及随时关闭方法。

## iOS 边界

iOS 首版仍定位为 Safari 内容拦截和用户可控的网络防护能力。对其他 App 的同等级通用拦截不应作为承诺；产品界面需要明确区分 Android 的本地 VPN 方案和 iOS 的系统限制。

## References

[1]: https://developer.android.com/develop/connectivity/vpn "Android Developers: VPN"
[2]: https://developer.android.com/reference/android/net/VpnService "Android Developers: VpnService"
[3]: https://developer.android.com/training/package-visibility "Android Developers: Package visibility filtering"
[4]: https://developer.android.com/training/package-visibility/declaring "Android Developers: Declare package visibility needs"
[5]: https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion "Android Developers: Motion sensors"


## iOS Safari 实现边界

Apple 的 Safari 内容拦截器是一个 App Extension：宿主应用交付 JSON 规则，Safari 预先编译并执行这些规则，可阻止资源、隐藏元素、阻断弹窗或移除 Cookie；扩展本身不能读取用户浏览历史。[6] Expo CNG 项目可以通过配置插件添加 iOS App Extension target，但 EAS 需要在构建前声明扩展 target、bundle identifier 和 entitlements。[7]

因此 iOS 版本应实现 Safari Content Blocker 扩展，而不是承诺拦截其他 App 的内置广告。扩展的规则生成器可复用 AdShield 的本地广告域名和页面选择器规则，并通过 `SFContentBlockerManager` 触发规则刷新。

[6]: https://developer.apple.com/documentation/safariservices/creating-a-content-blocker "Apple Developer: Creating a content blocker"
[7]: https://docs.expo.dev/build-reference/app-extensions/ "Expo: iOS App Extensions"
