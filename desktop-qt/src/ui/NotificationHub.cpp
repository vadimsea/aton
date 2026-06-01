#include "ui/NotificationHub.h"

#include "platform/TaskbarBadge.h"

#include <QAction>
#include <QAudioOutput>
#include <QCoreApplication>
#include <QFile>
#include <QGuiApplication>
#include <QMediaPlayer>
#include <QMenu>
#include <QSystemTrayIcon>
#include <QTimer>
#include <QUrl>
#include <QWidget>

namespace aten {

NotificationHub::NotificationHub(QWidget *window, QObject *parent)
    : QObject(parent),
      m_window(window)
{
    if (!QSystemTrayIcon::isSystemTrayAvailable()) {
        return;
    }

    m_baseIcon = qApp->windowIcon();

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

    connect(m_tray, &QSystemTrayIcon::messageClicked, this, [this]() {
        if (!m_queue.isEmpty()) {
            emit notificationActivated(m_queue.head().chatId);
        }
        emit showWindowRequested();
    });

    m_tray->show();

    m_player = new QMediaPlayer(this);
    m_player->setAudioOutput(new QAudioOutput(this));
    const auto soundPath = resolveSoundPath();
    if (QFile::exists(soundPath)) {
        m_player->setSource(QUrl::fromLocalFile(soundPath));
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
        const QString tip = m_unreadCount > 0
                                ? QString("ATEN — %1 непрочитанных").arg(m_unreadCount)
                                : QStringLiteral("ATEN");
        m_tray->setToolTip(tip);
    }

    const QIcon icon = appIconWithUnreadBadge(m_baseIcon, m_unreadCount);
    if (m_tray && !icon.isNull()) {
        m_tray->setIcon(icon);
    }
    applyUnreadBadgeToWindow(m_window, m_baseIcon, m_unreadCount);
}

void NotificationHub::showBackgroundHint()
{
    if (!m_tray) {
        return;
    }
    m_tray->showMessage(
        QStringLiteral("ATEN"),
        QStringLiteral("Приложение свёрнуто в трей. Уведомления и бейдж на иконке продолжают работать."),
        QSystemTrayIcon::Information,
        4000);
}

void NotificationHub::enqueueNotification(const QString &title, const QString &body, const QString &chatId)
{
    if (m_muted || !m_tray) {
        return;
    }
    m_queue.enqueue(PendingNotification{title, body, chatId});
    if (!m_drainTimer->isActive()) {
        drainNotificationQueue();
    }
}

void NotificationHub::playMessageSound()
{
    if (m_muted || !m_player) {
        return;
    }
    if (m_player->source().isEmpty()) {
        const auto soundPath = resolveSoundPath();
        if (QFile::exists(soundPath)) {
            m_player->setSource(QUrl::fromLocalFile(soundPath));
        }
    }
    if (m_player->source().isEmpty()) {
        return;
    }
    m_player->setPosition(0);
    m_player->play();
}

void NotificationHub::setMuted(bool muted)
{
    m_muted = muted;
}

void NotificationHub::drainNotificationQueue()
{
    if (!m_tray || m_queue.isEmpty()) {
        return;
    }

    const auto item = m_queue.dequeue();
    m_tray->showMessage(item.title, item.body, QSystemTrayIcon::Information, 5000);

    if (!m_queue.isEmpty()) {
        m_drainTimer->start();
    }
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
        if (QFile::exists(path)) {
            return path;
        }
    }
    return {};
}

} // namespace aten
