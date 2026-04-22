# Залить секреты для QA-ботов из .env в GitHub (нужен: gh auth login).
#   powershell -ExecutionPolicy Bypass -File scripts/push-qa-secrets-to-github.ps1
# В корне репозитория: .env с GROQ_API_KEY, FTP_*, FTP_QA_DIR, QA_BOT_TOKEN (см. qa-bots/env.example)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
  Write-Error "Missing $envFile - copy from qa-bots/env.example"
}

$ghExe = $null
$gcmd = Get-Command gh -ErrorAction SilentlyContinue
if ($gcmd) { $ghExe = $gcmd.Source }
elseif (Test-Path "${env:ProgramFiles}\GitHub CLI\gh.exe") { $ghExe = "${env:ProgramFiles}\GitHub CLI\gh.exe" }
if (-not $ghExe) {
  Write-Error "Install GitHub CLI: winget install GitHub.cli, then gh auth login"
}

$keys = @(
  "GROQ_API_KEY",
  "QA_BOT_TOKEN",
  "FTP_HOST",
  "FTP_USER",
  "FTP_PASS",
  "FTP_QA_DIR"
)

$map = @{}
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k, $v = $_ -split '=', 2
  $k = $k.Trim()
  if ($null -eq $v) { $v = "" } else { $v = $v.Trim().Trim('"').Trim("'") }
  if ($k) { $map[$k] = $v }
}

$remote = git -C $root remote get-url origin 2>$null
if ($remote -match "github\.com[:/](.+)") {
  $repo = ($Matches[1] -replace "\.git$", "").Trim()
} else {
  $repo = Read-Host "Owner/repo (e.g. vadimsea/aton)"
}

foreach ($k in $keys) {
  if (-not $map[$k] -or -not $map[$k].ToString().Trim()) {
    Write-Warning "Skip (empty): $k"
    continue
  }
  $map[$k].ToString() | & $ghExe secret set $k --repo $repo
  Write-Host "OK: $k"
}
Write-Host "Done. Run: gh secret list --repo $repo"
