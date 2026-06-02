#include "app/AppConfig.h"

#include <QCoreApplication>
#include <QFile>
#include <QProcessEnvironment>
#include <utility>

namespace aten {

namespace {

QString readApiUrlFile()
{
    const auto path = QCoreApplication::applicationDirPath() + QStringLiteral("/aten-api.url");
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        return {};
    }
    return QString::fromUtf8(file.readAll()).trimmed();
}

} // namespace

AppConfig AppConfig::fromEnvironment()
{
    AppConfig config;
    const auto env = QProcessEnvironment::systemEnvironment();
    QString apiUrl = env.value(QStringLiteral("ATEN_API_URL")).trimmed();
    if (apiUrl.isEmpty()) {
        apiUrl = readApiUrlFile();
    }
    if (apiUrl.isEmpty()) {
        apiUrl = QStringLiteral("https://aton-api-2.onrender.com");
    }
    config.setApiBaseUrl(QUrl(apiUrl));
    return config;
}

QUrl AppConfig::apiBaseUrl() const
{
    return m_apiBaseUrl;
}

void AppConfig::setApiBaseUrl(QUrl value)
{
    m_apiBaseUrl = std::move(value);
}

} // namespace aten
