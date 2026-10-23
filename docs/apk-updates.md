# Android APK updates

The updater is independent of the POS store. Launch/resume checks are asynchronous, time out after eight seconds, and are throttled to six hours per process (manual checks bypass the throttle). It prompts on More/Settings only with an empty cart. More contains a manual check button. Declined updates remain dismissed for the session. A mandatory release displays its reason but does not lock offline trading: no business operation has been identified that can safely require a remote update. Downloads can continue while the user works; installation requires finishing or parking the cart. No business database schema changes are included.

## Configuration and builds

1. Apply `supabase/migrations/20261023000000_app_releases.sql` using your authorized migration workflow. Anon/authenticated clients can SELECT published rows only; no mobile writes are granted. Never place a secret/service-role key in any `EXPO_PUBLIC_*` variable.
2. Set the two public values in `.env.updates.example` in the EAS production environment. For a development build set them in `.env.local`. An unconfigured server leaves the app usable and manual checks show a retryable message.
3. Build with `npx eas-cli@latest build --platform android --profile apk-release`. This inherits production signing and remote auto-increment, and explicitly produces an APK. Keep `com.jesar.tindahanhelper` and the existing EAS Android keystore. Inspect the signing certificate of the current distributed APK and proposed APK with `apksigner verify --print-certs`; they MUST match. Do not rotate credentials or uninstall the user's old app to work around a mismatch.
4. Native Android directories are generated/ignored. The local Expo module under `modules/apk-updater` autolinks and merges its permission and narrow FileProvider through its library manifest. Do not edit generated `android/`. Rebuild a native binary to include it; Expo Go cannot install APKs. Existing APKs without this updater need a one-time manually installed signed upgrade.

## Safe publication

Build a universal release APK using the existing certificate. Extract the actual application ID, version name, version code, minimum SDK, and ABI support using Android SDK tools; do not infer the installed code from package.json (EAS uses remote codes). Test over-installation and data preservation before publication. Upload the immutable APK as a public asset under `dleiszarjeisalther/startup-tindahan-helper` GitHub Releases. Download the uploaded asset again and compute its SHA-256 over file bytes (`Get-FileHash -Algorithm SHA256`) and byte length. Create a DRAFT metadata row with those verified values. Only then set status to `published` with `published_at`. Each version code is unique and must exceed all previously distributed codes. Never overwrite assets for an existing published version. Withdraw a bad release by setting status to `withdrawn`; clients already holding a verified download are not remotely locked out.

Required fields: version_code, version_name, apk_url, sha256 (64 lowercase hex characters), size_bytes, release_notes, mandatory (default false), mandatory_reason (required when true), status, published_at. Metadata URLs must be HTTPS GitHub Release assets in the specified repository. HTTPS redirects are restricted to GitHub's asset hosts. Private GitHub assets are unsupported; no GitHub token is shipped.

## Device behavior and recovery

The module writes only cache/apk-updates/download.part and verified.apk. It bounds file size to the published size (maximum 1 GiB), checks free space, streams SHA-256 from disk, rejects different package/version/certificate or unsupported minimum SDK, and verifies again before install. It does not load the whole APK into JavaScript memory. Partial failures remove updater files; retry restarts the download. A fresh process cleans stale updater files. APK files stay available while the system installer may be reading them. No storage permission is needed. Android's installer makes the final compatibility/signature decision and asks for user confirmation; the app never treats opening the installer as successful installation. If the installer is cancelled or rejects an ABI, the app remains usable and the user can retry. On the next launch the installed version determines success.

Android 8+ may require “Allow from this source.” The app opens that settings page, then requires a second explicit Install tap on return. Denial does not block the store. Older Android versions use their system installer/security controls. FileProvider grants temporary read access only to the updater cache path.

## Verification / release gate

Run `node --test scripts/test-app-updates.cjs`, `npx tsc --noEmit`, and `npx expo lint`. Resolve the local module with `npx expo-modules-autolinking resolve --platform android` and compile a fresh native APK. Unit tests exercise production domain/service code but cannot prove Android installation or RLS enforcement.

Before publishing, on real supported Android devices:

- Install signed version N, create products, cart/held sale, sales, Utang, cash movements and settings; record data counts/balances and backup.
- Offline cold boot and foreground transitions must keep POS/scanning/inventory/receipts/cash drawer usable. Simulate unreachable Supabase and GitHub.
- Test no row, draft/withdrawn/future row, equal/older version, malformed URL/hash, newer version and mandatory reason. Verify anonymous SELECT cannot see nonpublished rows and INSERT/UPDATE/DELETE fail.
- Start a sale during a download: no prompt interrupts it and installation is unavailable until it is finished/parked. Deny unknown-source permission, return, allow it, and explicitly retry.
- Interrupt network, exhaust storage, tamper APK bytes/hash, supply different package/signature/version/minSdk, and cancel installer. No false success, no data loss, retry remains possible.
- Install N+1 over N with the SAME certificate. Relaunch and compare all saved counts/balances/settings, resume held sales, and exercise checkout/scanner/inventory/returns/cash drawer. Test the oldest supported Android version and Android 13+.

This repository change does not publish Supabase metadata, change EAS credentials, upload a GitHub release, or claim physical-device verification. Those release gates require the actual signed artifacts and target device.
