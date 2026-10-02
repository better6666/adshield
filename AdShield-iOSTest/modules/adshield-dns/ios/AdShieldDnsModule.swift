import ExpoModulesCore
import NetworkExtension
import UIKit

public class AdShieldDnsModule: Module {
  // 与主 App 一致的 App Group，用于把最近一次应用的配置落盘，
  // 让 UI 在冷启动后仍能显示"当前 DNS 配置是什么"。
  private static let appGroupId = "group.com.app.adshieldmobile"
  private static let configFilename = "dns_config.json"

  public func definition() -> ModuleDefinition {
    Name("AdShieldDns")

    /// 检测系统级 DNS 配置在本机是否真的可用。
    ///
    /// NEDNSSettingsManager 是公开 API（iOS 14.0+），但它需要 Network Extensions
    /// 能力。没有该能力时 API 依然能编译、能调用，但 loadFromPreferences 会返回
    /// NEConfigurationErrorDomain 权限错误——所以可用性只能用真机实测判定，
    /// 不能靠 #available 判断。
    AsyncFunction("isAvailableAsync") { (promise: Promise) in
      let manager = NEDNSSettingsManager.shared()
      manager.loadFromPreferences { error in
        if let error {
          promise.resolve([
            "available": false,
            "reason": error.localizedDescription,
          ])
          return
        }
        promise.resolve(["available": true, "reason": NSNull()])
      }
    }

    /// 把加密 DNS 配置写入系统 DNS 偏好。
    /// 用户随后需要在 设置 → 通用 → VPN 与网络 → DNS 里手动启用（API 文档明确要求）。
    AsyncFunction("configureAsync") { (options: ConfigureOptions, promise: Promise) in
      let settings: NEDNSSettings
      if options.protocol == "tls" {
        let dotSettings = NEDNSOverTLSSettings(servers: [options.endpoint])
        dotSettings.serverName = options.endpoint
        settings = dotSettings
      } else {
        let dohSettings = NEDNSOverHTTPSSettings(servers: [])
        dohSettings.serverURL = URL(string: options.endpoint)
        settings = dohSettings
      }

      // matchDomains 非空时，这些 DNS 设置只用于解析指定域名。
      // 规则包把广告域名放进 matchDomains，App 自有的登录/支付/地图/下载接口
      // 仍走系统解析器，因此过滤 resolver 故障不可能弄坏任何 App。
      if let matchDomains = options.matchDomains, !matchDomains.isEmpty {
        settings.matchDomains = matchDomains
      }

      // iOS 26.0+：解析失败时回退系统解析器。这是安全引擎 fail-open 的原生落点，
      // 恒开，不给用户关闭；低版本系统上静默跳过。
      if #available(iOS 26.0, *) {
        settings.allowFailover = options.allowFailover
      }

      let manager = NEDNSSettingsManager.shared()
      manager.loadFromPreferences { error in
        if let error {
          // 没有 Network Extensions 能力时走这里（NEConfigurationErrorDomain 权限错误）。
          // 用独立错误码让上层能把它和普通失败区分开，并向用户说明原因。
          promise.reject("E_PERMISSION_DENIED", "当前 Apple 账号没有 Network Extensions 能力，无法写入系统 DNS 设置: \(error.localizedDescription)")
          return
        }
        manager.dnsSettings = settings
        manager.localizedDescription = "AdShield 广告域名过滤 DNS"
        manager.saveToPreferences { saveError in
          if let saveError {
            promise.reject("E_SAVE_FAILED", "保存 DNS 配置失败: \(saveError.localizedDescription)")
            return
          }
          AdShieldDnsModule.persistConfig(options: options)
          // enabled 是只读属性：系统要求用户在设置里手动打开。
          promise.resolve([
            "saved": true,
            "enabled": manager.isEnabled,
          ])
        }
      }
    }

    /// 查询系统里 DNS 配置的真实启用状态。
    AsyncFunction("getStateAsync") { (promise: Promise) in
      let manager = NEDNSSettingsManager.shared()
      manager.loadFromPreferences { error in
        if let error {
          promise.resolve(["available": true, "enabled": false, "error": error.localizedDescription])
          return
        }
        promise.resolve([
          "available": true,
          "enabled": manager.isEnabled,
          "error": NSNull(),
        ])
      }
    }

    /// 移除 DNS 配置，同时等于在系统里关闭它。
    AsyncFunction("disableAsync") { (promise: Promise) in
      let manager = NEDNSSettingsManager.shared()
      manager.loadFromPreferences { _ in
        manager.removeFromPreferences { _ in
          AdShieldDnsModule.clearPersistedConfig()
          promise.resolve(true)
        }
      }
    }

    AsyncFunction("openDnsSettingsAsync") { (promise: Promise) in
      // iOS 没有直达 DNS 设置页的公开 URL scheme，退到本 App 的设置页，
      // 由 UI 引导用户自己去 设置 → 通用 → VPN 与网络 → DNS。
      DispatchQueue.main.async {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
          promise.resolve(false)
          return
        }
        UIApplication.shared.open(url) { opened in
          promise.resolve(opened)
        }
      }
    }
  }

  private static func containerURL() -> URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId)
  }

  private static func persistConfig(options: ConfigureOptions) {
    guard let container = containerURL() else { return }
    let payload: [String: Any] = [
      "protocol": options.protocol,
      "endpoint": options.endpoint,
      "matchDomains": options.matchDomains ?? [],
      "allowFailover": options.allowFailover,
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
    try? data.write(to: container.appendingPathComponent(configFilename), options: .atomic)
  }

  private static func clearPersistedConfig() {
    guard let container = containerURL() else { return }
    try? FileManager.default.removeItem(at: container.appendingPathComponent(configFilename))
  }
}

struct ConfigureOptions: Record {
  // `protocol` 是 Swift 保留字，必须反引号转义；属性名仍是 protocol，JS 侧键名不变。
  var `protocol`: String = "https"
  var endpoint: String = ""
  var matchDomains: [String]? = nil
  var allowFailover: Bool = true
}
