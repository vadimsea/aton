#include <QApplication>
#include <QFile>
#include <QIcon>

#include "app/Application.h"

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
    QApplication qtApp(argc, argv);
    qtApp.setApplicationName("ATEN");
    qtApp.setApplicationDisplayName("ATEN");
    qtApp.setOrganizationName("ATEN");
    qtApp.setOrganizationDomain("aten.vadzim.by");
    QApplication::setQuitOnLastWindowClosed(false);

    const QIcon appIcon = loadAppIcon();
    if (!appIcon.isNull()) {
        qtApp.setWindowIcon(appIcon);
    }

    aten::Application app;
    app.start();

    return qtApp.exec();
}
