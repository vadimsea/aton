# Настройка QA-ботов: вход в GitHub (один раз) + заливка секретов из .env
#   powershell -ExecutionPolicy Bypass -File scripts/finish-qa-bots.ps1
#
# Без .env (корень репо) с заполненными полями не зальётся. QA_BOT_TOKEN можно дописать позже
# (фронт-бот), остальные ключи (Groq, FTP) — уже достаточно для бэкенд-бота в GitHub Actions.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

Write-Host ""
Write-Host "=== Атон: QA-боты и GitHub ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $envFile)) {
  Write-Error "Нет $envFile — скопируйте qa-bots/env.example -> .env в корне и заполните."
}

$ghExe = $null
$g = Get-Command gh -ErrorAction SilentlyContinue
if ($g) { $ghExe = $g.Source }
elseif (Test-Path "${env:ProgramFiles}\GitHub CLI\gh.exe") {
  $ghExe = "${env:ProgramFiles}\GitHub CLI\gh.exe"
}
if (-not $ghExe) {
  Write-Host "Нужен GitHub CLI. Установка:" -ForegroundColor Yellow
  Write-Host "  winget install GitHub.cli" -ForegroundColor White
  Write-Host "Затем снова запустите этот скрипт."
  exit 1
}

# Что пусто в .env
$map = @{}
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k, $v = $_ -split '=', 2
  $k = $k.Trim()
  if ($null -eq $v) { $v = "" } else { $v = $v.Trim().Trim('"').Trim("'") }
  if ($k) { $map[$k] = $v }
}
$need = @("GROQ_API_KEY", "FTP_HOST", "FTP_USER", "FTP_PASS", "FTP_QA_DIR", "QA_BOT_TOKEN")
$empty = @()
foreach ($k in $need) {
  if (-not $map[$k] -or -not $map[$k].ToString().Trim()) { $empty += $k }
}
if ($empty.Count -gt 0) {
  Write-Host "Пока пусто в .env (заполните по мере сил): $($empty -join ', ')" -ForegroundColor Yellow
  if ($empty -contains "QA_BOT_TOKEN") {
    Write-Host "  -> QA_BOT_TOKEN: в браузере aten -> F12 -> Application -> Local Storage -> aton_token" -ForegroundColor DarkGray
  }
} else {
  Write-Host "В .env заданы все перечисленные ключи." -ForegroundColor Green
}

# Вход
& $ghExe auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Сейчас откроется окно/браузер — войдите в GitHub (аккаунт владельца репо vadimsea/aton)." -ForegroundColor Cyan
  Read-Host "Нажмите Enter, чтобы запустить gh auth login"
  & $ghExe auth login
}

& $ghExe auth status
if ($LASTEXITCODE -ne 0) {
  Write-Error "Вход в gh не завершён. Повторите: & '$ghExe' auth login"
}

Write-Host ""
Write-Host "Заливка секретов в репозиторий..." -ForegroundColor Cyan
$push = Join-Path $root "scripts\push-qa-secrets-to-github.ps1"
& powershell -NoProfile -ExecutionPolicy Bypass -File $push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Готово. Проверьте: https://github.com/vadimsea/aton/actions" -ForegroundColor Green
Write-Host "Бэкенд-бот: Workflow `QA bot — backend daily` — можно Run workflow вручную (не нужен QA_BOT_TOKEN)."
Write-Host "Фронт-бот: нужен секрет QA_BOT_TOKEN — как только допишите в .env, снова запустите:" -ForegroundColor Yellow
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\push-qa-secrets-to-github.ps1" -ForegroundColor White
Write-Host ""
Start-Process "https://github.com/vadimsea/aton/actions"
Start-Process "https://github.com/vadimsea/aton/settings/secrets/actions"
