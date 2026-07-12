#include "app/Application.h"

#include <QCoreApplication>
#include <QLocalSocket>
#include <QTimer>

namespace aten {

namespace {
constexpr auto SingleInstanceKey = "aten-desktop-instance";
} // namespace

Application::Application()
    : m_config(AppConfig::fromEnvironment()),
      m_sessionStore(),
      m_apiClient(m_config.apiBaseUrl(), &m_sessionStore)
{
}

Application::~Application() = default;

void Application::activateWindow()
{
    if (m_mainWindow) {
        m_mainWindow->showMainWindow();
    }
}

void Application::start()
{
    QLocalServer::removeServer(SingleInstanceKey);
    if (!m_singleInstanceServer.listen(SingleInstanceKey)) {
        QLocalServer::removeServer(SingleInstanceKey);
        m_singleInstanceServer.listen(SingleInstanceKey);
    }

    QObject::connect(&m_singleInstanceServer, &QLocalServer::newConnection, QCoreApplication::instance(),
                     [this]() {
        while (m_singleInstanceServer.hasPendingConnections()) {
            if (auto *socket = m_singleInstanceServer.nextPendingConnection()) {
                socket->disconnectFromServer();
                socket->deleteLater();
            }
        }
        activateWindow();
    });

    m_mainWindow = std::make_unique<MainWindow>(&m_apiClient, &m_sessionStore);
    m_mainWindow->showMainWindow();
    QTimer::singleShot(0, m_mainWindow.get(), [this]() {
        activateWindow();
    });
}

} // namespace aten
