// Атон — фронтенд мессенджера, работающий с Node.js backend (server.js)

const TOKEN_KEY = "aton_token";

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* iOS «приватно» / отключённое хранилище — иначе падает весь скрипт до createApp */
  }
}

/** Кэш последнего успешного /api/me — чтобы при обрыве сети не показывать форму входа. */
const SESSION_ME_CACHE_KEY = "aton_me_cache_v1";
/** Системный ассистент (сервер: тот же username). */
const GOLOS_ATON_USERNAME = "golos_aton";
const LANG_KEY = "aton_lang";

const I18N = {
  "Подтвердите email": { en: "Verify your email", de: "E-Mail bestaetigen" },
  "ваш email": { en: "your email", de: "Ihre E-Mail" },
  "Мы отправили письмо на": { en: "We sent an email to", de: "Wir haben eine E-Mail gesendet an" },
  "Перейдите по ссылке в письме, чтобы активировать аккаунт.": {
    en: "Open the link in the email to activate your account.",
    de: "Oeffnen Sie den Link in der E-Mail, um Ihr Konto zu aktivieren.",
  },
  "Отправить повторно": { en: "Resend", de: "Erneut senden" },
  "Выйти": { en: "Log out", de: "Abmelden" },
  "Письмо отправлено повторно.": { en: "Email sent again.", de: "E-Mail wurde erneut gesendet." },
  "АТОН": { en: "ATEN", de: "ATEN" },
  "мессенджер под светом диска": {
    en: "messenger under the disk light",
    de: "Messenger unter dem Licht der Scheibe",
  },
  "Друзья, заявки и блокировки": {
    en: "Friends, requests, and blocked",
    de: "Freunde, Anfragen und blockiert",
  },
  "Сменить тему": { en: "Toggle theme", de: "Thema wechseln" },
  "Вход": { en: "Sign in", de: "Anmelden" },
  "Регистрация": { en: "Sign up", de: "Registrieren" },
  "Имя пользователя": { en: "Username", de: "Benutzername" },
  "Пароль": { en: "Password", de: "Passwort" },
  "Повторите пароль": { en: "Repeat password", de: "Passwort wiederholen" },
  "Войти": { en: "Sign in", de: "Anmelden" },
  "Забыли пароль?": { en: "Forgot password?", de: "Passwort vergessen?" },
  "В сети": { en: "Online", de: "Online" },
  "Профиль": { en: "Profile", de: "Profil" },
  "Чаты": { en: "Chats", de: "Chats" },
  "+ Группа": { en: "+ Group", de: "+ Gruppe" },
  "Создать группу": { en: "Create group", de: "Gruppe erstellen" },
  "Поиск по имени или @username…": {
    en: "Search by name or @username…",
    de: "Suche nach Name oder @username…",
  },
  "Профиль:": { en: "Profile:", de: "Profil:" },
  "настроить имя, статус и аватар": {
    en: "set name, status, and avatar",
    de: "Name, Status und Avatar einstellen",
  },
  "Назад к чатам": { en: "Back to chats", de: "Zurueck zu Chats" },
  "Атон": { en: "ATEN", de: "ATEN" },
  "Войдите, чтобы открыть чаты": {
    en: "Sign in to open chats",
    de: "Melden Sie sich an, um Chats zu oeffnen",
  },
  "Разрешить уведомления о сообщениях вне вкладки": {
    en: "Allow notifications for messages outside the tab",
    de: "Benachrichtigungen fuer Nachrichten ausserhalb des Tabs erlauben",
  },
  "Личные диалоги": { en: "Private chats", de: "Private Chats" },
  "Группы и каналы": { en: "Groups and channels", de: "Gruppen und Kanaele" },
  "Все пользователи": { en: "All users", de: "Alle Benutzer" },
  "Модерация": { en: "Moderation", de: "Moderation" },
  "Идёт запись. Отпустите кнопку микрофона, чтобы остановить.": {
    en: "Recording... Release the mic button to stop.",
    de: "Aufnahme laeuft... Mikrofon loslassen zum Stoppen.",
  },
  "Сообщение…": { en: "Message…", de: "Nachricht…" },
  "Фото": { en: "Photo", de: "Foto" },
  "Удерживайте, чтобы записать голос": {
    en: "Hold to record voice",
    de: "Gedrueckt halten fuer Sprachaufnahme",
  },
  "ОТПРАВИТЬ": { en: "SEND", de: "SENDEN" },
  "Голосовое": { en: "Voice", de: "Sprachnachricht" },
  "Прослушать": { en: "Listen", de: "Anhoeren" },
  "Удалить": { en: "Delete", de: "Loeschen" },
  "Отправить": { en: "Send", de: "Senden" },
  "Друзья и контакты": { en: "Friends and contacts", de: "Freunde und Kontakte" },
  "Закрыть": { en: "Close", de: "Schliessen" },
  "В друзьях — те, кого вы добавили и кто принял заявку. Переписка возможна и без этого; друзья видны в списке ниже.": {
    en: "Friends are those you added and who accepted your request. You can chat without this too; friends are listed below.",
    de: "Freunde sind die, die Sie hinzugefuegt haben und die Anfrage angenommen haben. Chatten geht auch ohne das; Freunde sind unten sichtbar.",
  },
  "Входящие заявки": { en: "Incoming requests", de: "Eingehende Anfragen" },
  "Исходящие заявки": { en: "Outgoing requests", de: "Ausgehende Anfragen" },
  "Друзья": { en: "Friends", de: "Freunde" },
  "Заблокированные": { en: "Blocked", de: "Blockiert" },
  "Голос Атона": { en: "ATEN Voice", de: "ATEN Stimme" },
  "🎙 Голосовое": { en: "🎙 Voice", de: "🎙 Sprache" },
  "Сообщение без текста": { en: "Message without text", de: "Nachricht ohne Text" },
  "Подключение…": { en: "Connecting…", de: "Verbindung…"},
  "Загружаем переписку…": { en: "Loading chats…", de: "Lade Chats…"},
  "Проверяем сессию…": { en: "Checking session…", de: "Sitzung wird geprueft…"},
  "Печатаете сообщение…": { en: "Typing a message…", de: "Nachricht wird getippt…"},
  "Запись… отпустите, чтобы остановить": {
    en: "Recording... release to stop",
    de: "Aufnahme... loslassen zum Stoppen",
  },
  "Текст — Enter. Голос — удерживайте кнопку с микрофоном, отпустите для отправки": {
    en: "Text: Enter. Voice: hold the mic button and release to send",
    de: "Text: Enter. Sprache: Mikro-Taste halten und zum Senden loslassen",
  },
  "Текст: ввод и Enter. Голос: удерживайте круглую кнопку с микрофоном, отпустите — отправка.": {
    en: "Text: type and press Enter. Voice: hold the round mic button, release to send.",
    de: "Text: eingeben und Enter. Sprache: runde Mikro-Taste halten, loslassen zum Senden.",
  },
  "Принять": { en: "Accept", de: "Annehmen" },
  "Отклонить": { en: "Decline", de: "Ablehnen" },
  "Отменить заявку": { en: "Cancel request", de: "Anfrage abbrechen" },
  "Разблокировать": { en: "Unblock", de: "Entsperren" },
  "Голос, не бот": { en: "Voice, not a bot", de: "Stimme, kein Bot" },
  "Голос Атона думает": { en: "ATEN Voice is thinking", de: "ATEN Stimme denkt nach" },
  "Настройте, как вы выглядите в Атоне.": {
    en: "Set up how you appear in ATEN.",
    de: "Stellen Sie ein, wie Sie in ATEN erscheinen.",
  },
  "Отправлено": { en: "Sent", de: "Gesendet" },
  "Доставлено": { en: "Delivered", de: "Zugestellt" },
  "Прочитано": { en: "Read", de: "Gelesen" },
  "Нет сообщений": { en: "No messages", de: "Keine Nachrichten" },
  "Загрузить старые сообщения": { en: "Load older messages", de: "Aeltere Nachrichten laden" },
  "Загрузка…": { en: "Loading...", de: "Wird geladen..." },
  "📷 Фото": { en: "📷 Photo", de: "📷 Foto" },
  "давно не был(а) в сети": { en: "last seen long ago", de: "lange nicht online" },
  "Статус скрыт": { en: "Status hidden", de: "Status verborgen" },
  "нет данных о последнем визите": { en: "no last seen data", de: "keine Last-Seen-Daten" },
  "онлайн": { en: "online", de: "online" },
  "Сейчас онлайн": { en: "Online now", de: "Jetzt online" },
  "Воспроизвести": { en: "Play", de: "Abspielen" },
  "Позиция воспроизведения": { en: "Playback position", de: "Wiedergabeposition" },
  "Пауза": { en: "Pause", de: "Pause" },
  "Не удалось загрузить": { en: "Failed to load", de: "Laden fehlgeschlagen" },
  "Нет сети или сервер не отвечает": { en: "No network or server unavailable", de: "Kein Netzwerk oder Server nicht erreichbar" },
  "Сервер слишком долго не отвечает. Подождите и обновите страницу.": {
    en: "The server is taking too long. Wait and refresh the page.",
    de: "Der Server braucht zu lange. Warten und Seite neu laden.",
  },
  "Сессия устарела. Войдите снова — так бывает, если вы входили с другого устройства или браузера.": {
    en: "Session expired. Please sign in again — this can happen if you signed in from another device or browser.",
    de: "Sitzung abgelaufen. Bitte erneut anmelden — das kann passieren, wenn Sie sich von einem anderen Geraet oder Browser angemeldet haben.",
  },
  "Ошибка соединения с сервером": { en: "Server connection error", de: "Serververbindungsfehler" },
  "Загрузка фото…": { en: "Loading photo…", de: "Foto wird geladen…" },
  "Загрузка голосового…": { en: "Loading voice message…", de: "Sprachnachricht wird geladen…" },
  "Укажите email, имя и дважды один и тот же пароль.": {
    en: "Enter email, username, and the same password twice.",
    de: "Bitte E-Mail, Benutzername und dasselbe Passwort zweimal eingeben.",
  },
  "Пароль должен содержать не менее 6 символов.": {
    en: "Password must be at least 6 characters.",
    de: "Das Passwort muss mindestens 6 Zeichen enthalten.",
  },
  "Пароли не совпадают. Введите их одинаково.": {
    en: "Passwords do not match. Enter them identically.",
    de: "Passwoerter stimmen nicht ueberein. Bitte identisch eingeben.",
  },
  "Аккаунт создан. Проверьте почту для подтверждения.": {
    en: "Account created. Check your email for verification.",
    de: "Konto erstellt. Bitte E-Mail zur Bestaetigung pruefen.",
  },
  "Введите email и пароль.": { en: "Enter email and password.", de: "E-Mail und Passwort eingeben." },
  "Вход выполнен.": { en: "Signed in.", de: "Angemeldet." },
  "был(а) в сети {minutes} мин назад": {
    en: "last seen {minutes} min ago",
    de: "zuletzt vor {minutes} Min online",
  },
  "был(а) в сети сегодня в {time}": {
    en: "last seen today at {time}",
    de: "zuletzt heute um {time} online",
  },
  "был(а) в сети вчера в {time}": {
    en: "last seen yesterday at {time}",
    de: "zuletzt gestern um {time} online",
  },
  "был(а) в сети {date}, {time}": {
    en: "last seen {date}, {time}",
    de: "zuletzt online {date}, {time}",
  },
  "был(а) в сети {date}": {
    en: "last seen {date}",
    de: "zuletzt online {date}",
  },
  "Чат": { en: "Chat", de: "Chat" },
  "Новое сообщение": { en: "New message", de: "Neue Nachricht" },
  "Голосовое сообщение": { en: "Voice message", de: "Sprachnachricht" },
  "Нет чата": { en: "No chat selected", de: "Kein Chat ausgewaehlt" },
  "Не удалось прочитать запись": { en: "Failed to read recording", de: "Aufnahme konnte nicht gelesen werden" },
  "Текст — Enter · голос — удерживайте микрофон": {
    en: "Text: Enter · voice: hold the mic",
    de: "Text: Enter · Sprache: Mikro gedrueckt halten",
  },
  "Не в сети": { en: "Offline", de: "Offline" },
  "В сети как {name}": { en: "Online as {name}", de: "Online als {name}" },
  "Недавно были в сети как {name}": {
    en: "Recently online as {name}",
    de: "Kuerzlich online als {name}",
  },
  "Верифицировано": { en: "Verified", de: "Verifiziert" },
  "Уведомления отключены": { en: "Notifications off", de: "Benachrichtigungen aus" },
  "канал": { en: "channel", de: "Kanal" },
  "группа": { en: "group", de: "Gruppe" },
  "создал": { en: "created by", de: "erstellt von" },
  "Открыть": { en: "Open", de: "Oeffnen" },
  "Включить уведомления": { en: "Turn notifications on", de: "Benachrichtigungen einschalten" },
  "Без звука и уведомлений": { en: "Mute sound and notifications", de: "Ton und Benachrichtigungen aus" },
  "Звук и уведомления снова включены для этого чата": {
    en: "Sound and notifications are on again for this chat",
    de: "Ton und Benachrichtigungen sind fuer diesen Chat wieder an",
  },
  "Для этого чата выключены звук и всплывающие уведомления": {
    en: "Sound and pop-up notifications are off for this chat",
    de: "Ton und Pop-up-Benachrichtigungen sind fuer diesen Chat aus",
  },
  "Пожаловаться": { en: "Report", de: "Melden" },
  "Ответить": { en: "Reply", de: "Antworten" },
  "Ответ на сообщение от {name}…": {
    en: "Replying to a message from {name}…",
    de: "Antwort auf eine Nachricht von {name}…",
  },
  "Ответ на сообщение": { en: "Replying to message", de: "Antwort auf Nachricht" },
  "Отменить ответ": { en: "Cancel reply", de: "Antwort abbrechen" },
  "Вы": { en: "You", de: "Sie" },
  "Редактировать": { en: "Edit", de: "Bearbeiten" },
  "Измените текст сообщения:": { en: "Edit message text:", de: "Nachrichtentext bearbeiten:" },
  "Снять закрепление": { en: "Unpin", de: "Fixierung aufheben" },
  "Закрепить сообщение": { en: "Pin message", de: "Nachricht fixieren" },
  "Удалить сообщение": { en: "Delete message", de: "Nachricht loeschen" },
  "Вы заблокировали этого пользователя. Разблокируйте его в контактах, чтобы писать.": {
    en: "You blocked this user. Unblock them in contacts to write.",
    de: "Sie haben diesen Benutzer blockiert. Entsperren Sie ihn in den Kontakten, um zu schreiben.",
  },
  "Не удалось прочитать изображение.": {
    en: "Failed to read the image.",
    de: "Bild konnte nicht gelesen werden.",
  },
  "Не удалось прочитать файл.": {
    en: "Failed to read the file.",
    de: "Datei konnte nicht gelesen werden.",
  },
  "Пользователи": { en: "Users", de: "Benutzer" },
  "В друзьях": { en: "Friends", de: "Freunde" },
  "Вы друзья": { en: "Friends", de: "Freunde" },
  "Заявка отправлена": { en: "Request sent", de: "Anfrage gesendet" },
  "Добавить в друзья": { en: "Add friend", de: "Als Freund hinzufuegen" },
  "Заблокировать": { en: "Block", de: "Blockieren" },
  "Написать": { en: "Message", de: "Schreiben" },
  "Мои чаты": { en: "My chats", de: "Meine Chats" },
  "Рекомендуемые чаты": { en: "Recommended chats", de: "Empfohlene Chats" },
  "не участник": { en: "not a member", de: "kein Mitglied" },
  "Вступить": { en: "Join", de: "Beitreten" },
  "Вступить в {type}": { en: "Join {type}", de: "{type} beitreten" },
  "Вступаем…": { en: "Joining…", de: "Beitritt…" },
  "Вы вступили в чат": { en: "You joined the chat", de: "Sie sind dem Chat beigetreten" },
  "Не удалось вступить в чат": { en: "Failed to join chat", de: "Beitritt fehlgeschlagen" },
  "Новый чат": { en: "New chat", de: "Neuer Chat" },
  "Выберите тип и введите название.": {
    en: "Choose a type and enter a title.",
    de: "Typ waehlen und Titel eingeben.",
  },
  "Тип": { en: "Type", de: "Typ" },
  "Доступ": { en: "Access", de: "Zugriff" },
  "Публичный": { en: "Public", de: "Oeffentlich" },
  "Приватный": { en: "Private", de: "Privat" },
  "Название": { en: "Title", de: "Titel" },
  "Например: «Песни о Фивах»": { en: "For example: \"Songs of Thebes\"", de: "Zum Beispiel: \"Lieder ueber Theben\"" },
  "Описание": { en: "Description", de: "Beschreibung" },
  "необязательно": { en: "optional", de: "optional" },
  "О чём этот чат?": { en: "What is this chat about?", de: "Worum geht es in diesem Chat?" },
  "Отмена": { en: "Cancel", de: "Abbrechen" },
  "Создать": { en: "Create", de: "Erstellen" },
  "В этом чате пока нет сообщений": { en: "There are no messages in this chat yet", de: "In diesem Chat gibt es noch keine Nachrichten" },
  "Напишите первое сообщение, чтобы начать диалог.": {
    en: "Write the first message to start the conversation.",
    de: "Schreiben Sie die erste Nachricht, um den Dialog zu starten.",
  },
  "приватный {type}": { en: "private {type}", de: "privater {type}" },
  "публичный {type}": { en: "public {type}", de: "oeffentlicher {type}" },
  "Чат закрытый. Попросите администратора выслать вам ссылку-приглашение.": {
    en: "This chat is private. Ask an administrator to send you an invite link.",
    de: "Dieser Chat ist privat. Bitten Sie einen Administrator um einen Einladungslink.",
  },
  "создан сегодня": { en: "created today", de: "heute erstellt" },
  "только что": { en: "just now", de: "gerade eben" },
  "{n} мин. назад": { en: "{n} min ago", de: "vor {n} Min." },
  "{n} ч. назад": { en: "{n} h ago", de: "vor {n} Std." },
  "вчера": { en: "yesterday", de: "gestern" },
  "участник": { en: "member", de: "Mitglied" },
  "участника": { en: "members", de: "Mitglieder" },
  "участников": { en: "members", de: "Mitglieder" },
  "Последнее сообщение": { en: "Last message", de: "Letzte Nachricht" },
  "Сообщений пока нет": { en: "No messages yet", de: "Noch keine Nachrichten" },
  "Вы сможете читать и отправлять сообщения": {
    en: "You will be able to read and send messages",
    de: "Sie koennen Nachrichten lesen und senden",
  },
  "Действия": { en: "Actions", de: "Aktionen" },
  "Сначала войдите или зарегистрируйтесь, чтобы создавать группы.": {
    en: "Sign in or create an account first to create groups.",
    de: "Melden Sie sich zuerst an oder registrieren Sie sich, um Gruppen zu erstellen.",
  },
  "Включить звук и уведомления для этого чата": {
    en: "Turn on sound and notifications for this chat",
    de: "Ton und Benachrichtigungen fuer diesen Chat einschalten",
  },
  "Выключить звук и уведомления для этого чата": {
    en: "Turn off sound and notifications for this chat",
    de: "Ton und Benachrichtigungen fuer diesen Chat ausschalten",
  },
  "Звук и уведомления снова включены": {
    en: "Sound and notifications are on again",
    de: "Ton und Benachrichtigungen sind wieder an",
  },
  "Для этого чата выключены звук и уведомления": {
    en: "Sound and notifications are off for this chat",
    de: "Ton und Benachrichtigungen sind fuer diesen Chat aus",
  },
  "Не удалось сохранить": { en: "Failed to save", de: "Speichern fehlgeschlagen" },
  "создатель": { en: "owner", de: "Ersteller" },
  "Удалить эту группу и её сообщения?": {
    en: "Delete this group and its messages?",
    de: "Diese Gruppe und ihre Nachrichten loeschen?",
  },
  "{n} в очереди": { en: "{n} queued", de: "{n} in der Warteschlange" },
  "изм.": { en: "edited", de: "bearbeitet" },
  "Показываемое имя ({name}) — изменить в вашем списке": {
    en: "Display name ({name}) - change in your list",
    de: "Anzeigename ({name}) - in Ihrer Liste aendern",
  },
  "Изменить отображаемое имя собеседника": {
    en: "Change contact display name",
    de: "Anzeigenamen des Kontakts aendern",
  },
  "Сохранено": { en: "Saved", de: "Gespeichert" },
  "Вы в друзьях": { en: "You are friends", de: "Sie sind befreundet" },
  "Пока никого нет. Отправьте заявку из поиска или из открытого чата.": {
    en: "No one yet. Send a request from search or from an open chat.",
    de: "Noch niemand da. Senden Sie eine Anfrage aus der Suche oder aus einem offenen Chat.",
  },
  "Уведомления не поддерживаются в этом браузере": {
    en: "Notifications are not supported in this browser",
    de: "Benachrichtigungen werden in diesem Browser nicht unterstuetzt",
  },
  "Под солнцем Ахетатона": { en: "Under the sun of Akhetaten", de: "Unter der Sonne von Achetaton" },
  "Спокойные диалоги — без лишнего шума": {
    en: "Calm conversations without extra noise",
    de: "Ruhige Dialoge ohne unnoetigen Laerm",
  },
  "Личные и групповые чаты в сдержанном интерфейсе. Меньше отвлечений — больше смысла в переписке.": {
    en: "Private and group chats in a restrained interface. Fewer distractions, more meaning in conversation.",
    de: "Private und Gruppen-Chats in einer ruhigen Oberflaeche. Weniger Ablenkung, mehr Sinn im Austausch.",
  },
  "Сначала войдите или зарегистрируйтесь.": {
    en: "Sign in or create an account first.",
    de: "Melden Sie sich zuerst an oder registrieren Sie sich.",
  },
  "Профиль пользователя": { en: "User profile", de: "Benutzerprofil" },
  "Настройки профиля": { en: "Profile settings", de: "Profileinstellungen" },
  "Профиль верифицирован": { en: "Profile verified", de: "Profil verifiziert" },
  "Профиль не верифицирован": { en: "Profile not verified", de: "Profil nicht verifiziert" },
  "Язык интерфейса": { en: "Interface language", de: "Sprache der Oberflaeche" },
  "Русский": { en: "Russian", de: "Russisch" },
  "Немецкий": { en: "German", de: "Deutsch" },
  "Английский": { en: "English", de: "Englisch" },
  "После смены языка страница обновится": {
    en: "The page will reload after changing language",
    de: "Nach dem Sprachwechsel wird die Seite neu geladen",
  },
  "Email аккаунта": { en: "Account email", de: "Konto-E-Mail" },
  "Email нельзя изменить": { en: "Email cannot be changed", de: "E-Mail kann nicht geaendert werden" },
  "Данные аккаунта": { en: "Account details", de: "Kontodaten" },
  "Загрузить аватар": { en: "Upload avatar", de: "Avatar hochladen" },
  "Отображаемое имя": { en: "Display name", de: "Anzeigename" },
  "Статус": { en: "Status", de: "Status" },
  "Например: «Пишу при свете Атена»": {
    en: "For example: \"Writing by ATEN's light\"",
    de: "Zum Beispiel: \"Ich schreibe im Licht ATENs\"",
  },
  "ID профиля": { en: "Profile ID", de: "Profil-ID" },
  "Удобный ID, по которому вас можно найти (@id)": {
    en: "A convenient ID people can find you by (@id)",
    de: "Eine praktische ID, unter der man Sie findet (@id)",
  },
  "ID может содержать латинские буквы, цифры, подчёркивание и дефис (3–32 символа). Должен быть уникальным.": {
    en: "ID can contain Latin letters, digits, underscore and hyphen (3-32 characters). It must be unique.",
    de: "Die ID darf lateinische Buchstaben, Zahlen, Unterstrich und Bindestrich enthalten (3-32 Zeichen). Sie muss eindeutig sein.",
  },
  "Сохранить": { en: "Save", de: "Speichern" },
  "Сначала войдите или зарегистрируйтесь — форма входа слева.": {
    en: "Sign in or create an account first - the form is on the left.",
    de: "Melden Sie sich zuerst an oder registrieren Sie sich - das Formular ist links.",
  },
  "Создать аккаунт": { en: "Create account", de: "Konto erstellen" },
  "Имя, email и пароль не менее 6 символов.": {
    en: "Username, email, and password of at least 6 characters.",
    de: "Name, E-Mail und Passwort mit mindestens 6 Zeichen.",
  },
  "Не удалось загрузить данные. Проверьте сеть и обновите страницу.": {
    en: "Failed to load data. Check the network and refresh the page.",
    de: "Daten konnten nicht geladen werden. Pruefen Sie die Verbindung und aktualisieren Sie die Seite.",
  },
  "Нет сети — подключаемся, как только сеть появится": {
    en: "Offline - reconnecting as soon as the network is back",
    de: "Offline - Verbindung wird wiederhergestellt, sobald das Netzwerk zurueck ist",
  },
  "Проблема с подключением": {
    en: "Connection problem",
    de: "Verbindungsproblem",
  },
  "Войдите по форме слева": {
    en: "Sign in using the form on the left",
    de: "Melden Sie sich ueber das Formular links an",
  },
  "После входа здесь появятся ваши чаты.": {
    en: "Your chats will appear here after sign-in.",
    de: "Nach der Anmeldung erscheinen hier Ihre Chats.",
  },
  "Групповой чат": { en: "Group chat", de: "Gruppenchat" },
  "не участник": { en: "not a member", de: "kein Mitglied" },
  "Предпросмотр чата": { en: "Chat preview", de: "Chat-Vorschau" },
  "Личный диалог": { en: "Private chat", de: "Privater Dialog" },
  "Добро пожаловать": { en: "Welcome", de: "Willkommen" },
  "Выберите чат или пользователя слева": {
    en: "Choose a chat or user on the left",
    de: "Waehlen Sie links einen Chat oder Nutzer",
  },
  "Выберите чат": { en: "Choose a chat", de: "Chat auswaehlen" },
  "Откройте диалог слева или найдите пользователя по @username.": {
    en: "Open a conversation on the left or find a user by @username.",
    de: "Oeffnen Sie links einen Dialog oder suchen Sie einen Nutzer per @username.",
  },
  "Голос Атона думает": { en: "ATEN Voice is thinking", de: "ATEN Stimme denkt nach" },
  "Часто 3–15 с; с голосом дольше — распознавание, ответ и озвучка. Ниже в ленте.": {
    en: "Usually 3-15 sec; voice takes longer for recognition, reply, and speech. It will appear below in the feed.",
    de: "Meist 3-15 Sek.; mit Stimme dauert es laenger fuer Erkennung, Antwort und Sprachausgabe. Es erscheint unten im Verlauf.",
  },
  "Ниже — лента. Пиши в поле или удерживай круглую кнопку с микрофоном.": {
    en: "The feed is below. Type in the field or hold the round mic button.",
    de: "Der Verlauf ist unten. Schreiben Sie ins Feld oder halten Sie die runde Mikrofontaste.",
  },
  "Ответы приходят сообщениями в ленту, не потоком в реальном времени.": {
    en: "Replies arrive as messages in the feed, not as a live stream.",
    de: "Antworten kommen als Nachrichten im Verlauf, nicht als Live-Stream.",
  },
  "Поле ввода": { en: "Input field", de: "Eingabefeld" },
  "Участники": { en: "Members", de: "Mitglieder" },
  "Добавляйте по @username. Создателя нельзя удалить.": {
    en: "Add by @username. The owner cannot be removed.",
    de: "Per @username hinzufuegen. Der Ersteller kann nicht entfernt werden.",
  },
  "Добавить": { en: "Add", de: "Hinzufuegen" },
  "Введите @username": { en: "Enter @username", de: "@username eingeben" },
  "Выберите участника": { en: "Choose a member", de: "Mitglied auswaehlen" },
  "Нельзя удалить создателя чата": {
    en: "The chat owner cannot be removed",
    de: "Der Chat-Ersteller kann nicht entfernt werden",
  },
  "Принцип, не служба": { en: "Principle, not service", de: "Prinzip, kein Dienst" },
  "Голос из позиции Атона — не помощник и не сервис": {
    en: "A voice from ATEN's position - not an assistant or a service",
    de: "Eine Stimme aus ATENs Position - kein Assistent und kein Dienst",
  },
  "Когда вкладка в фоне, вы будете видеть уведомления о сообщениях": {
    en: "When the tab is in the background, you will see message notifications",
    de: "Wenn der Tab im Hintergrund ist, sehen Sie Nachrichtenbenachrichtigungen",
  },
  "Разрешите уведомления в настройках сайта в браузере": {
    en: "Allow notifications in the browser site settings",
    de: "Erlauben Sie Benachrichtigungen in den Website-Einstellungen des Browsers",
  },
  "Звук и уведомления снова включены": {
    en: "Sound and notifications are on again",
    de: "Ton und Benachrichtigungen sind wieder an",
  },
  "Для этого чата выключены звук и уведомления": {
    en: "Sound and notifications are off for this chat",
    de: "Ton und Benachrichtigungen sind fuer diesen Chat aus",
  },
  "Заявка принята": { en: "Request accepted", de: "Anfrage angenommen" },
  "Жалоба отправлена": { en: "Report sent", de: "Meldung gesendet" },
  "Скопировать ссылку приглашения": {
    en: "Copy invite link",
    de: "Einladungslink kopieren",
  },
  "Ссылка скопирована": { en: "Link copied", de: "Link kopiert" },
  "Слишком короткое сообщение": {
    en: "Message is too short",
    de: "Nachricht ist zu kurz",
  },
  "Приглашение недоступно": {
    en: "Invite unavailable",
    de: "Einladung nicht verfuegbar",
  },
  "Ссылка недействительна": {
    en: "Invalid link",
    de: "Ungueltiger Link",
  },
  "Не удалось запросить разрешение": {
    en: "Failed to request permission",
    de: "Berechtigung konnte nicht angefragt werden",
  },
  "Не удалось отправить": { en: "Failed to send", de: "Senden fehlgeschlagen" },
  "Не удалось получить доступ к микрофону.": {
    en: "Failed to access the microphone.",
    de: "Zugriff auf das Mikrofon fehlgeschlagen.",
  },
  "Ошибка": { en: "Error", de: "Fehler" },
  "Оставить реакцию": { en: "Add reaction", de: "Reaktion hinzufuegen" },
  "Изменить реакцию": { en: "Change reaction", de: "Reaktion aendern" },
  "Не удалось запустить мессенджер. Обновите страницу (Ctrl+F5) или зайдите позже. Если снова так — откройте консоль (F12) и сделайте скриншот.": {
    en: "Failed to start the messenger. Refresh the page (Ctrl+F5) or try again later. If it happens again, open the console (F12) and take a screenshot.",
    de: "Messenger konnte nicht gestartet werden. Aktualisieren Sie die Seite (Ctrl+F5) oder versuchen Sie es spaeter erneut. Wenn es wieder passiert, oeffnen Sie die Konsole (F12) und machen Sie einen Screenshot.",
  },
  "Email подтверждён! Добро пожаловать.": {
    en: "Email verified. Welcome.",
    de: "E-Mail bestaetigt. Willkommen.",
  },
};

function detectPreferredLanguage() {
  let saved = null;
  try {
    saved = localStorage.getItem(LANG_KEY);
  } catch {}
  if (saved === "ru" || saved === "en" || saved === "de") return saved;
  const browserLangs = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || ""];
  const normalized = browserLangs.map((lang) => String(lang || "").toLowerCase());
  if (normalized.some((lang) => lang.startsWith("de"))) return "de";
  if (normalized.some((lang) => lang.startsWith("en"))) return "en";
  return "ru";
}

let currentLang = detectPreferredLanguage();
document.documentElement.lang = currentLang === "en" ? "en-GB" : currentLang;

function applyDocumentLanguageMeta() {
  const titles = {
    ru: "Атон — веб‑мессенджер для личных и групповых диалогов",
    en: "ATEN — web messenger for private and group chats",
    de: "ATEN — Web-Messenger fuer private und Gruppen-Chats",
  };
  document.title = titles[currentLang] || titles.ru;
}
applyDocumentLanguageMeta();

function t(ruText) {
  if (currentLang === "ru") return ruText;
  const dict = I18N[ruText];
  return (dict && dict[currentLang]) || ruText;
}

function tf(ruTemplate, vars = {}) {
  const base = t(ruTemplate);
  return base.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])));
}

function setLanguage(nextLang) {
  if (!nextLang || nextLang === currentLang) return;
  currentLang = nextLang;
  try {
    localStorage.setItem(LANG_KEY, currentLang);
  } catch {}
  document.documentElement.lang = currentLang === "en" ? "en-GB" : currentLang;
  applyDocumentLanguageMeta();
}

function translateExactText(value) {
  if (!value || currentLang === "ru") return value;
  const direct = I18N[value];
  if (direct && direct[currentLang]) return direct[currentLang];
  return value;
}

function translateDom(root) {
  if (!root || currentLang === "ru") return;
  const attrs = ["title", "placeholder", "aria-label"];

  const walkElement = (el) => {
    for (const attr of attrs) {
      const raw = el.getAttribute(attr);
      if (!raw) continue;
      const next = translateExactText(raw);
      if (next !== raw) el.setAttribute(attr, next);
    }
  };

  if (root.nodeType === Node.ELEMENT_NODE) walkElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.nodeValue;
      if (raw && raw.trim()) {
        const leading = raw.match(/^\s*/)?.[0] || "";
        const trailing = raw.match(/\s*$/)?.[0] || "";
        const core = raw.trim();
        const nextCore = translateExactText(core);
        if (nextCore !== core) node.nodeValue = `${leading}${nextCore}${trailing}`;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      walkElement(node);
    }
    node = walker.nextNode();
  }
}

function persistSessionSnapshot(u) {
  if (!u || typeof u !== "object" || !u.username) return;
  try {
    sessionStorage.setItem(
      SESSION_ME_CACHE_KEY,
      JSON.stringify({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        publicId: u.publicId,
        avatarDataUrl: u.avatarDataUrl,
        verified: Boolean(u.verified),
        isSuperAdmin: typeof u.isSuperAdmin === "boolean" ? u.isSuperAdmin : undefined,
      })
    );
  } catch (_) {}
}

function readSessionSnapshot() {
  try {
    const raw = sessionStorage.getItem(SESSION_ME_CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && typeof o === "object" && o.username ? o : null;
  } catch {
    return null;
  }
}

/** Снимок чатов + сообщений для мгновенного списка при F5 (потом подменяется API). */
const LIST_BOOTSTRAP_CACHE_KEY = "aton_list_bootstrap_v1";

function readListBootstrapCache(username) {
  if (!username) return null;
  try {
    const raw = sessionStorage.getItem(LIST_BOOTSTRAP_CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || o.u !== username || !Array.isArray(o.c) || !Array.isArray(o.m)) return null;
    return { chats: o.c, messages: o.m };
  } catch {
    return null;
  }
}

function persistListBootstrapCache(username, chats, messages) {
  if (!username) return;
  try {
    sessionStorage.setItem(
      LIST_BOOTSTRAP_CACHE_KEY,
      JSON.stringify({ u: username, c: chats, m: messages, at: Date.now() })
    );
  } catch (e) {
    console.warn("list bootstrap cache:", e?.message || e);
  }
}

function clearSessionSnapshot() {
  try {
    sessionStorage.removeItem(SESSION_ME_CACHE_KEY);
    sessionStorage.removeItem(LIST_BOOTSTRAP_CACHE_KEY);
  } catch (_) {}
}

// Базовый URL API и WebSocket (один и тот же хост, что и Socket.io на бэкенде).
// 1) localhost / 127.0.0.1 сначала — локальный :3000 не перекрывается meta.
// 2) <meta name="aton-api-base"> — прод-API (в index.html) или пусто.
// 3) известные домены фронта — fallback на Render.
// 4) иначе :3000 на том же host.
function getApiBase() {
  const host = window.location.hostname || "";
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    const origin = window.location.origin || "";
    if (origin.endsWith(":3000")) return "";
    return `${window.location.protocol}//${host}:3000`;
  }
  const meta = document.querySelector('meta[name="aton-api-base"]')?.getAttribute("content")?.trim();
  if (meta) return meta.replace(/\/$/, "");
  if (host === "aten.vadzim.by" || host === "www.aten.vadzim.by") {
    return "https://aton-api.onrender.com";
  }
  const origin = window.location.origin;
  if (!origin) return "";
  if (origin.endsWith(":3000")) return "";
  return `${window.location.protocol}//${host}:3000`;
}

const API_BASE = getApiBase();

/** Без таймаута зависший fetch к API блокирует bootstrap и экран «замирает». */
const DEFAULT_API_FETCH_TIMEOUT_MS = 55_000;
/** Чат с фото/голосом — до ~10 МБ JSON; через tunnel может грузиться 30–60 с. */
const MEDIA_API_FETCH_TIMEOUT_MS = 120_000;

function apiFetchTimeoutMs(path, explicit) {
  if (explicit != null) return explicit;
  const p = String(path || "").split("?")[0];
  if (p === "/api/messages" || p === "/api/messages/read") return MEDIA_API_FETCH_TIMEOUT_MS;
  return DEFAULT_API_FETCH_TIMEOUT_MS;
}

const socket = API_BASE
  ? io(API_BASE, { auth: { token: getToken() || "" } })
  : io({ auth: { token: getToken() || "" } });
const LOCAL_PINS_KEY = "aton_pinned_chats";
const LOCAL_READS_KEY = "aton_chat_reads";
const LAST_CHAT_KEY_PREFIX = "aton_last_chat_";
/** Локально: для каких chatId отключены звук и всплывающие уведомления */
const LOCAL_NOTIFY_MUTED_KEY = "aton_notify_muted_chats";
/** Локально: как показывать себе своё имя в интерфейсе (не уходит на сервер). Ключ: aton_local_self_label_<username> */
const LOCAL_SELF_LABEL_PREFIX = "aton_local_self_label_";

function getLocalSelfDisplayName(username) {
  if (!username) return "";
  try {
    const v = localStorage.getItem(LOCAL_SELF_LABEL_PREFIX + username);
    return v ? String(v).trim() : "";
  } catch {
    return "";
  }
}

function setLocalSelfDisplayName(username, label) {
  if (!username) return;
  const key = LOCAL_SELF_LABEL_PREFIX + username;
  const t = String(label || "").trim();
  if (t) localStorage.setItem(key, t);
  else localStorage.removeItem(key);
}

/** Имя текущего пользователя в UI: локальная подмена или данные профиля. */
function selfDisplayNameForUi(user, full) {
  if (!user) return "";
  const local = getLocalSelfDisplayName(user.username);
  if (local) return local;
  const base = full || user;
  return base.displayName || base.username || "";
}

/** Локальные имена: legacy в localStorage; приоритет — peerAliases в аккаунте (сервер, все устройства). */
const LOCAL_PEER_ALIASES_PREFIX = "aton_peer_aliases_";
const gPeerAliasState = { getUser: () => null };

function normalizePeerAliasesClient(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== "string" || k.length > 200) continue;
    if (typeof v !== "string" || !v.trim()) continue;
    out[k] = v.trim();
  }
  return out;
}

function assignPeerAliasesOnUser(u) {
  if (!u || typeof u !== "object") return;
  u.peerAliases = normalizePeerAliasesClient(u.peerAliases);
}

/** Псевдоним по peerUsername, если в map ключи отличались регистром от username в чате. */
function getPeerAliasValue(map, peerUsername) {
  if (!peerUsername || !map || typeof map !== "object") return "";
  const s = String(peerUsername);
  if (Object.prototype.hasOwnProperty.call(map, s) && String(map[s] || "").trim()) {
    return String(map[s]).trim();
  }
  const low = s.toLowerCase();
  for (const k of Object.keys(map)) {
    if (k.toLowerCase() === low && String(map[k] || "").trim()) return String(map[k]).trim();
  }
  return "";
}

function getPeerAliasesMap(myUsername) {
  if (!myUsername) return {};
  const u = gPeerAliasState.getUser();
  const fromServer =
    u &&
    u.username === myUsername &&
    u.peerAliases &&
    typeof u.peerAliases === "object" &&
    !Array.isArray(u.peerAliases)
      ? normalizePeerAliasesClient(u.peerAliases)
      : {};
  let fromLocal = {};
  try {
    const raw = localStorage.getItem(LOCAL_PEER_ALIASES_PREFIX + myUsername);
    const o = raw ? JSON.parse(raw) : {};
    fromLocal = o && typeof o === "object" && !Array.isArray(o) ? normalizePeerAliasesClient(o) : {};
  } catch {
    fromLocal = {};
  }
  return { ...fromLocal, ...fromServer };
}

async function setPeerAlias(myUsername, peerUsername, alias) {
  if (!myUsername || !peerUsername) return;
  const t = String(alias || "").trim();
  const me = gPeerAliasState.getUser();
  if (getToken() && me && me.username === myUsername) {
    try {
      const r = await api("/api/peer-alias", {
        method: "PUT",
        body: JSON.stringify({ peerUsername, alias: t || null }),
      });
      if (r.peerAliases) {
        me.peerAliases = normalizePeerAliasesClient(r.peerAliases);
      }
      return;
    } catch (e) {
      console.error("setPeerAlias API:", e);
    }
  }
  const map = { ...getPeerAliasesMap(myUsername) };
  if (t) map[peerUsername] = t;
  else delete map[peerUsername];
  try {
    localStorage.setItem(LOCAL_PEER_ALIASES_PREFIX + myUsername, JSON.stringify(map));
  } catch (_) {}
}

/** Как показывать собеседника вам: локальный псевдоним или профиль / username. */
function displayNameForPeer(myUsername, peerUsername, peerUser) {
  if (!peerUsername) return peerUser?.displayName || "";
  if (!myUsername) return peerUser?.displayName || peerUsername;
  const map = getPeerAliasesMap(myUsername);
  const alias = getPeerAliasValue(map, peerUsername);
  if (alias) return alias;
  if (peerUsername === GOLOS_ATON_USERNAME) return t("Голос Атона");
  return peerUser?.displayName || peerUsername;
}

function getNotifyMutedMap(username) {
  if (!username) return {};
  const raw = localStorage.getItem(LOCAL_NOTIFY_MUTED_KEY);
  try {
    const obj = raw ? JSON.parse(raw) : {};
    return obj[username] && typeof obj[username] === "object" ? obj[username] : {};
  } catch {
    return {};
  }
}

function isChatNotifyMuted(username, chatId) {
  if (!username || !chatId) return false;
  return Boolean(getNotifyMutedMap(username)[chatId]);
}

function setChatNotifyMuted(username, chatId, muted) {
  if (!username || !chatId) return;
  const raw = localStorage.getItem(LOCAL_NOTIFY_MUTED_KEY);
  let obj = {};
  try {
    obj = raw ? JSON.parse(raw) : {};
  } catch {
    obj = {};
  }
  if (!obj[username]) obj[username] = {};
  if (muted) obj[username][chatId] = true;
  else delete obj[username][chatId];
  localStorage.setItem(LOCAL_NOTIFY_MUTED_KEY, JSON.stringify(obj));
}

function chatIdForUsers(a, b) {
  const arr = [a, b].sort();
  return arr.join("|");
}

/** Личный диалог 1:1 (`userA|userB`), не группа/канал/global — в треде как в Telegram: без имён и аватаров в пузырях. */
function isPrivateDirectChat(chatId) {
  if (!chatId || typeof chatId !== "string") return false;
  if (chatId === "global") return false;
  if (chatId.startsWith("group:") || chatId.startsWith("channel:")) return false;
  return chatId.includes("|");
}

/** Сообщение относится к личному чату user|user (учёт рассинхрона chatId в БД). */
function messageBelongsToDmId(msg, dmId) {
  if (!dmId || typeof dmId !== "string" || !dmId.includes("|")) return false;
  if (msg.chatId === dmId) return true;
  if (msg.to && chatIdForUsers(msg.from, msg.to) === dmId) return true;
  return false;
}

/** Сообщение относится к чату, для которого пришла свежая выборка (GET/ read) — для безопасного мержа без схлопывания Map по id. */
function messageBelongsToOpenChat(m, chatId) {
  if (!m || !chatId) return false;
  if (isPrivateDirectChat(chatId)) return messageBelongsToDmId(m, chatId);
  return m.chatId === chatId;
}

/**
 * Серверный снимок + уже показанный у клиента: не терять data URL, если в ответе API поле пустое (гонка/сбой записи).
 */
function mergeMessagePreserveMedia(serverMsg, clientMsg) {
  if (!serverMsg) return clientMsg;
  if (!clientMsg || String(serverMsg.id) !== String(clientMsg.id)) return serverMsg;
  const out = { ...serverMsg };
  if ((!out.imageDataUrl || !String(out.imageDataUrl).trim()) && clientMsg.imageDataUrl) {
    const c = String(clientMsg.imageDataUrl).trim();
    if (c) out.imageDataUrl = clientMsg.imageDataUrl;
  }
  if ((!out.audioDataUrl || !String(out.audioDataUrl).trim()) && clientMsg.audioDataUrl) {
    const c = String(clientMsg.audioDataUrl).trim();
    if (c) out.audioDataUrl = clientMsg.audioDataUrl;
  }
  return out;
}

/**
 * Подменяет в allMessages только один чат; остальные треды не трогает.
 * Оптимистичные _temp_ для этого чата оставляем, если сервер ещё не прислал замену.
 */
function applyMessagesForChatInAll(currentAll, chatId, freshList) {
  const fresh = Array.isArray(freshList) ? freshList : [];
  const rest = currentAll.filter((m) => !messageBelongsToOpenChat(m, chatId));
  const priorById = new Map();
  for (const m of currentAll) {
    if (!messageBelongsToOpenChat(m, chatId) || m == null || m.id == null) continue;
    priorById.set(String(m.id), m);
  }
  const freshMerged = fresh.map((fm) => {
    if (!fm || fm.id == null) return fm;
    const cm = priorById.get(String(fm.id));
    return cm ? mergeMessagePreserveMedia(fm, cm) : fm;
  });
  const pendingTemp = currentAll.filter(
    (m) =>
      messageBelongsToOpenChat(m, chatId) &&
      m != null &&
      m.id != null &&
      String(m.id).startsWith("_temp_")
  );
  const freshIds = new Set(freshMerged.map((m) => m && m.id).filter(Boolean));
  const keepTemp = pendingTemp.filter((m) => m.id && !freshIds.has(m.id));
  /* Сообщения ветки уже в памяти (сокет и т.д.), но не в выборке API — иначе после pull/receipt
     пузыри исчезают (рассинхрон chatId в БД, гонка, обрезка /messages/all). */
  const localOnly = currentAll.filter(
    (m) =>
      messageBelongsToOpenChat(m, chatId) &&
      m &&
      m.id &&
      !String(m.id).startsWith("_temp_") &&
      !freshIds.has(m.id)
  );
  const seen = new Set();
  const merged = [];
  for (const m of [...freshMerged, ...keepTemp, ...localOnly]) {
    if (!m || m.id == null) continue;
    const id = String(m.id);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(m);
  }
  return [...rest, ...merged].sort((a, b) => new Date(a.time) - new Date(b.time));
}

function prependMessagesForChatInAll(currentAll, chatId, olderList) {
  const older = Array.isArray(olderList) ? olderList : [];
  if (!older.length) return currentAll;
  const rest = currentAll.filter((m) => !messageBelongsToOpenChat(m, chatId));
  const thread = currentAll.filter((m) => messageBelongsToOpenChat(m, chatId));
  const byId = new Map();
  for (const m of [...older, ...thread]) {
    if (!m || m.id == null) continue;
    const id = String(m.id);
    const existing = byId.get(id);
    byId.set(id, existing ? mergeMessagePreserveMedia(m, existing) : m);
  }
  const mergedThread = [...byId.values()].sort((a, b) => new Date(a.time) - new Date(b.time));
  return [...rest, ...mergedThread].sort((a, b) => new Date(a.time) - new Date(b.time));
}

/** Сравнение login без регистра/пробелов — иначе «свои»/«чужие» пузыри в треде путаются */
function sameAtonUsername(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

/** Своё сообщение: в личке при совпадении from с id второго участника ветки — жёстко «входящее» */
function isMessageFromSelf(msg, me, activeChatId) {
  if (!me) return false;
  if (sameAtonUsername(msg.from, me.username)) return true;
  if (isPrivateDirectChat(activeChatId)) {
    const parts = String(activeChatId).split("|");
    if (parts.length === 2) {
      const a = parts[0];
      const b = parts[1];
      const inPair = sameAtonUsername(a, me.username) || sameAtonUsername(b, me.username);
      if (inPair) {
        const other = sameAtonUsername(a, me.username) ? b : a;
        if (sameAtonUsername(msg.from, other)) return false;
      }
    }
  }
  return false;
}

/**
 * Галочки исходящих в личке, ближе к Telegram:
 * одна серая ✓ — отправлено/доставлено; две синие ✓✓ — прочитано.
 */
function messageAckHtml(status) {
  const s = status === "delivered" || status === "read" || status === "sent" ? status : "sent";
  if (s === "sent" || s === "delivered") {
    const label = s === "delivered" ? t("Доставлено") : t("Отправлено");
    return `<span class="aton-message-ack" title="${escHtml(label)}" aria-label="${escHtml(label)}"><span class="aton-message-ack-tick" aria-hidden="true">✓</span></span>`;
  }
  return `<span class="aton-message-ack aton-message-ack--read" title="${escHtml(t("Прочитано"))}" aria-label="${escHtml(t("Прочитано"))}"><span class="aton-message-ack-tick" aria-hidden="true">✓</span><span class="aton-message-ack-tick" aria-hidden="true">✓</span></span>`;
}

function safeDataMessageIdForSelector(id) {
  if (id == null) return "";
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(String(id));
  return String(id).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Якорь для восстановления позиции после полной перерисовки ленты (без автоскролла вниз).
 */
function captureMessagesScrollSnapshot(el) {
  if (!el || !el.querySelector(".aton-message-row")) {
    return null;
  }
  const { scrollTop, scrollHeight } = el;
  const mRect = el.getBoundingClientRect();
  for (const row of el.querySelectorAll(".aton-message-row")) {
    const id = row.getAttribute("data-message-id");
    if (!id) continue;
    const br = row.getBoundingClientRect();
    if (br.bottom > mRect.top + 2) {
      return {
        kind: "anchor",
        id,
        offsetInView: br.top - mRect.top,
        scrollTop,
        scrollHeight,
      };
    }
  }
  return null;
}

/**
 * «У низа»: как в Telegram / WhatsApp (небольшой порог, без привязки к React — проект на ванили).
 * @see main.js: scrollMessagesListToBottomRaf, renderMessages
 */
const CHAT_SCROLL_BOTTOM_THRESHOLD_PX = 50;

function isMessagesListAtBottom(el) {
  if (!el) return true;
  const { scrollTop, scrollHeight, clientHeight } = el;
  if (scrollHeight <= clientHeight + 1) return true;
  return scrollHeight - scrollTop - clientHeight < CHAT_SCROLL_BOTTOM_THRESHOLD_PX;
}

/** Запасной снимок, если сменились data-message-id (например _temp_ → id) */
function captureMessagesScrollRatio(el) {
  if (!el) return null;
  const maxS = el.scrollHeight - el.clientHeight;
  if (maxS <= 0) return { kind: "ratio", ratio: 0 };
  return { kind: "ratio", ratio: el.scrollTop / maxS };
}

function applyMessagesScrollRatio(el, snap) {
  if (!el || !snap || snap.kind !== "ratio" || typeof snap.ratio !== "number") {
    return false;
  }
  const maxS = Math.max(0, el.scrollHeight - el.clientHeight);
  const r = Math.max(0, Math.min(1, snap.ratio));
  el.scrollTop = maxS * r;
  return true;
}

function applyMessagesScrollSnapshot(el, snap) {
  if (!el) return false;
  if (!snap || snap.kind !== "anchor" || !snap.id) {
    return false;
  }
  const row = el.querySelector(`[data-message-id="${safeDataMessageIdForSelector(snap.id)}"]`);
  if (!row) {
    return false;
  }
  const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
  const nextTop = row.offsetTop - snap.offsetInView;
  if (nextTop < 0) {
    return false; // только applyMessagesScrollRatio, без гибрида в одном кадре
  }
  el.scrollTop = Math.min(maxScroll, nextTop);
  return true;
}

/**
 * Один путь после innerHTML: либо якорь, либо доля — никогда оба.
 * @returns {boolean} удалось ли выставить скролл
 */
function restoreMessagesScrollAfterRerender(el, anchorSnap, ratioSnap) {
  if (anchorSnap && applyMessagesScrollSnapshot(el, anchorSnap)) {
    return true;
  }
  if (ratioSnap && applyMessagesScrollRatio(el, ratioSnap)) {
    return true;
  }
  return false;
}

function lastActivityAtForDmChatId(dmId, messages) {
  let max = 0;
  if (!Array.isArray(messages)) return 0;
  for (const m of messages) {
    if (!m || !m.time) continue;
    if (!messageBelongsToDmId(m, dmId)) continue;
    const t = new Date(m.time).getTime();
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max;
}

function lastActivityAtForGroupChatId(chatId, messages) {
  let max = 0;
  if (!Array.isArray(messages) || !chatId) return 0;
  for (const m of messages) {
    if (!m || m.chatId !== chatId || !m.time) continue;
    const t = new Date(m.time).getTime();
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max;
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTimeLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Сайдбар: сегодня — только часы, иначе дата (коротко) + время. */
function formatChatListMessageTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const locale = currentLang === "de" ? "de-DE" : currentLang === "en" ? "en-GB" : "ru-RU";
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  if (startOfDay(d).getTime() === startOfDay(now).getTime()) {
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  const dateOpts = { day: "numeric", month: "short" };
  if (d.getFullYear() !== now.getFullYear()) dateOpts.year = "numeric";
  return (
    d.toLocaleDateString(locale, dateOpts) +
    ", " +
    d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  );
}

function chatListPreviewWords(text, maxWords) {
  const n = maxWords == null ? 5 : maxWords;
  if (!text || typeof text !== "string") return "";
  const words = String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  if (words.length <= n) return words.join(" ");
  return words.slice(0, n).join(" ") + "…";
}

function buildLastMessagePreviewForChatList(lastMsg) {
  if (!lastMsg) return t("Нет сообщений");
  let tag = "";
  if (lastMsg.type === "image") tag = "📷";
  else if (lastMsg.type === "audio") tag = "🎙";
  const raw = (lastMsg.text && String(lastMsg.text).trim()) || "";
  if (raw) {
    const short = chatListPreviewWords(raw, 5);
    return tag ? `${tag} ${short}` : short;
  }
  if (lastMsg.type === "image") return t("📷 Фото");
  if (lastMsg.type === "audio") return t("🎙 Голосовое");
  return t("Сообщение без текста");
}

/** Статус «был в сети» для шапки и списка личных чатов. При blockedMe не показываем реальный lastSeen. */
function formatPeerPresence(peerUser) {
  const blockedMe = Boolean(peerUser && peerUser.blockedMe);
  if (blockedMe) {
    return {
      text: t("давно не был(а) в сети"),
      online: false,
      title: t("Статус скрыт"),
    };
  }
  const iso = peerUser && peerUser.lastSeen;
  if (!iso) {
    return {
      text: t("нет данных о последнем визите"),
      online: false,
      title: "",
    };
  }
  const seenAt = new Date(iso).getTime();
  if (Number.isNaN(seenAt)) {
    return {
      text: t("нет данных о последнем визите"),
      online: false,
      title: "",
    };
  }
  const diff = Date.now() - seenAt;
  const ONLINE_MS = 60 * 1000;
  if (diff < ONLINE_MS) {
    return { text: t("онлайн"), online: true, title: t("Сейчас онлайн") };
  }
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const dayDiff = Math.round(
    (startOfDay(now) - startOfDay(d)) / 86400000
  );
  let detail;
  if (diff < 60 * 60 * 1000) {
    const m = Math.max(1, Math.floor(diff / 60000));
    detail = tf("был(а) в сети {minutes} мин назад", { minutes: m });
  } else if (dayDiff === 0) {
    detail = tf("был(а) в сети сегодня в {time}", {
      time: d.toLocaleTimeString(currentLang === "de" ? "de-DE" : currentLang === "en" ? "en-GB" : "ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  } else if (dayDiff === 1) {
    detail = tf("был(а) в сети вчера в {time}", {
      time: d.toLocaleTimeString(currentLang === "de" ? "de-DE" : currentLang === "en" ? "en-GB" : "ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  } else if (dayDiff < 7) {
    detail = tf("был(а) в сети {date}, {time}", {
      date: d.toLocaleDateString(currentLang === "de" ? "de-DE" : currentLang === "en" ? "en-GB" : "ru-RU", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      time: d.toLocaleTimeString(currentLang === "de" ? "de-DE" : currentLang === "en" ? "en-GB" : "ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  } else if (d.getFullYear() === now.getFullYear()) {
    detail = tf("был(а) в сети {date}", {
      date: d.toLocaleDateString(currentLang === "de" ? "de-DE" : currentLang === "en" ? "en-GB" : "ru-RU", {
        day: "numeric",
        month: "long",
      }),
    });
  } else {
    detail = tf("был(а) в сети {date}", {
      date: d.toLocaleDateString(currentLang === "de" ? "de-DE" : currentLang === "en" ? "en-GB" : "ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    });
  }
  return { text: detail, online: false, title: detail };
}

function formatVoiceDuration(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function pauseOtherVoiceAudios(except) {
  document.querySelectorAll("audio.aton-voice-audio").forEach((a) => {
    if (a !== except && !a.paused) a.pause();
  });
}

/** Кастомный плеер голосового (без нативных controls). */
function createVoicePlayer(audioSrc, isSelf) {
  const wrap = document.createElement("div");
  wrap.className =
    "aton-voice-player" + (isSelf ? " aton-voice-player--self" : "");

  const audio = document.createElement("audio");
  audio.className = "aton-voice-audio";
  audio.preload = "auto";
  audio.setAttribute("playsinline", "");
  audio.src = audioSrc;

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "aton-voice-play";
  playBtn.setAttribute("aria-label", t("Воспроизвести"));
  playBtn.innerHTML =
    '<svg class="aton-voice-icon aton-voice-icon--play" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>' +
    '<svg class="aton-voice-icon aton-voice-icon--pause" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M6 6h4v12H6V6zm8 0h4v12h-4V6z"/></svg>';

  const main = document.createElement("div");
  main.className = "aton-voice-main";

  const track = document.createElement("div");
  track.className = "aton-voice-track";
  track.setAttribute("role", "slider");
  track.setAttribute("tabindex", "0");
  track.setAttribute("aria-label", t("Позиция воспроизведения"));
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", "0");

  const trackFill = document.createElement("div");
  trackFill.className = "aton-voice-progress-fill";

  const timeEl = document.createElement("div");
  timeEl.className = "aton-voice-time";
  timeEl.textContent = "…";

  track.appendChild(trackFill);
  main.appendChild(track);
  main.appendChild(timeEl);
  wrap.appendChild(playBtn);
  wrap.appendChild(main);
  wrap.appendChild(audio);

  function syncPlayingClass() {
    const playing = !audio.paused;
    wrap.classList.toggle("aton-voice-player--playing", playing);
    playBtn.setAttribute("aria-label", playing ? t("Пауза") : t("Воспроизвести"));
  }

  function updateUi() {
    const d = audio.duration;
    const t = audio.currentTime;
    if (Number.isFinite(d) && d > 0) {
      const pct = (t / d) * 100;
      trackFill.style.width = `${pct}%`;
      timeEl.textContent = `${formatVoiceDuration(t)} / ${formatVoiceDuration(d)}`;
      track.setAttribute("aria-valuenow", String(Math.round(pct)));
    }
  }

  function seekFromClientX(clientX) {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = ratio * audio.duration;
    }
  }

  playBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (audio.paused) {
      pauseOtherVoiceAudios(audio);
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });

  track.addEventListener("click", (e) => {
    e.stopPropagation();
    seekFromClientX(e.clientX);
  });

  let dragging = false;
  track.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragging = true;
    try {
      track.setPointerCapture(e.pointerId);
    } catch (_) {}
    seekFromClientX(e.clientX);
  });
  track.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    seekFromClientX(e.clientX);
  });
  track.addEventListener("pointerup", (e) => {
    dragging = false;
    try {
      track.releasePointerCapture(e.pointerId);
    } catch (_) {}
  });
  track.addEventListener("pointercancel", () => {
    dragging = false;
  });

  track.addEventListener("keydown", (e) => {
    const dur = audio.duration;
    if (!Number.isFinite(dur) || dur <= 0) return;
    const step = dur * 0.05;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      audio.currentTime = Math.min(dur, audio.currentTime + step);
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    updateUi();
  });
  audio.addEventListener("timeupdate", updateUi);
  audio.addEventListener("play", () => {
    syncPlayingClass();
  });
  audio.addEventListener("pause", () => {
    syncPlayingClass();
  });
  audio.addEventListener("ended", () => {
    audio.currentTime = 0;
    syncPlayingClass();
    updateUi();
  });
  audio.addEventListener("error", () => {
    timeEl.textContent = t("Не удалось загрузить");
    trackFill.style.width = "0%";
  });

  return wrap;
}

function unlockNotificationAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!window.__atonAudioCtx) window.__atonAudioCtx = new Ctx();
    if (window.__atonAudioCtx.state === "suspended") {
      window.__atonAudioCtx.resume().catch(() => {});
    }
  } catch (_) {}
}

function playIncomingMessageSound() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!window.__atonAudioCtx) window.__atonAudioCtx = new Ctx();
  const ctx = window.__atonAudioCtx;

  const beep = () => {
    try {
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(659, t0);
      o.frequency.exponentialRampToValueAtTime(880, t0 + 0.06);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.09, t0 + 0.02);
      g.gain.linearRampToValueAtTime(0, t0 + 0.16);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.16);
    } catch (_) {
      try {
        const a = new Audio("/notification.mp3");
        a.volume = 0.35;
        a.play().catch(() => {});
      } catch (_) {}
    }
  };

  if (ctx.state === "suspended") {
    ctx.resume().then(beep).catch(beep);
  } else {
    beep();
  }
}

/** Сообщаем API удалить сессию в БД (не полагаемся только на очистку localStorage). */
function notifyServerLogout() {
  const t = getToken();
  if (!t || !API_BASE) return;
  void fetch(`${API_BASE}/api/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}` },
  }).catch(() => {});
}

function getPinnedChats(username) {
  if (!username) return new Set();
  const raw = localStorage.getItem(LOCAL_PINS_KEY);
  if (!raw) return new Set();
  try {
    const obj = JSON.parse(raw);
    return new Set(obj[username] || []);
  } catch {
    return new Set();
  }
}

function setPinnedChats(username, set) {
  if (!username) return;
  const raw = localStorage.getItem(LOCAL_PINS_KEY);
  let obj = {};
  try {
    obj = raw ? JSON.parse(raw) : {};
  } catch {
    obj = {};
  }
  obj[username] = Array.from(set);
  localStorage.setItem(LOCAL_PINS_KEY, JSON.stringify(obj));
}

function getChatReads(username) {
  if (!username) return {};
  const raw = localStorage.getItem(LOCAL_READS_KEY);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj[username] || {};
  } catch {
    return {};
  }
}

function setChatReads(username, reads) {
  if (!username) return;
  const raw = localStorage.getItem(LOCAL_READS_KEY);
  let obj = {};
  try {
    obj = raw ? JSON.parse(raw) : {};
  } catch {
    obj = {};
  }
  obj[username] = reads;
  localStorage.setItem(LOCAL_READS_KEY, JSON.stringify(obj));
}

/** Непрочитанные в списке чатов: только сообщения от собеседников; свои не считаются (в т.ч. отправка с другого устройства). */
function countUnreadInbound(messages, readIso, me) {
  if (!me) return 0;
  return messages.filter((m) => {
    if (m.from === me) return false;
    return !readIso || m.time > readIso;
  }).length;
}

function getLastChatId(username) {
  if (!username) return null;
  return localStorage.getItem(`${LAST_CHAT_KEY_PREFIX}${username}`) || null;
}

function setLastChatId(username, chatId) {
  if (!username) return;
  if (!chatId) {
    localStorage.removeItem(`${LAST_CHAT_KEY_PREFIX}${username}`);
    return;
  }
  localStorage.setItem(`${LAST_CHAT_KEY_PREFIX}${username}`, chatId);
}

/** 401 с этих путей не сбрасывает локальную сессию (например неверный пароль при /api/login). */
function api401ShouldSkipSessionInvalidate(path) {
  const p = path.split("?")[0];
  return p === "/api/login" || p === "/api/register";
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const timeoutMs = apiFetchTimeoutMs(path, options.timeoutMs);
  const parentSig = options.signal;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  const onParentAbort = () => {
    clearTimeout(tid);
    ctrl.abort();
  };
  if (parentSig) {
    if (parentSig.aborted) {
      clearTimeout(tid);
      ctrl.abort();
    } else {
      parentSig.addEventListener("abort", onParentAbort, { once: true });
    }
  }
  const { signal: _omitSig, timeoutMs: _omitTm, ...fetchRest } = options;
  let res;
  try {
    res = await fetch(API_BASE + path, { ...fetchRest, headers, signal: ctrl.signal });
  } catch (cause) {
    if (parentSig?.aborted) throw cause;
    const aborted =
      cause &&
      (cause.name === "AbortError" ||
        (typeof DOMException !== "undefined" && cause instanceof DOMException && cause.name === "AbortError"));
    const err = aborted
      ? new Error(t("Сервер слишком долго не отвечает. Подождите и обновите страницу."))
      : new Error(t("Нет сети или сервер не отвечает"));
    err.cause = cause;
    err.isNetwork = true;
    if (aborted) err.isTimeout = true;
    throw err;
  } finally {
    clearTimeout(tid);
    if (parentSig) parentSig.removeEventListener("abort", onParentAbort);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (
      res.status === 401 &&
      token &&
      getToken() === token &&
      !api401ShouldSkipSessionInvalidate(path)
    ) {
      setToken(null);
      document.dispatchEvent(new CustomEvent("aton:session-expired"));
      const err = new Error(
        t("Сессия устарела. Войдите снова — так бывает, если вы входили с другого устройства или браузера.")
      );
      err.status = 401;
      throw err;
    }
    const err = new Error(data.error || t("Ошибка соединения с сервером"));
    err.status = res.status;
    throw err;
  }
  return data;
}

async function fetchJsonPublic(path, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_API_FETCH_TIMEOUT_MS;
  const parentSig = options.signal;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  const onParentAbort = () => {
    clearTimeout(tid);
    ctrl.abort();
  };
  if (parentSig) {
    if (parentSig.aborted) {
      clearTimeout(tid);
      ctrl.abort();
    } else {
      parentSig.addEventListener("abort", onParentAbort, { once: true });
    }
  }
  const { signal: _omitSig, timeoutMs: _omitTm, ...fetchRest } = options;
  let res;
  try {
    res = await fetch(API_BASE + path, { ...fetchRest, signal: ctrl.signal });
  } catch (cause) {
    if (parentSig?.aborted) throw cause;
    const aborted =
      cause &&
      (cause.name === "AbortError" ||
        (typeof DOMException !== "undefined" && cause instanceof DOMException && cause.name === "AbortError"));
    const err = aborted
      ? new Error(t("Сервер слишком долго не отвечает. Подождите и обновите страницу."))
      : new Error(t("Нет сети или сервер не отвечает"));
    err.cause = cause;
    err.isNetwork = true;
    if (aborted) err.isTimeout = true;
    throw err;
  } finally {
    clearTimeout(tid);
    if (parentSig) parentSig.removeEventListener("abort", onParentAbort);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || t("Ошибка соединения с сервером"));
    err.status = res.status;
    throw err;
  }
  return data;
}

async function handleVerifyToken() {
  const params = new URLSearchParams(window.location.search);
  const verifyToken = params.get("verify");
  if (!verifyToken) return false;
  try {
    const res = await api(`/api/verify-email?token=${encodeURIComponent(verifyToken)}`);
    window.history.replaceState({}, "", window.location.pathname);
    return res;
  } catch (e) {
    window.history.replaceState({}, "", window.location.pathname);
    return { error: e.message };
  }
}

function createApp() {
  const root = document.getElementById("app");

  const shell = document.createElement("div");
  shell.className = "aton-shell";

  function showVerifyScreen(email) {
    shell.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "aton-verify-screen";
    wrap.innerHTML = `
      <div class="aton-verify-card">
        <img class="aton-logo" src="aten-logo.png" alt="ATEN" width="28" height="28" />
        <h2>${t("Подтвердите email")}</h2>
        <p>${t("Мы отправили письмо на")} <strong>${email || t("ваш email")}</strong>.</p>
        <p>${t("Перейдите по ссылке в письме, чтобы активировать аккаунт.")}</p>
        <button class="aton-primary-button aton-resend-btn">${t("Отправить повторно")}</button>
        <p class="aton-verify-hint"></p>
        <button class="aton-logout-link">${t("Выйти")}</button>
      </div>
    `;
    shell.appendChild(wrap);
    root.innerHTML = "";
    root.appendChild(shell);

    const resendBtn = wrap.querySelector(".aton-resend-btn");
    const hint = wrap.querySelector(".aton-verify-hint");
    resendBtn.addEventListener("click", async () => {
      resendBtn.disabled = true;
      try {
        await api("/api/resend-verify", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        hint.textContent = t("Письмо отправлено повторно.");
      } catch (e) {
        hint.textContent = e.message;
      }
      setTimeout(() => { resendBtn.disabled = false; }, 30000);
    });

    wrap.querySelector(".aton-logout-link").addEventListener("click", () => {
      notifyServerLogout();
      setToken(null);
      socket.auth.token = "";
      socket.disconnect().connect();
      currentUser = null;
      window.location.reload();
    });
  }

  // === Сайдбар: логотип + авторизация ===
  const sidebar = document.createElement("div");
  sidebar.className = "aton-sidebar";

  sidebar.innerHTML = `
    <div class="aton-sidebar-header">
      <div class="aton-sidebar-header-main">
        <img class="aton-logo" src="aten-logo.png" alt="ATEN" width="28" height="28" />
        <div class="aton-product-name">
          <div class="aton-title">${t("АТОН")}</div>
          <div class="aton-subtitle">${t("мессенджер под светом диска")}</div>
        </div>
      </div>
      <div class="aton-sidebar-toolbar" id="aton-sidebar-toolbar" hidden>
        <button type="button" class="aton-topbar-icon" id="aton-sidebar-friends-btn" title="${t("Друзья, заявки и блокировки")}" style="display:none;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span class="aton-topbar-icon-badge" id="aton-sidebar-friends-badge"></span>
        </button>
        <button type="button" class="aton-topbar-icon" id="aton-sidebar-theme-btn" title="${t("Сменить тему")}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </div>
  `;
  const sidebarHeader = sidebar.querySelector(".aton-sidebar-header");

  const authRoot = document.createElement("div");
  authRoot.className = "aton-auth";

  const tabs = document.createElement("div");
  tabs.className = "aton-auth-tabs";
  const tabLogin = document.createElement("button");
  tabLogin.className = "aton-auth-tab active";
  tabLogin.textContent = t("Вход");
  const tabRegister = document.createElement("button");
  tabRegister.className = "aton-auth-tab";
  tabRegister.textContent = t("Регистрация");
  tabs.appendChild(tabLogin);
  tabs.appendChild(tabRegister);

  const form = document.createElement("form");
  form.className = "aton-auth-form";
  form.innerHTML = `
    <div class="aton-field-group" data-role="email">
      <label class="aton-input-label" for="aton-email">Email</label>
      <input type="email" id="aton-email" class="aton-input" inputmode="email" autocomplete="email" />
    </div>
    <div class="aton-field-group" data-role="username">
      <label class="aton-input-label" for="aton-username">${t("Имя пользователя")}</label>
      <input type="text" id="aton-username" class="aton-input" autocapitalize="off" autocomplete="username" spellcheck="false" />
    </div>
    <div class="aton-field-group" data-role="password">
      <label class="aton-input-label" for="aton-password">${t("Пароль")}</label>
      <input type="password" id="aton-password" class="aton-input" autocomplete="current-password" />
    </div>
    <div class="aton-field-group" data-role="password-confirm">
      <label class="aton-input-label" for="aton-password-confirm">${t("Повторите пароль")}</label>
      <input type="password" id="aton-password-confirm" class="aton-input" autocomplete="new-password" />
    </div>
    <button type="submit" class="aton-primary-button">${t("Войти")}</button>
    <div class="aton-auth-hint" id="aton-auth-hint"></div>
    <div class="aton-auth-footer"><a href="forgot.html" class="aton-auth-link" id="aton-forgot">${t("Забыли пароль?")}</a></div>
  `;

  const authLoginBlock = document.createElement("div");
  authLoginBlock.appendChild(tabs);
  authLoginBlock.appendChild(form);
  const authLangSwitcher = document.createElement("div");
  authLangSwitcher.className = "aton-auth-lang";
  authLangSwitcher.innerHTML = `
    <div class="aton-lang-switcher" id="aton-auth-lang-switcher" aria-label="Language switcher">
      <button type="button" class="aton-lang-btn" data-lang="ru" title="Русский" aria-label="Русский"><span class="aton-flag aton-flag--ru" aria-hidden="true"></span></button>
      <button type="button" class="aton-lang-btn" data-lang="de" title="Deutsch" aria-label="Deutsch"><span class="aton-flag aton-flag--de" aria-hidden="true"></span></button>
      <button type="button" class="aton-lang-btn" data-lang="en" title="English" aria-label="English"><span class="aton-flag aton-flag--gb" aria-hidden="true"></span></button>
    </div>
  `;
  authLoginBlock.appendChild(authLangSwitcher);

  authRoot.appendChild(authLoginBlock);
  sidebar.appendChild(authRoot);

  // === Список чатов и профиль ===
  const chatsRoot = document.createElement("div");
  chatsRoot.className = "aton-chats";
  chatsRoot.innerHTML = `
    <div class="aton-chats-header">
      <span>${t("Чаты")}</span>
      <button class="aton-new-chat-button aton-create-group-button" id="aton-create-group" disabled style="display:none;" title="${escHtml(t("Создать группу"))}" aria-label="${escHtml(t("Создать группу"))}">
        <span aria-hidden="true" class="aton-create-group-plus">+</span>
        <span>${t("группа")}</span>
      </button>
    </div>
    <div class="aton-search">
      <input type="text" class="aton-search-input" id="aton-user-search" placeholder="${t("Поиск по имени или @username…")}" disabled />
      <div class="aton-search-results" id="aton-search-results"></div>
    </div>
    <div class="aton-chat-list" id="aton-chat-list"></div>
    <div class="aton-profile-link" id="aton-profile-link">
      ${t("Профиль:")} <span>${t("настроить имя, статус и аватар")}</span>
    </div>
  `;

  sidebar.appendChild(chatsRoot);

  const sidebarLangFooter = document.createElement("div");
  sidebarLangFooter.className = "aton-sidebar-lang-footer";
  sidebarLangFooter.innerHTML = `
    <div class="aton-lang-switcher" id="aton-sidebar-lang-switcher" aria-label="Language switcher">
      <button type="button" class="aton-lang-btn" data-lang="ru" title="Русский" aria-label="Русский"><span class="aton-flag aton-flag--ru" aria-hidden="true"></span></button>
      <button type="button" class="aton-lang-btn" data-lang="de" title="Deutsch" aria-label="Deutsch"><span class="aton-flag aton-flag--de" aria-hidden="true"></span></button>
      <button type="button" class="aton-lang-btn" data-lang="en" title="English" aria-label="English"><span class="aton-flag aton-flag--gb" aria-hidden="true"></span></button>
    </div>
  `;
  sidebar.appendChild(sidebarLangFooter);

  // === Основная часть: чат ===
  const main = document.createElement("div");
  main.className = "aton-main";

  const topbar = document.createElement("div");
  topbar.className = "aton-topbar";
  topbar.id = "aton-topbar";
  topbar.innerHTML = `
    <div class="aton-topbar-left">
      <button class="aton-back-button" id="aton-back-btn" title="${t("Назад к чатам")}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="aton-topbar-info">
        <div class="aton-topbar-title" id="aton-topbar-title">${t("Атон")}</div>
        <div class="aton-topbar-status" id="aton-status">${t("Войдите, чтобы открыть чаты")}</div>
      </div>
    </div>
    <div class="aton-topbar-right">
      <button class="aton-topbar-icon aton-notify-permission-btn" id="aton-notify-permission" title="${t("Разрешить уведомления о сообщениях вне вкладки")}" type="button" style="display:none;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M19 8h2l-2 2"/></svg>
      </button>
      <button class="aton-topbar-icon" id="aton-friends-btn" title="${t("Друзья, заявки и блокировки")}" style="display:none;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span class="aton-topbar-icon-badge" id="aton-friends-badge"></span>
      </button>
      <button class="aton-topbar-icon" id="aton-theme-toggle" title="${t("Сменить тему")}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
      <button class="aton-topbar-icon" id="aton-admin-users" title="Все пользователи" style="display:none;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
      </button>
      <button class="aton-topbar-icon" id="aton-moderation" title="Модерация" style="display:none;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </button>
      <div class="aton-user-pill" id="aton-user-pill" style="display:none;">
        <div class="aton-user-avatar"></div>
        <span id="aton-user-name"></span>
      </div>
    </div>
  `;

  const chat = document.createElement("div");
  chat.className = "aton-chat";

  const messagesEl = document.createElement("div");
  messagesEl.className = "aton-messages";

  const compose = document.createElement("div");
  compose.className = "aton-compose";
  compose.innerHTML = `
    <div class="aton-compose-record-hint" id="aton-compose-record-hint" hidden>
      <span class="aton-compose-record-dot" aria-hidden="true"></span>
      <span class="aton-compose-record-timer" id="aton-compose-record-timer">0:00</span>
      <span class="aton-compose-record-text">${t("Идёт запись. Отпустите кнопку микрофона, чтобы остановить.")}</span>
    </div>
    <div class="aton-reply-compose" id="aton-reply-compose" hidden>
      <div class="aton-reply-compose-accent" aria-hidden="true"></div>
      <div class="aton-reply-compose-body">
        <div class="aton-reply-compose-label" id="aton-reply-compose-label"></div>
        <div class="aton-reply-compose-text" id="aton-reply-compose-text"></div>
      </div>
      <button type="button" class="aton-reply-compose-close" id="aton-reply-compose-close" title="${t("Отменить ответ")}" aria-label="${t("Отменить ответ")}">×</button>
    </div>
    <div class="aton-compose-row">
      <textarea class="aton-compose-input" id="aton-input" rows="1" placeholder="${t("Сообщение…")}" disabled></textarea>
      <div class="aton-compose-actions">
        <button class="aton-attach-button" id="aton-attach" title="${t("Фото")}" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <button class="aton-mic-button" id="aton-mic" type="button" title="${t("Удерживайте, чтобы записать голос")}" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </button>
        <button class="aton-send-button" id="aton-send" disabled>
          <svg class="aton-send-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          <span class="aton-send-text">${t("ОТПРАВИТЬ")}</span>
        </button>
      </div>
    </div>
    <div class="aton-voice-preview" id="aton-voice-preview" hidden>
      <div class="aton-voice-preview-inner">
        <span class="aton-voice-preview-dot" aria-hidden="true"></span>
        <span class="aton-voice-preview-label">${t("Голосовое")}</span>
        <span class="aton-voice-preview-time" id="aton-voice-preview-time">0:00</span>
        <button type="button" class="aton-voice-preview-play" id="aton-voice-preview-play" title="${t("Прослушать")}" aria-label="${t("Прослушать")}"></button>
        <button type="button" class="aton-voice-preview-cancel" id="aton-voice-preview-cancel">${t("Удалить")}</button>
        <button type="button" class="aton-voice-preview-send" id="aton-voice-preview-send">${t("Отправить")}</button>
      </div>
    </div>
    <input type="file" id="aton-attach-input" accept="image/*" style="display:none;" />
  `;

  const golosVoiceBar = document.createElement("div");
  golosVoiceBar.className = "aton-golos-voice-bar";
  golosVoiceBar.id = "aton-golos-voice-bar";
  golosVoiceBar.hidden = true;
  golosVoiceBar.setAttribute("role", "presentation");
  golosVoiceBar.setAttribute("aria-hidden", "true");
  /* Раньше здесь был второй дублирующий блок «Записать»; ввод — только внизу (как в ChatGPT). */
  golosVoiceBar.innerHTML = "";

  chat.appendChild(messagesEl);
  chat.appendChild(golosVoiceBar);
  chat.appendChild(compose);

  const profilePage = document.createElement("div");
  profilePage.className = "aton-profile-page";
  profilePage.id = "aton-profile-page";
  profilePage.hidden = true;

  const peerActionBar = document.createElement("div");
  peerActionBar.className = "aton-peer-action-bar";
  peerActionBar.id = "aton-peer-action-bar";
  peerActionBar.setAttribute("hidden", "");
  peerActionBar.innerHTML = `<div class="aton-peer-action-bar-inner" id="aton-peer-action-bar-inner"></div>`;

  const friendsOverlay = document.createElement("div");
  friendsOverlay.className = "aton-friends-overlay";
  friendsOverlay.id = "aton-friends-overlay";
  friendsOverlay.setAttribute("hidden", "");
  friendsOverlay.innerHTML = `
    <div class="aton-friends-overlay-backdrop" data-close-friends="1"></div>
    <div class="aton-friends-panel" role="dialog" aria-labelledby="aton-friends-panel-title">
      <div class="aton-friends-panel-header">
        <div class="aton-friends-panel-title" id="aton-friends-panel-title">${t("Друзья и контакты")}</div>
        <button type="button" class="aton-friends-panel-close" id="aton-friends-close" aria-label="${t("Закрыть")}">×</button>
      </div>
      <p class="aton-friends-hint">${t("В друзьях — те, кого вы добавили и кто принял заявку. Переписка возможна и без этого; друзья видны в списке ниже.")}</p>
      <div class="aton-friends-section" id="aton-friends-incoming-wrap">
        <div class="aton-friends-section-title">${t("Входящие заявки")} <span class="aton-friends-count" id="aton-friends-in-count"></span></div>
        <div id="aton-friends-incoming"></div>
      </div>
      <div class="aton-friends-section" id="aton-friends-outgoing-wrap">
        <div class="aton-friends-section-title">${t("Исходящие заявки")}</div>
        <div id="aton-friends-outgoing"></div>
      </div>
      <div class="aton-friends-section">
        <div class="aton-friends-section-title">${t("Друзья")}</div>
        <div id="aton-friends-list"></div>
      </div>
      <div class="aton-friends-section">
        <div class="aton-friends-section-title">${t("Заблокированные")}</div>
        <div id="aton-friends-blocked"></div>
      </div>
    </div>
  `;

  main.appendChild(topbar);
  main.appendChild(peerActionBar);
  main.appendChild(profilePage);
  main.appendChild(chat);
  document.body.appendChild(friendsOverlay);

  shell.appendChild(sidebar);
  shell.appendChild(main);
  root.appendChild(shell);
  translateDom(shell);

  if (currentLang !== "ru") {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData" && m.target?.parentElement) {
          translateDom(m.target.parentElement);
          continue;
        }
        if (m.type === "attributes" && m.target) {
          translateDom(m.target);
          continue;
        }
        if (m.type === "childList") {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === Node.ELEMENT_NODE) translateDom(n);
            if (n.nodeType === Node.TEXT_NODE && n.parentElement) translateDom(n.parentElement);
          });
        }
      }
    });
    observer.observe(shell, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title", "placeholder", "aria-label"],
      characterData: true,
    });
  }

  document.addEventListener("click", () => unlockNotificationAudio(), { once: true });
  document.addEventListener("touchstart", () => unlockNotificationAudio(), { once: true, passive: true });
  document.addEventListener("keydown", () => unlockNotificationAudio(), { once: true });

  // === Состояние ===
  let authMode = "login";
  let currentUser = null;
  gPeerAliasState.getUser = () => currentUser;
  let allUsers = [];
  let allChats = [];
  let discoverChats = [];
  let allMessages = [];
  let reports = [];
  let contacts = { friends: [], blocked: [], requestsIn: [], requestsOut: [] };
  let chatFilter = "all"; // all | private | group
  let currentChatId = null; // глобального чата нет, по умолчанию ничего не выбрано
  let mediaRecorder = null;
  let recordedChunks = [];
  /** Чат, в котором начата запись / превью ГС — сброс при смене чата */
  let voiceSessionChatId = null;
  let discardVoiceOnNextStop = false;
  let pendingVoiceBlob = null;
  let pendingVoiceObjectUrl = null;
  let activeMicStream = null;
  let recordingTimerId = null;
  let recordingStartedAt = 0;
  let previewAudioEl = null;
  /** PTT: запись с удержанием кнопки */
  let pttInFlight = false;
  let pttUserReleasedBeforeRecord = false;
  let pttDocEndHandler = null;
  let replyToMessage = null;
  const chatOlderState = new Map();
  const CHAT_PAGE_LIMIT = 80;
  let typingTimeoutId = null;
  /** Ожидаем столько ответов от @golos_aton (после наших исходящих) — для строки «думает…». */
  let golosPendingReplies = 0;
  let openReactionPicker = null;
  let openChatMenu = null;
  let currentSocketChat = null;
  let mainView = "chat";
  let hasOnboardingAutoFocused = false;
  let bootstrapVersion = 0;
  let receiptsInFlight = null;
  const receiptPullsInFlight = new Map();
  /** Свертка renderMessages после receipt-pull: иначе серия message:status снова дёргает ГС. */
  let receiptsMessagesRenderTimer = 0;
  /** Стабилизация скролла: при смене чата — вниз; при мерже в том же чате — якорь, если смотрели историю. */
  let lastMessagesRenderChatId = null;
  let warmOpenChatId = null;
  let warmOpenChatMessagesPromise = null;
  const QUICK_REACTION_EMOJI = "👍";
  const MESSAGE_REACTION_EMOJIS = ["👍", "❤️", "🔥", "😁", "😢", "👏", "🤯", "👎"];
  /** Дебаунс pull по chatId — иначе при событиях в двух личках съедалось бы одно из них. */
  const messageStatusPullTimers = new Map();
  /**
   * Нижняя граница ленты в кадре — только IntersectionObserver на sentinel, без гонок scrollHeight/scrollTop.
   * @see isMessagesListAtBottom — отдельно, с порогом 50px (согласование с расчётом скролла).
   */
  const messagesBottomSentinel = document.createElement("div");
  messagesBottomSentinel.className = "aton-messages-bottom-sentinel";
  messagesBottomSentinel.setAttribute("aria-hidden", "true");
  let messagesBottomInView = true;
  const messagesBottomIo = new IntersectionObserver(
    (entries) => {
      const e = entries[0];
      if (!e) return;
      messagesBottomInView = e.isIntersecting;
    },
    { root: messagesEl, rootMargin: "0px", threshold: 0 }
  );
  messagesBottomIo.observe(messagesBottomSentinel);

  /**
   * Прокрутка вниз в одном кадре (один rAF) — без синхронного scroll + второго кадра (дрожь UI).
   * @param {boolean} onlyIfAtBottom — если true, в rAF не трогаем скролл, если низ вне кадра (рост картинок, ResizeObserver).
   */
  function scrollMessagesListToBottomRaf(onlyIfAtBottom) {
    if (!messagesEl) return;
    requestAnimationFrame(() => {
      if (!messagesEl) return;
      if (onlyIfAtBottom && !messagesBottomInView) {
        return;
      }
      messagesEl.scrollTop = Math.max(0, messagesEl.scrollHeight - messagesEl.clientHeight);
    });
  }

  /** Рост контента (картинки): вниз только если sentinel у низа виден (как в чат-лентах с «anchor»). */
  let messagesResizeRafId = 0;
  const messagesResizeObserver = new ResizeObserver(() => {
    if (!messagesBottomInView) {
      return;
    }
    if (messagesResizeRafId) {
      cancelAnimationFrame(messagesResizeRafId);
    }
    messagesResizeRafId = requestAnimationFrame(() => {
      messagesResizeRafId = 0;
      if (!messagesBottomInView) {
        return;
      }
      scrollMessagesListToBottomRaf(true);
    });
  });
  messagesResizeObserver.observe(messagesEl);

  function userFromContacts(username) {
    if (!username) return null;
    const lists = [
      ...(contacts.friends || []),
      ...(contacts.blocked || []),
      ...(contacts.requestsIn || []),
      ...(contacts.requestsOut || []),
    ];
    return lists.find((u) => u && u.username === username) || null;
  }

  /** Полный каталог или контакты (уже с аватаром), пока не загружен /api/users; для себя — currentUser. */
  function userByUsername(username) {
    if (!username) return null;
    if (currentUser && username === currentUser.username) {
      const fromDir = allUsers.find((u) => u.username === username);
      return fromDir || currentUser;
    }
    const fromDir = allUsers.find((u) => u.username === username);
    if (fromDir) return fromDir;
    return userFromContacts(username);
  }

  function closeChatMenu() {
    if (openChatMenu) {
      openChatMenu.remove();
      openChatMenu = null;
    }
  }

  function closeReactionPicker() {
    if (openReactionPicker) {
      openReactionPicker.remove();
      openReactionPicker = null;
    }
  }

  function getOwnReaction(message) {
    if (!currentUser || !Array.isArray(message && message.reactions)) return null;
    return message.reactions.find((r) => r && r.user === currentUser.username) || null;
  }

  function getReactionSummary(message) {
    const summary = new Map();
    const reactions = Array.isArray(message && message.reactions) ? message.reactions : [];
    for (const reaction of reactions) {
      if (!reaction || typeof reaction.emoji !== "string" || !reaction.emoji.trim()) continue;
      const emoji = reaction.emoji.trim();
      const entry = summary.get(emoji) || { emoji, count: 0, users: [], reactedByMe: false };
      entry.count += 1;
      if (reaction.user) entry.users.push(reaction.user);
      if (currentUser && reaction.user === currentUser.username) entry.reactedByMe = true;
      summary.set(emoji, entry);
    }
    return [...summary.values()].sort((a, b) => {
      if (a.reactedByMe !== b.reactedByMe) return a.reactedByMe ? -1 : 1;
      const ai = MESSAGE_REACTION_EMOJIS.indexOf(a.emoji);
      const bi = MESSAGE_REACTION_EMOJIS.indexOf(b.emoji);
      const ao = ai === -1 ? 999 : ai;
      const bo = bi === -1 ? 999 : bi;
      return ao - bo || b.count - a.count || a.emoji.localeCompare(b.emoji);
    });
  }

  async function toggleMessageReaction(message, emoji) {
    if (!message || !message.id || !emoji) return;
    const updated = await api(`/api/messages/${message.id}/react`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    });
    allMessages = allMessages.map((m) => (m.id === updated.id ? updated : m));
    closeReactionPicker();
    renderMessages();
  }

  function positionReactionPicker(picker, anchorRect) {
    const gap = 8;
    picker.style.position = "fixed";
    picker.style.left = "0";
    picker.style.top = "0";
    picker.style.visibility = "hidden";
    document.body.appendChild(picker);

    const pickerRect = picker.getBoundingClientRect();
    const viewportPadding = 8;
    const pickerWidth = Math.min(pickerRect.width, window.innerWidth - viewportPadding * 2);
    const pickerHeight = Math.min(pickerRect.height, window.innerHeight - viewportPadding * 2);
    const preferredLeft = anchorRect.left + anchorRect.width / 2 - pickerWidth / 2;
    const left = Math.min(
      Math.max(viewportPadding, preferredLeft),
      Math.max(viewportPadding, window.innerWidth - pickerWidth - viewportPadding)
    );
    const topAbove = anchorRect.top - pickerHeight - gap;
    const topBelow = anchorRect.bottom + gap;
    const top = topAbove >= viewportPadding ? topAbove : Math.min(topBelow, window.innerHeight - pickerHeight - viewportPadding);

    picker.style.left = `${left}px`;
    picker.style.top = `${Math.max(viewportPadding, top)}px`;
    picker.style.visibility = "";
  }

  // Закрываем админское меню чатов при клике вне него
  document.addEventListener("click", (e) => {
    if (openReactionPicker) {
      const t = e.target;
      if (!(t && t.closest && (t.closest(".aton-reaction-picker") || t.closest(".aton-message-react-trigger")))) {
        closeReactionPicker();
      }
    }
    if (!openChatMenu) return;
    const t = e.target;
    if (t && t.closest && t.closest(".aton-chat-menu-btn")) return;
    if (openChatMenu.contains(t)) return;
    closeChatMenu();
  });

  function switchSocketChat(newChatId) {
    if (currentSocketChat === newChatId) return;
    if (currentSocketChat) {
      socket.emit("leave_chat", currentSocketChat);
    }
    currentSocketChat = newChatId || null;
    if (currentSocketChat) {
      socket.emit("join_chat", currentSocketChat);
    }
  }

  function messagesForChatId(chatId) {
    if (!chatId || !currentUser) return [];
    return allMessages.filter((msg) => {
      if (!msg) return false;
      if (String(chatId).startsWith("group:") || String(chatId).startsWith("channel:")) {
        return msg.chatId === chatId;
      }
      if (isPrivateDirectChat(chatId)) {
        return messageBelongsToDmId(msg, chatId);
      }
      return msg.chatId === chatId;
    });
  }

  function chatPagingState(chatId) {
    const key = String(chatId || "");
    let state = chatOlderState.get(key);
    if (!state) {
      state = { hasMore: true, loading: false };
      chatOlderState.set(key, state);
    }
    return state;
  }

  function oldestLoadedMessageForChat(chatId) {
    const list = messagesForChatId(chatId)
      .filter((m) => m && m.id && !String(m.id).startsWith("_temp_"))
      .sort((a, b) => new Date(a.time) - new Date(b.time));
    return list[0] || null;
  }

  async function loadOlderMessages(chatId) {
    if (!chatId || !currentUser || !currentUser.verified) return;
    const state = chatPagingState(chatId);
    if (state.loading || state.hasMore === false) return;
    const oldest = oldestLoadedMessageForChat(chatId);
    if (!oldest) {
      state.hasMore = false;
      return;
    }
    state.loading = true;
    const before = encodeURIComponent(oldest.time || oldest.createdAt || "");
    const previousHeight = messagesEl ? messagesEl.scrollHeight : 0;
    try {
      const older = await api(`/api/messages?chatId=${encodeURIComponent(chatId)}&before=${before}&limit=${CHAT_PAGE_LIMIT}`);
      if (!Array.isArray(older) || currentChatId !== chatId) return;
      if (older.length < CHAT_PAGE_LIMIT) state.hasMore = false;
      if (older.length) {
        allMessages = prependMessagesForChatInAll(allMessages, chatId, older);
        renderMessages({ preserveTop: true });
        if (messagesEl) {
          const delta = messagesEl.scrollHeight - previousHeight;
          messagesEl.scrollTop = Math.max(0, messagesEl.scrollTop + delta);
        }
      } else {
        state.hasMore = false;
        renderMessages({ preserveTop: true });
      }
    } catch (e) {
      console.warn("loadOlderMessages", e);
    } finally {
      state.loading = false;
    }
  }

  function updateVisibleMessageMeta() {
    if (!messagesEl || !currentUser || !currentChatId) return;
    const byId = new Map(messagesForChatId(currentChatId).map((m) => [String(m.id || ""), m]));
    for (const row of messagesEl.querySelectorAll(".aton-message-row[data-message-id]")) {
      const id = row.getAttribute("data-message-id");
      const msg = byId.get(String(id || ""));
      if (!msg) continue;
      const meta = row.querySelector(".aton-message-meta");
      if (!meta) continue;
      const isSelf = isMessageFromSelf(msg, currentUser, currentChatId);
      meta.className = "aton-message-meta" + (isSelf ? " aton-message-meta--self" : "");
      const timeLabel = formatTimeLabel(msg.time);
      const editedLabel = msg.editedAt ? ` · ${t("изм.")}` : "";
      const pinnedLabel = msg.pinned ? " ★" : "";
      const st =
        msg.status && ["sent", "delivered", "read"].includes(msg.status) ? msg.status : "sent";
      const showAck = isSelf && isPrivateDirectChat(currentChatId);
      const ack = showAck ? messageAckHtml(st) : "";
      meta.innerHTML = `<span class="aton-message-time">${escHtml(timeLabel)}${escHtml(editedLabel)}${escHtml(pinnedLabel)}</span>${ack}`;
    }
  }

  /**
   * Личка: GET /messages обновляет статусы на сервере (чужие «sent» → «delivered» для вашей выборки).
   * С markRead (открытие чата): затем POST /read — чужие «sent|delivered» → «read»; у собеседника ваши исходящие станут «прочитано».
   * Без markRead: только GET — для сокета message:status, чтобы галочки обновлялись, пока вы в другом чате (без ложного read).
   */
  async function pullChatReceipts(chatId, opts = {}) {
    const markRead = opts.markRead !== false;
    if (!chatId || !currentUser || !currentUser.verified) return;
    const inflightKey = `${chatId}|${markRead ? "read" : "peek"}`;
    if (receiptPullsInFlight.has(inflightKey)) {
      return receiptPullsInFlight.get(inflightKey);
    }
    const pullPromise = (async () => {
      const token = chatId;
      receiptsInFlight = token;
      try {
        const beforeIds = messagesForChatId(chatId).map((m) => String(m.id || "")).filter(Boolean).join("|");
        let paintedOpenChatFromList = false;
        const list =
          warmOpenChatId === chatId && warmOpenChatMessagesPromise
            ? await warmOpenChatMessagesPromise
            : await api(`/api/messages?chatId=${encodeURIComponent(chatId)}&limit=${CHAT_PAGE_LIMIT}`);
        if (receiptsInFlight !== token) return;
        if (!Array.isArray(list)) return;
        allMessages = applyMessagesForChatInAll(allMessages, chatId, list);
        chatPagingState(chatId).hasMore = list.length >= CHAT_PAGE_LIMIT;
        if (markRead && currentChatId === chatId) {
          renderChatList();
          renderMessages({ deferIfVoice: true });
          paintedOpenChatFromList = true;
        }
        if (markRead && isPrivateDirectChat(chatId)) {
          const r = await api("/api/messages/read", {
            method: "POST",
            body: JSON.stringify({ chatId, userId: currentUser.id }),
          });
          if (receiptsInFlight !== token) return;
          if (r && Array.isArray(r.messages)) {
            allMessages = applyMessagesForChatInAll(allMessages, chatId, r.messages);
          }
        }
        renderChatList();
        if (currentChatId === chatId) {
          if (markRead) {
            if (receiptsMessagesRenderTimer) clearTimeout(receiptsMessagesRenderTimer);
            receiptsMessagesRenderTimer = 0;
            if (paintedOpenChatFromList) {
              updateVisibleMessageMeta();
            } else {
              renderMessages();
            }
          } else {
            if (receiptsMessagesRenderTimer) clearTimeout(receiptsMessagesRenderTimer);
            receiptsMessagesRenderTimer = 0;
            const afterIds = messagesForChatId(chatId).map((m) => String(m.id || "")).filter(Boolean).join("|");
            if (beforeIds === afterIds) {
              updateVisibleMessageMeta();
            } else {
              renderMessages({ deferIfVoice: true });
            }
          }
        }
      } catch (e) {
        console.warn("pullChatReceipts", e);
      } finally {
        if (receiptsInFlight === token) receiptsInFlight = null;
        receiptPullsInFlight.delete(inflightKey);
      }
    })();
    receiptPullsInFlight.set(inflightKey, pullPromise);
    return pullPromise;
  }

  function getPeerFromDmChatId(chatId) {
    if (!chatId || !String(chatId).includes("|") || !currentUser) return null;
    const [a, b] = chatId.split("|");
    return a === currentUser.username ? b : a;
  }

  function getChatNotifyTitle(chatId) {
    if (!chatId) return t("Атон");
    if (chatId.startsWith("group:") || chatId.startsWith("channel:")) {
      let c = allChats.find((x) => x.id === chatId);
      if (!c) c = discoverChats.find((x) => x.id === chatId);
      return c?.title || t("Чат");
    }
    const peer = getPeerFromDmChatId(chatId);
    if (!peer) return t("Новое сообщение");
    const u = userByUsername(peer);
    return displayNameForPeer(currentUser.username, peer, u);
  }

  function formatNotifyBody(msg) {
    if (!msg) return "";
    if (msg.type === "audio") return t("Голосовое сообщение");
    if (msg.type === "image") return t("Фото");
    const text = (msg.text || "").trim();
    if (text.length > 120) return `${text.slice(0, 117)}…`;
    return text || t("Новое сообщение");
  }

  function openChatFromNotification(chatId) {
    if (!chatId || !currentUser) return;
    leaveProfileForChatSelection();
    currentChatId = chatId;
    switchSocketChat(currentChatId);
    setLastChatId(currentUser.username, currentChatId);
    const reads = getChatReads(currentUser.username);
    setChatReads(currentUser.username, { ...reads, [chatId]: new Date().toISOString() });
    renderChatList();
    renderMessages();
    updateTopbarTitle();
    void pullChatReceipts(chatId);
  }

  /** После F5: открываем тот же чат, что и до перезагрузки (если он ещё доступен). */
  function restoreLastOpenChatIfValid() {
    if (!currentUser || !currentUser.verified) return false;
    let saved = getLastChatId(currentUser.username);
    if (!saved) {
      try {
        const currentName = String(currentUser.username || "").toLowerCase();
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (key.startsWith(LAST_CHAT_KEY_PREFIX) && key.slice(LAST_CHAT_KEY_PREFIX.length).toLowerCase() === currentName) {
            saved = localStorage.getItem(key) || "";
            break;
          }
        }
      } catch (_) {}
    }
    if (!saved || typeof saved !== "string") return false;
    if (saved.startsWith("group:") || saved.startsWith("channel:")) {
      if (!allChats.some((c) => c.id === saved)) {
        return false;
      }
    } else if (String(saved).includes("|")) {
      const parts = saved.split("|");
      if (parts.length !== 2) return false;
      const [a, b] = parts;
      const currentName = String(currentUser.username || "").toLowerCase();
      const aLower = String(a || "").toLowerCase();
      const bLower = String(b || "").toLowerCase();
      if (aLower !== currentName && bLower !== currentName) {
        return false;
      }
    } else {
      return false;
    }
    currentChatId = saved;
    switchSocketChat(currentChatId);
    if (warmOpenChatId === saved && warmOpenChatMessagesPromise) {
      void warmOpenChatMessagesPromise.then((list) => {
        if (!Array.isArray(list) || currentChatId !== saved || !currentUser) return;
        allMessages = applyMessagesForChatInAll(allMessages, currentChatId, list);
        renderChatList();
        renderMessages({ deferIfVoice: true });
        updateTopbarTitle();
      });
    }
    void pullChatReceipts(currentChatId);
    return true;
  }

  function startWarmOpenChatPrefetch() {
    const snap = readSessionSnapshot();
    let username = snap && snap.verified && snap.username ? String(snap.username) : "";
    if (!username) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (key.startsWith(LAST_CHAT_KEY_PREFIX)) {
            username = key.slice(LAST_CHAT_KEY_PREFIX.length);
            break;
          }
        }
      } catch (_) {}
    }
    if (!username || !getToken()) return;
    const saved = getLastChatId(username);
    if (!saved || typeof saved !== "string") return;
    if (!String(saved).includes("|") && !String(saved).startsWith("group:") && !String(saved).startsWith("channel:")) return;
    warmOpenChatId = saved;
    warmOpenChatMessagesPromise = api(`/api/messages?chatId=${encodeURIComponent(saved)}&limit=${CHAT_PAGE_LIMIT}`)
      .then((list) => (Array.isArray(list) ? list : []))
      .catch(() => null);
  }

  function ensureToastStack() {
    let el = document.getElementById("aton-toast-stack");
    if (!el) {
      el = document.createElement("div");
      el.id = "aton-toast-stack";
      el.className = "aton-toast-stack";
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  }

  function pushMessageToast(msg) {
    const stack = ensureToastStack();
    const title = getChatNotifyTitle(msg.chatId);
    const body = formatNotifyBody(msg);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "aton-toast-card";
    card.innerHTML = `
      <div class="aton-toast-card-kicker">${escHtml(t("Новое сообщение"))}</div>
      <div class="aton-toast-card-title">${escHtml(title)}</div>
      <div class="aton-toast-card-body">${escHtml(body)}</div>
    `;
    card.addEventListener("click", () => {
      openChatFromNotification(msg.chatId);
      card.classList.add("aton-toast-card--out");
      setTimeout(() => card.remove(), 280);
    });
    stack.appendChild(card);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => card.classList.add("aton-toast-card--in"));
    });
    while (stack.children.length > 5) {
      const first = stack.firstChild;
      if (first) first.remove();
    }
    const t = setTimeout(() => {
      card.classList.add("aton-toast-card--out");
      setTimeout(() => {
        if (card.parentNode === stack) card.remove();
      }, 280);
    }, 6200);
    card.addEventListener(
      "mouseenter",
      () => {
        clearTimeout(t);
      },
      { once: true }
    );
  }

  function showBackgroundMessageAlert(msg) {
    if (!msg || !msg.chatId) return;
    const title = getChatNotifyTitle(msg.chatId);
    const body = `${msg.from}: ${formatNotifyBody(msg)}`;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const n = new Notification(title, {
          body,
          tag: `aton-${msg.id}`,
          requireInteraction: false,
        });
        n.onclick = () => {
          try {
            n.close();
          } catch (_) {}
          window.focus();
          openChatFromNotification(msg.chatId);
        };
      } catch (_) {
        pushMessageToast(msg);
      }
    } else {
      pushMessageToast(msg);
    }
  }

  function updateNotifyPermissionButton() {
    const btn = document.getElementById("aton-notify-permission");
    if (!btn) return;
    const show =
      currentUser &&
      currentUser.verified &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default";
    btn.style.display = show ? "inline-flex" : "none";
  }

  // Realtime обновление сообщений по WebSocket
  socket.on("message:new", (msg) => {
    if (!msg) return;
    // Если сообщение уже есть в истории, не дублируем
    if (allMessages.some((m) => m.id === msg.id)) return;
    if (msg.from === GOLOS_ATON_USERNAME && currentChatId && messageBelongsToOpenChat(msg, currentChatId)) {
      golosPendingReplies = Math.max(0, golosPendingReplies - 1);
    }
    if (currentUser && msg.from !== currentUser.username) {
      const muted = isChatNotifyMuted(currentUser.username, msg.chatId);
      if (!muted) {
        playIncomingMessageSound();
        if (document.visibilityState === "hidden") {
          showBackgroundMessageAlert(msg);
        }
      }
    }
    const isOpenThread = Boolean(currentChatId && messageBelongsToOpenChat(msg, currentChatId));
    allMessages.push(msg);
    // Держим сообщения в хронологическом порядке
    allMessages.sort((a, b) => new Date(a.time) - new Date(b.time));
    // Список чатов должен обновляться всегда (для бейджей и порядка)
    renderChatList();
    if (isOpenThread) {
      renderMessages({ deferIfVoice: true });
      if (
        currentUser &&
        msg.from !== currentUser.username &&
        isPrivateDirectChat(currentChatId) &&
        document.visibilityState === "visible"
      ) {
        void pullChatReceipts(currentChatId, { markRead: true });
      }
    }
  });

  socket.on("message:updated", (msg) => {
    if (!msg || !msg.id) return;
    let found = false;
    allMessages = allMessages.map((m) => {
      if (m.id !== msg.id) return m;
      found = true;
      return { ...m, ...msg };
    });
    if (!found) return;
    renderChatList();
    if (currentChatId && messageBelongsToOpenChat(msg, currentChatId)) {
      renderMessages({ deferIfVoice: true });
    }
  });

  socket.on("message:deleted", (p) => {
    if (!p || !p.id) return;
    const before = allMessages.length;
    allMessages = allMessages.filter((m) => m && m.id !== p.id);
    if (allMessages.length === before) return;
    if (replyToMessage && replyToMessage.id === p.id) {
      clearReplyToMessage();
    }
    renderChatList();
    if (currentChatId && (!p.chatId || String(p.chatId) === String(currentChatId))) {
      renderMessages({ deferIfVoice: true });
    }
  });

  socket.on("golos:noreply", (p) => {
    if (!p || !p.chatId || !currentUser) return;
    const gid = chatIdForUsers(currentUser.username, GOLOS_ATON_USERNAME);
    if (p.chatId !== gid) return;
    golosPendingReplies = Math.max(0, golosPendingReplies - 1);
    if (currentChatId === gid) {
      renderMessages({ deferIfVoice: true });
    }
  });

  socket.on("message:status", (p) => {
    if (!p || !p.chatId) return;
    const cid = p.chatId;
    const prev = messageStatusPullTimers.get(cid);
    if (prev) clearTimeout(prev);
    messageStatusPullTimers.set(
      cid,
      setTimeout(() => {
        messageStatusPullTimers.delete(cid);
        void pullChatReceipts(cid, { markRead: false });
      }, 250)
    );
  });

  // При переподключении возвращаемся в активную комнату, если она есть
  socket.on("connect", () => {
    if (currentSocketChat) {
      socket.emit("join_chat", currentSocketChat);
      void pullChatReceipts(currentSocketChat);
    }
  });

  // === Элементы ===
  const emailInput = form.querySelector("#aton-email");
  const usernameInput = form.querySelector("#aton-username");
  const passwordInput = form.querySelector("#aton-password");
  const passwordConfirmInput = form.querySelector("#aton-password-confirm");
  const emailGroup = form.querySelector('[data-role="email"]');
  const usernameGroup = form.querySelector('[data-role="username"]');
  const passwordGroup = form.querySelector('[data-role="password"]');
  const passwordConfirmGroup = form.querySelector('[data-role="password-confirm"]');
  const submitButton = form.querySelector(".aton-primary-button");
  const hintEl = document.getElementById("aton-auth-hint");
  const statusEl = document.getElementById("aton-status");
  const topbarTitleEl = document.getElementById("aton-topbar-title");
  const userPill = document.getElementById("aton-user-pill");
  const userNameLabel = document.getElementById("aton-user-name");
  const inputMessage = document.getElementById("aton-input");
  const sendButton = document.getElementById("aton-send");
  const replyComposeEl = document.getElementById("aton-reply-compose");
  const replyComposeLabelEl = document.getElementById("aton-reply-compose-label");
  const replyComposeTextEl = document.getElementById("aton-reply-compose-text");
  const replyComposeCloseBtn = document.getElementById("aton-reply-compose-close");

  function adjustComposeInputHeight() {
    if (!inputMessage || inputMessage.tagName !== "TEXTAREA") return;
    const w = inputMessage.style.width;
    inputMessage.style.width = inputMessage.offsetWidth + "px";
    inputMessage.style.height = "0";
    inputMessage.style.height = Math.max(inputMessage.scrollHeight, 40) + "px";
    inputMessage.style.width = w || "";
  }
  const micButton = document.getElementById("aton-mic");
  const composeRecordHint = document.getElementById("aton-compose-record-hint");
  const composeRecordTimer = document.getElementById("aton-compose-record-timer");
  const voicePreviewEl = document.getElementById("aton-voice-preview");
  const voicePreviewTimeEl = document.getElementById("aton-voice-preview-time");
  const voicePreviewPlayBtn = document.getElementById("aton-voice-preview-play");
  const voicePreviewCancelBtn = document.getElementById("aton-voice-preview-cancel");
  const voicePreviewSendBtn = document.getElementById("aton-voice-preview-send");
  const attachButton = document.getElementById("aton-attach");
  const attachInput = document.getElementById("aton-attach-input");
  const chatListEl = document.getElementById("aton-chat-list");
  const profileLink = document.getElementById("aton-profile-link");
  const searchInput = document.getElementById("aton-user-search");
  const searchResultsEl = document.getElementById("aton-search-results");
  const backButton = document.getElementById("aton-back-btn");
  const createGroupButton = document.getElementById("aton-create-group");
  const forgotLink = document.getElementById("aton-forgot");
  const contactsEl = document.getElementById("aton-contacts");
  const adminUsersButton = document.getElementById("aton-admin-users");
  const moderationButton = document.getElementById("aton-moderation");
  const themeToggle = document.getElementById("aton-theme-toggle");
  const friendsBtn = document.getElementById("aton-friends-btn");
  const friendsBadge = document.getElementById("aton-friends-badge");
  const sidebarToolbar = document.getElementById("aton-sidebar-toolbar");
  const sidebarFriendsBtn = document.getElementById("aton-sidebar-friends-btn");
  const sidebarThemeBtn = document.getElementById("aton-sidebar-theme-btn");
  const friendsSidebarBadge = document.getElementById("aton-sidebar-friends-badge");
  const notifyPermissionBtn = document.getElementById("aton-notify-permission");
  function syncLangButtons() {
    for (const btn of document.querySelectorAll(".aton-lang-btn")) {
      const lang = btn.getAttribute("data-lang");
      btn.classList.toggle("active", lang === currentLang);
      btn.setAttribute("aria-pressed", lang === currentLang ? "true" : "false");
    }
  }

  document.addEventListener("click", (event) => {
    const btn = event.target.closest(".aton-lang-btn");
    if (!btn) return;
    const lang = btn.getAttribute("data-lang");
    if (!lang || lang === currentLang) return;
    setLanguage(lang);
    window.location.reload();
  });
  syncLangButtons();

  if (getToken()) {
    if (sidebarHeader) sidebarHeader.style.display = "none";
    authRoot.style.display = "none";
    authLoginBlock.style.display = "none";
    sidebarLangFooter.style.display = "none";
    const snap0 = readSessionSnapshot();
    if (statusEl) {
      statusEl.textContent =
        snap0 && snap0.verified
          ? t("Загружаем переписку…")
          : t("Проверяем сессию…");
    }
  }

  // Индикатор «печатает…»
  const typingIndicator = document.createElement("div");
  typingIndicator.className = "aton-typing-indicator";
  typingIndicator.textContent = t("Печатаете сообщение…");
  typingIndicator.style.display = "none";
  compose.insertBefore(typingIndicator, compose.firstChild);

  function messageReplyExcerpt(msg) {
    if (!msg) return t("Сообщение без текста");
    const raw = msg.text ? String(msg.text).trim() : "";
    if (raw) return `${raw.slice(0, 120)}${raw.length > 120 ? "…" : ""}`;
    if (msg.type === "image") return t("📷 Фото");
    if (msg.type === "audio") return t("Голосовое сообщение");
    return t("Сообщение без текста");
  }

  function messageReplyAuthorLabel(msg) {
    if (!msg || !currentUser) return "";
    if (msg.from === currentUser.username) return t("Вы");
    return displayNameForPeer(currentUser.username, msg.from, userByUsername(msg.from));
  }

  function clearReplyToMessage() {
    replyToMessage = null;
    if (replyComposeEl) replyComposeEl.hidden = true;
    if (replyComposeLabelEl) replyComposeLabelEl.textContent = "";
    if (replyComposeTextEl) replyComposeTextEl.textContent = "";
    if (!inputMessage || !inputMessage.value.trim()) {
      typingIndicator.style.display = "none";
    }
  }

  function setReplyToMessage(msg) {
    if (!msg) {
      clearReplyToMessage();
      return;
    }
    replyToMessage = msg;
    if (replyComposeLabelEl) {
      replyComposeLabelEl.textContent = `${t("Ответ на сообщение")} · ${messageReplyAuthorLabel(msg)}`;
    }
    if (replyComposeTextEl) {
      replyComposeTextEl.textContent = messageReplyExcerpt(msg);
    }
    if (replyComposeEl) replyComposeEl.hidden = false;
    typingIndicator.style.display = "none";
    inputMessage.focus();
  }

  if (replyComposeCloseBtn) {
    replyComposeCloseBtn.addEventListener("click", clearReplyToMessage);
  }

  const ATON_MIC_ICON_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  const ATON_MIC_STOP_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
  const ATON_PREVIEW_PLAY_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
  const ATON_PREVIEW_PAUSE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>`;

  function setMicButtonIdle() {
    micButton.innerHTML = ATON_MIC_ICON_SVG;
    micButton.classList.remove("recording");
    micButton.title = t("Удерживайте, чтобы записать голос");
  }

  function setMicButtonRecordingUi() {
    micButton.innerHTML = ATON_MIC_STOP_SVG;
    micButton.classList.add("recording");
    micButton.title = t("Запись… отпустите, чтобы остановить");
  }

  function stopRecordingTimerUi() {
    if (recordingTimerId) {
      clearInterval(recordingTimerId);
      recordingTimerId = null;
    }
  }

  function startRecordingTimerUi() {
    stopRecordingTimerUi();
    recordingStartedAt = Date.now();
    if (composeRecordTimer) composeRecordTimer.textContent = "0:00";
    recordingTimerId = setInterval(() => {
      const sec = (Date.now() - recordingStartedAt) / 1000;
      if (composeRecordTimer) composeRecordTimer.textContent = formatVoiceDuration(sec);
    }, 200);
  }

  function clearVoicePreview() {
    voiceSessionChatId = null;
    pendingVoiceBlob = null;
    if (pendingVoiceObjectUrl) {
      try {
        URL.revokeObjectURL(pendingVoiceObjectUrl);
      } catch (_) {}
      pendingVoiceObjectUrl = null;
    }
    if (previewAudioEl) {
      previewAudioEl.pause();
      previewAudioEl.removeAttribute("src");
      try {
        previewAudioEl.load();
      } catch (_) {}
    }
    if (voicePreviewEl) voicePreviewEl.hidden = true;
    if (voicePreviewPlayBtn) {
      voicePreviewPlayBtn.innerHTML = ATON_PREVIEW_PLAY_SVG;
      voicePreviewPlayBtn.classList.remove("aton-voice-preview-play--playing");
    }
    if (inputMessage && !inputMessage.disabled) {
      micButton.disabled = false;
    }
  }

  function showVoicePreview(blob) {
    if (!voicePreviewEl || !voicePreviewTimeEl) return;
    pendingVoiceBlob = blob;
    voiceSessionChatId = currentChatId;
    if (pendingVoiceObjectUrl) {
      try {
        URL.revokeObjectURL(pendingVoiceObjectUrl);
      } catch (_) {}
    }
    pendingVoiceObjectUrl = URL.createObjectURL(blob);
    if (!previewAudioEl) previewAudioEl = new Audio();
    previewAudioEl.src = pendingVoiceObjectUrl;
    previewAudioEl.preload = "metadata";
    voicePreviewTimeEl.textContent = "…";
    previewAudioEl.onloadedmetadata = () => {
      if (voicePreviewTimeEl && Number.isFinite(previewAudioEl.duration)) {
        voicePreviewTimeEl.textContent = formatVoiceDuration(previewAudioEl.duration);
      }
    };
    voicePreviewEl.hidden = false;
    micButton.disabled = true;
    if (voicePreviewPlayBtn) {
      voicePreviewPlayBtn.innerHTML = ATON_PREVIEW_PLAY_SVG;
      voicePreviewPlayBtn.classList.remove("aton-voice-preview-play--playing");
    }
    previewAudioEl.onended = () => {
      if (voicePreviewPlayBtn) {
        voicePreviewPlayBtn.innerHTML = ATON_PREVIEW_PLAY_SVG;
        voicePreviewPlayBtn.classList.remove("aton-voice-preview-play--playing");
      }
    };
  }

  function sendAudioBlobAsMessage(blob) {
    if (!currentChatId || !currentUser) {
      return Promise.reject(new Error(t("Нет чата")));
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        void (async () => {
          const audioDataUrl = reader.result;
          const to = dmToForApi();
          const toGolosVoice = to === GOLOS_ATON_USERNAME;
          if (toGolosVoice) golosPendingReplies += 1;
          const chatId = currentChatId;
          try {
            const msg = await api("/api/messages", {
              method: "POST",
              body: JSON.stringify({ chatId, type: "audio", audioDataUrl, to }),
            });
            allMessages.push(msg);
            renderMessages();
            renderChatList();
            resolve(msg);
          } catch (e) {
            if (toGolosVoice) golosPendingReplies = Math.max(0, golosPendingReplies - 1);
            renderMessages();
            reject(e);
          }
        })();
      };
      reader.onerror = () => reject(new Error(t("Не удалось прочитать запись")));
      reader.readAsDataURL(blob);
    });
  }

  function abortVoiceUi() {
    stopRecordingTimerUi();
    if (composeRecordHint) composeRecordHint.hidden = true;
    if (mediaRecorder && mediaRecorder.state === "recording") {
      discardVoiceOnNextStop = true;
      try {
        mediaRecorder.stop();
      } catch (_) {}
      return;
    }
    clearPttDocEndHandler();
    pttInFlight = false;
    pttUserReleasedBeforeRecord = false;
    discardVoiceOnNextStop = false;
    if (activeMicStream) {
      activeMicStream.getTracks().forEach((t) => t.stop());
      activeMicStream = null;
    }
    mediaRecorder = null;
    recordedChunks = [];
    clearVoicePreview();
    setMicButtonIdle();
  }

  function isGolosAtonChat() {
    if (!currentUser || !currentChatId) return false;
    if (currentChatId === "global" || currentChatId.startsWith("group:") || currentChatId.startsWith("channel:")) {
      return false;
    }
    if (!String(currentChatId).includes("|")) return false;
    const [a, b] = currentChatId.split("|");
    const peer = a === currentUser.username ? b : a;
    return peer === GOLOS_ATON_USERNAME;
  }

  function updateGolosChatChrome() {
    const bar = document.getElementById("aton-golos-voice-bar");
    if (bar) {
      bar.hidden = true;
      bar.setAttribute("aria-hidden", "true");
    }
    const on =
      isGolosAtonChat() && compose && compose.style.display !== "none" && currentUser;
    if (main) main.classList.toggle("aton-main--golos", Boolean(on));
    if (chat) chat.classList.toggle("aton-chat--golos", Boolean(on));
    if (compose) compose.classList.toggle("aton-compose--golos", Boolean(on));
    if (sendButton) {
      if (on) {
        sendButton.setAttribute("hidden", "");
        sendButton.setAttribute("aria-hidden", "true");
      } else {
        sendButton.removeAttribute("hidden");
        sendButton.removeAttribute("aria-hidden");
      }
    }
    if (inputMessage) {
      if (on) {
        const narrowUi =
          typeof window !== "undefined" &&
          window.matchMedia &&
          window.matchMedia("(max-width: 840px)").matches;
        inputMessage.setAttribute(
          "placeholder",
          narrowUi
            ? t("Текст — Enter · голос — удерживайте микрофон")
            : t("Текст — Enter. Голос — удерживайте кнопку с микрофоном, отпустите для отправки")
        );
        inputMessage.setAttribute(
          "title",
          "Текст: ввод и Enter. Голос: удерживайте круглую кнопку с микрофоном, отпустите — отправка."
        );
      } else {
        inputMessage.setAttribute("placeholder", t("Сообщение…"));
        inputMessage.removeAttribute("title");
      }
    }
  }

  let golosChromeResizeTimer = 0;
  window.addEventListener(
    "resize",
    () => {
      if (!isGolosAtonChat()) return;
      if (golosChromeResizeTimer) clearTimeout(golosChromeResizeTimer);
      golosChromeResizeTimer = setTimeout(() => {
        golosChromeResizeTimer = 0;
        updateGolosChatChrome();
      }, 150);
    },
    { passive: true }
  );

  function setComposeEnabled(enabled) {
    inputMessage.disabled = !enabled;
    sendButton.disabled = !enabled;
    micButton.disabled = !enabled;
    attachButton.disabled = !enabled;
    if (!enabled) {
      abortVoiceUi();
    }
    if (enabled) {
      requestAnimationFrame(() => adjustComposeInputHeight());
    }
    updateGolosChatChrome();
  }

  if (voicePreviewPlayBtn) {
    voicePreviewPlayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!previewAudioEl || !pendingVoiceObjectUrl) return;
      if (previewAudioEl.paused) {
        previewAudioEl.play().catch(() => {});
        voicePreviewPlayBtn.innerHTML = ATON_PREVIEW_PAUSE_SVG;
        voicePreviewPlayBtn.classList.add("aton-voice-preview-play--playing");
      } else {
        previewAudioEl.pause();
        voicePreviewPlayBtn.innerHTML = ATON_PREVIEW_PLAY_SVG;
        voicePreviewPlayBtn.classList.remove("aton-voice-preview-play--playing");
      }
    });
  }
  if (voicePreviewCancelBtn) {
    voicePreviewCancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearVoicePreview();
      setMicButtonIdle();
    });
  }
  if (voicePreviewSendBtn) {
    voicePreviewSendBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!pendingVoiceBlob || !currentChatId) return;
      const blob = pendingVoiceBlob;
      clearVoicePreview();
      setMicButtonIdle();
      try {
        await sendAudioBlobAsMessage(blob);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeReactionPicker();
    if (voicePreviewEl && !voicePreviewEl.hidden) {
      e.preventDefault();
      clearVoicePreview();
      setMicButtonIdle();
    }
  });

  messagesEl.addEventListener("scroll", closeReactionPicker, { passive: true });
  messagesEl.addEventListener("scroll", () => {
    if (!currentChatId || !currentUser) return;
    if (messagesEl.scrollTop > 120) return;
    void loadOlderMessages(currentChatId);
  }, { passive: true });

  function showToast(message) {
    const prev = document.querySelector(".aton-toast");
    if (prev) prev.remove();
    const toast = document.createElement("div");
    toast.className = "aton-toast";
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.left = "50%";
    toast.style.bottom = "18px";
    toast.style.transform = "translateX(-50%)";
    toast.style.zIndex = "200";
    toast.style.padding = "8px 12px";
    toast.style.borderRadius = "999px";
    toast.style.background = "rgba(15,23,42,0.96)";
    toast.style.border = "1px solid rgba(56,189,248,0.55)";
    toast.style.color = "#e5e7eb";
    toast.style.fontSize = "12px";
    toast.style.boxShadow = "0 10px 24px rgba(15,23,42,0.6)";
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 1800);
  }

  function resolveIsSuperAdmin(user) {
    if (!user) return false;
    if (typeof user.isSuperAdmin === "boolean") return user.isSuperAdmin;
    // Вариант подстраховки, если backend пока не отдаёт isSuperAdmin в /api/me
    const pub = String(user.publicId || "").toLowerCase();
    const uname = String(user.username || "").toLowerCase();
    return pub === "akhenaten" || uname === "akhenaten";
  }

  function switchMode(mode) {
    authMode = mode;
    if (mode === "login") {
      tabLogin.classList.add("active");
      tabRegister.classList.remove("active");
      submitButton.textContent = t("Войти");
      hintEl.textContent = t("Введите email и пароль.");
      if (emailGroup) emailGroup.style.display = "block";
      if (passwordGroup) passwordGroup.style.display = "block";
      if (usernameGroup) usernameGroup.style.display = "none";
      if (passwordConfirmGroup) passwordConfirmGroup.style.display = "none";
      if (forgotLink && forgotLink.parentElement) forgotLink.parentElement.style.display = "block";
    } else {
      tabRegister.classList.add("active");
      tabLogin.classList.remove("active");
      submitButton.textContent = t("Создать аккаунт");
      hintEl.textContent = t("Имя, email и пароль не менее 6 символов.");
      if (emailGroup) emailGroup.style.display = "block";
      if (passwordGroup) passwordGroup.style.display = "block";
      if (usernameGroup) usernameGroup.style.display = "block";
      if (passwordConfirmGroup) passwordConfirmGroup.style.display = "block";
      if (forgotLink && forgotLink.parentElement) forgotLink.parentElement.style.display = "none";
    }
  }

  tabLogin.addEventListener("click", () => switchMode("login"));
  tabRegister.addEventListener("click", () => switchMode("register"));

  async function maybeMergeLocalPeerAliasesOnce() {
    if (!currentUser) return;
    const key = LOCAL_PEER_ALIASES_PREFIX + currentUser.username;
    let local = {};
    try {
      const raw = localStorage.getItem(key);
      if (raw) local = JSON.parse(raw) || {};
    } catch {
      return;
    }
    if (!local || typeof local !== "object" || !Object.keys(local).length) return;
    const srv = normalizePeerAliasesClient(currentUser.peerAliases);
    const patch = {};
    for (const [k, v] of Object.entries(local)) {
      if (typeof v !== "string" || !v.trim()) continue;
      if (getPeerAliasValue(srv, k)) continue;
      patch[k] = v.trim();
    }
    if (!Object.keys(patch).length) {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
      return;
    }
    try {
      const r = await api("/api/peer-aliases/merge", {
        method: "PUT",
        body: JSON.stringify({ merge: patch }),
      });
      if (r.peerAliases) {
        currentUser.peerAliases = normalizePeerAliasesClient(r.peerAliases);
      }
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    } catch (e) {
      console.warn("peer-aliases/merge", e);
    }
  }

  let sessionBootstrapNeedsRetry = false;

  async function bootstrapData() {
    const version = ++bootstrapVersion;
    const tokenAtStart = getToken();
    sessionBootstrapNeedsRetry = false;

    if (!tokenAtStart) {
      if (version !== bootstrapVersion) return;
      currentUser = null;
      allUsers = [];
      allChats = [];
      discoverChats = [];
      allMessages = [];
      contacts = { friends: [], blocked: [], requestsIn: [], requestsOut: [] };
      currentChatId = null;
      return;
    }

    function shouldRetryMeError(e) {
      if (e && e.status === 401) return false;
      return (
        !e ||
        e.isNetwork ||
        !e.status ||
        (e.status >= 500 && e.status < 600) ||
        e.status === 429 ||
        e.status === 408
      );
    }

    try {
      const maxMe = 6;
      let nextCurrentUser;
      let lastErr;
      for (let attempt = 0; attempt < maxMe; attempt++) {
        if (attempt > 0) {
          const ms = Math.min(4000, 500 * (1 << (attempt - 1)));
          await new Promise((r) => setTimeout(r, ms));
        }
        if (version !== bootstrapVersion) return;
        try {
          nextCurrentUser = await api("/api/me");
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          if (e && e.status === 401) throw e;
          if (!shouldRetryMeError(e) || attempt === maxMe - 1) {
            throw e;
          }
        }
      }
      if (version !== bootstrapVersion) return;

      currentUser = nextCurrentUser;
      currentUser.isSuperAdmin = resolveIsSuperAdmin(currentUser);
      assignPeerAliasesOnUser(currentUser);
      persistSessionSnapshot(currentUser);

      if (!currentUser.verified) return;

      const listWarm = readListBootstrapCache(currentUser.username);
      if (listWarm) {
        allChats = listWarm.chats;
        allMessages = listWarm.messages;
      }

      if (version !== bootstrapVersion) return;
      applyCurrentUserUI();
      restoreLastOpenChatIfValid();
      renderChatList();
      renderMessages({ deferIfVoice: true });
      updateTopbarTitle();
      updateFriendsBadge();

      await maybeMergeLocalPeerAliasesOnce();
      if (version !== bootstrapVersion) return;
      applyCurrentUserUI();

      /* Сайдбар без полного renderMessages — иначе при медленном /api/messages/all каждые
         приходящие чаты/users/contacts пересоздают DOM ленты и сбрасывают воспроизведение ГС. */
      function paintBootstrapSidebar() {
        if (version !== bootstrapVersion) return;
        renderChatList();
        updateTopbarTitle();
        updateFriendsBadge();
        renderContacts();
      }

      function paintBootstrapAfterMessages() {
        if (version !== bootstrapVersion) return;
        renderChatList();
        renderMessages({ deferIfVoice: true });
        updateTopbarTitle();
        updateFriendsBadge();
        renderContacts();
      }

      void api("/api/users")
        .then((list) => {
          if (version !== bootstrapVersion) return;
          allUsers = Array.isArray(list) ? list : [];
          applyCurrentUserUI();
          paintBootstrapSidebar();
        })
        .catch((err) => {
          console.error("GET /api/users (bootstrap):", err);
        });

      async function loadChatsForBootstrap() {
        try {
          const v = await api("/api/chats");
          if (version !== bootstrapVersion) return;
          allChats = Array.isArray(v) ? v : [];
        } catch (e) {
          if (version !== bootstrapVersion) return;
          if (e && e.status === 401) throw e;
          // Сеть/таймаут/5xx: не затирать allChats — оставляем тёплый кэш sessionStorage / прошлый успех
          throw e;
        }
        paintBootstrapSidebar();
      }

      async function loadMessagesForBootstrap() {
        try {
          const v = await api("/api/messages/all");
          if (version !== bootstrapVersion) return;
          const incoming = Array.isArray(v) ? v : [];
          const prev = Array.isArray(allMessages) ? allMessages : [];
          const byId = new Map();
          for (const m of prev) {
            if (m && m.id) byId.set(String(m.id), m);
          }
          for (const m of incoming) {
            if (m && m.id) {
              const id = String(m.id);
              const prev = byId.get(id);
              byId.set(id, prev ? mergeMessagePreserveMedia(m, prev) : m);
            }
          }
          allMessages = [...byId.values()].sort(
            (a, b) => new Date(a.time) - new Date(b.time)
          );
        } catch (e) {
          if (version !== bootstrapVersion) return;
          if (e && e.status === 401) throw e;
          // Иначе при сбое API список диалогов «исчезал» — пользователь видел пустой сайдбар
          throw e;
        }
        paintBootstrapAfterMessages();
      }

      async function loadContactsForBootstrap() {
        try {
          const v = await api("/api/contacts");
          if (version !== bootstrapVersion) return;
          contacts = v;
          if (!contacts.requestsIn) contacts.requestsIn = [];
          if (!contacts.requestsOut) contacts.requestsOut = [];
        } catch {
          if (version !== bootstrapVersion) return;
          contacts = { friends: [], blocked: [], requestsIn: [], requestsOut: [] };
        }
        paintBootstrapSidebar();
      }

      async function loadDiscoverForBootstrap() {
        try {
          const v = await api("/api/chats/discover");
          if (version !== bootstrapVersion) return;
          discoverChats = Array.isArray(v) ? v : [];
        } catch {
          if (version !== bootstrapVersion) return;
          discoverChats = [];
        }
        paintBootstrapSidebar();
      }

      await loadContactsForBootstrap();
      if (version !== bootstrapVersion) return;

      const settled = await Promise.allSettled([
        loadChatsForBootstrap(),
        loadMessagesForBootstrap(),
        loadDiscoverForBootstrap(),
      ]);
      if (version !== bootstrapVersion) return;

      const chatsRes = settled[0];
      const msgRes = settled[1];

      if (chatsRes.status === "rejected" && msgRes.status === "rejected") {
        throw chatsRes.reason;
      }
      if (chatsRes.status === "rejected" || msgRes.status === "rejected") {
        sessionBootstrapNeedsRetry = true;
      } else {
        sessionBootstrapNeedsRetry = false;
      }

      if (getToken() === tokenAtStart && currentUser && currentUser.username) {
        persistListBootstrapCache(currentUser.username, allChats, allMessages);
      }

      restoreLastOpenChatIfValid();
    } catch (err) {
      console.error(err);

      if (version !== bootstrapVersion) return;

      const sessionGone =
        err.status === 401 ||
        (err.message &&
          (err.message.includes("Неверный токен") || err.message.includes("Сессия устарела")));

      if (sessionGone) {
        if (getToken() === tokenAtStart) {
          setToken(null);
          clearSessionSnapshot();
          currentUser = null;
          allUsers = [];
          allChats = [];
          discoverChats = [];
          allMessages = [];
          contacts = { friends: [], blocked: [], requestsIn: [], requestsOut: [] };
          currentChatId = null;
        }
        return;
      }

      if (getToken() === tokenAtStart) {
        sessionBootstrapNeedsRetry = true;
        const snap = readSessionSnapshot();
        if (snap && snap.verified) {
          currentUser = {
            id: snap.id,
            username: snap.username,
            displayName: snap.displayName || snap.username,
            email: snap.email,
            publicId: snap.publicId,
            avatarDataUrl: snap.avatarDataUrl,
            verified: true,
            peerAliases: {},
          };
          assignPeerAliasesOnUser(currentUser);
          currentUser.isSuperAdmin = resolveIsSuperAdmin(currentUser);
          allUsers = [];
          allChats = [];
          discoverChats = [];
          allMessages = [];
          contacts = { friends: [], blocked: [], requestsIn: [], requestsOut: [] };
          currentChatId = null;
          if (sidebarHeader) sidebarHeader.style.display = "none";
          authRoot.style.display = "none";
          authLoginBlock.style.display = "none";
          sidebarLangFooter.style.display = "none";
          if (hintEl) {
            hintEl.textContent = "";
          }
          if (statusEl) {
            statusEl.textContent = t("Нет сети — подключаемся, как только сеть появится");
          }
        } else {
          currentUser = null;
          if (sidebarHeader) sidebarHeader.style.display = "";
          authRoot.style.display = "";
          authLoginBlock.style.display = "block";
          sidebarLangFooter.style.display = "";
          if (hintEl) {
            hintEl.textContent = t("Не удалось загрузить данные. Проверьте сеть и обновите страницу.");
          }
          if (statusEl) {
            statusEl.textContent = t("Проблема с подключением");
          }
        }
      }
    }
  }

  function applyCurrentUserUI() {
    const user = currentUser;
    if (!user) {
      mainView = "chat";
      if (profilePage) profilePage.hidden = true;
      if (chat) chat.hidden = false;
      if (sidebarHeader) sidebarHeader.style.display = "";
      authRoot.style.display = "";
      authLoginBlock.style.display = "block";
      sidebarLangFooter.style.display = "";
      statusEl.textContent = t("Войдите по форме слева");
      const tb = document.getElementById("aton-topbar");
      if (tb) tb.classList.add("aton-topbar--guest");
      userPill.style.display = "none";
      if (adminUsersButton) adminUsersButton.style.display = "none";
      if (moderationButton) moderationButton.style.display = "none";
      setComposeEnabled(false);
      createGroupButton.disabled = true;
      createGroupButton.style.display = "none";
      searchInput.disabled = true;
      // Чаты и поле ввода сообщений скрыты до авторизации
      chatsRoot.style.display = "none";
      compose.style.display = "none";
      if (contactsEl) contactsEl.innerHTML = "";
      if (friendsBtn) friendsBtn.style.display = "none";
      /* Тема доступна и до регистрации: на мобилке main скрыт — переключатель только в шапке сайдбара */
      if (sidebarToolbar) {
        sidebarToolbar.removeAttribute("hidden");
        sidebarToolbar.hidden = false;
      }
      if (sidebarFriendsBtn) sidebarFriendsBtn.style.display = "none";
      if (notifyPermissionBtn) notifyPermissionBtn.style.display = "none";
      if (friendsOverlay) friendsOverlay.hidden = true;
    } else {
      hasOnboardingAutoFocused = false;
      if (sidebarHeader) sidebarHeader.style.display = "none";
      authRoot.style.display = "none";
      authLoginBlock.style.display = "none";
      sidebarLangFooter.style.display = "none";
      const tb = document.getElementById("aton-topbar");
      if (tb) tb.classList.remove("aton-topbar--guest");
      const full = userByUsername(user.username) || user;
      const displayName = selfDisplayNameForUi(user, full);
      const publicId = full.publicId || full.username;

      // Sidebar online status
      const lastSeenIso = full.lastSeen;
      let isOnline = false;
      if (lastSeenIso) {
        const diff = Date.now() - new Date(lastSeenIso).getTime();
        isOnline = diff < 60 * 1000;
      }
      userPill.classList.toggle("online", isOnline);
      userPill.classList.toggle("offline", !isOnline);
      statusEl.textContent = isOnline
        ? tf("В сети как {name}", { name: displayName })
        : tf("Недавно были в сети как {name}", { name: displayName });
      userPill.style.display = "inline-flex";
      if (friendsBtn) friendsBtn.style.display = user.verified ? "inline-flex" : "none";
      if (sidebarToolbar) {
        sidebarToolbar.removeAttribute("hidden");
        sidebarToolbar.hidden = false;
      }
      if (sidebarFriendsBtn) {
        sidebarFriendsBtn.style.display = user.verified ? "inline-flex" : "none";
      }
      if (adminUsersButton) {
        adminUsersButton.style.display = currentUser?.isSuperAdmin ? "inline-flex" : "none";
      }
      if (moderationButton) {
        moderationButton.style.display = currentUser?.isSuperAdmin ? "inline-flex" : "none";
      }
      userNameLabel.innerHTML = "";
      const pillNameText = document.createTextNode(displayName);
      userNameLabel.appendChild(pillNameText);
      if (full.isVerified) {
        const pillBadge = document.createElement("span");
        pillBadge.className = "aton-verified-badge";
        pillBadge.textContent = "✔";
        pillBadge.title = t("Верифицировано");
        userNameLabel.appendChild(pillBadge);
      }
      const pillAvatar = userPill.querySelector(".aton-user-avatar");
      pillAvatar.innerHTML = "";
      if (full.avatarDataUrl) {
        const img = document.createElement("img");
        img.src = full.avatarDataUrl;
        pillAvatar.appendChild(img);
      }
      setComposeEnabled(Boolean(currentChatId));
      createGroupButton.disabled = false;
      createGroupButton.style.display = "inline-flex";
      searchInput.disabled = false;
      typingIndicator.style.display = "none";
      chatsRoot.style.display = "flex";
      // Показываем низ только если уже выбран чат
      compose.style.display = currentChatId ? "flex" : "none";
      updateNotifyPermissionButton();
    }
    shell.classList.toggle("aton-shell--guest-landing", !currentUser);
    shell.classList.toggle("aton-shell--no-chat", !currentChatId);
    shell.classList.toggle("aton-shell--has-chat", Boolean(currentChatId));
    shell.classList.toggle("aton-shell--profile", mainView === "profile");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;

    try {
      let data;
      if (authMode === "register") {
        if (!email || !username || !password || !passwordConfirm) {
          hintEl.textContent = t("Укажите email, имя и дважды один и тот же пароль.");
          return;
        }
        if (password.length < 6) {
          hintEl.textContent = t("Пароль должен содержать не менее 6 символов.");
          return;
        }
        if (password !== passwordConfirm) {
          hintEl.textContent = t("Пароли не совпадают. Введите их одинаково.");
          return;
        }
        data = await api("/api/register", {
          method: "POST",
          body: JSON.stringify({ email, username, password }),
        });
        hintEl.textContent = t("Аккаунт создан. Проверьте почту для подтверждения.");
      } else {
        if (!email || !password) {
          hintEl.textContent = t("Введите email и пароль.");
          return;
        }
        data = await api("/api/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        hintEl.textContent = t("Вход выполнен.");
      }
      setToken(data.token);
      socket.auth.token = data.token;
      socket.disconnect().connect();

      if (data.user) {
        currentUser = data.user;
        currentUser.isSuperAdmin = resolveIsSuperAdmin(currentUser);
        assignPeerAliasesOnUser(currentUser);
        persistSessionSnapshot(currentUser);
      }

      if (data.user && !data.user.verified) {
        showVerifyScreen(data.user.email);
        return;
      }

      await bootstrapData();
      unlockNotificationAudio();
      applyCurrentUserUI();
      renderContacts();
      renderChatList();
      renderMessages({ deferIfVoice: true });
      updateTopbarTitle();
    } catch (err) {
      hintEl.textContent = err.message;
    }
  });

  // Ссылка "Забыли пароль?" ведёт на отдельную страницу forgot.html,
  // поэтому дополнительных обработчиков здесь не требуется.

  function performFullLogout() {
    try {
      if (currentUser && currentUser.username) {
        localStorage.removeItem(LAST_CHAT_KEY_PREFIX + currentUser.username);
      }
    } catch (_) {}
    notifyServerLogout();
    clearSessionSnapshot();
    setToken(null);
    socket.auth.token = "";
    socket.disconnect().connect();
    currentUser = null;
    allUsers = [];
    allChats = [];
    discoverChats = [];
    allMessages = [];
    contacts = { friends: [], blocked: [], requestsIn: [], requestsOut: [] };
    switchSocketChat(null);
    currentChatId = null;
    applyCurrentUserUI();
    renderChatList();
    renderMessages();
    updateTopbarTitle();
  }
  document.addEventListener("aton:session-expired", performFullLogout);

  if (backButton) {
    backButton.addEventListener("click", () => {
      if (mainView === "profile") {
        closeProfilePage();
        return;
      }
      switchSocketChat(null);
      currentChatId = null;
      applyCurrentUserUI();
      renderChatList();
      renderMessages();
      updateTopbarTitle();
    });
  }

  function currentChatPeer() {
    const current = currentUser;
    if (!current || !currentChatId) return null;
    const [a, b] = currentChatId.split("|");
    return a === current.username ? b : a;
  }

  /** Для POST: JSON.stringify не сериализует undefined — иначе сервер не получает to и «Голос Атона» не отвечает. */
  function dmToForApi() {
    if (!currentChatId) return null;
    if (currentChatId === "global" || currentChatId.startsWith("group:") || currentChatId.startsWith("channel:")) {
      return null;
    }
    const p = currentChatPeer();
    return p === undefined ? null : p;
  }

  function peerContactStatus(username) {
    if (!username) return "none";
    if (contacts.blocked.some((b) => b.username === username)) return "blocked";
    if (contacts.friends.some((f) => f.username === username)) return "friend";
    if ((contacts.requestsIn || []).some((u) => u.username === username)) return "in";
    if ((contacts.requestsOut || []).some((u) => u.username === username)) return "out";
    return "none";
  }

  function updateFriendsBadge() {
    const n = (contacts.requestsIn || []).length;
    const setBadge = (el) => {
      if (!el) return;
      if (n > 0) {
        el.textContent = String(n);
        el.style.display = "";
      } else {
        el.textContent = "";
        el.style.display = "none";
      }
    };
    setBadge(friendsBadge);
    setBadge(friendsSidebarBadge);
  }

  function renderFriendsPanel() {
    if (!friendsOverlay) return;
    const incEl = friendsOverlay.querySelector("#aton-friends-incoming");
    const outEl = friendsOverlay.querySelector("#aton-friends-outgoing");
    const listEl = friendsOverlay.querySelector("#aton-friends-list");
    const blockedEl = friendsOverlay.querySelector("#aton-friends-blocked");
    const inCount = friendsOverlay.querySelector("#aton-friends-in-count");
    const inWrap = friendsOverlay.querySelector("#aton-friends-incoming-wrap");
    const outWrap = friendsOverlay.querySelector("#aton-friends-outgoing-wrap");
    if (!incEl || !outEl || !listEl || !blockedEl) return;

    const ri = contacts.requestsIn || [];
    const ro = contacts.requestsOut || [];
    if (inCount) inCount.textContent = ri.length ? `(${ri.length})` : "";
    if (inWrap) inWrap.style.display = ri.length ? "" : "none";
    if (outWrap) outWrap.style.display = ro.length ? "" : "none";

    function rowHtml(u, actionsHtml) {
      const name = escHtml(u.displayName || u.username);
      const pid = escHtml(u.publicId || u.username);
      return `<div class="aton-friends-row">
        <div class="aton-friends-row-main">
          <span class="aton-friends-row-name">${name}</span>
          <span class="aton-friends-row-handle">@${pid}</span>
        </div>
        <div class="aton-friends-row-actions">${actionsHtml}</div>
      </div>`;
    }

    incEl.innerHTML = ri
      .map((u) =>
        rowHtml(
          u,
          `<button type="button" class="aton-friends-btn aton-friends-accept" data-action="accept" data-u="${escHtml(u.username)}">Принять</button>
           <button type="button" class="aton-friends-btn aton-friends-decline" data-action="decline" data-u="${escHtml(u.username)}">Отклонить</button>`
        )
      )
      .join("");

    outEl.innerHTML = ro
      .map((u) =>
        rowHtml(
          u,
          `<button type="button" class="aton-friends-btn aton-friends-cancel" data-action="cancel" data-u="${escHtml(u.username)}">Отменить заявку</button>`
        )
      )
      .join("");

    const fr = contacts.friends || [];
    listEl.innerHTML = fr.length
      ? fr
          .map((u) =>
            rowHtml(u, `<span class="aton-friends-muted">${escHtml(t("В друзьях"))}</span>`)
          )
          .join("")
      : `<div class="aton-friends-empty">${escHtml(t("Пока никого нет. Отправьте заявку из поиска или из открытого чата."))}</div>`;

    const bl = contacts.blocked || [];
    blockedEl.innerHTML = bl.length
      ? bl
          .map((u) =>
            rowHtml(
              u,
              `<button type="button" class="aton-friends-btn aton-friends-unblock" data-action="unblock" data-u="${escHtml(u.username)}">Разблокировать</button>`
            )
          )
          .join("")
      : `<div class="aton-friends-empty">Нет заблокированных</div>`;
  }

  function updatePeerActionBar() {
    const inner = document.getElementById("aton-peer-action-bar-inner");
    const wrap = document.getElementById("aton-peer-action-bar");
    if (!inner || !wrap) return;
    if (mainView === "profile") {
      wrap.hidden = true;
      inner.innerHTML = "";
      return;
    }
    const peer = currentChatPeer();
    if (
      !currentUser ||
      !currentChatId ||
      !peer ||
      currentChatId.startsWith("group:") ||
      currentChatId.startsWith("channel:")
    ) {
      wrap.hidden = true;
      inner.innerHTML = "";
      return;
    }
    if (peer === GOLOS_ATON_USERNAME) {
      wrap.hidden = true;
      inner.innerHTML = "";
      return;
    }
    wrap.hidden = false;
    const st = peerContactStatus(peer);
    const isBlocked = st === "blocked";
    const peerUser = userByUsername(peer);
    const name = displayNameForPeer(currentUser.username, peer, peerUser);
    /* Имя уже в шапке чата — здесь только действия, как в Telegram */
    let html = `<div class="aton-peer-action-inner aton-peer-action-inner--toolbar-only">
      <div class="aton-peer-action-btns">`;
    html += `<button type="button" class="aton-peer-rename-local aton-peer-rename-local--icon" data-peer="${escHtml(peer)}" title="${escHtml(tf("Показываемое имя ({name}) — изменить в вашем списке", { name }))}" aria-label="${escHtml(t("Изменить отображаемое имя собеседника"))}">
        <svg class="aton-peer-rename-local-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>`;
    if (isBlocked) {
      html += `<button type="button" class="aton-peer-btn aton-peer-unblock" data-peer="${escHtml(peer)}">${escHtml(t("Разблокировать"))}</button>`;
    } else {
      html += `<button type="button" class="aton-peer-btn aton-peer-block" data-peer="${escHtml(peer)}">${escHtml(t("Заблокировать"))}</button>`;
    }
    if (st === "friend") {
      html += `<span class="aton-peer-muted">${escHtml(t("В друзьях"))}</span>`;
    } else if (st === "in") {
      html += `<button type="button" class="aton-peer-btn aton-peer-accept" data-peer="${escHtml(peer)}">${escHtml(t("Принять"))}</button>`;
      html += `<button type="button" class="aton-peer-btn aton-peer-decline" data-peer="${escHtml(peer)}">${escHtml(t("Отклонить"))}</button>`;
    } else if (st === "out") {
      html += `<span class="aton-peer-muted">${escHtml(t("Заявка отправлена"))}</span>`;
      html += `<button type="button" class="aton-peer-btn aton-peer-cancel" data-peer="${escHtml(peer)}">${escHtml(t("Отменить заявку"))}</button>`;
    } else if (!isBlocked) {
      html += `<button type="button" class="aton-peer-btn aton-peer-add" data-peer="${escHtml(peer)}">${escHtml(t("Добавить в друзья"))}</button>`;
    }
    const mutedN =
      currentUser && currentChatId ? isChatNotifyMuted(currentUser.username, currentChatId) : false;
    html += `<button type="button" class="aton-peer-btn aton-peer-notify-toggle ${
      mutedN ? "aton-peer-notify-toggle--muted" : ""
    }" data-chat-id="${escHtml(currentChatId)}" title="${
      mutedN
        ? t("Включить звук и уведомления для этого чата")
        : t("Выключить звук и уведомления для этого чата")
    }" aria-label="${escHtml(t("Уведомления отключены"))}">${
      mutedN
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 11A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14.07"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
    }</button>`;
    html += `</div></div>`;
    inner.innerHTML = html;
  }

  function openPeerAliasModal(peer) {
    if (!peer || !currentUser) return;
    const peerUser = userByUsername(peer);
    const cur = getPeerAliasValue(getPeerAliasesMap(currentUser.username), peer) || "";
    const defaultDisplay = peerUser?.displayName || peer;

    const overlay = document.createElement("div");
    overlay.className = "aton-peer-alias-overlay";
    overlay.innerHTML = `
      <div class="aton-peer-alias-backdrop" aria-label="Закрыть" role="presentation"></div>
      <div class="aton-peer-alias-modal" role="dialog" aria-modal="true" aria-labelledby="aton-peer-alias-title">
        <h2 class="aton-peer-alias-heading" id="aton-peer-alias-title">Изменить имя собеседника</h2>
        <p class="aton-peer-alias-lead">Сохраняется в вашем аккаунте — одинаково на всех устройствах, где вы вошли. Собеседник по-прежнему видит свой профиль в Атоне.</p>
        <label class="aton-input-label" for="aton-peer-alias-input">Как показывать в чатах</label>
        <input type="text" id="aton-peer-alias-input" class="aton-input aton-peer-alias-input" autocomplete="off" />
        <p class="aton-peer-alias-footnote">Оставьте поле пустым и сохраните — вернётся имя из профиля.</p>
        <div class="aton-peer-alias-actions">
          <button type="button" class="aton-new-chat-button" id="aton-peer-alias-cancel">Отмена</button>
          <button type="button" class="aton-primary-button" id="aton-peer-alias-save">Сохранить</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector("#aton-peer-alias-input");
    input.value = cur || defaultDisplay;

    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onEsc);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onEsc);

    overlay.querySelector(".aton-peer-alias-backdrop").addEventListener("click", close);
    overlay.querySelector("#aton-peer-alias-cancel").addEventListener("click", close);
    overlay.querySelector("#aton-peer-alias-save").addEventListener("click", async () => {
      const next = input.value.trim();
      try {
        await setPeerAlias(currentUser.username, peer, next);
        renderChatList();
        renderMessages({ deferIfVoice: true });
        updateTopbarTitle();
        updatePeerActionBar();
        showToast(t("Сохранено"));
        close();
      } catch (e) {
        showToast(e && e.message ? e.message : t("Не удалось сохранить"));
      }
    });

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  function renderContacts() {
    renderFriendsPanel();
    updateFriendsBadge();
    updatePeerActionBar();
  }

  (function bindContactsChrome() {
    if (!friendsOverlay || !peerActionBar) return;
    if (bindContactsChrome.done) return;
    bindContactsChrome.done = true;

    async function pullContacts() {
      contacts = await api("/api/contacts");
      if (!contacts.requestsIn) contacts.requestsIn = [];
      if (!contacts.requestsOut) contacts.requestsOut = [];
      renderContacts();
      renderChatList();
      if (searchInput.value.trim()) handleUserSearch();
      updateTopbarTitle();
    }

    if (friendsBtn) {
      friendsBtn.addEventListener("click", () => {
        renderFriendsPanel();
        friendsOverlay.hidden = !friendsOverlay.hidden;
      });
    }
    if (sidebarFriendsBtn) {
      sidebarFriendsBtn.addEventListener("click", () => {
        renderFriendsPanel();
        friendsOverlay.hidden = !friendsOverlay.hidden;
      });
    }

    friendsOverlay.addEventListener("click", async (e) => {
      if (e.target.closest(".aton-friends-overlay-backdrop")) {
        friendsOverlay.hidden = true;
        return;
      }
      if (e.target.closest("#aton-friends-close")) {
        friendsOverlay.hidden = true;
        return;
      }
      const btn = e.target.closest("[data-action]");
      if (!btn || !btn.getAttribute("data-u")) return;
      const un = btn.getAttribute("data-u");
      const act = btn.getAttribute("data-action");
      try {
        if (act === "accept") {
          await api("/api/contacts/accept", { method: "POST", body: JSON.stringify({ username: un }) });
        } else if (act === "decline") {
          await api("/api/contacts/decline", { method: "POST", body: JSON.stringify({ username: un }) });
        } else if (act === "cancel") {
          await api("/api/contacts/cancel", { method: "POST", body: JSON.stringify({ username: un }) });
        } else if (act === "unblock") {
          await api("/api/contacts/unblock", { method: "POST", body: JSON.stringify({ username: un }) });
        } else return;
        await pullContacts();
      } catch (err) {
        alert(err.message || t("Ошибка"));
      }
    });

    peerActionBar.addEventListener("click", async (e) => {
      const notifyBtn = e.target.closest(".aton-peer-notify-toggle");
      if (notifyBtn && peerActionBar.contains(notifyBtn)) {
        e.preventDefault();
        const cid = notifyBtn.getAttribute("data-chat-id");
        if (!cid || !currentUser) return;
        const nextMuted = !isChatNotifyMuted(currentUser.username, cid);
        setChatNotifyMuted(currentUser.username, cid, nextMuted);
        updatePeerActionBar();
        renderChatList();
        showToast(nextMuted ? t("Для этого чата выключены звук и уведомления") : t("Звук и уведомления снова включены"));
        return;
      }
      const renameBtn = e.target.closest(".aton-peer-rename-local");
      if (renameBtn && peerActionBar.contains(renameBtn)) {
        e.preventDefault();
        const peer = renameBtn.getAttribute("data-peer");
        if (!peer || !currentUser) return;
        openPeerAliasModal(peer);
        return;
      }
      const btn = e.target.closest("[data-peer]");
      if (!btn || !peerActionBar.contains(btn)) return;
      const peer = btn.getAttribute("data-peer");
      if (!peer) return;
      try {
        if (btn.classList.contains("aton-peer-block")) {
          await api("/api/contacts/block", { method: "POST", body: JSON.stringify({ username: peer }) });
        } else if (btn.classList.contains("aton-peer-unblock")) {
          await api("/api/contacts/unblock", { method: "POST", body: JSON.stringify({ username: peer }) });
        } else if (btn.classList.contains("aton-peer-add")) {
          const r = await api("/api/contacts/add", { method: "POST", body: JSON.stringify({ username: peer }) });
          if (r.status === "requested") showToast(t("Заявка отправлена"));
          if (r.status === "accepted") showToast(t("Вы в друзьях"));
        } else if (btn.classList.contains("aton-peer-accept")) {
          await api("/api/contacts/accept", { method: "POST", body: JSON.stringify({ username: peer }) });
          showToast(t("Заявка принята"));
        } else if (btn.classList.contains("aton-peer-decline")) {
          await api("/api/contacts/decline", { method: "POST", body: JSON.stringify({ username: peer }) });
        } else if (btn.classList.contains("aton-peer-cancel")) {
          await api("/api/contacts/cancel", { method: "POST", body: JSON.stringify({ username: peer }) });
        } else return;
        await pullContacts();
      } catch (err) {
        alert(err.message || t("Ошибка"));
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!friendsOverlay || friendsOverlay.hidden) return;
      friendsOverlay.hidden = true;
    });
  })();

  function renderChatList() {
    if (openChatMenu) {
      openChatMenu.remove();
      openChatMenu = null;
    }
    chatListEl.innerHTML = "";
    const current = currentUser;

    if (!current) {
      const info = document.createElement("div");
      info.className = "aton-chat-list-empty";
      info.textContent = t("После входа здесь появятся ваши чаты.");
      chatListEl.appendChild(info);
      if (contactsEl) contactsEl.innerHTML = "";
      return;
    }

    const pins = getPinnedChats(current.username);
    const reads = getChatReads(current.username);

    // Показываем группы и каналы. Старые чаты без type тоже считаем группой.
    const chats = allChats.filter(
      (c) => c.type === "group" || c.type === "channel" || !c.type
    );

    const privateFromMessages = new Set();
    allMessages.forEach((m) => {
      if (!m) return;
      if (m.to) {
        const id = chatIdForUsers(m.from, m.to);
        if (m.from === current.username || m.to === current.username) {
          privateFromMessages.add(id);
        }
        return;
      }
      // Личка в БД может идти по chatId без to (legacy / только chatId в сообщении)
      if (m.chatId && isPrivateDirectChat(m.chatId)) {
        const parts = m.chatId.split("|");
        if (
          parts.length === 2 &&
          (parts[0] === current.username || parts[1] === current.username) &&
          messageBelongsToDmId(m, m.chatId)
        ) {
          privateFromMessages.add(m.chatId);
        }
      }
    });
    const privateChatIds = new Set(privateFromMessages);
    const golosDmId = chatIdForUsers(current.username, GOLOS_ATON_USERNAME);
    privateChatIds.add(golosDmId);

    /* Лички из контактов и закрепов: иначе при лимите GET /api/messages/all (MESSAGES_BOOTSTRAP_MAX)
       в ленте нет ни одного сообщения из диалога — и он пропадает из сайдбара. */
    for (const f of contacts.friends || []) {
      if (f && f.username && !sameAtonUsername(f.username, current.username)) {
        privateChatIds.add(chatIdForUsers(current.username, f.username));
      }
    }
    for (const pinId of pins) {
      if (typeof pinId === "string" && isPrivateDirectChat(pinId)) {
        const parts = pinId.split("|");
        if (
          parts.length === 2 &&
          (sameAtonUsername(parts[0], current.username) ||
            sameAtonUsername(parts[1], current.username))
        ) {
          privateChatIds.add(pinId);
        }
      }
    }

    // Учитываем пин и непрочитанные для групп
    const sortedChats = [...chats].sort((a, b) => {
      const aPinned = pins.has(a.id);
      const bPinned = pins.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      const ta = lastActivityAtForGroupChatId(a.id, allMessages);
      const tb = lastActivityAtForGroupChatId(b.id, allMessages);
      if (tb !== ta) return tb - ta;
      return (a.title || "").localeCompare(b.title || "");
    });

    let groupUnreadTotal = 0;
    let privateUnreadTotal = 0;

    function appendPrivateListRow(dmId) {
      if (chatFilter === "group" && dmId !== golosDmId) return;
      const [a, b] = dmId.split("|");
      const peer = a === current.username ? b : a;
      const isGolos = peer === GOLOS_ATON_USERNAME;
      const peerUser = userByUsername(peer);
      const title = displayNameForPeer(current.username, peer, peerUser);
      const chatMessages = allMessages
        .filter((m) => messageBelongsToDmId(m, dmId))
        .sort((a, b) => new Date(a.time) - new Date(b.time));
      const lastMsg = chatMessages[chatMessages.length - 1];
      const unread = countUnreadInbound(chatMessages, reads[dmId], current.username);
      privateUnreadTotal += unread;
      const pinned = pins.has(dmId);
      const pMuted = isChatNotifyMuted(current.username, dmId);
      const item = document.createElement("button");
      item.className =
        "aton-chat-item" +
        (currentChatId === dmId ? " active" : "") +
        (pMuted ? " aton-chat-item--notify-muted" : "");

      const presence = formatPeerPresence(peerUser);
      const avatarWrap = document.createElement("div");
      avatarWrap.className = "aton-chat-avatar-wrap";
      const avatar = document.createElement("div");
      avatar.className = "aton-chat-avatar";
      if (isGolos && peerUser?.avatarDataUrl) {
        const img = document.createElement("img");
        img.src = peerUser.avatarDataUrl;
        img.alt = "";
        avatar.appendChild(img);
      } else if (isGolos) {
        avatar.textContent = "☀";
      } else if (peerUser?.avatarDataUrl) {
        const img = document.createElement("img");
        img.src = peerUser.avatarDataUrl;
        avatar.appendChild(img);
      } else {
        avatar.textContent = (title || peer).slice(0, 1).toUpperCase();
      }
      avatarWrap.appendChild(avatar);
      if (presence.online) {
        const dot = document.createElement("span");
        dot.className = "aton-chat-avatar-status-dot";
        dot.setAttribute("aria-hidden", "true");
        dot.title = presence.title || "В сети";
        avatarWrap.appendChild(dot);
      }

      const main = document.createElement("div");
      main.className = "aton-chat-item-main";
      const titleEl = document.createElement("div");
      titleEl.className = "aton-chat-item-title";
      titleEl.textContent = title;
      if (pinned && !isGolos) {
        const pinSpan = document.createElement("span");
        pinSpan.className = "aton-chat-pin";
        pinSpan.textContent = "★";
        titleEl.appendChild(pinSpan);
      }
      if (pMuted) {
        const offEl = document.createElement("span");
        offEl.className = "aton-chat-notify-off";
        offEl.title = t("Уведомления отключены");
        offEl.setAttribute("aria-label", t("Уведомления отключены"));
        offEl.textContent = "🔕";
        titleEl.appendChild(offEl);
      }
      const previewEl = document.createElement("div");
      previewEl.className = "aton-chat-item-subtitle aton-chat-item-preview";
      previewEl.textContent = lastMsg
        ? buildLastMessagePreviewForChatList(lastMsg)
        : t("Нет сообщений");
      main.appendChild(titleEl);
      if (isGolos) {
        const subtitleEl = document.createElement("div");
        subtitleEl.className = "aton-chat-item-subtitle";
        subtitleEl.textContent = t("Голос, не бот");
        main.appendChild(subtitleEl);
      }
      main.appendChild(previewEl);

      const metaWrap = document.createElement("div");
      metaWrap.className = "aton-chat-meta";
      const timeEl = document.createElement("div");
      timeEl.className = "aton-chat-time";
      timeEl.textContent = lastMsg ? formatChatListMessageTime(lastMsg.time) : "";
      metaWrap.appendChild(timeEl);
      if (unread) {
        const badge = document.createElement("div");
        badge.className = "aton-chat-unread-badge";
        badge.textContent = Math.min(unread, 99);
        metaWrap.appendChild(badge);
      }

      item.appendChild(avatarWrap);
      item.appendChild(main);
      item.appendChild(metaWrap);
      item.addEventListener("click", () => {
        leaveProfileForChatSelection();
        currentChatId = dmId;
        switchSocketChat(currentChatId);
        if (current.username) setLastChatId(current.username, currentChatId);
        const newReads = { ...reads, [dmId]: new Date().toISOString() };
        setChatReads(current.username, newReads);
        renderChatList();
        renderMessages();
        updateTopbarTitle();
        void pullChatReceipts(dmId);
      });
      chatListEl.appendChild(item);
    }

    appendPrivateListRow(golosDmId);

    // Считаем непрочитанные для групп и приватных чатов для иконок в топбаре
    sortedChats.forEach((chatMeta) => {
      const chatMessages = allMessages
        .filter((m) => m.chatId === chatMeta.id)
        .sort((a, b) => new Date(a.time) - new Date(b.time));
      const lastMsg = chatMessages[chatMessages.length - 1];
      const unread = countUnreadInbound(
        chatMessages,
        reads[chatMeta.id],
        current.username
      );
      const pinned = pins.has(chatMeta.id);
      groupUnreadTotal += unread;
      if (chatFilter === "private") {
        // В режиме «личные» группы скрываем
        return;
      }

      const openThisChat = () => {
        leaveProfileForChatSelection();
        currentChatId = chatMeta.id;
        switchSocketChat(currentChatId);
        if (current.username) setLastChatId(current.username, currentChatId);
        const newReads = { ...reads, [chatMeta.id]: new Date().toISOString() };
        setChatReads(current.username, newReads);
        renderChatList();
        renderMessages();
        updateTopbarTitle();
        void pullChatReceipts(chatMeta.id);
      };

      const item = document.createElement("button");
      const gMuted = isChatNotifyMuted(current.username, chatMeta.id);
      item.className =
        "aton-chat-item" +
        (currentChatId === chatMeta.id ? " active" : "") +
        (gMuted ? " aton-chat-item--notify-muted" : "");

      const avatar = document.createElement("div");
      avatar.className = "aton-chat-avatar";
      avatar.textContent = "☀";

      const main = document.createElement("div");
      main.className = "aton-chat-item-main";
      const titleEl = document.createElement("div");
      titleEl.className = "aton-chat-item-title";
      const titleText = document.createElement("span");
      titleText.className = "aton-chat-item-title-text";
      titleText.textContent = chatMeta.title;
      titleEl.appendChild(titleText);

      // Статус: галочка показывается всегда и не зависит от hover
      if (chatMeta.verified) {
        const verifiedBadge = document.createElement("span");
        verifiedBadge.className = "aton-chat-verified-badge";
        verifiedBadge.textContent = "✔";
        verifiedBadge.title = t("Верифицировано");
        titleEl.appendChild(verifiedBadge);
      }

      // Пин всегда остаётся рядом с названием
      if (pinned) {
        const pinEl = document.createElement("span");
        pinEl.className = "aton-chat-pin";
        pinEl.textContent = "★";
        titleEl.appendChild(pinEl);
      }
      if (gMuted) {
        const offEl = document.createElement("span");
        offEl.className = "aton-chat-notify-off";
        offEl.title = t("Уведомления отключены");
        offEl.setAttribute("aria-label", t("Уведомления отключены"));
        offEl.textContent = "🔕";
        titleEl.appendChild(offEl);
      }
      const subtitleEl = document.createElement("div");
      subtitleEl.className = "aton-chat-item-subtitle";
      const chatTypeLabel = chatMeta.type === "channel" ? t("канал") : t("группа");
      subtitleEl.textContent = `${chatTypeLabel} • ${t("создал")} ${chatMeta.owner}`;
      const previewEl = document.createElement("div");
      previewEl.className = "aton-chat-item-subtitle aton-chat-item-preview";
      previewEl.textContent = lastMsg
        ? buildLastMessagePreviewForChatList(lastMsg)
        : "Нет сообщений";
      main.appendChild(titleEl);
      main.appendChild(subtitleEl);
      main.appendChild(previewEl);

      const metaWrap = document.createElement("div");
      metaWrap.className = "aton-chat-meta";
      const timeEl = document.createElement("div");
      timeEl.className = "aton-chat-time";
      timeEl.textContent = lastMsg ? formatChatListMessageTime(lastMsg.time) : "";
      metaWrap.appendChild(timeEl);
      if (unread) {
        const badge = document.createElement("div");
        badge.className = "aton-chat-unread-badge";
        badge.textContent = Math.min(unread, 99);
        metaWrap.appendChild(badge);
      }

      // Управление чатом: меню ⋮ (статус verified отображается отдельно)
      const isOwner = chatMeta.owner === current.username;
      const isSuperAdmin = current && current.isSuperAdmin === true;
      // Verified — глобальное доверие платформы.
      // Верифицировать может только super admin, независимо от роли внутри чата.
      const canVerify = isSuperAdmin && !chatMeta.verified;
      const isMember =
        Array.isArray(chatMeta.members) && current?.id
          ? chatMeta.members.includes(current.id)
          : isOwner;

      // Примечание: сюда можно было бы логировать совпадение owner, но в релизе не нужен.

      const menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.className = "aton-chat-menu-btn";
      menuBtn.title = t("Действия");
      menuBtn.textContent = "⋮";

      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (openChatMenu) {
          closeChatMenu();
          return;
        }

        const dropdown = document.createElement("div");
        dropdown.className = "aton-chat-menu-dropdown";

        const rect = menuBtn.getBoundingClientRect();
        dropdown.style.position = "fixed";
        dropdown.style.zIndex = "120";
        dropdown.style.top = `${rect.bottom + 6}px`;
        dropdown.style.left = `${rect.left}px`;

        const createMenuItem = ({ label, disabled, onClick }) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "aton-chat-menu-item";
          btn.textContent = label;
          btn.disabled = Boolean(disabled);
          if (!btn.disabled) {
            btn.addEventListener("click", (ev) => {
              ev.stopPropagation();
              onClick && onClick();
              closeChatMenu();
            });
          }
          return btn;
        };

        // Открыть
        dropdown.appendChild(
          createMenuItem({
            label: t("Открыть"),
            onClick: () => openThisChat(),
          })
        );

        const groupNotifyMuted = isChatNotifyMuted(current.username, chatMeta.id);
        dropdown.appendChild(
          createMenuItem({
            label: groupNotifyMuted ? t("Включить уведомления") : t("Без звука и уведомлений"),
            onClick: () => {
              setChatNotifyMuted(current.username, chatMeta.id, !groupNotifyMuted);
              renderChatList();
              showToast(
                groupNotifyMuted
                  ? t("Звук и уведомления снова включены для этого чата")
                  : t("Для этого чата выключены звук и всплывающие уведомления")
              );
            },
          })
        );

        // Жалоба (для обычного пользователя)
        if (!isSuperAdmin) {
          dropdown.appendChild(
            createMenuItem({
              label: t("Пожаловаться"),
              onClick: () => {
                const overlay = document.createElement("div");
                overlay.style.position = "fixed";
                overlay.style.inset = "0";
                overlay.style.background = "rgba(15,23,42,0.8)";
                overlay.style.backdropFilter = "blur(12px)";
                overlay.style.display = "flex";
                overlay.style.alignItems = "center";
                overlay.style.justifyContent = "center";
                overlay.style.zIndex = "70";

                const modal = document.createElement("div");
                modal.style.background = "rgba(15,23,42,0.98)";
                modal.style.borderRadius = "16px";
                modal.style.border = "1px solid rgba(148,163,184,0.7)";
                modal.style.padding = "14px 16px";
                modal.style.width = "320px";
                modal.style.color = "#e5e7eb";
                modal.innerHTML = `
                  <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Пожаловаться на чат</div>
                  <label class="aton-input-label">Причина</label>
                  <select id="aton-report-reason" class="aton-input" style="margin-bottom:10px;">
                    <option value="Спам">Спам</option>
                    <option value="Оскорбления">Оскорбления</option>
                    <option value="Мошенничество">Мошенничество</option>
                    <option value="Нарушение правил">Нарушение правил</option>
                    <option value="Другое">Другое</option>
                  </select>
                  <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button type="button" id="aton-report-cancel" class="aton-new-chat-button">Отмена</button>
                    <button type="button" id="aton-report-submit" class="aton-primary-button" style="margin-top:0;padding-inline:12px;">Отправить</button>
                  </div>
                `;
                overlay.appendChild(modal);
                document.body.appendChild(overlay);

                const cancelBtn = modal.querySelector("#aton-report-cancel");
                const submitBtn = modal.querySelector("#aton-report-submit");
                const reasonSelect = modal.querySelector("#aton-report-reason");

                cancelBtn.addEventListener("click", () => overlay.remove());
                overlay.addEventListener("click", (ev) => {
                  if (ev.target === overlay) overlay.remove();
                });
                submitBtn.addEventListener("click", async () => {
                  const reason = reasonSelect.value;
                  try {
                    await api(`/api/chats/${chatMeta.id}/report`, {
                      method: "POST",
                      body: JSON.stringify({ reason }),
                    });
                    overlay.remove();
                    showToast(t("Жалоба отправлена"));
                  } catch (err) {
                    alert(err.message);
                  }
                });
              },
            })
          );
        }

        // Участники (Этап 1): только для owner
        if (isOwner) {
          const fullChat =
            allChats.find((c) => c.id === chatMeta.id) || chatMeta;
          const isPrivateChat = fullChat.visibility === "private";
          const inviteTok =
            fullChat.inviteToken &&
            typeof fullChat.inviteToken === "string"
              ? fullChat.inviteToken
              : null;
          if (isPrivateChat && inviteTok) {
            dropdown.appendChild(
              createMenuItem({
                label: t("Скопировать ссылку приглашения"),
                onClick: async () => {
                  const url = `${window.location.origin}/join/${inviteTok}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    showToast(t("Ссылка скопирована"));
                  } catch {
                    window.prompt("Скопируйте ссылку:", url);
                  }
                },
              })
            );
          }
          dropdown.appendChild(
            createMenuItem({
              label: t("Участники"),
              onClick: async () => {
                // Берём актуальный chat из allChats
                const chat = allChats.find((c) => c.id === chatMeta.id) || chatMeta;
                const chatId = chat.id;
                let ownerId = chat.ownerId;

                let selectedUserId = null;

                const overlay = document.createElement("div");
                overlay.style.position = "fixed";
                overlay.style.inset = "0";
                overlay.style.background = "rgba(15,23,42,0.8)";
                overlay.style.backdropFilter = "blur(12px)";
                overlay.style.display = "flex";
                overlay.style.alignItems = "center";
                overlay.style.justifyContent = "center";
                overlay.style.zIndex = "60";

                const modal = document.createElement("div");
                modal.style.background = "rgba(15,23,42,0.98)";
                modal.style.borderRadius = "18px";
                modal.style.border = "1px solid rgba(148,163,184,0.7)";
                modal.style.padding = "16px 18px 14px";
                modal.style.width = "420px";
                modal.style.color = "#e5e7eb";

                modal.innerHTML = `
                  <div style="font-size:14px;font-weight:600;margin-bottom:8px;">${escHtml(t("Участники"))}</div>
                  <div style="font-size:11px;color:#9ca3af;margin-bottom:12px;">
                    ${escHtml(t("Добавляйте по @username. Создателя нельзя удалить."))}
                  </div>

                  <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
                    <input id="aton-member-add-username" type="text" class="aton-input" placeholder="@username" style="flex:1;margin:0;" />
                    <button type="button" id="aton-member-add-btn" class="aton-primary-button" style="margin-top:0;padding-inline:12px;">${escHtml(t("Добавить"))}</button>
                  </div>

                  <div style="max-height:220px;overflow:auto;border:1px solid rgba(55,65,81,0.9);border-radius:12px;padding:8px;margin-bottom:12px;">
                    <div id="aton-members-list" style="display:flex;flex-direction:column;gap:6px;"></div>
                  </div>

                  <div style="display:flex;justify-content:space-between;gap:10px;">
                    <button type="button" id="aton-member-delete-btn" class="aton-new-chat-button" style="padding-inline:14px;">${escHtml(t("Удалить"))}</button>
                    <button type="button" id="aton-member-close-btn" class="aton-new-chat-button" style="padding-inline:14px;">${escHtml(t("Закрыть"))}</button>
                  </div>
                `;

                overlay.appendChild(modal);
                document.body.appendChild(overlay);

                const listEl = modal.querySelector("#aton-members-list");
                const addInput = modal.querySelector("#aton-member-add-username");
                const addBtn = modal.querySelector("#aton-member-add-btn");
                const delBtn = modal.querySelector("#aton-member-delete-btn");
                const closeBtn = modal.querySelector("#aton-member-close-btn");

                const refresh = async () => {
                  allChats = await api("/api/chats");
                  const nextChat = allChats.find((c) => c.id === chatId) || chat;
                  // На случай миграций/нормализации — обновляем ownerId из актуального чата
                  ownerId = nextChat.ownerId;
                  selectedUserId = null;
                  renderMembers(nextChat);
                };

                const renderMembers = (nextChat) => {
                  listEl.innerHTML = "";
                  const members = Array.isArray(nextChat.members) ? nextChat.members : [];
                  members.forEach((uid) => {
                    const u = allUsers.find((x) => x.id === uid);
                    const name = u?.displayName || u?.username || "unknown";
                    const subtitle = u?.publicId ? `@${u.publicId}` : "";
                    const isOwnerRow = ownerId && String(uid) === String(ownerId);
                    const row = document.createElement("button");
                    row.type = "button";
                    row.style.textAlign = "left";
                    row.style.border = "1px solid rgba(55,65,81,0.7)";
                    row.style.borderRadius = "10px";
                    row.style.padding = "8px 10px";
                    row.style.background = "rgba(15,23,42,0.35)";
                    row.style.color = "#e5e7eb";
                    row.style.cursor = "pointer";

                    if (selectedUserId && String(uid) === String(selectedUserId)) {
                      row.style.borderColor = "rgba(56,189,248,0.8)";
                      row.style.background = "rgba(56,189,248,0.12)";
                    }

                    row.innerHTML = `
                      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                        <div style="display:flex;flex-direction:column;">
                          <div style="font-size:12px;font-weight:600;line-height:1.2;">
                            ${escHtml(name)}${isOwnerRow ? ` (${escHtml(t("создатель"))})` : ""}
                          </div>
                          <div style="font-size:10px;color:#9ca3af;margin-top:2px;">
                            ${escHtml(subtitle || "")}
                          </div>
                        </div>
                        <div style="font-size:11px;color:#38bdf8;opacity:${isOwnerRow ? 0.95 : 0};">
                          ✔
                        </div>
                      </div>
                    `;

                    row.addEventListener("click", () => {
                      if (isOwnerRow) {
                        // Создателя можно выбрать, но удалить нельзя — backend всё равно защитит.
                        selectedUserId = uid;
                      } else {
                        selectedUserId = uid;
                      }
                      renderMembers(nextChat);
                    });

                    listEl.appendChild(row);
                  });
                };

                // Важно: renderMembers использует ownerId из замыкания.
                renderMembers(chat);

                addBtn.addEventListener("click", async () => {
                  const raw = (addInput.value || "").trim();
                  if (!raw) return alert(t("Введите @username"));
                  const username = raw.replace(/^@/, "");
                  try {
                    await api(`/api/chats/${chatId}/members/add`, {
                      method: "POST",
                      body: JSON.stringify({ username }),
                    });
                    addInput.value = "";
                    await refresh();
                  } catch (err) {
                    alert(err.message);
                  }
                });

                delBtn.addEventListener("click", async () => {
                  if (!selectedUserId) return alert(t("Выберите участника"));
                  if (ownerId && String(selectedUserId) === String(ownerId)) {
                    return alert(t("Нельзя удалить создателя чата"));
                  }
                  try {
                    await api(`/api/chats/${chatId}/members/remove`, {
                      method: "POST",
                      body: JSON.stringify({ userId: selectedUserId }),
                    });
                    await refresh();
                  } catch (err) {
                    alert(err.message);
                  }
                });

                closeBtn.addEventListener("click", () => overlay.remove());
                overlay.addEventListener("click", (e) => {
                  if (e.target === overlay) overlay.remove();
                });
              },
            })
          );
        }

        // Верификация (только super admin) — пункт меню
        if (canVerify) {
          dropdown.appendChild(
            createMenuItem({
              label: "Верифицировать",
              onClick: async () => {
                try {
                  await api(`/api/chats/${chatMeta.id}/verify`, { method: "POST" });
                  chatMeta.verified = true;
                  const idx = allChats.findIndex((c) => c.id === chatMeta.id);
                  if (idx !== -1) allChats[idx].verified = true;
                  renderChatList();
                  if (currentChatId === chatMeta.id) renderMessages();
                  updateTopbarTitle();
                } catch (err) {
                  alert(err.message);
                }
              },
            })
          );
        }

        const deleteChat = async ({ moderation } = { moderation: false }) => {
          if (!confirm(moderation ? "Удалить (модерация) этот чат и его сообщения?" : t("Удалить эту группу и её сообщения?"))) return;
          try {
            await api(`/api/chats/${chatMeta.id}`, { method: "DELETE" });
            allChats = allChats.filter((c) => c.id !== chatMeta.id);
            allMessages = allMessages.filter((m) => m.chatId !== chatMeta.id);
            if (currentChatId === chatMeta.id) {
              currentChatId = null;
              switchSocketChat(null);
            }
            renderChatList();
            renderMessages();
            updateTopbarTitle();
          } catch (err) {
            alert(err.message);
          }
        };

        if (isSuperAdmin) {
          dropdown.appendChild(
            createMenuItem({
              label: "Удалить (модерация)",
              onClick: () => deleteChat({ moderation: true }),
            })
          );
        } else if (isOwner) {
          dropdown.appendChild(
            createMenuItem({
              label: t("Удалить"),
              onClick: () => deleteChat({ moderation: false }),
            })
          );
        }

        document.body.appendChild(dropdown);
        openChatMenu = dropdown;
      });

      metaWrap.appendChild(menuBtn);

      item.appendChild(avatar);
      item.appendChild(main);
      item.appendChild(metaWrap);
      item.addEventListener("click", (e) => {
        openThisChat();
      });
      chatListEl.appendChild(item);
    });

    // Нет групп и нет личных диалогов с людьми (чат с «Голосом Атона» уже показан выше)
    if (sortedChats.length === 0 && privateFromMessages.size === 0) {
      const empty = document.createElement("div");
      empty.className = "aton-chat-onboarding";
      empty.innerHTML = `
        <div class="aton-chat-onboarding-card">
          <div class="aton-chat-onboarding-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="aton-chat-onboarding-title">Начните первый диалог</div>
          <div class="aton-chat-onboarding-desc">
            Найдите собеседника или создайте группу — все чаты появятся здесь.
          </div>
          <div class="aton-chat-onboarding-actions">
            <button type="button" class="aton-onboarding-cta aton-onboarding-cta-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Найти
            </button>
            <button type="button" class="aton-onboarding-cta aton-onboarding-cta-secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              Группа
            </button>
          </div>
        </div>
      `;
      chatListEl.appendChild(empty);

      // Микро-поведение: один раз при появлении onboarding подсветить/сфокусировать поиск
      if (!hasOnboardingAutoFocused) {
        hasOnboardingAutoFocused = true;
        setTimeout(() => {
          if (!searchInput) return;
          searchInput.focus();
        }, 60);
      }

      const primaryBtn = empty.querySelector(".aton-onboarding-cta-primary");
      const secondaryBtn = empty.querySelector(".aton-onboarding-cta-secondary");
      if (primaryBtn) {
        primaryBtn.addEventListener("click", () => {
          searchInput.focus();
        });
      }
      if (secondaryBtn && createGroupButton) {
        secondaryBtn.addEventListener("click", () => {
          if (!createGroupButton.disabled) createGroupButton.click();
        });
      }
    }

    const privateIdsSorted = Array.from(privateChatIds)
      .filter((id) => id !== golosDmId)
      .sort((a, b) => {
        const ta = lastActivityAtForDmChatId(a, allMessages);
        const tb = lastActivityAtForDmChatId(b, allMessages);
        if (tb !== ta) return tb - ta;
        return a.localeCompare(b);
      });
    privateIdsSorted.forEach((id) => appendPrivateListRow(id));

  }

  function renderPublicLandingState(container) {
    container.innerHTML = `
      <div class="aton-empty-state aton-empty-state--landing">
        <div class="aton-landing-sun" aria-hidden="true"></div>
        <p class="aton-empty-kicker">${escHtml(t("Под солнцем Ахетатона"))}</p>
        <h2 class="aton-empty-title">${escHtml(t("Спокойные диалоги — без лишнего шума"))}</h2>
        <p class="aton-empty-lead">
          ${escHtml(t("Личные и групповые чаты в сдержанном интерфейсе. Меньше отвлечений — больше смысла в переписке."))}
        </p>
      </div>
    `;
  }

  function renderEmptyState(container) {
    container.innerHTML = `
      <div class="aton-empty-state aton-empty-state--pick">
        <div class="aton-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <line x1="9" y1="10" x2="15" y2="10" opacity="0.5"/>
          </svg>
        </div>
        <h2 class="aton-empty-title">${escHtml(t("Выберите чат"))}</h2>
        <p class="aton-empty-lead">
          ${escHtml(t("Откройте диалог слева или найдите пользователя по @username."))}
        </p>
      </div>
    `;
  }

  function makeGolosPendingEl() {
    const wrap = document.createElement("div");
    wrap.className = "aton-golos-pending";
    const n = Math.max(1, golosPendingReplies);
    const queueBadge = n > 1 ? `<span class="aton-golos-pending-badge">${escHtml(tf("{n} в очереди", { n }))}</span>` : "";
    wrap.innerHTML = `<div class="aton-golos-pending-card" role="status" aria-live="polite" aria-atomic="true">
      <div class="aton-golos-typing-dots" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="aton-golos-pending-copy">
        <p class="aton-golos-pending-title">${escHtml(t("Голос Атона думает"))}${queueBadge}</p>
        <p class="aton-golos-pending-hint">${escHtml(t("Часто 3–15 с; с голосом дольше — распознавание, ответ и озвучка. Ниже в ленте."))}</p>
      </div>
    </div>`;
    return wrap;
  }

  function renderEmptyChatState(container) {
    if (isGolosAtonChat()) {
      container.innerHTML = `
        <div class="aton-empty-state aton-golos-empty aton-golos-empty--gpt">
          <div class="aton-golos-empty-hero">
            <div class="aton-empty-icon aton-golos-empty-icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>
          </div>
          <h2 class="aton-golos-empty-gpt-title">${escHtml(t("Голос Атона"))}</h2>
          <p class="aton-golos-empty-gpt-lead">${escHtml(t("Ниже — лента. Пиши в поле или удерживай круглую кнопку с микрофоном."))}</p>
          <p class="aton-golos-empty-tiny aton-golos-empty-tiny--gpt">${escHtml(t("Ответы приходят сообщениями в ленту, не потоком в реальном времени."))}</p>
          <div class="aton-golos-empty-actions">
            <button type="button" class="aton-golos-empty-focus-btn" id="aton-golos-empty-focus-cta">${escHtml(t("Поле ввода"))}</button>
          </div>
        </div>
      `;
      const focusCta = container.querySelector("#aton-golos-empty-focus-cta");
      if (focusCta) {
        focusCta.addEventListener("click", (e) => {
          e.preventDefault();
          try {
            inputMessage && inputMessage.removeAttribute("disabled");
            inputMessage && inputMessage.focus();
            compose && compose.scrollIntoView({ block: "end", behavior: "smooth" });
          } catch (_) {}
        });
      }
      if (golosPendingReplies > 0) {
        container.appendChild(makeGolosPendingEl());
      }
      return;
    }
    container.innerHTML = `
      <div class="aton-empty-state">
        <div class="aton-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <div class="aton-empty-title">${escHtml(t("В этом чате пока нет сообщений"))}</div>
        <div class="aton-empty-subtitle">${escHtml(t("Напишите первое сообщение, чтобы начать диалог."))}</div>
      </div>
    `;
  }

  function renderJoinChatState(container, chatPreview) {
    const title = chatPreview?.title || t("Чат");
    const isVerified = Boolean(chatPreview?.verified);
    const canSelfJoin = Boolean(chatPreview);

    const chatType =
      typeof currentChatId === "string" && currentChatId.startsWith("channel:")
        ? t("канал")
        : t("группа");

    // — приватный чат без права самостоятельного вступления —
    if (!canSelfJoin) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 24px;text-align:center;gap:14px;">
          <div style="width:60px;height:60px;border-radius:999px;background:rgba(15,23,42,0.7);border:1px solid rgba(55,65,81,0.9);display:flex;align-items:center;justify-content:center;font-size:26px;color:#64748b;">🔒</div>
          <div style="font-size:18px;font-weight:600;color:#e5e7eb;">${escHtml(title)}</div>
          <div style="font-size:11px;background:rgba(148,163,184,0.1);color:#94a3b8;padding:2px 10px;border-radius:999px;border:1px solid rgba(148,163,184,0.2);">${escHtml(tf("приватный {type}", { type: chatType }))}</div>
          <div style="font-size:12px;color:#64748b;max-width:300px;line-height:1.6;">
            ${escHtml(t("Чат закрытый. Попросите администратора выслать вам ссылку-приглашение."))}
          </div>
        </div>
      `;
      return;
    }

    // — вспомогательные данные из превью —
    const memberCount = chatPreview.memberCount ?? 0;
    const previewMembers = Array.isArray(chatPreview.previewMembers)
      ? chatPreview.previewMembers
      : [];
    const description = chatPreview.description || null;
    const lastMsg = chatPreview.lastMessagePreview || null;
    const lastMsgAt = chatPreview.lastMessageAt || null;
    const createdAt = chatPreview.createdAt || null;
    const avatarUrl = chatPreview.avatarDataUrl || null;

    // Дата создания: если сегодня — "создан сегодня", если в этом году — "MMM YYYY", иначе полная дата
    function fmtCreated(iso) {
      if (!iso) return null;
      const d = new Date(iso);
      if (isNaN(d)) return null;
      const now = new Date();
      const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
      if (sameDay) return t("создан сегодня");
      const locale = currentLang === "de" ? "de-DE" : currentLang === "en" ? "en-GB" : "ru-RU";
      return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
    }

    // Последнее сообщение: "N минут назад" / "вчера" / дата
    function fmtActivity(iso) {
      if (!iso) return null;
      const d = new Date(iso);
      if (isNaN(d)) return null;
      const diff = Date.now() - d.getTime();
      if (diff < 60_000) return t("только что");
      if (diff < 3_600_000) return tf("{n} мин. назад", { n: Math.floor(diff / 60_000) });
      if (diff < 86_400_000) return tf("{n} ч. назад", { n: Math.floor(diff / 3_600_000) });
      if (diff < 2 * 86_400_000) return t("вчера");
      const locale = currentLang === "de" ? "de-DE" : currentLang === "en" ? "en-GB" : "ru-RU";
      return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
    }

    const createdLabel = fmtCreated(createdAt);
    const activityLabel = fmtActivity(lastMsgAt);

    // Аватар: либо картинка (src безопасен — только dataURL), либо первая буква названия
    const avatarHtml = avatarUrl
      ? `<img src="${escHtml(avatarUrl)}" style="width:72px;height:72px;border-radius:999px;object-fit:cover;border:2px solid rgba(56,189,248,0.3);">`
      : `<div style="width:72px;height:72px;border-radius:999px;background:linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.95));border:2px solid rgba(56,189,248,0.22);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#94a3b8;letter-spacing:-1px;">${escHtml(title.charAt(0).toUpperCase())}</div>`;

    // Верифицирован
    const verifiedHtml = isVerified
      ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:999px;background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.5);color:#38bdf8;font-size:9px;margin-left:5px;flex-shrink:0;">✔</span>`
      : "";

    // Аватары участников (цветные кружки с инициалами)
    const memberColors = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899"];
    const membersHtml = previewMembers.length
      ? previewMembers.map((name, i) =>
          `<div title="${escHtml(name)}" style="width:26px;height:26px;border-radius:999px;background:${memberColors[i % memberColors.length]}22;border:1.5px solid ${memberColors[i % memberColors.length]}66;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:${memberColors[i % memberColors.length]};margin-left:${i ? "-6px" : "0"};z-index:${10 - i};">${escHtml(name.charAt(0).toUpperCase())}</div>`
        ).join("")
      : "";

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 20px;text-align:center;gap:0;overflow-y:auto;">

        <!-- Аватар -->
        <div style="margin-bottom:14px;">${avatarHtml}</div>

        <!-- Название + верификация -->
        <div style="display:flex;align-items:center;gap:4px;font-size:20px;font-weight:700;color:#f1f5f9;letter-spacing:-0.3px;margin-bottom:6px;">
          ${escHtml(title)}${verifiedHtml}
        </div>

        <!-- Тип-бейдж -->
        <div style="font-size:10px;background:rgba(56,189,248,0.08);color:#38bdf8;padding:2px 10px;border-radius:999px;border:1px solid rgba(56,189,248,0.2);margin-bottom:18px;">${escHtml(tf("публичный {type}", { type: chatType }))}</div>

        <!-- Описание -->
        ${description ? `
        <div style="font-size:13px;color:#94a3b8;max-width:360px;line-height:1.6;margin-bottom:18px;padding:10px 14px;background:rgba(15,23,42,0.5);border:1px solid rgba(55,65,81,0.6);border-radius:10px;">
          ${escHtml(description)}
        </div>` : ""}

        <!-- Статистика участников -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:20px;">
          ${membersHtml ? `
          <div style="display:flex;align-items:center;">${membersHtml}</div>` : ""}
          <div style="font-size:12px;color:#64748b;">
            <span style="font-weight:600;color:#94a3b8;">${escHtml(String(memberCount))}</span>
            ${escHtml(t(memberCount === 1 ? "участник" : memberCount >= 2 && memberCount <= 4 ? "участника" : "участников"))}
            ${createdLabel ? `· <span style="color:#475569;">${escHtml(createdLabel)}</span>` : ""}
          </div>
        </div>

        <!-- Последнее сообщение -->
        ${lastMsg ? `
        <div style="max-width:360px;width:100%;padding:8px 12px;background:rgba(15,23,42,0.45);border:1px solid rgba(55,65,81,0.5);border-radius:10px;margin-bottom:20px;text-align:left;">
          <div style="font-size:10px;color:#475569;margin-bottom:3px;">${escHtml(t("Последнее сообщение"))} ${activityLabel ? `· ${escHtml(activityLabel)}` : ""}</div>
          <div style="font-size:12px;color:#94a3b8;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(lastMsg)}</div>
        </div>` : `
        <div style="font-size:12px;color:#475569;margin-bottom:20px;">${escHtml(t("Сообщений пока нет"))}</div>`}

        <!-- Кнопка вступить -->
        <button type="button" id="aton-join-chat-btn" style="
          padding: 11px 40px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #fff;
          box-shadow: 0 4px 18px rgba(37,99,235,0.45);
          transition: box-shadow 0.2s, transform 0.15s;
          letter-spacing: 0.2px;
        ">${escHtml(tf("Вступить в {type}", { type: chatType }))}</button>
        <div style="font-size:11px;color:#475569;margin-top:8px;">${escHtml(t("Вы сможете читать и отправлять сообщения"))}</div>

      </div>
    `;

    const joinBtn = container.querySelector("#aton-join-chat-btn");
    if (!joinBtn) return;

    joinBtn.addEventListener("mouseenter", () => {
      joinBtn.style.boxShadow = "0 6px 24px rgba(37,99,235,0.65)";
      joinBtn.style.transform = "translateY(-1px)";
    });
    joinBtn.addEventListener("mouseleave", () => {
      joinBtn.style.boxShadow = "0 4px 18px rgba(37,99,235,0.45)";
      joinBtn.style.transform = "";
    });

    joinBtn.addEventListener("click", async () => {
      joinBtn.disabled = true;
      joinBtn.textContent = t("Вступаем…");
      joinBtn.style.opacity = "0.7";
      try {
        await api(`/api/chats/${currentChatId}/join`, { method: "POST" });
        await bootstrapData();
        const cid = currentChatId;
        if (currentUser && currentUser.username) setLastChatId(currentUser.username, cid);
        switchSocketChat(cid);
        renderChatList();
        renderMessages();
        updateTopbarTitle();
        showToast(t("Вы вступили в чат"));
        void pullChatReceipts(cid);
      } catch (err) {
        joinBtn.disabled = false;
        joinBtn.textContent = tf("Вступить в {type}", { type: chatType });
        joinBtn.style.opacity = "";
        alert(err.message);
      }
    });
  }

  /** Пока играет ГС, полный renderMessages() сносит DOM и рвёт воспроизведение — откладываем. */
  let renderMessagesDeferredPending = false;
  let renderMessagesVoiceStopListener = null;

  function isAnyVoiceNotePlaying() {
    try {
      for (const a of document.querySelectorAll("audio.aton-voice-audio")) {
        if (a && !a.paused && !a.ended) return true;
      }
    } catch (_) {}
    return false;
  }

  function clearRenderMessagesVoiceListener() {
    if (!renderMessagesVoiceStopListener) return;
    try {
      const { audio, fn } = renderMessagesVoiceStopListener;
      audio.removeEventListener("pause", fn);
      audio.removeEventListener("ended", fn);
    } catch (_) {}
    renderMessagesVoiceStopListener = null;
  }

  function flushDeferredRenderMessages() {
    if (!renderMessagesDeferredPending) return;
    if (isAnyVoiceNotePlaying()) {
      armRenderMessagesWhenVoiceStops();
      return;
    }
    renderMessagesDeferredPending = false;
    clearRenderMessagesVoiceListener();
    renderMessages();
  }

  function armRenderMessagesWhenVoiceStops() {
    if (renderMessagesVoiceStopListener) return;
    const playing = Array.from(document.querySelectorAll("audio.aton-voice-audio")).find(
      (a) => a && !a.paused && !a.ended
    );
    if (!playing) {
      flushDeferredRenderMessages();
      return;
    }
    const onStop = () => {
      clearRenderMessagesVoiceListener();
      requestAnimationFrame(() => flushDeferredRenderMessages());
    };
    renderMessagesVoiceStopListener = { audio: playing, fn: onStop };
    playing.addEventListener("pause", onStop);
    playing.addEventListener("ended", onStop);
  }

  function renderMessages(opts = {}) {
    if (!messagesEl || !compose) return;
    if (opts.deferIfVoice && isAnyVoiceNotePlaying()) {
      renderMessagesDeferredPending = true;
      armRenderMessagesWhenVoiceStops();
      return;
    }
    clearRenderMessagesVoiceListener();
    renderMessagesDeferredPending = false;
    closeReactionPicker();
    const privateDmUi = Boolean(
      currentUser && currentChatId && isPrivateDirectChat(currentChatId)
    );
    if (chat) chat.classList.toggle("aton-chat--private-dm", privateDmUi);
    const chatChangedForScroll = currentChatId !== lastMessagesRenderChatId;
    // До innerHTML: «приклеены к низу» только если низ ленты реально в кадре (sentinel + IO) и мало отступа до низа.
    // Один лишь порог 50px по scrollTop давал ложное «у низа» и автопрокрутку при чтении середины истории.
    const hadMessageRows = Boolean(
      currentUser && currentChatId && messagesEl.querySelector(".aton-message-row")
    );
    const wasAtBottom =
      !chatChangedForScroll &&
      hadMessageRows &&
      messagesBottomInView &&
      isMessagesListAtBottom(messagesEl);
    const useScrollAnchor = !chatChangedForScroll && hadMessageRows && !wasAtBottom;
    const scrollSnapshot = useScrollAnchor ? captureMessagesScrollSnapshot(messagesEl) : null;
    const scrollRatioSnap = useScrollAnchor ? captureMessagesScrollRatio(messagesEl) : null;

    try {
    messagesEl.innerHTML = "";
    /* Sentinel вылетел из DOM — до IntersectionObserver сбрасываем, иначе RO с «устаревшим» true крутит вниз. */
    messagesBottomInView = false;
    const current = currentUser;
    shell.classList.toggle("aton-shell--guest-landing", !current);
    shell.classList.toggle("aton-shell--no-chat", !currentChatId);
    shell.classList.toggle("aton-shell--has-chat", Boolean(currentChatId));
    shell.classList.toggle("aton-shell--profile", mainView === "profile");

    if (!current) {
      renderPublicLandingState(messagesEl);
      setComposeEnabled(false);
      compose.style.display = "none";
      clearReplyToMessage();
      return;
    }
    if (!currentChatId) {
      renderEmptyState(messagesEl);
      setComposeEnabled(false);
      compose.style.display = "none";
      clearReplyToMessage();
      return;
    }
    if (replyToMessage && !messageBelongsToOpenChat(replyToMessage, currentChatId)) {
      clearReplyToMessage();
    }

    // Для групп/каналов: если чата нет в allChats, пользователь не участник.
    if (currentChatId.startsWith("group:") || currentChatId.startsWith("channel:")) {
      const joinedChat = allChats.find((c) => c.id === currentChatId);
      if (!joinedChat) {
        const preview = discoverChats.find((c) => c.id === currentChatId) || null;
        renderJoinChatState(messagesEl, preview);
        setComposeEnabled(false);
        compose.style.display = "none";
        clearReplyToMessage();
        return;
      }
    }

    if (voiceSessionChatId != null && voiceSessionChatId !== currentChatId) {
      abortVoiceUi();
    }

    const user = currentUser;
    const filtered = allMessages.filter((msg) => {
      if (!user) return false;
      if (currentChatId.startsWith("group:")) return msg.chatId === currentChatId;
      if (isPrivateDirectChat(currentChatId)) {
        return messageBelongsToDmId(msg, currentChatId);
      }
      return msg.chatId === currentChatId;
    });

    if (!filtered.length) {
      renderEmptyChatState(messagesEl);
      setComposeEnabled(true);
      compose.style.display = "flex";
      return;
    }

    const pagingState = chatPagingState(currentChatId);
    if (pagingState.hasMore !== false) {
      const olderButton = document.createElement("button");
      olderButton.type = "button";
      olderButton.className = "aton-load-older";
      olderButton.textContent = pagingState.loading ? t("Загрузка…") : t("Загрузить старые сообщения");
      olderButton.disabled = Boolean(pagingState.loading);
      olderButton.addEventListener("click", () => {
        void loadOlderMessages(currentChatId);
      });
      messagesEl.appendChild(olderButton);
    }

    // Обновляем признак «прочитано до» для активного чата
    const reads = getChatReads(current.username);
    if (currentChatId) {
      const updatedReads = { ...reads, [currentChatId]: new Date().toISOString() };
      setChatReads(current.username, updatedReads);
    }

    filtered.forEach((msg) => {
      const isSelf = isMessageFromSelf(msg, current, currentChatId);

      const row = document.createElement("div");
      row.className =
        "aton-message-row" +
        (isSelf ? " self" : "") +
        (privateDmUi ? " aton-message-row--private-dm" : "");
      if (msg.id) row.setAttribute("data-message-id", String(msg.id));

      const inner = document.createElement("div");
      inner.className = "aton-message-inner";

      const author = userByUsername(msg.from);
      let avatarWrap = null;
      if (!privateDmUi) {
        avatarWrap = document.createElement("div");
        avatarWrap.className = "aton-message-avatar";
        if (author?.avatarDataUrl) {
          const img = document.createElement("img");
          img.src = author.avatarDataUrl;
          avatarWrap.appendChild(img);
        } else {
          avatarWrap.textContent = (msg.from || "?").slice(0, 1).toUpperCase();
        }
      }

      const bubble = document.createElement("div");
      bubble.className = "aton-message-bubble" + (isSelf ? " self" : "");
      const text = document.createElement("div");
      text.className = "aton-message-text";
      if (msg.type === "audio" && msg.audioDataUrl) {
        text.classList.add("aton-message-text--media", "aton-message-text--voice");
        bubble.classList.add("aton-message-bubble--voice");
        text.appendChild(createVoicePlayer(msg.audioDataUrl, isSelf));
      } else if (msg.type === "audio") {
        text.classList.add("aton-message-text--media-pending");
        text.textContent = t("Загрузка голосового…");
      } else if (msg.type === "image" && msg.imageDataUrl) {
        text.classList.add("aton-message-text--media");
        const img = document.createElement("img");
        img.src = msg.imageDataUrl;
        img.className = "aton-message-image";
        img.addEventListener("click", () => {
          const imageMessages = messagesForChatId(currentChatId).filter(
            (item) => item && item.type === "image" && item.imageDataUrl
          );
          const gallery = imageMessages.map((item) => String(item.imageDataUrl));
          const clickedIndex = imageMessages.findIndex((item) => String(item.id || "") === String(msg.id || ""));
          openImageLightbox(msg.imageDataUrl, gallery, clickedIndex);
        });
        text.appendChild(img);
      } else if (msg.type === "image") {
        text.classList.add("aton-message-text--media-pending");
        text.textContent = t("Загрузка фото…");
      }
      if (msg.text) {
        const textNode = document.createElement("div");
        textNode.className = "aton-message-text-body";
        textNode.textContent = msg.text;
        text.appendChild(textNode);
      }
      if (msg.replyTo) {
        const replied =
          filtered.find((m) => m.id === msg.replyTo) ||
          allMessages.find((m) => m && m.id === msg.replyTo);
        if (replied) {
          const replyPreview = document.createElement("div");
          replyPreview.className = "aton-message-reply-preview";
          const replyWho = messageReplyAuthorLabel(replied);
          const replyAuthor = document.createElement("div");
          replyAuthor.className = "aton-message-reply-author";
          replyAuthor.textContent = replyWho;
          const replyText = document.createElement("div");
          replyText.className = "aton-message-reply-text";
          replyText.textContent = messageReplyExcerpt(replied);
          replyPreview.appendChild(replyAuthor);
          replyPreview.appendChild(replyText);
          bubble.appendChild(replyPreview);
        }
      }
      const canAdmin = current && current.isSuperAdmin === true;
      const authorIsVerified = Boolean(author && author.isVerified);
      const timeLabel = formatTimeLabel(msg.time);
      const editedLabel = msg.editedAt ? ` · ${t("изм.")}` : "";
      const pinnedLabel = msg.pinned ? " 📌" : "";

      if (!privateDmUi) {
        if (!isSelf) {
          const senderEl = document.createElement("div");
          senderEl.className = "aton-message-sender";
          const nameText = displayNameForPeer(current.username, msg.from, author);
          senderEl.textContent = nameText;
          if (authorIsVerified) {
            const badge = document.createElement("span");
            badge.className = "aton-message-sender-badge";
            badge.textContent = " ✔";
            senderEl.appendChild(badge);
          }
          if (canAdmin && author && author.id && !authorIsVerified) {
            const verifyUserBtn = document.createElement("button");
            verifyUserBtn.type = "button";
            verifyUserBtn.className = "aton-user-verify-button";
            verifyUserBtn.textContent = "⋮";
            verifyUserBtn.title = "Верифицировать пользователя";
            verifyUserBtn.addEventListener("click", async (event) => {
              event.stopPropagation();
              try {
                await api(`/api/users/${author.id}/verify`, { method: "POST" });
                author.isVerified = true;
                if (currentUser && currentUser.id === author.id) {
                  currentUser.isVerified = true;
                }
                renderMessages();
                updateTopbarTitle();
              } catch (err) {
                alert(err.message);
              }
            });
            senderEl.appendChild(verifyUserBtn);
          }
          bubble.appendChild(senderEl);
        } else if (current) {
          const senderEl = document.createElement("div");
          senderEl.className = "aton-message-sender aton-message-sender--self";
          const selfName =
            getLocalSelfDisplayName(current.username) || current.displayName || current.username || "";
          senderEl.textContent = selfName;
          if (current.isVerified) {
            const badge = document.createElement("span");
            badge.className = "aton-message-sender-badge";
            badge.textContent = " ✔";
            senderEl.appendChild(badge);
          }
          bubble.appendChild(senderEl);
        }
      }

      bubble.appendChild(text);

      const meta = document.createElement("div");
      meta.className = "aton-message-meta" + (isSelf ? " aton-message-meta--self" : "");
      {
        const st =
          msg.status && ["sent", "delivered", "read"].includes(msg.status) ? msg.status : "sent";
        const showAck = isSelf && privateDmUi;
        const ack = showAck ? messageAckHtml(st) : "";
        meta.innerHTML = `<span class="aton-message-time">${escHtml(timeLabel)}${escHtml(editedLabel)}${escHtml(pinnedLabel)}</span>${ack}`;
      }
      bubble.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "aton-message-actions";

      const reactBtn = document.createElement("button");
      reactBtn.className = "aton-message-action-button aton-message-react-trigger";
      const ownReaction = getOwnReaction(msg);
      reactBtn.textContent = ownReaction ? ownReaction.emoji : "♡";
      reactBtn.title = ownReaction ? t("Изменить реакцию") : t("Оставить реакцию");
      reactBtn.setAttribute("aria-label", reactBtn.title);
      if (ownReaction) reactBtn.classList.add("is-active");
      reactBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        closeReactionPicker();
        const picker = document.createElement("div");
        picker.className = "aton-reaction-picker";
        picker.setAttribute("role", "menu");
        picker.setAttribute("aria-label", t("Оставить реакцию"));
        MESSAGE_REACTION_EMOJIS.forEach((emoji) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "aton-reaction-picker-item";
          if (ownReaction && ownReaction.emoji === emoji) btn.classList.add("is-active");
          btn.textContent = emoji;
          btn.title = emoji;
          btn.setAttribute("aria-label", emoji);
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            try {
              await toggleMessageReaction(msg, emoji);
            } catch (err) {
              alert(err.message);
            }
          });
          picker.appendChild(btn);
        });
        positionReactionPicker(picker, bubble.getBoundingClientRect());
        openReactionPicker = picker;
      });
      actions.appendChild(reactBtn);

      const replyBtn = document.createElement("button");
      replyBtn.className = "aton-message-action-button";
      replyBtn.textContent = "↩";
      replyBtn.title = t("Ответить");
      replyBtn.addEventListener("click", () => {
        setReplyToMessage(msg);
      });
      actions.appendChild(replyBtn);

      if (current && msg.from === current.username) {
        const editBtn = document.createElement("button");
        editBtn.className = "aton-message-action-button";
        editBtn.textContent = "✎";
        editBtn.title = t("Редактировать");
        editBtn.addEventListener("click", async () => {
          const nextText = prompt(t("Измените текст сообщения:"), msg.text || "");
          if (!nextText || nextText === msg.text) return;
          try {
            const updated = await api(`/api/messages/${msg.id}`, {
              method: "PATCH",
              body: JSON.stringify({ text: nextText }),
            });
            allMessages = allMessages.map((m) => (m.id === updated.id ? updated : m));
            renderMessages();
          } catch (err) {
            alert(err.message);
          }
        });
        actions.appendChild(editBtn);

        const pinBtn = document.createElement("button");
        pinBtn.className = "aton-message-action-button";
        pinBtn.textContent = "★";
        pinBtn.title = msg.pinned ? t("Снять закрепление") : t("Закрепить сообщение");
        pinBtn.addEventListener("click", async () => {
          try {
            const updated = await api(`/api/messages/${msg.id}/pin`, {
              method: "POST",
            });
            allMessages = allMessages.map((m) => (m.id === updated.id ? updated : m));
            renderMessages();
            renderChatList();
          } catch (err) {
            alert(err.message);
          }
        });
        actions.appendChild(pinBtn);

        const delBtn = document.createElement("button");
        delBtn.className = "aton-message-action-button aton-message-delete";
        delBtn.textContent = "×";
        delBtn.title = t("Удалить сообщение");
        delBtn.addEventListener("click", async () => {
          try {
            await api(`/api/messages/${msg.id}`, { method: "DELETE" });
            allMessages = allMessages.filter((m) => m.id !== msg.id);
            renderMessages();
            renderChatList();
          } catch (err) {
            alert(err.message);
          }
        });
        actions.appendChild(delBtn);
      }

      bubble.addEventListener("dblclick", async (event) => {
        const interactive = event.target && event.target.closest && event.target.closest("button,a,input,textarea,.aton-audio-player");
        if (interactive) return;
        event.preventDefault();
        event.stopPropagation();
        try {
          await toggleMessageReaction(msg, QUICK_REACTION_EMOJI);
        } catch (err) {
          alert(err.message);
        }
      });

      const reactionSummary = getReactionSummary(msg);
      if (reactionSummary.length > 0) {
        const reactionsBar = document.createElement("div");
        reactionsBar.className = "aton-message-reactions";
        reactionSummary.forEach((reaction) => {
          const pill = document.createElement("button");
          pill.type = "button";
          pill.className = "aton-reaction-pill";
          if (reaction.reactedByMe) pill.classList.add("is-active");
          pill.textContent = reaction.count > 1 ? `${reaction.emoji} ${reaction.count}` : reaction.emoji;
          pill.title = reaction.users.join(", ");
          pill.setAttribute("aria-label", `${reaction.emoji} ${reaction.count}`);
          pill.addEventListener("click", async (event) => {
            event.stopPropagation();
            try {
              await toggleMessageReaction(msg, reaction.emoji);
            } catch (err) {
              alert(err.message);
            }
          });
          reactionsBar.appendChild(pill);
        });
        bubble.appendChild(reactionsBar);
      }

      bubble.appendChild(actions);

      if (avatarWrap) inner.appendChild(avatarWrap);
      inner.appendChild(bubble);
      row.appendChild(inner);
      messagesEl.appendChild(row);
    });

    if (golosPendingReplies > 0 && isGolosAtonChat()) {
      messagesEl.appendChild(makeGolosPendingEl());
    }
    messagesEl.appendChild(messagesBottomSentinel);

    {
      // Смена чата / первый показ / были у низа → автоприлипание вниз. Читали старые → только якорь, без autoscroll
      const pinToBottom = chatChangedForScroll || wasAtBottom || !hadMessageRows;
      if (pinToBottom) {
        scrollMessagesListToBottomRaf(false);
      } else {
        restoreMessagesScrollAfterRerender(messagesEl, scrollSnapshot, scrollRatioSnap);
      }
    }
    // Для выбранного чата показываем поле ввода
    setComposeEnabled(true);
    compose.style.display = "flex";
    } finally {
      lastMessagesRenderChatId = currentUser && currentChatId ? currentChatId : null;
    }
  }

  sendButton.addEventListener("click", () => {
    unlockNotificationAudio();
    const user = currentUser;
    if (!user || !currentChatId) return;
    const text = inputMessage.value.trim();
    if (!text) return;
    // Защита от двойного клика
    if (sendButton.dataset.sending === "1") return;

    const peer = currentChatPeer();
    if (peer && contacts.blocked.some((u) => u.username === peer)) {
      alert(t("Вы заблокировали этого пользователя. Разблокируйте его в контактах, чтобы писать."));
      return;
    }

    const to = dmToForApi();
    const toGolos = to === GOLOS_ATON_USERNAME;
    if (toGolos) golosPendingReplies += 1;
    const chatId = currentChatId;
    const replyToId = replyToMessage ? replyToMessage.id : null;

    // Оптимистичная вставка: показываем сообщение сразу
    const tempId = `_temp_${Date.now()}`;
    const tempMsg = {
      id: tempId,
      from: user.username,
      chatId,
      to,
      type: "text",
      text,
      time: new Date().toISOString(),
      replyTo: replyToId,
      status: "sent",
    };
    allMessages.push(tempMsg);
    inputMessage.value = "";
    adjustComposeInputHeight();
    clearReplyToMessage();
    renderMessages();

    sendButton.dataset.sending = "1";

    (async () => {
      try {
        const msg = await api("/api/messages", {
          method: "POST",
          body: JSON.stringify({ chatId, type: "text", text, to, replyTo: replyToId }),
        });
        // Заменяем временное сообщение настоящим
        const idx = allMessages.findIndex((m) => m.id === tempId);
        if (!allMessages.some((m) => m.id === msg.id)) {
          if (idx !== -1) allMessages.splice(idx, 1, msg);
          else allMessages.push(msg);
        } else if (idx !== -1) {
          allMessages.splice(idx, 1); // сокет уже добавил настоящее
        }
        renderMessages();
        renderChatList();
      } catch (err) {
        if (toGolos) golosPendingReplies = Math.max(0, golosPendingReplies - 1);
        // Откат оптимистичной вставки
        allMessages = allMessages.filter((m) => m.id !== tempId);
        renderMessages();
        alert(err.message);
      } finally {
        delete sendButton.dataset.sending;
      }
    })();
  });

  inputMessage.addEventListener("input", () => {
    adjustComposeInputHeight();
  });

  inputMessage.addEventListener("keydown", (event) => {
    if (!currentChatId) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendButton.click();
    }

    // Локальный индикатор «печатает…»
    if (typingTimeoutId) clearTimeout(typingTimeoutId);
    typingIndicator.textContent = t("Печатаете сообщение…");
    typingIndicator.style.display =
      !replyToMessage && (inputMessage.value.trim() || event.key !== "Enter") ? "block" : "none";
    typingTimeoutId = setTimeout(() => {
      if (!replyToMessage) typingIndicator.style.display = "none";
    }, 1200);
  });

  // Отправка фотографий
  attachButton.addEventListener("click", () => {
    const user = currentUser;
    if (!user || !currentChatId) return;
    attachInput.click();
  });

  attachInput.addEventListener("change", () => {
    const user = currentUser;
    if (!user || !currentChatId) {
      attachInput.value = "";
      return;
    }
    const file = attachInput.files?.[0];
    attachInput.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const imageDataUrl = reader.result;
      if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:")) {
        alert(t("Не удалось прочитать изображение."));
        return;
      }
      const to = dmToForApi();
      const chatId = currentChatId;
      const peer = currentChatPeer();
      if (peer && contacts.blocked.some((u) => u.username === peer)) {
        alert(t("Вы заблокировали этого пользователя. Разблокируйте его в контактах, чтобы писать."));
        return;
      }
      const tempId = `_temp_${Date.now()}`;
      const tempMsg = {
        id: tempId,
        from: user.username,
        chatId,
        to,
        type: "image",
        imageDataUrl,
        text: "",
        time: new Date().toISOString(),
        status: "sent",
      };
      allMessages.push(tempMsg);
      renderMessages();
      renderChatList();
      try {
        const msg = await api("/api/messages", {
          method: "POST",
          body: JSON.stringify({ chatId, type: "image", imageDataUrl, to }),
        });
        const idx = allMessages.findIndex((m) => m.id === tempId);
        if (!allMessages.some((m) => m.id === msg.id)) {
          if (idx !== -1) allMessages.splice(idx, 1, mergeMessagePreserveMedia(msg, tempMsg));
          else allMessages.push(mergeMessagePreserveMedia(msg, tempMsg));
        } else if (idx !== -1) {
          allMessages.splice(idx, 1);
        }
        renderMessages();
        renderChatList();
      } catch (err) {
        allMessages = allMessages.filter((m) => m.id !== tempId);
        renderMessages();
        renderChatList();
        alert(err.message);
      }
    };
    reader.onerror = () => alert(t("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });

  // Поиск пользователя
  let searchDebounceTimer = null;
  async function handleUserSearch() {
    const current = currentUser;
    const q = searchInput.value.trim().toLowerCase();
    searchResultsEl.innerHTML = "";
    if (!current || !q) return;

    const matchUser = (u) => {
      if (u.username === current.username) return false;
      const name = (u.displayName || "").toLowerCase();
      const uname = u.username.toLowerCase();
      const pid = (u.publicId || "").toLowerCase();
      const query = q.startsWith("@") ? q.slice(1) : q;
      return uname.includes(query) || name.includes(query) || pid.includes(query);
    };

    const users = allUsers.filter(matchUser);

    if (users.length) {
      const usersTitle = document.createElement("div");
      usersTitle.className = "aton-search-section-title";
      usersTitle.textContent = t("Пользователи");
      searchResultsEl.appendChild(usersTitle);
    }

    function openDmWithUserFromSearch(u) {
      if (!current) return;
      leaveProfileForChatSelection();
      currentChatId = chatIdForUsers(current.username, u.username);
      switchSocketChat(currentChatId);
      if (current.username) setLastChatId(current.username, currentChatId);
      searchInput.value = "";
      searchResultsEl.innerHTML = "";
      renderChatList();
      renderMessages();
      updateTopbarTitle();
      void pullChatReceipts(currentChatId);
    }

    let fsList = [];
    try {
      fsList = await Promise.all(
        users.map((u) =>
          api(`/api/friendship-status?userId=${encodeURIComponent(u.id)}`).catch(() => ({
            status: "none",
          }))
        )
      );
    } catch {
      fsList = users.map(() => ({ status: "none" }));
    }

    users.forEach((u, idx) => {
      const item = document.createElement("div");
      item.className = "aton-search-item aton-search-item--user";
      const isFriend = contacts.friends.some((f) => f.username === u.username);
      const isBlocked = contacts.blocked.some((b) => b.username === u.username);
      const hasIn = (contacts.requestsIn || []).some((r) => r.username === u.username);
      const hasOut = (contacts.requestsOut || []).some((r) => r.username === u.username);
      const fs = fsList[idx] || { status: "none" };
      const eff =
        !isBlocked && (fs.status === "accepted" || (fs.status === "none" && isFriend))
          ? { status: "accepted" }
          : !isBlocked && fs.status === "pending" && fs.direction
            ? { status: "pending", direction: fs.direction }
            : !isBlocked && hasIn
              ? { status: "pending", direction: "in" }
              : !isBlocked && hasOut
                ? { status: "pending", direction: "out" }
                : { status: isFriend ? "accepted" : "none" };
      let friendButtonsHtml = "";
      if (isBlocked) {
        friendButtonsHtml = `<button type="button" class="aton-search-action aton-search-add" disabled>${escHtml(t("В друзьях"))}</button>`;
      } else if (eff.status === "accepted") {
        friendButtonsHtml = `<span class="aton-search-friend-ok" aria-hidden="true">${escHtml(t("Вы друзья"))}</span>`;
      } else if (eff.status === "pending" && eff.direction === "in") {
        friendButtonsHtml = `<button type="button" class="aton-search-action aton-search-accept">${escHtml(t("Принять"))}</button>
            <button type="button" class="aton-search-action aton-search-decline">${escHtml(t("Отклонить"))}</button>`;
      } else if (eff.status === "pending" && eff.direction === "out") {
        friendButtonsHtml = `<button type="button" class="aton-search-action" disabled>${escHtml(t("Заявка отправлена"))}</button>
            <button type="button" class="aton-search-action aton-search-cancel-req">${escHtml(t("Отменить заявку"))}</button>`;
      } else {
        friendButtonsHtml = `<button type="button" class="aton-search-action aton-search-add">${escHtml(t("Добавить в друзья"))}</button>`;
      }
      const nameStr = u.displayName || u.username;
      const verifiedBadge = u.isVerified
        ? ` <span class="aton-search-verified" title="${escHtml(t("Верифицировано"))}">✔</span>`
        : "";
      item.innerHTML = `
        <div class="aton-search-user-card">
          <div class="aton-search-user-main">
            <div class="aton-search-avatar"></div>
            <div class="aton-search-user-info">
              <span class="aton-search-name">${escHtml(nameStr)}${verifiedBadge}</span>
              <span class="aton-search-handle">@${escHtml(u.publicId || u.username)}</span>
            </div>
          </div>
          <div class="aton-search-actions">
            <button type="button" class="aton-search-action aton-search-write" ${isBlocked ? "disabled" : ""}>${escHtml(t("Написать"))}</button>
            ${friendButtonsHtml}
            <button type="button" class="aton-search-action aton-search-block">${
              escHtml(t(isBlocked ? "Разблокировать" : "Заблокировать"))
            }</button>
          </div>
        </div>
      `;
      const avEl = item.querySelector(".aton-search-avatar");
      if (avEl) {
        if (u.avatarDataUrl) {
          const im = document.createElement("img");
          im.src = u.avatarDataUrl;
          im.alt = "";
          avEl.appendChild(im);
        } else {
          avEl.classList.add("aton-search-avatar--letter");
          avEl.textContent = (nameStr[0] || "?").toUpperCase();
        }
      }
      const writeBtn = item.querySelector(".aton-search-write");
      const addBtn = item.querySelector(".aton-search-add:not([disabled])");
      const acceptBtn = item.querySelector(".aton-search-accept");
      const declineBtn = item.querySelector(".aton-search-decline");
      const cancelReqBtn = item.querySelector(".aton-search-cancel-req");
      const blockBtn = item.querySelector(".aton-search-block");

      const userMain = item.querySelector(".aton-search-user-main");
      if (userMain) {
        userMain.addEventListener("click", (e) => {
          if (isBlocked) return;
          e.stopPropagation();
          openDmWithUserFromSearch(u);
        });
      }

      if (writeBtn) {
        writeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (isBlocked) return;
          openDmWithUserFromSearch(u);
        });
      }

      async function syncContactsAfterAction() {
        contacts = await api("/api/contacts");
        if (!contacts.requestsIn) contacts.requestsIn = [];
        if (!contacts.requestsOut) contacts.requestsOut = [];
        renderContacts();
        renderChatList();
        if (searchInput.value.trim()) handleUserSearch();
        updateTopbarTitle();
      }

      if (addBtn) {
        addBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (contacts.friends.some((f) => f.username === u.username)) return;
          try {
            const r = await api("/api/contacts/add", {
              method: "POST",
              body: JSON.stringify({ username: u.username }),
            });
            if (r.status === "requested") showToast(t("Заявка отправлена"));
            if (r.status === "accepted") showToast(t("Вы в друзьях"));
            await syncContactsAfterAction();
          } catch (err) {
            alert(err.message);
          }
        });
      }
      if (acceptBtn) {
        acceptBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await api("/api/contacts/accept", {
              method: "POST",
              body: JSON.stringify({ username: u.username }),
            });
            showToast(t("Заявка принята"));
            await syncContactsAfterAction();
          } catch (err) {
            alert(err.message);
          }
        });
      }
      if (declineBtn) {
        declineBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await api("/api/contacts/decline", {
              method: "POST",
              body: JSON.stringify({ username: u.username }),
            });
            await syncContactsAfterAction();
          } catch (err) {
            alert(err.message);
          }
        });
      }
      if (cancelReqBtn) {
        cancelReqBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await api("/api/contacts/cancel", {
              method: "POST",
              body: JSON.stringify({ username: u.username }),
            });
            await syncContactsAfterAction();
          } catch (err) {
            alert(err.message);
          }
        });
      }

      blockBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const blocked = contacts.blocked.some((b) => b.username === u.username);
        const url = blocked ? "/api/contacts/unblock" : "/api/contacts/block";
        try {
          await api(url, {
            method: "POST",
            body: JSON.stringify({ username: u.username }),
          });
          await syncContactsAfterAction();
        } catch (err) {
          alert(err.message);
        }
      });

      searchResultsEl.appendChild(item);
    });

    // Поиск по своим чатам (из allChats)
    const myChatsFound = allChats.filter(
      (c) =>
        (c.type === "group" || c.type === "channel" || !c.type) &&
        (c.title || "").toLowerCase().includes(q)
    );

    if (myChatsFound.length) {
      const myChatsTitle = document.createElement("div");
      myChatsTitle.className = "aton-search-section-title";
      myChatsTitle.style.marginTop = users.length ? "6px" : "0";
      myChatsTitle.textContent = t("Мои чаты");
      searchResultsEl.appendChild(myChatsTitle);
    }

    myChatsFound.forEach((chat) => {
      const item = document.createElement("div");
      item.className = "aton-search-item";
      const typeLabel = chat.type === "channel" ? t("канал") : t("группа");
      item.innerHTML = `
        <div class="aton-search-main" style="cursor:pointer;">
          ${escHtml(chat.title)}${chat.verified ? ' <span style="color:#38bdf8;">✔</span>' : ""}
          <span style="font-size:9px;background:rgba(56,189,248,0.15);color:#38bdf8;padding:1px 5px;border-radius:6px;margin-left:4px;">${escHtml(typeLabel)}</span>
        </div>
      `;
      const main = item.querySelector(".aton-search-main");
      main.addEventListener("click", () => {
        leaveProfileForChatSelection();
        currentChatId = chat.id;
        switchSocketChat(currentChatId);
        if (current.username) setLastChatId(current.username, currentChatId);
        searchInput.value = "";
        searchResultsEl.innerHTML = "";
        renderChatList();
        renderMessages();
        updateTopbarTitle();
      });
      searchResultsEl.appendChild(item);
    });

    // Поиск чатов, в которых пользователь пока не состоит (discover)
    let foundChats = [];
    try {
      discoverChats = await api("/api/chats/discover");
      foundChats = discoverChats.filter(
        (c) =>
          (c.visibility === undefined || c.visibility === "public") &&
          (c.title || "").toLowerCase().includes(q)
      );
    } catch {
      foundChats = [];
    }

    if (foundChats.length) {
      const chatsTitle = document.createElement("div");
      chatsTitle.className = "aton-search-section-title";
      chatsTitle.style.marginTop = users.length || myChatsFound.length ? "6px" : "0";
      chatsTitle.textContent = t("Рекомендуемые чаты");
      searchResultsEl.appendChild(chatsTitle);
    }

    foundChats.forEach((chat) => {
      const item = document.createElement("div");
      item.className = "aton-search-item";
      item.style.opacity = "0.82";
      item.style.borderLeft = "2px solid rgba(148,163,184,0.25)";
      item.style.paddingLeft = "8px";
      item.innerHTML = `
        <div class="aton-search-main" style="cursor:pointer;">
          ${escHtml(chat.title)}${chat.verified ? ' <span style="color:#38bdf8;">✔</span>' : ""}
          <span style="font-size:9px;background:rgba(148,163,184,0.12);color:#94a3b8;padding:1px 5px;border-radius:6px;margin-left:4px;white-space:nowrap;">${escHtml(t("не участник"))}</span>
        </div>
        <div class="aton-search-actions">
          <button type="button" class="aton-search-action aton-search-join">${escHtml(t("Вступить"))}</button>
        </div>
      `;
      const main = item.querySelector(".aton-search-main");
      const joinBtn = item.querySelector(".aton-search-join");

      // Клик по названию — открывает превью, НЕ добавляет в список чатов
      main.addEventListener("click", () => {
        leaveProfileForChatSelection();
        currentChatId = chat.id;
        switchSocketChat(currentChatId);
        // Намеренно НЕ сохраняем в lastChatId — это ещё не «мой» чат
        searchInput.value = "";
        searchResultsEl.innerHTML = "";
        renderChatList();
        renderMessages();
        updateTopbarTitle();
      });

      joinBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        joinBtn.disabled = true;
        joinBtn.textContent = "…";
        try {
          await api(`/api/chats/${chat.id}/join`, { method: "POST" });
          await bootstrapData();
          leaveProfileForChatSelection();
          currentChatId = chat.id;
          switchSocketChat(currentChatId);
          if (current.username) setLastChatId(current.username, currentChatId);
          searchInput.value = "";
          searchResultsEl.innerHTML = "";
          renderChatList();
          renderMessages();
          updateTopbarTitle();
          showToast(t("Вы вступили в чат"));
        } catch (err) {
          joinBtn.disabled = false;
          joinBtn.textContent = t("Вступить");
          alert(err.message);
        }
      });

      searchResultsEl.appendChild(item);
    });
  }

  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(handleUserSearch, 200);
  });

  // Создание групп
  if (createGroupButton) {
    createGroupButton.addEventListener("click", () => {
      const current = currentUser;
      if (!current) {
        alert(t("Сначала войдите или зарегистрируйтесь, чтобы создавать группы."));
        return;
      }

      const overlay = document.createElement("div");
      overlay.className = "aton-create-chat-overlay";

      const modal = document.createElement("div");
      modal.className = "aton-create-chat-panel";
      modal.innerHTML = `
        <div class="aton-create-chat-head">
          <div>
            <div class="aton-create-chat-title">${escHtml(t("Новый чат"))}</div>
            <div class="aton-create-chat-subtitle">${escHtml(t("Выберите тип и введите название."))}</div>
          </div>
          <button type="button" id="aton-group-cancel" class="aton-create-chat-close" aria-label="${escHtml(t("Отмена"))}">×</button>
        </div>

        <div class="aton-create-chat-field">
          <label class="aton-input-label">${escHtml(t("Тип"))}</label>
          <div class="aton-create-chat-segment" data-role="type">
            <button type="button" class="active" data-value="group">${escHtml(t("группа"))}</button>
            <button type="button" data-value="channel">${escHtml(t("канал"))}</button>
          </div>
        </div>

        <div class="aton-create-chat-field">
          <label class="aton-input-label">${escHtml(t("Доступ"))}</label>
          <div class="aton-create-chat-segment" data-role="visibility">
            <button type="button" class="active" data-value="public">${escHtml(t("Публичный"))}</button>
            <button type="button" data-value="private">${escHtml(t("Приватный"))}</button>
          </div>
        </div>

        <div class="aton-create-chat-field">
          <label class="aton-input-label" for="aton-group-title">${escHtml(t("Название"))}</label>
          <input type="text" id="aton-group-title" class="aton-input" placeholder="${escHtml(t("Например: «Песни о Фивах»"))}" />
        </div>

        <div class="aton-create-chat-field">
          <label class="aton-input-label" for="aton-group-desc">${escHtml(t("Описание"))} <span>${escHtml(t("необязательно"))}</span></label>
          <textarea id="aton-group-desc" class="aton-input" rows="3" placeholder="${escHtml(t("О чём этот чат?"))}"></textarea>
        </div>

        <div class="aton-create-chat-actions">
          <button type="button" id="aton-group-cancel-secondary" class="aton-create-chat-secondary">${escHtml(t("Отмена"))}</button>
          <button type="button" id="aton-group-create" class="aton-create-chat-primary">${escHtml(t("Создать"))}</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const titleInput = modal.querySelector("#aton-group-title");
      const descInput = modal.querySelector("#aton-group-desc");
      const cancelBtn = modal.querySelector("#aton-group-cancel");
      const cancelSecondaryBtn = modal.querySelector("#aton-group-cancel-secondary");
      const createBtn = modal.querySelector("#aton-group-create");
      let selectedType = "group";
      let selectedVisibility = "public";
      titleInput.focus();

      const closeCreateChat = () => {
        document.removeEventListener("keydown", onCreateChatKeydown);
        overlay.remove();
      };
      const onCreateChatKeydown = (event) => {
        if (event.key === "Escape") closeCreateChat();
      };
      document.addEventListener("keydown", onCreateChatKeydown);
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeCreateChat();
      });
      cancelBtn.addEventListener("click", closeCreateChat);
      cancelSecondaryBtn.addEventListener("click", closeCreateChat);

      modal.querySelectorAll(".aton-create-chat-segment").forEach((segment) => {
        segment.addEventListener("click", (event) => {
          const btn = event.target.closest("button[data-value]");
          if (!btn) return;
          segment.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === btn));
          if (segment.dataset.role === "type") selectedType = btn.dataset.value === "channel" ? "channel" : "group";
          if (segment.dataset.role === "visibility") selectedVisibility = btn.dataset.value === "private" ? "private" : "public";
        });
      });

      createBtn.addEventListener("click", async () => {
        const title = titleInput.value.trim();
        if (!title) return;
        const description = descInput.value.trim() || null;
        const type = selectedType;
        const visibility = selectedVisibility;
        try {
          const chat = await api("/api/chats", {
            method: "POST",
            body: JSON.stringify({ title, type, visibility, description }),
          });
          allChats.push(chat);
          leaveProfileForChatSelection();
          currentChatId = chat.id;
          switchSocketChat(currentChatId);
          if (current.username) setLastChatId(current.username, currentChatId);
          closeCreateChat();
          renderChatList();
          renderMessages();
          updateTopbarTitle();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }

  // Профиль и аватар
  function renderProfilePage() {
    if (!currentUser) {
      alert(t("Сначала войдите или зарегистрируйтесь."));
      return;
    }
    const user = userByUsername(currentUser.username) || currentUser;
    const avatarHtml = user.avatarDataUrl
      ? `<img id="aton-profile-avatar-preview" src="${escHtml(user.avatarDataUrl)}" alt="" />`
      : `<span id="aton-profile-avatar-letter">${escHtml((user.displayName || user.username || "?").slice(0, 1).toUpperCase())}</span><img id="aton-profile-avatar-preview" src="" alt="" hidden />`;
    const displayName = user.displayName || user.username || "";
    const publicId = user.publicId || user.username || "";
    const email = user.email || currentUser.email || "";
    const profileVerified = Boolean(user.isVerified || currentUser.isVerified);
    const verifiedText = profileVerified ? t("Профиль верифицирован") : t("Профиль не верифицирован");
    const verifiedClass = profileVerified ? " is-verified" : "";
    const verifiedMark = profileVerified ? "✔" : "!";

    profilePage.innerHTML = `
      <div class="aton-profile-page-scroll">
        <div class="aton-profile-mobile-nav">
          <button type="button" class="aton-profile-mobile-back" id="aton-profile-mobile-back">
            <span aria-hidden="true">‹</span>
            <span>${escHtml(t("Назад к чатам"))}</span>
          </button>
        </div>
        <section class="aton-profile-hero">
          <button type="button" class="aton-profile-back" id="aton-profile-back">${escHtml(t("Назад к чатам"))}</button>
          <div class="aton-profile-hero-main">
            <div class="aton-profile-avatar-large">
              ${avatarHtml}
            </div>
            <div class="aton-profile-hero-copy">
              <h1>${escHtml(displayName)}</h1>
              <div class="aton-profile-public-id">@${escHtml(publicId)}</div>
              <div class="aton-profile-status-row">
                <span class="aton-profile-verify-pill${verifiedClass}"><span>${verifiedMark}</span>${escHtml(verifiedText)}</span>
                <span class="aton-profile-email-pill">${escHtml(email || "—")}</span>
              </div>
              <label class="aton-profile-avatar-upload">
                ${escHtml(t("Загрузить аватар"))}
                <input type="file" id="aton-profile-avatar" accept="image/*" hidden />
              </label>
            </div>
          </div>
        </section>

        <section class="aton-profile-form">
          <div class="aton-profile-section-title">${escHtml(t("Данные аккаунта"))}</div>
          <div class="aton-profile-field">
            <label class="aton-input-label" for="aton-profile-email">${escHtml(t("Email аккаунта"))}</label>
            <input type="email" id="aton-profile-email" class="aton-input" value="${escHtml(email)}" readonly />
            <div class="aton-profile-help">${escHtml(t("Email нельзя изменить"))}</div>
          </div>
          <div class="aton-profile-field">
            <label class="aton-input-label" for="aton-profile-name">${escHtml(t("Отображаемое имя"))}</label>
            <input type="text" id="aton-profile-name" class="aton-input" />
          </div>
          <div class="aton-profile-field">
            <label class="aton-input-label" for="aton-profile-bio">${escHtml(t("Статус"))}</label>
            <input type="text" id="aton-profile-bio" class="aton-input" placeholder="${escHtml(t("Например: «Пишу при свете Атена»"))}" />
          </div>
          <div class="aton-profile-field">
            <label class="aton-input-label" for="aton-profile-public-id">${escHtml(t("ID профиля"))}</label>
            <input type="text" id="aton-profile-public-id" class="aton-input" placeholder="${escHtml(t("Удобный ID, по которому вас можно найти (@id)"))}" />
            <div class="aton-profile-help">${escHtml(t("ID может содержать латинские буквы, цифры, подчёркивание и дефис (3–32 символа). Должен быть уникальным."))}</div>
          </div>
          <div class="aton-profile-field">
            <div class="aton-input-label">${escHtml(t("Язык интерфейса"))}</div>
            <div class="aton-profile-language-options" role="group" aria-label="${escHtml(t("Язык интерфейса"))}">
              <button type="button" class="aton-lang-btn aton-profile-lang-btn" data-lang="ru" title="${escHtml(t("Русский"))}" aria-label="${escHtml(t("Русский"))}">
                <span class="aton-flag aton-flag--ru" aria-hidden="true"></span>
                <span>${escHtml(t("Русский"))}</span>
              </button>
              <button type="button" class="aton-lang-btn aton-profile-lang-btn" data-lang="de" title="${escHtml(t("Немецкий"))}" aria-label="${escHtml(t("Немецкий"))}">
                <span class="aton-flag aton-flag--de" aria-hidden="true"></span>
                <span>${escHtml(t("Немецкий"))}</span>
              </button>
              <button type="button" class="aton-lang-btn aton-profile-lang-btn" data-lang="en" title="${escHtml(t("Английский"))}" aria-label="${escHtml(t("Английский"))}">
                <span class="aton-flag aton-flag--gb" aria-hidden="true"></span>
                <span>${escHtml(t("Английский"))}</span>
              </button>
            </div>
            <div class="aton-profile-help">${escHtml(t("После смены языка страница обновится"))}</div>
          </div>
          <div class="aton-profile-actions">
            <button type="button" id="aton-profile-cancel" class="aton-new-chat-button">${escHtml(t("Отмена"))}</button>
            <button type="button" id="aton-profile-logout" class="aton-profile-logout-button">${escHtml(t("Выйти"))}</button>
            <button type="button" id="aton-profile-save" class="aton-primary-button">${escHtml(t("Сохранить"))}</button>
          </div>
        </section>
      </div>
    `;

  const nameInput = profilePage.querySelector("#aton-profile-name");
  const bioInput = profilePage.querySelector("#aton-profile-bio");
  const publicIdInput = profilePage.querySelector("#aton-profile-public-id");
  const avatarInput = profilePage.querySelector("#aton-profile-avatar");
  const avatarPreview = profilePage.querySelector("#aton-profile-avatar-preview");
  const avatarLetter = profilePage.querySelector("#aton-profile-avatar-letter");

  nameInput.value = user.displayName || user.username;
  bioInput.value = user.bio || "";
  publicIdInput.value = user.publicId || user.username;

  let newAvatarDataUrl = user.avatarDataUrl || null;

  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      newAvatarDataUrl = reader.result;
      avatarPreview.src = newAvatarDataUrl;
      avatarPreview.hidden = false;
      if (avatarLetter) avatarLetter.hidden = true;
    };
    reader.readAsDataURL(file);
  });

  profilePage.querySelector("#aton-profile-back").addEventListener("click", closeProfilePage);
  profilePage.querySelector("#aton-profile-mobile-back").addEventListener("click", closeProfilePage);
  profilePage.querySelector("#aton-profile-cancel").addEventListener("click", closeProfilePage);
  profilePage.querySelector("#aton-profile-logout").addEventListener("click", performFullLogout);

  profilePage.querySelector("#aton-profile-save").addEventListener("click", async () => {
    try {
      const displayName = nameInput.value.trim() || user.username;
      const bio = bioInput.value.trim();
      const publicId = publicIdInput.value.trim();
      const updated = await api("/api/profile", {
        method: "POST",
        body: JSON.stringify({
          displayName,
          bio,
          avatarDataUrl: newAvatarDataUrl,
          publicId,
        }),
      });
      currentUser = updated;
      currentUser.isSuperAdmin = resolveIsSuperAdmin(currentUser);
      assignPeerAliasesOnUser(currentUser);
      const idx = allUsers.findIndex((u) => u.id === updated.id);
      if (idx !== -1) allUsers[idx] = updated;
      else allUsers.push(updated);

      applyCurrentUserUI();
      renderProfilePage();
      syncLangButtons();
      renderChatList();
      renderMessages();
      updateTopbarTitle();
    } catch (err) {
      alert(err.message);
    }
  });
}

  function openProfilePage() {
    if (!currentUser) {
      alert(t("Сначала войдите или зарегистрируйтесь."));
      return;
    }
    mainView = "profile";
    profilePage.hidden = false;
    chat.hidden = true;
    if (peerActionBar) peerActionBar.hidden = true;
    renderProfilePage();
    syncLangButtons();
    applyCurrentUserUI();
    updateTopbarTitle();
  }

  function leaveProfileForChatSelection() {
    if (mainView !== "profile") return;
    mainView = "chat";
    if (profilePage) profilePage.hidden = true;
    if (chat) chat.hidden = false;
    if (peerActionBar) peerActionBar.hidden = true;
    shell.classList.remove("aton-shell--profile");
  }

  function closeProfilePage() {
    mainView = "chat";
    profilePage.hidden = true;
    chat.hidden = false;
    applyCurrentUserUI();
    renderMessages({ deferIfVoice: true });
    updateTopbarTitle();
    updatePeerActionBar();
  }

  profileLink.addEventListener("click", openProfilePage);
  userPill.addEventListener("click", openProfilePage);

  // Theme toggle
  const THEME_KEY = "aton_theme";
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    const moonOrSun = theme === "light"
      ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    const icon = themeToggle?.querySelector("svg");
    if (icon) icon.innerHTML = moonOrSun;
    const iconSb = sidebarThemeBtn?.querySelector("svg");
    if (iconSb) iconSb.innerHTML = moonOrSun;
  }
  applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }
  if (sidebarThemeBtn) {
    sidebarThemeBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }
  if (notifyPermissionBtn) {
    notifyPermissionBtn.addEventListener("click", async () => {
      if (typeof Notification === "undefined") {
        showToast(t("Уведомления не поддерживаются в этом браузере"));
        return;
      }
      try {
        const p = await Notification.requestPermission();
        updateNotifyPermissionButton();
        if (p === "granted") showToast(t("Когда вкладка в фоне, вы будете видеть уведомления о сообщениях"));
        else if (p === "denied") showToast(t("Разрешите уведомления в настройках сайта в браузере"));
      } catch (_) {
        showToast(t("Не удалось запросить разрешение"));
      }
    });
  }

  async function openModerationModal() {
    if (!currentUser || !currentUser.isSuperAdmin) return;
    try {
      reports = await api("/api/reports");
    } catch (err) {
      alert(err.message);
      return;
    }

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(15,23,42,0.8)";
    overlay.style.backdropFilter = "blur(12px)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "80";

    const modal = document.createElement("div");
    modal.style.background = "rgba(15,23,42,0.98)";
    modal.style.borderRadius = "18px";
    modal.style.border = "1px solid rgba(148,163,184,0.7)";
    modal.style.padding = "16px 18px";
    modal.style.width = "680px";
    modal.style.maxHeight = "78vh";
    modal.style.color = "#e5e7eb";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-size:14px;font-weight:600;">Модерация</div>
        <button type="button" id="aton-moderation-close" class="aton-new-chat-button">Закрыть</button>
      </div>
      <div id="aton-reports-list" style="display:flex;flex-direction:column;gap:8px;overflow:auto;min-height:120px;"></div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const listEl = modal.querySelector("#aton-reports-list");
    const closeBtn = modal.querySelector("#aton-moderation-close");

    const renderReports = async () => {
      listEl.innerHTML = "";
      if (!reports.length) {
        const empty = document.createElement("div");
        empty.style.fontSize = "12px";
        empty.style.color = "#9ca3af";
        empty.textContent = "Жалоб пока нет.";
        listEl.appendChild(empty);
        return;
      }

      // Подгружаем discover для названий чатов, если они не в allChats
      let discover = [];
      try {
        discover = await api("/api/chats/discover");
      } catch {
        discover = [];
      }

      const pending = reports.filter((r) => (r.status || "pending") === "pending");
      const rest = reports.filter((r) => (r.status || "pending") !== "pending");
      const orderedReports = [...pending, ...rest];

      orderedReports.forEach((r) => {
        const chatInJoined = allChats.find((c) => c.id === r.chatId);
        const chatInDiscover = discover.find((c) => c.id === r.chatId);
        const chatTitle = chatInJoined?.title || chatInDiscover?.title || r.chatId;
        const reporter = allUsers.find((u) => u.id === r.reportedBy);
        const reporterLabel = reporter?.username || r.reportedBy;
        const status = r.status || "pending";
        const statusLabel =
          status === "resolved" ? "Решена" : status === "rejected" ? "Отклонена" : "В ожидании";

        const row = document.createElement("div");
        row.style.border = "1px solid rgba(55,65,81,0.9)";
        row.style.borderRadius = "12px";
        row.style.padding = "10px";
        row.style.background = "rgba(15,23,42,0.45)";
        row.innerHTML = `
          <div style="font-size:12px;font-weight:600;margin-bottom:4px;">${chatTitle}</div>
          <div style="font-size:11px;color:#9ca3af;margin-bottom:2px;">Пожаловался: ${reporterLabel}</div>
          <div style="font-size:11px;color:#cbd5e1;margin-bottom:8px;">Причина: ${r.reason}</div>
          <div style="font-size:10px;color:#38bdf8;margin-bottom:8px;">Статус: ${statusLabel}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="aton-search-action aton-report-open">Открыть чат</button>
            <button type="button" class="aton-search-action aton-report-delete">Удалить чат</button>
            <button type="button" class="aton-search-action aton-report-ignore">Игнорировать</button>
          </div>
        `;

        const openBtn = row.querySelector(".aton-report-open");
        const deleteBtn = row.querySelector(".aton-report-delete");
        const ignoreBtn = row.querySelector(".aton-report-ignore");

        openBtn.addEventListener("click", () => {
          leaveProfileForChatSelection();
          currentChatId = r.chatId;
          switchSocketChat(currentChatId);
          overlay.remove();
          renderChatList();
          renderMessages();
          updateTopbarTitle();
        });

        deleteBtn.addEventListener("click", async () => {
          if (!confirm("Удалить чат по жалобе?")) return;
          try {
            await api(`/api/chats/${r.chatId}`, { method: "DELETE" });
            await api(`/api/reports/${r.id}/resolve`, { method: "POST" });
            allChats = allChats.filter((c) => c.id !== r.chatId);
            allMessages = allMessages.filter((m) => m.chatId !== r.chatId);
            reports = reports.map((x) =>
              x.id === r.id ? { ...x, status: "resolved" } : x
            );
            if (currentChatId === r.chatId) {
              currentChatId = null;
              switchSocketChat(null);
            }
            renderChatList();
            renderMessages();
            updateTopbarTitle();
            renderReports();
          } catch (err) {
            alert(err.message);
          }
        });

        ignoreBtn.addEventListener("click", async () => {
          try {
            await api(`/api/reports/${r.id}/reject`, { method: "POST" });
            reports = reports.map((x) =>
              x.id === r.id ? { ...x, status: "rejected" } : x
            );
            renderReports();
          } catch (err) {
            alert(err.message);
          }
        });

        listEl.appendChild(row);
      });
    };

    await renderReports();

    closeBtn.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function formatAdminListDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return String(iso);
    }
  }

  async function openAdminUsersModal() {
    if (!currentUser || !currentUser.isSuperAdmin) return;
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(15,23,42,0.88);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;z-index:90;";
    const modal = document.createElement("div");
    modal.style.cssText =
      "background:rgba(15,23,42,0.98);border-radius:18px;border:1px solid rgba(148,163,184,0.7);padding:16px 18px;width:min(960px,96vw);max-height:86vh;color:#e5e7eb;display:flex;flex-direction:column;box-sizing:border-box;";
    modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px;flex-wrap:wrap;">
        <div style="font-size:14px;font-weight:600;">Все пользователи</div>
        <input type="search" id="aton-admin-users-filter" placeholder="Поиск…" style="flex:1;min-width:160px;max-width:320px;padding:6px 10px;border-radius:8px;border:1px solid rgba(148,163,184,0.35);background:rgba(15,23,42,0.6);color:#e5e7eb;"/>
        <button type="button" id="aton-admin-users-close" class="aton-new-chat-button">Закрыть</button>
      </div>
      <div id="aton-admin-users-body" style="overflow:auto;flex:1;min-height:120px;font-size:12px;"></div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const bodyEl = modal.querySelector("#aton-admin-users-body");
    const closeBtn = modal.querySelector("#aton-admin-users-close");
    const filterInput = modal.querySelector("#aton-admin-users-filter");
    bodyEl.textContent = "Загрузка…";

    let list = [];
    try {
      list = await api("/api/admin/users");
    } catch (err) {
      bodyEl.textContent = "";
      const errDiv = document.createElement("div");
      errDiv.style.cssText = "color:#fecaca;padding:8px 0;";
      errDiv.textContent = err.message || "Не удалось загрузить список. Проверьте, что бэкенд обновлён (есть GET /api/admin/users).";
      bodyEl.appendChild(errDiv);
      closeBtn.addEventListener("click", () => overlay.remove());
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
      });
      return;
    }

    if (!Array.isArray(list) || !list.length) {
      bodyEl.textContent = "Пользователей нет.";
    } else {
      const wrap = document.createElement("div");
      wrap.style.cssText = "overflow:auto;max-height:min(64vh,560px);border:1px solid rgba(55,65,81,0.9);border-radius:12px;";
      const table = document.createElement("table");
      table.style.cssText = "width:100%;border-collapse:collapse;";
      const thead = document.createElement("thead");
      const hr = document.createElement("tr");
      ["#", "Имя / @", "Email", "Регистрация", "Last seen", "Флаги", "id"].forEach((h) => {
        const th = document.createElement("th");
        th.textContent = h;
        th.style.cssText =
          "text-align:left;padding:8px 6px;border-bottom:1px solid rgba(55,65,81,0.9);position:sticky;top:0;background:rgba(15,23,42,0.95);color:#94a3b8;font-size:11px;";
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      tbody.id = "aton-admin-users-tbody";
      table.appendChild(tbody);
      wrap.appendChild(table);
      bodyEl.textContent = "";
      bodyEl.appendChild(wrap);

      const renderRows = (q) => {
        tbody.innerHTML = "";
        const needle = String(q || "")
          .trim()
          .toLowerCase();
        let n = 0;
        for (let i = 0; i < list.length; i++) {
          const u = list[i];
          if (needle) {
            const pack = [u.username, u.publicId, u.displayName, u.email, u.id].join(" ").toLowerCase();
            if (pack.indexOf(needle) === -1) continue;
          }
          n += 1;
          const tr = document.createElement("tr");
          tr.style.borderBottom = "1px solid rgba(55,65,81,0.45)";
          const td0 = document.createElement("td");
          td0.textContent = String(n);
          td0.style.padding = "6px";
          const td1 = document.createElement("td");
          td1.style.padding = "6px";
          const strong = document.createElement("strong");
          strong.textContent = u.displayName || u.username;
          td1.appendChild(strong);
          td1.appendChild(document.createElement("br"));
          const sub = document.createElement("span");
          sub.style.cssText = "font-size:10px;opacity:0.85;word-break:break-all;";
          sub.textContent = "@" + (u.publicId || "");
          td1.appendChild(sub);
          const td2 = document.createElement("td");
          td2.style.cssText = "padding:6px;word-break:break-all;font-size:11px;";
          td2.textContent = u.email || "—";
          const td3 = document.createElement("td");
          td3.style.padding = "6px";
          td3.textContent = formatAdminListDate(u.createdAt);
          const td4 = document.createElement("td");
          td4.style.padding = "6px";
          td4.textContent = formatAdminListDate(u.lastSeen);
          const td5 = document.createElement("td");
          td5.style.padding = "6px";
          const fl = [];
          if (u.isSuperAdmin) fl.push("super");
          if (u.verified || u.isVerified) fl.push("ok");
          td5.textContent = fl.length ? fl.join(", ") : "—";
          const td6 = document.createElement("td");
          td6.style.cssText = "padding:6px;word-break:break-all;font-size:10px;opacity:0.85;";
          td6.textContent = u.id || "—";
          tr.appendChild(td0);
          tr.appendChild(td1);
          tr.appendChild(td2);
          tr.appendChild(td3);
          tr.appendChild(td4);
          tr.appendChild(td5);
          tr.appendChild(td6);
          tbody.appendChild(tr);
        }
        if (n === 0 && needle) {
          const tr = document.createElement("tr");
          const td = document.createElement("td");
          td.colSpan = 7;
          td.style.cssText = "padding:12px;text-align:center;color:#94a3b8;";
          td.textContent = "Никого не найдено";
          tr.appendChild(td);
          tbody.appendChild(tr);
        }
      };
      renderRows("");
      filterInput.addEventListener("input", () => renderRows(filterInput.value));
    }

    closeBtn.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  if (adminUsersButton) {
    adminUsersButton.addEventListener("click", () => {
      openAdminUsersModal();
    });
  }

  if (moderationButton) {
    moderationButton.addEventListener("click", () => {
      openModerationModal();
    });
  }

  // Голосовые: удержание (PTT) → превью → отправить
  function clearPttDocEndHandler() {
    if (!pttDocEndHandler) return;
    document.removeEventListener("pointerup", pttDocEndHandler, true);
    document.removeEventListener("pointercancel", pttDocEndHandler, true);
    pttDocEndHandler = null;
  }

  function releasePttPointerCaptureIfAny(capEl, pointerId) {
    if (!capEl) return;
    try {
      if (typeof capEl.hasPointerCapture === "function" && capEl.hasPointerCapture(pointerId)) {
        capEl.releasePointerCapture(pointerId);
      }
    } catch (_) {}
  }

  async function runPttFromPointerEvent(e) {
    unlockNotificationAudio();
    const user = currentUser;
    if (!user || !currentChatId) return;
    if (e.button != null && e.button !== 0) return;
    if (pttInFlight) return;
    if (mediaRecorder && mediaRecorder.state === "recording") return;

    const capEl = e.currentTarget;
    if (!capEl) return;
    const capturePointerId = e.pointerId;
    pttInFlight = true;
    pttUserReleasedBeforeRecord = false;
    clearPttDocEndHandler();
    pttDocEndHandler = (ev) => {
      if (ev.pointerId !== capturePointerId) return;
      if (mediaRecorder && mediaRecorder.state === "recording") {
        try {
          mediaRecorder.stop();
        } catch (_) {}
      } else {
        pttUserReleasedBeforeRecord = true;
      }
    };
    document.addEventListener("pointerup", pttDocEndHandler, true);
    document.addEventListener("pointercancel", pttDocEndHandler, true);
    try {
      try {
        capEl.setPointerCapture(capturePointerId);
      } catch (_) {}

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (pttUserReleasedBeforeRecord) {
        clearPttDocEndHandler();
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch (_) {}
        releasePttPointerCaptureIfAny(capEl, capturePointerId);
        pttInFlight = false;
        return;
      }
      activeMicStream = stream;
      recordedChunks = [];
      voiceSessionChatId = currentChatId;
      const pttToGolosAton = isGolosAtonChat();
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.addEventListener("dataavailable", (ev2) => {
        if (ev2.data.size > 0) recordedChunks.push(ev2.data);
      });

      mediaRecorder.addEventListener("stop", () => {
        clearPttDocEndHandler();
        releasePttPointerCaptureIfAny(capEl, capturePointerId);
        pttInFlight = false;
        stopRecordingTimerUi();
        if (composeRecordHint) composeRecordHint.hidden = true;
        setMicButtonIdle();

        if (activeMicStream) {
          activeMicStream.getTracks().forEach((t) => t.stop());
          activeMicStream = null;
        }

        if (discardVoiceOnNextStop) {
          discardVoiceOnNextStop = false;
          recordedChunks = [];
          mediaRecorder = null;
          voiceSessionChatId = null;
          clearVoicePreview();
          return;
        }

        const blob = new Blob(recordedChunks, { type: "audio/webm" });
        recordedChunks = [];
        mediaRecorder = null;

        const durSec = (Date.now() - recordingStartedAt) / 1000;
        if (blob.size < 80 || durSec < 0.45) {
          showToast(t("Слишком короткое сообщение"));
          voiceSessionChatId = null;
          return;
        }

        if (pttToGolosAton) {
          voiceSessionChatId = null;
          void (async () => {
            try {
              await sendAudioBlobAsMessage(blob);
            } catch (e) {
              alert((e && e.message) || t("Не удалось отправить"));
            }
          })();
          return;
        }

        showVoicePreview(blob);
      });

      if (pttUserReleasedBeforeRecord) {
        clearPttDocEndHandler();
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch (_) {}
        activeMicStream = null;
        mediaRecorder = null;
        recordedChunks = [];
        releasePttPointerCaptureIfAny(capEl, capturePointerId);
        pttInFlight = false;
        return;
      }
      mediaRecorder.start();
      if (composeRecordHint) composeRecordHint.hidden = false;
      setMicButtonRecordingUi();
      startRecordingTimerUi();
    } catch (err) {
      clearPttDocEndHandler();
      releasePttPointerCaptureIfAny(capEl, capturePointerId);
      pttInFlight = false;
      alert(t("Не удалось получить доступ к микрофону."));
      console.error(err);
      activeMicStream = null;
      voiceSessionChatId = null;
    }
  }

  function onVoicePttPointerDownFrom(e) {
    e.preventDefault();
    void runPttFromPointerEvent(e);
  }

  micButton.addEventListener("pointerdown", onVoicePttPointerDownFrom, { passive: false });
  micButton.addEventListener("contextmenu", (ev) => {
    if (mediaRecorder && mediaRecorder.state === "recording") ev.preventDefault();
  });

  function updateTopbarTitle() {
    if (!topbarTitleEl || !statusEl) return;
    function setTitle(titleText, verified) {
      topbarTitleEl.innerHTML = "";
      const inner = document.createElement("div");
      inner.className = "aton-topbar-title-inner";

      const text = document.createElement("span");
      text.className = "aton-title-text";
      text.textContent = titleText;
      inner.appendChild(text);

      if (verified) {
        const badge = document.createElement("span");
        badge.className = "aton-verified-badge";
        badge.textContent = "✔";
        badge.title = t("Верифицировано");
        inner.appendChild(badge);
      }

      topbarTitleEl.appendChild(inner);
    }

    try {
      const current = currentUser;
      statusEl.classList.remove("aton-topbar-status--online");
      if (!current) {
        setTitle(t("Добро пожаловать"), false);
        return;
      }
      if (mainView === "profile") {
        setTitle(t("Профиль пользователя"), false);
        statusEl.textContent = t("Настройки профиля");
        statusEl.removeAttribute("title");
        return;
      }
      if (!currentChatId) {
        setTitle(t("Выберите чат или пользователя слева"), false);
        return;
      }
      if (currentChatId.startsWith("group:") || currentChatId.startsWith("channel:")) {
        const chatMeta = allChats.find((c) => c.id === currentChatId);
        if (chatMeta) {
          const verified = Boolean(chatMeta.verified);
          setTitle(chatMeta.title, verified);
          statusEl.textContent = t("Групповой чат");
          statusEl.removeAttribute("title");
          return;
        }
        const preview = discoverChats.find((c) => c.id === currentChatId);
        if (preview) {
          setTitle(`${preview.title} (${t("не участник")})`, Boolean(preview.verified));
        } else {
          setTitle(t("Предпросмотр чата"), false);
        }
        statusEl.textContent = t("Групповой чат");
        statusEl.removeAttribute("title");
        return;
      }
      const peer = currentChatPeer();
      if (!peer) {
        setTitle(t("Личный диалог"), false);
        statusEl.textContent = "";
        statusEl.removeAttribute("title");
        return;
      }
      if (peer === GOLOS_ATON_USERNAME) {
        setTitle(t("Голос Атона"), true);
        statusEl.textContent = t("Принцип, не служба");
        statusEl.setAttribute("title", t("Голос из позиции Атона — не помощник и не сервис"));
        statusEl.classList.add("aton-topbar-status--online");
        return;
      }
      const peerUser = userByUsername(peer);
      const name = displayNameForPeer(current.username, peer, peerUser);
      const verified = Boolean(peerUser && peerUser.isVerified);
      setTitle(name, verified);

      const presence = formatPeerPresence(peerUser);
      statusEl.textContent = presence.text;
      statusEl.title = presence.title || presence.text;
      statusEl.classList.toggle("aton-topbar-status--online", presence.online);
    } finally {
      updatePeerActionBar();
      updateGolosChatChrome();
    }
  }

  setInterval(() => {
    if (!currentUser) return;
    if (
      currentChatId &&
      !currentChatId.startsWith("group:") &&
      !currentChatId.startsWith("channel:")
    ) {
      updateTopbarTitle();
    }
  }, 60000);

  // Инициализация
  switchMode("login");

  const hasToken = Boolean(getToken());
  if (hasToken) {
    if (sidebarHeader) sidebarHeader.style.display = "none";
    authRoot.style.display = "none";
    authLoginBlock.style.display = "none";
    sidebarLangFooter.style.display = "none";
  }

  const joinUrlMatch = window.location.pathname.match(/^\/join\/([^/]+)\/?$/);
  const pendingInviteToken = joinUrlMatch ? joinUrlMatch[1] : null;

  function openInviteJoinFlow(token) {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:400;background:rgba(15,23,42,0.92);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:20px;";
    const card = document.createElement("div");
    card.style.cssText =
      "max-width:400px;width:100%;background:rgba(15,23,42,0.98);border:1px solid rgba(148,163,184,0.45);border-radius:18px;padding:22px;color:#e5e7eb;";
    card.innerHTML = `
      <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Приглашение в чат</div>
      <div id="aton-invite-title" style="font-size:20px;font-weight:600;margin-bottom:12px;">Загрузка…</div>
      <div id="aton-invite-error" style="font-size:12px;color:#f87171;margin-bottom:12px;display:none;"></div>
      <div id="aton-invite-hint" style="font-size:12px;color:#94a3b8;margin-bottom:14px;display:none;"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button type="button" id="aton-invite-join" class="aton-primary-button" style="margin-top:0;">Вступить</button>
        <button type="button" id="aton-invite-close" class="aton-new-chat-button" style="margin-top:0;">Закрыть</button>
      </div>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const titleEl = card.querySelector("#aton-invite-title");
    const errEl = card.querySelector("#aton-invite-error");
    const hintEl = card.querySelector("#aton-invite-hint");
    const joinBtn = card.querySelector("#aton-invite-join");
    const closeBtn = card.querySelector("#aton-invite-close");

    const dismiss = () => {
      overlay.remove();
      window.history.replaceState({}, "", "/");
    };

    closeBtn.addEventListener("click", dismiss);

    fetchJsonPublic(`/api/chats/invite/${encodeURIComponent(token)}`)
      .then((data) => {
        let t = data.title || "Чат";
        if (data.verified) t += " ✔";
        titleEl.textContent = t;
      })
      .catch((e) => {
        titleEl.textContent = t("Приглашение недоступно");
        errEl.textContent = e.message || t("Ссылка недействительна");
        errEl.style.display = "block";
        joinBtn.style.display = "none";
      });

    joinBtn.addEventListener("click", async () => {
      errEl.style.display = "none";
      hintEl.style.display = "none";
      if (!getToken()) {
        hintEl.textContent =
          t("Сначала войдите или зарегистрируйтесь — форма входа слева.");
        hintEl.style.display = "block";
        return;
      }
      try {
        const result = await api(
          `/api/chats/invite/${encodeURIComponent(token)}/join`,
          { method: "POST" }
        );
        const cid = result.chat && result.chat.id;
        if (!cid) throw new Error(t("Не удалось вступить в чат"));
        window.history.replaceState({}, "", "/");
        overlay.remove();
        leaveProfileForChatSelection();
        currentChatId = cid;
        switchSocketChat(cid);
        const u = currentUser;
        if (u && u.username) setLastChatId(u.username, cid);
        await bootstrapData();
        applyCurrentUserUI();
        renderChatList();
        renderMessages();
        updateTopbarTitle();
      } catch (e) {
        errEl.textContent = e.message || t("Ошибка");
        errEl.style.display = "block";
      }
    });
  }

  if (pendingInviteToken) {
    openInviteJoinFlow(pendingInviteToken);
  }

  let refreshUserDataDebounce = null;
  let allowUserDataRefetch = false;
  function refreshUserDataFromServer() {
    if (!allowUserDataRefetch) return;
    if (!getToken() || !currentUser) return;
    if (refreshUserDataDebounce) clearTimeout(refreshUserDataDebounce);
    refreshUserDataDebounce = setTimeout(async () => {
      refreshUserDataDebounce = null;
      try {
        const me = await api("/api/me");
        if (!getToken() || !currentUser) return;
        currentUser = me;
        currentUser.isSuperAdmin = resolveIsSuperAdmin(currentUser);
        assignPeerAliasesOnUser(currentUser);
        const ulist = await api("/api/users");
        if (!getToken() || !currentUser) return;
        if (Array.isArray(ulist)) allUsers = ulist;
        applyCurrentUserUI();
        renderChatList();
        renderMessages({ deferIfVoice: true });
        updateTopbarTitle();
        updateFriendsBadge();
        renderContacts();
      } catch (e) {
        console.error("refreshUserDataFromServer", e);
      }
    }, 300);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (getToken() && currentUser && sessionBootstrapNeedsRetry) {
      void bootstrapData()
        .then(() => {
          try {
            if (!getToken() || !currentUser) return;
            applyCurrentUserUI();
            renderChatList();
            renderMessages({ deferIfVoice: true });
            updateTopbarTitle();
            updateFriendsBadge();
            renderContacts();
          } catch (e) {
            console.error("UI after visibility bootstrap", e);
          }
        })
        .catch((e) => console.error("bootstrap after visibility", e));
    }
    refreshUserDataFromServer();
  });
  window.addEventListener("focus", () => {
    refreshUserDataFromServer();
  });
  window.addEventListener("pageshow", (ev) => {
    if (ev.persisted && getToken()) {
      void (async () => {
        try {
          await bootstrapData();
          if (currentUser && !currentUser.verified) return;
          applyCurrentUserUI();
          renderChatList();
          renderMessages({ deferIfVoice: true });
          updateTopbarTitle();
          updateFriendsBadge();
          renderContacts();
        } catch (e) {
          console.error("pageshow bfcache restore", e);
        }
      })();
    }
  });
  window.addEventListener("online", () => {
    if (!getToken() || !sessionBootstrapNeedsRetry) return;
    void bootstrapData()
      .then(() => {
        try {
          applyCurrentUserUI();
          renderChatList();
          renderMessages({ deferIfVoice: true });
          updateTopbarTitle();
          updateFriendsBadge();
          renderContacts();
        } catch (e) {
          console.error("UI after reconnection", e);
        }
      })
      .catch((e) => console.error("bootstrap after online", e));
  });

  startWarmOpenChatPrefetch();

  (async () => {
    try {
      const verifyResult = await handleVerifyToken();
      if (verifyResult && verifyResult.ok) {
        if (currentUser) currentUser.verified = true;
      }

      await bootstrapData();
      allowUserDataRefetch = true;

      if (currentUser && !currentUser.verified) {
        showVerifyScreen(currentUser.email);
        return;
      }

      if (currentUser) {
        unlockNotificationAudio();
      }

      if (verifyResult && verifyResult.ok) {
        const hint = document.querySelector(".aton-auth-hint");
        if (hint) hint.textContent = t("Email подтверждён! Добро пожаловать.");
      }

      applyCurrentUserUI();
      renderContacts();
      renderChatList();
      renderMessages({ deferIfVoice: true });
      updateTopbarTitle();
    } catch (e) {
      console.error("Aton: init", e);
      if (root && !root.querySelector(".aton-shell")) {
        root.insertAdjacentHTML(
          "afterbegin",
          `<div class="aton-init-fatal" style="position:fixed;z-index:9999;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(2,6,23,0.95);color:#e5e7eb;font:14px/1.5 system-ui,sans-serif;text-align:center;max-width:100vw;box-sizing:border-box;"><div style="max-width:22rem">${escHtml(t("Не удалось запустить мессенджер. Обновите страницу (Ctrl+F5) или зайдите позже. Если снова так — откройте консоль (F12) и сделайте скриншот."))}</div></div>`
        );
      } else if (typeof showToast === "function") {
        showToast(t("Не удалось загрузить"));
      }
    }
  })();
}

window.addEventListener("DOMContentLoaded", createApp);

function openImageLightbox(src, gallery = [], startIndex = -1) {
  const existing = document.querySelector(".aton-image-lightbox");
  if (existing) existing.remove();
  const images = Array.isArray(gallery)
    ? gallery.map((url) => String(url || "")).filter(Boolean)
    : [];
  if (!images.includes(src)) images.unshift(src);
  const requestedIndex = Number.isInteger(startIndex) ? startIndex : -1;
  let currentIndex =
    requestedIndex >= 0 && requestedIndex < images.length ? requestedIndex : Math.max(0, images.indexOf(src));

  const overlay = document.createElement("div");
  overlay.className = "aton-image-lightbox";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "aton-image-lightbox-close";
  closeBtn.setAttribute("aria-label", t("Закрыть"));
  closeBtn.textContent = "×";
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "aton-image-lightbox-nav aton-image-lightbox-nav--prev";
  prevBtn.setAttribute("aria-label", t("Назад"));
  prevBtn.textContent = "‹";
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "aton-image-lightbox-nav aton-image-lightbox-nav--next";
  nextBtn.setAttribute("aria-label", t("Вперёд"));
  nextBtn.textContent = "›";
  const counter = document.createElement("div");
  counter.className = "aton-image-lightbox-counter";
  const img = document.createElement("img");
  const render = () => {
    img.src = images[currentIndex] || src;
    const hasMany = images.length > 1;
    prevBtn.hidden = !hasMany;
    nextBtn.hidden = !hasMany;
    counter.hidden = !hasMany;
    counter.textContent = hasMany ? `${currentIndex + 1} / ${images.length}` : "";
  };
  const step = (delta) => {
    if (images.length < 2) return;
    currentIndex = (currentIndex + delta + images.length) % images.length;
    render();
  };
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  };
  closeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    close();
  });
  prevBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    step(-1);
  });
  nextBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    step(1);
  });
  img.addEventListener("click", (event) => event.stopPropagation());
  render();
  overlay.appendChild(img);
  overlay.appendChild(prevBtn);
  overlay.appendChild(nextBtn);
  overlay.appendChild(counter);
  overlay.appendChild(closeBtn);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", onKeydown);
  document.body.appendChild(overlay);
}
