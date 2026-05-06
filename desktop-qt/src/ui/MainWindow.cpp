#include "ui/MainWindow.h"

#include <QHBoxLayout>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QListWidgetItem>
#include <QPushButton>
#include <QSplitter>
#include <QStackedWidget>
#include <QStatusBar>
#include <QVBoxLayout>
#include <QWidget>

#include "net/ApiClient.h"
#include "session/SessionStore.h"
#include "ui/Theme.h"

namespace aten {

MainWindow::MainWindow(ApiClient *apiClient, SessionStore *sessionStore, QWidget *parent)
    : QMainWindow(parent),
      m_apiClient(apiClient),
      m_sessionStore(sessionStore)
{
    setWindowTitle("ATEN");
    resize(1280, 780);
    setMinimumSize(960, 620);
    setStyleSheet(Theme::styleSheet());

    buildUi();
    wireApi();
    refreshSessionUi();

    if (m_apiClient) {
        m_apiClient->getHealth();
    }
}

void MainWindow::buildUi()
{
    auto *root = new QWidget(this);
    auto *rootLayout = new QVBoxLayout(root);
    rootLayout->setContentsMargins(0, 0, 0, 0);
    rootLayout->setSpacing(0);
    m_stack = new QStackedWidget(root);
    m_authPage = buildAuthPage();
    m_messengerPage = buildMessengerPage();
    m_stack->addWidget(m_authPage);
    m_stack->addWidget(m_messengerPage);
    rootLayout->addWidget(m_stack);
    setCentralWidget(root);
    statusBar()->hide();
}

QWidget *MainWindow::buildAuthPage()
{
    auto *page = new QWidget(this);
    auto *outer = new QVBoxLayout(page);
    outer->setContentsMargins(0, 0, 0, 0);
    outer->setAlignment(Qt::AlignCenter);

    auto *panel = new QWidget(page);
    panel->setObjectName("AuthPanel");
    panel->setFixedWidth(380);
    auto *layout = new QVBoxLayout(panel);
    layout->setContentsMargins(24, 24, 24, 24);
    layout->setSpacing(12);

    auto *title = new QLabel("ATEN", panel);
    auto titleFont = title->font();
    titleFont.setPointSize(24);
    titleFont.setBold(true);
    title->setFont(titleFont);
    auto *subtitle = new QLabel("Desktop messenger", panel);
    subtitle->setObjectName("MutedText");

    m_loginInput = new QLineEdit(panel);
    m_loginInput->setPlaceholderText("Email or username");
    m_passwordInput = new QLineEdit(panel);
    m_passwordInput->setPlaceholderText("Password");
    m_passwordInput->setEchoMode(QLineEdit::Password);
    m_loginButton = new QPushButton("Sign in", panel);
    m_loginButton->setObjectName("PrimaryButton");
    m_statusLabel = new QLabel("Connecting to API...", panel);
    m_statusLabel->setObjectName("MutedText");
    m_statusLabel->setWordWrap(true);

    layout->addWidget(title);
    layout->addWidget(subtitle);
    layout->addSpacing(12);
    layout->addWidget(m_loginInput);
    layout->addWidget(m_passwordInput);
    layout->addWidget(m_loginButton);
    layout->addWidget(m_statusLabel);
    outer->addWidget(panel);

    connect(m_loginButton, &QPushButton::clicked, this, &MainWindow::handleLogin);
    connect(m_passwordInput, &QLineEdit::returnPressed, this, &MainWindow::handleLogin);
    return page;
}

QWidget *MainWindow::buildMessengerPage()
{
    auto *page = new QWidget(this);
    auto *rootLayout = new QHBoxLayout(page);
    rootLayout->setContentsMargins(0, 0, 0, 0);
    rootLayout->setSpacing(0);

    auto *splitter = new QSplitter(Qt::Horizontal, page);
    splitter->setChildrenCollapsible(false);

    auto *sidebar = new QWidget(splitter);
    sidebar->setObjectName("Sidebar");
    sidebar->setMinimumWidth(300);
    sidebar->setMaximumWidth(420);
    auto *sidebarLayout = new QVBoxLayout(sidebar);
    sidebarLayout->setContentsMargins(18, 18, 18, 14);
    sidebarLayout->setSpacing(14);

    auto *brand = new QLabel("ATEN", sidebar);
    auto font = brand->font();
    font.setPointSize(17);
    font.setBold(true);
    brand->setFont(font);
    sidebarLayout->addWidget(brand);

    m_accountLabel = new QLabel("Not signed in", sidebar);
    m_accountLabel->setObjectName("MutedText");
    sidebarLayout->addWidget(m_accountLabel);

    m_chatList = new QListWidget(sidebar);
    m_chatList->addItem("Loading chats...");
    sidebarLayout->addWidget(m_chatList, 1);
    connect(m_chatList, &QListWidget::itemActivated, this, &MainWindow::openSelectedChat);
    connect(m_chatList, &QListWidget::currentItemChanged, this, &MainWindow::openSelectedChat);

    auto *logoutButton = new QPushButton("Log out", sidebar);
    sidebarLayout->addWidget(logoutButton);
    connect(logoutButton, &QPushButton::clicked, this, [this]() {
        if (m_apiClient) {
            m_apiClient->logout();
        }
        if (m_sessionStore) {
            m_sessionStore->clear();
        }
        refreshSessionUi();
    });

    auto *content = new QWidget(splitter);
    auto *contentLayout = new QVBoxLayout(content);
    contentLayout->setContentsMargins(0, 0, 0, 0);
    contentLayout->setSpacing(0);

    auto *header = new QWidget(content);
    header->setObjectName("ChatHeader");
    auto *headerLayout = new QVBoxLayout(header);
    headerLayout->setContentsMargins(18, 12, 18, 12);
    headerLayout->setSpacing(2);
    auto *chatTitle = new QLabel("Aton Voice", header);
    auto titleFont = chatTitle->font();
    titleFont.setPointSize(14);
    titleFont.setBold(true);
    chatTitle->setFont(titleFont);
    m_statusLabel = new QLabel("Connecting to API...", header);
    headerLayout->addWidget(chatTitle);
    headerLayout->addWidget(m_statusLabel);
    contentLayout->addWidget(header);

    m_messageList = new QListWidget(content);
    m_messageList->addItem("Desktop client infrastructure is ready.");
    m_messageList->addItem("Next step: auth and real chat loading.");
    contentLayout->addWidget(m_messageList, 1);

    auto *composer = new QWidget(content);
    composer->setObjectName("Composer");
    auto *composerLayout = new QHBoxLayout(composer);
    composerLayout->setContentsMargins(18, 12, 18, 12);
    composerLayout->setSpacing(10);
    m_composer = new QLineEdit(composer);
    m_composer->setPlaceholderText("Message...");
    m_sendButton = new QPushButton("Send", composer);
    m_sendButton->setObjectName("PrimaryButton");
    composerLayout->addWidget(m_composer, 1);
    composerLayout->addWidget(m_sendButton);
    contentLayout->addWidget(composer);
    connect(m_sendButton, &QPushButton::clicked, this, &MainWindow::sendComposerText);
    connect(m_composer, &QLineEdit::returnPressed, this, &MainWindow::sendComposerText);

    splitter->addWidget(sidebar);
    splitter->addWidget(content);
    splitter->setSizes({360, 920});
    rootLayout->addWidget(splitter);

    return page;
}

void MainWindow::wireApi()
{
    if (!m_apiClient) return;

    connect(m_apiClient, &ApiClient::requestSucceeded, this, [this](const QString &endpoint, const QJsonDocument &body) {
        if (endpoint == "/api/health") {
            const auto obj = body.object();
            const auto service = obj.value("service").toString("aton-api");
            setStatusText(QString("API online: %1").arg(service));
            return;
        }
        if (endpoint == "/api/login") {
            const auto obj = body.object();
            const auto token = obj.value("token").toString();
            if (!token.isEmpty() && m_sessionStore) {
                m_sessionStore->setToken(token);
            }
            setStatusText("Signed in");
            refreshSessionUi();
            loadAuthenticatedData();
            return;
        }
        if (endpoint == "/api/logout") {
            setStatusText("Signed out");
            return;
        }
        if (endpoint == "/api/me") {
            const auto obj = body.object();
            const auto userObj = obj.value("user").toObject(obj);
            const auto name = userObj.value("displayName").toString(userObj.value("username").toString("ATEN user"));
            if (m_accountLabel) {
                m_accountLabel->setText(name);
            }
            setStatusText(QString("Signed in as %1").arg(name));
            return;
        }
        if (endpoint == "/api/chats") {
            renderChats(body);
            return;
        }
        if (endpoint.startsWith("/api/messages?chatId=")) {
            renderMessages(body);
            return;
        }
        if (endpoint == "/api/messages") {
            if (!m_currentChatId.isEmpty()) {
                m_apiClient->getMessages(m_currentChatId);
            }
            return;
        }
        setStatusText(QString("Loaded %1").arg(endpoint));
    });

    connect(m_apiClient, &ApiClient::requestFailed, this, [this](const QString &endpoint, const QString &message) {
        setStatusText(QString("%1 failed: %2").arg(endpoint, message));
    });
}

void MainWindow::refreshSessionUi()
{
    const auto hasSession = m_sessionStore && m_sessionStore->hasToken();
    if (m_stack) {
        m_stack->setCurrentWidget(hasSession ? m_messengerPage : m_authPage);
    }
    if (hasSession) {
        loadAuthenticatedData();
    }
}

void MainWindow::handleLogin()
{
    if (!m_apiClient || !m_loginInput || !m_passwordInput) return;
    const auto login = m_loginInput->text().trimmed();
    const auto password = m_passwordInput->text();
    if (login.isEmpty() || password.isEmpty()) {
        setStatusText("Enter email/username and password");
        return;
    }
    if (m_loginButton) {
        m_loginButton->setEnabled(false);
    }
    setStatusText("Signing in...");
    m_apiClient->login(login, password);
}

void MainWindow::loadAuthenticatedData()
{
    if (!m_apiClient || !m_sessionStore || !m_sessionStore->hasToken()) return;
    m_apiClient->getMe();
    m_apiClient->getChats();
}

void MainWindow::renderChats(const QJsonDocument &body)
{
    if (!m_chatList) return;
    m_chatList->clear();
    const auto chats = body.array();
    if (chats.isEmpty()) {
        m_chatList->addItem("No chats yet");
        return;
    }
    for (const auto &value : chats) {
        const auto chat = value.toObject();
        auto title = chat.value("title").toString();
        if (title.isEmpty()) {
            title = chat.value("name").toString(chat.value("id").toString("Chat"));
        }
        const auto type = chat.value("type").toString("group");
        const auto id = chat.value("id").toString();
        auto *item = new QListWidgetItem(QString("%1  ·  %2").arg(title, type));
        item->setData(Qt::UserRole, id);
        m_chatList->addItem(item);
    }
    if (m_chatList->count() > 0) {
        m_chatList->setCurrentRow(0);
    }
}

void MainWindow::renderMessages(const QJsonDocument &body)
{
    if (!m_messageList) return;
    m_messageList->clear();
    const auto messages = body.array();
    if (messages.isEmpty()) {
        m_messageList->addItem("No messages yet");
        return;
    }
    for (const auto &value : messages) {
        const auto msg = value.toObject();
        const auto from = msg.value("from").toString(msg.value("senderUsername").toString("user"));
        const auto type = msg.value("type").toString("text");
        QString text;
        if (type == "text") {
            text = msg.value("text").toString();
        } else if (type == "image") {
            text = "[image]";
        } else if (type == "audio") {
            text = "[voice message]";
        } else {
            text = QString("[%1]").arg(type);
        }
        m_messageList->addItem(QString("%1: %2").arg(from, text));
    }
    m_messageList->scrollToBottom();
}

void MainWindow::openSelectedChat()
{
    if (!m_apiClient || !m_chatList) return;
    auto *item = m_chatList->currentItem();
    if (!item) return;
    const auto chatId = item->data(Qt::UserRole).toString();
    if (chatId.isEmpty() || chatId == m_currentChatId) return;
    m_currentChatId = chatId;
    setStatusText(QString("Loading %1").arg(item->text()));
    m_apiClient->getMessages(m_currentChatId);
}

void MainWindow::sendComposerText()
{
    if (!m_apiClient || !m_composer) return;
    const auto text = m_composer->text().trimmed();
    if (m_currentChatId.isEmpty()) {
        setStatusText("Select a chat first");
        return;
    }
    if (text.isEmpty()) return;
    m_composer->clear();
    setStatusText("Sending...");
    m_apiClient->sendTextMessage(m_currentChatId, text);
}

void MainWindow::setStatusText(const QString &text)
{
    if (m_statusLabel) {
        m_statusLabel->setText(text);
    }
    if (m_loginButton) {
        m_loginButton->setEnabled(true);
    }
}

} // namespace aten
