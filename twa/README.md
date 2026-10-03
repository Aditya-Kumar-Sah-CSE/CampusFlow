# CampusFlow — Android Trusted Web Activity (TWA) Distribution

This directory contains the production-grade Trusted Web Activity (TWA) configuration for packaging the **CampusFlow** Web App into native Android packages (`.apk` and `.aab`).

---

## 1. Architecture Overview

```text
Google Play Store / Direct Sideload (.apk / .aab)
              │
              ▼
Android Trusted Web Activity (TWA Shell)
[Package: com.campusflow.app]
              │
      Domain Verification
   (Digital Asset Links)
              │
              ▼
CampusFlow Progressive Web App (PWA)
https://143campusflow.vercel.app
              │
       Service Worker (v6)
 (App Shell + Offline Public Events)
              │
              ▼
Next.js App Router Backend + Supabase + Google Services
```

- **Single Codebase**: The existing Next.js web application is the single source of truth.
- **Zero Frontend Duplication**: No separate React Native, Flutter, or native Android UI is maintained.
- **Full-Screen Native UX**: Digital Asset Links verification removes the browser URL bar for a 100% native look and feel.
- **Google Sheets Integrity**: Event registrations, payment verifications, and faculty feedback remain directly bound to the canonical backend services.

---

## 2. Package Specifications

| Parameter | Production Value |
|---|---|
| **App Name** | CampusFlow |
| **Package Name / Application ID** | `com.campusflow.app` |
| **Canonical Host** | `143campusflow.vercel.app` |
| **Start URL** | `https://143campusflow.vercel.app/` |
| **Theme / Status Bar Color** | `#0B192C` (Navy) |
| **Navigation Bar Color** | `#0B192C` |
| **Display Mode** | `standalone` |
| **Orientation** | `portrait` |
| **Target SDK** | Android 14+ (API 34) |
| **Minimum SDK** | Android 5.0 (API 21) |

---

## 3. Digital Asset Links Verification

To eliminate the Chrome address bar, Android requires cryptographic proof linking `com.campusflow.app` to `https://143campusflow.vercel.app`.

### Endpoint:
```text
https://143campusflow.vercel.app/.well-known/assetlinks.json
```

### JSON Format:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.campusflow.app",
      "sha256_cert_fingerprints": [
        "14:6D:E9:7F:0F:52:EA:CB:5B:EA:99:9A:00:4E:9E:09:E6:1F:11:F9:DC:27:0B:53:C4:2C:BE:BB:44:8D:88:FB"
      ]
    }
  }
]
```

> **Note on Signing Fingerprints**:
> - Never commit production keystore files or signing credentials to git.
> - When generating a new release keystore via `keytool`, copy its SHA-256 fingerprint into `ANDROID_SHA256_FINGERPRINTS` environment variable on Vercel, or update `public/.well-known/assetlinks.json`.

---

## 4. Prerequisites for Building

1. **Java JDK 17+** (OpenJDK 17 recommended)
   ```bash
   java -version
   ```
2. **Node.js 18+**
   ```bash
   node -v
   ```
3. **Android SDK & Build Tools** (Optional for local compilation; Bubblewrap can download Android command-line tools during first run).
4. **Google Bubblewrap CLI**:
   ```bash
   npm install -g @bubblewrap/cli
   ```

---

## 5. Building the Android Packages

### Automated Build (PowerShell)
From the repository root:
```powershell
powershell -ExecutionPolicy Bypass -File ./twa/build-apk.ps1
```

### Manual Step-by-Step with Bubblewrap

1. **Generate Release Keystore (if not already existing)**:
   ```bash
   keytool -genkey -v -keystore ./twa/campusflow-release.keystore \
     -alias campusflow -keyalg RSA -keysize 2048 -validity 10000 \
     -dname "CN=CampusFlow, OU=Engineering, O=CampusFlow, L=Bhagalpur, ST=Bihar, C=IN"
   ```

2. **Extract Certificate Fingerprint**:
   ```bash
   keytool -list -v -keystore ./twa/campusflow-release.keystore -alias campusflow
   ```
   Look for the `SHA256:` fingerprint line and ensure it is listed in `/.well-known/assetlinks.json`.

3. **Initialize / Validate TWA Manifest**:
   ```bash
   cd twa
   bubblewrap init --manifest=https://143campusflow.vercel.app/manifest.webmanifest
   ```

4. **Build APK and AAB**:
   ```bash
   bubblewrap build
   ```

### Output Files:
- **`app-debug.apk`** (`CampusFlow-debug.apk`): Unsigned/debug build for local device testing via `adb install`.
- **`app-release-signed.apk`** (`CampusFlow-release.apk`): Release APK for direct sideloading or internal distribution.
- **`app-release-bundle.aab`** (`CampusFlow-release.aab`): Android App Bundle required by Google Play Console for official Play Store release.

---

## 6. Sideload Testing on Android Devices

1. Connect Android device with **USB Debugging** enabled.
2. Install the debug APK:
   ```bash
   adb install -r twa/app-debug.apk
   ```
3. Verify the following:
   - App launches directly into `https://143campusflow.vercel.app`.
   - Splash screen transitions smoothly into the dark navy `#0B192C` theme.
   - Status bar matches platform theme color.
   - No browser URL address bar appears (confirms Digital Asset Links verification).
   - Events and public pages load normally.
   - Disconnecting internet allows reading previously visited public event pages.
   - Attempting event registration while offline displays a clear offline block warning with no duplicate records.
