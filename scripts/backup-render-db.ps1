param(
  [string]$DatabaseUrl = $env:ATON_RENDER_DATABASE_URL
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$backupDir = Join-Path $root "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$urlFile = Join-Path $backupDir "render-database-url.txt"
if (-not $DatabaseUrl -and (Test-Path $urlFile)) {
  $DatabaseUrl = (Get-Content -Raw -Path $urlFile).Trim()
}

if (-not $DatabaseUrl) {
  throw "Set ATON_RENDER_DATABASE_URL or put the Render External Database URL into backups\render-database-url.txt first."
}

$pgDump = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
if (-not (Test-Path $pgDump)) {
  $pgDump = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
}
if (-not (Test-Path $pgDump)) {
  $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "pg_dump was not found. Install PostgreSQL client tools or add pg_dump to PATH."
  }
  $pgDump = $cmd.Source
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$customDump = Join-Path $backupDir "aton-render-$stamp.dump"
$plainSql = Join-Path $backupDir "aton-render-$stamp.sql"

Write-Host "Creating custom PostgreSQL dump..."
& $pgDump --format=custom --verbose --no-owner --no-acl --file $customDump $DatabaseUrl

Write-Host "Creating plain SQL dump..."
& $pgDump --format=plain --no-owner --no-acl --file $plainSql $DatabaseUrl

$custom = Get-Item $customDump
$plain = Get-Item $plainSql

Write-Host "Backup complete:"
Write-Host "  $($custom.FullName) ($($custom.Length) bytes)"
Write-Host "  $($plain.FullName) ($($plain.Length) bytes)"
