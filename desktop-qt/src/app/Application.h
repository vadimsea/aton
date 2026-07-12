#pragma once

#include <memory>

#include <QLocalServer>

#include "app/AppConfig.h"
#include "net/ApiClient.h"
#include "session/SessionStore.h"
#include "ui/MainWindow.h"

namespace aten {

class Application final {
public:
    Application();
    ~Application();

    void start();
    void activateWindow();

private:
    AppConfig m_config;
    SessionStore m_sessionStore;
    ApiClient m_apiClient;
    QLocalServer m_singleInstanceServer;
    std::unique_ptr<MainWindow> m_mainWindow;
};

} // namespace aten
