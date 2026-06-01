#include "platform/TaskbarBadge.h"

#include <QGuiApplication>
#include <QApplication>
#include <QIcon>
#include <QSize>
#include <QPainter>
#include <QPen>
#include <QPixmap>
#include <QWidget>

namespace aten {

namespace {

QPixmap drawBadgedPixmap(const QPixmap &basePixmap, int unreadCount, int size)
{
    QPixmap canvas(size, size);
    canvas.fill(Qt::transparent);

    QPainter painter(&canvas);
    painter.setRenderHint(QPainter::Antialiasing, true);
    painter.setRenderHint(QPainter::TextAntialiasing, true);

    const QPixmap base = basePixmap.isNull()
                             ? QPixmap()
                             : basePixmap.scaled(size, size, Qt::KeepAspectRatio, Qt::SmoothTransformation);
    if (!base.isNull()) {
        const int x = (size - base.width()) / 2;
        const int y = (size - base.height()) / 2;
        painter.drawPixmap(x, y, base);
    }

    if (unreadCount <= 0) {
        return canvas;
    }

    const QString text = unreadCount > 99 ? QStringLiteral("99+") : QString::number(unreadCount);
    const int digits = text.size();

    // Как Viber/Telegram: крупная таблетка в правом верхнем углу самой иконки.
    const int badgeH = qMax(12, qRound(size * 0.42));
    int badgeW = badgeH;
    if (digits == 2) {
        badgeW = qMax(badgeH + 4, qRound(size * 0.56));
    } else if (digits >= 3) {
        badgeW = qMax(badgeH + 6, qRound(size * 0.66));
    }

    const int inset = qMax(1, qRound(size * 0.02));
    const QRect badgeRect(size - badgeW - inset, inset, badgeW, badgeH);

    painter.setBrush(QColor("#ff3b30"));
    painter.setPen(Qt::NoPen);
    if (digits == 1) {
        painter.drawEllipse(badgeRect);
    } else {
        painter.drawRoundedRect(badgeRect, badgeH / 2.0, badgeH / 2.0);
    }

    QFont font = painter.font();
    font.setFamily(QStringLiteral("Segoe UI"));
    font.setBold(true);
    if (digits >= 3) {
        font.setPixelSize(qMax(8, qRound(badgeH * 0.46)));
    } else if (digits == 2) {
        font.setPixelSize(qMax(9, qRound(badgeH * 0.52)));
    } else {
        font.setPixelSize(qMax(10, qRound(badgeH * 0.58)));
    }
    painter.setFont(font);
    painter.setPen(Qt::white);
    painter.drawText(badgeRect, Qt::AlignCenter, text);

    return canvas;
}

QIcon buildBadgedIcon(const QIcon &baseIcon, int unreadCount)
{
    if (unreadCount <= 0 || baseIcon.isNull()) {
        return baseIcon;
    }

    QIcon badged;
    QList<int> targetSizes;
    for (const QSize &pxSize : baseIcon.availableSizes()) {
        if (pxSize.isValid()) {
            targetSizes << qMax(pxSize.width(), pxSize.height());
        }
    }
    if (targetSizes.isEmpty()) {
        targetSizes = {16, 20, 24, 32, 40, 48, 64, 128, 256};
    }

    for (const int size : targetSizes) {
        const QPixmap basePixmap = baseIcon.pixmap(size, size);
        if (basePixmap.isNull()) {
            continue;
        }
        badged.addPixmap(drawBadgedPixmap(basePixmap, unreadCount, size));
    }

    if (badged.isNull()) {
        for (const int size : {16, 24, 32, 48, 64, 128, 256}) {
            badged.addPixmap(drawBadgedPixmap(QPixmap(), unreadCount, size));
        }
    }

    return badged.isNull() ? baseIcon : badged;
}

#ifdef Q_OS_WIN
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0601
#endif
#include <objbase.h>
#include <shobjidl.h>
#include <windows.h>

void clearWindowsOverlay(QWidget *window)
{
    if (!window || !window->internalWinId()) {
        return;
    }

    const HWND hwnd = reinterpret_cast<HWND>(window->winId());
    if (!hwnd) {
        return;
    }

    ITaskbarList3 *taskbar = nullptr;
    if (FAILED(CoCreateInstance(CLSID_TaskbarList, nullptr, CLSCTX_INPROC_SERVER, IID_ITaskbarList3,
                              reinterpret_cast<void **>(&taskbar)))) {
        return;
    }
    taskbar->HrInit();
    taskbar->SetOverlayIcon(hwnd, nullptr, L"");
    taskbar->Release();
}
#endif

} // namespace

QIcon appIconWithUnreadBadge(const QIcon &baseIcon, int unreadCount)
{
    return buildBadgedIcon(baseIcon, unreadCount);
}

void applyUnreadBadgeToWindow(QWidget *window, const QIcon &baseIcon, int unreadCount)
{
    if (!window) {
        return;
    }

    const QIcon icon = unreadCount > 0 ? buildBadgedIcon(baseIcon, unreadCount) : baseIcon;
    window->setWindowIcon(icon);
    if (qApp) {
        qApp->setWindowIcon(icon);
    }

#ifdef Q_OS_WIN
    clearWindowsOverlay(window);
#else
    Q_UNUSED(unreadCount);
#endif
}

} // namespace aten
