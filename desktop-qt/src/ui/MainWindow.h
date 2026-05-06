#pragma once

#include <QMainWindow>
#include <QJsonArray>
#include <QMap>

class QLabel;
class QLineEdit;
class QListWidget;
class QPushButton;
class QStackedWidget;
class QWidget;

namespace aten {

class ApiClient;
class SessionStore;

class MainWindow final : public QMainWindow {
    Q_OBJECT

public:
    explicit MainWindow(ApiClient *apiClient, SessionStore *sessionStore, QWidget *parent = nullptr);

private:
    void buildUi();
    QWidget *buildAuthPage();
    QWidget *buildMessengerPage();
    void wireApi();
    void refreshSessionUi();
    void handleLogin();
    void switchAuthMode(bool registerMode);
    void setLanguage(const QString &lang);
    void updateAuthTexts();
    void loadAuthenticatedData();
    void renderChats(const QJsonDocument &body);
    void renderMessagesAll(const QJsonDocument &body);
    void renderSidebar();
    void renderMessages(const QJsonDocument &body);
    void openSelectedChat();
    void sendComposerText();
    void setStatusText(const QString &text);

    ApiClient *m_apiClient;
    SessionStore *m_sessionStore;
    QStackedWidget *m_stack = nullptr;
    QWidget *m_authPage = nullptr;
    QWidget *m_messengerPage = nullptr;
    QLineEdit *m_loginInput = nullptr;
    QLineEdit *m_registerEmailInput = nullptr;
    QLineEdit *m_registerUsernameInput = nullptr;
    QLineEdit *m_passwordInput = nullptr;
    QLineEdit *m_passwordConfirmInput = nullptr;
    QPushButton *m_loginTabButton = nullptr;
    QPushButton *m_registerTabButton = nullptr;
    QPushButton *m_ruButton = nullptr;
    QPushButton *m_deButton = nullptr;
    QPushButton *m_enButton = nullptr;
    QPushButton *m_loginButton = nullptr;
    QPushButton *m_forgotButton = nullptr;
    QLabel *m_authTitleLabel = nullptr;
    QLabel *m_authSubtitleLabel = nullptr;
    QLabel *m_authInfoTitleLabel = nullptr;
    QLabel *m_authInfoTextLabel = nullptr;
    QLabel *m_authWelcomeTitleLabel = nullptr;
    QLabel *m_authWelcomeSubtitleLabel = nullptr;
    QLabel *m_authHeroEyebrowLabel = nullptr;
    QLabel *m_loginFieldLabel = nullptr;
    QLabel *m_registerEmailLabel = nullptr;
    QLabel *m_registerUsernameLabel = nullptr;
    QLabel *m_passwordLabel = nullptr;
    QLabel *m_passwordConfirmLabel = nullptr;
    QLabel *m_authLangLabel = nullptr;
    QLabel *m_authStatusLabel = nullptr;
    QLabel *m_chatTitleLabel = nullptr;
    QLabel *m_statusLabel = nullptr;
    QLabel *m_accountLabel = nullptr;
    QListWidget *m_chatList = nullptr;
    QListWidget *m_messageList = nullptr;
    QLineEdit *m_composer = nullptr;
    QPushButton *m_sendButton = nullptr;
    QString m_currentChatId;
    QString m_currentUsername;
    QString m_authLanguage = "ru";
    bool m_registerMode = false;
    QJsonArray m_groupChats;
    QJsonArray m_allMessages;
};

} // namespace aten
