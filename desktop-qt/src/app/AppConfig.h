#pragma once

#include <QUrl>

namespace aten {

class AppConfig final {
public:
    static AppConfig fromEnvironment();

    QUrl apiBaseUrl() const;
    void setApiBaseUrl(QUrl value);

private:
    QUrl m_apiBaseUrl;
};

} // namespace aten
