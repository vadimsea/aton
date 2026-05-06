#include "app/AppConfig.h"

#include <QProcessEnvironment>
#include <utility>

namespace aten {

AppConfig AppConfig::fromEnvironment()
{
    AppConfig config;
    const auto env = QProcessEnvironment::systemEnvironment();
    const auto apiUrl = env.value("ATEN_API_URL", "https://aton-api.onrender.com");
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
