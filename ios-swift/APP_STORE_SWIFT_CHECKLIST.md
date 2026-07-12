# Native iOS App Store Checklist

- Реальный iPhone: login/register.
- Реальный iPhone: переключение RU/DE/EN при регистрации.
- Реальный iPhone: переключение RU/DE/EN в профиле.
- Chat list: `Голос Атона` закреплён сверху.
- Chat screen: date separators, отправка текста, фото, голосовых, реакции.
- Chat screen: воспроизведение входящих голосовых сообщений.
- Message actions: редактирование, удаление, закрепление, жалоба через меню сообщения.
- Superadmin: список пользователей, группы/каналы, верификация, жалобы.
- Profile: смена аватара, имени, статуса, public ID, языка и темы.
- Push: APNs token появляется в `/api/push/status`.
- Push: закрыть приложение, отправить сообщение с другого аккаунта, проверить banner/list/badge.
- Deep link: `aten://chat/<id>`.
- Deep link from push: tap по уведомлению открывает нужный чат.
- Privacy strings: microphone, camera, photos.
- App icon: ATEN PNG без пикселизации.
- No WebView-only disclaimers in review notes.
