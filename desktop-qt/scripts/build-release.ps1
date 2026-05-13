$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$CMake = "C:\Program Files\CMake\bin\cmake.exe"
$QtRoot = "D:\Qt\6.6.3\mingw_64"
$MingwBin = "D:\Qt\Tools\mingw1310_64\bin"
$Ninja = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ninja.exe |
    Select-Object -First 1 -ExpandProperty FullName

if (-not (Test-Path $CMake)) {
    throw "CMake not found at $CMake"
}
if (-not $Ninja -or -not (Test-Path $Ninja)) {
    throw "Ninja not found"
}
if (-not (Test-Path "$QtRoot\bin\windeployqt.exe")) {
    throw "Qt not found at $QtRoot"
}
if (-not (Test-Path "$MingwBin\g++.exe")) {
    throw "MinGW not found at $MingwBin"
}

$env:PATH = "$MingwBin;$QtRoot\bin;C:\Program Files\CMake\bin;$env:PATH"

Push-Location $ProjectRoot
try {
    & $CMake -S . -B build\release -G Ninja `
        -DCMAKE_BUILD_TYPE=Release `
        -DCMAKE_PREFIX_PATH="$QtRoot" `
        -DCMAKE_MAKE_PROGRAM="$Ninja" `
        -DCMAKE_C_COMPILER="$MingwBin\gcc.exe" `
        -DCMAKE_CXX_COMPILER="$MingwBin\g++.exe"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & $CMake --build build\release
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & "$QtRoot\bin\windeployqt.exe" --release --compiler-runtime build\release\ATEN.exe
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $RepoRoot = Split-Path -Parent $ProjectRoot
    $GolosAvatar = Join-Path $RepoRoot "golos-aton-avatar.png"
    if (Test-Path $GolosAvatar) {
        Copy-Item -LiteralPath $GolosAvatar -Destination (Join-Path $ProjectRoot "build\release\golos-aton-avatar.png") -Force
    }

    Write-Host "Built: $ProjectRoot\build\release\ATEN.exe"
} finally {
    Pop-Location
}
