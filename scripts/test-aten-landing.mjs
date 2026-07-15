import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "site-aten");
const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "artifacts", "aten-landing");
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".exe", "application/octet-stream"],
]);

const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const target = path.resolve(root, relative);
    if (!target.startsWith(root)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const info = await stat(target);
    const file = info.isDirectory() ? path.join(target, "index.html") : target;
    response.writeHead(200, { "Content-Type": mime.get(path.extname(file)) || "application/octet-stream" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve) => server.listen(4178, "127.0.0.1", resolve));
const chromeCandidates = [
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
].filter(Boolean);
let executablePath;
for (const candidate of chromeCandidates) {
  try {
    await stat(candidate);
    executablePath = candidate;
    break;
  } catch {}
}
const browser = await chromium.launch({ headless: true, executablePath });

try {
  await import("node:fs/promises").then(({ mkdir }) => mkdir(output, { recursive: true }));
  const cases = [
    { name: "desktop", viewport: { width: 1440, height: 1000 } },
    { name: "mobile", viewport: { width: 390, height: 844 } },
  ];

  for (const testCase of cases) {
    const page = await browser.newPage({ viewport: testCase.viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4178/", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(output, `${testCase.name}.png`), fullPage: true });

    const result = await page.evaluate(() => ({
      title: document.title,
      platformCards: document.querySelectorAll(".platform-card").length,
      windowsDownload: document.querySelector("[data-download-link]")?.getAttribute("href"),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      heroHeight: Math.round(document.querySelector(".hero")?.getBoundingClientRect().height || 0),
    }));
    if (errors.length) throw new Error(`${testCase.name}: page errors: ${errors.join("; ")}`);
    if (result.platformCards !== 3) throw new Error(`${testCase.name}: expected 3 platform cards`);
    if (!result.windowsDownload?.includes("ATEN-Setup-0.1.3.exe")) {
      throw new Error(`${testCase.name}: release manifest did not update download URL`);
    }
    if (result.horizontalOverflow) throw new Error(`${testCase.name}: horizontal overflow detected`);
    if (result.heroHeight < testCase.viewport.height * 0.72) throw new Error(`${testCase.name}: hero is too short`);
    if (testCase.name === "mobile") {
      await page.click("[data-menu-toggle]");
      const menuOpen = await page.locator("[data-nav]").evaluate((node) => node.classList.contains("is-open"));
      if (!menuOpen) throw new Error("mobile: menu did not open");
    }
    console.log(`OK ${testCase.name}:`, result);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
