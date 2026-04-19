// Атон — фронтенд мессенджера, работающий с Node.js backend (server.js)

const TOKEN_KEY = "aton_token";

// Базовый URL API и WebSocket (один и тот же хост, что и Socket.io на бэкенде).
// 1) <meta name="aton-api-base" content="https://..."> — прод: фронт на хостинге, API на Render и т.п.
// 2) Иначе: тот же origin на :3000 — относительные URL.
// 3) Dev: фронт не на :3000 — подставляем :3000 на том же hostname.
function getApiBase() {
  const meta = document.querySelector('meta[name="aton-api-base"]')?.getAttribute("content")?.trim();
  if (meta) return meta.replace(/\/$/, "");
  const origin = window.location.origin;
  if (!origin) return "";
  if (origin.endsWith(":3000")) return "";
  return `${window.location.protocol}//${window.location.hostname}:3000`;
}

const API_BASE = getApiBase();

const socket = API_BASE
  ? io(API_BASE, { auth: { token: localStorage.getItem(TOKEN_KEY) || "" } })
  : io({ auth: { token: localStorage.getItem(TOKEN_KEY) || "" } });
const LOCAL_PINS_KEY = "aton_pinned_chats";
const LOCAL_READS_KEY = "aton_chat_reads";
const LAST_CHAT_KEY_PREFIX = "aton_last_chat_";

function chatIdForUsers(a, b) {
  const arr = [a, b].sort();
  return arr.join("|");
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

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
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

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Ошибка соединения с сервером");
    err.status = res.status;
    throw err;
  }
  return data;
}

async function fetchJsonPublic(path, options = {}) {
  const res = await fetch(API_BASE + path, { ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Ошибка соединения с сервером");
    err.status = res.status;
    throw err;
  }
  return data;
}

function createApp() {
  const root = document.getElementById("app");

  const shell = document.createElement("div");
  shell.className = "aton-shell";

  // === Сайдбар: логотип + авторизация ===
  const sidebar = document.createElement("div");
  sidebar.className = "aton-sidebar";

  sidebar.innerHTML = `
    <div class="aton-sidebar-header">
      <div class="aton-logo"><div class="aton-logo-inner"></div></div>
      <div class="aton-product-name">
        <div class="aton-title">АТОН</div>
        <div class="aton-subtitle">мессенджер под светом диска</div>
      </div>
    </div>
  `;

  const authRoot = document.createElement("div");
  authRoot.className = "aton-auth";

  const tabs = document.createElement("div");
  tabs.className = "aton-auth-tabs";
  const tabLogin = document.createElement("button");
  tabLogin.className = "aton-auth-tab active";
  tabLogin.textContent = "Вход";
  const tabRegister = document.createElement("button");
  tabRegister.className = "aton-auth-tab";
  tabRegister.textContent = "Регистрация";
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
      <label class="aton-input-label" for="aton-username">Имя пользователя</label>
      <input type="text" id="aton-username" class="aton-input" autocapitalize="off" autocomplete="username" spellcheck="false" />
    </div>
    <div class="aton-field-group" data-role="password">
      <label class="aton-input-label" for="aton-password">Пароль</label>
      <input type="password" id="aton-password" class="aton-input" autocomplete="current-password" />
    </div>
    <div class="aton-field-group" data-role="password-confirm">
      <label class="aton-input-label" for="aton-password-confirm">Повторите пароль</label>
      <input type="password" id="aton-password-confirm" class="aton-input" autocomplete="new-password" />
    </div>
    <button type="submit" class="aton-primary-button">Войти</button>
    <div class="aton-auth-hint" id="aton-auth-hint"></div>
    <div class="aton-auth-footer"><a href="forgot.html" class="aton-auth-link" id="aton-forgot">Забыли пароль?</a></div>
  `;

  const authLoginBlock = document.createElement("div");
  authLoginBlock.appendChild(tabs);
  authLoginBlock.appendChild(form);

  const authLoggedBlock = document.createElement("div");
  authLoggedBlock.className = "aton-auth-logged";
  authLoggedBlock.style.display = "none";
  authLoggedBlock.innerHTML = `
    <div class="aton-auth-logged-title">Вы в сети</div>
    <div class="aton-auth-logged-user" id="aton-logged-user"></div>
    <div class="aton-auth-logged-actions">
      <button type="button" class="aton-logout-button" id="aton-logout">Выйти</button>
    </div>
  `;

  authRoot.appendChild(authLoginBlock);
  authRoot.appendChild(authLoggedBlock);
  sidebar.appendChild(authRoot);

  // === Список чатов и профиль ===
  const chatsRoot = document.createElement("div");
  chatsRoot.className = "aton-chats";
  chatsRoot.innerHTML = `
    <div class="aton-chats-header">
      <span>Чаты</span>
    </div>
    <button class="aton-new-chat-button" id="aton-create-group" disabled style="display:none;">+ Группа</button>
    <div class="aton-search">
      <input type="text" class="aton-search-input" id="aton-user-search" placeholder="Найти пользователя по @username…" disabled />
      <div class="aton-search-results" id="aton-search-results"></div>
    </div>
    <div class="aton-chat-list" id="aton-chat-list"></div>
    <div class="aton-profile-link" id="aton-profile-link">
      Профиль: <span>настроить имя, статус и аватар</span>
    </div>
  `;

  sidebar.appendChild(chatsRoot);

  // === Основная часть: чат ===
  const main = document.createElement("div");
  main.className = "aton-main";

  const topbar = document.createElement("div");
  topbar.className = "aton-topbar";
  topbar.id = "aton-topbar";
  topbar.innerHTML = `
    <div class="aton-topbar-left">
      <div class="aton-topbar-title" id="aton-topbar-title">Атон</div>
      <div class="aton-topbar-status" id="aton-status">Войдите, чтобы открыть чаты</div>
    </div>
    <div class="aton-topbar-right">
      <button class="aton-topbar-icon" id="aton-filter-private" title="Личные диалоги">
        💬
        <span class="aton-topbar-icon-badge" id="aton-filter-private-badge"></span>
      </button>
      <button class="aton-topbar-icon" id="aton-filter-group" title="Группы и каналы">
        ☀
        <span class="aton-topbar-icon-badge" id="aton-filter-group-badge"></span>
      </button>
      <button class="aton-topbar-icon" id="aton-moderation" title="Модерация" style="display:none;">
        ⚖
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
    <textarea class="aton-compose-input" id="aton-input" rows="1" placeholder="Напишите сообщение…" disabled></textarea>
    <button class="aton-attach-button" id="aton-attach" title="Отправить фотографию" disabled>📎</button>
    <button class="aton-mic-button" id="aton-mic" title="Голосовое сообщение" disabled>🎙</button>
    <button class="aton-send-button" id="aton-send" disabled>ОТПРАВИТЬ</button>
    <input type="file" id="aton-attach-input" accept="image/*" style="display:none;" />
  `;

  chat.appendChild(messagesEl);
  chat.appendChild(compose);

  main.appendChild(topbar);
  main.appendChild(chat);

  shell.appendChild(sidebar);
  shell.appendChild(main);
  root.appendChild(shell);

  // === Состояние ===
  let authMode = "login";
  let currentUser = null;
  let allUsers = [];
  let allChats = [];
  let discoverChats = [];
  let allMessages = [];
  let reports = [];
  let contacts = { friends: [], blocked: [] };
  let chatFilter = "all"; // all | private | group
  let currentChatId = null; // глобального чата нет, по умолчанию ничего не выбрано
  let mediaRecorder = null;
  let recordedChunks = [];
  let replyToMessage = null;
  let typingTimeoutId = null;
  let openReactionPicker = null;
  let openChatMenu = null;
  let currentSocketChat = null;
  let hasOnboardingAutoFocused = false;
  let bootstrapVersion = 0;

  // Временный рендер контактов (пока UI для friends/blocked не реализован).
  // Оставляем функцию пустой, чтобы не было ошибок при вызовах.
  function renderContacts() {
    // no-op
  }

  function closeChatMenu() {
    if (openChatMenu) {
      openChatMenu.remove();
      openChatMenu = null;
    }
  }

  // Закрываем админское меню чатов при клике вне него
  document.addEventListener("click", (e) => {
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

  // Realtime обновление сообщений по WebSocket
  socket.on("message:new", (msg) => {
    if (!msg) return;
    // Если сообщение уже есть в истории, не дублируем
    if (allMessages.some((m) => m.id === msg.id)) return;
    try {
      const audio = new Audio("/notification.mp3");
      audio.play().catch(() => {});
    } catch (_) {}
    allMessages.push(msg);
    // Держим сообщения в хронологическом порядке
    allMessages.sort((a, b) => new Date(a.time) - new Date(b.time));
    // Список чатов должен обновляться всегда (для бейджей и порядка)
    renderChatList();
    // Перерисовываем сообщения только если это активный чат
    if (msg.chatId === currentChatId) {
      renderMessages();
    }
  });

  // При переподключении возвращаемся в активную комнату, если она есть
  socket.on("connect", () => {
    if (currentSocketChat) {
      socket.emit("join_chat", currentSocketChat);
      // После переподключения подгружаем актуальные сообщения активного чата,
      // чтобы не терять события, пришедшие во время оффлайна.
      api(`/api/messages?chatId=${encodeURIComponent(currentSocketChat)}`)
        .then((msgs) => {
          if (!Array.isArray(msgs)) return;
          // Мержим по id + пересортировка
          const byId = new Map(allMessages.map((m) => [m.id, m]));
          msgs.forEach((m) => {
            byId.set(m.id, m);
          });
          allMessages = Array.from(byId.values());
          allMessages.sort((a, b) => new Date(a.time) - new Date(b.time));
          renderChatList();
          if (currentChatId === currentSocketChat) {
            renderMessages();
          }
        })
        .catch(() => {
          // тихо игнорируем сетевые ошибки — UI не должен падать
        });
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

  function adjustComposeInputHeight() {
    if (!inputMessage || inputMessage.tagName !== "TEXTAREA") return;
    inputMessage.style.height = "auto";
    inputMessage.style.height = inputMessage.scrollHeight + "px";
  }
  const micButton = document.getElementById("aton-mic");
  const attachButton = document.getElementById("aton-attach");
  const attachInput = document.getElementById("aton-attach-input");
  const chatListEl = document.getElementById("aton-chat-list");
  const profileLink = document.getElementById("aton-profile-link");
  const searchInput = document.getElementById("aton-user-search");
  const searchResultsEl = document.getElementById("aton-search-results");
  const loggedUserLabel = document.getElementById("aton-logged-user");
  const logoutButton = document.getElementById("aton-logout");
  const createGroupButton = document.getElementById("aton-create-group");
  const forgotLink = document.getElementById("aton-forgot");
  const contactsEl = document.getElementById("aton-contacts");
  const filterPrivateBtn = document.getElementById("aton-filter-private");
  const filterGroupBtn = document.getElementById("aton-filter-group");
  const moderationButton = document.getElementById("aton-moderation");
  const filterPrivateBadge = document.getElementById("aton-filter-private-badge");
  const filterGroupBadge = document.getElementById("aton-filter-group-badge");

  // Индикатор «печатает…»
  const typingIndicator = document.createElement("div");
  typingIndicator.className = "aton-typing-indicator";
  typingIndicator.textContent = "Печатаете сообщение…";
  typingIndicator.style.display = "none";
  compose.insertBefore(typingIndicator, compose.firstChild);

  function setComposeEnabled(enabled) {
    inputMessage.disabled = !enabled;
    sendButton.disabled = !enabled;
    micButton.disabled = !enabled;
    attachButton.disabled = !enabled;
    if (enabled) {
      requestAnimationFrame(() => adjustComposeInputHeight());
    }
  }

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
      submitButton.textContent = "Войти";
      hintEl.textContent = "Введите email и пароль.";
      if (emailGroup) emailGroup.style.display = "block";
      if (passwordGroup) passwordGroup.style.display = "block";
      if (usernameGroup) usernameGroup.style.display = "none";
      if (passwordConfirmGroup) passwordConfirmGroup.style.display = "none";
      if (forgotLink && forgotLink.parentElement) forgotLink.parentElement.style.display = "block";
    } else {
      tabRegister.classList.add("active");
      tabLogin.classList.remove("active");
      submitButton.textContent = "Создать аккаунт";
      hintEl.textContent = "Имя, email и пароль не менее 6 символов.";
      if (emailGroup) emailGroup.style.display = "block";
      if (passwordGroup) passwordGroup.style.display = "block";
      if (usernameGroup) usernameGroup.style.display = "block";
      if (passwordConfirmGroup) passwordConfirmGroup.style.display = "block";
      if (forgotLink && forgotLink.parentElement) forgotLink.parentElement.style.display = "none";
    }
  }

  tabLogin.addEventListener("click", () => switchMode("login"));
  tabRegister.addEventListener("click", () => switchMode("register"));

  async function bootstrapData() {
    const version = ++bootstrapVersion;
    const tokenAtStart = getToken();

    if (!tokenAtStart) {
      // если это уже устаревший вызов — ничего не делаем
      if (version !== bootstrapVersion) return;
      currentUser = null;
      allUsers = [];
      allChats = [];
      discoverChats = [];
      allMessages = [];
      contacts = { friends: [], blocked: [] };
      currentChatId = null;
      return;
    }

    try {
      // Все независимые запросы — параллельно
      const [
        nextCurrentUser,
        nextAllUsers,
        nextAllChats,
        nextAllMessages,
        nextContacts,
        nextDiscover,
      ] = await Promise.all([
        api("/api/me"),
        api("/api/users"),
        api("/api/chats"),
        api("/api/messages/all"),
        api("/api/contacts").catch(() => ({ friends: [], blocked: [] })),
        api("/api/chats/discover").catch(() => []),
      ]);

      // если в это время начался более новый bootstrapData — не применяем результат
      if (version !== bootstrapVersion) return;

      currentUser = nextCurrentUser;
      currentUser.isSuperAdmin = resolveIsSuperAdmin(currentUser);
      allUsers = nextAllUsers;
      allChats = nextAllChats;
      discoverChats = Array.isArray(nextDiscover) ? nextDiscover : [];
      allMessages = nextAllMessages;
      contacts = nextContacts;

      // Важно: при загрузке НЕ выбираем чат автоматически.
      // currentChatId остаётся null, пока пользователь явно не кликнет по чату.
    } catch (err) {
      console.error(err);

      // если это устаревший вызов — игнорируем результат ошибки
      if (version !== bootstrapVersion) return;

      // Если токен невалиден (401) — очищаем токен и считаем пользователя гостем.
      if (
        err.status === 401 ||
        (err.message && err.message.includes("Неверный токен"))
      ) {
        // Защита: не очищаем токен, если он уже был заменён новым логином.
        if (getToken() === tokenAtStart) {
          setToken(null);
          currentUser = null;
          allUsers = [];
          allChats = [];
          discoverChats = [];
          allMessages = [];
          contacts = { friends: [], blocked: [] };
          currentChatId = null;
        }
      }
      // Для других ошибок оставляем текущее состояние.
    }
  }

  function applyCurrentUserUI() {
    const user = currentUser;
    if (!user) {
      authLoginBlock.style.display = "block";
      authLoggedBlock.style.display = "none";
      statusEl.textContent = "Войдите по форме слева";
      const tb = document.getElementById("aton-topbar");
      if (tb) tb.classList.add("aton-topbar--guest");
      userPill.style.display = "none";
      if (filterPrivateBtn) filterPrivateBtn.style.display = "none";
      if (filterGroupBtn) filterGroupBtn.style.display = "none";
      if (moderationButton) moderationButton.style.display = "none";
      setComposeEnabled(false);
      createGroupButton.disabled = true;
      createGroupButton.style.display = "none";
      searchInput.disabled = true;
      if (filterPrivateBtn) filterPrivateBtn.disabled = true;
      if (filterGroupBtn) filterGroupBtn.disabled = true;
      // Чаты и поле ввода сообщений скрыты до авторизации
      chatsRoot.style.display = "none";
      compose.style.display = "none";
      if (contactsEl) contactsEl.innerHTML = "";
    } else {
      hasOnboardingAutoFocused = false;
      authLoginBlock.style.display = "none";
      authLoggedBlock.style.display = "block";
      const tb = document.getElementById("aton-topbar");
      if (tb) tb.classList.remove("aton-topbar--guest");
      const full = allUsers.find((u) => u.username === user.username) || user;
      const displayName = full.displayName || full.username;
      const publicId = full.publicId || full.username;
      loggedUserLabel.textContent = `${displayName} · ID: @${publicId}`;
      const lastSeenIso = full.lastSeen;
      let isOnline = false;
      if (lastSeenIso) {
        const diff = Date.now() - new Date(lastSeenIso).getTime();
        isOnline = diff < 60 * 1000;
      }
      userPill.classList.toggle("online", isOnline);
      userPill.classList.toggle("offline", !isOnline);
      statusEl.textContent = isOnline
        ? `В сети как ${displayName}`
        : `Недавно были в сети как ${displayName}`;
      userPill.style.display = "inline-flex";
      if (filterPrivateBtn) filterPrivateBtn.style.display = "inline-flex";
      if (filterGroupBtn) filterGroupBtn.style.display = "inline-flex";
      if (moderationButton) {
        moderationButton.style.display = currentUser?.isSuperAdmin ? "inline-flex" : "none";
      }
      userNameLabel.textContent = displayName;
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
      if (filterPrivateBtn) filterPrivateBtn.disabled = false;
      if (filterGroupBtn) filterGroupBtn.disabled = false;
      typingIndicator.style.display = "none";
      chatsRoot.style.display = "flex";
      // Показываем низ только если уже выбран чат
      compose.style.display = currentChatId ? "flex" : "none";
    }
    shell.classList.toggle("aton-shell--guest-landing", !currentUser);
    shell.classList.toggle("aton-shell--no-chat", !currentChatId);
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
          hintEl.textContent = "Укажите email, имя и дважды один и тот же пароль.";
          return;
        }
        if (password.length < 6) {
          hintEl.textContent = "Пароль должен содержать не менее 6 символов.";
          return;
        }
        if (password !== passwordConfirm) {
          hintEl.textContent = "Пароли не совпадают. Введите их одинаково.";
          return;
        }
        data = await api("/api/register", {
          method: "POST",
          body: JSON.stringify({ email, username, password }),
        });
        hintEl.textContent = "Аккаунт создан. Проверьте почту для подтверждения.";
      } else {
        if (!email || !password) {
          hintEl.textContent = "Введите email и пароль.";
          return;
        }
        data = await api("/api/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        hintEl.textContent = "Вход выполнен.";
      }
      setToken(data.token);
      // Обновляем токен Socket.io и переподключаемся, чтобы сервер
      // мог аутентифицировать это соединение и проверять ACL в join_chat.
      socket.auth.token = data.token;
      socket.disconnect().connect();

      // Сохраняем пользователя сразу из ответа /login,
      // чтобы интерфейс работал даже если последующие запросы зафейлятся.
      if (data.user) {
        currentUser = data.user;
        currentUser.isSuperAdmin = resolveIsSuperAdmin(currentUser);
      }
      await bootstrapData();
      applyCurrentUserUI();
      renderChatList();
      renderMessages();
      updateTopbarTitle();
    } catch (err) {
      hintEl.textContent = err.message;
    }
  });

  // Ссылка "Забыли пароль?" ведёт на отдельную страницу forgot.html,
  // поэтому дополнительных обработчиков здесь не требуется.

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      setToken(null);
      // Сбрасываем токен сокета и переподключаемся как аноним
      socket.auth.token = "";
      socket.disconnect().connect();
      currentUser = null;
      allUsers = [];
      allChats = [];
      discoverChats = [];
      allMessages = [];
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
      info.textContent = "После входа здесь появятся ваши чаты.";
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

    const privateChatIds = new Set();
    allMessages.forEach((m) => {
      if (!m.to) return;
      const id = chatIdForUsers(m.from, m.to);
      if (m.from === current.username || m.to === current.username) {
        privateChatIds.add(id);
      }
    });

    const users = allUsers;

    // Учитываем пин и непрочитанные для групп
    const sortedChats = [...chats].sort((a, b) => {
      const aPinned = pins.has(a.id);
      const bPinned = pins.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return (a.title || "").localeCompare(b.title || "");
    });

    // Считаем непрочитанные для групп и приватных чатов для иконок в топбаре
    let groupUnreadTotal = 0;

    // Учитываем пин и непрочитанные для групп
    sortedChats.forEach((chatMeta) => {
      const chatMessages = allMessages
        .filter((m) => m.chatId === chatMeta.id)
        .sort((a, b) => new Date(a.time) - new Date(b.time));
      const lastMsg = chatMessages[chatMessages.length - 1];
      const unread = chatMessages.filter(
        (m) => !reads[chatMeta.id] || m.time > reads[chatMeta.id]
      ).length;
      const pinned = pins.has(chatMeta.id);
      groupUnreadTotal += unread;
      if (chatFilter === "private") {
        // В режиме «личные» группы скрываем
        return;
      }

      const openThisChat = () => {
        currentChatId = chatMeta.id;
        switchSocketChat(currentChatId);
        if (current.username) setLastChatId(current.username, currentChatId);
        const newReads = { ...reads, [chatMeta.id]: new Date().toISOString() };
        setChatReads(current.username, newReads);
        renderChatList();
        renderMessages();
        updateTopbarTitle();
      };

      const item = document.createElement("button");
      item.className =
        "aton-chat-item" + (currentChatId === chatMeta.id ? " active" : "");

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
        verifiedBadge.title = "Верифицировано";
        titleEl.appendChild(verifiedBadge);
      }

      // Пин всегда остаётся рядом с названием
      if (pinned) {
        const pinEl = document.createElement("span");
        pinEl.className = "aton-chat-pin";
        pinEl.textContent = "★";
        titleEl.appendChild(pinEl);
      }
      const subtitleEl = document.createElement("div");
      subtitleEl.className = "aton-chat-item-subtitle";
      const chatTypeLabel = chatMeta.type === "channel" ? "канал" : "группа";
      subtitleEl.textContent = `${chatTypeLabel} • создал ${chatMeta.owner}`;
      const previewEl = document.createElement("div");
      previewEl.className = "aton-chat-item-subtitle";
      if (lastMsg) {
        let preview = "";
        if (lastMsg.type === "image") preview = "📷 Фото";
        else if (lastMsg.type === "audio") preview = "🎙 Голосовое сообщение";
        if (lastMsg.text) {
          preview = (preview ? preview + " · " : "") + lastMsg.text;
        }
        previewEl.textContent =
          preview || "Сообщение без текста";
      } else {
        previewEl.textContent = "Нет сообщений";
      }
      main.appendChild(titleEl);
      main.appendChild(subtitleEl);
      main.appendChild(previewEl);

      const metaWrap = document.createElement("div");
      metaWrap.className = "aton-chat-meta";
      const timeEl = document.createElement("div");
      timeEl.className = "aton-chat-time";
      timeEl.textContent = lastMsg ? formatTimeLabel(lastMsg.time) : "";
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
      menuBtn.title = "Действия";
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
            label: "Открыть",
            onClick: () => openThisChat(),
          })
        );

        // Жалоба (для обычного пользователя)
        if (!isSuperAdmin) {
          dropdown.appendChild(
            createMenuItem({
              label: "Пожаловаться",
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
                    showToast("Жалоба отправлена");
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
                label: "Скопировать ссылку приглашения",
                onClick: async () => {
                  const url = `${window.location.origin}/join/${inviteTok}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    showToast("Ссылка скопирована");
                  } catch {
                    window.prompt("Скопируйте ссылку:", url);
                  }
                },
              })
            );
          }
          dropdown.appendChild(
            createMenuItem({
              label: "Участники",
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
                  <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Участники</div>
                  <div style="font-size:11px;color:#9ca3af;margin-bottom:12px;">
                    Добавляйте по @username. Создателя нельзя удалить.
                  </div>

                  <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
                    <input id="aton-member-add-username" type="text" class="aton-input" placeholder="@username" style="flex:1;margin:0;" />
                    <button type="button" id="aton-member-add-btn" class="aton-primary-button" style="margin-top:0;padding-inline:12px;">Добавить</button>
                  </div>

                  <div style="max-height:220px;overflow:auto;border:1px solid rgba(55,65,81,0.9);border-radius:12px;padding:8px;margin-bottom:12px;">
                    <div id="aton-members-list" style="display:flex;flex-direction:column;gap:6px;"></div>
                  </div>

                  <div style="display:flex;justify-content:space-between;gap:10px;">
                    <button type="button" id="aton-member-delete-btn" class="aton-new-chat-button" style="padding-inline:14px;">Удалить</button>
                    <button type="button" id="aton-member-close-btn" class="aton-new-chat-button" style="padding-inline:14px;">Закрыть</button>
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
                            ${escHtml(name)}${isOwnerRow ? " (создатель)" : ""}
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
                  if (!raw) return alert("Введите @username");
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
                  if (!selectedUserId) return alert("Выберите участника");
                  if (ownerId && String(selectedUserId) === String(ownerId)) {
                    return alert("Нельзя удалить создателя чата");
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
          if (!confirm(moderation ? "Удалить (модерация) этот чат и его сообщения?" : "Удалить эту группу и её сообщения?")) return;
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
              label: "Удалить",
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

    // Если нет ни одной группы и ни одного приватного диалога — показываем пустое состояние
    if (sortedChats.length === 0 && privateChatIds.size === 0) {
      const empty = document.createElement("div");
      empty.className = "aton-chat-onboarding";
      empty.innerHTML = `
        <div class="aton-chat-onboarding-card">
          <div class="aton-chat-onboarding-title">Начните первый диалог</div>
          <div class="aton-chat-onboarding-desc">
            Найдите пользователя по @username или создайте группу, чтобы начать общение.
            Все ваши диалоги появятся здесь.
          </div>
          <div class="aton-chat-onboarding-actions">
            <button type="button" class="aton-onboarding-cta aton-onboarding-cta-primary">Найти пользователя</button>
            <button type="button" class="aton-onboarding-cta aton-onboarding-cta-secondary">Создать группу</button>
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
      return;
    }

    // Приватные
    const privateIdsSorted = Array.from(privateChatIds).sort();
    let privateUnreadTotal = 0;
    privateIdsSorted.forEach((id) => {
      const [a, b] = id.split("|");
      const peer = a === current.username ? b : a;
      const peerUser = users.find((u) => u.username === peer);
      const title = peerUser?.displayName || peer;
      const chatMessages = allMessages
        .filter((m) => m.chatId === id)
        .sort((a, b) => new Date(a.time) - new Date(b.time));
      const lastMsg = chatMessages[chatMessages.length - 1];
      const subtitle = "приватный чат";
      const unread = chatMessages.filter(
        (m) => !reads[id] || m.time > reads[id]
      ).length;
      const pinned = pins.has(id);
      let peerOnline = false;
      if (peerUser && peerUser.lastSeen) {
        const diff = Date.now() - new Date(peerUser.lastSeen).getTime();
        peerOnline = diff < 60 * 1000;
      }
      privateUnreadTotal += unread;
      if (chatFilter === "group") {
        // В режиме «группы» личные чаты скрываем
        return;
      }

      const item = document.createElement("button");
      item.className = "aton-chat-item" + (currentChatId === id ? " active" : "");

      const avatar = document.createElement("div");
      avatar.className = "aton-chat-avatar";
      if (peerUser?.avatarDataUrl) {
        const img = document.createElement("img");
        img.src = peerUser.avatarDataUrl;
        avatar.appendChild(img);
      } else {
        avatar.textContent = (title || peer).slice(0, 1).toUpperCase();
      }

      const main = document.createElement("div");
      main.className = "aton-chat-item-main";
      const titleEl = document.createElement("div");
      titleEl.className = "aton-chat-item-title";
      titleEl.textContent = title;
      if (pinned) {
        const pinSpan = document.createElement("span");
        pinSpan.className = "aton-chat-pin";
        pinSpan.textContent = "★";
        titleEl.appendChild(pinSpan);
      }
      const subtitleEl = document.createElement("div");
      subtitleEl.className = "aton-chat-item-subtitle";
      const onlineDot = document.createElement("span");
      onlineDot.className = `aton-chat-online-dot ${peerOnline ? "online" : "offline"}`;
      subtitleEl.appendChild(onlineDot);
      subtitleEl.appendChild(document.createTextNode(`@${peer} • ${subtitle}`));
      const previewEl = document.createElement("div");
      previewEl.className = "aton-chat-item-subtitle";
      if (lastMsg) {
        let preview = "";
        if (lastMsg.type === "image") preview = "📷 Фото";
        else if (lastMsg.type === "audio") preview = "🎙 Голосовое сообщение";
        if (lastMsg.text) {
          preview = (preview ? preview + " · " : "") + lastMsg.text;
        }
        previewEl.textContent =
          preview || "Сообщение без текста";
      } else {
        previewEl.textContent = "Нет сообщений";
      }
      main.appendChild(titleEl);
      main.appendChild(subtitleEl);
      main.appendChild(previewEl);

      const metaWrap = document.createElement("div");
      metaWrap.className = "aton-chat-meta";
      const timeEl = document.createElement("div");
      timeEl.className = "aton-chat-time";
      timeEl.textContent = lastMsg ? formatTimeLabel(lastMsg.time) : "";
      metaWrap.appendChild(timeEl);
      if (unread) {
        const badge = document.createElement("div");
        badge.className = "aton-chat-unread-badge";
        badge.textContent = Math.min(unread, 99);
        metaWrap.appendChild(badge);
      }

      item.appendChild(avatar);
      item.appendChild(main);
      item.appendChild(metaWrap);
      item.addEventListener("click", () => {
        currentChatId = id;
        switchSocketChat(currentChatId);
        if (current.username) setLastChatId(current.username, currentChatId);
        const newReads = { ...reads, [id]: new Date().toISOString() };
        setChatReads(current.username, newReads);
        renderChatList();
        renderMessages();
        updateTopbarTitle();
      });
      chatListEl.appendChild(item);
    });

    // Обновляем бейджи на иконках в топбаре
    if (filterPrivateBadge) {
      filterPrivateBadge.textContent = privateUnreadTotal > 0 ? privateUnreadTotal : "";
    }
    if (filterGroupBadge) {
      filterGroupBadge.textContent = groupUnreadTotal > 0 ? groupUnreadTotal : "";
    }
  }

  function renderPublicLandingState(container) {
    container.innerHTML = `
      <div class="aton-empty-state aton-empty-state--landing">
        <div class="aton-landing-sun" aria-hidden="true"></div>
        <p class="aton-empty-kicker">Под солнцем Ахетатона</p>
        <h2 class="aton-empty-title">Спокойные диалоги — без лишнего шума</h2>
        <p class="aton-empty-lead">
          Личные и групповые чаты в сдержанном интерфейсе. Меньше отвлечений — больше смысла в переписке.
        </p>
      </div>
    `;
  }

  function renderEmptyState(container) {
    container.innerHTML = `
      <div class="aton-empty-state aton-empty-state--pick">
        <h2 class="aton-empty-title">Выберите чат</h2>
        <p class="aton-empty-lead">
          Откройте диалог слева или найдите пользователя по @username.
        </p>
      </div>
    `;
  }

  function renderEmptyChatState(container) {
    container.innerHTML = `
      <div class="aton-empty-state">
        <div class="aton-empty-title">В этом чате пока нет сообщений</div>
        <div class="aton-empty-subtitle">Напишите первое сообщение, чтобы начать диалог.</div>
        <div class="aton-empty-meta">Ваше первое сообщение задаст тон разговору.</div>
      </div>
    `;
  }

  function renderJoinChatState(container, chatPreview) {
    const title = chatPreview?.title || "Чат";
    const isVerified = Boolean(chatPreview?.verified);
    const canSelfJoin = Boolean(chatPreview);

    const chatType =
      typeof currentChatId === "string" && currentChatId.startsWith("channel:")
        ? "канал"
        : "группа";

    // — приватный чат без права самостоятельного вступления —
    if (!canSelfJoin) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 24px;text-align:center;gap:14px;">
          <div style="width:60px;height:60px;border-radius:999px;background:rgba(15,23,42,0.7);border:1px solid rgba(55,65,81,0.9);display:flex;align-items:center;justify-content:center;font-size:26px;color:#64748b;">🔒</div>
          <div style="font-size:18px;font-weight:600;color:#e5e7eb;">${escHtml(title)}</div>
          <div style="font-size:11px;background:rgba(148,163,184,0.1);color:#94a3b8;padding:2px 10px;border-radius:999px;border:1px solid rgba(148,163,184,0.2);">приватный ${escHtml(chatType)}</div>
          <div style="font-size:12px;color:#64748b;max-width:300px;line-height:1.6;">
            Чат закрытый. Попросите администратора выслать вам ссылку-приглашение.
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
      if (sameDay) return "создан сегодня";
      return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    }

    // Последнее сообщение: "N минут назад" / "вчера" / дата
    function fmtActivity(iso) {
      if (!iso) return null;
      const d = new Date(iso);
      if (isNaN(d)) return null;
      const diff = Date.now() - d.getTime();
      if (diff < 60_000) return "только что";
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин. назад`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ч. назад`;
      if (diff < 2 * 86_400_000) return "вчера";
      return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
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
        <div style="font-size:10px;background:rgba(56,189,248,0.08);color:#38bdf8;padding:2px 10px;border-radius:999px;border:1px solid rgba(56,189,248,0.2);margin-bottom:18px;">публичный ${escHtml(chatType)}</div>

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
            ${memberCount === 1 ? "участник" : memberCount >= 2 && memberCount <= 4 ? "участника" : "участников"}
            ${createdLabel ? `· <span style="color:#475569;">${escHtml(createdLabel)}</span>` : ""}
          </div>
        </div>

        <!-- Последнее сообщение -->
        ${lastMsg ? `
        <div style="max-width:360px;width:100%;padding:8px 12px;background:rgba(15,23,42,0.45);border:1px solid rgba(55,65,81,0.5);border-radius:10px;margin-bottom:20px;text-align:left;">
          <div style="font-size:10px;color:#475569;margin-bottom:3px;">Последнее сообщение ${activityLabel ? `· ${escHtml(activityLabel)}` : ""}</div>
          <div style="font-size:12px;color:#94a3b8;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(lastMsg)}</div>
        </div>` : `
        <div style="font-size:12px;color:#475569;margin-bottom:20px;">Сообщений пока нет</div>`}

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
        ">Вступить в ${escHtml(chatType)}</button>
        <div style="font-size:11px;color:#475569;margin-top:8px;">Вы сможете читать и отправлять сообщения</div>

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
      joinBtn.textContent = "Вступаем…";
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
        showToast("Вы вступили в чат");
      } catch (err) {
        joinBtn.disabled = false;
        joinBtn.textContent = `Вступить в ${chatType}`;
        joinBtn.style.opacity = "";
        alert(err.message);
      }
    });
  }

  function renderMessages() {
    messagesEl.innerHTML = "";
    const current = currentUser;
    shell.classList.toggle("aton-shell--guest-landing", !current);
    shell.classList.toggle("aton-shell--no-chat", !currentChatId);

    if (!current) {
      renderPublicLandingState(messagesEl);
      setComposeEnabled(false);
      compose.style.display = "none";
      return;
    }
    if (!currentChatId) {
      renderEmptyState(messagesEl);
      setComposeEnabled(false);
      compose.style.display = "none";
      return;
    }

    // Для групп/каналов: если чата нет в allChats, пользователь не участник.
    if (currentChatId.startsWith("group:") || currentChatId.startsWith("channel:")) {
      const joinedChat = allChats.find((c) => c.id === currentChatId);
      if (!joinedChat) {
        const preview = discoverChats.find((c) => c.id === currentChatId) || null;
        renderJoinChatState(messagesEl, preview);
        setComposeEnabled(false);
        compose.style.display = "none";
        return;
      }
    }

    const user = currentUser;
    const filtered = allMessages.filter((msg) => {
      if (!user) return false;
      if (currentChatId.startsWith("group:")) return msg.chatId === currentChatId;
      return msg.chatId === currentChatId;
    });

    if (!filtered.length) {
      renderEmptyChatState(messagesEl);
      setComposeEnabled(true);
      compose.style.display = "flex";
      return;
    }

    const users = allUsers;

    // Обновляем признак «прочитано до» для активного чата
    const reads = getChatReads(current.username);
    if (currentChatId) {
      const updatedReads = { ...reads, [currentChatId]: new Date().toISOString() };
      setChatReads(current.username, updatedReads);
    }

    filtered.forEach((msg) => {
      const row = document.createElement("div");
      row.className =
        "aton-message-row" + (current && current.username === msg.from ? " self" : "");

      const inner = document.createElement("div");
      inner.className = "aton-message-inner";

      const avatarWrap = document.createElement("div");
      avatarWrap.className = "aton-message-avatar";
      const author = users.find((u) => u.username === msg.from);
      if (author?.avatarDataUrl) {
        const img = document.createElement("img");
        img.src = author.avatarDataUrl;
        avatarWrap.appendChild(img);
      }

      const bubble = document.createElement("div");
      bubble.className =
        "aton-message-bubble aton-message-bubble-enter" +
        (current && current.username === msg.from ? " self" : "");
      const text = document.createElement("div");
      if (msg.type === "audio" && msg.audioDataUrl) {
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = msg.audioDataUrl;
        audio.style.maxWidth = "220px";
        text.appendChild(audio);
      } else if (msg.type === "image" && msg.imageDataUrl) {
        const img = document.createElement("img");
        img.src = msg.imageDataUrl;
        img.className = "aton-message-image";
        img.addEventListener("click", () => {
          openImageLightbox(msg.imageDataUrl);
        });
        text.appendChild(img);
      }
      if (msg.text) {
        const textNode = document.createElement("div");
        textNode.textContent = msg.text;
        text.appendChild(textNode);
      }
      if (msg.replyTo) {
        const replied = filtered.find((m) => m.id === msg.replyTo);
        if (replied) {
          const replyPreview = document.createElement("div");
          replyPreview.className = "aton-message-reply-preview";
          replyPreview.textContent = `${replied.from}: ${replied.text.slice(0, 60)}${
            replied.text.length > 60 ? "…" : ""
          }`;
          bubble.appendChild(replyPreview);
        }
      }
      const meta = document.createElement("div");
      meta.className = "aton-message-meta";
      const timeLabel = formatTimeLabel(msg.time);
      const editedLabel = msg.editedAt ? " • изменено" : "";
      const pinnedLabel = msg.pinned ? " • закреплено" : "";

      const canAdmin = current && current.isSuperAdmin === true;
      const authorIsVerified = Boolean(author && author.isVerified);
      const leftWrap = document.createElement("div");
      leftWrap.style.display = "inline-flex";
      leftWrap.style.alignItems = "center";
      leftWrap.style.gap = "6px";
      leftWrap.textContent = msg.from;

      if (canAdmin && author && author.id) {
        const verifyUserBtn = document.createElement("button");
        verifyUserBtn.type = "button";
        verifyUserBtn.className = "aton-user-verify-button";
        verifyUserBtn.textContent = authorIsVerified ? "✓" : "⋮";
        verifyUserBtn.title = authorIsVerified
          ? "Пользователь верифицирован"
          : "Верифицировать пользователя";
        verifyUserBtn.disabled = authorIsVerified;
        verifyUserBtn.addEventListener("click", async (event) => {
          event.stopPropagation();
          if (verifyUserBtn.disabled) return;
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
        leftWrap.appendChild(verifyUserBtn);
      }

      const rightWrap = document.createElement("div");
      rightWrap.textContent = `${timeLabel}${editedLabel}${pinnedLabel}`;

      meta.appendChild(leftWrap);
      meta.appendChild(rightWrap);
      bubble.appendChild(text);
      bubble.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "aton-message-actions";

      const reactBtn = document.createElement("button");
      reactBtn.className = "aton-message-action-button";
      reactBtn.textContent = "😊";
      reactBtn.title = "Оставить реакцию";
      reactBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (openReactionPicker) {
          openReactionPicker.remove();
          openReactionPicker = null;
        }
        const picker = document.createElement("div");
        picker.className = "aton-reaction-picker";
        const emojis = ["👍", "✨", "😊", "🔥", "❤️"];
        emojis.forEach((emoji) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "aton-reaction-picker-item";
          btn.textContent = emoji;
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            try {
              const updated = await api(`/api/messages/${msg.id}/react`, {
                method: "POST",
                body: JSON.stringify({ emoji }),
              });
              allMessages = allMessages.map((m) =>
                m.id === updated.id ? updated : m
              );
              if (openReactionPicker) {
                openReactionPicker.remove();
                openReactionPicker = null;
              }
              renderMessages();
            } catch (err) {
              alert(err.message);
            }
          });
          picker.appendChild(btn);
        });
        const rect = reactBtn.getBoundingClientRect();
        picker.style.position = "fixed";
        picker.style.top = `${rect.bottom + 6}px`;
        picker.style.left = `${rect.left}px`;
        document.body.appendChild(picker);
        openReactionPicker = picker;
      });
      actions.appendChild(reactBtn);

      const replyBtn = document.createElement("button");
      replyBtn.className = "aton-message-action-button";
      replyBtn.textContent = "↩";
      replyBtn.title = "Ответить";
      replyBtn.addEventListener("click", () => {
        replyToMessage = msg;
        typingIndicator.textContent = `Ответ на сообщение от ${msg.from}…`;
        typingIndicator.style.display = "block";
        inputMessage.focus();
      });
      actions.appendChild(replyBtn);

      if (current && msg.from === current.username) {
        const editBtn = document.createElement("button");
        editBtn.className = "aton-message-action-button";
        editBtn.textContent = "✎";
        editBtn.title = "Редактировать";
        editBtn.addEventListener("click", async () => {
          const nextText = prompt("Измените текст сообщения:", msg.text || "");
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
        pinBtn.title = msg.pinned ? "Снять закрепление" : "Закрепить сообщение";
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
        delBtn.title = "Удалить сообщение";
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

      // Панель с реакциями, если есть
      if (Array.isArray(msg.reactions) && msg.reactions.length > 0) {
        const reactionsBar = document.createElement("div");
        reactionsBar.className = "aton-message-reactions";
        const counts = {};
        msg.reactions.forEach((r) => {
          counts[r.emoji] = (counts[r.emoji] || 0) + 1;
        });
        Object.entries(counts).forEach(([emoji, count]) => {
          const pill = document.createElement("span");
          pill.className = "aton-reaction-pill";
          pill.textContent = `${emoji} ${count}`;
          reactionsBar.appendChild(pill);
        });
        bubble.appendChild(reactionsBar);
      }

      meta.appendChild(actions);

      inner.appendChild(avatarWrap);
      inner.appendChild(bubble);
      row.appendChild(inner);
      messagesEl.appendChild(row);
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
    // Для выбранного чата показываем поле ввода
    setComposeEnabled(true);
    compose.style.display = "flex";
  }

  sendButton.addEventListener("click", () => {
    const user = currentUser;
    if (!user || !currentChatId) return;
    const text = inputMessage.value.trim();
    if (!text) return;
    // Защита от двойного клика
    if (sendButton.dataset.sending === "1") return;

    const peer = currentChatPeer();
    if (peer && contacts.blocked.some((u) => u.username === peer)) {
      alert("Вы заблокировали этого пользователя. Разблокируйте его в контактах, чтобы писать.");
      return;
    }

    const to = currentChatId.startsWith("group:") ? null : currentChatPeer();
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
    };
    allMessages.push(tempMsg);
    inputMessage.value = "";
    adjustComposeInputHeight();
    replyToMessage = null;
    typingIndicator.style.display = "none";
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
    if (!replyToMessage) {
      typingIndicator.textContent = "Печатаете сообщение…";
    }
    typingIndicator.style.display = inputMessage.value.trim() || event.key !== "Enter"
      ? "block"
      : "none";
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
    if (!user || !currentChatId) return;
    const file = attachInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const imageDataUrl = reader.result;
      try {
        const to = currentChatId.startsWith("group:") ? null : currentChatPeer();
        const chatId = currentChatId;
        const msg = await api("/api/messages", {
          method: "POST",
          body: JSON.stringify({ chatId, type: "image", imageDataUrl, to }),
        });
        allMessages.push(msg);
        attachInput.value = "";
        renderMessages();
        renderChatList();
      } catch (err) {
        alert(err.message);
      }
    };
    reader.readAsDataURL(file);
  });

  // Поиск пользователя
  async function handleUserSearch() {
    const current = currentUser;
    const q = searchInput.value.trim().toLowerCase();
    searchResultsEl.innerHTML = "";
    if (!current || !q) return;

    const users = allUsers.filter(
      (u) => u.username !== current.username && u.username.toLowerCase().includes(q),
    );

    if (users.length) {
      const usersTitle = document.createElement("div");
      usersTitle.className = "aton-search-item";
      usersTitle.style.fontSize = "10px";
      usersTitle.style.opacity = "0.75";
      usersTitle.style.cursor = "default";
      usersTitle.textContent = "Пользователи";
      searchResultsEl.appendChild(usersTitle);
    }

    users.forEach((u) => {
      const item = document.createElement("div");
      item.className = "aton-search-item";
      const isFriend = contacts.friends.some((f) => f.username === u.username);
      const isBlocked = contacts.blocked.some((b) => b.username === u.username);
      item.innerHTML = `
        <div class="aton-search-main">
          ${escHtml(u.displayName || u.username)} <span>@${escHtml(u.username)}</span>
        </div>
        <div class="aton-search-actions">
          <button type="button" class="aton-search-action aton-search-add">${
            isFriend ? "В друзьях" : "В друзья"
          }</button>
          <button type="button" class="aton-search-action aton-search-block">${
            isBlocked ? "Разблок." : "Блок"
          }</button>
        </div>
      `;
      const main = item.querySelector(".aton-search-main");
      const addBtn = item.querySelector(".aton-search-add");
      const blockBtn = item.querySelector(".aton-search-block");

      main.addEventListener("click", () => {
        currentChatId = chatIdForUsers(current.username, u.username);
        switchSocketChat(currentChatId);
        if (current.username) setLastChatId(current.username, currentChatId);
        searchInput.value = "";
        searchResultsEl.innerHTML = "";
        renderChatList();
        renderMessages();
        updateTopbarTitle();
      });

      addBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (contacts.friends.some((f) => f.username === u.username)) return;
        try {
          await api("/api/contacts/add", {
            method: "POST",
            body: JSON.stringify({ username: u.username }),
          });
          contacts = await api("/api/contacts");
          renderContacts();
          renderChatList();
          handleUserSearch();
        } catch (err) {
          alert(err.message);
        }
        // Обновляем header, чтобы badge от verified появился сразу
        updateTopbarTitle();
      });

      blockBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const blocked = contacts.blocked.some((b) => b.username === u.username);
        const url = blocked ? "/api/contacts/unblock" : "/api/contacts/block";
        try {
          await api(url, {
            method: "POST",
            body: JSON.stringify({ username: u.username }),
          });
          contacts = await api("/api/contacts");
          renderContacts();
          renderChatList();
          handleUserSearch();
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
      myChatsTitle.className = "aton-search-item";
      myChatsTitle.style.fontSize = "10px";
      myChatsTitle.style.opacity = "0.75";
      myChatsTitle.style.cursor = "default";
      myChatsTitle.style.marginTop = users.length ? "6px" : "0";
      myChatsTitle.textContent = "Мои чаты";
      searchResultsEl.appendChild(myChatsTitle);
    }

    myChatsFound.forEach((chat) => {
      const item = document.createElement("div");
      item.className = "aton-search-item";
      const typeLabel = chat.type === "channel" ? "канал" : "группа";
      item.innerHTML = `
        <div class="aton-search-main" style="cursor:pointer;">
          ${escHtml(chat.title)}${chat.verified ? ' <span style="color:#38bdf8;">✔</span>' : ""}
          <span style="font-size:9px;background:rgba(56,189,248,0.15);color:#38bdf8;padding:1px 5px;border-radius:6px;margin-left:4px;">${escHtml(typeLabel)}</span>
        </div>
      `;
      const main = item.querySelector(".aton-search-main");
      main.addEventListener("click", () => {
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
      chatsTitle.className = "aton-search-item";
      chatsTitle.style.fontSize = "10px";
      chatsTitle.style.opacity = "0.75";
      chatsTitle.style.cursor = "default";
      chatsTitle.style.marginTop = (users.length || myChatsFound.length) ? "6px" : "0";
      chatsTitle.textContent = "Рекомендуемые чаты";
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
          <span style="font-size:9px;background:rgba(148,163,184,0.12);color:#94a3b8;padding:1px 5px;border-radius:6px;margin-left:4px;white-space:nowrap;">не участник</span>
        </div>
        <div class="aton-search-actions">
          <button type="button" class="aton-search-action aton-search-join">Вступить</button>
        </div>
      `;
      const main = item.querySelector(".aton-search-main");
      const joinBtn = item.querySelector(".aton-search-join");

      // Клик по названию — открывает превью, НЕ добавляет в список чатов
      main.addEventListener("click", () => {
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
          currentChatId = chat.id;
          switchSocketChat(currentChatId);
          if (current.username) setLastChatId(current.username, currentChatId);
          searchInput.value = "";
          searchResultsEl.innerHTML = "";
          renderChatList();
          renderMessages();
          updateTopbarTitle();
          showToast("Вы вступили в чат");
        } catch (err) {
          joinBtn.disabled = false;
          joinBtn.textContent = "Вступить";
          alert(err.message);
        }
      });

      searchResultsEl.appendChild(item);
    });
  }

  searchInput.addEventListener("input", handleUserSearch);

  // Создание групп
  if (createGroupButton) {
    createGroupButton.addEventListener("click", () => {
      const current = currentUser;
      if (!current) {
        alert("Сначала войдите или зарегистрируйтесь, чтобы создавать группы.");
        return;
      }

      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(15,23,42,0.7)";
      overlay.style.backdropFilter = "blur(10px)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "60";

      const modal = document.createElement("div");
      modal.style.background = "rgba(15,23,42,0.98)";
      modal.style.borderRadius = "16px";
      modal.style.border = "1px solid rgba(148,163,184,0.7)";
      modal.style.padding = "16px 18px 14px";
      modal.style.width = "280px";
      modal.style.color = "#e5e7eb";
      modal.innerHTML = `
        <div style="font-size:14px;font-weight:500;margin-bottom:6px;">Новый чат</div>
        <div style="font-size:11px;color:#9ca3af;margin-bottom:8px;">Выберите тип и введите название.</div>
        <label class="aton-input-label">Тип</label>
        <select id="aton-group-type" class="aton-input" style="margin-bottom:6px;">
          <option value="group">Группа</option>
          <option value="channel">Канал</option>
        </select>
        <label class="aton-input-label">Доступ</label>
        <select id="aton-group-visibility" class="aton-input" style="margin-bottom:6px;">
          <option value="public">Публичный</option>
          <option value="private">Приватный</option>
        </select>
        <input type="text" id="aton-group-title" class="aton-input" placeholder="Например: «Песни о Фивах»" />
        <label class="aton-input-label" style="margin-top:6px;">Описание <span style="color:#475569;font-weight:400;">(необязательно)</span></label>
        <textarea id="aton-group-desc" class="aton-input" rows="2" placeholder="О чём этот чат?" style="resize:none;font-size:12px;line-height:1.5;padding:7px 10px;"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
          <button type="button" id="aton-group-cancel" class="aton-new-chat-button">Отмена</button>
          <button type="button" id="aton-group-create" class="aton-primary-button" style="margin-top:0;padding-inline:14px;">Создать</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const titleInput = modal.querySelector("#aton-group-title");
      const descInput = modal.querySelector("#aton-group-desc");
      const typeInput = modal.querySelector("#aton-group-type");
      const visibilityInput = modal.querySelector("#aton-group-visibility");
      const cancelBtn = modal.querySelector("#aton-group-cancel");
      const createBtn = modal.querySelector("#aton-group-create");
      titleInput.focus();

      cancelBtn.addEventListener("click", () => overlay.remove());

      createBtn.addEventListener("click", async () => {
        const title = titleInput.value.trim();
        if (!title) return;
        const description = descInput.value.trim() || null;
        const type = typeInput.value === "channel" ? "channel" : "group";
        const visibility =
          visibilityInput && visibilityInput.value === "private"
            ? "private"
            : "public";
        try {
          const chat = await api("/api/chats", {
            method: "POST",
            body: JSON.stringify({ title, type, visibility, description }),
          });
          allChats.push(chat);
          currentChatId = chat.id;
          switchSocketChat(currentChatId);
          if (current.username) setLastChatId(current.username, currentChatId);
          overlay.remove();
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
  async function openProfileModal() {
    if (!currentUser) {
      alert("Сначала войдите или зарегистрируйтесь.");
      return;
    }
    const user = allUsers.find((u) => u.username === currentUser.username) || currentUser;

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(15,23,42,0.8)";
    overlay.style.backdropFilter = "blur(12px)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "50";

    const modal = document.createElement("div");
    modal.style.background = "rgba(15,23,42,0.98)";
    modal.style.borderRadius = "18px";
    modal.style.border = "1px solid rgba(148,163,184,0.7)";
    modal.style.padding = "18px 20px 16px";
    modal.style.width = "320px";
    modal.style.color = "#e5e7eb";
    modal.innerHTML = `
      <div style="font-size:14px;font-weight:500;margin-bottom:8px;">Профиль пользователя</div>
      <div style="font-size:11px;color:#9ca3af;margin-bottom:10px;">Настройте, как вы выглядите в Атоне.</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:40px;height:40px;border-radius:999px;overflow:hidden;background:#020617;border:1px solid rgba(55,65,81,0.9);flex-shrink:0;">
          <img id="aton-profile-avatar-preview" src="${
            user.avatarDataUrl || ""
          }" style="width:100%;height:100%;object-fit:cover;display:${
            user.avatarDataUrl ? "block" : "none"
          };" />
        </div>
        <label style="font-size:11px;cursor:pointer;color:#38bdf8;">
          Загрузить аватар
          <input type="file" id="aton-profile-avatar" accept="image/*" style="display:none;" />
        </label>
      </div>
      <label class="aton-input-label">Отображаемое имя</label>
      <input type="text" id="aton-profile-name" class="aton-input" style="margin-bottom:6px;" />
      <label class="aton-input-label">Статус</label>
      <input type="text" id="aton-profile-bio" class="aton-input" placeholder="Например: «Пишу при свете Атена»" />
      <label class="aton-input-label" style="margin-top:6px;">ID профиля</label>
      <input type="text" id="aton-profile-public-id" class="aton-input" placeholder="Удобный ID, по которому вас можно найти (@id)" />
      <div style="font-size:10px;color:#6b7280;margin-top:2px;">ID может содержать латинские буквы, цифры, подчёркивание и дефис (3–32 символа). Должен быть уникальным.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
        <button id="aton-profile-cancel" class="aton-new-chat-button">Отмена</button>
        <button id="aton-profile-save" class="aton-primary-button" style="margin-top:0;padding-inline:14px;">Сохранить</button>
      </div>
    `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const nameInput = modal.querySelector("#aton-profile-name");
  const bioInput = modal.querySelector("#aton-profile-bio");
  const publicIdInput = modal.querySelector("#aton-profile-public-id");
  const avatarInput = modal.querySelector("#aton-profile-avatar");
  const avatarPreview = modal.querySelector("#aton-profile-avatar-preview");

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
      avatarPreview.style.display = "block";
    };
    reader.readAsDataURL(file);
  });

  modal.querySelector("#aton-profile-cancel").addEventListener("click", () => {
    overlay.remove();
  });

  modal.querySelector("#aton-profile-save").addEventListener("click", async () => {
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
      const idx = allUsers.findIndex((u) => u.id === updated.id);
      if (idx !== -1) allUsers[idx] = updated;
      else allUsers.push(updated);

      userNameLabel.textContent = updated.displayName || updated.username;
      const pillAvatar = userPill.querySelector(".aton-user-avatar");
      pillAvatar.innerHTML = "";
      if (updated.avatarDataUrl) {
        const img = document.createElement("img");
        img.src = updated.avatarDataUrl;
        pillAvatar.appendChild(img);
      }
      overlay.remove();
      renderChatList();
      renderMessages();
    } catch (err) {
      alert(err.message);
    }
  });
}

  profileLink.addEventListener("click", openProfileModal);
  userPill.addEventListener("click", openProfileModal);

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

  if (moderationButton) {
    moderationButton.addEventListener("click", () => {
      openModerationModal();
    });
  }

  // Голосовые сообщения
  micButton.addEventListener("click", async () => {
    const user = currentUser;
    if (!user || !currentChatId) return;

    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      });

      mediaRecorder.addEventListener("stop", () => {
        const blob = new Blob(recordedChunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const audioDataUrl = reader.result;
          try {
            const to = currentChatId.startsWith("group:") ? null : currentChatPeer();
            const chatId = currentChatId;
            const msg = await api("/api/messages", {
              method: "POST",
              body: JSON.stringify({ chatId, type: "audio", audioDataUrl, to }),
            });
            allMessages.push(msg);
            renderMessages();
            renderChatList();
          } catch (err) {
            alert(err.message);
          }
        };
        reader.readAsDataURL(blob);

        stream.getTracks().forEach((t) => t.stop());
        micButton.classList.remove("recording");
        micButton.textContent = "🎙";
      });

      mediaRecorder.start();
      micButton.classList.add("recording");
      micButton.textContent = "■";
    } catch (err) {
      alert("Не удалось получить доступ к микрофону.");
      console.error(err);
    }
  });

  function updateTopbarTitle() {
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
        badge.title = "Верифицировано";
        inner.appendChild(badge);
      }

      topbarTitleEl.appendChild(inner);
    }

    const current = currentUser;
    if (!current) {
      setTitle("Добро пожаловать", false);
      return;
    }
    if (!currentChatId) {
      setTitle("Выберите чат или пользователя слева", false);
      return;
    }
    if (currentChatId.startsWith("group:") || currentChatId.startsWith("channel:")) {
      const chatMeta = allChats.find((c) => c.id === currentChatId);
      if (chatMeta) {
        const verified = Boolean(chatMeta.verified);
        setTitle(chatMeta.title, verified);
        return;
      }
      // Discover-чат — пользователь не участник, показываем название из превью
      const preview = discoverChats.find((c) => c.id === currentChatId);
      if (preview) {
        setTitle(preview.title + " (не участник)", Boolean(preview.verified));
      } else {
        setTitle("Предпросмотр чата", false);
      }
      return;
    }
    const peer = currentChatPeer();
    if (!peer) {
      setTitle("Личный диалог", false);
      return;
    }
    const peerUser = allUsers.find((u) => u.username === peer);
    const name = peerUser?.displayName || peer;
    const verified = Boolean(peerUser && peerUser.isVerified);
    setTitle(`Диалог с ${name}`, verified);
  }

  // Инициализация
  // По умолчанию показываем режим «Вход» — только email и пароль
  switchMode("login");

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
        titleEl.textContent = "Приглашение недоступно";
        errEl.textContent = e.message || "Ссылка недействительна";
        errEl.style.display = "block";
        joinBtn.style.display = "none";
      });

    joinBtn.addEventListener("click", async () => {
      errEl.style.display = "none";
      hintEl.style.display = "none";
      if (!getToken()) {
        hintEl.textContent =
          "Сначала войдите или зарегистрируйтесь — форма входа слева.";
        hintEl.style.display = "block";
        return;
      }
      try {
        const result = await api(
          `/api/chats/invite/${encodeURIComponent(token)}/join`,
          { method: "POST" }
        );
        const cid = result.chat && result.chat.id;
        if (!cid) throw new Error("Не удалось вступить в чат");
        window.history.replaceState({}, "", "/");
        overlay.remove();
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
        errEl.textContent = e.message || "Ошибка";
        errEl.style.display = "block";
      }
    });
  }

  if (pendingInviteToken) {
    openInviteJoinFlow(pendingInviteToken);
  }

  if (filterPrivateBtn) {
    filterPrivateBtn.addEventListener("click", () => {
      chatFilter = chatFilter === "private" ? "all" : "private";
      if (chatFilter === "private") {
        filterPrivateBtn.classList.add("active");
        filterGroupBtn && filterGroupBtn.classList.remove("active");
      } else {
        filterPrivateBtn.classList.remove("active");
      }
      renderChatList();
    });
  }

  if (filterGroupBtn) {
    filterGroupBtn.addEventListener("click", () => {
      chatFilter = chatFilter === "group" ? "all" : "group";
      if (chatFilter === "group") {
        filterGroupBtn.classList.add("active");
        filterPrivateBtn && filterPrivateBtn.classList.remove("active");
      } else {
        filterGroupBtn.classList.remove("active");
      }
      renderChatList();
    });
  }

  bootstrapData().then(() => {
    applyCurrentUserUI();
    renderChatList();
    renderMessages();
    updateTopbarTitle();
  });
}

window.addEventListener("DOMContentLoaded", createApp);

function openImageLightbox(src) {
  const existing = document.querySelector(".aton-image-lightbox");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "aton-image-lightbox";
  const img = document.createElement("img");
  img.src = src;
  overlay.appendChild(img);
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}

