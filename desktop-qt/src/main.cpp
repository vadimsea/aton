#include <QApplication>

#include "app/Application.h"

int main(int argc, char *argv[])
{
    QApplication qtApp(argc, argv);
    qtApp.setApplicationName("ATEN");
    qtApp.setApplicationDisplayName("ATEN");
    qtApp.setOrganizationName("ATEN");
    qtApp.setOrganizationDomain("aten.vadzim.by");

    aten::Application app;
    app.start();

    return qtApp.exec();
}
