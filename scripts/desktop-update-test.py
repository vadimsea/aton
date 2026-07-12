"""Verify that ATEN shows an update prompt for a newer release manifest."""
from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXE = ROOT / "desktop-qt" / "build" / "release" / "ATEN.exe"
ARTIFACT = ROOT / "artifacts" / "version-installer" / "update-notification.png"
def main() -> int:
    if not EXE.exists():
        print(f"FAIL: missing {EXE}")
        return 1

    subprocess.run(["taskkill", "/IM", "ATEN.exe", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    manifest_path = ROOT / "artifacts" / "version-installer" / "update-test-manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(
            {
                "version": "99.99.99",
                "title": "ATEN 99.99.99",
                "message": "Тестовое обновление готово к установке.",
                "downloadUrl": "https://vadzim.by/aten/downloads/ATEN-Setup-99.99.99.exe",
                "pageUrl": "https://vadzim.by/aten/",
                "mandatory": True,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    env = os.environ.copy()
    env["ATEN_RELEASE_MANIFEST_URL"] = manifest_path.as_uri()
    proc = subprocess.Popen([str(EXE)], cwd=str(EXE.parent), env=env)

    try:
        from pywinauto import Desktop

        deadline = time.time() + 25
        update_window = None
        while time.time() < deadline:
            windows = Desktop(backend="uia").windows(visible_only=True)
            for candidate in windows:
                if candidate.process_id() != proc.pid:
                    continue
                texts = " ".join(item.window_text() for item in candidate.descendants())
                if "ATEN 99.99.99" in texts and "Скачать обновление" in texts:
                    update_window = candidate
                    break
            if update_window:
                break
            time.sleep(0.5)

        if not update_window:
            for candidate in Desktop(backend="uia").windows(visible_only=True):
                if candidate.process_id() != proc.pid:
                    continue
                texts = " | ".join(item.window_text() for item in candidate.descendants())
                safe_text = texts[:1000].encode("unicode_escape").decode("ascii")
                print("DEBUG WINDOW:", repr(candidate.window_text()), safe_text)
            print("FAIL: update notification was not shown")
            return 1

        ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
        update_window.capture_as_image().save(ARTIFACT)
        print(f"OK: update notification shown, screenshot: {ARTIFACT}")
        return 0
    finally:
        manifest_path.unlink(missing_ok=True)
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
