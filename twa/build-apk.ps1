<#
.SYNOPSIS
  CampusFlow Android TWA APK & AAB Build Automation Script
.DESCRIPTION
  This script uses Google's official Bubblewrap CLI to package the CampusFlow PWA
  (https://143campusflow.vercel.app) into:
  - CampusFlow-debug.apk (for testing/sideloading)
  - CampusFlow-release.apk (signed standalone package)
  - CampusFlow-release.aab (Android App Bundle for Google Play Console)
#>

param(
  [string]$AppUrl = $(if ($env:NEXT_PUBLIC_APP_URL) { $env:NEXT_PUBLIC_APP_URL } else { "https://143campusflow.vercel.app" }),
  [switch]$DebugOnly,
  [string]$KeyPassword,
  [string]$StorePassword
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CampusFlow Android Trusted Web Activity (TWA) Builder   " -ForegroundColor Cyan
Write-Host "   Domain: $AppUrl                                         " -ForegroundColor Cyan
Write-Host "   Package: com.campusflow.app                             " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Prerequisites
Write-Host "`n[1/6] Checking Environment Prerequisites..." -ForegroundColor Yellow

# Ensure JAVA_HOME and tools are in PATH
if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin"))) {
  $javaBin = (Join-Path $env:JAVA_HOME "bin").TrimEnd('\')
  if ($env:PATH -notlike "*$javaBin*") {
    $env:PATH = "$javaBin;$env:PATH"
  }
}

# Java check
try {
  $javaOut = cmd.exe /c "java -version 2>&1"
  if ($LASTEXITCODE -eq 0 -and $javaOut.Count -gt 0) {
    Write-Host "  [OK] Java detected: $($javaOut[0])" -ForegroundColor Green
  } else {
    throw "Java command returned code $LASTEXITCODE"
  }
} catch {
  Write-Error "Java JDK 17+ is required but not found in PATH. Please install OpenJDK 17 and configure JAVA_HOME."
  exit 1
}

# Node.js check
try {
  $nodeVer = node -v
  Write-Host "  [OK] Node.js detected: $nodeVer" -ForegroundColor Green
} catch {
  Write-Error "Node.js is required but not found in PATH."
  exit 1
}

# 2. Check or install Bubblewrap CLI
Write-Host "`n[2/6] Verifying Bubblewrap CLI..." -ForegroundColor Yellow
$bubblewrapInstalled = $null
try {
  $bubblewrapInstalled = Get-Command bubblewrap -ErrorAction SilentlyContinue
} catch {}

if (-not $bubblewrapInstalled) {
  Write-Host "  Bubblewrap not installed globally. Attempting local installation..." -ForegroundColor Yellow
  npm install -g @bubblewrap/cli
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Global install failed. You can install it on a drive with free space or run via npx."
  }
} else {
  Write-Host "  [OK] Bubblewrap CLI available." -ForegroundColor Green
}

# 3. Prepare Keystore
Write-Host "`n[3/6] Setting up Android Signing Keystore..." -ForegroundColor Yellow
$keystorePath = Join-Path $PSScriptRoot "campusflow-release.keystore"
$alias = "campusflow"

if (-not (Test-Path $keystorePath)) {
  Write-Host "  No keystore found at '$keystorePath'." -ForegroundColor Yellow
  Write-Host "  Generating a new signing keystore for testing..." -ForegroundColor Yellow
  
  $defaultPw = if ($KeyPassword) { $KeyPassword } else { "campusflow2026" }
  keytool -genkey -v -keystore $keystorePath -alias $alias -keyalg RSA -keysize 2048 -validity 10000 `
    -dname "CN=CampusFlow, OU=Engineering, O=CampusFlow, L=Bhagalpur, ST=Bihar, C=IN" `
    -storepass $defaultPw -keypass $defaultPw

  Write-Host "  [OK] Keystore created: $keystorePath" -ForegroundColor Green
  Write-Host "  Password: $defaultPw" -ForegroundColor Green
} else {
  Write-Host "  [OK] Using existing keystore: $keystorePath" -ForegroundColor Green
}

# 4. Extract and Display SHA-256 Fingerprint for Digital Asset Links
Write-Host "`n[4/6] Extracting SHA-256 Certificate Fingerprint..." -ForegroundColor Yellow
$pw = if ($StorePassword) { $StorePassword } else { "campusflow2026" }
$certInfo = keytool -list -v -keystore $keystorePath -alias $alias -storepass $pw 2>&1 | Out-String

$sha256Match = [regex]::Match($certInfo, "SHA256:\s*([A-F0-9:]{95})")
if ($sha256Match.Success) {
  $sha256 = $sha256Match.Groups[1].Value.Trim()
  Write-Host "==========================================================" -ForegroundColor Magenta
  Write-Host "  SHA-256 Fingerprint for Digital Asset Links:" -ForegroundColor Magenta
  Write-Host "  $sha256" -ForegroundColor Green
  Write-Host "  Ensure this matches /.well-known/assetlinks.json" -ForegroundColor Magenta
  Write-Host "==========================================================" -ForegroundColor Magenta
}

# 5. Build TWA Application
Write-Host "`n[5/6] Building Android APK & AAB..." -ForegroundColor Yellow
Push-Location $PSScriptRoot
try {
  # Set environment passwords for non-interactive Bubblewrap signing
  $env:BUBBLEWRAP_KEYSTORE_PASSWORD = $pw
  $env:BUBBLEWRAP_KEY_PASSWORD = $pw
  if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = "D:\gradle-cache" }
  if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "D:\AndroidSDK" }
  if (-not $env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT = "D:\AndroidSDK" }

  bubblewrap build --skipPwaValidation
  Write-Host "  [OK] Bubblewrap release build finished successfully." -ForegroundColor Green

  # Build debug APK for direct testing / sideloading
  $debugOutput = Join-Path $PSScriptRoot "app\build\outputs\apk\debug\app-debug.apk"
  $debugDest = Join-Path $PSScriptRoot "app-debug.apk"
  Write-Host "  Building debug APK via Gradle wrapper..." -ForegroundColor Yellow
  & .\gradlew.bat assembleDebug
  if (Test-Path $debugOutput) {
    Copy-Item -Path $debugOutput -Destination $debugDest -Force
    Write-Host "  [OK] Debug APK generated: $debugDest" -ForegroundColor Green
  }
} catch {
  Write-Warning "Bubblewrap build encountered an issue: $_"
  Write-Host "Run manually in '$PSScriptRoot' using: bubblewrap build" -ForegroundColor Cyan
} finally {
  Pop-Location
}

# 6. Output Artifacts Summary
Write-Host "`n[6/6] Build Artifacts Summary:" -ForegroundColor Yellow
$artifacts = @(
  @{ Name = "CampusFlow-debug.apk"; Path = Join-Path $PSScriptRoot "app-debug.apk" },
  @{ Name = "CampusFlow-release.apk"; Path = Join-Path $PSScriptRoot "app-release-signed.apk" },
  @{ Name = "CampusFlow-release.aab"; Path = Join-Path $PSScriptRoot "app-release-bundle.aab" }
)

$allExist = $true
foreach ($art in $artifacts) {
  if (Test-Path $art.Path) {
    $item = Get-Item $art.Path
    $sizeMB = [math]::round($item.Length / 1MB, 2)
    Write-Host "  [EXISTS] $($art.Name) ($sizeMB MB, $($item.Length) bytes) -> $($art.Path)" -ForegroundColor Green
  } else {
    Write-Host "  [MISSING] $($art.Name) was not generated at: $($art.Path)" -ForegroundColor Red
    $allExist = $false
  }
}

if (-not $allExist) {
  Write-Error "One or more target artifacts were not generated."
}

Write-Host "`nProcess complete." -ForegroundColor Cyan
