require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'AdShieldDnsBridge'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'AdShield'
  s.homepage       = 'https://localhost.invalid/adshield'
  # 部署目标与主工程一致（15.1）。iOS 26.0 才有的 allowFailover 在 Swift 侧用
  # #available 守护，低版本系统上静默跳过，不会编译失败。
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
