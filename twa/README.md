# CampusFlow — Multi-Tenant PWA & Android TWA Distribution Guide

This directory contains the production-grade Android Trusted Web Activity (TWA) architecture, Gradle multi-flavor configuration, and automated build scripts for packaging **CampusFlow** and its institution portals (**BCE-BGP** and **GEC-GAYA**) into native Android packages (`.apk` and `.aab`).

---

## 1. Core Terminology & Architectural Concepts

It is crucial to understand the distinct roles of each delivery format:

| Concept | Definition | Primary Distribution Channel | User Experience |
|---|---|---|---|
| **PWA** (Progressive Web App) | Standard web application installed directly through browser capabilities (Chrome, Edge, Safari) using web manifest and service worker. | Browser prompt ("Install App" or "Add to Home screen") | Standalone window, offline-resilient, automatic updates via service worker cache. |
| **TWA** (Trusted Web Activity) | Official Google Android protocol connecting a native Android application package to an authorized HTTPS web origin via Chrome Custom Tabs. | Google Play Store or APK sideload | Native full-screen app icon and window with zero address bar, verified via Digital Asset Links. |
| **APK** (Android Package Kit) | Standalone compiled package containing Dalvik executable code, assets, and Android manifest. | Direct sideloading via `adb install` or website download link | Immediate installation on testing and personal devices without Google Play. |
| **AAB** (Android App Bundle) | Google Play publishing format containing all compiled code and resources, deferred for Google Play Dynamic Delivery. | Google Play Console upload | Google Play generates optimized device-specific APKs (screen density, ABI) for end users. |

---

## 2. Multi-Tenant Application Hierarchy

```text
                           CampusFlow Platform
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
        Main CampusFlow App                  Institution Portals
     (Global Platform & Portal)                       │
                  │                     ┌─────────────┴─────────────┐
                  ▼                     ▼                           ▼
            PWA + TWA/APK            BCE-BGP                     GEC-GAYA
                                   (PWA + APK)                 (PWA + APK)
```

- **Single Codebase**: All experiences run on the identical Next.js application backend. No duplicate source code repositories or separate mobile applications exist.
- **Tenant Isolation**: Routing (`/`, `/bce-bgp`, `/gec-gaya`), branding, events, and forms are strictly scoped by tenant resolution.
- **Gradle Product Flavors**: Android build variants (`mainApp`, `bcebgp`, `gecgaya`) control application IDs, launcher names, launch paths, and provider authorities while sharing Dalvik source code.

---

## 3. Application Specifications by Variant

| Parameter | Main CampusFlow | BCE-BGP Portal | GEC-GAYA Portal |
|---|---|---|---|
| **App Name** | CampusFlow | BCE-BGP CampusFlow | GEC-GAYA CampusFlow |
| **Launcher Name** | CampusFlow | BCE-BGP | GEC-GAYA |
| **Android Application ID** | `com.campusflow.app` | `com.campusflow.bcebgp` | `com.campusflow.gecgaya` |
| **Gradle Flavor** | `mainApp` | `bcebgp` | `gecgaya` |
| **Launch URL** | `/` | `/bce-bgp` | `/gec-gaya` |
| **PWA Manifest Route** | `/manifest.webmanifest` | `/api/manifest/bce-bgp` | `/api/manifest/gec-gaya` |
| **Theme / Status Bar** | `#0B192C` (Navy) | College Primary Brand Color | College Primary Brand Color |
| **FileProvider Authority** | `com.campusflow.app.fileprovider` | `com.campusflow.bcebgp.fileprovider` | `com.campusflow.gecgaya.fileprovider` |

---

## 4. Digital Asset Links (`assetlinks.json`)

To remove the browser URL bar in TWA, Google Chrome cryptographically verifies ownership by fetching `/.well-known/assetlinks.json` from the HTTPS origin.

### Endpoint:
```text
https://<domain>/.well-known/assetlinks.json
```

### Multi-Package Structure:
The endpoint dynamically serves verification statements for all three packages:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.campusflow.app",
      "sha256_cert_fingerprints": [
        "07:2C:C7:8E:6B:6E:2C:0C:DC:CB:B5:C6:E6:01:C9:5B:6A:D6:54:57:47:4A:F7:70:B2:D5:54:42:4A:36:45:E7"
      ]
    }
  },
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.campusflow.bcebgp",
      "sha256_cert_fingerprints": [
        "07:2C:C7:8E:6B:6E:2C:0C:DC:CB:B5:C6:E6:01:C9:5B:6A:D6:54:57:47:4A:F7:70:B2:D5:54:42:4A:36:45:E7"
      ]
    }
  },
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.campusflow.gecgaya",
      "sha256_cert_fingerprints": [
        "07:2C:C7:8E:6B:6E:2C:0C:DC:CB:B5:C6:E6:01:C9:5B:6A:D6:54:57:47:4A:F7:70:B2:D5:54:42:4A:36:45:E7"
      ]
    }
  }
]
```

### Checking Fingerprint:
To view the SHA-256 fingerprint of the release signing keystore:
```powershell
keytool -list -v -keystore ./twa/campusflow-release.keystore -alias campusflow -storepass campusflow2026
```

---

## 5. Automated Build Commands (`build-apk.ps1`)

The build script `twa/build-apk.ps1` supports building individual variants or all variants simultaneously.

### Prerequisites:
- **Java JDK 17+** (with `JAVA_HOME` configured)
- **Node.js 18+**
- **Android SDK** (API 34/36)

### Build Commands:

#### 1. Build Main CampusFlow (APK + AAB)
```powershell
powershell -ExecutionPolicy Bypass -File ./twa/build-apk.ps1 -Tenant main
```
**Artifacts Generated**:
- `CampusFlow-main.apk` (Signed Release APK)
- `CampusFlow-main.aab` (Google Play Store AAB Bundle)
- `CampusFlow-main-debug.apk` (Debug sideload APK)

#### 2. Build BCE-BGP Portal App (APK + AAB)
```powershell
powershell -ExecutionPolicy Bypass -File ./twa/build-apk.ps1 -Tenant bce-bgp
```
**Artifacts Generated**:
- `CampusFlow-BCE-BGP.apk` (Signed Release APK)
- `CampusFlow-BCE-BGP.aab` (Google Play Store AAB Bundle)
- `CampusFlow-bce-bgp-debug.apk` (Debug sideload APK)

#### 3. Build GEC-GAYA Portal App (APK + AAB)
```powershell
powershell -ExecutionPolicy Bypass -File ./twa/build-apk.ps1 -Tenant gec-gaya
```
**Artifacts Generated**:
- `CampusFlow-GEC-GAYA.apk` (Signed Release APK)
- `CampusFlow-GEC-GAYA.aab` (Google Play Store AAB Bundle)
- `CampusFlow-gec-gaya-debug.apk` (Debug sideload APK)

#### 4. Build All Applications in One Run
```powershell
powershell -ExecutionPolicy Bypass -File ./twa/build-apk.ps1 -Tenant all
```
*(Note: `-Variant` is supported as an alias for `-Tenant`)*

---

## 6. Sideload Testing via ADB

1. Enable **Developer Options** and **USB Debugging** on the target Android device.
2. Connect device via USB and verify connection:
   ```bash
   adb devices
   ```
3. Install any package variant:
   ```bash
   adb install -r twa/CampusFlow-main-release.apk
   # or
   adb install -r twa/CampusFlow-bce-bgp-release.apk
   # or
   adb install -r twa/CampusFlow-gec-gaya-release.apk
   ```
4. Verify the launch experience:
   - **BCE-BGP APK**: Opens directly to `/bce-bgp` with BCE branding.
   - **GEC-GAYA APK**: Opens directly to `/gec-gaya` with GEC branding.
   - **Main APK**: Opens directly to `/` root portal.
   - **No URL bar**: Proves Digital Asset Links handshake succeeded.

---

## 7. Production Domain Migration Procedure

When migrating the production origin (e.g. from `143campusflow.vercel.app` to custom domain `campusflow.in`):

### Why Android TWA Cannot Be Purely Domain-Agnostic:
While the Next.js web application is domain-independent (using `APP_URL` and `appUrl()`), **Android TWA and Digital Asset Links are cryptographically bound to an exact HTTPS origin**. An Android app cannot open arbitrary domains in full-screen TWA mode without matched Digital Asset Links.

### Migration Checklist:

1. **Add Custom Domain to Vercel**:
   - Add `campusflow.in` under Vercel Project Settings > Domains.
   - Configure DNS (A/CNAME records) and verify SSL certificate issuance.

2. **Update Application Environment**:
   - In Vercel Project Settings > Environment Variables:
     - Update `NEXT_PUBLIC_APP_URL` to `https://campusflow.in`.

3. **Update Google OAuth Credentials**:
   - Open [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials).
   - In the OAuth 2.0 Client ID:
     - Add `https://campusflow.in` to **Authorized JavaScript origins**.
     - Add `https://campusflow.in/api/google/oauth/callback` to **Authorized redirect URIs**.

4. **Verify Digital Asset Links on New Domain**:
   - Verify `https://campusflow.in/.well-known/assetlinks.json` returns valid JSON with all three package IDs and fingerprints.

5. **Update TWA Host & Rebuild Packages**:
   - In `twa/twa-manifest.json` and `twa/app/build.gradle`:
     - Update `hostName` to `"campusflow.in"`.
   - In `twa/app/src/main/res/values/strings.xml`:
     - Update `assetStatements` site URL to `"https://campusflow.in"`.
   - Re-run the automated build:
     ```powershell
     powershell -ExecutionPolicy Bypass -File ./twa/build-apk.ps1 -Variant all -AppUrl https://campusflow.in
     ```

6. **Submit Updated AABs to Google Play Console**:
   - Increment `versionCode` in `twa/app/build.gradle`.
   - Upload newly generated `.aab` bundles to respective Google Play tracks (Production / Closed Testing).

---

## 8. Google Play Store Publishing Requirements

When releasing on Google Play Console:
1. **Google Play App Signing**: If Play App Signing is enabled, copy the **Play App Signing SHA-256 certificate fingerprint** from Play Console > Setup > App Signing, and add it to `ANDROID_SHA256_FINGERPRINTS` environment variable so assetlinks matches Google's re-signed binary.
2. **Privacy Policy**: Publicly hosted at `https://<domain>/privacy-policy`.
3. **Data Safety**: Disclose that student names, email IDs, and registration numbers are collected for educational event registrations and institutional feedback.
4. **Target API Level**: Target SDK is configured to API 34+ to satisfy current Google Play requirements.
