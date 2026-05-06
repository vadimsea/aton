#pragma once

#include <memory>

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

private:
    AppConfig m_config;
    SessionStore m_sessionStore;
    ApiClient m_apiClient;
    std::unique_ptr<MainWindow> m_mainWindow;
};

} // namespace aten
