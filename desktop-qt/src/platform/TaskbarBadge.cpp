#include "platform/TaskbarBadge.h"

#include <QApplication>
#include <QColor>
#include <QCoreApplication>
#include <QDebug>
#include <QFile>
#include <QFont>
#include <QIcon>
#include <QMainWindow>
#include <QPainter>
#include <QPixmap>
#include <QProcess>
#include <QSet>
#include <QWidget>

namespace aten {

namespace {

int s_lastOverlayCount = -1;

QPixmap drawCornerBadgePixmap(const QPixmap &basePixmap, int unreadCount, int size)
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

    const int badgeH = qMax(8, qRound(size * 0.46));
    int badgeW = badgeH;
    if (digits == 2) {
        badgeW = qMax(badgeH + 2, qRound(size * 0.58));
    } else if (digits >= 3) {
        badgeW = qMax(badgeH + 3, qRound(size * 0.66));
    }

    const int inset = qMax(0, qRound(size * 0.04));
    const QRect badgeRect(size - badgeW - inset, size - badgeH - inset, badgeW, badgeH);

    painter.setBrush(QColor("#ff3b30"));
    painter.setPen(QPen(QColor("#ffffff"), size <= 20 ? 1.0 : 1.4));
    if (digits == 1) {
        painter.drawEllipse(badgeRect);
    } else {
        painter.drawRoundedRect(badgeRect, badgeH / 2.0, badgeH / 2.0);
    }

    QFont font = painter.font();
    font.setFamily(QStringLiteral("Segoe UI"));
    font.setBold(true);
    if (digits >= 3) {
        font.setPixelSize(qMax(7, qRound(badgeH * 0.44)));
    } else if (digits == 2) {
        font.setPixelSize(qMax(8, qRound(badgeH * 0.50)));
    } else {
        font.setPixelSize(qMax(9, qRound(badgeH * 0.56)));
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
    QSet<int> targetSizes;
    for (const QSize &pxSize : baseIcon.availableSizes()) {
        if (pxSize.isValid()) {
            targetSizes.insert(qBound(16, qMax(pxSize.width(), pxSize.height()), 256));
        }
    }
    targetSizes.insert(16);
    targetSizes.insert(24);
    targetSizes.insert(32);

    for (const int size : targetSizes) {
        const QPixmap basePixmap = baseIcon.pixmap(size, size);
        if (basePixmap.isNull()) {
            continue;
        }
        badged.addPixmap(drawCornerBadgePixmap(basePixmap, unreadCount, size));
    }

    return badged.isNull() ? baseIcon : badged;
}

#ifdef Q_OS_WIN
#include <windows.h>

#include <QImage>

HICON pixmapToHicon(const QPixmap &pixmap)
{
    QImage image = pixmap.toImage().convertToFormat(QImage::Format_ARGB32);
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

    const int dibStride = ((image.width() * 4 + 3) / 4) * 4;
    const int copyWidth = image.width() * 4;
    for (int y = 0; y < image.height(); ++y) {
        memcpy(static_cast<char *>(bits) + y * dibStride, image.constScanLine(y), static_cast<size_t>(copyWidth));
    }

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

HWND taskbarWindowHandle(QWidget *window)
{
    if (!window) {
        return nullptr;
    }

    window->winId();
    HWND hwnd = reinterpret_cast<HWND>(window->winId());
    if (hwnd && IsWindow(hwnd)) {
        HWND root = GetAncestor(hwnd, GA_ROOT);
        if (root && IsWindow(root)) {
            return root;
        }
        return hwnd;
    }

    const DWORD pid = GetCurrentProcessId();
    struct EnumData {
        DWORD pid;
        HWND result;
    } data{pid, nullptr};

    EnumWindows(
        [](HWND candidate, LPARAM lParam) -> BOOL {
            auto *ctx = reinterpret_cast<EnumData *>(lParam);
            DWORD windowPid = 0;
            GetWindowThreadProcessId(candidate, &windowPid);
            if (windowPid != ctx->pid || !IsWindowVisible(candidate)) {
                return TRUE;
            }
            wchar_t title[256];
            const int len = GetWindowTextW(candidate, title, 256);
            if (len <= 0) {
                return TRUE;
            }
            const QString windowTitle = QString::fromWCharArray(title, len);
            if (!windowTitle.contains(QStringLiteral("ATEN"), Qt::CaseInsensitive)) {
                return TRUE;
            }
            ctx->result = candidate;
            return FALSE;
        },
        reinterpret_cast<LPARAM>(&data));

    return data.result;
}

void applyNativeTaskbarIcons(QWidget *window, const QIcon &icon)
{
    const HWND hwnd = taskbarWindowHandle(window);
    if (!hwnd) {
        return;
    }

    const HICON smallIcon = pixmapToHicon(icon.pixmap(16, 16));
    const HICON bigIcon = pixmapToHicon(icon.pixmap(32, 32));
    if (smallIcon) {
        SendMessageW(hwnd, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(smallIcon));
    }
    if (bigIcon) {
        SendMessageW(hwnd, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(bigIcon));
    }
}

void launchOverlayHelper(QWidget *window, int unreadCount)
{
    if (!window) {
        return;
    }
    if (unreadCount <= 0 && s_lastOverlayCount <= 0) {
        return;
    }

    const HWND hwnd = taskbarWindowHandle(window);
    if (!hwnd) {
        return;
    }

    const QString helperPath = QCoreApplication::applicationDirPath() + QStringLiteral("/aten-overlay-helper.exe");
    if (!QFile::exists(helperPath)) {
        return;
    }

    const QStringList args = {
        QString::number(static_cast<qulonglong>(reinterpret_cast<ULONG_PTR>(hwnd))),
        QString::number(unreadCount),
    };
    QProcess helper;
    helper.setProgram(helperPath);
    helper.setArguments(args);
    helper.start();
    const bool finished = helper.waitForFinished(750);
    if (!finished) {
        helper.kill();
        helper.waitForFinished(250);
        qWarning() << "taskbar badge helper timed out"
                   << "hwnd" << args.value(0)
                   << "count" << unreadCount;
    } else if (helper.exitStatus() != QProcess::NormalExit || helper.exitCode() != 0) {
        qWarning() << "taskbar badge helper failed"
                   << "exitStatus" << helper.exitStatus()
                   << "exitCode" << helper.exitCode()
                   << "stderr" << QString::fromLocal8Bit(helper.readAllStandardError());
    }
    if (unreadCount > 0) {
        s_lastOverlayCount = unreadCount;
    } else {
        s_lastOverlayCount = 0;
    }
}
#endif

void updateWindowUnreadTitle(QWidget *window, int unreadCount)
{
    auto *mainWindow = qobject_cast<QMainWindow *>(window);
    if (!mainWindow) {
        return;
    }
    mainWindow->setWindowTitle(unreadCount > 0 ? QStringLiteral("(%1) ATEN").arg(unreadCount)
                                                : QStringLiteral("ATEN"));
}

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

    updateWindowUnreadTitle(window, unreadCount);

    window->setWindowIcon(baseIcon);

#ifdef Q_OS_WIN
    applyNativeTaskbarIcons(window, baseIcon);
    launchOverlayHelper(window, unreadCount);
#else
    const QIcon taskbarIcon =
        unreadCount > 0 ? buildBadgedIcon(baseIcon, unreadCount) : baseIcon;
    window->setWindowIcon(taskbarIcon);
    Q_UNUSED(baseIcon);
#endif
}

} // namespace aten
