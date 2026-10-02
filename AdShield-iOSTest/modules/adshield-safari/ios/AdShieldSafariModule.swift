import ExpoModulesCore
import SafariServices
import UIKit

public class AdShieldSafariModule: Module {
  // Must match the App Group configured in entitlements
  private static let appGroupId = "group.com.app.adshieldmobile"
  // Must match the Content Blocker extension bundle identifier
  private static let extensionBundleId = "com.app.adshieldmobile.safari"
  // Filename for the shared blocker rules
  private static let sharedRulesFilename = "blocker_rules.json"

  public func definition() -> ModuleDefinition {
    Name("AdShieldSafari")

    AsyncFunction("updateBlockerRulesAsync") { (rulesJSON: String, promise: Promise) in
      guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: AdShieldSafariModule.appGroupId
      ) else {
        promise.reject("E_NO_APP_GROUP", "App Group '\(AdShieldSafariModule.appGroupId)' is not configured. Check entitlements.")
        return
      }

      let fileURL = containerURL.appendingPathComponent(AdShieldSafariModule.sharedRulesFilename)

      // Validate JSON before writing
      guard let jsonData = rulesJSON.data(using: .utf8),
            let rules = try? JSONSerialization.jsonObject(with: jsonData) as? [[String: Any]] else {
        promise.reject("E_INVALID_JSON", "The rules JSON is not a valid array of rule objects.")
        return
      }

      let ruleCount = rules.count

      do {
        try jsonData.write(to: fileURL, options: .atomic)
      } catch {
        promise.reject("E_WRITE_FAILED", "Failed to write rules to App Group container: \(error.localizedDescription)")
        return
      }

      // Notify Safari to reload the content blocker rules
      SFContentBlockerManager.reloadContentBlocker(
        withIdentifier: AdShieldSafariModule.extensionBundleId
      ) { error in
        if let error = error {
          // The extension might not be enabled by the user yet — this is not fatal.
          // The rules are already written and will take effect once enabled.
          print("[AdShield] Content blocker reload warning: \(error.localizedDescription)")
        }
        promise.resolve(ruleCount)
      }
    }

    AsyncFunction("isAvailableAsync") { (promise: Promise) in
      #if os(iOS)
      promise.resolve(true)
      #else
      promise.resolve(false)
      #endif
    }

    AsyncFunction("getCurrentRuleCountAsync") { (promise: Promise) in
      guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: AdShieldSafariModule.appGroupId
      ) else {
        promise.resolve(0)
        return
      }

      let fileURL = containerURL.appendingPathComponent(AdShieldSafariModule.sharedRulesFilename)

      guard let data = try? Data(contentsOf: fileURL),
            let rules = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
        promise.resolve(0)
        return
      }

      promise.resolve(rules.count)
    }

    // 查询扩展在系统设置里的真实启用状态（iOS 10.0+ 提供）。
    AsyncFunction("getExtensionStateAsync") { (promise: Promise) in
      if #available(iOS 10.0, *) {
        SFContentBlockerManager.getStateOfContentBlocker(
          withIdentifier: AdShieldSafariModule.extensionBundleId
        ) { state, error in
          if let state {
            promise.resolve([
              "available": true,
              "enabled": state.isEnabled,
              "error": NSNull(),
            ])
          } else {
            promise.resolve([
              "available": false,
              "enabled": false,
              "error": error?.localizedDescription ?? "未找到内容拦截扩展",
            ])
          }
        }
      } else {
        promise.resolve([
          "available": false,
          "enabled": false,
          "error": "查询扩展状态需要 iOS 10.0 及以上",
        ])
      }
    }

    // 系统没有公开直达 Safari 扩展设置的 API；先尝试 Prefs scheme，失败时退回本 App 的设置页。
    AsyncFunction("openSafariExtensionSettingsAsync") { (promise: Promise) in
      DispatchQueue.main.async {
        func fallbackToAppSettings() {
          guard let url = URL(string: UIApplication.openSettingsURLString) else {
            promise.resolve(false)
            return
          }
          UIApplication.shared.open(url) { opened in
            promise.resolve(opened)
          }
        }

        if let url = URL(string: "App-Prefs:SAFARI&path=WEB_EXTENSIONS") {
          UIApplication.shared.open(url) { opened in
            if opened {
              promise.resolve(true)
            } else {
              fallbackToAppSettings()
            }
          }
        } else {
          fallbackToAppSettings()
        }
      }
    }

  }
}
