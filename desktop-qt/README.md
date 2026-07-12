# ATEN Desktop Qt

Native desktop client for ATEN, planned as a C++/Qt application with the same product behavior as the web messenger.

This folder is intentionally isolated from the current web client. The desktop app will talk to the existing ATEN API and can reuse backend contracts without copying browser UI code.

## Current Scope

- Qt 6 / C++20 project skeleton.
- Main window layout close to the messenger structure: sidebar, chat header, message area, composer.
- API client infrastructure with shared JSON request handling.
- Session storage through `QSettings`.
- Central app config for API endpoint and app identity.

## Requirements

- Qt 6.5 or newer with `Core`, `Gui`, `Network`, `Widgets`.
- CMake 3.24 or newer.
- Ninja or another CMake generator.
- C++20 compiler.

## Build

From `desktop-qt`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-debug.ps1
```

For an optimized build:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-release.ps1
```

The executable will be built as `build/debug/ATEN.exe` or `build/release/ATEN.exe`.

## Versioning

The desktop version has one source of truth:

```text
desktop-qt/VERSION
```

Use the `MAJOR.MINOR.PATCH` format, for example `0.2.0`. The value is applied to:

- the version shown at the bottom of the desktop application;
- the Windows metadata of `ATEN.exe`;
- the portable ZIP filename;
- the installer filename and Windows uninstall information.

## Windows installer

Install NSIS once:

```powershell
winget install NSIS.NSIS
```

Then build the release, portable package, and installer:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-installer.ps1
```

Generated files:

```text
dist/ATEN-desktop-<version>-win64.zip
dist/ATEN-Setup-<version>.exe
```

The installer works without administrator rights, displays the user agreement,
creates Start Menu and desktop shortcuts, and registers an uninstaller.

## Architecture Direction

- `app/` owns startup, configuration, and composition.
- `net/` owns HTTP/API access.
- `session/` owns local token/user persistence.
- `ui/` owns native Qt widgets and presentation.

Next implementation steps:

1. Add login/register screens using existing API endpoints.
2. Load `/api/me`, `/api/chats`, `/api/messages/all`.
3. Add message list rendering and composer send flow.
4. Add websocket/socket.io strategy or polling fallback.
5. Add media upload/download, reactions, replies, profile settings.
6. Maintain release versioning and the Windows installer.
