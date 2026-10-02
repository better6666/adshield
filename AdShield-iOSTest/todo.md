# Project TODO

- [x] Android 优先的广告拦截移动应用基础界面
- [x] 防护首页：保护状态、一键启停、拦截统计
- [x] 规则中心：广告、跟踪器、弹窗、页面净化分组开关
- [x] 白名单：域名新增、删除和本地持久化
- [x] 拦截记录：最近记录展示与清空
- [x] 设置页：启动时自动保护、通知提示和关于信息
- [x] 自定义 AdShield 品牌图标并更新 app.config.ts
- [x] 使用 AsyncStorage 持久化本地设置和白名单
- [x] 添加 Android VpnService 原生模块，实现 DNS-only 系统级域名拦截
- [x] 添加单元测试，覆盖规则匹配、白名单优先级和状态切换
- [x] 构建检查并整理 Android 运行说明
- [x] 修复灵动岛/刘海屏顶部安全区与手机竖屏响应式布局
- [x] 设计 Android 本地 VPN/DNS 域名拦截与用户授权流程
- [x] 增加应用内广告、推广 SDK 与可疑跳转的规则分组
- [x] 增加应用级防护开关与已拦截应用请求的统计展示
- [x] 增加“摇一摇”诱导广告的风险说明与防护提示
- [x] 增加 iOS 与 Android 的能力边界说明
- [x] 完成 Android VPN 的 DNS 转发、规则命中与前台服务生命周期实现
- [ ] 在配置 Android SDK 的原生环境中编译并真机验证 VPN 授权桥接

- [x] 实现 Android VPN TUN 接口与安全启动/停止流程
- [x] 实现 DNS 查询转发、广告域名命中和拦截计数
- [x] 将原生 VPN 状态与移动端开关、记录页面连接
- [x] 建立 iOS Safari 内容拦截器基础资源与配置
- [ ] 在可用原生工具链中完成 Android/iOS 构建验收
- [ ] 完成 Android 与 iOS 安装包发布前的签名和构建配置核查
- [ ] 配置 Apple Team ID 并验证 Safari 内容拦截扩展签名
- [ ] 通过发布构建生成 Android 与 iOS 可安装版本
- [x] 隔离 iOS Team ID 依赖并完成 Android 发布配置复核
- [ ] 生成 Android 安装包构建入口并真机验证 VPN 基础流程
- [x] 分析 Android EAS Run gradlew 阶段的具体错误日志
- [x] 修复 Android VPN 原生模块导致的 Gradle/Kotlin 构建错误
- [ ] 重新验证 Android 发布构建并确认可生成 APK
- [x] 获取第二次 Android EAS Run gradlew 完整日志并按首个编译错误修复
- [x] 在本地安装 Android SDK 并运行 Gradle 获取真实 EAS 构建错误
- [x] 按本地 Gradle 编译结果修复并验证 Android APK 构建
- [x] 从 Android-only 构建配置中隔离 Apple Targets 插件和 iOS Safari 扩展声明
- [x] 验证 Android 发布不再触发 Apple Developer Portal 登录
- [x] 实现 Android 无障碍服务，检测“摇一摇”“扭转手机”“跳过广告”等广告界面文本
- [x] 实现用户可控风险遮罩与跳过按钮辅助，禁止后台静默自动操作
- [x] 增加无障碍授权入口、状态展示和关闭控制
- [ ] 以抖音等摇一摇广告真机页面验证检测与辅助效果
- [x] 移除“可通用拦截 App 内广告”的过度表述
- [ ] 增加微信小程序广告的文字检测关键词与网络规则分类
- [x] 将无障碍广告辅助限制为微信应用范围（com.tencent.mm）
- [x] 更新微信小程序广告的覆盖边界和真机测试清单
- [x] 修复 Manus 预览错误显示 Expo/Metro 原始配置而非应用界面
- [x] 恢复 iOS Safari 内容拦截扩展与 iPhone 测试版配置
- [ ] 核对 Apple Team ID 与 iOS 签名后生成可安装测试版本
- [ ] 检查连接的 Mac、Xcode 与 iPhone，并通过个人团队安装临时 iOS 测试版

- [x] 实现 Safari 规则动态生成（buildBlockerRules：开关分组 + 白名单 ignore 优先 + popup 全局拦截）
- [x] 配置 App Group（group.com.app.adshieldmobile）打通主 App 与 Safari 扩展，prebuild 插件同步
- [x] AdShieldSafariModule：写入共享规则 + reloadContentBlocker + 查询扩展真实启用状态 + 跳转设置
- [x] 扩展端优先读取 App Group 动态规则，未同步时回退静态 BlockerList.json；空规则不回退
- [x] 设置变更（总开关/分组/白名单）自动同步 Safari；前台返回时刷新扩展状态
- [x] 设置页 Safari 卡片显示扩展真实状态、一键跳转系统设置、手动重同步
- [x] 真机验证：Xcode 签名构建后确认 App Group 生效、扩展可启用、规则可同步

- [x] 完善：首页 iOS 卡片显示真实同步规则数，扩展未启用时显示警告横幅并可一键跳转系统设置
- [x] 完善：静态 BlockerList.json 由引擎默认输出重新生成，与动态默认规则完全一致（含 popup 全局拦截）
- [x] 完善：RUNNING.md 补充 iOS 构建命令、App Group 说明、扩展启用步骤与规则同步链路
- [x] 修复：首页缺少 Pressable 导入导致 tsc 报错

- [x] 真机安装：Release 构建安装到 iPhone 14 Pro（iOS 26.6.2，UDID 00008120-001E69DA2147401E）并成功启动
- [x] 修复：Xcode 用户脚本沙箱（ENABLE_USER_SCRIPT_SANDBOXING=YES）导致 main.jsbundle 写入 EPERM，两个配置均改为 NO
- [x] 修复：Safari 内容拦截规则含正则 alternation（`|`）导致编译失败 WKErrorDomain error 6，改为每个域名独立规则
- [x] 修复：白名单 action 用了不存在的 "ignore"，改为合法的 "ignore-previous-rules"
- [x] 修复：静态 BlockerList.json 同样是含 alternation 的旧格式，已由修好的引擎重新生成（150 条，本地 WebKit 编译通过）
- [x] 修复：防护首页与 apps 页无限转圈——loading 初始为 true 但加载 effect 在 iOS 提前 return，永不置 false
- [x] 修复：关闭防护时写入空规则列表 `[]`，内容拦截器拒绝编译导致 reload 报 WKError 6，改用永远不匹配的占位规则
- [x] 修复：关闭防护时冷启动不同步规则，扩展会沿用上一次的拦截规则，改为冷启动按当前开关状态同步
- [x] 真机验证：开启态写 150 条规则、读回一致、reload 无错误；关闭态写 1 条占位规则、reload 无错误
- [ ] 用户在 iOS 设置 → App → Safari → 扩展 中启用"AdShield Safari 防护"（一次性手动操作，无法自动化）

## 5+1 分层拦截架构（2026-09-21）

- [x] 可行性验证：NEURLFilter 在 iOS 26 SDK 真实编译通过（`/tmp/neurlfilter-probe/probe.swift`，exit 0）
- [x] 结论：NEURLFilter 是真实 API 但不可交付——`verdictForURL` 对非 Apple 网络框架只是"自愿"调用，`setConfiguration` 要求自建 PIR 服务器 + Privacy Pass 颁发方，且 tbd 里 `NEURLFilterManagerPrivate`/`enableConfig(_:serviceID:)`/`isFromMDM`/`isFromProfile` 说明它被服务注册/MDM 门槛把着；SDK 里查不到 entitlement 字符串
- [x] 结论：NEDNSSettingsManager 是公开 API（iOS 14.0+），`matchDomains` 语义天然适合"只对广告域名生效"的安全设计，但**当前 Apple 账号拿不到 Network Extensions 能力**，构建与运行时双重确认（见下）
- [x] 中国 App 规则包：18 个 App 三级规则（🟢安全/🟡均衡/🔴激进）+ 受保护 API 清单 + ~60 个第三方广告 SDK 域名（`lib/adshield-apprules.ts`）
- [x] 安全引擎：关键白名单 / 一键暂停（5 分钟、30 分钟、1 小时、今天结束）/ 熔断自动回滚 / fail-open（`lib/adshield-safety.ts`）
- [x] 加密 DNS 层：Expo 原生模块 + podspec + JS 配置（6 个 DoH/DoT 预设，`matchDomains` 限定广告域名）
- [x] 规则档位接入 Safari 规则生成：safe 档只拦第三方 SDK，balanced/aggressive 才叠加 App 自有广告域名
- [x] 新增"安全"tab：暂停横幅、三档规则卡、18 个 App 规则包展开、DNS 段、安全保证清单
- [x] Podfile 显式声明两个本地 Expo 模块（autolinking 搜索 node_modules，找不到 `modules/` 下的本地模块）
- [x] 为新增逻辑补测试：apprules 12 + safety 20 + dns 10 + engine 18，全套 64 通过 / 1 跳过
- [x] 真机实测探针：无 NetworkExtensions entitlement 时 `NEDNSSettingsManager.loadFromPreferences` 返回 `NEConfigurationErrorDomain Code=10 "permission denied"`，`saveToPreferences` 返回 `NEDNSSettingsErrorDomain Code=3`——API 能编译能调用，但权限被拒
- [x] 撤回 App 的 `com.apple.developer.networking.networkextension` entitlement，构建恢复；prebuild 插件改为 `ADSHIELD_ENABLE_NETWORK_EXTENSION=1` 才写入该 entitlement
- [x] `isAvailableAsync` 改为真机实测（真去 `loadFromPreferences` 一次），把 permission denied 的原因回传 JS
- [x] 安全 tab 在 DNS 不可用时显示说明卡片、禁用开关与预设，不再给用户一个点了没反应的死开关
- [x] 真机复验：撤 entitlement 后 Release 构建成功、安装成功、启动无错误无崩溃（App + Safari 扩展进程均在）
- [x] 模拟器截屏核对"安全"tab 正常态与 DNS 不可用态两种界面，验证后还原全部临时改动
- [ ] 用户在 iOS 设置 → App → Safari → 扩展 中启用"AdShield Safari 防护"（一次性手动操作，无法自动化）
- [ ] 升级付费开发者账号后：设 `ADSHIELD_ENABLE_NETWORK_EXTENSION=1` 重新 prebuild 并签名，即可打开加密 DNS 层
- [ ] NEURLFilter 层需要 Apple 授予 entitlement + 自建 PIR 服务器与 Privacy Pass 颁发方，当前不具备条件


## 功能核查后的问题修复（2026-09-21 下午）

- [x] 查出根因：引擎与规则包各维护一份域名清单，safe 档 62 个第三方广告 SDK 域名只有 37 个真的进了 Safari 规则，百度广告联盟、淘宝广告、AppLovin、Mintegral、Vungle、Chartboost、IronSource、TapJoy、InMobi、Adjust、AppsFlyer、友盟、神策、TalkingData 等 25 个从未被拦
- [x] 修复：`resolveRuleGroups` 成为唯一域名来源，任何档位都把 `THIRD_PARTY_AD_DOMAINS` 并入"广告"组；safe 档覆盖 62/62，生效域名 74 → 100，Safari 规则 150 → 242 条
- [x] 计数统一：首页"拦截域名"、安全 tab"当前档位收录域名"、DNS 的 matchDomains 全部改用 `collectEnabledNetworkDomains`，三处同源；此前首页用 `countEnabledDomains(settings)` 显示 74、安全 tab 用 `collectBlockDomains(tier)` 显示 62
- [x] 修复首页 `buildBlockerRules(settings, whitelist)` 漏传 tier，规则数永远按 safe 档算
- [x] 熔断接上真实触发点：`syncSafariRules` 同步失败即 `registerFailure`、成功即 `registerSuccess`；这是 App 唯一可观测的失败信号（写盘/reload 失败会以 WKError 6 抛出）
- [x] 修复熔断没有恢复路径的缺陷：`circuitBreakerTrippedVersion` 一旦置上永不清除，一次偶发失败会让防护永久停在最小规则集；改为连续成功 `failureThreshold` 次后自动恢复，新增 `consecutiveSuccesses` 字段
- [x] 熔断期间 `syncSafariRules` 退回占位规则而不是继续下发完整规则；安全 tab 新增"规则已自动回退"横幅
- [x] 移除无人调用的 `reportFilterFailure` / `reportFilterSuccess` 导出（全项目零调用者，熔断因此永不触发）
- [x] 修正"同步最新规则"按钮的虚假文案：实际只是本地重写规则，改为"重新生成本机规则"并说明不联网不上传
- [x] 修正档位描述：balanced 与 aggressive 域名集完全相同（都是 102），原描述声称后者追加开屏/信息流等分类；改为如实说明 aggressive 暂不会多拦
- [x] 回归测试：safe 档 Safari 规则必须覆盖 `collectBlockDomains("safe")` 全部域名、报数域名必须真的出现在规则里、balanced 必须扩大范围、熔断自动恢复；74 项测试通过、tsc exit 0
- [x] 真机复验：Release 构建成功、安装成功、App 与 Safari 扩展进程均在运行
- [ ] 规则云 OTA 未实现：本地无服务器，`lib/`、`app/`、`modules/` 除 DNS 预设端点外无任何网络请求代码；要做需先定服务端与签名校验方案
- [ ] 18 个 App 目前只采集到 3 个自有广告域名（微博 2、闲鱼 1），开屏/信息流等分类需真机抓包后才能补充

## 第二轮修复（2026-09-21 深夜，"逐步修复"）

- [x] 元素隐藏选择器防误伤：`[class*='ad-']`/`[id*='ad-']` 裸子串匹配会把 load-bar、read-more、head-nav、thread-head 等无辜类名藏掉（实测 10 个无辜类名误伤 7 个），改为词边界写法 `[class^='ad-'], [class*=' ad-']`；对每个文档生效的规则宁可漏不可误伤
- [x] 计数诚实化：`collectEnabledNetworkDomains` 增加 allowlist 参数，扣除被白名单后缀匹配抵消的域名（关键白名单放行 bcebos.com 后 mobads-pre-config.cdn.bcebos.com 实际拦不住，pstatp.com 同理）；首页、安全 tab、Android VPN 规则、iOS DNS matchDomains 四处全部传入关键白名单+用户白名单
- [x] DNS matchDomains 同样扣除白名单：被放行的域名继续走系统解析器，不被过滤 resolver 误伤
- [x] 白名单变更加入冷启动 Safari 重同步依赖（原来只靠添加/删除入口的 setTimeout 兜底，失败无重试）
- [x] 首页同步按钮按平台区分：iOS"重新生成本机规则"（写 Safari），Android"重新下发拦截规则"（经 context effect 触发 setRulesAsync），文案如实描述两端行为；删除伪装的 getStatusAsync 调用
- [x] 清理死代码（删除前逐一验证零引用，备份在 /tmp/adshield-cleanup-backup/）：Manus 模板层 oauth/callback 路由、hooks/use-auth、lib/trpc、lib/_core/auth+api（含约 57 处 console.log）、server/、drizzle/、shared/、constants/oauth、重复的 lib/adshield-engine.test.ts、4 个无引用组件、adshield-vpn 死 View、Clash 格式无引用的 adblock.txt、theme-provider 调试输出；_layout 移除 tRPC/QueryClient provider；package.json 移除指向 server/ 的脚本；tsconfig 移除 @shared 路径
- [x] 验证：72 项测试通过、tsc exit 0、iOS Release 真机构建安装启动成功、模拟器截图核对界面
- [ ] Android Release APK 构建与真机安装（本机无连接的 Android 设备，交付 APK 文件）
- [ ] 引入公开中文过滤规则源（AdGuard/EasyList China → Safari 规则转换器）：覆盖面从 100 个域名提升到万级，不需要账号与抓包，尚未开始

## Android 首次真机反馈修复（2026-09-25）

- [x] 真机反馈：开启保护显示"需授权"且图标灰色——确认为未授权时的正常初始状态，非故障；但启动流程有真实缺陷
- [x] 修复 startVpn 时序缺陷：`requestSystemPermissionAsync` 在系统 VPN 授权弹窗弹出的瞬间就 resolve（prepared=false），App 立刻弹"权限未授予"误导用户；改为轮询最多 20 秒等用户在系统弹窗点"允许"后自动调 startAsync
- [x] Android 版本号 1.0.0 → 1.0.1（versionCode 2），构建、上传下载站并更新页面校验和，全部经 SHA-256 字节级验证
- [ ] 待真机确认：授权后点开启，服务能正常启动；若提示"请至少选择一个需要保护的应用"，去 apps 标签页至少勾选一个 App

## v1.0.1 双平台发布（2026-09-25 下午）

- [x] iOS 版本号 1.0.0 → 1.0.1（CFBundleVersion 2），与 Android 对齐；Release 构建成功、打包 IPA 上传下载站并 SHA-256 字节级验证
- [x] 排查"iOS 包缺 startVpn 修复串"虚惊：清 Metro 缓存重建后仍缺，最终证实 Expo 按 Platform.OS 裁剪平台分支——iOS 包本就不该含 Android 专属代码，验证方法已记录在 RUNNING.md
- [x] 下载站页面更新为 Android v1.0.1 / iOS v1.0.1，新 IPA 直链与校验和已上线，上传通道再次用后即撤（两域名 PUT 均 405）
- [x] v1.0.1 已安装到 iPhone 并启动成功
- [ ] 待用户确认：Android 授权流程（点开启 → 允许 → 自动启动）；apex 域名 adshield.dpdns.org 待删除占位 A 记录后绑定
