#include "session/SessionStore.h"

namespace aten {

namespace {
constexpr auto TokenKey = "auth/token";
constexpr auto ReadPrefix = "reads/";
} // namespace

SessionStore::SessionStore()
    : m_settings("ATEN", "ATEN Desktop")
{
}

QString SessionStore::token() const
{
    return m_settings.value(TokenKey).toString();
}

void SessionStore::setToken(const QString &token)
{
    if (token.trimmed().isEmpty()) {
        clear();
        return;
    }
    m_settings.setValue(TokenKey, token.trimmed());
}

void SessionStore::clear()
{
    m_settings.remove(TokenKey);
}

bool SessionStore::hasToken() const
{
    return !token().isEmpty();
}

QString SessionStore::chatReadAt(const QString &chatId) const
{
    if (chatId.isEmpty()) {
        return {};
    }
    return m_settings.value(ReadPrefix + chatId).toString();
}

void SessionStore::setChatReadAt(const QString &chatId, const QString &isoTimestamp)
{
    if (chatId.isEmpty()) {
        return;
    }
    m_settings.setValue(ReadPrefix + chatId, isoTimestamp);
}

void SessionStore::clearChatReads()
{
    const QStringList keys = m_settings.allKeys();
    for (const QString &key : keys) {
        if (key.startsWith(ReadPrefix)) {
            m_settings.remove(key);
        }
    }
}

} // namespace aten
