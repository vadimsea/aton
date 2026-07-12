#include "ui/NotificationHub.h"

#include "platform/TaskbarBadge.h"

#include <algorithm>
#include <functional>
#include <QAction>
#include <QAudioOutput>
#include <QBoxLayout>
#include <QCoreApplication>
#include <QCursor>
#include <QFile>
#include <QFrame>
#include <QGuiApplication>
#include <QLabel>
#include <QMediaPlayer>
#include <QMenu>
#include <QMouseEvent>
#include <QPainter>
#include <QPainterPath>
#include <QPushButton>
#include <QScreen>
#include <QSystemTrayIcon>
#include <QTimer>
#include <QUrl>
#include <QWidget>

namespace aten {

namespace {

QPixmap circularIconPixmap(const QIcon &icon, const QString &fallbackText, int size)
{
    QPixmap source = icon.pixmap(size, size);
    if (source.isNull()) {
        source = QPixmap(size, size);
        source.fill(QColor("#2563eb"));
        QPainter painter(&source);
        painter.setRenderHint(QPainter::Antialiasing);
        painter.setPen(Qt::white);
        QFont font = painter.font();
        font.setBold(true);
        font.setPixelSize(size / 2);
        painter.setFont(font);
        painter.drawText(source.rect(), Qt::AlignCenter, fallbackText.left(1).toUpper());
    }

    QPixmap result(size, size);
    result.fill(Qt::transparent);
    QPainter painter(&result);
    painter.setRenderHint(QPainter::Antialiasing);
    QPainterPath clip;
    clip.addEllipse(result.rect());
    painter.setClipPath(clip);
    painter.drawPixmap(result.rect(), source);
    return result;
}

class NotificationToast final : public QWidget
{
public:
    NotificationToast(
        const PendingNotification &item,
        const QIcon &fallbackIcon,
        std::function<void()> activate,
        std::function<void()> dismiss)
        : QWidget(nullptr, Qt::Tool | Qt::FramelessWindowHint | Qt::WindowStaysOnTopHint),
          m_activate(std::move(activate)),
          m_dismiss(std::move(dismiss))
    {
        setObjectName("AtenNotificationToast");
        setAttribute(Qt::WA_TranslucentBackground);
        setAttribute(Qt::WA_ShowWithoutActivating);
        setFixedWidth(390);
        setCursor(Qt::PointingHandCursor);

        auto *surface = new QFrame(this);
        surface->setObjectName("ToastSurface");
        auto *root = new QHBoxLayout(this);
        root->setContentsMargins(0, 0, 0, 0);
        root->addWidget(surface);

        auto *layout = new QHBoxLayout(surface);
        layout->setContentsMargins(16, 14, 12, 14);
        layout->setSpacing(12);

        auto *avatar = new QLabel(surface);
        avatar->setObjectName("ToastAvatar");
        avatar->setFixedSize(48, 48);
        avatar->setPixmap(circularIconPixmap(item.senderIcon.isNull() ? fallbackIcon : item.senderIcon, item.title, 48));

        auto *copy = new QWidget(surface);
        auto *copyLayout = new QVBoxLayout(copy);
        copyLayout->setContentsMargins(0, 0, 0, 0);
        copyLayout->setSpacing(3);
        auto *title = new QLabel(item.title, copy);
        title->setObjectName("ToastTitle");
        title->setTextFormat(Qt::PlainText);
        auto *body = new QLabel(item.body, copy);
        body->setObjectName("ToastBody");
        body->setTextFormat(Qt::PlainText);
        body->setWordWrap(true);
        body->setMaximumHeight(42);
        copyLayout->addWidget(title);
        copyLayout->addWidget(body);

        auto *close = new QPushButton(QString::fromUtf8("\xC3\x97"), surface);
        close->setObjectName("ToastClose");
        close->setFixedSize(28, 28);
        close->setCursor(Qt::PointingHandCursor);
        close->setToolTip(QStringLiteral("Закрыть"));
        connect(close, &QPushButton::clicked, this, [this]() {
            if (m_dismiss) m_dismiss();
        });

        layout->addWidget(avatar, 0, Qt::AlignTop);
        layout->addWidget(copy, 1);
        layout->addWidget(close, 0, Qt::AlignTop);
        setStyleSheet(R"(
            QWidget#AtenNotificationToast { background: transparent; }
            QFrame#ToastSurface {
                background: #111827;
                border: 1px solid #334155;
                border-radius: 14px;
            }
            QLabel#ToastAvatar {
                background: transparent;
                border: 1px solid #475569;
                border-radius: 24px;
            }
            QLabel#ToastTitle {
                background: transparent;
                color: #f8fafc;
                font-size: 14px;
                font-weight: 700;
            }
            QLabel#ToastBody {
                background: transparent;
                color: #cbd5e1;
                font-size: 13px;
            }
            QPushButton#ToastClose {
                background: transparent;
                border: none;
                border-radius: 14px;
                color: #94a3b8;
                font-size: 20px;
                padding: 0;
            }
            QPushButton#ToastClose:hover {
                background: #263244;
                color: #ffffff;
            }
        )");
        adjustSize();
        setFixedHeight(std::max(82, sizeHint().height()));
    }

protected:
    void mousePressEvent(QMouseEvent *event) override
    {
        if (event->button() == Qt::LeftButton && m_activate) {
            m_activate();
        }
        QWidget::mousePressEvent(event);
    }

private:
    std::function<void()> m_activate;
    std::function<void()> m_dismiss;
};

} // namespace

NotificationHub::NotificationHub(QWidget *window, QObject *parent)
    : QObject(parent),
      m_window(window)
{
    m_baseIcon = qApp->windowIcon();

    if (QSystemTrayIcon::isSystemTrayAvailable()) {
        m_tray = new QSystemTrayIcon(this);
        if (!m_baseIcon.isNull()) {
            m_tray->setIcon(m_baseIcon);
        }
        m_tray->setToolTip("ATEN");

        m_trayMenu = new QMenu();
        auto *showAction = m_trayMenu->addAction(QStringLiteral("Открыть ATEN"));
        auto *quitAction = m_trayMenu->addAction(QStringLiteral("Выход"));
        connect(showAction, &QAction::triggered, this, &NotificationHub::showWindowRequested);
        connect(quitAction, &QAction::triggered, this, &NotificationHub::quitRequested);
        m_tray->setContextMenu(m_trayMenu);
        connect(m_tray, &QSystemTrayIcon::activated, this, [this](QSystemTrayIcon::ActivationReason reason) {
            if (reason == QSystemTrayIcon::DoubleClick || reason == QSystemTrayIcon::Trigger) {
                emit showWindowRequested();
            }
        });
        m_tray->show();
    }

    m_drainTimer = new QTimer(this);
    m_drainTimer->setSingleShot(true);
    m_drainTimer->setInterval(350);
    connect(m_drainTimer, &QTimer::timeout, this, &NotificationHub::drainNotificationQueue);
}

void NotificationHub::setUnreadCount(int count)
{
    m_unreadCount = std::max(0, count);
    if (m_tray) {
        m_tray->setToolTip(
            m_unreadCount > 0
                ? QString("ATEN — %1 непрочитанных").arg(m_unreadCount)
                : QStringLiteral("ATEN"));
    }

    const QIcon icon = appIconWithUnreadBadge(m_baseIcon, m_unreadCount);
    if (m_tray && !icon.isNull()) {
        m_tray->setIcon(icon);
    }
    if (m_window) {
        applyUnreadBadgeToWindow(m_window, m_baseIcon, m_unreadCount);
        if (!m_window->internalWinId()) {
            QTimer::singleShot(250, this, [this]() {
                if (m_window) applyUnreadBadgeToWindow(m_window, m_baseIcon, m_unreadCount);
            });
        }
        QTimer::singleShot(800, this, [this]() {
            if (m_window) applyUnreadBadgeToWindow(m_window, m_baseIcon, m_unreadCount);
        });
    }
}

void NotificationHub::showBackgroundHint()
{
    enqueueNotification(
        QStringLiteral("ATEN"),
        QStringLiteral("Приложение свёрнуто в трей и продолжает принимать сообщения."),
        {},
        m_baseIcon);
}

void NotificationHub::enqueueNotification(
    const QString &title,
    const QString &body,
    const QString &chatId,
    const QIcon &senderIcon)
{
    if (m_muted) return;
    m_queue.enqueue(PendingNotification{title, body, chatId, senderIcon});
    if (!m_drainTimer->isActive() && !m_toast) {
        drainNotificationQueue();
    }
}

void NotificationHub::playMessageSound()
{
    if (m_muted) return;
    if (!m_player) {
        m_player = new QMediaPlayer(this);
        m_player->setAudioOutput(new QAudioOutput(this));
    }
    if (m_player->source().isEmpty()) {
        const auto soundPath = resolveSoundPath();
        if (QFile::exists(soundPath)) {
            m_player->setSource(QUrl::fromLocalFile(soundPath));
        }
    }
    if (m_player->source().isEmpty()) return;
    m_player->setPosition(0);
    m_player->play();
}

void NotificationHub::setMuted(bool muted)
{
    m_muted = muted;
}

void NotificationHub::drainNotificationQueue()
{
    if (m_queue.isEmpty() || m_toast) return;

    const auto item = m_queue.dequeue();
    const auto dismiss = [this]() {
        if (!m_toast) return;
        m_toast->hide();
        m_toast->deleteLater();
        m_toast = nullptr;
        if (!m_queue.isEmpty()) m_drainTimer->start();
    };
    const auto activate = [this, item, dismiss]() {
        if (!item.chatId.isEmpty()) emit notificationActivated(item.chatId);
        emit showWindowRequested();
        dismiss();
    };

    m_toast = new NotificationToast(item, m_baseIcon, activate, dismiss);
    QScreen *screen = QGuiApplication::screenAt(QCursor::pos());
    if (!screen) screen = QGuiApplication::primaryScreen();
    const QRect available = screen ? screen->availableGeometry() : QRect(0, 0, 1280, 720);
    m_toast->move(
        available.right() - m_toast->width() - 18,
        available.bottom() - m_toast->height() - 18);
    m_toast->show();
    m_toast->raise();
    QTimer::singleShot(6500, m_toast, dismiss);
}

QString NotificationHub::resolveSoundPath() const
{
    const QString appDir = QCoreApplication::applicationDirPath();
    const QStringList candidates = {
        appDir + "/notification.wav",
        appDir + "/notification.mp3",
        appDir + "/../resources/notification.wav",
    };
    for (const QString &path : candidates) {
        if (QFile::exists(path)) return path;
    }
    return {};
}

} // namespace aten
