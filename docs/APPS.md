> **6 November 2026:** Version 1.0.5 adds signed Play-format AABs alongside APKs, authenticated native server exports, document import picking and an updated Windows installer. Builds are published from the backup repository so the original Vercel integration stays untouched. Play Console commissioning and the unsigned Windows publisher remain documented in APP-RELEASE.md.

> **21 October 2026:** Version 1.0.4 adds the owner-supplied logo to the Store and Driver Android launchers and Windows executable/installer. It retains the primary-domain launchers, driver-only foreground location permissions and role-aware entry from version 1.0.3. See [APP-RELEASE.md](APP-RELEASE.md) for release scope and commissioning requirements. The version 1.0.1 details below describe the earlier release.

# Web, Android and Windows apps

The web app remains the source of truth. The production deployment is live at https://edgedirect2u.vercel.app with automatic deployments from the original GitHub repository. A second deployment is live at https://maroon-mink-604054.hostingersite.com using source ZIP uploads. Supabase stores shared accounts, products and delivery data. Version 1.0.1 native clients open the verified Vercel origin; the custom edgedirect2u.com origin also remains trusted. Updating the Vercel website updates their shopping and operations screens without another APK/EXE release. Both published APKs have rendered their live pages in the connectivity workflow.

## Administrator access and uploads

1. The live administrator entry is https://edgedirect2u.vercel.app/login. The same account also works at the Hostinger site's `/login`; sessions are separate for each domain.
2. Open `https://edgedirect2u.vercel.app/login`. Sign in as `olasodechukwudi@gmail.com` using the password you registered. That confirmed account already has administrator access and sign-in opens its workspace.
3. Open `/admin/products` and choose **Add record**. Enter the product name; its slug is suggested automatically. Select a category and inventory owner, enter the price in naira, then upload a PNG/JPEG/WebP photo under 5 MB or paste an HTTPS image URL. Complete the description and save the product.
4. Open `/admin/inventory` to receive actual units with a reason. New products have zero stock until received. Keep **Visible in storefront** enabled for approved products.
5. Open `/admin/theme` for branding. Save draft, preview and publish when ready.

Before hosting is deployed, run `npm run dev`, open `http://127.0.0.1:3000/login`, and use the same account; then open `/admin`. Your ignored local environment already points to the connected Supabase project. Raster photo uploads use your authenticated administrator session and existing Storage policies; the service-role key is not required for this upload route. Checkout requires the separately configured server/payment keys.

## Installable browser apps

Visit `/apps` for browser installation and native downloads. Android Chrome/Edge can install from the browser menu. iPhone/iPad Safari uses **Share → Add to Home Screen**. Desktop Chrome/Edge offers **Install app**. The driver manifest starts at `/driver`; driver access always requires its database role and assigned jobs.

A single service worker stores only the generic offline page and public icons. Authenticated HTML, API responses, delivery addresses, orders and mutations are never cached or replayed. Offline screens explain that updates require a connection.

## Android packages

`native/android` produces `com.edgedirect2u.store` and `com.edgedirect2u.driver`. Both target Android API 36 and support Android 8/API 26 or newer. The shells permit internal navigation only to the two explicitly trusted HTTPS origins. Payment links open the browser; verified HTTPS app links return store checkout confirmation to the existing app session. Deploy `/.well-known/assetlinks.json` through the web app before testing that return. Certificates are never bypassed and no native JavaScript bridge is exposed.

Release signing uses four encrypted repository Actions secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. The first release key is backed up locally in ignored `.data/native-signing`; preserve that folder securely to maintain update continuity. Never commit it. Debug builds use separate `.debug` package IDs and are not distributed as releases.

## Windows installer

`native/windows` builds a self-contained .NET 10 Windows x64 app using Microsoft WebView2. Its per-user installer creates Start menu/Desktop shortcuts and installs WebView2 when necessary. It offers Store and Admin navigation, a local browser profile and a reconnect screen. Uninstall removes only the installed application files and shortcuts; it preserves the browser profile and unrelated files in the chosen folder. Store/Paystack navigation stays within the browser engine; other user-selected HTTPS links open the system browser. No native host-object or message bridge is enabled.

No Windows code-signing certificate was provided, so the installer is unsigned. The release page includes SHA-256 checksums. Signed Android installation is available directly; neither app has been submitted to Google Play or Microsoft Store. Device installation and real hosted payment/driver acceptance still need business commissioning.

## Reproducible releases

After a source change, GitHub's **Verify marketplace** workflow checks lint, types, unit/database tests, browser flows, production audit and Hostinger packaging. The **Build installable apps** manual workflow additionally builds and verifies both APK signatures, tests navigation policies, launches the Android clients in an emulator, builds Windows and verifies its WebView2 renderer. A release is published only after all three jobs pass.

Use a new version tag for later releases. Update Android `versionCode`/`versionName`, the Windows project/installer version, and app download URLs before publishing another client release. Web-only changes require just the connected Hostinger deployment. Native builds run on GitHub runners because this machine has no Android SDK and insufficient disk space for that toolchain.
