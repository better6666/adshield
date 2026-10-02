# AdShield · 移动端广告弹窗拦截

iOS / Android 双端广告与弹窗拦截工具。规则引擎完全在本地运行，不上传任何浏览数据。

**Android 是完整功能端**：基于 `VpnService` 的按 App 域名过滤，可为不同 App 分别启停拦截。
**iOS 受系统能力限制**：只能拦截 Safari 中的广告弹窗（Safari Content Blocker 扩展），另提供一份可选的全局 DNS 过滤描述文件。

## 平台能力对比

| 能力 | Android | iOS |
| --- | --- | --- |
| 拦截范围 | 按 App 选择的 DNS 查询过滤 | 仅 Safari（App 内网页无法覆盖） |
| 实现方式 | `VpnService` + 本地 DNS 解析与规则匹配 | `SFContentBlockerManager` + App Group 共享规则 |
| 精细度 | 逐个 App 开关、白名单 | 全局规则分组、域名白名单 |
| 全局兜底 | — | `profiles/` 内的 AdGuard DNS 描述文件 |
| TLS 中间人 | 不做 | 不做 |

## 功能

- 四大规则分组：ads（广告网络）、trackers（跟踪域名）、popups（弹窗/跳转页）、appAds（国内 App 广告域名）
- 拦截记录页：展示被过滤的域名与命中规则
- 白名单：支持子域名级放行，白名单规则优先于拦截规则生效
- App 选择与安全档位（Android）：为已安装的 App 单独配置保护强度，含暂停与熔断策略
- DNS 上游可选：AdGuard Default / Unfiltered、AliDNS、DNSPod DoH、Quad9、Cloudflare DoH
- 全部配置通过 AsyncStorage 本地持久化，冷启动即按当前开关状态同步一次规则

## 技术栈

Expo SDK 54 · React Native 0.81 · React 19 · TypeScript 5.9 · pnpm · Expo Router · NativeWind

原生部分：

- `modules/adshield-vpn` — Kotlin，`VpnService` 转发 DNS 流量并本地解析
- `modules/adshield-safari` — Swift，Safari 内容拦截扩展，经 App Group `group.com.appshieldmobile` 读取动态规则
- `modules/adshield-dns` — iOS 系统 DNS 配置桥接

## 快速开始

```bash
cd AdShield-iOSTest
pnpm install

pnpm test          # 规则引擎单测
pnpm check         # tsc --noEmit
pnpm dev           # Expo 开发服务（Android 用 Expo Go 扫码）
pnpm android       # 构建并安装到 Android 设备/模拟器
```

iOS 的 Safari 扩展不包含在 Expo Go 中，需要原生构建，并在 `app.config.ts` 与 Xcode 工程的 Development Team 中填入你自己的 Apple Team：

```bash
ADSHIELD_ENABLE_IOS_TARGETS=1 npx expo run:ios
```

安装后需在系统设置手动启用一次：**设置 → App → Safari → 扩展 → AdShield Safari 防护 → 所有网站**。应用内设置页会显示扩展的真实启用状态（iOS 15.4+）并可一键跳转。

更完整的运行与验证说明见 [`AdShield-iOSTest/RUNNING.md`](AdShield-iOSTest/RUNNING.md)。

## 目录结构

```
├── AdShield-iOSTest/          Expo 应用（主体工程）
│   ├── app/                   Expo Router 页面：规则、App 选择、拦截记录、安全、设置
│   ├── modules/               原生模块：vpn / safari / dns
│   ├── targets/               Safari 扩展 target
│   ├── profiles/              可选的全局 DNS 过滤描述文件（.mobileconfig）
│   ├── lib/                   规则引擎、DNS 上游、安全策略、状态上下文
│   └── tests/                 vitest 用例
├── ANDROID_IMPLEMENTATION.md        Android 实施记录
├── ANDROID_ADVANCED_FILTERING.md    按 App 过滤的设计说明
├── MIHOMO_INTEGRATION_PLAN.md       与 mihomo 集成的规划（未实现）
├── AdShield-v1.0.1-android.apk      Android 安装包
├── AdShield-v1.0.1-ios.ipa          iOS 构建产物（需自行签名侧载）
└── Sources/, Package.swift          早期 macOS 原型残留，当前无源码
```

## 已知限制

以下是系统层面的边界，不是实现缺陷：

- DNS 过滤看不到 HTTPS 响应正文，因此**无法移除与正文同域名的第一方信息流广告、离线广告、服务端注入的视频广告，以及 App 内"摇一摇"跳转**。
- iOS 未持有 Network Extension entitlement，所以无法为其他 App 做 DNS 过滤，能力止于 Safari。
- `vitest` 只覆盖 JS 引擎层；原生模块与扩展需真机构建验证，待办清单见 `AdShield-iOSTest/todo.md`。

## 下载

APK / IPA 直接放在仓库根目录（未走 Releases）：Android 下载 `AdShield-v1.0.1-android.apk` 安装即可；iOS 的 `.ipa` 因不含企业签名，需用自己的 Apple 账号重签后侧载。

## 许可

暂未添加许可证文件，默认保留所有权利。
