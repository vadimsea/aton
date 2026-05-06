#include "ui/MainWindow.h"

#include <algorithm>
#include <QHBoxLayout>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QListWidgetItem>
#include <QMap>
#include <QPainter>
#include <QPainterPath>
#include <QPixmap>
#include <QPushButton>
#include <QSizePolicy>
#include <QSplitter>
#include <QStackedWidget>
#include <QStatusBar>
#include <QStyle>
#include <QVBoxLayout>
#include <QWidget>
#include <utility>

#include "net/ApiClient.h"
#include "session/SessionStore.h"
#include "ui/Theme.h"

namespace aten {

namespace {

struct ChatRow {
    QString id;
    QString title;
    QString type;
    QString preview;
    QString lastTime;
};

QString messagePreview(const QJsonObject &msg)
{
    const auto type = msg.value("type").toString("text");
    if (type == "image") return "[image]";
    if (type == "audio") return "[voice message]";
    const auto text = msg.value("text").toString().simplified();
    if (text.isEmpty()) return "[message]";
    return text.size() > 52 ? text.left(49) + "..." : text;
}

bool isDirectChatId(const QString &chatId)
{
    return chatId.contains("|") && !chatId.startsWith("group:") && !chatId.startsWith("channel:");
}

QString peerFromDirectChatId(const QString &chatId, const QString &me)
{
    const auto parts = chatId.split("|");
    if (parts.size() != 2) return {};
    if (parts[0] == me) return parts[1];
    if (parts[1] == me) return parts[0];
    return {};
}

QString directChatIdForUsers(QString a, QString b)
{
    if (a > b) std::swap(a, b);
    return QString("%1|%2").arg(a, b);
}

QPixmap makeFlagPixmap(const QString &lang)
{
    QPixmap pixmap(36, 36);
    pixmap.fill(Qt::transparent);

    QPainter painter(&pixmap);
    painter.setRenderHint(QPainter::Antialiasing, true);

    QPainterPath circle;
    circle.addEllipse(2, 2, 32, 32);
    painter.setClipPath(circle);
    painter.fillPath(circle, Qt::white);

    QRectF r(5, 9, 26, 18);
    if (lang == "ru") {
        painter.fillRect(r.adjusted(0, 0, 0, -12), QColor("#ffffff"));
        painter.fillRect(r.adjusted(0, 6, 0, -6), QColor("#1d4ed8"));
        painter.fillRect(r.adjusted(0, 12, 0, 0), QColor("#dc2626"));
    } else if (lang == "de") {
        painter.fillRect(r.adjusted(0, 0, 0, -12), QColor("#111827"));
        painter.fillRect(r.adjusted(0, 6, 0, -6), QColor("#dc2626"));
        painter.fillRect(r.adjusted(0, 12, 0, 0), QColor("#facc15"));
    } else {
        painter.fillRect(r, QColor("#1d4ed8"));

        QPen whitePen(Qt::white, 5.0, Qt::SolidLine, Qt::SquareCap);
        painter.setPen(whitePen);
        painter.drawLine(r.topLeft(), r.bottomRight());
        painter.drawLine(r.bottomLeft(), r.topRight());

        QPen redDiag(QColor("#dc2626"), 2.2, Qt::SolidLine, Qt::SquareCap);
        painter.setPen(redDiag);
        painter.drawLine(r.topLeft(), r.bottomRight());
        painter.drawLine(r.bottomLeft(), r.topRight());

        painter.setPen(Qt::NoPen);
        painter.fillRect(QRectF(r.left(), r.center().y() - 3, r.width(), 6), Qt::white);
        painter.fillRect(QRectF(r.center().x() - 3, r.top(), 6, r.height()), Qt::white);
        painter.fillRect(QRectF(r.left(), r.center().y() - 1.6, r.width(), 3.2), QColor("#dc2626"));
        painter.fillRect(QRectF(r.center().x() - 1.6, r.top(), 3.2, r.height()), QColor("#dc2626"));
    }

    painter.setClipping(false);
    painter.setPen(QPen(QColor("#cbd5e1"), 1));
    painter.drawEllipse(QRectF(2.5, 2.5, 31, 31));
    return pixmap;
}

QPixmap makeAtenMarkPixmap(int size, bool glow)
{
    QPixmap pixmap(size, size);
    pixmap.fill(Qt::transparent);

    QPainter painter(&pixmap);
    painter.setRenderHint(QPainter::Antialiasing, true);

    const qreal center = size / 2.0;
    if (glow) {
        QRadialGradient glowGradient(center, center, size * 0.48);
        glowGradient.setColorAt(0.0, QColor(245, 158, 11, 74));
        glowGradient.setColorAt(0.44, QColor(245, 158, 11, 34));
        glowGradient.setColorAt(1.0, QColor(245, 158, 11, 0));
        painter.setBrush(glowGradient);
        painter.setPen(Qt::NoPen);
        painter.drawEllipse(QRectF(size * 0.03, size * 0.03, size * 0.94, size * 0.94));
    }

    const qreal outer = size * (glow ? 0.25 : 0.07);
    const qreal outerSize = size - outer * 2;
    QRectF outerRect(outer, outer, outerSize, outerSize);
    QRadialGradient ringGradient(outerRect.left() + outerSize * 0.34, outerRect.top() + outerSize * 0.3, outerSize * 0.82);
    ringGradient.setColorAt(0.0, QColor("#fef3c7"));
    ringGradient.setColorAt(0.28, QColor("#f59e0b"));
    ringGradient.setColorAt(0.58, QColor("#ea580c"));
    ringGradient.setColorAt(0.78, QColor("#38bdf8"));
    ringGradient.setColorAt(1.0, QColor("#0f766e"));
    painter.setBrush(ringGradient);
    painter.setPen(Qt::NoPen);
    painter.drawEllipse(outerRect);

    const qreal innerSize = outerSize * 0.64;
    QRectF innerRect(center - innerSize / 2, center - innerSize / 2, innerSize, innerSize);
    QRadialGradient sunGradient(innerRect.left() + innerSize * 0.42, innerRect.top() + innerSize * 0.24, innerSize * 0.78);
    sunGradient.setColorAt(0.0, QColor("#fed7aa"));
    sunGradient.setColorAt(0.42, QColor("#fb923c"));
    sunGradient.setColorAt(1.0, QColor("#c2410c"));
    painter.setBrush(sunGradient);
    painter.drawEllipse(innerRect);

    QRadialGradient highlight(innerRect.left() + innerSize * 0.32, innerRect.top() + innerSize * 0.24, innerSize * 0.22);
    highlight.setColorAt(0.0, QColor(255, 255, 255, 120));
    highlight.setColorAt(1.0, QColor(255, 255, 255, 0));
    painter.setBrush(highlight);
    painter.drawEllipse(QRectF(innerRect.left() + innerSize * 0.16, innerRect.top() + innerSize * 0.08, innerSize * 0.34, innerSize * 0.34));

    return pixmap;
}

QString trAuth(const QString &lang, const QString &key)
{
    static const QMap<QString, QMap<QString, QString>> dict = {
        {"brand", {{"ru", "АТОН"}, {"de", "ATEN"}, {"en", "ATEN"}}},
        {"tagline", {{"ru", "мессенджер под светом диска"}, {"de", "Messenger unter dem Licht der Scheibe"}, {"en", "messenger under the disk light"}}},
        {"login", {{"ru", "Вход"}, {"de", "Anmelden"}, {"en", "Sign in"}}},
        {"register", {{"ru", "Регистрация"}, {"de", "Registrierung"}, {"en", "Registration"}}},
        {"email", {{"ru", "Email"}, {"de", "Email"}, {"en", "Email"}}},
        {"emailOrUsername", {{"ru", "Email или имя пользователя"}, {"de", "Email oder Benutzername"}, {"en", "Email or username"}}},
        {"username", {{"ru", "Имя пользователя"}, {"de", "Benutzername"}, {"en", "Username"}}},
        {"password", {{"ru", "Пароль"}, {"de", "Passwort"}, {"en", "Password"}}},
        {"repeatPassword", {{"ru", "Повторите пароль"}, {"de", "Passwort wiederholen"}, {"en", "Repeat password"}}},
        {"forgot", {{"ru", "Забыли пароль?"}, {"de", "Passwort vergessen?"}, {"en", "Forgot password?"}}},
        {"language", {{"ru", "Язык интерфейса"}, {"de", "Sprache der Oberfläche"}, {"en", "Interface language"}}},
        {"infoTitle", {{"ru", "Чаты без лишнего шума"}, {"de", "Chats ohne unnötigen Lärm"}, {"en", "Chats without extra noise"}}},
        {"infoText", {{"ru", "Личные переписки, группы, каналы, голосовые сообщения, реакции и профиль в сдержанном интерфейсе ATEN."}, {"de", "Private Chats, Gruppen, Kanäle, Sprachnachrichten, Reaktionen und Profil in einer ruhigen ATEN-Oberfläche."}, {"en", "Private chats, groups, channels, voice messages, reactions, and profile in a restrained ATEN interface."}}},
        {"welcome", {{"ru", "Добро пожаловать"}, {"de", "Willkommen"}, {"en", "Welcome"}}},
        {"welcomeHint", {{"ru", "Войдите по форме слева"}, {"de", "Melden Sie sich links an"}, {"en", "Sign in using the form on the left"}}},
        {"heroEyebrow", {{"ru", "ПОД СОЛНЦЕМ АХЕТАТОНА"}, {"de", "UNTER DER SONNE ACHETATONS"}, {"en", "UNDER AKHETATEN'S SUN"}}},
        {"heroTitle", {{"ru", "Спокойные диалоги — без лишнего шума"}, {"de", "Ruhige Dialoge — ohne unnötigen Lärm"}, {"en", "Calm conversations without extra noise"}}},
        {"heroText", {{"ru", "Личные и групповые чаты в сдержанном интерфейсе. Меньше отвлечений — больше смысла в переписке."}, {"de", "Private und Gruppen-Chats in einer ruhigen Oberfläche. Weniger Ablenkung — mehr Sinn im Gespräch."}, {"en", "Private and group chats in a restrained interface. Fewer distractions, more meaning in conversation."}}},
        {"status", {{"ru", "Подключение к API..."}, {"de", "Verbindung zur API..."}, {"en", "Connecting to API..."}}},
        {"loginHint", {{"ru", "Введите email и пароль."}, {"de", "Geben Sie Email und Passwort ein."}, {"en", "Enter your email and password."}}},
        {"registerHint", {{"ru", "Введите email, имя пользователя и пароль."}, {"de", "Geben Sie Email, Benutzername und Passwort ein."}, {"en", "Enter your email, username, and password."}}},
        {"fillFields", {{"ru", "Заполните обязательные поля"}, {"de", "Füllen Sie die Pflichtfelder aus"}, {"en", "Fill in the required fields"}}},
        {"passwordMismatch", {{"ru", "Пароли не совпадают"}, {"de", "Passwörter stimmen nicht überein"}, {"en", "Passwords do not match"}}},
        {"verifyEmail", {{"ru", "Аккаунт создан. Проверьте email для подтверждения."}, {"de", "Konto erstellt. Prüfen Sie Ihre Email zur Bestätigung."}, {"en", "Account created. Check your email to verify it."}}},
    };
    const auto item = dict.value(key);
    return item.value(lang, item.value("ru", key));
}

} // namespace

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

    for (auto *button : findChildren<QPushButton *>()) {
        button->setCursor(Qt::PointingHandCursor);
    }
    if (m_chatList) {
        m_chatList->setCursor(Qt::PointingHandCursor);
        m_chatList->viewport()->setCursor(Qt::PointingHandCursor);
    }
}

QWidget *MainWindow::buildAuthPage()
{
    auto *page = new QWidget(this);
    page->setObjectName("GuestShell");
    auto *outer = new QHBoxLayout(page);
    outer->setContentsMargins(0, 0, 0, 0);
    outer->setSpacing(0);

    auto *sidebar = new QWidget(page);
    sidebar->setObjectName("GuestSidebar");
    sidebar->setFixedWidth(400);
    auto *sideLayout = new QVBoxLayout(sidebar);
    sideLayout->setContentsMargins(22, 24, 22, 18);
    sideLayout->setSpacing(22);

    auto *brandRow = new QWidget(sidebar);
    auto *brandLayout = new QHBoxLayout(brandRow);
    brandLayout->setContentsMargins(0, 0, 0, 0);
    brandLayout->setSpacing(12);
    auto *logo = new QLabel(brandRow);
    logo->setObjectName("AtenLogo");
    logo->setFixedSize(38, 38);
    logo->setPixmap(makeAtenMarkPixmap(38, false));
    logo->setScaledContents(true);
    auto *brandText = new QWidget(brandRow);
    auto *brandTextLayout = new QVBoxLayout(brandText);
    brandTextLayout->setContentsMargins(0, 0, 0, 0);
    brandTextLayout->setSpacing(1);
    m_authTitleLabel = new QLabel(brandText);
    auto titleFont = m_authTitleLabel->font();
    titleFont.setPointSize(16);
    titleFont.setBold(true);
    m_authTitleLabel->setFont(titleFont);
    m_authSubtitleLabel = new QLabel(brandText);
    m_authSubtitleLabel->setObjectName("MutedText");
    brandTextLayout->addWidget(m_authTitleLabel);
    brandTextLayout->addWidget(m_authSubtitleLabel);
    brandLayout->addWidget(logo);
    brandLayout->addWidget(brandText, 1);
    sideLayout->addWidget(brandRow);

    auto *panel = new QWidget(sidebar);
    panel->setObjectName("AuthPanel");
    auto *layout = new QVBoxLayout(panel);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(12);

    auto *tabs = new QWidget(panel);
    tabs->setObjectName("AuthTabs");
    auto *tabsLayout = new QHBoxLayout(tabs);
    tabsLayout->setContentsMargins(4, 4, 4, 4);
    tabsLayout->setSpacing(4);
    m_loginTabButton = new QPushButton(panel);
    m_loginTabButton->setObjectName("AuthTabActive");
    m_registerTabButton = new QPushButton(panel);
    m_registerTabButton->setObjectName("AuthTab");
    tabsLayout->addWidget(m_loginTabButton);
    tabsLayout->addWidget(m_registerTabButton);

    m_loginFieldLabel = new QLabel(panel);
    m_loginFieldLabel->setObjectName("AuthFieldLabel");
    m_registerEmailLabel = new QLabel(panel);
    m_registerEmailLabel->setObjectName("AuthFieldLabel");
    m_registerUsernameLabel = new QLabel(panel);
    m_registerUsernameLabel->setObjectName("AuthFieldLabel");
    m_passwordLabel = new QLabel(panel);
    m_passwordLabel->setObjectName("AuthFieldLabel");
    m_passwordConfirmLabel = new QLabel(panel);
    m_passwordConfirmLabel->setObjectName("AuthFieldLabel");

    m_loginInput = new QLineEdit(panel);
    m_registerEmailInput = new QLineEdit(panel);
    m_registerUsernameInput = new QLineEdit(panel);
    m_passwordInput = new QLineEdit(panel);
    m_passwordInput->setEchoMode(QLineEdit::Password);
    m_passwordConfirmInput = new QLineEdit(panel);
    m_passwordConfirmInput->setEchoMode(QLineEdit::Password);
    m_loginButton = new QPushButton(panel);
    m_loginButton->setObjectName("PrimaryButton");
    m_forgotButton = new QPushButton(panel);
    m_forgotButton->setObjectName("LinkButton");
    m_forgotButton->setFlat(true);
    m_forgotButton->setCursor(Qt::PointingHandCursor);
    m_authStatusLabel = new QLabel(panel);
    m_authStatusLabel->setObjectName("MutedText");
    m_authStatusLabel->setWordWrap(true);

    layout->addWidget(tabs);
    layout->addWidget(m_loginFieldLabel);
    layout->addWidget(m_loginInput);
    layout->addWidget(m_registerEmailLabel);
    layout->addWidget(m_registerEmailInput);
    layout->addWidget(m_registerUsernameLabel);
    layout->addWidget(m_registerUsernameInput);
    layout->addWidget(m_passwordLabel);
    layout->addWidget(m_passwordInput);
    layout->addWidget(m_passwordConfirmLabel);
    layout->addWidget(m_passwordConfirmInput);
    layout->addWidget(m_loginButton);
    layout->addWidget(m_authStatusLabel);
    layout->addWidget(m_forgotButton);
    sideLayout->addWidget(panel);
    sideLayout->addStretch(1);

    auto *langBox = new QWidget(sidebar);
    auto *langLayout = new QVBoxLayout(langBox);
    langLayout->setContentsMargins(0, 0, 0, 0);
    langLayout->setSpacing(8);
    m_authLangLabel = new QLabel(langBox);
    m_authLangLabel->setObjectName("MutedText");
    auto *langButtons = new QWidget(langBox);
    auto *langButtonsLayout = new QHBoxLayout(langButtons);
    langButtonsLayout->setContentsMargins(0, 0, 0, 0);
    langButtonsLayout->setSpacing(8);
    m_ruButton = new QPushButton(langButtons);
    m_deButton = new QPushButton(langButtons);
    m_enButton = new QPushButton(langButtons);
    m_ruButton->setIcon(QIcon(makeFlagPixmap("ru")));
    m_deButton->setIcon(QIcon(makeFlagPixmap("de")));
    m_enButton->setIcon(QIcon(makeFlagPixmap("en")));
    for (auto *btn : {m_ruButton, m_deButton, m_enButton}) {
        btn->setIconSize(QSize(34, 34));
        btn->setCursor(Qt::PointingHandCursor);
    }
    langButtonsLayout->addWidget(m_ruButton);
    langButtonsLayout->addWidget(m_deButton);
    langButtonsLayout->addWidget(m_enButton);
    langLayout->addWidget(m_authLangLabel);
    langLayout->addWidget(langButtons);
    sideLayout->addWidget(langBox);

    auto *main = new QWidget(page);
    main->setObjectName("GuestMain");
    auto *mainLayout = new QVBoxLayout(main);
    mainLayout->setContentsMargins(0, 0, 0, 0);
    mainLayout->setSpacing(0);

    auto *welcomeBar = new QWidget(main);
    welcomeBar->setObjectName("GuestTopbar");
    auto *welcomeLayout = new QHBoxLayout(welcomeBar);
    welcomeLayout->setContentsMargins(16, 10, 12, 10);
    welcomeLayout->setSpacing(12);
    auto *welcomeCopy = new QWidget(welcomeBar);
    auto *welcomeCopyLayout = new QVBoxLayout(welcomeCopy);
    welcomeCopyLayout->setContentsMargins(0, 0, 0, 0);
    welcomeCopyLayout->setSpacing(1);
    m_authWelcomeTitleLabel = new QLabel(welcomeCopy);
    auto welcomeFont = m_authWelcomeTitleLabel->font();
    welcomeFont.setPointSize(15);
    welcomeFont.setBold(true);
    m_authWelcomeTitleLabel->setFont(welcomeFont);
    m_authWelcomeSubtitleLabel = new QLabel(welcomeCopy);
    m_authWelcomeSubtitleLabel->setObjectName("MutedText");
    welcomeCopyLayout->addWidget(m_authWelcomeTitleLabel);
    welcomeCopyLayout->addWidget(m_authWelcomeSubtitleLabel);
    auto *themeButton = new QPushButton("☼", welcomeBar);
    themeButton->setObjectName("ThemeIconButton");
    themeButton->setFixedSize(52, 52);
    welcomeLayout->addWidget(welcomeCopy, 1);
    welcomeLayout->addWidget(themeButton);
    mainLayout->addWidget(welcomeBar);

    auto *hero = new QWidget(main);
    auto *heroLayout = new QVBoxLayout(hero);
    heroLayout->setContentsMargins(64, 8, 64, 36);
    heroLayout->setSpacing(12);
    heroLayout->setAlignment(Qt::AlignCenter);
    auto *heroLogo = new QLabel(hero);
    heroLogo->setObjectName("AtenHeroLogo");
    heroLogo->setFixedSize(300, 300);
    heroLogo->setAlignment(Qt::AlignCenter);
    heroLogo->setPixmap(makeAtenMarkPixmap(300, true));
    heroLogo->setScaledContents(true);
    m_authHeroEyebrowLabel = new QLabel(hero);
    m_authHeroEyebrowLabel->setObjectName("HeroEyebrow");
    m_authHeroEyebrowLabel->setAlignment(Qt::AlignCenter);
    m_authInfoTitleLabel = new QLabel(hero);
    auto infoFont = m_authInfoTitleLabel->font();
    infoFont.setPointSize(25);
    infoFont.setBold(true);
    m_authInfoTitleLabel->setFont(infoFont);
    m_authInfoTitleLabel->setAlignment(Qt::AlignCenter);
    m_authInfoTitleLabel->setMinimumHeight(34);
    m_authInfoTextLabel = new QLabel(hero);
    m_authInfoTextLabel->setObjectName("HeroText");
    m_authInfoTextLabel->setWordWrap(true);
    m_authInfoTextLabel->setMaximumWidth(760);
    m_authInfoTextLabel->setMinimumHeight(84);
    m_authInfoTextLabel->setSizePolicy(QSizePolicy::Preferred, QSizePolicy::MinimumExpanding);
    m_authInfoTextLabel->setAlignment(Qt::AlignCenter);
    heroLayout->addStretch(1);
    heroLayout->addWidget(heroLogo, 0, Qt::AlignCenter);
    heroLayout->addWidget(m_authHeroEyebrowLabel, 0, Qt::AlignCenter);
    heroLayout->addWidget(m_authInfoTitleLabel, 0, Qt::AlignCenter);
    heroLayout->addWidget(m_authInfoTextLabel, 0, Qt::AlignCenter);
    heroLayout->addStretch(2);
    mainLayout->addWidget(hero, 1);

    outer->addWidget(sidebar);
    outer->addWidget(main, 1);

    connect(m_loginButton, &QPushButton::clicked, this, &MainWindow::handleLogin);
    connect(m_passwordInput, &QLineEdit::returnPressed, this, &MainWindow::handleLogin);
    connect(m_passwordConfirmInput, &QLineEdit::returnPressed, this, &MainWindow::handleLogin);
    connect(m_loginTabButton, &QPushButton::clicked, this, [this]() { switchAuthMode(false); });
    connect(m_registerTabButton, &QPushButton::clicked, this, [this]() { switchAuthMode(true); });
    connect(m_ruButton, &QPushButton::clicked, this, [this]() { setLanguage("ru"); });
    connect(m_deButton, &QPushButton::clicked, this, [this]() { setLanguage("de"); });
    connect(m_enButton, &QPushButton::clicked, this, [this]() { setLanguage("en"); });
    connect(m_forgotButton, &QPushButton::clicked, this, [this]() {
        if (m_authStatusLabel) {
            m_authStatusLabel->setText("https://aten.vadzim.by/forgot.html");
        }
    });

    switchAuthMode(false);
    updateAuthTexts();
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
            if (!m_stack || m_stack->currentWidget() != m_authPage) {
                setStatusText(QString("API online: %1").arg(service));
            } else if (m_statusLabel) {
                m_statusLabel->setText(QString("API online: %1").arg(service));
            }
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
        if (endpoint == "/api/register") {
            setStatusText(trAuth(m_authLanguage, "verifyEmail"));
            switchAuthMode(false);
            return;
        }
        if (endpoint == "/api/logout") {
            setStatusText("Signed out");
            return;
        }
        if (endpoint == "/api/me") {
            const auto obj = body.object();
            const auto userObj = obj.value("user").toObject(obj);
            m_currentUsername = userObj.value("username").toString();
            const auto name = userObj.value("displayName").toString(m_currentUsername.isEmpty() ? "ATEN user" : m_currentUsername);
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
        if (endpoint == "/api/messages/all") {
            renderMessagesAll(body);
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
            m_apiClient->getMessagesAll();
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
    const auto password = m_passwordInput->text();
    if (m_registerMode) {
        const auto email = m_registerEmailInput ? m_registerEmailInput->text().trimmed() : QString();
        const auto username = m_registerUsernameInput ? m_registerUsernameInput->text().trimmed() : QString();
        const auto confirm = m_passwordConfirmInput ? m_passwordConfirmInput->text() : QString();
        if (email.isEmpty() || username.isEmpty() || password.isEmpty() || confirm.isEmpty()) {
            setStatusText(trAuth(m_authLanguage, "fillFields"));
            return;
        }
        if (password != confirm) {
            setStatusText(trAuth(m_authLanguage, "passwordMismatch"));
            return;
        }
        if (m_loginButton) {
            m_loginButton->setEnabled(false);
        }
        setStatusText(trAuth(m_authLanguage, "register") + "...");
        m_apiClient->registerAccount(email, username, password);
        return;
    }

    const auto login = m_loginInput->text().trimmed();
    if (login.isEmpty() || password.isEmpty()) {
        setStatusText(trAuth(m_authLanguage, "fillFields"));
        return;
    }
    if (m_loginButton) {
        m_loginButton->setEnabled(false);
    }
    setStatusText(trAuth(m_authLanguage, "login") + "...");
    m_apiClient->login(login, password);
}

void MainWindow::switchAuthMode(bool registerMode)
{
    m_registerMode = registerMode;
    if (m_loginInput) m_loginInput->setVisible(!registerMode);
    if (m_loginFieldLabel) m_loginFieldLabel->setVisible(!registerMode);
    if (m_registerEmailInput) m_registerEmailInput->setVisible(registerMode);
    if (m_registerEmailLabel) m_registerEmailLabel->setVisible(registerMode);
    if (m_registerUsernameInput) m_registerUsernameInput->setVisible(registerMode);
    if (m_registerUsernameLabel) m_registerUsernameLabel->setVisible(registerMode);
    if (m_passwordConfirmInput) m_passwordConfirmInput->setVisible(registerMode);
    if (m_passwordConfirmLabel) m_passwordConfirmLabel->setVisible(registerMode);
    if (m_loginTabButton) m_loginTabButton->setObjectName(registerMode ? "AuthTab" : "AuthTabActive");
    if (m_registerTabButton) m_registerTabButton->setObjectName(registerMode ? "AuthTabActive" : "AuthTab");
    if (m_loginTabButton) m_loginTabButton->style()->unpolish(m_loginTabButton), m_loginTabButton->style()->polish(m_loginTabButton);
    if (m_registerTabButton) m_registerTabButton->style()->unpolish(m_registerTabButton), m_registerTabButton->style()->polish(m_registerTabButton);
    updateAuthTexts();
}

void MainWindow::setLanguage(const QString &lang)
{
    if (lang != "ru" && lang != "de" && lang != "en") return;
    m_authLanguage = lang;
    updateAuthTexts();
}

void MainWindow::updateAuthTexts()
{
    if (m_authTitleLabel) m_authTitleLabel->setText(trAuth(m_authLanguage, "brand"));
    if (m_authSubtitleLabel) m_authSubtitleLabel->setText(trAuth(m_authLanguage, "tagline"));
    if (m_authWelcomeTitleLabel) m_authWelcomeTitleLabel->setText(trAuth(m_authLanguage, "welcome"));
    if (m_authWelcomeSubtitleLabel) m_authWelcomeSubtitleLabel->setText(trAuth(m_authLanguage, "welcomeHint"));
    if (m_authHeroEyebrowLabel) m_authHeroEyebrowLabel->setText(trAuth(m_authLanguage, "heroEyebrow"));
    if (m_authInfoTitleLabel) m_authInfoTitleLabel->setText(trAuth(m_authLanguage, "heroTitle"));
    if (m_authInfoTextLabel) m_authInfoTextLabel->setText(trAuth(m_authLanguage, "heroText"));
    if (m_loginTabButton) m_loginTabButton->setText(trAuth(m_authLanguage, "login"));
    if (m_registerTabButton) m_registerTabButton->setText(trAuth(m_authLanguage, "register"));
    if (m_loginInput) m_loginInput->setPlaceholderText(trAuth(m_authLanguage, "emailOrUsername"));
    if (m_registerEmailInput) m_registerEmailInput->setPlaceholderText(trAuth(m_authLanguage, "email"));
    if (m_registerUsernameInput) m_registerUsernameInput->setPlaceholderText(trAuth(m_authLanguage, "username"));
    if (m_passwordInput) m_passwordInput->setPlaceholderText(trAuth(m_authLanguage, "password"));
    if (m_passwordConfirmInput) m_passwordConfirmInput->setPlaceholderText(trAuth(m_authLanguage, "repeatPassword"));
    if (m_loginFieldLabel) m_loginFieldLabel->setText(trAuth(m_authLanguage, "email").toUpper());
    if (m_registerEmailLabel) m_registerEmailLabel->setText(trAuth(m_authLanguage, "email").toUpper());
    if (m_registerUsernameLabel) m_registerUsernameLabel->setText(trAuth(m_authLanguage, "username").toUpper());
    if (m_passwordLabel) m_passwordLabel->setText(trAuth(m_authLanguage, "password").toUpper());
    if (m_passwordConfirmLabel) m_passwordConfirmLabel->setText(trAuth(m_authLanguage, "repeatPassword").toUpper());
    if (m_loginButton) m_loginButton->setText(trAuth(m_authLanguage, m_registerMode ? "register" : "login"));
    if (m_forgotButton) m_forgotButton->setText(trAuth(m_authLanguage, "forgot"));
    if (m_authLangLabel) m_authLangLabel->setText(trAuth(m_authLanguage, "language"));
    if (m_authStatusLabel) {
        m_authStatusLabel->setText(trAuth(m_authLanguage, m_registerMode ? "registerHint" : "loginHint"));
    }
    if (m_ruButton) m_ruButton->setObjectName(m_authLanguage == "ru" ? "LangButtonActive" : "LangButton");
    if (m_deButton) m_deButton->setObjectName(m_authLanguage == "de" ? "LangButtonActive" : "LangButton");
    if (m_enButton) m_enButton->setObjectName(m_authLanguage == "en" ? "LangButtonActive" : "LangButton");
    for (auto *btn : {m_ruButton, m_deButton, m_enButton}) {
        if (!btn) continue;
        btn->style()->unpolish(btn);
        btn->style()->polish(btn);
    }
}

void MainWindow::loadAuthenticatedData()
{
    if (!m_apiClient || !m_sessionStore || !m_sessionStore->hasToken()) return;
    m_apiClient->getMe();
    m_apiClient->getChats();
    m_apiClient->getMessagesAll();
}

void MainWindow::renderChats(const QJsonDocument &body)
{
    m_groupChats = body.array();
    renderSidebar();
    return;

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

void MainWindow::renderMessagesAll(const QJsonDocument &body)
{
    m_allMessages = body.array();
    renderSidebar();
}

void MainWindow::renderSidebar()
{
    if (!m_chatList) return;
    const auto previousChatId = m_currentChatId;
    m_chatList->clear();

    QMap<QString, ChatRow> rowsById;

    for (const auto &value : m_groupChats) {
        const auto chat = value.toObject();
        const auto id = chat.value("id").toString();
        if (id.isEmpty()) continue;
        auto title = chat.value("title").toString();
        if (title.isEmpty()) {
            title = chat.value("name").toString(id);
        }
        rowsById.insert(id, ChatRow{
                                id,
                                title,
                                chat.value("type").toString(id.startsWith("channel:") ? "channel" : "group"),
                                chat.value("description").toString(),
                                {},
                            });
    }

    for (const auto &value : m_allMessages) {
        const auto msg = value.toObject();
        auto chatId = msg.value("chatId").toString();
        const auto from = msg.value("from").toString(msg.value("senderUsername").toString());
        const auto to = msg.value("to").toString();
        if (chatId.isEmpty() && !from.isEmpty() && !to.isEmpty()) {
            chatId = directChatIdForUsers(from, to);
        }
        if (chatId.isEmpty() || chatId == "global") continue;

        const auto lastTime = msg.value("createdAt").toString(msg.value("time").toString());
        const auto preview = messagePreview(msg);

        if (isDirectChatId(chatId)) {
            auto row = rowsById.value(chatId);
            if (row.id.isEmpty()) {
                const auto peer = peerFromDirectChatId(chatId, m_currentUsername);
                row = ChatRow{chatId, peer.isEmpty() ? chatId : peer, "private", {}, {}};
            }
            if (row.lastTime.isEmpty() || lastTime >= row.lastTime) {
                row.preview = preview;
                row.lastTime = lastTime;
            }
            rowsById.insert(chatId, row);
            continue;
        }

        if (rowsById.contains(chatId)) {
            auto row = rowsById.value(chatId);
            if (row.lastTime.isEmpty() || lastTime >= row.lastTime) {
                row.preview = preview;
                row.lastTime = lastTime;
            }
            rowsById.insert(chatId, row);
        }
    }

    auto rows = rowsById.values();
    std::sort(rows.begin(), rows.end(), [](const ChatRow &a, const ChatRow &b) {
        if (a.lastTime == b.lastTime) return a.title.toLower() < b.title.toLower();
        if (a.lastTime.isEmpty()) return false;
        if (b.lastTime.isEmpty()) return true;
        return a.lastTime > b.lastTime;
    });

    if (rows.isEmpty()) {
        m_chatList->addItem("No chats yet");
        return;
    }

    int selectedRow = 0;
    for (int i = 0; i < rows.size(); ++i) {
        const auto &row = rows[i];
        const auto preview = row.preview.isEmpty() ? row.type : QString("%1\n%2").arg(row.type, row.preview);
        auto *item = new QListWidgetItem(QString("%1\n%2").arg(row.title, preview));
        item->setData(Qt::UserRole, row.id);
        m_chatList->addItem(item);
        if (row.id == previousChatId) selectedRow = i;
    }
    if (m_chatList->count() > 0) {
        m_chatList->setCurrentRow(selectedRow);
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
    if (m_authStatusLabel && m_stack && m_stack->currentWidget() == m_authPage) {
        m_authStatusLabel->setText(text);
    }
    if (m_statusLabel) {
        m_statusLabel->setText(text);
    }
    if (m_loginButton) {
        m_loginButton->setEnabled(true);
    }
}

} // namespace aten
