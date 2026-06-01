#pragma once

#include <QMainWindow>
#include <QJsonArray>
#include <QJsonObject>
#include <QMap>
#include <QSet>

class QLabel;
class QLineEdit;
class QListWidget;
class QPushButton;
class QStackedWidget;
class QTextEdit;
class QTimer;
class QWidget;

namespace aten {

class ApiClient;
class NotificationHub;
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
    void renderDialogs(const QJsonDocument &body);
    void renderMessagesAll(const QJsonDocument &body);
    void renderSidebar();
    void renderMessages(const QJsonDocument &body);
    void showProfileDialog();
    void closeProfilePage();
    void saveProfilePage();
    void populateProfilePage();
    void showContactsDialog(const QJsonDocument &body);
    void showNotReady(const QString &title);
    void openSelectedChat();
    void sendComposerText();
    void setStatusText(const QString &text);
    void updatePeerActionBar();
    void renameCurrentPeer();
    void setReplyToMessage(const QJsonObject &message);
    void clearReplyToMessage();
    void syncActiveChat();
    void markCurrentChatRead();
    void processMessageSnapshot(const QJsonArray &messages, bool allowAlerts);
    QString chatTitleForId(const QString &chatId) const;
    QString messageTimeIso(const QJsonObject &msg) const;
    QString messageSender(const QJsonObject &msg) const;
    QString messageChatId(const QJsonObject &msg) const;
    bool shouldAlertForMessage(const QJsonObject &msg) const;
    void changeEvent(QEvent *event) override;
    QString currentPeerStatus() const;

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
    QLineEdit *m_chatSearch = nullptr;
    QListWidget *m_chatList = nullptr;
    QListWidget *m_messageList = nullptr;
    QWidget *m_profilePage = nullptr;
    QWidget *m_composerPanel = nullptr;
    QLineEdit *m_composer = nullptr;
    QPushButton *m_sendButton = nullptr;
    QPushButton *m_userPillButton = nullptr;
    QWidget *m_peerActionBar = nullptr;
    QWidget *m_replyCompose = nullptr;
    QLabel *m_replyComposeAuthorLabel = nullptr;
    QLabel *m_replyComposeTextLabel = nullptr;
    QPushButton *m_replyComposeCloseButton = nullptr;
    QPushButton *m_peerRenameButton = nullptr;
    QPushButton *m_peerBlockButton = nullptr;
    QPushButton *m_peerFriendButton = nullptr;
    QPushButton *m_peerNotifyButton = nullptr;
    QLabel *m_profileAvatarLabel = nullptr;
    QLabel *m_profileNameLabel = nullptr;
    QLabel *m_profilePublicIdLabel = nullptr;
    QLabel *m_profileVerifiedLabel = nullptr;
    QLineEdit *m_profileEmailInput = nullptr;
    QLineEdit *m_profileNameInput = nullptr;
    QLineEdit *m_profilePublicIdInput = nullptr;
    QTextEdit *m_profileBioInput = nullptr;
    QString m_currentChatId;
    QString m_currentPeerUsername;
    QString m_currentUsername;
    QJsonObject m_currentUser;
    QJsonObject m_contacts;
    QString m_chatFilter;
    QString m_authLanguage = "ru";
    bool m_registerMode = false;
    QJsonArray m_groupChats;
    QJsonArray m_allMessages;
    QJsonObject m_replyToMessage;
    QString m_replyToMessageId;
    QTimer *m_syncTimer = nullptr;
    bool m_contactsDialogRequested = false;
    NotificationHub *m_notifications = nullptr;
    QSet<QString> m_knownMessageIds;
    bool m_messageBaselineReady = false;
    QMap<QString, int> m_unreadByChat;
    QMap<QString, QString> m_dialogTitles;
    bool m_chatNotifyMuted = false;
};

} // namespace aten
