"""Unit-style checks for desktop unread/notification logic."""
from __future__ import annotations

import json
import sys
from pathlib import Path


def direct_chat_id(a: str, b: str) -> str:
    parts = sorted([a, b], key=str.lower)
    return f"{parts[0]}|{parts[1]}"


def message_chat_id(msg: dict) -> str:
    chat_id = msg.get("chatId") or ""
    if chat_id:
        return chat_id
    sender = msg.get("from") or msg.get("senderUsername") or ""
    recipient = msg.get("to") or msg.get("recipientUsername") or ""
    if sender and recipient:
        return direct_chat_id(sender, recipient)
    return ""


def count_unread(messages: list[dict], me: str, reads: dict[str, str]) -> tuple[int, dict[str, int]]:
    by_chat: dict[str, int] = {}
    total = 0
    for msg in messages:
        sender = msg.get("from") or msg.get("senderUsername") or ""
        if not sender or sender.lower() == me.lower():
            continue
        chat_id = message_chat_id(msg)
        if not chat_id:
            continue
        msg_time = msg.get("createdAt") or msg.get("time") or ""
        read_at = reads.get(chat_id) or ""
        if read_at and msg_time and msg_time <= read_at:
            continue
        by_chat[chat_id] = by_chat.get(chat_id, 0) + 1
        total += 1
    return total, by_chat


def main() -> int:
    me = "Alice"
    reads = {direct_chat_id("Alice", "Bob"): "2026-06-01T10:00:00.000Z"}
    messages = [
        {
            "id": "1",
            "from": "Bob",
            "to": me,
            "chatId": direct_chat_id("Alice", "Bob"),
            "createdAt": "2026-06-01T09:00:00.000Z",
            "text": "old",
        },
        {
            "id": "2",
            "from": "Bob",
            "to": me,
            "chatId": direct_chat_id("Alice", "Bob"),
            "createdAt": "2026-06-01T11:00:00.000Z",
            "text": "new",
        },
        {
            "id": "3",
            "from": me,
            "to": "Bob",
            "chatId": direct_chat_id("Alice", "Bob"),
            "createdAt": "2026-06-01T11:05:00.000Z",
            "text": "mine",
        },
    ]
    total, by_chat = count_unread(messages, me, reads)
    assert total == 1, f"expected 1 unread, got {total}"
    assert by_chat[direct_chat_id("Alice", "Bob")] == 1
    print("OK unread counting")

    release = Path(__file__).resolve().parents[1] / "desktop-qt" / "build" / "release"
    for name in ("ATEN.exe", "notification.wav", "aten-logo.png"):
        path = release / name
        if not path.exists():
            print(f"FAIL missing {path}")
            return 1
    print("OK release assets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
