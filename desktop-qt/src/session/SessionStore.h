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

    QString chatReadAt(const QString &chatId) const;
    void setChatReadAt(const QString &chatId, const QString &isoTimestamp);
    void clearChatReads();
    bool isChatMuted(const QString &chatId) const;
    void setChatMuted(const QString &chatId, bool muted);
    QString uiLanguage() const;
    void setUiLanguage(const QString &language);

private:
    QSettings m_settings;
};

} // namespace aten
