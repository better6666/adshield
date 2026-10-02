# AdShield · Mobile ad & popup blocker

[简体中文](README.md) | **English**

Ad and popup blocking for iOS and Android. The rule engine runs entirely on-device — no browsing data leaves the phone.

**Android has the full feature set**: per-app domain filtering built on `VpnService`, with independent on/off control for each app.
**iOS is limited by the platform**: it can only block ads and popups inside Safari (Safari Content Blocker extension), plus an optional system-wide DNS filtering configuration profile.

## Platform capabilities

| Capability | Android | iOS |
| --- | --- | --- |
| Coverage | DNS query filtering, selectable per app | Safari only (in-app web views are out of reach) |
| Mechanism | `VpnService` + local DNS resolution and rule matching | `SFContentBlockerManager` + rules shared through an App Group |
| Granularity | Per-app toggles, whitelist | Global rule groups, domain whitelist |
| System-wide fallback | — | AdGuard DNS profile in `profiles/` |
| TLS man-in-the-middle | Not used | Not used |

## Features

- Four rule groups: `ads` (ad networks), `trackers` (tracking domains), `popups` (popup / redirect pages), `appAds` (ad domains used by Chinese apps)
- Block activity log: shows which domains were filtered and which rule matched
- Whitelist with subdomain-level allowances; whitelist entries take precedence over block rules
- App selection and safety tiers (Android): per-app protection strength, including pause and circuit-breaker policies
- Selectable DNS upstreams: AdGuard Default / Unfiltered, AliDNS, DNSPod DoH, Quad9, Cloudflare DoH
- All settings persist locally via AsyncStorage, and rules are re-synced on cold start according to the current switch state

> The app UI itself is Chinese-only — there is no i18n layer yet. This document describes the features in English; it does not mean the interface language is switchable.

## Tech stack

Expo SDK 54 · React Native 0.81 · React 19 · TypeScript 5.9 · pnpm · Expo Router · NativeWind

Native code:

- `modules/adshield-vpn` — Kotlin; `VpnService` that forwards DNS traffic and resolves it locally
- `modules/adshield-safari` — Swift; Safari Content Blocker extension reading dynamic rules from App Group `group.com.appshieldmobile`
- `modules/adshield-dns` — Swift; bridge for iOS system DNS configuration

## Getting started

```bash
cd AdShield-iOSTest
pnpm install

pnpm test          # rule engine unit tests
pnpm check         # tsc --noEmit
pnpm dev           # Expo dev server (scan the QR code with Expo Go on Android)
pnpm android       # build and install to an Android device or emulator
```

The iOS Safari extension is not part of Expo Go, so it needs a native build. Put your own Apple Team in `app.config.ts` and in the Xcode project's Development Team first:

```bash
ADSHIELD_ENABLE_IOS_TARGETS=1 npx expo run:ios
```

After installing, enable the extension once by hand: **Settings → Apps → Safari → Extensions → AdShield Safari 防护 → All Websites**. The extension is registered under its Chinese display name `AdShield Safari 防护`, so look for that entry. The in-app settings screen reports the extension's real enabled state (iOS 15.4+) and can deep-link to that pane.

Full run and verification notes: [`AdShield-iOSTest/RUNNING.md`](AdShield-iOSTest/RUNNING.md) (Chinese).

## Repository layout

```
├── AdShield-iOSTest/          Expo app (the main project)
│   ├── app/                   Expo Router screens: rules, app picker, activity, safety, settings
│   ├── modules/               native modules: vpn / safari / dns
│   ├── targets/               Safari extension target
│   ├── profiles/              optional system-wide DNS profiles (.mobileconfig)
│   ├── lib/                   rule engine, DNS upstreams, safety policy, state context
│   └── tests/                 vitest suites
├── ANDROID_IMPLEMENTATION.md        Android implementation log (Chinese)
├── ANDROID_ADVANCED_FILTERING.md    per-app filtering design (Chinese)
├── MIHOMO_INTEGRATION_PLAN.md       planned mihomo integration (not implemented)
├── AdShield-v1.0.1-android.apk      Android package
├── AdShield-v1.0.1-ios.ipa          iOS build (requires your own signing to sideload)
└── Sources/, Package.swift          leftovers from an early macOS prototype, currently empty
```

## Known limitations

These are platform boundaries, not implementation defects:

- DNS filtering cannot see HTTPS response bodies, so it **cannot remove first-party feed ads served from the same domain as the content, offline ads, server-inserted video ads, or "shake to jump" in-app redirects**.
- Without a Network Extension entitlement, iOS filtering cannot cover other apps — it stops at Safari.
- `vitest` covers the JavaScript engine layer only; native modules and the extension need on-device build verification. Outstanding items are listed in `AdShield-iOSTest/todo.md` (Chinese).

## Downloads

APK and IPA live in the repository root rather than in Releases. On Android, download `AdShield-v1.0.1-android.apk` and install it. The iOS `.ipa` ships without enterprise signing, so re-sign it with your own Apple account to sideload.

## License

No license file yet — all rights reserved by default.
