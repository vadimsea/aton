@echo off
setlocal
cd /d "%~dp0build\release"
if not exist "ATEN.exe" (
  echo ATEN.exe not found. Build first: scripts\build-release.ps1
  pause
  exit /b 1
)
if not exist "aten-api.url" (
  echo https://aton-api-2.onrender.com>aten-api.url
)
start "" "%cd%\ATEN.exe"
