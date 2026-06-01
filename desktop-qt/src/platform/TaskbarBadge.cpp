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
#include <QImage>
#include <QPainter>
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
    QPixmap pixmap(32, 32);
    pixmap.fill(Qt::transparent);

    QPainter painter(&pixmap);
    painter.setRenderHint(QPainter::Antialiasing, true);
    painter.setBrush(QColor("#ef4444"));
    painter.setPen(Qt::NoPen);
    painter.drawEllipse(0, 0, 32, 32);

    QFont font = painter.font();
    font.setBold(true);
    font.setPixelSize(count > 99 ? 9 : (count > 9 ? 11 : 13));
    painter.setFont(font);
    painter.setPen(Qt::white);
    const QString text = count > 99 ? QStringLiteral("99+") : QString::number(count);
    painter.drawText(pixmap.rect(), Qt::AlignCenter, text);
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
        CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
        return true;
    }();
    Q_UNUSED(comReady);

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
