# AdShield 全局 DNS 过滤

`AdShield-AdGuard-DNS.mobileconfig` 使用 AdGuard 公共 DNS-over-HTTPS：

- 过滤范围：Safari 和多数 App 使用的第三方广告、跟踪域名。
- 不保证过滤：与正文共用域名的广告、离线广告、服务端直接插入的视频/信息流、App 内“摇一摇”逻辑。
- 隐私影响：DNS 查询会发送给 AdGuard DNS，而不是当前网络的默认 DNS。
- 卸载：iPhone“设置 → 通用 → VPN 与设备管理 → AdShield 全局广告过滤 → 移除描述文件”。
