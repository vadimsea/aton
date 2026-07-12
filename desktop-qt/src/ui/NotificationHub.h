#pragma once

#include <QObject>
#include <QIcon>
#include <QQueue>
#include <QString>

class QMediaPlayer;
class QMenu;
class QSystemTrayIcon;
class QTimer;
class QWidget;

namespace aten {

struct PendingNotification {
    QString title;
    QString body;
    QString chatId;
    QIcon senderIcon;
};

class NotificationHub final : public QObject {
    Q_OBJECT

public:
    explicit NotificationHub(QWidget *window, QObject *parent = nullptr);

    bool isTrayActive() const { return m_tray != nullptr; }
    void setUnreadCount(int count);
    void enqueueNotification(
        const QString &title,
        const QString &body,
        const QString &chatId,
        const QIcon &senderIcon = {});
    void playMessageSound();
    void setMuted(bool muted);
    bool isMuted() const { return m_muted; }
    void showBackgroundHint();

signals:
    void notificationActivated(const QString &chatId);
    void showWindowRequested();
    void quitRequested();

private:
    void drainNotificationQueue();
    QString resolveSoundPath() const;

    QWidget *m_window = nullptr;
    QSystemTrayIcon *m_tray = nullptr;
    QMenu *m_trayMenu = nullptr;
    QMediaPlayer *m_player = nullptr;
    QTimer *m_drainTimer = nullptr;
    QWidget *m_toast = nullptr;
    QQueue<PendingNotification> m_queue;
    QIcon m_baseIcon;
    int m_unreadCount = 0;
    bool m_muted = false;
};

} // namespace aten
