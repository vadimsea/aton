#include <windows.h>
#include <gdiplus.h>
#include <objbase.h>
#include <shobjidl.h>

#include <cstdio>
#include <cstdlib>

using namespace Gdiplus;

static HICON createBadgeIcon(int count)
{
    const int size = 32;
    Bitmap bitmap(size, size, PixelFormat32bppARGB);
    Graphics graphics(&bitmap);
    graphics.SetSmoothingMode(SmoothingModeAntiAlias);
    graphics.SetTextRenderingHint(TextRenderingHintClearTypeGridFit);
    graphics.Clear(Color(0, 0, 0, 0));

    SolidBrush red(Color(255, 255, 59, 48));
    SolidBrush white(Color(255, 255, 255, 255));
    Pen border(Color(255, 255, 255, 255), 2.0f);
    graphics.FillEllipse(&red, 1.0f, 1.0f, 30.0f, 30.0f);
    graphics.DrawEllipse(&border, 1.0f, 1.0f, 30.0f, 30.0f);

    wchar_t text[8];
    if (count > 99) {
        wcscpy(text, L"99+");
    } else {
        _snwprintf(text, 8, L"%d", count);
    }

    FontFamily family(L"Segoe UI");
    const REAL fontSize = count > 99 ? 12.5f : (count > 9 ? 16.0f : 18.5f);
    Font font(&family, fontSize, FontStyleBold, UnitPixel);
    StringFormat format;
    format.SetAlignment(StringAlignmentCenter);
    format.SetLineAlignment(StringAlignmentCenter);
    RectF rect(0.0f, -1.0f, static_cast<REAL>(size), static_cast<REAL>(size));
    graphics.DrawString(text, -1, &font, rect, &format, &white);

    HICON icon = nullptr;
    bitmap.GetHICON(&icon);
    return icon;
}

int main(int argc, char *argv[])
{
    if (argc < 3) {
        return 2;
    }

    const HWND hwnd = reinterpret_cast<HWND>(static_cast<ULONG_PTR>(_strtoui64(argv[1], nullptr, 10)));
    const int count = std::atoi(argv[2]);
    if (!hwnd || !IsWindow(hwnd)) {
        return 3;
    }

    GdiplusStartupInput gdiplusInput;
    ULONG_PTR gdiplusToken = 0;
    if (GdiplusStartup(&gdiplusToken, &gdiplusInput, nullptr) != Ok) {
        return 6;
    }

    OleInitialize(nullptr);

    ITaskbarList3 *taskbar = nullptr;
    if (FAILED(CoCreateInstance(CLSID_TaskbarList, nullptr, CLSCTX_INPROC_SERVER, IID_ITaskbarList3,
                                reinterpret_cast<void **>(&taskbar)))) {
        OleUninitialize();
        return 4;
    }
    taskbar->HrInit();

    if (count <= 0) {
        taskbar->SetOverlayIcon(hwnd, nullptr, L"");
        taskbar->Release();
        OleUninitialize();
        GdiplusShutdown(gdiplusToken);
        return 0;
    }

    HICON icon = createBadgeIcon(count);
    if (icon) {
        taskbar->SetOverlayIcon(hwnd, icon, L"ATEN unread messages");
        DestroyIcon(icon);
    }
    taskbar->Release();
    OleUninitialize();
    GdiplusShutdown(gdiplusToken);
    return icon ? 0 : 5;
}
