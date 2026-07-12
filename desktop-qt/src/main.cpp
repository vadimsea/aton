#include <QApplication>
#include <QFile>
#include <QIcon>
#include <QLocalServer>
#include <QLocalSocket>

#include "AppVersion.h"
#include "app/Application.h"

#ifdef Q_OS_WIN
#include <shobjidl.h>
#endif

namespace {

constexpr auto SingleInstanceKey = "aten-desktop-instance";

bool activateExistingInstance()
{
    QLocalSocket socket;
    socket.connectToServer(SingleInstanceKey);
    if (!socket.waitForConnected(400)) {
        return false;
    }
    socket.write("activate");
    socket.flush();
    socket.waitForBytesWritten(400);
    return true;
}

} // namespace

static QIcon loadAppIcon()
{
    const QString appDir = QCoreApplication::applicationDirPath();
    const QStringList candidates = {
        appDir + "/aten-logo.ico",
        appDir + "/aten-logo.png",
        appDir + "/../resources/aten-logo.ico",
        appDir + "/../resources/aten-logo.png",
    };
    for (const QString &path : candidates) {
        if (!QFile::exists(path)) {
            continue;
        }
        const QIcon icon(path);
        if (!icon.isNull()) {
            return icon;
        }
    }
    return QIcon();
}

int main(int argc, char *argv[])
{
#ifdef Q_OS_WIN
    SetCurrentProcessExplicitAppUserModelID(L"Aten.ATEN.Desktop");
#endif

    QApplication qtApp(argc, argv);
    qtApp.setApplicationName("ATEN");
    qtApp.setApplicationDisplayName("ATEN");
    qtApp.setApplicationVersion(ATEN_VERSION);
    qtApp.setOrganizationName("ATEN");
    qtApp.setOrganizationDomain("aten.vadzim.by");
    QApplication::setQuitOnLastWindowClosed(false);

    const QIcon appIcon = loadAppIcon();
    if (!appIcon.isNull()) {
        qtApp.setWindowIcon(appIcon);
    }

    if (activateExistingInstance()) {
        return 0;
    }

    aten::Application app;
    app.start();

    return qtApp.exec();
}
