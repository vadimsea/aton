#include "session/SessionStore.h"

namespace aten {

namespace {
constexpr auto TokenKey = "auth/token";
}

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

} // namespace aten
