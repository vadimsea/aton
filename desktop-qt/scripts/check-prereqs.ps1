$ErrorActionPreference = "Stop"

function Test-Command($Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Find-FirstExistingPath($Paths) {
    foreach ($Path in $Paths) {
        if ($Path -and (Test-Path $Path)) {
            return $Path
        }
    }
    return $null
}

$ok = $true
$cmakePath = Find-FirstExistingPath @(
    (Get-Command "cmake" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1),
    "C:\Program Files\CMake\bin\cmake.exe"
)
$ninjaPath = Find-FirstExistingPath @(
    (Get-Command "ninja" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1),
    (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ninja.exe -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName)
)

if ($cmakePath) {
    Write-Host "cmake: found at $cmakePath"
    & $cmakePath --version | Select-Object -First 1
} else {
    Write-Host "cmake: missing"
    $ok = $false
}

if ($ninjaPath) {
    Write-Host "ninja: found at $ninjaPath"
    & $ninjaPath --version
} else {
    Write-Host "ninja: missing"
    $ok = $false
}

$qtRoots = @(
    $env:Qt6_DIR,
    $env:CMAKE_PREFIX_PATH,
    "D:\Qt",
    "C:\Qt"
) | Where-Object { $_ -and (Test-Path $_) }

if ($qtRoots.Count -gt 0) {
    Write-Host "Qt candidate paths:"
    $qtRoots | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "Qt: no candidate path found"
    $ok = $false
}

$mingw = Find-FirstExistingPath @(
    "D:\Qt\Tools\mingw1310_64\bin\g++.exe",
    "C:\Qt\Tools\mingw1310_64\bin\g++.exe",
    (Get-Command "g++" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
)

if ($mingw) {
    Write-Host "g++: found at $mingw"
    & $mingw --version | Select-Object -First 1
} else {
    Write-Host "g++: missing"
    $ok = $false
}

if (-not $ok) {
    Write-Host ""
    Write-Host "Install Qt 6.5+, CMake 3.24+, and Ninja. Then run:"
    Write-Host '  cmake --preset windows-debug -DCMAKE_PREFIX_PATH="C:/Qt/<version>/<kit>"'
    Write-Host "  cmake --build --preset windows-debug"
    exit 1
}

Write-Host "Desktop Qt prerequisites look usable."
