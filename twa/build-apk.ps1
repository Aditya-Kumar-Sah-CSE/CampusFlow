<#
.SYNOPSIS
  CampusFlow Android TWA APK & AAB Multi-Variant Build Automation Script
.DESCRIPTION
  Builds Android APKs (debug/sideload) and AABs (Google Play Store Bundle) for:
  - Main CampusFlow (Variant: main -> com.campusflow.app -> /)
  - BCE-BGP CampusFlow (Variant: bce-bgp -> com.campusflow.bcebgp -> /bce-bgp)
  - GEC-GAYA CampusFlow (Variant: gec-gaya -> com.campusflow.gecgaya -> /gec-gaya)
  - All Variants (Variant: all)
#>

param(
  [Alias("Variant")]
  [ValidateSet("main", "bce-bgp", "gec-gaya", "all")]
  [string]$Tenant = "main",
  [string]$AppUrl = $(if ($env:NEXT_PUBLIC_APP_URL) { $env:NEXT_PUBLIC_APP_URL } else { "https://143campusflow.vercel.app" }),
  [switch]$DebugOnly,
  [string]$KeyPassword,
  [string]$StorePassword
)

$Variant = $Tenant

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   CampusFlow Multi-Variant Android TWA / APK Builder      " -ForegroundColor Cyan
Write-Host "   Target Tenant / Variant: $Tenant                        " -ForegroundColor Cyan
Write-Host "   Production Host: $AppUrl                                " -ForegroundColor Cyan
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

# Ensure Android SDK environment variables
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "D:\AndroidSDK" }
if (-not $env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT = "D:\AndroidSDK" }
if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = "D:\gradle-cache" }

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

# 2. Verify Gradle Wrapper
Write-Host "`n[2/6] Verifying Gradle Build Tooling..." -ForegroundColor Yellow
$gradlewPath = Join-Path $PSScriptRoot "gradlew.bat"
if (-not (Test-Path $gradlewPath)) {
  Write-Error "Gradle wrapper gradlew.bat not found in $PSScriptRoot"
  exit 1
}
Write-Host "  [OK] Gradle wrapper ready." -ForegroundColor Green

# 3. Prepare Keystore
Write-Host "`n[3/6] Setting up Android Signing Keystore..." -ForegroundColor Yellow
$keystorePath = Join-Path $PSScriptRoot "campusflow-release.keystore"
$alias = "campusflow"

$pw = if ($StorePassword) { $StorePassword } elseif ($env:BUBBLEWRAP_KEYSTORE_PASSWORD) { $env:BUBBLEWRAP_KEYSTORE_PASSWORD } else { "campusflow2026" }

if (-not (Test-Path $keystorePath)) {
  Write-Host "  No keystore found at '$keystorePath'." -ForegroundColor Yellow
  Write-Host "  Generating a new signing keystore..." -ForegroundColor Yellow
  
  keytool -genkey -v -keystore $keystorePath -alias $alias -keyalg RSA -keysize 2048 -validity 10000 `
    -dname "CN=CampusFlow, OU=Engineering, O=CampusFlow, L=Bhagalpur, ST=Bihar, C=IN" `
    -storepass $pw -keypass $pw

  Write-Host "  [OK] Keystore created: $keystorePath" -ForegroundColor Green
} else {
  Write-Host "  [OK] Using existing keystore: $keystorePath" -ForegroundColor Green
}

# 4. Extract and Display SHA-256 Fingerprint for Digital Asset Links
Write-Host "`n[4/6] Extracting SHA-256 Certificate Fingerprint..." -ForegroundColor Yellow
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

# 5. Define Variants Configuration
$variantConfigs = @(
  @{
    Slug = "main"
    Flavor = "MainApp"
    FlavorLower = "mainApp"
    PackageId = "com.campusflow.app"
    Name = "CampusFlow"
    LaunchUrl = "/"
  },
  @{
    Slug = "bce-bgp"
    Flavor = "Bcebgp"
    FlavorLower = "bcebgp"
    PackageId = "com.campusflow.bcebgp"
    Name = "BCE-BGP CampusFlow"
    LaunchUrl = "/bce-bgp"
  },
  @{
    Slug = "gec-gaya"
    Flavor = "Gecgaya"
    FlavorLower = "gecgaya"
    PackageId = "com.campusflow.gecgaya"
    Name = "GEC-GAYA CampusFlow"
    LaunchUrl = "/gec-gaya"
  }
)

$targetVariants = if ($Variant -eq "all") {
  $variantConfigs
} else {
  $variantConfigs | Where-Object { $_.Slug -eq $Variant }
}

if (-not $targetVariants -or $targetVariants.Count -eq 0) {
  Write-Error "Unknown variant: $Variant. Supported variants: main, bce-bgp, gec-gaya, all"
  exit 1
}

# 6. Execute Gradle Builds
Write-Host "`n[5/6] Building Android Packages via Gradle..." -ForegroundColor Yellow
$generatedArtifacts = @()

Push-Location $PSScriptRoot
try {
  $env:BUBBLEWRAP_KEYSTORE_PASSWORD = $pw
  $env:BUBBLEWRAP_KEY_PASSWORD = $pw

  foreach ($cfg in $targetVariants) {
    Write-Host "`n----------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "  Building Variant: $($cfg.Name) ($($cfg.PackageId))" -ForegroundColor Cyan
    Write-Host "  Launch URL: $($cfg.LaunchUrl)" -ForegroundColor Cyan
    Write-Host "----------------------------------------------------------" -ForegroundColor Cyan

    $flavor = $cfg.Flavor
    $flavorLower = $cfg.FlavorLower
    $slug = $cfg.Slug

    # 1. Assemble Debug APK
    Write-Host "  -> Assembling Debug APK (assemble${flavor}Debug)..." -ForegroundColor Yellow
    & .\gradlew.bat "assemble${flavor}Debug"
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle assemble${flavor}Debug failed with exit code $LASTEXITCODE"
    }

    $debugSrc = Join-Path $PSScriptRoot "app\build\outputs\apk\${flavorLower}\debug\app-${flavorLower}-debug.apk"
    $debugDest = Join-Path $PSScriptRoot "CampusFlow-${slug}-debug.apk"

    if (Test-Path $debugSrc) {
      Copy-Item -Path $debugSrc -Destination $debugDest -Force
      $generatedArtifacts += @{
        Name = "CampusFlow-${slug}-debug.apk"
        Variant = $cfg.Name
        Type = "Debug APK"
        PackageId = $cfg.PackageId
        Path = $debugDest
      }
      if ($slug -eq "main") {
        Copy-Item -Path $debugSrc -Destination (Join-Path $PSScriptRoot "app-debug.apk") -Force
      }
      Write-Host "  [OK] Generated Debug APK: $debugDest" -ForegroundColor Green
    }

    if (-not $DebugOnly) {
      # 2. Assemble Release Signed APK
      Write-Host "  -> Assembling Signed Release APK (assemble${flavor}Release)..." -ForegroundColor Yellow
      & .\gradlew.bat "assemble${flavor}Release"
      if ($LASTEXITCODE -ne 0) {
        throw "Gradle assemble${flavor}Release failed with exit code $LASTEXITCODE"
      }

      $releaseSrc = Join-Path $PSScriptRoot "app\build\outputs\apk\${flavorLower}\release\app-${flavorLower}-release.apk"
      $releaseDest = Join-Path $PSScriptRoot "CampusFlow-${slug}-release.apk"

      $canonicalName = switch ($slug) {
        "main" { "CampusFlow-main" }
        "bce-bgp" { "CampusFlow-BCE-BGP" }
        "gec-gaya" { "CampusFlow-GEC-GAYA" }
        default { "CampusFlow-${slug}" }
      }
      $canonicalApk = Join-Path $PSScriptRoot "${canonicalName}.apk"
      $canonicalAab = Join-Path $PSScriptRoot "${canonicalName}.aab"

      if (Test-Path $releaseSrc) {
        Copy-Item -Path $releaseSrc -Destination $releaseDest -Force
        Copy-Item -Path $releaseSrc -Destination $canonicalApk -Force
        $generatedArtifacts += @{
          Name = "${canonicalName}.apk"
          Variant = $cfg.Name
          Type = "Signed Release APK"
          PackageId = $cfg.PackageId
          Path = $canonicalApk
        }
        $generatedArtifacts += @{
          Name = "CampusFlow-${slug}-release.apk"
          Variant = $cfg.Name
          Type = "Signed Release APK"
          PackageId = $cfg.PackageId
          Path = $releaseDest
        }
        if ($slug -eq "main") {
          Copy-Item -Path $releaseSrc -Destination (Join-Path $PSScriptRoot "app-release-signed.apk") -Force
        }
        Write-Host "  [OK] Generated Signed Release APK: $canonicalApk" -ForegroundColor Green
      }

      # 3. Bundle Release AAB (Google Play Store)
      Write-Host "  -> Bundling Play Store Release AAB (bundle${flavor}Release)..." -ForegroundColor Yellow
      & .\gradlew.bat "bundle${flavor}Release"
      if ($LASTEXITCODE -ne 0) {
        throw "Gradle bundle${flavor}Release failed with exit code $LASTEXITCODE"
      }

      $aabSrc = Join-Path $PSScriptRoot "app\build\outputs\bundle\${flavorLower}Release\app-${flavorLower}-release.aab"
      $aabDest = Join-Path $PSScriptRoot "CampusFlow-${slug}-release.aab"

      if (Test-Path $aabSrc) {
        Copy-Item -Path $aabSrc -Destination $aabDest -Force
        Copy-Item -Path $aabSrc -Destination $canonicalAab -Force
        $generatedArtifacts += @{
          Name = "${canonicalName}.aab"
          Variant = $cfg.Name
          Type = "Play Store Release AAB"
          PackageId = $cfg.PackageId
          Path = $canonicalAab
        }
        $generatedArtifacts += @{
          Name = "CampusFlow-${slug}-release.aab"
          Variant = $cfg.Name
          Type = "Play Store Release AAB"
          PackageId = $cfg.PackageId
          Path = $aabDest
        }
        if ($slug -eq "main") {
          Copy-Item -Path $aabSrc -Destination (Join-Path $PSScriptRoot "app-release-bundle.aab") -Force
        }
        Write-Host "  [OK] Generated Play Store AAB: $canonicalAab" -ForegroundColor Green
      }
    }
  }
} finally {
  Pop-Location
}

# 6. Output Artifacts Summary
Write-Host "`n[6/6] Build Artifacts Summary:" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$allExist = $true
foreach ($art in $generatedArtifacts) {
  if (Test-Path $art.Path) {
    $item = Get-Item $art.Path
    $sizeMB = [math]::round($item.Length / 1MB, 2)
    Write-Host "  [EXISTS] $($art.Name) [$($art.Type)]" -ForegroundColor Green
    Write-Host "           Package: $($art.PackageId)" -ForegroundColor Gray
    Write-Host "           Size: $sizeMB MB ($($item.Length) bytes)" -ForegroundColor Gray
    Write-Host "           Path: $($art.Path)`n" -ForegroundColor DarkGray
  } else {
    Write-Host "  [MISSING] $($art.Name) was not found at $($art.Path)" -ForegroundColor Red
    $allExist = $false
  }
}

if (-not $allExist -or $generatedArtifacts.Count -eq 0) {
  Write-Error "One or more target artifacts were not generated."
  exit 1
}

Write-Host "TWA Multi-Variant Build Complete." -ForegroundColor Green
