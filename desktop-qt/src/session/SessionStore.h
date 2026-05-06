#pragma once

#include <QSettings>
#include <QString>

namespace aten {

class SessionStore final {
public:
    SessionStore();

    QString token() const;
    void setToken(const QString &token);
    void clear();
    bool hasToken() const;

private:
    QSettings m_settings;
};

} // namespace aten
