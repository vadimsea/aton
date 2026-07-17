# Установка iOS-версии ATEN на iPhone с Windows через Sideloadly

Эта инструкция нужна для личного тестирования ATEN на своём iPhone без Mac, без TestFlight и без оплаченного Apple Developer Program.

## Что подготовлено в проекте

- iOS-приложение находится в `ios-swift`.
- Стек: native Swift / SwiftUI.
- Проект Xcode генерируется через XcodeGen из `ios-swift/project.yml`.
- Target и scheme: `Aton`.
- Bundle Identifier: `by.vadzim.aten`.
- Для личной установки используется отдельная конфигурация `Sideload`.
- Push Notifications entitlement отключён только для `Sideload`, чтобы бесплатная подпись Apple ID не ломала установку.

## 1. Отправить проект в GitHub

1. Откройте терминал в корне проекта.
2. Проверьте изменения:

```powershell
git status
```

3. Закоммитьте и отправьте изменения:

```powershell
git add .
git commit -m "build: add iOS sideload workflow"
git push
```

Если изменения уже отправлены, этот шаг можно пропустить.

## 2. Запустить сборку IPA в GitHub Actions

1. Откройте репозиторий на GitHub.
2. Перейдите во вкладку `Actions`.
3. В левом списке выберите workflow `Build iOS Sideload IPA`.
4. Нажмите `Run workflow`.
5. Выберите ветку `main`.
6. Нажмите зелёную кнопку `Run workflow`.
7. Дождитесь завершения job `Build unsigned IPA for Sideloadly`.

После успешной сборки внизу страницы run появится artifact:

```text
Aten-unsigned-ipa
```

Скачайте его. Внутри будет файл:

```text
Aten-unsigned.ipa
```

## 3. Установить компоненты Apple на Windows

Sideloadly обычно требует Apple Mobile Device Support. Надёжнее ставить iTunes и iCloud именно с сайта Apple, а не из Microsoft Store.

1. iTunes для Windows:
   - откройте страницу Apple Downloads;
   - скачайте классический установщик iTunes для Windows.

2. iCloud для Windows:
   - скачайте iCloud для Windows с сайта Apple, если Sideloadly попросит компоненты Apple.

После установки перезагрузите Windows.

## 4. Установить Sideloadly

1. Откройте официальный сайт Sideloadly.
2. Скачайте версию для Windows.
3. Установите и запустите Sideloadly.

## 5. Подключить iPhone

1. Подключите iPhone к компьютеру кабелем.
2. На iPhone нажмите `Доверять этому компьютеру`.
3. Введите код-пароль iPhone.
4. Убедитесь, что Sideloadly видит устройство.

## 6. Подписать и установить ATEN

1. В Sideloadly перетащите файл `Aten-unsigned.ipa` в окно приложения.
2. В поле Apple ID введите свой обычный Apple ID.
3. Нажмите `Start`.
4. Если включена двухфакторная аутентификация, подтвердите вход.
5. Если Apple запросит пароль приложения, создайте его в настройках Apple ID и используйте в Sideloadly.
6. Дождитесь окончания установки.

Sideloadly подпишет IPA вашим Apple ID и установит приложение на iPhone.

## 7. Включить Developer Mode на iPhone

На iOS 16 и новее может понадобиться Developer Mode:

1. Откройте `Настройки`.
2. Перейдите в `Конфиденциальность и безопасность`.
3. Откройте `Режим разработчика`.
4. Включите режим.
5. Перезагрузите iPhone, если iOS попросит.

## 8. Доверять профилю разработчика

Если iPhone не запускает приложение:

1. Откройте `Настройки`.
2. Перейдите в `Основные`.
3. Откройте `VPN и управление устройством` или `Управление устройством`.
4. Найдите профиль с вашим Apple ID.
5. Нажмите `Доверять`.

После этого запустите приложение `Атон` с домашнего экрана.

## Ограничения бесплатного Apple ID

- Подпись обычно действует около 7 дней.
- Через 7 дней приложение нужно подписать и установить снова через Sideloadly.
- TestFlight и App Store без Apple Developer Program недоступны.
- Полноценные push-уведомления APNs могут не работать.
- Установка предназначена только для личного тестирования.
- Не добавляйте в репозиторий Apple ID, пароли, сертификаты, provisioning profiles или App Store Connect API keys.

## Что временно отключено для Sideload

Только в конфигурации `Sideload` отключены:

- `aps-environment` entitlement для Push Notifications;
- `UIBackgroundModes / remote-notification`.

Основная конфигурация `Debug` и будущая `Release` остаются подготовленными для возврата к APNs после оплаты Apple Developer Program.
