# ATEN Native iOS

`ios-swift` — отдельный нативный SwiftUI-клиент ATEN без WebView. Это целевой iPhone-проект.

## Что уже заложено

- SwiftUI app, iOS 16+, portrait.
- Bundle ID: `by.vadzim.aten`.
- API layer к `https://aton-api-2.onrender.com`.
- Keychain-сессия.
- Вход и регистрация.
- Выбор языка при регистрации и смена языка в профиле: русский, немецкий, английский.
- Крупный выбор языка флагами без подписей `ru/de/en`.
- Список чатов с закреплённым `Голос Атона`.
- Аватары пользователей и чатов из `avatarDataUrl` / `peerAvatarDataUrl`.
- Экран чата с date separators как в Telegram.
- Текстовые, фото и голосовые сообщения.
- Голосовые: `AVAudioRecorder`, `.m4a`, отправка как `data:audio/mp4;base64`, воспроизведение через `AVAudioPlayer`.
- Фото перед отправкой и аватары перед сохранением сжимаются на клиенте.
- Реакции, редактирование, удаление, закрепление сообщений через меню сообщения.
- Жалобы на пользователя, чат и сообщение через API-контур.
- Профиль: фото, имя, статус, public ID, язык, тема, сохранение через `/api/profile`.
- Superadmin screen: пользователи, группы/каналы, верификация, жалобы, resolve/reject.
- Тихое обновление данных в открытом приложении каждые несколько секунд без постоянного loading-спиннера.
- APNs registration flow для push-уведомлений, когда приложение закрыто.
- Deep links: `aten://chat/:chatId`, `aten://message/:messageId`, `aten://profile/:userId`.

## Push, когда ATEN закрыт

Для уведомлений на экране iPhone, когда приложение закрыто, нужны все три части:

1. В Apple Developer включить Push Notifications для App ID `by.vadzim.aten`.
2. В Xcode signing выбрать Team и сгенерировать provisioning profile с push capability.
3. На backend/Render задать APNs-переменные:

```env
APNS_TEAM_ID=XXXXXXXXXX
APNS_KEY_ID=XXXXXXXXXX
APNS_BUNDLE_ID=by.vadzim.aten
APNS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
APNS_ENV=sandbox
```

Для TestFlight/App Store поставить:

```env
APNS_ENV=production
```

И в `ios-swift/project.yml` для release-сборки заменить:

```yml
APS_ENVIRONMENT: production
```

Проверка после установки на реальный iPhone:

```http
GET /api/push/status
POST /api/push/test
```

`/api/push/status` должен вернуть `registeredDevices > 0` и `apnsConfigured: true`.

## Открыть на Mac

```bash
brew install xcodegen
cd ios-swift
xcodegen generate
open Aton.xcodeproj
```

В Xcode:

- Signing Team: выбрать Apple Developer Team.
- Capabilities: Push Notifications.
- Capabilities: Background Modes -> Remote notifications.
- Запускать push-тесты на реальном iPhone, не только в Simulator.

## Сборка без своего Mac через GitHub Actions

Добавлены два workflow:

- `.github/workflows/ios-simulator-build.yml` — бесплатная проверка компиляции SwiftUI-проекта на macOS runner для iPhone Simulator. Подписывание Apple не нужно.
- `.github/workflows/ios-testflight.yml` — ручной архив под TestFlight/App Store. Нужен Apple Developer аккаунт и secrets.

Для TestFlight/App Store в GitHub repository settings нужно добавить secrets:

```text
APPLE_DEVELOPMENT_TEAM          Apple Team ID
APP_STORE_CONNECT_KEY_ID        Key ID из App Store Connect API key
APP_STORE_CONNECT_ISSUER_ID     Issuer ID из App Store Connect
APP_STORE_CONNECT_API_KEY       содержимое .p8 ключа целиком
```

Первый этап без денег и без Mac: открыть GitHub Actions и запустить `iOS Simulator Build`. Если он зелёный, Swift-проект компилируется в облаке.
