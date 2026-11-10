/* ATEN service worker: Web Push (уведомления о сообщениях на заблокированный экран) */

const ICON = "/icons/icon-192.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "ATEN", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "ATEN";
  const options = {
    body: data.body || "",
    icon: ICON,
    badge: ICON,
    // у каждого сообщения свой тег: сообщения не затирают друг друга, а складываются стопкой, как в Telegram
    tag: data.messageId || undefined,
    timestamp: data.ts || Date.now(),
    lang: "ru",
    data: { url: data.url || "/", chatId: data.chatId || null },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // Число непрочитанных на иконке приложения (iOS 16.4+ для веб-приложений на экране «Домой»)
      const nav = self.navigator;
      if (typeof data.badge === "number" && nav && typeof nav.setAppBadge === "function") {
        try {
          if (data.badge > 0) await nav.setAppBadge(data.badge);
          else await nav.clearAppBadge();
        } catch (_) {}
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const info = event.notification.data || {};
  const target = new URL(info.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const win of windows) {
        if (win.url.startsWith(self.location.origin)) {
          await win.focus();
          // приложение уже открыто в фоне — просто переключаем чат
          win.postMessage({ type: "aton-open-chat", chatId: info.chatId });
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
