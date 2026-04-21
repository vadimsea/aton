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

/** Локальные имена собеседников: JSON в localStorage, только на этом устройстве. */
const LOCAL_PEER_ALIASES_PREFIX = "aton_peer_aliases_";

function getPeerAliasesMap(myUsername) {
  if (!myUsername) return {};
  try {
    const raw = localStorage.getItem(LOCAL_PEER_ALIASES_PREFIX + myUsername);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function setPeerAlias(myUsername, peerUsername, alias) {
  if (!myUsername || !peerUsername) return;
  const map = getPeerAliasesMap(myUsername);
  const t = String(alias || "").trim();
  if (t) map[peerUsername] = t;
  else delete map[peerUsername];
  localStorage.setItem(LOCAL_PEER_ALIASES_PREFIX + myUsername, JSON.stringify(map));
}

/** Как показывать собеседника вам: локальный псевдоним или профиль / username. */
function displayNameForPeer(myUsername, peerUsername, peerUser) {
  if (!peerUsername) return peerUser?.displayName || "";
  if (!myUsername) return peerUser?.displayName || peerUsername;
  const map = getPeerAliasesMap(myUsername);
  if (map[peerUsername]) return map[peerUsername];
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

/** Сообщение относится к личному чату user|user (учёт рассинхрона chatId в БД). */
function messageBelongsToDmId(msg, dmId) {
  if (!dmId || typeof dmId !== "string" || !dmId.includes("|")) return false;
  if (msg.chatId === dmId) return true;
  if (msg.to && chatIdForUsers(msg.from, msg.to) === dmId) return true;
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

/** Статус «был в сети» для шапки и списка личных чатов. При blockedMe не показываем реальный lastSeen. */
function formatPeerPresence(peerUser) {
  const blockedMe = Boolean(peerUser && peerUser.blockedMe);
  if (blockedMe) {
    return {
      text: "давно не был(а) в сети",
      online: false,
      title: "Статус скрыт",
    };
  }
  const iso = peerUser && peerUser.lastSeen;
  if (!iso) {
    return {
      text: "нет данных о последнем визите",
      online: false,
      title: "",
    };
  }
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    return {
      text: "нет данных о последнем визите",
      online: false,
      title: "",
    };
  }
  const diff = Date.now() - t;
  const ONLINE_MS = 60 * 1000;
  if (diff < ONLINE_MS) {
    return { text: "онлайн", online: true, title: "Сейчас онлайн" };
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
    detail = `был(а) в сети ${m} мин назад`;
  } else if (dayDiff === 0) {
    detail = `был(а) в сети сегодня в ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  } else if (dayDiff === 1) {
    detail = `был(а) в сети вчера в ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  } else if (dayDiff < 7) {
    detail = `был(а) в сети ${d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  } else if (d.getFullYear() === now.getFullYear()) {
    detail = `был(а) в сети ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
  } else {
    detail = `был(а) в сети ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}`;
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
  audio.preload = "metadata";
  audio.setAttribute("playsinline", "");
  audio.src = audioSrc;

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "aton-voice-play";
  playBtn.setAttribute("aria-label", "Воспроизвести");
  playBtn.innerHTML =
    '<svg class="aton-voice-icon aton-voice-icon--play" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>' +
    '<svg class="aton-voice-icon aton-voice-icon--pause" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M6 6h4v12H6V6zm8 0h4v12h-4V6z"/></svg>';

  const main = document.createElement("div");
  main.className = "aton-voice-main";

  const track = document.createElement("div");
  track.className = "aton-voice-track";
  track.setAttribute("role", "slider");
  track.setAttribute("tabindex", "0");
  track.setAttribute("aria-label", "Позиция воспроизведения");
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
    playBtn.setAttribute("aria-label", playing ? "Пауза" : "Воспроизвести");
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
    timeEl.textContent = "Не удалось загрузить";
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
        <div class="aton-logo"><div class="aton-logo-inner"></div></div>
        <h2>Подтвердите email</h2>
        <p>Мы отправили письмо на <strong>${email || "ваш email"}</strong>.</p>
        <p>Перейдите по ссылке в письме, чтобы активировать аккаунт.</p>
        <button class="aton-primary-button aton-resend-btn">Отправить повторно</button>
        <p class="aton-verify-hint"></p>
        <button class="aton-logout-link">Выйти</button>
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
        hint.textContent = "Письмо отправлено повторно.";
      } catch (e) {
        hint.textContent = e.message;
      }
      setTimeout(() => { resendBtn.disabled = false; }, 30000);
    });

    wrap.querySelector(".aton-logout-link").addEventListener("click", () => {
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
        <div class="aton-logo"><div class="aton-logo-inner"></div></div>
        <div class="aton-product-name">
          <div class="aton-title">АТОН</div>
          <div class="aton-subtitle">мессенджер под светом диска</div>
        </div>
      </div>
      <div class="aton-sidebar-toolbar" id="aton-sidebar-toolbar" hidden>
        <button type="button" class="aton-topbar-icon" id="aton-sidebar-friends-btn" title="Друзья, заявки и блокировки" style="display:none;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span class="aton-topbar-icon-badge" id="aton-sidebar-friends-badge"></span>
        </button>
        <button type="button" class="aton-topbar-icon" id="aton-sidebar-theme-btn" title="Сменить тему">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
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
    <div class="aton-auth-logged-row">
      <div class="aton-auth-logged-avatar" id="aton-logged-avatar"></div>
      <div class="aton-auth-logged-info">
        <div class="aton-auth-logged-user" id="aton-logged-user"></div>
        <div class="aton-auth-logged-status" id="aton-logged-status">В сети</div>
      </div>
      <div class="aton-auth-logged-actions">
        <button type="button" class="aton-profile-mobile-btn" id="aton-profile-mobile-btn">Профиль</button>
        <button type="button" class="aton-logout-button" id="aton-logout" title="Выйти">⏻</button>
      </div>
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
      <input type="text" class="aton-search-input" id="aton-user-search" placeholder="Поиск по имени или @username…" disabled />
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
      <button class="aton-back-button" id="aton-back-btn" title="Назад к чатам">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="aton-topbar-info">
        <div class="aton-topbar-title" id="aton-topbar-title">Атон</div>
        <div class="aton-topbar-status" id="aton-status">Войдите, чтобы открыть чаты</div>
      </div>
    </div>
    <div class="aton-topbar-right">
      <button class="aton-topbar-icon aton-notify-permission-btn" id="aton-notify-permission" title="Разрешить уведомления о сообщениях вне вкладки" type="button" style="display:none;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M19 8h2l-2 2"/></svg>
      </button>
      <button class="aton-topbar-icon" id="aton-friends-btn" title="Друзья, заявки и блокировки" style="display:none;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span class="aton-topbar-icon-badge" id="aton-friends-badge"></span>
      </button>
      <button class="aton-topbar-icon" id="aton-theme-toggle" title="Сменить тему">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
      <button class="aton-topbar-icon" id="aton-filter-private" title="Личные диалоги">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span class="aton-topbar-icon-badge" id="aton-filter-private-badge"></span>
      </button>
      <button class="aton-topbar-icon" id="aton-filter-group" title="Группы и каналы">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span class="aton-topbar-icon-badge" id="aton-filter-group-badge"></span>
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
      <span class="aton-compose-record-text">Идёт запись. Нажмите кнопку ещё раз, чтобы остановить.</span>
    </div>
    <div class="aton-compose-row">
      <textarea class="aton-compose-input" id="aton-input" rows="1" placeholder="Сообщение…" disabled></textarea>
      <div class="aton-compose-actions">
        <button class="aton-attach-button" id="aton-attach" title="Фото" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <button class="aton-mic-button" id="aton-mic" type="button" title="Голосовое сообщение" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </button>
        <button class="aton-send-button" id="aton-send" disabled>
          <svg class="aton-send-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          <span class="aton-send-text">ОТПРАВИТЬ</span>
        </button>
      </div>
    </div>
    <div class="aton-voice-preview" id="aton-voice-preview" hidden>
      <div class="aton-voice-preview-inner">
        <span class="aton-voice-preview-dot" aria-hidden="true"></span>
        <span class="aton-voice-preview-label">Голосовое</span>
        <span class="aton-voice-preview-time" id="aton-voice-preview-time">0:00</span>
        <button type="button" class="aton-voice-preview-play" id="aton-voice-preview-play" title="Прослушать" aria-label="Прослушать"></button>
        <button type="button" class="aton-voice-preview-cancel" id="aton-voice-preview-cancel">Удалить</button>
        <button type="button" class="aton-voice-preview-send" id="aton-voice-preview-send">Отправить</button>
      </div>
    </div>
    <input type="file" id="aton-attach-input" accept="image/*" style="display:none;" />
  `;

  chat.appendChild(messagesEl);
  chat.appendChild(compose);

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
        <div class="aton-friends-panel-title" id="aton-friends-panel-title">Друзья и контакты</div>
        <button type="button" class="aton-friends-panel-close" id="aton-friends-close" aria-label="Закрыть">×</button>
      </div>
      <p class="aton-friends-hint">В друзьях — те, кого вы добавили и кто принял заявку. Переписка возможна и без этого; друзья видны в списке ниже.</p>
      <div class="aton-friends-section" id="aton-friends-incoming-wrap">
        <div class="aton-friends-section-title">Входящие заявки <span class="aton-friends-count" id="aton-friends-in-count"></span></div>
        <div id="aton-friends-incoming"></div>
      </div>
      <div class="aton-friends-section" id="aton-friends-outgoing-wrap">
        <div class="aton-friends-section-title">Исходящие заявки</div>
        <div id="aton-friends-outgoing"></div>
      </div>
      <div class="aton-friends-section">
        <div class="aton-friends-section-title">Друзья</div>
        <div id="aton-friends-list"></div>
      </div>
      <div class="aton-friends-section">
        <div class="aton-friends-section-title">Заблокированные</div>
        <div id="aton-friends-blocked"></div>
      </div>
    </div>
  `;

  main.appendChild(topbar);
  main.appendChild(peerActionBar);
  main.appendChild(chat);
  document.body.appendChild(friendsOverlay);

  shell.appendChild(sidebar);
  shell.appendChild(main);
  root.appendChild(shell);

  document.addEventListener("click", () => unlockNotificationAudio(), { once: true });
  document.addEventListener("touchstart", () => unlockNotificationAudio(), { once: true, passive: true });
  document.addEventListener("keydown", () => unlockNotificationAudio(), { once: true });

  // === Состояние ===
  let authMode = "login";
  let currentUser = null;
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
  let replyToMessage = null;
  let typingTimeoutId = null;
  let openReactionPicker = null;
  let openChatMenu = null;
  let currentSocketChat = null;
  let hasOnboardingAutoFocused = false;
  let bootstrapVersion = 0;

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

  function getPeerFromDmChatId(chatId) {
    if (!chatId || !String(chatId).includes("|") || !currentUser) return null;
    const [a, b] = chatId.split("|");
    return a === currentUser.username ? b : a;
  }

  function getChatNotifyTitle(chatId) {
    if (!chatId) return "Атон";
    if (chatId.startsWith("group:") || chatId.startsWith("channel:")) {
      let c = allChats.find((x) => x.id === chatId);
      if (!c) c = discoverChats.find((x) => x.id === chatId);
      return c?.title || "Чат";
    }
    const peer = getPeerFromDmChatId(chatId);
    if (!peer) return "Новое сообщение";
    const u = userByUsername(peer);
    return displayNameForPeer(currentUser.username, peer, u);
  }

  function formatNotifyBody(msg) {
    if (!msg) return "";
    if (msg.type === "audio") return "Голосовое сообщение";
    if (msg.type === "image") return "Фото";
    const t = (msg.text || "").trim();
    if (t.length > 120) return `${t.slice(0, 117)}…`;
    return t || "Новое сообщение";
  }

  function openChatFromNotification(chatId) {
    if (!chatId || !currentUser) return;
    currentChatId = chatId;
    switchSocketChat(currentChatId);
    setLastChatId(currentUser.username, currentChatId);
    const reads = getChatReads(currentUser.username);
    setChatReads(currentUser.username, { ...reads, [chatId]: new Date().toISOString() });
    renderChatList();
    renderMessages();
    updateTopbarTitle();
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
      <div class="aton-toast-card-kicker">Новое сообщение</div>
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
    if (currentUser && msg.from !== currentUser.username) {
      const muted = isChatNotifyMuted(currentUser.username, msg.chatId);
      if (!muted) {
        playIncomingMessageSound();
        if (document.visibilityState === "hidden") {
          showBackgroundMessageAlert(msg);
        }
      }
    }
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
  const loggedUserLabel = document.getElementById("aton-logged-user");
  const logoutButton = document.getElementById("aton-logout");
  const backButton = document.getElementById("aton-back-btn");
  const createGroupButton = document.getElementById("aton-create-group");
  const forgotLink = document.getElementById("aton-forgot");
  const contactsEl = document.getElementById("aton-contacts");
  const filterPrivateBtn = document.getElementById("aton-filter-private");
  const filterGroupBtn = document.getElementById("aton-filter-group");
  const moderationButton = document.getElementById("aton-moderation");
  const filterPrivateBadge = document.getElementById("aton-filter-private-badge");
  const filterGroupBadge = document.getElementById("aton-filter-group-badge");
  const themeToggle = document.getElementById("aton-theme-toggle");
  const friendsBtn = document.getElementById("aton-friends-btn");
  const friendsBadge = document.getElementById("aton-friends-badge");
  const sidebarToolbar = document.getElementById("aton-sidebar-toolbar");
  const sidebarFriendsBtn = document.getElementById("aton-sidebar-friends-btn");
  const sidebarThemeBtn = document.getElementById("aton-sidebar-theme-btn");
  const friendsSidebarBadge = document.getElementById("aton-sidebar-friends-badge");
  const notifyPermissionBtn = document.getElementById("aton-notify-permission");

  // Индикатор «печатает…»
  const typingIndicator = document.createElement("div");
  typingIndicator.className = "aton-typing-indicator";
  typingIndicator.textContent = "Печатаете сообщение…";
  typingIndicator.style.display = "none";
  compose.insertBefore(typingIndicator, compose.firstChild);

  const ATON_MIC_ICON_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  const ATON_MIC_STOP_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
  const ATON_PREVIEW_PLAY_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
  const ATON_PREVIEW_PAUSE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>`;

  function setMicButtonIdle() {
    micButton.innerHTML = ATON_MIC_ICON_SVG;
    micButton.classList.remove("recording");
    micButton.title = "Голосовое сообщение";
  }

  function setMicButtonRecordingUi() {
    micButton.innerHTML = ATON_MIC_STOP_SVG;
    micButton.classList.add("recording");
    micButton.title = "Остановить запись";
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
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (voicePreviewEl && !voicePreviewEl.hidden) {
      e.preventDefault();
      clearVoicePreview();
      setMicButtonIdle();
    }
  });

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
      contacts = { friends: [], blocked: [], requestsIn: [], requestsOut: [] };
      currentChatId = null;
      return;
    }

    try {
      const nextCurrentUser = await api("/api/me");
      if (version !== bootstrapVersion) return;

      currentUser = nextCurrentUser;
      currentUser.isSuperAdmin = resolveIsSuperAdmin(currentUser);

      if (!currentUser.verified) return;

      // Сначала без /api/users — полный список пользователей может быть тяжёлым и
      // блокирует первый кадр со списком чатов после входа.
      const [
        nextAllChats,
        nextAllMessages,
        nextContacts,
        nextDiscover,
      ] = await Promise.all([
        api("/api/chats"),
        api("/api/messages/all"),
        api("/api/contacts").catch(() => ({
          friends: [],
          blocked: [],
          requestsIn: [],
          requestsOut: [],
        })),
        api("/api/chats/discover").catch(() => []),
      ]);

      if (version !== bootstrapVersion) return;

      allUsers = [];
      allChats = nextAllChats;
      discoverChats = Array.isArray(nextDiscover) ? nextDiscover : [];
      allMessages = nextAllMessages;
      contacts = nextContacts;
      if (!contacts.requestsIn) contacts.requestsIn = [];
      if (!contacts.requestsOut) contacts.requestsOut = [];

      // Важно: при загрузке НЕ выбираем чат автоматически.
      // currentChatId остаётся null, пока пользователь явно не кликнет по чату.

      (async function loadUsersDirectory() {
        try {
          const nextAllUsers = await api("/api/users");
          if (version !== bootstrapVersion) return;
          allUsers = Array.isArray(nextAllUsers) ? nextAllUsers : [];
          applyCurrentUserUI();
          renderChatList();
          renderMessages();
          updateTopbarTitle();
          updateFriendsBadge();
          renderContacts();
        } catch (err) {
          console.error("GET /api/users (bootstrap):", err);
        }
      })();
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
          contacts = { friends: [], blocked: [], requestsIn: [], requestsOut: [] };
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
      if (friendsBtn) friendsBtn.style.display = "none";
      if (sidebarToolbar) sidebarToolbar.hidden = true;
      if (sidebarFriendsBtn) sidebarFriendsBtn.style.display = "none";
      if (notifyPermissionBtn) notifyPermissionBtn.style.display = "none";
      if (friendsOverlay) friendsOverlay.hidden = true;
    } else {
      hasOnboardingAutoFocused = false;
      authLoginBlock.style.display = "none";
      authLoggedBlock.style.display = "block";
      const tb = document.getElementById("aton-topbar");
      if (tb) tb.classList.remove("aton-topbar--guest");
      const full = userByUsername(user.username) || user;
      const displayName = selfDisplayNameForUi(user, full);
      const publicId = full.publicId || full.username;
      loggedUserLabel.innerHTML = "";
      const nameSpan = document.createElement("span");
      nameSpan.textContent = displayName;
      loggedUserLabel.appendChild(nameSpan);
      if (full.isVerified) {
        const badge = document.createElement("span");
        badge.className = "aton-verified-badge";
        badge.textContent = "✔";
        badge.title = "Верифицировано";
        loggedUserLabel.appendChild(badge);
      }
      const idSpan = document.createElement("span");
      idSpan.className = "aton-logged-id";
      idSpan.textContent = `@${publicId}`;
      loggedUserLabel.appendChild(idSpan);

      // Sidebar avatar
      const loggedAvatar = document.getElementById("aton-logged-avatar");
      if (loggedAvatar) {
        loggedAvatar.innerHTML = "";
        if (full.avatarDataUrl) {
          const avatarImg = document.createElement("img");
          avatarImg.src = full.avatarDataUrl;
          loggedAvatar.appendChild(avatarImg);
        } else {
          loggedAvatar.textContent = (displayName[0] || "?").toUpperCase();
        }
      }

      // Sidebar online status
      const loggedStatus = document.getElementById("aton-logged-status");
      const lastSeenIso = full.lastSeen;
      let isOnline = false;
      if (lastSeenIso) {
        const diff = Date.now() - new Date(lastSeenIso).getTime();
        isOnline = diff < 60 * 1000;
      }
      userPill.classList.toggle("online", isOnline);
      userPill.classList.toggle("offline", !isOnline);
      if (loggedStatus) loggedStatus.textContent = isOnline ? "В сети" : "Не в сети";
      statusEl.textContent = isOnline
        ? `В сети как ${displayName}`
        : `Недавно были в сети как ${displayName}`;
      userPill.style.display = "inline-flex";
      if (filterPrivateBtn) filterPrivateBtn.style.display = "inline-flex";
      if (filterGroupBtn) filterGroupBtn.style.display = "inline-flex";
      if (friendsBtn) friendsBtn.style.display = user.verified ? "inline-flex" : "none";
      if (sidebarToolbar) sidebarToolbar.hidden = false;
      if (sidebarFriendsBtn) {
        sidebarFriendsBtn.style.display = user.verified ? "inline-flex" : "none";
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
        pillBadge.title = "Верифицировано";
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
      if (filterPrivateBtn) filterPrivateBtn.disabled = false;
      if (filterGroupBtn) filterGroupBtn.disabled = false;
      typingIndicator.style.display = "none";
      chatsRoot.style.display = "flex";
      // Показываем низ только если уже выбран чат
      compose.style.display = currentChatId ? "flex" : "none";
      updateNotifyPermissionButton();
    }
    shell.classList.toggle("aton-shell--guest-landing", !currentUser);
    shell.classList.toggle("aton-shell--no-chat", !currentChatId);
    shell.classList.toggle("aton-shell--has-chat", Boolean(currentChatId));
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
      socket.auth.token = data.token;
      socket.disconnect().connect();

      if (data.user) {
        currentUser = data.user;
        currentUser.isSuperAdmin = resolveIsSuperAdmin(currentUser);
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

  if (backButton) {
    backButton.addEventListener("click", () => {
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
            rowHtml(u, `<span class="aton-friends-muted">в друзьях</span>`)
          )
          .join("")
      : `<div class="aton-friends-empty">Пока никого нет. Отправьте заявку из поиска или из открытого чата.</div>`;

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
    wrap.hidden = false;
    const st = peerContactStatus(peer);
    const isBlocked = st === "blocked";
    const peerUser = userByUsername(peer);
    const name = displayNameForPeer(currentUser.username, peer, peerUser);
    let html = `<div class="aton-peer-action-inner">
      <div class="aton-peer-action-row aton-peer-action-row--head">
        <span class="aton-peer-action-label">${escHtml(name)}</span>
        <button type="button" class="aton-peer-rename-local" data-peer="${escHtml(peer)}" title="Только на этом устройстве, для других не меняется">
          <svg class="aton-peer-rename-local-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <span class="aton-peer-rename-local-text">Изменить имя собеседника</span>
        </button>
      </div>
      <div class="aton-peer-action-btns">`;
    if (isBlocked) {
      html += `<button type="button" class="aton-peer-btn aton-peer-unblock" data-peer="${escHtml(peer)}">Разблокировать</button>`;
    } else {
      html += `<button type="button" class="aton-peer-btn aton-peer-block" data-peer="${escHtml(peer)}">Заблокировать</button>`;
    }
    if (st === "friend") {
      html += `<span class="aton-peer-muted">в друзьях</span>`;
    } else if (st === "in") {
      html += `<button type="button" class="aton-peer-btn aton-peer-accept" data-peer="${escHtml(peer)}">Принять заявку</button>`;
      html += `<button type="button" class="aton-peer-btn aton-peer-decline" data-peer="${escHtml(peer)}">Отклонить</button>`;
    } else if (st === "out") {
      html += `<span class="aton-peer-muted">заявка отправлена</span>`;
      html += `<button type="button" class="aton-peer-btn aton-peer-cancel" data-peer="${escHtml(peer)}">Отменить заявку</button>`;
    } else if (!isBlocked) {
      html += `<button type="button" class="aton-peer-btn aton-peer-add" data-peer="${escHtml(peer)}">Добавить в друзья</button>`;
    }
    const mutedN =
      currentUser && currentChatId ? isChatNotifyMuted(currentUser.username, currentChatId) : false;
    html += `<button type="button" class="aton-peer-btn aton-peer-notify-toggle ${
      mutedN ? "aton-peer-notify-toggle--muted" : ""
    }" data-chat-id="${escHtml(currentChatId)}" title="${
      mutedN
        ? "Включить звук и уведомления для этого чата"
        : "Отключить звук и всплывающие уведомления"
    }" aria-label="Уведомления">${
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
    const cur = getPeerAliasesMap(currentUser.username)[peer] || "";
    const defaultDisplay = peerUser?.displayName || peer;

    const overlay = document.createElement("div");
    overlay.className = "aton-peer-alias-overlay";
    overlay.innerHTML = `
      <div class="aton-peer-alias-backdrop" aria-label="Закрыть" role="presentation"></div>
      <div class="aton-peer-alias-modal" role="dialog" aria-modal="true" aria-labelledby="aton-peer-alias-title">
        <h2 class="aton-peer-alias-heading" id="aton-peer-alias-title">Изменить имя собеседника</h2>
        <p class="aton-peer-alias-lead">Имя видите только вы в этом браузере. Остальные пользователи по-прежнему видят профиль в Атоне.</p>
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
    overlay.querySelector("#aton-peer-alias-save").addEventListener("click", () => {
      const next = input.value.trim();
      setPeerAlias(currentUser.username, peer, next);
      renderChatList();
      renderMessages();
      updateTopbarTitle();
      updatePeerActionBar();
      showToast("Сохранено");
      close();
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
        alert(err.message || "Ошибка");
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
        showToast(nextMuted ? "Для этого чата выключены звук и уведомления" : "Звук и уведомления снова включены");
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
          if (r.status === "requested") showToast("Заявка отправлена");
          if (r.status === "accepted") showToast("Вы в друзьях");
        } else if (btn.classList.contains("aton-peer-accept")) {
          await api("/api/contacts/accept", { method: "POST", body: JSON.stringify({ username: peer }) });
          showToast("Заявка принята");
        } else if (btn.classList.contains("aton-peer-decline")) {
          await api("/api/contacts/decline", { method: "POST", body: JSON.stringify({ username: peer }) });
        } else if (btn.classList.contains("aton-peer-cancel")) {
          await api("/api/contacts/cancel", { method: "POST", body: JSON.stringify({ username: peer }) });
        } else return;
        await pullContacts();
      } catch (err) {
        alert(err.message || "Ошибка");
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

    // Считаем непрочитанные для групп и приватных чатов для иконок в топбаре
    let groupUnreadTotal = 0;

    // Учитываем пин и непрочитанные для групп
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
      if (gMuted) {
        const offEl = document.createElement("span");
        offEl.className = "aton-chat-notify-off";
        offEl.title = "Уведомления отключены";
        offEl.setAttribute("aria-label", "Уведомления отключены");
        offEl.textContent = "🔕";
        titleEl.appendChild(offEl);
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

        const groupNotifyMuted = isChatNotifyMuted(current.username, chatMeta.id);
        dropdown.appendChild(
          createMenuItem({
            label: groupNotifyMuted ? "Включить уведомления" : "Без звука и уведомлений",
            onClick: () => {
              setChatNotifyMuted(current.username, chatMeta.id, !groupNotifyMuted);
              renderChatList();
              showToast(
                groupNotifyMuted
                  ? "Звук и уведомления снова включены для этого чата"
                  : "Для этого чата выключены звук и всплывающие уведомления"
              );
            },
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
      return;
    }

    // Приватные: сначала те, с кем недавнее общение
    const privateIdsSorted = Array.from(privateChatIds).sort((a, b) => {
      const ta = lastActivityAtForDmChatId(a, allMessages);
      const tb = lastActivityAtForDmChatId(b, allMessages);
      if (tb !== ta) return tb - ta;
      return a.localeCompare(b);
    });
    let privateUnreadTotal = 0;
    privateIdsSorted.forEach((id) => {
      const [a, b] = id.split("|");
      const peer = a === current.username ? b : a;
      const peerUser = userByUsername(peer);
      const title = displayNameForPeer(current.username, peer, peerUser);
      const chatMessages = allMessages
        .filter((m) => messageBelongsToDmId(m, id))
        .sort((a, b) => new Date(a.time) - new Date(b.time));
      const lastMsg = chatMessages[chatMessages.length - 1];
      const unread = countUnreadInbound(chatMessages, reads[id], current.username);
      const pinned = pins.has(id);
      const presence = formatPeerPresence(peerUser);
      const peerOnline = presence.online;
      privateUnreadTotal += unread;
      if (chatFilter === "group") {
        // В режиме «группы» личные чаты скрываем
        return;
      }

      const pMuted = isChatNotifyMuted(current.username, id);
      const item = document.createElement("button");
      item.className =
        "aton-chat-item" +
        (currentChatId === id ? " active" : "") +
        (pMuted ? " aton-chat-item--notify-muted" : "");

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
      if (pMuted) {
        const offEl = document.createElement("span");
        offEl.className = "aton-chat-notify-off";
        offEl.title = "Уведомления отключены";
        offEl.setAttribute("aria-label", "Уведомления отключены");
        offEl.textContent = "🔕";
        titleEl.appendChild(offEl);
      }
      const subtitleEl = document.createElement("div");
      subtitleEl.className = "aton-chat-item-subtitle";
      const onlineDot = document.createElement("span");
      onlineDot.className = `aton-chat-online-dot ${peerOnline ? "online" : "offline"}`;
      subtitleEl.appendChild(onlineDot);
      subtitleEl.appendChild(
        document.createTextNode(`@${peer} · ${presence.text}`)
      );
      subtitleEl.title = presence.title || presence.text;
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
        <div class="aton-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <line x1="9" y1="10" x2="15" y2="10" opacity="0.5"/>
          </svg>
        </div>
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
        <div class="aton-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <div class="aton-empty-title">В этом чате пока нет сообщений</div>
        <div class="aton-empty-subtitle">Напишите первое сообщение, чтобы начать диалог.</div>
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
    shell.classList.toggle("aton-shell--has-chat", Boolean(currentChatId));

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

    if (voiceSessionChatId != null && voiceSessionChatId !== currentChatId) {
      abortVoiceUi();
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

    // Обновляем признак «прочитано до» для активного чата
    const reads = getChatReads(current.username);
    if (currentChatId) {
      const updatedReads = { ...reads, [currentChatId]: new Date().toISOString() };
      setChatReads(current.username, updatedReads);
    }

    filtered.forEach((msg) => {
      const isSelf = current && current.username === msg.from;

      const row = document.createElement("div");
      row.className = "aton-message-row" + (isSelf ? " self" : "");

      const inner = document.createElement("div");
      inner.className = "aton-message-inner";

      const avatarWrap = document.createElement("div");
      avatarWrap.className = "aton-message-avatar";
      const author = userByUsername(msg.from);
      if (author?.avatarDataUrl) {
        const img = document.createElement("img");
        img.src = author.avatarDataUrl;
        avatarWrap.appendChild(img);
      } else {
        avatarWrap.textContent = (msg.from || "?").slice(0, 1).toUpperCase();
      }

      const bubble = document.createElement("div");
      bubble.className =
        "aton-message-bubble aton-message-bubble-enter" + (isSelf ? " self" : "");
      const text = document.createElement("div");
      text.className = "aton-message-text";
      if (msg.type === "audio" && msg.audioDataUrl) {
        text.classList.add("aton-message-text--media");
        text.appendChild(createVoicePlayer(msg.audioDataUrl, isSelf));
      } else if (msg.type === "image" && msg.imageDataUrl) {
        text.classList.add("aton-message-text--media");
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
        textNode.className = "aton-message-text-body";
        textNode.textContent = msg.text;
        text.appendChild(textNode);
      }
      if (msg.replyTo) {
        const replied = filtered.find((m) => m.id === msg.replyTo);
        if (replied) {
          const replyPreview = document.createElement("div");
          replyPreview.className = "aton-message-reply-preview";
          const replyWho = displayNameForPeer(
            current.username,
            replied.from,
            userByUsername(replied.from)
          );
          replyPreview.textContent = `${replyWho}: ${replied.text.slice(0, 60)}${
            replied.text.length > 60 ? "…" : ""
          }`;
          bubble.appendChild(replyPreview);
        }
      }
      const canAdmin = current && current.isSuperAdmin === true;
      const authorIsVerified = Boolean(author && author.isVerified);
      const timeLabel = formatTimeLabel(msg.time);
      const editedLabel = msg.editedAt ? " · изм." : "";
      const pinnedLabel = msg.pinned ? " 📌" : "";

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

      bubble.appendChild(text);

      const meta = document.createElement("div");
      meta.className = "aton-message-meta";
      meta.innerHTML = `<span class="aton-message-time">${escHtml(timeLabel)}${escHtml(editedLabel)}${escHtml(pinnedLabel)}</span>`;
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

      bubble.appendChild(actions);

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
    unlockNotificationAudio();
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
      usersTitle.textContent = "Пользователи";
      searchResultsEl.appendChild(usersTitle);
    }

    function openDmWithUserFromSearch(u) {
      if (!current) return;
      currentChatId = chatIdForUsers(current.username, u.username);
      switchSocketChat(currentChatId);
      if (current.username) setLastChatId(current.username, currentChatId);
      searchInput.value = "";
      searchResultsEl.innerHTML = "";
      renderChatList();
      renderMessages();
      updateTopbarTitle();
    }

    users.forEach((u) => {
      const item = document.createElement("div");
      item.className = "aton-search-item aton-search-item--user";
      const isFriend = contacts.friends.some((f) => f.username === u.username);
      const isBlocked = contacts.blocked.some((b) => b.username === u.username);
      const hasIn = (contacts.requestsIn || []).some((r) => r.username === u.username);
      const hasOut = (contacts.requestsOut || []).some((r) => r.username === u.username);
      let friendButtonsHtml = "";
      if (isFriend) {
        friendButtonsHtml = `<button type="button" class="aton-search-action aton-search-add" disabled>В друзьях</button>`;
      } else if (hasIn) {
        friendButtonsHtml = `<button type="button" class="aton-search-action aton-search-accept">Принять</button>
            <button type="button" class="aton-search-action aton-search-decline">Отклонить</button>`;
      } else if (hasOut) {
        friendButtonsHtml = `<button type="button" class="aton-search-action" disabled>Заявка отправлена</button>
            <button type="button" class="aton-search-action aton-search-cancel-req">Отменить заявку</button>`;
      } else if (isBlocked) {
        friendButtonsHtml = `<button type="button" class="aton-search-action aton-search-add" disabled>В друзья</button>`;
      } else {
        friendButtonsHtml = `<button type="button" class="aton-search-action aton-search-add">Отправить заявку</button>`;
      }
      const nameStr = u.displayName || u.username;
      const verifiedBadge = u.isVerified
        ? ' <span class="aton-search-verified" title="Верифицировано">✔</span>'
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
            <button type="button" class="aton-search-action aton-search-write" ${isBlocked ? "disabled" : ""}>Написать</button>
            ${friendButtonsHtml}
            <button type="button" class="aton-search-action aton-search-block">${
              isBlocked ? "Разблокировать" : "Заблокировать"
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
            if (r.status === "requested") showToast("Заявка отправлена");
            if (r.status === "accepted") showToast("Вы в друзьях");
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
            showToast("Заявка принята");
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
      chatsTitle.className = "aton-search-section-title";
      chatsTitle.style.marginTop = users.length || myChatsFound.length ? "6px" : "0";
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

  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(handleUserSearch, 200);
  });

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
    const user = userByUsername(currentUser.username) || currentUser;

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
      <label class="aton-input-label" style="margin-top:4px;">Как видеть себя в чатах (только у вас)</label>
      <input type="text" id="aton-profile-local-name" class="aton-input" style="margin-bottom:4px;" placeholder="Только в этом браузере, для других не меняется" />
      <div style="font-size:10px;color:#6b7280;margin-bottom:8px;line-height:1.35;">Не отправляется на сервер. Пустое поле — показывается имя из профиля выше.</div>
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
  const localNameInput = modal.querySelector("#aton-profile-local-name");
  const bioInput = modal.querySelector("#aton-profile-bio");
  const publicIdInput = modal.querySelector("#aton-profile-public-id");
  const avatarInput = modal.querySelector("#aton-profile-avatar");
  const avatarPreview = modal.querySelector("#aton-profile-avatar-preview");

  nameInput.value = user.displayName || user.username;
  if (localNameInput) localNameInput.value = getLocalSelfDisplayName(user.username);
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
      if (localNameInput) {
        setLocalSelfDisplayName(currentUser.username, localNameInput.value);
      }
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
      const idx = allUsers.findIndex((u) => u.id === updated.id);
      if (idx !== -1) allUsers[idx] = updated;
      else allUsers.push(updated);

      overlay.remove();
      applyCurrentUserUI();
      renderChatList();
      renderMessages();
      updateTopbarTitle();
    } catch (err) {
      alert(err.message);
    }
  });
}

  profileLink.addEventListener("click", openProfileModal);
  userPill.addEventListener("click", openProfileModal);

  // Sidebar avatar click opens profile
  const loggedAvatarEl = document.getElementById("aton-logged-avatar");
  if (loggedAvatarEl) {
    loggedAvatarEl.style.cursor = "pointer";
    loggedAvatarEl.title = "Открыть профиль";
    loggedAvatarEl.addEventListener("click", openProfileModal);
  }
  const profileMobileBtn = document.getElementById("aton-profile-mobile-btn");
  if (profileMobileBtn) {
    profileMobileBtn.addEventListener("click", openProfileModal);
  }

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
        showToast("Уведомления не поддерживаются в этом браузере");
        return;
      }
      try {
        const p = await Notification.requestPermission();
        updateNotifyPermissionButton();
        if (p === "granted") showToast("Когда вкладка в фоне, вы будете видеть уведомления о сообщениях");
        else if (p === "denied") showToast("Разрешите уведомления в настройках сайта в браузере");
      } catch (_) {
        showToast("Не удалось запросить разрешение");
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

  // Голосовые сообщения: запись → превью → отправить (как в Telegram)
  micButton.addEventListener("click", async () => {
    unlockNotificationAudio();
    const user = currentUser;
    if (!user || !currentChatId) return;

    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeMicStream = stream;
      recordedChunks = [];
      voiceSessionChatId = currentChatId;
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      });

      mediaRecorder.addEventListener("stop", () => {
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
          showToast("Слишком короткое сообщение");
          voiceSessionChatId = null;
          return;
        }

        showVoicePreview(blob);
      });

      mediaRecorder.start();
      if (composeRecordHint) composeRecordHint.hidden = false;
      setMicButtonRecordingUi();
      startRecordingTimerUi();
    } catch (err) {
      alert("Не удалось получить доступ к микрофону.");
      console.error(err);
      activeMicStream = null;
      voiceSessionChatId = null;
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

    try {
      const current = currentUser;
      statusEl.classList.remove("aton-topbar-status--online");
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
          statusEl.textContent = "групповой чат";
          statusEl.removeAttribute("title");
          return;
        }
        const preview = discoverChats.find((c) => c.id === currentChatId);
        if (preview) {
          setTitle(preview.title + " (не участник)", Boolean(preview.verified));
        } else {
          setTitle("Предпросмотр чата", false);
        }
        statusEl.textContent = "групповой чат";
        statusEl.removeAttribute("title");
        return;
      }
      const peer = currentChatPeer();
      if (!peer) {
        setTitle("Личный диалог", false);
        statusEl.textContent = "";
        statusEl.removeAttribute("title");
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
    authLoginBlock.style.display = "none";
    authLoggedBlock.style.display = "none";
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

  (async () => {
    const verifyResult = await handleVerifyToken();
    if (verifyResult && verifyResult.ok) {
      if (currentUser) currentUser.verified = true;
    }

    await bootstrapData();

    if (currentUser && !currentUser.verified) {
      showVerifyScreen(currentUser.email);
      return;
    }

    if (currentUser) {
      unlockNotificationAudio();
    }

    if (verifyResult && verifyResult.ok) {
      const hint = document.querySelector(".aton-auth-hint");
      if (hint) hint.textContent = "Email подтверждён! Добро пожаловать.";
    }

    applyCurrentUserUI();
    renderContacts();
    renderChatList();
    renderMessages();
    updateTopbarTitle();
  })();
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

