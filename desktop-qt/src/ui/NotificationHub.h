#pragma once

#include <QObject>
#include <QQueue>
#include <QString>

class QMediaPlayer;
class QSystemTrayIcon;
class QTimer;
class QWidget;

namespace aten {

struct PendingNotification {
    QString title;
    QString body;
    QString chatId;
};

class NotificationHub final : public QObject {
    Q_OBJECT

public:
    explicit NotificationHub(QWidget *window, QObject *parent = nullptr);

    void setUnreadCount(int count);
    void enqueueNotification(const QString &title, const QString &body, const QString &chatId);
    void playMessageSound();
    void setMuted(bool muted);
    bool isMuted() const { return m_muted; }

signals:
    void notificationActivated(const QString &chatId);

private:
    void drainNotificationQueue();
    QString resolveSoundPath() const;

    QWidget *m_window = nullptr;
    QSystemTrayIcon *m_tray = nullptr;
    QMediaPlayer *m_player = nullptr;
    QTimer *m_drainTimer = nullptr;
    QQueue<PendingNotification> m_queue;
    int m_unreadCount = 0;
    bool m_muted = false;
};

} // namespace aten
