$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Split-Path -Parent $PSScriptRoot)).Path
$RepoRoot = (Resolve-Path (Split-Path -Parent $ProjectRoot)).Path
$VersionFile = Join-Path $ProjectRoot "VERSION"
$DistDir = Join-Path $ProjectRoot "dist"
$StageDir = Join-Path $DistDir "ATEN-$((Get-Content -LiteralPath $VersionFile -Raw).Trim())-win64"
$ReleaseDir = Join-Path $ProjectRoot "build\release"
$BuildScript = Join-Path $PSScriptRoot "build-release.ps1"

$Version = (Get-Content -LiteralPath $VersionFile -Raw).Trim()
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "VERSION must use the MAJOR.MINOR.PATCH format, for example 0.2.0"
}

& powershell -ExecutionPolicy Bypass -File $BuildScript
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$ResolvedDist = [System.IO.Path]::GetFullPath($DistDir)
$ResolvedStage = [System.IO.Path]::GetFullPath($StageDir)
if (-not $ResolvedStage.StartsWith($ResolvedDist, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe staging path: $ResolvedStage"
}

New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
if (Test-Path -LiteralPath $StageDir) {
    Remove-Item -LiteralPath $StageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

$RuntimePatterns = @(
    "*.exe",
    "*.dll",
    "*.ico",
    "*.wav",
    "*.url"
)
foreach ($pattern in $RuntimePatterns) {
    Get-ChildItem -LiteralPath $ReleaseDir -File -Filter $pattern |
        Copy-Item -Destination $StageDir -Force
}

$RuntimeDirectories = @(
    "generic",
    "iconengines",
    "imageformats",
    "multimedia",
    "networkinformation",
    "platforms",
    "styles",
    "tls",
    "translations"
)
foreach ($directory in $RuntimeDirectories) {
    $source = Join-Path $ReleaseDir $directory
    if (Test-Path -LiteralPath $source) {
        Copy-Item -LiteralPath $source -Destination $StageDir -Recurse -Force
    }
}

$GolosAvatar = Join-Path $RepoRoot "golos-aton-avatar.png"
if (Test-Path -LiteralPath $GolosAvatar) {
    Copy-Item -LiteralPath $GolosAvatar -Destination $StageDir -Force
}

$AppLogo = Join-Path $RepoRoot "aten-logo.png"
if (Test-Path -LiteralPath $AppLogo) {
    Copy-Item -LiteralPath $AppLogo -Destination $StageDir -Force
}

Copy-Item -LiteralPath (Join-Path $ProjectRoot "installer\LICENSE-ru.txt") `
    -Destination (Join-Path $StageDir "USER-AGREEMENT-ru.txt") -Force

if (-not (Test-Path -LiteralPath (Join-Path $StageDir "ATEN.exe"))) {
    throw "ATEN.exe was not copied to the staging directory"
}

$ZipPath = Join-Path $DistDir "ATEN-desktop-$Version-win64.zip"
if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
}
Compress-Archive -Path (Join-Path $StageDir "*") -DestinationPath $ZipPath -CompressionLevel Optimal

$NsisCandidates = @(
    "$env:ProgramFiles\NSIS\makensis.exe",
    "${env:ProgramFiles(x86)}\NSIS\makensis.exe"
)
$MakeNsis = $NsisCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $MakeNsis) {
    $command = Get-Command makensis.exe -ErrorAction SilentlyContinue
    if ($command) {
        $MakeNsis = $command.Source
    }
}
if (-not $MakeNsis) {
    throw "NSIS is not installed. Install it once with: winget install NSIS.NSIS"
}

$InstallerPath = Join-Path $DistDir "ATEN-Setup-$Version.exe"
$NsisScript = Join-Path $ProjectRoot "installer\ATEN.nsi"
$LicenseFile = Join-Path $ProjectRoot "installer\LICENSE-ru.txt"
$NsisLicenseFile = Join-Path $DistDir "LICENSE-ru-nsis.txt"
$IconFile = Join-Path $ProjectRoot "resources\aten-logo.ico"

$LicenseText = [System.IO.File]::ReadAllText($LicenseFile, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($NsisLicenseFile, $LicenseText, [System.Text.Encoding]::Unicode)

& $MakeNsis `
    "/INPUTCHARSET" `
    "UTF8" `
    "/DPRODUCT_VERSION=$Version" `
    "/DSOURCE_DIR=$StageDir" `
    "/DOUTPUT_FILE=$InstallerPath" `
    "/DLICENSE_FILE=$NsisLicenseFile" `
    "/DAPP_ICON=$IconFile" `
    $NsisScript
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
Remove-Item -LiteralPath $NsisLicenseFile -Force -ErrorAction SilentlyContinue

$PublicInstallerPath = Join-Path $DistDir "ATEN-$Version-Windows-x64.exe"
Copy-Item -LiteralPath $InstallerPath -Destination $PublicInstallerPath -Force

$InstallerZipPath = Join-Path $DistDir "ATEN-Setup-$Version.zip"
if (Test-Path -LiteralPath $InstallerZipPath) {
    Remove-Item -LiteralPath $InstallerZipPath -Force
}
Compress-Archive -LiteralPath $InstallerPath -DestinationPath $InstallerZipPath -CompressionLevel Optimal

$LegacyPortableZipPath = Join-Path $DistDir "ATEN-Windows-$Version-x64.zip"
Copy-Item -LiteralPath $ZipPath -Destination $LegacyPortableZipPath -Force

Write-Host ""
Write-Host "Portable package: $ZipPath"
Write-Host "Windows installer: $InstallerPath"

$LandingDir = Join-Path $RepoRoot "site-aten"
if (Test-Path -LiteralPath $LandingDir) {
    $LandingDownloads = Join-Path $LandingDir "downloads"
    New-Item -ItemType Directory -Path $LandingDownloads -Force | Out-Null
    Copy-Item -LiteralPath $InstallerPath `
        -Destination (Join-Path $LandingDownloads "ATEN-Setup-$Version.exe") -Force
    Copy-Item -LiteralPath $InstallerPath `
        -Destination (Join-Path $LandingDownloads "ATEN-Setup-latest.exe") -Force

    $PublishedAt = Get-Date -Format "yyyy-MM-dd"
    $ManifestPath = Join-Path $LandingDir "latest.json"
    $ReleaseMessage = "A new ATEN version is available. Update to receive the latest fixes and improvements."
    if (Test-Path -LiteralPath $ManifestPath) {
        try {
            $ExistingManifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($ExistingManifest.message) {
                $ReleaseMessage = [string]$ExistingManifest.message
            }
        } catch {
            Write-Warning "Could not reuse release message from latest.json"
        }
    }
    $Manifest = [ordered]@{
        version = $Version
        title = "ATEN $Version"
        message = $ReleaseMessage
        downloadUrl = "https://vadzim.by/wp-content/uploads/aten/ATEN-Setup-$Version.exe"
        pageUrl = "https://vadzim.by/aten/"
        publishedAt = $PublishedAt
        mandatory = $true
    }
    $ManifestJson = $Manifest | ConvertTo-Json
    [System.IO.File]::WriteAllText($ManifestPath, $ManifestJson, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Landing release manifest updated: $LandingDir\latest.json"
}
