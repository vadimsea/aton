# Static front deploy via FTP. Usage: powershell -ExecutionPolicy Bypass -File scripts/deploy-ftp.ps1
# Requires .env.deploy (copy from .env.deploy.example)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$envFile = Join-Path $root ".env.deploy"
if (-not (Test-Path $envFile)) {
  Write-Error "Missing .env.deploy"
}

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k, $v = $_ -split '=', 2
  $k = $k.Trim()
  if ($null -eq $v) { $v = "" } else { $v = $v.Trim().Trim('"').Trim("'") }
  if ($k) { Set-Item -Path "env:$k" -Value $v }
}

$required = @("FTP_HOST", "FTP_USER", "FTP_PASS")
foreach ($r in $required) {
  if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($r, "Process"))) {
    Write-Error "Missing env: $r"
  }
}

$apiBase = [Environment]::GetEnvironmentVariable("ATON_API_BASE", "Process")
if (-not $apiBase) { $apiBase = "" }
$apiBase = $apiBase.TrimEnd('/')
$ftpHost = [Environment]::GetEnvironmentVariable("FTP_HOST", "Process")
$ftpUser = [Environment]::GetEnvironmentVariable("FTP_USER", "Process")
$ftpPass = [Environment]::GetEnvironmentVariable("FTP_PASS", "Process")
$remoteDir = [Environment]::GetEnvironmentVariable("FTP_REMOTE_DIR", "Process")
$remoteDir = $remoteDir.Trim().TrimStart('/').TrimEnd('/')

$staging = Join-Path $root ".deploy-staging"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging | Out-Null

function Patch-Meta {
  param([string]$src, [string]$dst)
  $c = Get-Content $src -Raw -Encoding UTF8
  $repl = '${1}' + $apiBase + '${2}'
  $c = [regex]::Replace($c, '(<meta\s+name="aton-api-base"\s+content=")[^"]*(")', $repl)
  Set-Content -Path $dst -Value $c -Encoding UTF8 -NoNewline
}

$files = @(
  @{ src = "index.html"; patch = $true },
  @{ src = "main.js"; patch = $false },
  @{ src = "style.css"; patch = $false },
  @{ src = "forgot.html"; patch = $true },
  @{ src = "reset.html"; patch = $true }
)

foreach ($f in $files) {
  $from = Join-Path $root $f.src
  if (-not (Test-Path $from)) {
    Write-Warning "Skip missing: $($f.src)"
    continue
  }
  $to = Join-Path $staging $f.src
  if ($f.patch) { Patch-Meta -src $from -dst $to } else { Copy-Item $from $to -Force }
}

$remLabel = if ($remoteDir -eq ".") { "web root (PWD)" } else { $remoteDir }
Write-Host "Uploading via basic-ftp to $ftpHost ($remLabel) ..."
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Error "Need Node.js in PATH" }
$upload = Join-Path $root "scripts/ftp-upload-deploy.mjs"
& $node.Source $upload $staging
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Remove-Item $staging -Recurse -Force
Write-Host "Done. aton-api-base is set to: [$apiBase]"
