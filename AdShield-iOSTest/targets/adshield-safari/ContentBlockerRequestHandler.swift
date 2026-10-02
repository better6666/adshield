import Foundation

final class ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {
  // 必须与主 App 侧 AdShieldBlockerModule 中的常量保持一致。
  private static let appGroupIdentifier = "group.com.app.adshieldmobile"
  private static let sharedRulesFileName = "blocker_rules.json"

  func beginRequest(with context: NSExtensionContext) {
    guard let rulesURL = Self.resolveRulesURL(),
          let attachment = try? NSItemProvider(contentsOf: rulesURL) else {
      context.cancelRequest(withError: NSError(
        domain: "AdShieldSafari", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "No usable content blocker rules were found"]))
      return
    }

    let item = NSExtensionItem()
    item.attachments = [attachment]
    context.completeRequest(returningItems: [item], completionHandler: nil)
  }

  /// 优先使用主 App 同步到 App Group 的动态规则（包括规则为空的情形：防护关闭时就应该不拦截）；
  /// 只有从未同步过时才回退到随扩展打包的静态规则。
  private static func resolveRulesURL() -> URL? {
    if let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) {
      let sharedURL = container.appendingPathComponent(sharedRulesFileName)
      if FileManager.default.fileExists(atPath: sharedURL.path) {
        return sharedURL
      }
    }
    return Bundle.main.url(forResource: "BlockerList", withExtension: "json")
  }
}
