#pragma once

#include <QMainWindow>
#include <QByteArray>
#include <QJsonArray>
#include <QJsonObject>
#include <QMap>
#include <QSet>
#include <functional>

class QLabel;
class QLineEdit;
class QListWidget;
class QPushButton;
class QAudioInput;
class QMediaCaptureSession;
class QMediaRecorder;
class QNetworkAccessManager;
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
    void showMainWindow();

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
    void checkForUpdates();
    void handleReleaseManifest(const QJsonDocument &body);
    void renderChats(const QJsonDocument &body);
    void renderDialogs(const QJsonDocument &body);
    void renderMessagesAll(const QJsonDocument &body);
    void renderSidebar();
    void renderMessages(const QJsonDocument &body, const QString &requestedChatId);
    void removeMessageRowAnimated(const QString &messageId);
    void showProfileDialog();
    bool isSuperAdmin() const;
    void updateAdminControls();
    void requestAdminUsers();
    void showAdminUsersDialog(const QJsonDocument &body);
    void requestReports();
    void showReportsDialog(const QJsonDocument &body);
    void showReportDialog(const QString &title, const std::function<void(const QString &)> &submit);
    void reportCurrentChatOrPeer();
    void reportMessage(const QJsonObject &message);
    void verifyCurrentChat();
    void closeProfilePage();
    void saveProfilePage();
    void populateProfilePage();
    void showContactsDialog(const QJsonDocument &body);
    void showDiscoveryDialog();
    void showNotReady(const QString &title);
    void openSelectedChat();
    void sendComposerText();
    void setStatusText(const QString &text);
    void applyDesktopTheme(bool dark);
    void refreshChatStatusText();
    void updatePeerActionBar();
    QJsonObject currentGroupChatObject() const;
    bool canPostCurrentChat() const;
    void renameCurrentPeer();
    void showCreateChatDialog();
    bool canDeleteCurrentChat() const;
    void deleteCurrentChat();
    void sendImageAttachment();
    void sendAudioAttachment();
    void selectProfileAvatar();
    void startVoiceRecording();
    void stopVoiceRecording();
    void finishVoiceRecording();
    void setReplyToMessage(const QJsonObject &message);
    void clearReplyToMessage();
    void syncActiveChat();
    void loadOlderMessagesForCurrentChat();
    void requestMessagesBootstrap();
    void markCurrentChatRead();
    void processMessageSnapshot(const QJsonArray &messages, bool allowAlerts);
    QString chatTitleForId(const QString &chatId) const;
    QString messageTimeIso(const QJsonObject &msg) const;
    QString messageSender(const QJsonObject &msg) const;
    QString messageChatId(const QJsonObject &msg) const;
    bool shouldAlertForMessage(const QJsonObject &msg) const;
    void changeEvent(QEvent *event) override;
    void closeEvent(QCloseEvent *event) override;
    void showEvent(QShowEvent *event) override;
    bool eventFilter(QObject *watched, QEvent *event) override;
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
    QTextEdit *m_composer = nullptr;
    QPushButton *m_sendButton = nullptr;
    QPushButton *m_userPillButton = nullptr;
    QPushButton *m_adminUsersButton = nullptr;
    QPushButton *m_reportsButton = nullptr;
    QWidget *m_peerActionBar = nullptr;
    QWidget *m_replyCompose = nullptr;
    QLabel *m_replyComposeAuthorLabel = nullptr;
    QLabel *m_replyComposeTextLabel = nullptr;
    QPushButton *m_replyComposeCloseButton = nullptr;
    QPushButton *m_peerRenameButton = nullptr;
    QPushButton *m_peerBlockButton = nullptr;
    QPushButton *m_peerFriendButton = nullptr;
    QPushButton *m_peerReportButton = nullptr;
    QPushButton *m_peerNotifyButton = nullptr;
    QLabel *m_profileAvatarLabel = nullptr;
    QLabel *m_profileNameLabel = nullptr;
    QLabel *m_profilePublicIdLabel = nullptr;
    QLabel *m_profileBioLabel = nullptr;
    QLabel *m_profileVerifiedLabel = nullptr;
    QLineEdit *m_profileEmailInput = nullptr;
    QLineEdit *m_profileNameInput = nullptr;
    QLineEdit *m_profilePublicIdInput = nullptr;
    QTextEdit *m_profileBioInput = nullptr;
    QLabel *m_profileLanguageLabel = nullptr;
    QPushButton *m_profileRuButton = nullptr;
    QPushButton *m_profileDeButton = nullptr;
    QPushButton *m_profileEnButton = nullptr;
    QPushButton *m_profileAvatarButton = nullptr;
    QPushButton *m_micButton = nullptr;
    QString m_currentChatId;
    QString m_pendingChatDeleteEndpoint;
    QString m_currentPeerUsername;
    QString m_currentUsername;
    QJsonObject m_currentUser;
    QJsonObject m_contacts;
    QString m_chatFilter;
    QString m_authLanguage = "ru";
    bool m_registerMode = false;
    QJsonArray m_groupChats;
    QJsonArray m_adminChats;
    QJsonArray m_users;
    QJsonArray m_discoverChats;
    QJsonArray m_allMessages;
    QSet<QString> m_messagesHistoryComplete;
    QSet<QString> m_messagesHistoryLoading;
    QSet<QString> m_pendingOlderMessageRequests;
    QByteArray m_renderedDialogsFingerprint;
    QByteArray m_renderedMessagesFingerprint;
    QString m_renderedMessagesChatId;
    bool m_scrollToBottomOnNextMessages = false;
    QJsonObject m_replyToMessage;
    QString m_replyToMessageId;
    QTimer *m_syncTimer = nullptr;
    QTimer *m_updateTimer = nullptr;
    QNetworkAccessManager *m_updateNetwork = nullptr;
    bool m_updateCheckInProgress = false;
    bool m_contactsDialogRequested = false;
    bool m_adminUsersDialogRequested = false;
    bool m_reportsDialogRequested = false;
    NotificationHub *m_notifications = nullptr;
    QSet<QString> m_knownMessageIds;
    bool m_messageBaselineReady = false;
    bool m_messagesAllRequested = false;
    QMap<QString, int> m_unreadByChat;
    QMap<QString, QString> m_dialogTitles;
    QMap<QString, QString> m_dialogPeerLastSeen;
    QMap<QString, QString> m_peerLastSeenByUsername;
    QMap<QString, QString> m_peerBioByUsername;
    bool m_chatNotifyMuted = false;
    QString m_profileAvatarDataUrl;
    QMediaCaptureSession *m_voiceCaptureSession = nullptr;
    QAudioInput *m_voiceAudioInput = nullptr;
    QMediaRecorder *m_voiceRecorder = nullptr;
    QString m_voiceRecordingPath;
    bool m_voiceRecording = false;
    bool m_darkTheme = false;
    bool m_forceQuit = false;
};

} // namespace aten
