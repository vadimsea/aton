# Всё за один запуск: токен бота (API) + gh по PAT + заливка секретов в GitHub
# В корневом .env должны быть:
#   GROQ_*, FTP_*, FTP_QA_DIR
#   QA_BOT_EMAIL, QA_BOT_PASSWORD  — тест-аккаунт; или заранее укажите QA_BOT_TOKEN вручную
#   GITHUB_PAT  — https://github.com/settings/tokens (classic: scope repo)
#
#   powershell -ExecutionPolicy Bypass -File scripts/one-setup-qa.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Read-DotenvMap {
  $m = @{}
  $f = Join-Path $root ".env"
  if (-not (Test-Path $f)) { return $m }
  Get-Content $f -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k, $v = $_ -split '=', 2
    $k = $k.Trim()
    if ($null -eq $v) { $v = "" } else { $v = $v.Trim().Trim('"').Trim("'") }
    if ($k) { $m[$k] = $v }
  }
  return $m
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Error "Нужен Node.js" }

$ghExe = $null
$g = Get-Command gh -ErrorAction SilentlyContinue
if ($g) { $ghExe = $g.Source }
elseif (Test-Path "${env:ProgramFiles}\GitHub CLI\gh.exe") {
  $ghExe = "${env:ProgramFiles}\GitHub CLI\gh.exe"
}
if (-not $ghExe) { Write-Error "Установите: winget install GitHub.cli" }

# 1) токен бота
$dm = Read-DotenvMap
if ($dm["QA_BOT_TOKEN"] -and $dm["QA_BOT_TOKEN"].ToString().Trim()) {
  Write-Host "QA_BOT_TOKEN уже задан в .env — пропуск fetch" -ForegroundColor Green
} else {
  & $node.Path (Join-Path $root "scripts\fetch-qa-bot-token.mjs")
  $fetchCode = $LASTEXITCODE
  if ($fetchCode -ne 0) {
    Write-Error "Не получилось взять токен. В .env укажите либо QA_BOT_EMAIL+QA_BOT_PASSWORD (тест-бот), либо вручную QA_BOT_TOKEN=..."
  }
}

# 2) GitHub: PAT из .env
$map = Read-DotenvMap
$pat = $map["GITHUB_PAT"]
if ($pat) {
  $pat | & $ghExe auth login --with-token
  if ($LASTEXITCODE -ne 0) { Write-Error "gh auth login --with-token не прошёл" }
} else {
  Write-Host "В .env нет GITHUB_PAT — зайдите в GitHub вручную: & '$ghExe' auth login" -ForegroundColor Yellow
  & $ghExe auth status
  if ($LASTEXITCODE -ne 0) { Write-Error "Сначала войдите в gh или добавьте GITHUB_PAT= в .env" }
}

# 3) заливка
& $node.Path -e "process.exit(0)" 2>$null
$push = Join-Path $root "scripts\push-qa-secrets-to-github.ps1"
& powershell -NoProfile -ExecutionPolicy Bypass -File $push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Готово. Actions: https://github.com/vadimsea/aton/actions" -ForegroundColor Green
Start-Process "https://github.com/vadimsea/aton/actions"
