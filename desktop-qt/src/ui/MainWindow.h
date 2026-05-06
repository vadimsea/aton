#pragma once

#include <QMainWindow>

class QLabel;
class QLineEdit;
class QListWidget;

namespace aten {

class ApiClient;
class SessionStore;

class MainWindow final : public QMainWindow {
    Q_OBJECT

public:
    explicit MainWindow(ApiClient *apiClient, SessionStore *sessionStore, QWidget *parent = nullptr);

private:
    void buildUi();
    void wireApi();
    void setStatusText(const QString &text);

    ApiClient *m_apiClient;
    SessionStore *m_sessionStore;
    QLabel *m_statusLabel = nullptr;
    QListWidget *m_chatList = nullptr;
    QListWidget *m_messageList = nullptr;
    QLineEdit *m_composer = nullptr;
};

} // namespace aten
