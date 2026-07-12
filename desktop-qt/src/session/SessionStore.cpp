#include "session/SessionStore.h"

namespace aten {

namespace {
constexpr auto TokenKey = "auth/token";
constexpr auto ReadPrefix = "reads/";
constexpr auto MutedPrefix = "muted/";
constexpr auto LanguageKey = "ui/language";
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

bool SessionStore::isChatMuted(const QString &chatId) const
{
    return !chatId.isEmpty() && m_settings.value(MutedPrefix + chatId, false).toBool();
}

void SessionStore::setChatMuted(const QString &chatId, bool muted)
{
    if (chatId.isEmpty()) {
        return;
    }
    if (muted) {
        m_settings.setValue(MutedPrefix + chatId, true);
    } else {
        m_settings.remove(MutedPrefix + chatId);
    }
}

QString SessionStore::uiLanguage() const
{
    const auto language = m_settings.value(LanguageKey, "ru").toString().trimmed().toLower();
    if (language == "de" || language == "en") {
        return language;
    }
    return "ru";
}

void SessionStore::setUiLanguage(const QString &language)
{
    const auto normalized = language.trimmed().toLower();
    if (normalized == "ru" || normalized == "de" || normalized == "en") {
        m_settings.setValue(LanguageKey, normalized);
    }
}

} // namespace aten
