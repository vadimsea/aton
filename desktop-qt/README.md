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
6. Add Windows installer and app icon.
