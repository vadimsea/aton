const toggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");

toggle?.addEventListener("click", () => {
  const open = !nav.classList.contains("is-open");
  nav.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
});

nav?.addEventListener("click", (event) => {
  if (!event.target.closest("a")) return;
  nav.classList.remove("is-open");
  toggle?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
});

document.querySelector("[data-year]").textContent = String(new Date().getFullYear());
window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });

fetch("latest.json", { cache: "no-store" })
  .then((response) => response.ok ? response.json() : Promise.reject(new Error("release manifest unavailable")))
  .then((release) => {
    if (release.version) {
      document.querySelectorAll("[data-release-version]").forEach((node) => {
        node.textContent = release.version;
      });
    }
    if (release.downloadUrl) {
      document.querySelectorAll("[data-download-link]").forEach((link) => {
        link.href = release.downloadUrl;
      });
    }
  })
  .catch(() => {});
