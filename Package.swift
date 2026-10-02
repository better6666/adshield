// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "AdShield", platforms: [.macOS(.v13)], products: [.executable(name: "AdShield", targets: ["AdShield"])], targets: [.executableTarget(name: "AdShield", path: "Sources/AdShield")])
