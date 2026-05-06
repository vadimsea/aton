#include "app/Application.h"

namespace aten {

Application::Application()
    : m_config(AppConfig::fromEnvironment()),
      m_sessionStore(),
      m_apiClient(m_config.apiBaseUrl(), &m_sessionStore)
{
}

Application::~Application() = default;

void Application::start()
{
    m_mainWindow = std::make_unique<MainWindow>(&m_apiClient, &m_sessionStore);
    m_mainWindow->show();
}

} // namespace aten
