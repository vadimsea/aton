# Скриншоты native Swift iOS

В этой Windows-среде native iOS-приложение нельзя запустить: нет Xcode, iOS Simulator, Swift toolchain и XcodeGen.

Текущие preview-скриншоты, которые лежат в `artifacts/ios-preview`, относятся к Capacitor-прототипу `ios-aton`, а не к native SwiftUI-клиенту.

Чтобы получить реальные скриншоты Swift-версии:

```bash
cd ios-swift
brew install xcodegen
xcodegen generate
open Aton.xcodeproj
```

Дальше в Xcode:

1. Выбрать iPhone 15 Pro или реальный iPhone.
2. Run.
3. Сделать скриншоты экранов:
   - вход и регистрация с выбором языка;
   - список чатов;
   - чат с разделителями дат;
   - профиль и смена языка;
   - суперадмин: пользователи;
   - суперадмин: жалобы.

Для качества уровня Telegram скриншоты нужно оценивать именно с реального iPhone, потому что клавиатура, safe area, жест назад, пуши и плавность списка сообщений в браузерном preview не проверяются.
