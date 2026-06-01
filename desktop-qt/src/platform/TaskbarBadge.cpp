#include "platform/TaskbarBadge.h"

#include <QWidget>

#ifdef Q_OS_WIN
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0601
#endif
#include <objbase.h>
#include <shobjidl.h>
#include <windows.h>

#include <QColor>
#include <QFont>
#include <QImage>
#include <QPainter>
#include <QPen>
#include <QPixmap>
#include <Qt>

namespace {

HICON pixmapToHicon(const QPixmap &pixmap)
{
    const QImage image = pixmap.toImage().convertToFormat(QImage::Format_ARGB32);
    if (image.isNull()) {
        return nullptr;
    }

    HDC screen = GetDC(nullptr);
    HDC hdc = CreateCompatibleDC(screen);
    ReleaseDC(nullptr, screen);

    BITMAPINFO bmi{};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = image.width();
    bmi.bmiHeader.biHeight = -image.height();
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;

    void *bits = nullptr;
    HBITMAP colorBitmap = CreateDIBSection(hdc, &bmi, DIB_RGB_COLORS, &bits, nullptr, 0);
    if (!colorBitmap || !bits) {
        DeleteDC(hdc);
        return nullptr;
    }

    memcpy(bits, image.constBits(), static_cast<size_t>(image.sizeInBytes()));

    HBITMAP maskBitmap = CreateBitmap(image.width(), image.height(), 1, 1, nullptr);
    ICONINFO iconInfo{};
    iconInfo.fIcon = TRUE;
    iconInfo.hbmColor = colorBitmap;
    iconInfo.hbmMask = maskBitmap;
    const HICON icon = CreateIconIndirect(&iconInfo);

    DeleteObject(colorBitmap);
    DeleteObject(maskBitmap);
    DeleteDC(hdc);
    return icon;
}

QPixmap makeBadgePixmap(int count)
{
    // 32×32 overlay @ 200% DPI — крупный бейдж как Viber/Telegram на панели задач.
    constexpr int canvas = 32;
    QPixmap pixmap(canvas, canvas);
    pixmap.fill(Qt::transparent);

    QPainter painter(&pixmap);
    painter.setRenderHint(QPainter::Antialiasing, true);
    painter.setRenderHint(QPainter::TextAntialiasing, true);

    const QString text = count > 99 ? QStringLiteral("99+") : QString::number(count);
    const int digits = text.size();
    int badgeW = 22;
    int badgeH = 22;
    if (digits >= 3) {
        badgeW = 28;
        badgeH = 20;
    } else if (digits == 2) {
        badgeW = 26;
        badgeH = 20;
    }
    const int x = canvas - badgeW + 2;
    const int y = canvas - badgeH + 2;
    const QRect badgeRect(x, y, badgeW, badgeH);

    painter.setBrush(QColor("#fa3e3e"));
    painter.setPen(QPen(QColor("#ffffff"), 1.2));
    if (digits == 1) {
        painter.drawEllipse(badgeRect);
    } else {
        painter.drawRoundedRect(badgeRect, badgeH / 2.0, badgeH / 2.0);
    }

    QFont font = painter.font();
    font.setBold(true);
    font.setFamily(QStringLiteral("Segoe UI"));
    if (digits >= 3) {
        font.setPixelSize(11);
    } else if (digits == 2) {
        font.setPixelSize(13);
    } else {
        font.setPixelSize(15);
    }
    painter.setFont(font);
    painter.setPen(Qt::white);
    painter.drawText(badgeRect, Qt::AlignCenter, text);
    return pixmap;
}

} // namespace
#endif

namespace aten {

void setTaskbarOverlayBadge(QWidget *window, int unreadCount)
{
    if (!window) {
        return;
    }

#ifdef Q_OS_WIN
    const HWND hwnd = reinterpret_cast<HWND>(window->winId());
    if (!hwnd) {
        return;
    }

    static const bool comReady = []() {
        const HRESULT hr = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
        return SUCCEEDED(hr) || hr == RPC_E_CHANGED_MODE || hr == S_FALSE;
    }();
    Q_UNUSED(comReady);

    if (!window->internalWinId()) {
        return;
    }

    ITaskbarList3 *taskbar = nullptr;
    if (FAILED(CoCreateInstance(CLSID_TaskbarList, nullptr, CLSCTX_INPROC_SERVER, IID_ITaskbarList3,
                              reinterpret_cast<void **>(&taskbar)))) {
        return;
    }
    taskbar->HrInit();

    if (unreadCount <= 0) {
        taskbar->SetOverlayIcon(hwnd, nullptr, L"");
        taskbar->Release();
        return;
    }

    const QPixmap badge = makeBadgePixmap(unreadCount);
    HICON icon = pixmapToHicon(badge);
    if (icon) {
        taskbar->SetOverlayIcon(hwnd, icon, L"ATEN unread messages");
        DestroyIcon(icon);
    }
    taskbar->Release();
#else
    Q_UNUSED(unreadCount);
#endif
}

} // namespace aten
