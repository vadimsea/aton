#include "ui/MainWindow.h"

#include <QHBoxLayout>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QPushButton>
#include <QSplitter>
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

    if (m_apiClient) {
        m_apiClient->getHealth();
    }
}

void MainWindow::buildUi()
{
    auto *root = new QWidget(this);
    auto *rootLayout = new QHBoxLayout(root);
    rootLayout->setContentsMargins(0, 0, 0, 0);
    rootLayout->setSpacing(0);

    auto *splitter = new QSplitter(Qt::Horizontal, root);
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

    m_chatList = new QListWidget(sidebar);
    m_chatList->addItem("Aton Voice");
    m_chatList->addItem("akhenaten");
    m_chatList->addItem("Vadimtest");
    sidebarLayout->addWidget(m_chatList, 1);

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
    auto *sendButton = new QPushButton("Send", composer);
    sendButton->setObjectName("PrimaryButton");
    composerLayout->addWidget(m_composer, 1);
    composerLayout->addWidget(sendButton);
    contentLayout->addWidget(composer);

    splitter->addWidget(sidebar);
    splitter->addWidget(content);
    splitter->setSizes({360, 920});
    rootLayout->addWidget(splitter);

    setCentralWidget(root);
    statusBar()->hide();
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
        setStatusText(QString("Loaded %1").arg(endpoint));
    });

    connect(m_apiClient, &ApiClient::requestFailed, this, [this](const QString &endpoint, const QString &message) {
        setStatusText(QString("%1 failed: %2").arg(endpoint, message));
    });
}

void MainWindow::setStatusText(const QString &text)
{
    if (m_statusLabel) {
        m_statusLabel->setText(text);
    }
}

} // namespace aten
