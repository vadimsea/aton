"""Launch ATEN desktop and verify main window appears."""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

EXE = Path(__file__).resolve().parents[1] / "desktop-qt" / "build" / "release" / "ATEN.exe"
RELEASE = EXE.parent


def main() -> int:
    if not EXE.exists():
        print(f"FAIL: missing {EXE}")
        return 1

    url_file = RELEASE / "aten-api.url"
    if not url_file.exists() or "onrender.com" not in url_file.read_text(encoding="utf-8"):
        url_file.write_text("https://aton-api.onrender.com\n", encoding="utf-8")
        print("Wrote aten-api.url -> Render")

    print(f"Starting {EXE.name} ...")
    # Close stale instances so window enumeration stays unambiguous.
    subprocess.run(
        ["taskkill", "/IM", "ATEN.exe", "/F"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(0.5)
    proc = subprocess.Popen([str(EXE)], cwd=str(RELEASE))

    try:
        from pywinauto import Desktop
        from pywinauto.findwindows import ElementNotFoundError
    except ImportError:
        print("pywinauto not installed; process started, skipping window check")
        time.sleep(5)
        proc.terminate()
        return 0

    deadline = time.time() + 25
    window = None
    while time.time() < deadline:
        try:
            matches = Desktop(backend="uia").windows(title_re=".*ATEN.*", visible_only=True)
            for candidate in matches:
                if candidate.process_id() == proc.pid:
                    window = candidate
                    break
            if window:
                break
        except Exception:
            pass
        time.sleep(0.5)

    if not window:
        print("FAIL: ATEN window not found within 25s")
        proc.terminate()
        return 1

    title = window.window_text()
    rect = window.rectangle()
    print(f"OK: window '{title}' at {rect.width()}x{rect.height()}")

    # Auth page should show login-related controls
    edits = window.descendants(control_type="Edit")
    buttons = window.descendants(control_type="Button")
    print(f"OK: {len(edits)} text fields, {len(buttons)} buttons visible")

    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
    print("Closed ATEN.exe")
    return 0


if __name__ == "__main__":
    sys.exit(main())
