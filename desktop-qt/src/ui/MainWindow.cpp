#include "ui/MainWindow.h"

#include "AppVersion.h"
#include "ui/NotificationHub.h"
#include "ui/Theme.h"

#include <algorithm>
#include <functional>
#include <numbers>
#include <QAbstractItemView>
#include <QApplication>
#include <QAudioInput>
#include <QAudioDevice>
#include <QAudioOutput>
#include <QButtonGroup>
#include <QDateTime>
#include <QDesktopServices>
#include <QCloseEvent>
#include <QCryptographicHash>
#include <QEvent>
#include <QGuiApplication>
#include <QShowEvent>
#include <QDateTime>
#include <QDialog>
#include <QDialogButtonBox>
#include <QDir>
#include <QFile>
#include <QFileDialog>
#include <QFileInfo>
#include <QFormLayout>
#include <QFontMetrics>
#include <QFrame>
#include <QHBoxLayout>
#include <QIcon>
#include <QInputDialog>
#include <QGraphicsOpacityEffect>
#include <QHeaderView>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QKeyEvent>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QListWidgetItem>
#include <QLocale>
#include <QMap>
#include <QMediaPlayer>
#include <QMediaCaptureSession>
#include <QMediaDevices>
#include <QMediaFormat>
#include <QMediaRecorder>
#include <QMenu>
#include <QMessageBox>
#include <QMimeDatabase>
#include <QMimeType>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QPainter>
#include <QPainterPath>
#include <QPixmap>
#include <QPropertyAnimation>
#include <QProcessEnvironment>
#include <QPushButton>
#include <QRegularExpression>
#include <QScrollBar>
#include <QScrollArea>
#include <QSettings>
#include <QSizePolicy>
#include <QSlider>
#include <QSplitter>
#include <QStandardPaths>
#include <QStackedWidget>
#include <QStatusBar>
#include <QStyle>
#include <QTabWidget>
#include <QTableWidget>
#include <QTableWidgetItem>
#include <QTextDocument>
#include <QTextOption>
#include <QTextEdit>
#include <QTimer>
#include <QUrl>
#include <QUrlQuery>
#include <QUuid>
#include <QVariantAnimation>
#include <QVersionNumber>
#include <QVBoxLayout>
#include <QWidget>
#include <QtMath>
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
    QString peerUsername;
    QString avatarDataUrl;
    bool verified = false;
    bool system = false;
    int unread = 0;
};

bool isGolosChatRow(const ChatRow &row)
{
    return row.system
        || row.peerUsername.compare("golos_aton", Qt::CaseInsensitive) == 0
        || row.id.contains("golos_aton", Qt::CaseInsensitive)
        || row.title.compare("Голос Атона", Qt::CaseInsensitive) == 0;
}

bool chatRowLess(const ChatRow &a, const ChatRow &b)
{
    const bool aGolos = isGolosChatRow(a);
    const bool bGolos = isGolosChatRow(b);
    if (aGolos != bGolos) return aGolos;
    if (a.lastTime == b.lastTime) return a.title.toLower() < b.title.toLower();
    if (a.lastTime.isEmpty()) return false;
    if (b.lastTime.isEmpty()) return true;
    return a.lastTime > b.lastTime;
}

QString linkifiedMessageHtml(const QString &text)
{
    static const QRegularExpression urlRx(QStringLiteral("https?://[^\\s<>\"']+"));
    QString html;
    qsizetype last = 0;
    const auto matches = urlRx.globalMatch(text);
    QRegularExpressionMatchIterator it = matches;
    while (it.hasNext()) {
        const QRegularExpressionMatch match = it.next();
        const qsizetype start = match.capturedStart();
        const qsizetype end = match.capturedEnd();
        if (start > last) html += text.mid(last, start - last).toHtmlEscaped();
        QString url = match.captured(0);
        while (!url.isEmpty() && QStringLiteral(").,;!?").contains(url.back())) url.chop(1);
        const QString trailing = match.captured(0).mid(url.size()).toHtmlEscaped();
        const QString safeUrl = url.toHtmlEscaped();
        html += QStringLiteral("<a href=\"%1\">%1</a>%2").arg(safeUrl, trailing);
        last = end;
    }
    if (last < text.size()) html += text.mid(last).toHtmlEscaped();
    return html;
}

QString firstMessageUrl(const QString &text)
{
    static const QRegularExpression urlRx(QStringLiteral("https?://[^\\s<>\"']+"));
    const auto match = urlRx.match(text);
    if (!match.hasMatch()) return {};
    QString url = match.captured(0);
    while (!url.isEmpty() && QStringLiteral(").,;!?").contains(url.back())) url.chop(1);
    return url;
}

enum class UiIcon {
    Search,
    Plus,
    User,
    Users,
    Sun,
    Menu,
    Pencil,
    Bell,
    BellOff,
    Paperclip,
    Mic,
    Heart,
    Reply,
    Pin,
    Trash,
    Play,
    Pause,
};

QIcon makeUiIcon(UiIcon icon, const QColor &color = QColor("#6d91c7"), int size = 20)
{
    QPixmap pixmap(size, size);
    pixmap.fill(Qt::transparent);
    QPainter painter(&pixmap);
    painter.setRenderHint(QPainter::Antialiasing);
    QPen pen(color, std::max(1.5, size / 10.0), Qt::SolidLine, Qt::RoundCap, Qt::RoundJoin);
    painter.setPen(pen);
    painter.setBrush(Qt::NoBrush);
    const qreal s = size / 24.0;
    const auto p = [s](qreal x, qreal y) { return QPointF(x * s, y * s); };
    const auto r = [s](qreal x, qreal y, qreal w, qreal h) { return QRectF(x * s, y * s, w * s, h * s); };

    switch (icon) {
    case UiIcon::Search:
        painter.drawEllipse(r(4, 4, 12, 12));
        painter.drawLine(p(15, 15), p(21, 21));
        break;
    case UiIcon::Plus:
        painter.drawLine(p(12, 5), p(12, 19));
        painter.drawLine(p(5, 12), p(19, 12));
        break;
    case UiIcon::User:
        painter.drawEllipse(r(8, 4, 8, 8));
        painter.drawArc(r(4, 13, 16, 9), 0, 180 * 16);
        break;
    case UiIcon::Users:
        painter.drawEllipse(r(5, 5, 7, 7));
        painter.drawEllipse(r(14, 6, 5, 5));
        painter.drawArc(r(2, 13, 13, 8), 0, 180 * 16);
        painter.drawArc(r(13, 14, 9, 6), 0, 180 * 16);
        break;
    case UiIcon::Sun:
        painter.drawEllipse(r(8, 8, 8, 8));
        for (int i = 0; i < 8; ++i) {
            const qreal a = i * std::numbers::pi / 4.0;
            painter.drawLine(
                p(12 + std::cos(a) * 7, 12 + std::sin(a) * 7),
                p(12 + std::cos(a) * 9, 12 + std::sin(a) * 9));
        }
        break;
    case UiIcon::Menu:
        painter.drawLine(p(4, 7), p(20, 7));
        painter.drawLine(p(4, 12), p(20, 12));
        painter.drawLine(p(4, 17), p(20, 17));
        break;
    case UiIcon::Pencil:
        painter.drawLine(p(5, 19), p(8, 16));
        painter.drawLine(p(8, 16), p(17, 7));
        painter.drawLine(p(17, 7), p(20, 10));
        painter.drawLine(p(20, 10), p(11, 19));
        painter.drawLine(p(5, 19), p(11, 19));
        break;
    case UiIcon::Bell:
    case UiIcon::BellOff:
        painter.drawArc(r(6, 4, 12, 14), 20 * 16, 140 * 16);
        painter.drawLine(p(6, 14), p(4, 18));
        painter.drawLine(p(4, 18), p(20, 18));
        painter.drawLine(p(20, 18), p(18, 14));
        painter.drawArc(r(10, 18, 4, 3), 180 * 16, 180 * 16);
        if (icon == UiIcon::BellOff) painter.drawLine(p(4, 4), p(20, 20));
        break;
    case UiIcon::Paperclip:
    {
        QPainterPath path;
        path.moveTo(p(9, 17));
        path.lineTo(p(17, 9));
        path.cubicTo(p(19, 7), p(19, 4), p(17, 3));
        path.cubicTo(p(15, 1), p(12, 2), p(10, 4));
        path.lineTo(p(4, 10));
        path.cubicTo(p(1, 13), p(2, 17), p(5, 20));
        path.cubicTo(p(8, 22), p(12, 21), p(14, 19));
        path.lineTo(p(20, 13));
        painter.drawPath(path);
        break;
    }
    case UiIcon::Mic:
        painter.drawRoundedRect(r(9, 3, 6, 12), 3 * s, 3 * s);
        painter.drawArc(r(6, 8, 12, 10), 180 * 16, 180 * 16);
        painter.drawLine(p(12, 18), p(12, 22));
        painter.drawLine(p(8, 22), p(16, 22));
        break;
    case UiIcon::Heart: {
        QPainterPath path;
        path.moveTo(p(12, 20));
        path.cubicTo(p(3, 14), p(4, 7), p(8, 6));
        path.cubicTo(p(10, 5), p(12, 7), p(12, 9));
        path.cubicTo(p(12, 7), p(14, 5), p(16, 6));
        path.cubicTo(p(20, 7), p(21, 14), p(12, 20));
        painter.drawPath(path);
        break;
    }
    case UiIcon::Reply:
        painter.drawLine(p(9, 14), p(4, 9));
        painter.drawLine(p(4, 9), p(9, 4));
        painter.drawLine(p(4, 9), p(14, 9));
        painter.drawArc(r(8, 9, 12, 12), 0, 90 * 16);
        painter.drawLine(p(20, 15), p(20, 18));
        break;
    case UiIcon::Pin:
        painter.drawLine(p(8, 5), p(16, 5));
        painter.drawLine(p(9, 5), p(9, 11));
        painter.drawLine(p(15, 5), p(15, 11));
        painter.drawLine(p(7, 11), p(17, 11));
        painter.drawLine(p(12, 11), p(12, 21));
        break;
    case UiIcon::Trash:
        painter.drawLine(p(5, 7), p(19, 7));
        painter.drawLine(p(9, 4), p(15, 4));
        painter.drawRoundedRect(r(7, 7, 10, 13), 1 * s, 1 * s);
        painter.drawLine(p(10, 10), p(10, 17));
        painter.drawLine(p(14, 10), p(14, 17));
        break;
    case UiIcon::Play: {
        QPainterPath path;
        path.moveTo(p(9, 6));
        path.lineTo(p(18, 12));
        path.lineTo(p(9, 18));
        path.closeSubpath();
        painter.drawPath(path);
        break;
    }
    case UiIcon::Pause:
        painter.drawLine(p(9, 6), p(9, 18));
        painter.drawLine(p(15, 6), p(15, 18));
        break;
    }
    return QIcon(pixmap);
}

QString messagePreview(const QJsonObject &msg)
{
    const auto type = msg.value("type").toString("text");
    if (type == "image") return "Фото";
    if (type == "audio") return "Голосовое сообщение";
    const auto text = msg.value("text").toString().simplified();
    if (text.isEmpty()) return "Сообщение";
    return text.size() > 52 ? text.left(49) + "..." : text;
}

QString compactTime(const QString &value)
{
    if (value.isEmpty()) return {};
    auto dt = QDateTime::fromString(value, Qt::ISODateWithMs);
    if (!dt.isValid()) dt = QDateTime::fromString(value, Qt::ISODate);
    if (!dt.isValid()) return {};
    return dt.toLocalTime().toString("HH:mm");
}

QString messageDateTimeLabel(const QString &value)
{
    if (value.isEmpty()) return {};
    auto dt = QDateTime::fromString(value, Qt::ISODateWithMs);
    if (!dt.isValid()) dt = QDateTime::fromString(value, Qt::ISODate);
    if (!dt.isValid() && value.endsWith('Z')) {
        dt = QDateTime::fromString(value.left(value.size() - 1), Qt::ISODateWithMs);
        if (dt.isValid()) dt.setTimeSpec(Qt::UTC);
    }
    if (!dt.isValid()) return {};
    return dt.toLocalTime().time().toString("HH:mm");
}

QDateTime parseMessageDateTime(const QString &value)
{
    if (value.isEmpty()) return {};
    auto dt = QDateTime::fromString(value, Qt::ISODateWithMs);
    if (!dt.isValid()) dt = QDateTime::fromString(value, Qt::ISODate);
    if (!dt.isValid() && value.endsWith('Z')) {
        dt = QDateTime::fromString(value.left(value.size() - 1), Qt::ISODateWithMs);
        if (dt.isValid()) dt.setTimeSpec(Qt::UTC);
    }
    return dt.isValid() ? dt.toLocalTime() : QDateTime{};
}

QString messageDateKey(const QString &value)
{
    const auto dt = parseMessageDateTime(value);
    return dt.isValid() ? dt.date().toString(Qt::ISODate) : QString{};
}

QString messageDaySeparatorLabel(const QString &value)
{
    const auto dt = parseMessageDateTime(value);
    if (!dt.isValid()) return {};
    const auto date = dt.date();
    const auto today = QDate::currentDate();
    if (date == today) return QString::fromUtf8("Сегодня");
    if (date == today.addDays(-1)) return QString::fromUtf8("Вчера");
    const QLocale ru(QLocale::Russian, QLocale::Russia);
    const auto dateFormat = date.year() == today.year() ? QStringLiteral("d MMMM") : QStringLiteral("d MMMM yyyy");
    return ru.toString(date, dateFormat);
}

QWidget *makeMessageDateSeparatorWidget(const QString &label, QWidget *parent)
{
    auto *wrap = new QWidget(parent);
    wrap->setObjectName("MessageDateSeparatorWrap");
    auto *layout = new QHBoxLayout(wrap);
    layout->setContentsMargins(0, 4, 0, 4);
    layout->setSpacing(0);
    auto *pill = new QLabel(label, wrap);
    pill->setObjectName("MessageDateSeparatorLabel");
    pill->setAlignment(Qt::AlignCenter);
    pill->setSizePolicy(QSizePolicy::Maximum, QSizePolicy::Fixed);
    layout->addStretch(1);
    layout->addWidget(pill);
    layout->addStretch(1);
    return wrap;
}

QString mediaTimeLabel(qint64 ms)
{
    if (ms <= 0) return "0:00";
    const auto totalSeconds = ms / 1000;
    const auto minutes = totalSeconds / 60;
    const auto seconds = totalSeconds % 60;
    return QString("%1:%2").arg(minutes).arg(seconds, 2, 10, QLatin1Char('0'));
}

bool isDirectChatId(const QString &chatId)
{
    return chatId.contains("|") && !chatId.startsWith("group:") && !chatId.startsWith("channel:");
}

QString peerFromDirectChatId(const QString &chatId, const QString &me)
{
    const auto parts = chatId.split("|");
    if (parts.size() != 2) return {};
    if (parts[0].compare(me, Qt::CaseInsensitive) == 0) return parts[1];
    if (parts[1].compare(me, Qt::CaseInsensitive) == 0) return parts[0];
    return {};
}

QString directChatIdForUsers(QString a, QString b)
{
    if (a > b) std::swap(a, b);
    return QString("%1|%2").arg(a, b);
}

QString formatPeerLastSeenText(const QString &value)
{
    if (value.isEmpty()) return "последний вход неизвестен";
    auto dt = QDateTime::fromString(value, Qt::ISODateWithMs);
    if (!dt.isValid()) dt = QDateTime::fromString(value, Qt::ISODate);
    if (!dt.isValid() && value.endsWith('Z')) {
        dt = QDateTime::fromString(value.left(value.size() - 1), Qt::ISODateWithMs);
        if (dt.isValid()) dt.setTimeSpec(Qt::UTC);
    }
    if (!dt.isValid()) return "последний вход неизвестен";
    const auto local = dt.toLocalTime();
    const auto now = QDateTime::currentDateTime();
    const auto seconds = local.secsTo(now);
    if (seconds >= 0 && seconds < 90) return "в сети";
    const QLocale ru(QLocale::Russian, QLocale::Russia);
    const auto today = now.date();
    if (local.date() == today) {
        return QString("был(а) в сети сегодня в %1").arg(local.time().toString("HH:mm"));
    }
    if (local.date() == today.addDays(-1)) {
        return QString("был(а) в сети вчера в %1").arg(local.time().toString("HH:mm"));
    }
    if (local.date().year() == today.year()) {
        return QString("был(а) в сети %1").arg(ru.toString(local.date(), "d MMMM"));
    }
    return QString("был(а) в сети %1").arg(ru.toString(local.date(), "d MMMM yyyy"));
}

void rememberLastSeen(QMap<QString, QString> &byUsername, const QJsonObject &user)
{
    const auto username = user.value("username").toString();
    const auto lastSeen = user.value("lastSeen").toString();
    if (!username.isEmpty() && !lastSeen.isEmpty()) {
        byUsername.insert(username.toLower(), lastSeen);
    }
}

void rememberBio(QMap<QString, QString> &byUsername, const QJsonObject &user)
{
    const auto username = user.value("username").toString();
    const auto bio = user.value("bio").toString().simplified();
    if (!username.isEmpty()) {
        if (bio.isEmpty()) {
            byUsername.remove(username.toLower());
        } else {
            byUsername.insert(username.toLower(), bio);
        }
    }
}

QByteArray decodeDataUrlPayload(const QString &dataUrl)
{
    const auto comma = dataUrl.indexOf(',');
    if (comma < 0) return {};
    return QByteArray::fromBase64(dataUrl.mid(comma + 1).toLatin1());
}

QString dataUrlMime(const QString &dataUrl)
{
    if (!dataUrl.startsWith("data:", Qt::CaseInsensitive)) return {};
    const auto semicolon = dataUrl.indexOf(';');
    if (semicolon < 5) return {};
    return dataUrl.mid(5, semicolon - 5).toLower();
}

QString fileToDataUrl(const QString &path, const QStringList &allowedMimeTypes, qint64 maxBytes)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) return {};
    if (file.size() <= 0 || file.size() > maxBytes) return {};

    const QMimeDatabase mimeDb;
    auto mime = mimeDb.mimeTypeForFile(QFileInfo(path));
    auto mimeName = mime.name().toLower();
    if (mimeName == "audio/x-wav") mimeName = "audio/wav";
    if (mimeName == "audio/x-mpeg") mimeName = "audio/mpeg";
    if (mimeName == "image/jpg") mimeName = "image/jpeg";
    if (!allowedMimeTypes.contains(mimeName)) return {};

    const auto payload = file.readAll().toBase64();
    return QString("data:%1;base64,%2").arg(mimeName, QString::fromLatin1(payload));
}

QString extensionForAudioMime(const QString &mime)
{
    if (mime.contains("ogg")) return "ogg";
    if (mime.contains("mpeg") || mime.contains("mp3")) return "mp3";
    if (mime.contains("wav")) return "wav";
    if (mime.contains("mp4")) return "m4a";
    return "webm";
}

QString writeAudioDataUrlToCache(const QString &dataUrl)
{
    const auto bytes = decodeDataUrlPayload(dataUrl);
    if (bytes.isEmpty()) return {};

    auto dir = QStandardPaths::writableLocation(QStandardPaths::CacheLocation);
    if (dir.isEmpty()) {
        dir = QDir::tempPath() + "/aten-desktop";
    }
    QDir().mkpath(dir);

    const auto ext = extensionForAudioMime(dataUrlMime(dataUrl));
    const auto hash = QString::fromLatin1(QCryptographicHash::hash(bytes, QCryptographicHash::Sha1).toHex());
    const auto path = QDir(dir).filePath(QString("voice-%1.%2").arg(hash, ext));
    if (QFile::exists(path)) return path;
    QFile file(path);
    if (!file.open(QIODevice::WriteOnly)) return {};
    file.write(bytes);
    return path;
}

QPixmap pixmapFromImageDataUrl(const QString &dataUrl)
{
    QPixmap pixmap;
    pixmap.loadFromData(decodeDataUrlPayload(dataUrl));
    return pixmap;
}

QPixmap pixmapFromAvatarRef(const QString &avatarRef)
{
    auto pixmap = pixmapFromImageDataUrl(avatarRef);
    if (!pixmap.isNull()) return pixmap;

    if (avatarRef.contains("golos-aton-avatar", Qt::CaseInsensitive)) {
        const QStringList candidates = {
            QDir(QCoreApplication::applicationDirPath()).filePath("golos-aton-avatar.png"),
            QDir(QDir::currentPath()).filePath("golos-aton-avatar.png"),
            QDir(QCoreApplication::applicationDirPath()).filePath("../../golos-aton-avatar.png"),
            QDir(QCoreApplication::applicationDirPath()).filePath("../../../golos-aton-avatar.png"),
        };
        for (const auto &path : candidates) {
            if (pixmap.load(path)) return pixmap;
        }
    }
    return {};
}

QPixmap circularPixmap(const QPixmap &source, int size)
{
    if (source.isNull()) return {};
    QPixmap out(size, size);
    out.fill(Qt::transparent);

    QPainter painter(&out);
    painter.setRenderHint(QPainter::Antialiasing, true);
    QPainterPath clip;
    clip.addEllipse(0, 0, size, size);
    painter.setClipPath(clip);
    const auto scaled = source.scaled(size, size, Qt::KeepAspectRatioByExpanding, Qt::SmoothTransformation);
    painter.drawPixmap((size - scaled.width()) / 2, (size - scaled.height()) / 2, scaled);
    painter.setClipping(false);
    painter.setPen(QPen(QColor("#cbd5e1"), 1));
    painter.drawEllipse(QRectF(0.5, 0.5, size - 1, size - 1));
    return out;
}

QPixmap letterAvatarPixmap(const QString &title, int size, bool voice)
{
    QPixmap out(size, size);
    out.fill(Qt::transparent);

    QPainter painter(&out);
    painter.setRenderHint(QPainter::Antialiasing, true);
    QRadialGradient gradient(size * 0.4, size * 0.34, size * 0.74);
    if (voice) {
        gradient.setColorAt(0.0, QColor("#fef3c7"));
        gradient.setColorAt(0.42, QColor("#f59e0b"));
        gradient.setColorAt(1.0, QColor("#111827"));
    } else {
        gradient.setColorAt(0.0, QColor("#eff6ff"));
        gradient.setColorAt(1.0, QColor("#bfdbfe"));
    }
    painter.setBrush(gradient);
    painter.setPen(QPen(voice ? QColor("#111827") : QColor("#bfdbfe"), 1.2));
    painter.drawEllipse(QRectF(0.8, 0.8, size - 1.6, size - 1.6));

    auto font = painter.font();
    font.setPixelSize(size * 0.42);
    font.setBold(true);
    painter.setFont(font);
    painter.setPen(voice ? QColor("#111827") : QColor("#2563eb"));
    painter.drawText(QRectF(0, 0, size, size), Qt::AlignCenter, title.left(1).toUpper());
    return out;
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

QStringList atenLogoPaths()
{
    const QString appDir = QCoreApplication::applicationDirPath();
    return {
        appDir + "/aten-logo.png",
        appDir + "/../resources/aten-logo.png",
        appDir + "/../../resources/aten-logo.png",
    };
}

QPixmap loadAtenLogoPixmap(int size, bool glowFallback)
{
    for (const QString &path : atenLogoPaths()) {
        if (!QFile::exists(path)) {
            continue;
        }
        QPixmap src(path);
        if (src.isNull()) {
            continue;
        }
        return src.scaled(size, size, Qt::KeepAspectRatio, Qt::SmoothTransformation);
    }
    return makeAtenMarkPixmap(size, glowFallback);
}

QPixmap loadAtenHeroLogoPixmap(int size)
{
    return loadAtenLogoPixmap(size, false);
}

QPushButton *makeToolbarButton(UiIcon icon, const QString &toolTip, QWidget *parent)
{
    auto *button = new QPushButton(parent);
    button->setObjectName("HeaderIconButton");
    button->setFixedSize(40, 40);
    button->setIcon(makeUiIcon(icon));
    button->setIconSize(QSize(20, 20));
    button->setToolTip(toolTip);
    button->setCursor(Qt::PointingHandCursor);
    return button;
}

int messageRowHeight(const QJsonObject &msg)
{
    const auto type = msg.value("type").toString("text");
    int height = type == "image" ? 320 : type == "audio" ? 108 : 82;
    if (type == "text") {
        const auto text = msg.value("text").toString();
        const int explicitLines = std::max(1, static_cast<int>(text.count('\n') + 1));
        const int wrappedLines = std::max(1, static_cast<int>(text.simplified().size() / 34 + 1));
        height = 74 + std::max(explicitLines, wrappedLines) * 28;
    }
    if (!msg.value("replyTo").toString().isEmpty()) height += 54;
    if (!msg.value("reactions").toArray().isEmpty()) height += 36;
    return std::clamp(height, 82, 680);
}

int messageTextWidth(const QString &text, const QFont &font)
{
    const auto clean = text.simplified();
    if (clean.isEmpty()) return 72;
    QFontMetrics metrics(font);
    if (clean.size() > 42) return 360;
    const auto natural = metrics.horizontalAdvance(clean);
    return std::clamp(natural + 8, 48, 360);
}

int richMessageTextHeight(const QString &html, const QFont &font, int width)
{
    QTextDocument doc;
    doc.setDefaultFont(font);
    doc.setDocumentMargin(0);
    doc.setTextWidth(width);
    doc.setHtml(html);
    return static_cast<int>(std::ceil(doc.size().height())) + 6;
}

QWidget *makeChatRowWidget(const ChatRow &row, QWidget *parent)
{
    auto *wrap = new QWidget(parent);
    wrap->setObjectName("ChatRowWidget");
    auto *layout = new QHBoxLayout(wrap);
    layout->setContentsMargins(10, 7, 10, 7);
    layout->setSpacing(11);

    auto *avatar = new QLabel(wrap);
    const bool voice = row.id.contains("golos_aton", Qt::CaseInsensitive) || row.system;
    avatar->setObjectName("ChatAvatarImage");
    avatar->setFixedSize(46, 46);
    avatar->setAlignment(Qt::AlignCenter);
    auto avatarSource = row.avatarDataUrl;
    if (voice && avatarSource.isEmpty()) {
        avatarSource = "/golos-aton-avatar.png";
    }
    auto avatarPixmap = circularPixmap(pixmapFromAvatarRef(avatarSource), 46);
    if (avatarPixmap.isNull()) {
        avatarPixmap = letterAvatarPixmap(row.title, 46, voice);
    }
    avatar->setPixmap(avatarPixmap);

    auto *copy = new QWidget(wrap);
    copy->setMinimumWidth(0);
    copy->setMaximumWidth(175);
    auto *copyLayout = new QVBoxLayout(copy);
    copyLayout->setContentsMargins(0, 0, 0, 0);
    copyLayout->setSpacing(4);

    auto *titleLine = new QWidget(copy);
    titleLine->setObjectName("ChatRowTitleLine");
    auto *titleLayout = new QHBoxLayout(titleLine);
    titleLayout->setContentsMargins(0, 0, 0, 0);
    titleLayout->setSpacing(5);
    auto *title = new QLabel(titleLine);
    title->setObjectName("ChatRowTitle");
    title->setTextFormat(Qt::PlainText);
    title->setSizePolicy(QSizePolicy::Preferred, QSizePolicy::Fixed);
    title->setMaximumWidth(146);
    title->setText(QFontMetrics(title->font()).elidedText(row.title, Qt::ElideRight, 146));
    title->setToolTip(row.title);
    titleLayout->addWidget(title);
    if (row.verified) {
        auto *verified = new QLabel(QString::fromUtf8("\xE2\x9C\x93"), titleLine);
        verified->setObjectName("ChatOfficialBadge");
        verified->setAlignment(Qt::AlignCenter);
        verified->setFixedSize(16, 16);
        verified->setToolTip(QStringLiteral("Официальный аккаунт"));
        titleLayout->addWidget(verified);
    }
    titleLayout->addStretch(1);

    const auto previewText = row.preview.isEmpty() ? QStringLiteral("Нет сообщений") : row.preview;
    auto *preview = new QLabel(copy);
    preview->setObjectName("ChatRowPreview");
    preview->setTextFormat(Qt::PlainText);
    preview->setMaximumWidth(175);
    preview->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);
    preview->setText(QFontMetrics(preview->font()).elidedText(previewText, Qt::ElideRight, 175));
    preview->setToolTip(previewText);
    copyLayout->addWidget(titleLine);
    copyLayout->addWidget(preview);

    auto *meta = new QLabel(compactTime(row.lastTime), wrap);
    meta->setObjectName("ChatRowTime");
    meta->setAlignment(Qt::AlignTop | Qt::AlignRight);
    meta->setFixedWidth(42);

    auto *metaColumn = new QWidget(wrap);
    auto *metaLayout = new QVBoxLayout(metaColumn);
    metaLayout->setContentsMargins(0, 0, 0, 0);
    metaLayout->setSpacing(5);
    metaLayout->addWidget(meta, 0, Qt::AlignTop | Qt::AlignRight);
    if (row.unread > 0) {
        auto *badge = new QLabel(metaColumn);
        badge->setObjectName("ChatUnreadBadge");
        badge->setAlignment(Qt::AlignCenter);
        badge->setMinimumSize(22, 22);
        badge->setMaximumHeight(22);
        badge->setText(row.unread > 99 ? "99+" : QString::number(row.unread));
        metaLayout->addWidget(badge, 0, Qt::AlignTop | Qt::AlignRight);
    }

    layout->addWidget(avatar);
    layout->addWidget(copy, 1);
    layout->addWidget(metaColumn);
    return wrap;
}

struct ReactionSummary
{
    QString emoji;
    int count = 0;
    QStringList users;
    bool reactedByMe = false;
};

QList<ReactionSummary> reactionSummaryList(const QJsonArray &reactions, const QString &currentUsername)
{
    QMap<QString, ReactionSummary> grouped;
    for (const auto &value : reactions) {
        const auto obj = value.toObject();
        const auto emoji = obj.value("emoji").toString().trimmed();
        if (emoji.isEmpty()) continue;
        auto item = grouped.value(emoji);
        item.emoji = emoji;
        item.count += 1;
        const auto user = obj.value("user").toString();
        if (!user.isEmpty()) item.users << user;
        if (!currentUsername.isEmpty() && user == currentUsername) item.reactedByMe = true;
        grouped[emoji] = item;
    }

    QList<ReactionSummary> result;
    for (auto it = grouped.cbegin(); it != grouped.cend(); ++it) {
        result << it.value();
    }
    const QStringList preferred = {
        QString::fromUtf8("\xF0\x9F\x91\x8D"),
        QString::fromUtf8("\xE2\x9D\xA4\xEF\xB8\x8F"),
        QString::fromUtf8("\xF0\x9F\x94\xA5"),
        QString::fromUtf8("\xF0\x9F\x98\x81"),
        QString::fromUtf8("\xF0\x9F\x98\xA2"),
        QString::fromUtf8("\xF0\x9F\x91\x8F"),
        QString::fromUtf8("\xF0\x9F\xA4\xAF"),
        QString::fromUtf8("\xF0\x9F\x91\x8E"),
    };
    std::sort(result.begin(), result.end(), [&preferred](const ReactionSummary &a, const ReactionSummary &b) {
        if (a.reactedByMe != b.reactedByMe) return a.reactedByMe;
        const int ai = preferred.indexOf(a.emoji);
        const int bi = preferred.indexOf(b.emoji);
        if (ai != bi) return (ai < 0 ? 999 : ai) < (bi < 0 ? 999 : bi);
        return a.emoji < b.emoji;
    });
    return result;
}

QString ownReactionEmoji(const QJsonArray &reactions, const QString &currentUsername)
{
    if (currentUsername.isEmpty()) return {};
    for (const auto &value : reactions) {
        const auto obj = value.toObject();
        if (obj.value("user").toString() == currentUsername) {
            return obj.value("emoji").toString().trimmed();
        }
    }
    return {};
}

QJsonObject findMessageById(const QJsonArray &messages, const QString &id)
{
    if (id.isEmpty()) return {};
    for (const auto &value : messages) {
        const auto msg = value.toObject();
        if (msg.value("id").toString() == id) return msg;
    }
    return {};
}

QString messageReplyAuthorLabel(const QJsonObject &msg, const QString &currentUsername)
{
    const auto from = msg.value("from").toString(msg.value("senderUsername").toString());
    if (!currentUsername.isEmpty() && from == currentUsername) return "Вы";
    return msg.value("displayName").toString(from.isEmpty() ? "Сообщение" : from);
}

QString messageReplyExcerpt(const QJsonObject &msg)
{
    const auto type = msg.value("type").toString("text");
    if (type == "image") return "Фото";
    if (type == "audio") return "Голосовое сообщение";
    auto text = msg.value("text").toString().simplified();
    if (text.isEmpty()) text = QString("[%1]").arg(type);
    return text.size() > 90 ? text.left(87) + "..." : text;
}

QWidget *makeMessageRowWidget(
    const QJsonObject &msg,
    const QString &currentUsername,
    ApiClient *apiClient,
    const QJsonArray &allMessages,
    const std::function<void(const QJsonObject &)> &replyHandler,
    const std::function<void(const QJsonObject &)> &reportHandler,
    const std::function<void(const QString &)> &deleteHandler,
    QWidget *parent)
{
    const auto from = msg.value("from").toString(msg.value("senderUsername").toString("user"));
    const auto senderTitle = msg.value("senderDisplayName").toString(from);
    const auto type = msg.value("type").toString("text");
    const auto time = messageDateTimeLabel(msg.value("createdAt").toString(msg.value("time").toString()));

    const bool isSelf = !currentUsername.isEmpty() && from == currentUsername;
    auto *row = new QWidget(parent);
    row->setObjectName("MessageRow");
    auto *rowLayout = new QHBoxLayout(row);
    rowLayout->setContentsMargins(18, 4, 18, 4);
    rowLayout->setSpacing(8);

    QLabel *senderAvatar = nullptr;
    if (!isSelf) {
        senderAvatar = new QLabel(row);
        senderAvatar->setObjectName("MessageSenderAvatar");
        senderAvatar->setFixedSize(34, 34);
        senderAvatar->setAlignment(Qt::AlignCenter);
        auto avatarSource = msg.value("senderAvatarDataUrl").toString();
        if (avatarSource.isEmpty() && from.compare("golos_aton", Qt::CaseInsensitive) == 0) {
            avatarSource = "/golos-aton-avatar.png";
        }
        auto avatarPixmap = circularPixmap(pixmapFromAvatarRef(avatarSource), 34);
        if (avatarPixmap.isNull()) {
            avatarPixmap = letterAvatarPixmap(senderTitle, 34, from.compare("golos_aton", Qt::CaseInsensitive) == 0);
        }
        senderAvatar->setPixmap(avatarPixmap);
    }

    auto *bubble = new QFrame(row);
    bubble->setObjectName(isSelf ? "MessageBubbleSelf" : "MessageBubbleOther");
    bubble->setMinimumWidth(type == "audio" ? 320 : 72);
    bubble->setMaximumWidth(type == "image" ? 390 : 460);
    auto *bubbleLayout = new QVBoxLayout(bubble);
    bubbleLayout->setContentsMargins(12, 8, 12, 8);
    bubbleLayout->setSpacing(5);
    if (type == "audio") {
        bubble->setFixedWidth(330);
    }

    if (msg.value("pinned").toBool()) {
        auto *pinnedBadge = new QLabel("Закреплено", bubble);
        pinnedBadge->setObjectName("MessagePinnedBadge");
        bubbleLayout->addWidget(pinnedBadge, 0, Qt::AlignLeft);
    }

    const auto replyToId = msg.value("replyTo").toString();
    const auto replied = findMessageById(allMessages, replyToId);
    if (!replied.isEmpty()) {
        auto *replyPreview = new QFrame(bubble);
        replyPreview->setObjectName("MessageReplyPreview");
        auto *replyLayout = new QVBoxLayout(replyPreview);
        replyLayout->setContentsMargins(10, 7, 10, 7);
        replyLayout->setSpacing(2);
        auto *replyAuthor = new QLabel(messageReplyAuthorLabel(replied, currentUsername), replyPreview);
        replyAuthor->setObjectName("MessageReplyAuthor");
        auto *replyText = new QLabel(messageReplyExcerpt(replied), replyPreview);
        replyText->setObjectName("MessageReplyText");
        replyText->setWordWrap(true);
        replyText->setTextFormat(Qt::PlainText);
        replyLayout->addWidget(replyAuthor);
        replyLayout->addWidget(replyText);
        bubbleLayout->addWidget(replyPreview);
    }

    if (type == "image") {
        const auto imageDataUrl = msg.value("imageDataUrl").toString();
        const auto pixmap = pixmapFromImageDataUrl(imageDataUrl);
        if (!pixmap.isNull()) {
            auto *image = new QPushButton(bubble);
            image->setObjectName("MessageImageButton");
            image->setCursor(Qt::PointingHandCursor);
            const auto scaled = pixmap.scaled(QSize(325, 250), Qt::KeepAspectRatio, Qt::SmoothTransformation);
            image->setIcon(QIcon(scaled));
            image->setIconSize(scaled.size());
            image->setFixedSize(scaled.size());
            QObject::connect(image, &QPushButton::clicked, image, [pixmap, image]() {
                QDialog viewer(image);
                viewer.setWindowTitle("Изображение");
                viewer.setMinimumSize(420, 320);
                auto *layout = new QVBoxLayout(&viewer);
                layout->setContentsMargins(14, 14, 14, 14);
                layout->setSpacing(10);
                auto *photo = new QLabel(&viewer);
                photo->setAlignment(Qt::AlignCenter);
                photo->setPixmap(pixmap.scaled(QSize(1080, 760), Qt::KeepAspectRatio, Qt::SmoothTransformation));
                auto *close = new QPushButton("Закрыть", &viewer);
                close->setObjectName("SecondaryButton");
                QObject::connect(close, &QPushButton::clicked, &viewer, &QDialog::accept);
                layout->addWidget(photo, 1);
                layout->addWidget(close, 0, Qt::AlignRight);
                viewer.exec();
            });
            bubbleLayout->addWidget(image);
        } else {
            auto *fallback = new QLabel("Фото не удалось открыть", bubble);
            fallback->setObjectName("MessageMediaFallback");
            bubbleLayout->addWidget(fallback);
        }
    } else if (type == "audio") {
        const auto audioDataUrl = msg.value("audioDataUrl").toString();
        const auto audioPath = writeAudioDataUrlToCache(audioDataUrl);
        auto *voiceRow = new QWidget(bubble);
        auto *voiceLayout = new QHBoxLayout(voiceRow);
        voiceLayout->setContentsMargins(0, 2, 0, 2);
        voiceLayout->setSpacing(10);
        auto *playButton = new QPushButton(voiceRow);
        playButton->setObjectName("VoicePlayButton");
        playButton->setFixedSize(44, 44);
        playButton->setIcon(makeUiIcon(UiIcon::Play, QColor("#3b82f6"), 18));
        playButton->setIconSize(QSize(18, 18));
        playButton->setEnabled(!audioPath.isEmpty());
        auto *track = new QSlider(Qt::Horizontal, voiceRow);
        track->setObjectName("VoiceTrack");
        track->setRange(0, 0);
        track->setEnabled(!audioPath.isEmpty());
        auto *label = new QLabel(audioPath.isEmpty() ? "Голосовое недоступно" : "0:00 / 0:00", voiceRow);
        label->setObjectName("VoiceMessageLabel");
        voiceLayout->addWidget(playButton);
        auto *voiceProgress = new QWidget(voiceRow);
        auto *voiceProgressLayout = new QVBoxLayout(voiceProgress);
        voiceProgressLayout->setContentsMargins(0, 0, 0, 0);
        voiceProgressLayout->setSpacing(2);
        voiceProgressLayout->addWidget(track);
        voiceProgressLayout->addWidget(label);
        voiceLayout->addWidget(voiceProgress, 1);
        bubbleLayout->addWidget(voiceRow);

        if (!audioPath.isEmpty()) {
            auto *player = new QMediaPlayer(playButton);
            auto *audioOutput = new QAudioOutput(playButton);
            audioOutput->setVolume(1.0);
            player->setAudioOutput(audioOutput);
            player->setSource(QUrl::fromLocalFile(audioPath));

            QObject::connect(track, &QSlider::sliderMoved, player, [player](int value) {
                player->setPosition(value);
            });
            QObject::connect(playButton, &QPushButton::clicked, playButton, [player]() {
                if (player->playbackState() == QMediaPlayer::PlayingState) {
                    player->pause();
                } else {
                    player->play();
                }
            });
            QObject::connect(player, &QMediaPlayer::playbackStateChanged, playButton, [playButton](QMediaPlayer::PlaybackState state) {
                playButton->setIcon(makeUiIcon(
                    state == QMediaPlayer::PlayingState ? UiIcon::Pause : UiIcon::Play,
                    QColor("#3b82f6"),
                    18));
            });
            QObject::connect(player, &QMediaPlayer::durationChanged, track, [track, label, player](qint64 duration) {
                track->setRange(0, static_cast<int>(std::max<qint64>(0, duration)));
                label->setText(QString("%1 / %2").arg(mediaTimeLabel(player->position()), mediaTimeLabel(duration)));
            });
            QObject::connect(player, &QMediaPlayer::positionChanged, track, [track, label, player](qint64 position) {
                if (!track->isSliderDown()) {
                    track->blockSignals(true);
                    track->setValue(static_cast<int>(position));
                    track->blockSignals(false);
                }
                label->setText(QString("%1 / %2").arg(mediaTimeLabel(position), mediaTimeLabel(player->duration())));
            });
            QObject::connect(player, &QMediaPlayer::mediaStatusChanged, playButton, [player, playButton](QMediaPlayer::MediaStatus status) {
                if (status == QMediaPlayer::EndOfMedia) {
                    player->setPosition(0);
                    playButton->setIcon(makeUiIcon(UiIcon::Play, QColor("#3b82f6"), 18));
                }
            });
        }
    } else {
        const auto textValue = type == "text" ? msg.value("text").toString() : QString("[%1]").arg(type);
        auto *label = new QLabel(textValue, bubble);
        label->setObjectName("MessageText");
        label->setWordWrap(true);
        label->setText(linkifiedMessageHtml(textValue));
        label->setTextFormat(Qt::RichText);
        label->setOpenExternalLinks(true);
        label->setTextInteractionFlags(Qt::TextBrowserInteraction);
        const auto textWidth = messageTextWidth(textValue, label->font());
        label->setFixedWidth(textWidth);
        label->setMinimumHeight(richMessageTextHeight(label->text(), label->font(), textWidth));
        const int actionWidth = isSelf ? 190 : 104;
        bubble->setFixedWidth(std::max(textWidth + 32, actionWidth));
        label->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);
        bubbleLayout->addWidget(label);
        const QString previewUrl = firstMessageUrl(textValue);
        if (apiClient && !previewUrl.isEmpty()) {
            auto *previewCard = new QFrame(bubble);
            previewCard->setObjectName("LinkPreviewCard");
            auto *previewLayout = new QVBoxLayout(previewCard);
            previewLayout->setContentsMargins(10, 8, 10, 8);
            previewLayout->setSpacing(3);
            const QString host = QUrl(previewUrl).host().remove(QRegularExpression(QStringLiteral("^www\\.")));
            auto *siteLabel = new QLabel(host.isEmpty() ? QStringLiteral("Link") : host, previewCard);
            siteLabel->setObjectName("LinkPreviewSite");
            auto *titleLabel = new QLabel(previewUrl, previewCard);
            titleLabel->setObjectName("LinkPreviewTitle");
            titleLabel->setWordWrap(true);
            auto *descLabel = new QLabel(QString(), previewCard);
            descLabel->setObjectName("LinkPreviewDescription");
            descLabel->setWordWrap(true);
            auto *imageLabel = new QLabel(previewCard);
            imageLabel->setObjectName("LinkPreviewImage");
            imageLabel->setFixedHeight(128);
            imageLabel->setMinimumWidth(260);
            imageLabel->setScaledContents(true);
            imageLabel->setVisible(false);
            previewLayout->addWidget(siteLabel);
            previewLayout->addWidget(titleLabel);
            previewLayout->addWidget(descLabel);
            previewLayout->addWidget(imageLabel);
            bubbleLayout->addWidget(previewCard);
            static QMap<QString, QJsonObject> linkPreviewCache;
            static QSet<QString> linkPreviewPending;
            const QString endpoint = QString("/api/link-preview?url=%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(previewUrl)));
            auto applyPreview = [siteLabel, titleLabel, descLabel, imageLabel, previewCard](const QJsonObject &obj) {
                const QString site = obj.value("siteName").toString();
                const QString title = obj.value("title").toString();
                const QString description = obj.value("description").toString();
                const QString imageUrl = obj.value("image").toString();
                if (!site.isEmpty()) siteLabel->setText(site);
                if (!title.isEmpty()) titleLabel->setText(title);
                descLabel->setText(description);
                descLabel->setVisible(!description.isEmpty());
                if (!imageUrl.isEmpty()) {
                    auto *manager = new QNetworkAccessManager(previewCard);
                    auto *reply = manager->get(QNetworkRequest(QUrl(imageUrl)));
                    QObject::connect(reply, &QNetworkReply::finished, imageLabel, [reply, imageLabel, manager]() {
                        const QByteArray bytes = reply->readAll();
                        reply->deleteLater();
                        manager->deleteLater();
                        QPixmap pixmap;
                        if (!pixmap.loadFromData(bytes) || pixmap.isNull()) return;
                        imageLabel->setPixmap(pixmap.scaled(imageLabel->size(), Qt::KeepAspectRatioByExpanding, Qt::SmoothTransformation));
                        imageLabel->setVisible(true);
                    });
                }
            };
            if (linkPreviewCache.contains(previewUrl)) {
                applyPreview(linkPreviewCache.value(previewUrl));
            } else {
                QObject::connect(apiClient, &ApiClient::requestSucceeded, previewCard, [endpoint, previewUrl, applyPreview](const QString &doneEndpoint, const QJsonDocument &body) {
                    if (doneEndpoint != endpoint || !body.isObject()) return;
                    const QJsonObject obj = body.object();
                    linkPreviewCache.insert(previewUrl, obj);
                    linkPreviewPending.remove(previewUrl);
                    applyPreview(obj);
                });
                QObject::connect(apiClient, &ApiClient::requestFailed, previewCard, [endpoint, previewUrl](const QString &doneEndpoint, const QString &) {
                    if (doneEndpoint == endpoint) linkPreviewPending.remove(previewUrl);
                });
                if (!linkPreviewPending.contains(previewUrl)) {
                    linkPreviewPending.insert(previewUrl);
                    apiClient->getLinkPreview(previewUrl);
                }
            }
        }
    }

    const auto reactions = msg.value("reactions").toArray();
    const auto summaries = reactionSummaryList(reactions, currentUsername);
    if (!summaries.isEmpty() && apiClient) {
        auto *reactionsRow = new QWidget(bubble);
        reactionsRow->setObjectName("ReactionPillsRow");
        auto *reactionsLayout = new QHBoxLayout(reactionsRow);
        reactionsLayout->setContentsMargins(0, 0, 0, 0);
        reactionsLayout->setSpacing(5);
        const auto messageId = msg.value("id").toString();
        for (const auto &reaction : summaries) {
            auto *pill = new QPushButton(reaction.count > 1 ? QString("%1 %2").arg(reaction.emoji).arg(reaction.count) : reaction.emoji, reactionsRow);
            pill->setObjectName(reaction.reactedByMe ? "ReactionPillActive" : "ReactionPill");
            pill->setCursor(Qt::PointingHandCursor);
            pill->setToolTip(reaction.users.join(", "));
            if (!messageId.isEmpty()) {
                QObject::connect(pill, &QPushButton::clicked, pill, [apiClient, messageId, emoji = reaction.emoji]() {
                    apiClient->reactToMessage(messageId, emoji);
                });
            }
            reactionsLayout->addWidget(pill);
        }
        reactionsLayout->addStretch(1);
        bubbleLayout->addWidget(reactionsRow);
    }

    const auto messageId = msg.value("id").toString();
    if (!time.isEmpty() || (!messageId.isEmpty() && apiClient)) {
        auto *actionsRow = new QWidget(bubble);
        actionsRow->setObjectName("MessageActionsRow");
        auto *actionsLayout = new QHBoxLayout(actionsRow);
        actionsLayout->setContentsMargins(0, 0, 0, 0);
        actionsLayout->setSpacing(4);
        if (!time.isEmpty()) {
            auto *timeLabel = new QLabel(time, actionsRow);
            timeLabel->setObjectName("MessageTime");
            actionsLayout->addWidget(timeLabel);
        }
        actionsLayout->addStretch(1);
        if (!messageId.isEmpty() && apiClient) {
        const auto ownEmoji = ownReactionEmoji(reactions, currentUsername);
        auto *reactButton = new QPushButton(actionsRow);
        reactButton->setObjectName(ownEmoji.isEmpty() ? "MessageActionButton" : "MessageActionButtonActive");
        reactButton->setIcon(makeUiIcon(
            UiIcon::Heart,
            ownEmoji.isEmpty() ? QColor("#8aa0bc") : QColor("#e8f1ff"),
            15));
        reactButton->setIconSize(QSize(15, 15));
        reactButton->setCursor(Qt::PointingHandCursor);
        reactButton->setToolTip("Реакция");
        auto *menu = new QMenu(reactButton);
        menu->setObjectName("ReactionMenu");
        const QList<QPair<QString, QString>> reactions = {
            {QString::fromUtf8("\xF0\x9F\x91\x8D"), QStringLiteral("Нравится")},
            {QString::fromUtf8("\xE2\x9D\xA4\xEF\xB8\x8F"), QStringLiteral("Любовь")},
            {QString::fromUtf8("\xF0\x9F\x94\xA5"), QStringLiteral("Огонь")},
            {QString::fromUtf8("\xF0\x9F\x98\x81"), QStringLiteral("Смешно")},
            {QString::fromUtf8("\xF0\x9F\x98\xA2"), QStringLiteral("Грустно")},
            {QString::fromUtf8("\xF0\x9F\x91\x8F"), QStringLiteral("Аплодисменты")},
            {QString::fromUtf8("\xF0\x9F\xA4\xAF"), QStringLiteral("Вау")},
            {QString::fromUtf8("\xF0\x9F\x91\x8E"), QStringLiteral("Не нравится")},
        };
        for (const auto &[emoji, label] : reactions) {
            auto *action = menu->addAction(QString("%1  %2").arg(emoji, label));
            action->setCheckable(true);
            action->setChecked(ownEmoji == emoji);
            QObject::connect(action, &QAction::triggered, reactButton, [apiClient, messageId, emoji]() {
                apiClient->reactToMessage(messageId, emoji);
            });
        }
        reactButton->setMenu(menu);
        actionsLayout->addWidget(reactButton);
        auto *replyButton = new QPushButton(actionsRow);
        replyButton->setObjectName("MessageReplyButton");
        replyButton->setIcon(makeUiIcon(UiIcon::Reply, QColor("#8aa0bc"), 17));
        replyButton->setIconSize(QSize(17, 17));
        replyButton->setCursor(Qt::PointingHandCursor);
        replyButton->setToolTip("Ответить");
        QObject::connect(replyButton, &QPushButton::clicked, replyButton, [replyHandler, msg]() {
            if (replyHandler) replyHandler(msg);
        });
        actionsLayout->addWidget(replyButton);

        if (!isSelf && reportHandler) {
            auto *reportButton = new QPushButton("!", actionsRow);
            reportButton->setObjectName("MessageActionButton");
            reportButton->setFixedSize(28, 28);
            reportButton->setCursor(Qt::PointingHandCursor);
            reportButton->setToolTip("Пожаловаться");
            QObject::connect(reportButton, &QPushButton::clicked, reportButton, [reportHandler, msg]() {
                reportHandler(msg);
            });
            actionsLayout->addWidget(reportButton);
        }

        if (isSelf) {
            if (type == "text") {
                auto *editButton = new QPushButton(actionsRow);
                editButton->setObjectName("MessageActionButton");
                editButton->setIcon(makeUiIcon(UiIcon::Pencil, QColor("#8aa0bc"), 15));
                editButton->setIconSize(QSize(15, 15));
                editButton->setCursor(Qt::PointingHandCursor);
                editButton->setToolTip("Редактировать");
                QObject::connect(editButton, &QPushButton::clicked, editButton, [apiClient, messageId, msg, editButton]() {
                    bool ok = false;
                    const auto currentText = msg.value("text").toString();
                    const auto nextText = QInputDialog::getMultiLineText(editButton, "Редактировать сообщение", "Текст", currentText, &ok).trimmed();
                    if (ok && !nextText.isEmpty() && nextText != currentText) {
                        apiClient->updateMessageText(messageId, nextText);
                    }
                });
                actionsLayout->addWidget(editButton);
            }

            auto *pinButton = new QPushButton(actionsRow);
            pinButton->setObjectName(msg.value("pinned").toBool() ? "MessageActionButtonActive" : "MessageActionButton");
            pinButton->setIcon(makeUiIcon(
                UiIcon::Pin,
                msg.value("pinned").toBool() ? QColor("#e8f1ff") : QColor("#8aa0bc"),
                15));
            pinButton->setIconSize(QSize(15, 15));
            pinButton->setCursor(Qt::PointingHandCursor);
            pinButton->setToolTip(msg.value("pinned").toBool() ? "Снять закрепление" : "Закрепить");
            QObject::connect(pinButton, &QPushButton::clicked, pinButton, [apiClient, messageId]() {
                apiClient->pinMessage(messageId);
            });
            actionsLayout->addWidget(pinButton);

            auto *deleteButton = new QPushButton(actionsRow);
            deleteButton->setObjectName("MessageDeleteButton");
            deleteButton->setIcon(makeUiIcon(UiIcon::Trash, QColor("#b97878"), 15));
            deleteButton->setIconSize(QSize(15, 15));
            deleteButton->setCursor(Qt::PointingHandCursor);
            deleteButton->setToolTip("Удалить");
            QObject::connect(deleteButton, &QPushButton::clicked, deleteButton, [apiClient, messageId, deleteHandler, deleteButton]() {
                const auto answer = QMessageBox::question(deleteButton, "Удалить сообщение", "Удалить это сообщение?");
                if (answer == QMessageBox::Yes) {
                    if (deleteHandler) deleteHandler(messageId);
                    apiClient->deleteMessage(messageId);
                }
            });
            actionsLayout->addWidget(deleteButton);
        }
        }
        bubbleLayout->addWidget(actionsRow);
    }

    if (isSelf) {
        rowLayout->addStretch(1);
        rowLayout->addWidget(bubble);
    } else {
        if (senderAvatar) {
            rowLayout->addWidget(senderAvatar, 0, Qt::AlignBottom);
        }
        rowLayout->addWidget(bubble);
        rowLayout->addStretch(1);
    }
    return row;
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
        {"signedIn", {{"ru", "Вход выполнен"}, {"de", "Angemeldet"}, {"en", "Signed in"}}},
        {"signedOut", {{"ru", "Вы вышли из аккаунта"}, {"de", "Abgemeldet"}, {"en", "Signed out"}}},
        {"signedInAs", {{"ru", "Вы вошли как %1"}, {"de", "Angemeldet als %1"}, {"en", "Signed in as %1"}}},
        {"sessionExpired", {{"ru", "Сессия истекла — войдите снова"}, {"de", "Sitzung abgelaufen — bitte erneut anmelden"}, {"en", "Session expired — please sign in again"}}},
        {"selectChat", {{"ru", "Сначала выберите чат"}, {"de", "Wählen Sie zuerst einen Chat"}, {"en", "Select a chat first"}}},
        {"sending", {{"ru", "Отправка..."}, {"de", "Senden..."}, {"en", "Sending..."}}},
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
    if (auto *guiApp = qobject_cast<QGuiApplication *>(QCoreApplication::instance())) {
        if (!guiApp->windowIcon().isNull()) {
            setWindowIcon(guiApp->windowIcon());
        }
    }
    resize(1280, 780);
    setMinimumSize(960, 620);
    m_darkTheme = QSettings().value("ui/darkTheme", false).toBool();
    if (m_sessionStore) {
        m_authLanguage = m_sessionStore->uiLanguage();
    }
    applyDesktopTheme(m_darkTheme);

    buildUi();
    m_notifications = new NotificationHub(this, this);
    connect(m_notifications, &NotificationHub::showWindowRequested, this, &MainWindow::showMainWindow);
    connect(m_notifications, &NotificationHub::quitRequested, this, [this]() {
        m_forceQuit = true;
        if (m_apiClient && m_sessionStore && m_sessionStore->hasToken()) {
            m_apiClient->logout();
        }
        qApp->quit();
    });
    connect(m_notifications, &NotificationHub::notificationActivated, this, [this](const QString &chatId) {
        if (chatId.isEmpty() || !m_chatList) {
            return;
        }
        for (int i = 0; i < m_chatList->count(); ++i) {
            auto *item = m_chatList->item(i);
            if (!item) {
                continue;
            }
            if (item->data(Qt::UserRole).toString() != chatId) {
                continue;
            }
            m_chatList->setCurrentRow(i);
            openSelectedChat();
            showMainWindow();
            break;
        }
    });
    if (QProcessEnvironment::systemEnvironment().value(QStringLiteral("ATEN_TEST_TOAST")) == QStringLiteral("1")) {
        QTimer::singleShot(1200, this, [this]() {
            if (!m_notifications) return;
            const auto avatar = pixmapFromAvatarRef(QStringLiteral("/golos-aton-avatar.png"));
            m_notifications->enqueueNotification(
                QStringLiteral("Голос Атона"),
                QStringLiteral("Тестовое уведомление с аватаркой отправителя"),
                QStringLiteral("dm|Akhenaten|golos_aton"),
                avatar.isNull() ? QIcon() : QIcon(avatar));
        });
    }
    wireApi();
    m_syncTimer = new QTimer(this);
    m_syncTimer->setInterval(8000);
    connect(m_syncTimer, &QTimer::timeout, this, &MainWindow::syncActiveChat);
    m_updateNetwork = new QNetworkAccessManager(this);
    m_updateTimer = new QTimer(this);
    m_updateTimer->setInterval(6 * 60 * 60 * 1000);
    connect(m_updateTimer, &QTimer::timeout, this, &MainWindow::checkForUpdates);
    m_updateTimer->start();
    QTimer::singleShot(5000, this, &MainWindow::checkForUpdates);
    refreshSessionUi();

    if (m_apiClient) {
        m_apiClient->getHealth();
    }
}

void MainWindow::checkForUpdates()
{
    if (!m_updateNetwork || m_updateCheckInProgress) return;
    m_updateCheckInProgress = true;

    const auto manifestUrl = qEnvironmentVariable(
        "ATEN_RELEASE_MANIFEST_URL",
        "https://vadzim.by/wp-content/uploads/aten/latest.json");
    QNetworkRequest request{QUrl(manifestUrl)};
    request.setRawHeader("Accept", "application/json");
    request.setRawHeader("Cache-Control", "no-cache");
    request.setTransferTimeout(20000);
    auto *reply = m_updateNetwork->get(request);
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        m_updateCheckInProgress = false;
        const auto bytes = reply->readAll();
        const auto error = reply->error();
        reply->deleteLater();
        if (error != QNetworkReply::NoError) return;

        QJsonParseError parseError;
        const auto body = QJsonDocument::fromJson(bytes, &parseError);
        if (parseError.error != QJsonParseError::NoError || !body.isObject()) return;
        handleReleaseManifest(body);
    });
}

void MainWindow::handleReleaseManifest(const QJsonDocument &body)
{
    const auto release = body.object();
    const auto latestVersion = release.value("version").toString().trimmed();
    if (latestVersion.isEmpty()) return;

    const auto current = QVersionNumber::fromString(QCoreApplication::applicationVersion());
    const auto latest = QVersionNumber::fromString(latestVersion);
    if (current.isNull() || latest.isNull() || QVersionNumber::compare(latest, current) <= 0) return;

    const bool mandatory = release.value("mandatory").toBool();
    QSettings settings;
    const auto promptKey = QString("updates/lastPrompt/%1").arg(latestVersion);
    const auto lastPrompt = settings.value(promptKey).toDateTime();
    if (!mandatory && lastPrompt.isValid()
        && lastPrompt.secsTo(QDateTime::currentDateTimeUtc()) < 24 * 60 * 60) {
        return;
    }
    settings.setValue(promptKey, QDateTime::currentDateTimeUtc());

    const auto title = release.value("title").toString(QString("Доступен ATEN %1").arg(latestVersion));
    const auto message = release.value("message").toString(
        "Доступна новая версия ATEN. Обновитесь, чтобы получить исправления и новые функции.");
    const auto downloadUrl = QUrl(release.value("downloadUrl").toString());
    const auto pageUrl = QUrl(release.value("pageUrl").toString("https://vadzim.by/aten/"));

    QMessageBox dialog(this);
    dialog.setObjectName("UpdateAvailableDialog");
    dialog.setWindowTitle("Обновление ATEN");
    dialog.setIconPixmap(windowIcon().pixmap(64, 64));
    dialog.setText(QString("<b>%1</b>").arg(title.toHtmlEscaped()));
    dialog.setInformativeText(QString("%1\n\nУстановленная версия: %2")
        .arg(message, QCoreApplication::applicationVersion()));
    auto *downloadButton = dialog.addButton("Скачать обновление", QMessageBox::AcceptRole);
    auto *pageButton = dialog.addButton("О странице ATEN", QMessageBox::ActionRole);
    QPushButton *laterButton = nullptr;
    if (!mandatory) {
        laterButton = dialog.addButton("Напомнить позже", QMessageBox::RejectRole);
        dialog.setEscapeButton(laterButton);
    }
    dialog.setDefaultButton(downloadButton);
    dialog.exec();

    if (dialog.clickedButton() == downloadButton && downloadUrl.isValid()) {
        QDesktopServices::openUrl(downloadUrl);
    } else if (dialog.clickedButton() == pageButton && pageUrl.isValid()) {
        QDesktopServices::openUrl(pageUrl);
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
    logo->setPixmap(loadAtenLogoPixmap(38, false));
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
    heroLogo->setPixmap(loadAtenHeroLogoPixmap(300));
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
    page->setObjectName("MessengerShell");
    auto *rootLayout = new QHBoxLayout(page);
    rootLayout->setContentsMargins(0, 0, 0, 0);
    rootLayout->setSpacing(0);

    auto *splitter = new QSplitter(Qt::Horizontal, page);
    splitter->setObjectName("MessengerSplitter");
    splitter->setChildrenCollapsible(false);

    auto *sidebar = new QWidget(splitter);
    sidebar->setObjectName("Sidebar");
    sidebar->setMinimumWidth(300);
    sidebar->setMaximumWidth(360);
    auto *sidebarLayout = new QVBoxLayout(sidebar);
    sidebarLayout->setContentsMargins(12, 18, 10, 10);
    sidebarLayout->setSpacing(12);

    auto *chatTools = new QWidget(sidebar);
    auto *chatToolsLayout = new QHBoxLayout(chatTools);
    chatToolsLayout->setContentsMargins(0, 0, 10, 0);
    chatToolsLayout->setSpacing(8);
    auto *chatsLabel = new QLabel("ЧАТЫ", chatTools);
    chatsLabel->setObjectName("SidebarSectionLabel");
    auto *newGroupButton = new QPushButton("+ группа", chatTools);
    newGroupButton->setObjectName("SmallPillButton");
    newGroupButton->setIcon(makeUiIcon(UiIcon::Plus, QColor("#49658d"), 16));
    newGroupButton->setIconSize(QSize(16, 16));
    newGroupButton->setText("Новый чат");
    newGroupButton->setToolTip("Создать группу или канал");
    connect(newGroupButton, &QPushButton::clicked, this, &MainWindow::showCreateChatDialog);
    chatToolsLayout->addWidget(chatsLabel, 1);
    auto *discoverButton = new QPushButton(chatTools);
    discoverButton->setObjectName("SmallIconButton");
    discoverButton->setIcon(makeUiIcon(UiIcon::Search));
    discoverButton->setIconSize(QSize(18, 18));
    discoverButton->setToolTip("Найти людей и публичные группы");
    connect(discoverButton, &QPushButton::clicked, this, &MainWindow::showDiscoveryDialog);
    chatToolsLayout->addWidget(discoverButton);
    chatToolsLayout->addWidget(newGroupButton);
    sidebarLayout->addWidget(chatTools);

    m_chatSearch = new QLineEdit(sidebar);
    m_chatSearch->setObjectName("ChatSearch");
    m_chatSearch->setPlaceholderText("Поиск по имени или @username...");
    sidebarLayout->addWidget(m_chatSearch);

    m_chatList = new QListWidget(sidebar);
    m_chatList->setObjectName("ChatList");
    m_chatList->setSpacing(6);
    m_chatList->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    m_chatList->addItem("Загрузка чатов...");
    sidebarLayout->addWidget(m_chatList, 1);
    connect(m_chatList, &QListWidget::itemActivated, this, &MainWindow::openSelectedChat);
    connect(m_chatList, &QListWidget::currentItemChanged, this, &MainWindow::openSelectedChat);

    auto *sidebarFooter = new QWidget(sidebar);
    sidebarFooter->setObjectName("SidebarFooter");
    auto *footerLayout = new QVBoxLayout(sidebarFooter);
    footerLayout->setContentsMargins(12, 10, 12, 0);
    footerLayout->setSpacing(8);
    m_accountLabel = new QLabel("Akhenaten", sidebarFooter);
    m_accountLabel->setObjectName("MutedText");
    auto *logoutButton = new QPushButton("Выйти", sidebarFooter);
    logoutButton->setObjectName("SidebarLogoutButton");
    auto *productMeta = new QLabel(
        QString("ATEN %1<br><a href=\"https://vadzim.by\">Разработано vadzim.by</a>").arg(ATEN_VERSION),
        sidebarFooter);
    productMeta->setObjectName("ProductMeta");
    productMeta->setTextFormat(Qt::RichText);
    productMeta->setTextInteractionFlags(Qt::TextBrowserInteraction);
    productMeta->setOpenExternalLinks(true);
    productMeta->setAlignment(Qt::AlignCenter);
    footerLayout->addWidget(m_accountLabel);
    footerLayout->addWidget(logoutButton);
    footerLayout->addWidget(productMeta);
    sidebarLayout->addWidget(sidebarFooter);
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
    content->setObjectName("ChatContent");
    auto *contentLayout = new QVBoxLayout(content);
    contentLayout->setContentsMargins(0, 0, 0, 0);
    contentLayout->setSpacing(0);

    auto *header = new QWidget(content);
    header->setObjectName("ChatHeader");
    auto *headerLayout = new QHBoxLayout(header);
    headerLayout->setContentsMargins(18, 7, 12, 7);
    headerLayout->setSpacing(6);
    auto *chatCopy = new QWidget(header);
    auto *chatCopyLayout = new QVBoxLayout(chatCopy);
    chatCopyLayout->setContentsMargins(0, 0, 0, 0);
    chatCopyLayout->setSpacing(2);
    m_chatTitleLabel = new QLabel("Голос Атона ✓", chatCopy);
    auto titleFont = m_chatTitleLabel->font();
    titleFont.setPointSize(14);
    titleFont.setBold(true);
    m_chatTitleLabel->setFont(titleFont);
    m_statusLabel = new QLabel("Принцип, не служба", chatCopy);
    m_statusLabel->setObjectName("ChatSubtitle");
    chatCopyLayout->addWidget(m_chatTitleLabel);
    chatCopyLayout->addWidget(m_statusLabel);
    headerLayout->addWidget(chatCopy, 1);
    auto *profileButton = makeToolbarButton(UiIcon::User, "Редактировать профиль", header);
    connect(profileButton, &QPushButton::clicked, this, &MainWindow::showProfileDialog);
    auto *friendsButton = makeToolbarButton(UiIcon::Users, "Друзья, заявки и блокировки", header);
    connect(friendsButton, &QPushButton::clicked, this, [this]() {
        if (!m_apiClient) return;
        m_contactsDialogRequested = true;
        setStatusText("Загрузка контактов...");
        m_apiClient->getContacts();
    });
    m_adminUsersButton = makeToolbarButton(UiIcon::Users, "Все зарегистрированные пользователи", header);
    connect(m_adminUsersButton, &QPushButton::clicked, this, &MainWindow::requestAdminUsers);
    m_reportsButton = makeToolbarButton(UiIcon::Bell, "Жалобы пользователей", header);
    connect(m_reportsButton, &QPushButton::clicked, this, &MainWindow::requestReports);
    auto *themeButton = makeToolbarButton(UiIcon::Sun, "Тема интерфейса", header);
    connect(themeButton, &QPushButton::clicked, this, [this]() {
        m_darkTheme = !m_darkTheme;
        QSettings().setValue("ui/darkTheme", m_darkTheme);
        applyDesktopTheme(m_darkTheme);
        setStatusText(m_darkTheme ? "Тёмная тема включена" : "Светлая тема включена");
    });
    auto *menuButton = makeToolbarButton(UiIcon::Menu, "Меню", header);
    connect(menuButton, &QPushButton::clicked, this, [this, menuButton]() {
        QMenu menu(menuButton);
        menu.setObjectName("MainMenu");
        auto *profile = menu.addAction("Профиль");
        auto *contacts = menu.addAction("Друзья и контакты");
        auto *discover = menu.addAction("Найти людей и группы");
        menu.addSeparator();
        auto *createChat = menu.addAction("Создать новый чат");
        QAction *leaveChat = nullptr;
        QAction *deleteChat = nullptr;
        QAction *verifyChat = nullptr;
        QAction *reportChat = nullptr;
        if (!m_currentChatId.isEmpty() && !isDirectChatId(m_currentChatId)) {
            reportChat = menu.addAction("Пожаловаться на текущий чат");
            if (isSuperAdmin()) {
                verifyChat = menu.addAction("Верифицировать текущий чат");
            }
            leaveChat = menu.addAction("Покинуть текущий чат");
            if (canDeleteCurrentChat()) {
                deleteChat = menu.addAction("Удалить текущий чат");
                deleteChat->setProperty("danger", true);
            }
        }
        menu.addSeparator();
        auto *logout = menu.addAction("Выйти");
        logout->setProperty("danger", true);
        menu.setStyleSheet(m_darkTheme ? QStringLiteral(R"(
            QMenu#MainMenu {
                min-width: 240px;
                padding: 7px;
                color: #e5e7eb;
                background: #1b2027;
                border: 1px solid #3a414b;
                border-radius: 9px;
                font-size: 14px;
            }
            QMenu#MainMenu::item {
                min-height: 36px;
                padding: 3px 14px;
                margin: 1px 0;
                border-radius: 6px;
                color: #e5e7eb;
                background: transparent;
            }
            QMenu#MainMenu::item:selected {
                color: #ffffff;
                background: #2b5fbd;
            }
            QMenu#MainMenu::separator {
                height: 1px;
                margin: 6px 8px;
                background: #353c45;
            }
        )") : QStringLiteral(R"(
            QMenu#MainMenu {
                min-width: 240px;
                padding: 7px;
                color: #172033;
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 9px;
                font-size: 14px;
            }
            QMenu#MainMenu::item {
                min-height: 36px;
                padding: 3px 14px;
                margin: 1px 0;
                border-radius: 6px;
                color: #172033;
                background: transparent;
            }
            QMenu#MainMenu::item:selected {
                color: #ffffff;
                background: #2563eb;
            }
            QMenu#MainMenu::separator {
                height: 1px;
                margin: 6px 8px;
                background: #e2e8f0;
            }
        )"));
        menu.ensurePolished();
        const QPoint buttonBottomRight = menuButton->mapToGlobal(QPoint(menuButton->width(), menuButton->height()));
        const QPoint menuPosition(buttonBottomRight.x() - menu.sizeHint().width(), buttonBottomRight.y() + 4);
        const auto action = menu.exec(menuPosition);
        if (action == profile) {
            showProfileDialog();
        } else if (action == contacts) {
            if (m_apiClient) {
                m_contactsDialogRequested = true;
                m_apiClient->getContacts();
            }
        } else if (action == discover) {
            showDiscoveryDialog();
        } else if (action == createChat) {
            showCreateChatDialog();
        } else if (reportChat && action == reportChat) {
            reportCurrentChatOrPeer();
        } else if (verifyChat && action == verifyChat) {
            verifyCurrentChat();
        } else if (leaveChat && action == leaveChat) {
            if (m_apiClient) m_apiClient->leaveChat(m_currentChatId);
            m_currentChatId.clear();
            m_currentPeerUsername.clear();
        } else if (deleteChat && action == deleteChat) {
            deleteCurrentChat();
        } else if (action == logout) {
            if (m_apiClient) m_apiClient->logout();
            if (m_sessionStore) m_sessionStore->clear();
            refreshSessionUi();
        }
    });
    headerLayout->addWidget(profileButton);
    headerLayout->addWidget(friendsButton);
    headerLayout->addWidget(m_adminUsersButton);
    headerLayout->addWidget(m_reportsButton);
    headerLayout->addWidget(themeButton);
    headerLayout->addWidget(menuButton);
    m_userPillButton = new QPushButton("Akhenaten", header);
    m_userPillButton->setObjectName("UserPillButton");
    m_userPillButton->setCursor(Qt::PointingHandCursor);
    connect(m_userPillButton, &QPushButton::clicked, this, &MainWindow::showProfileDialog);
    headerLayout->addWidget(m_userPillButton);
    contentLayout->addWidget(header);
    updateAdminControls();

    m_peerActionBar = new QWidget(content);
    m_peerActionBar->setObjectName("PeerActionBar");
    auto *peerActionLayout = new QHBoxLayout(m_peerActionBar);
    peerActionLayout->setContentsMargins(18, 8, 18, 8);
    peerActionLayout->setSpacing(10);
    m_peerRenameButton = new QPushButton(m_peerActionBar);
    m_peerRenameButton->setObjectName("PeerIconButton");
    m_peerRenameButton->setIcon(makeUiIcon(UiIcon::Pencil));
    m_peerRenameButton->setIconSize(QSize(18, 18));
    m_peerRenameButton->setToolTip("Переименовать контакт");
    m_peerBlockButton = new QPushButton("Заблокировать", m_peerActionBar);
    m_peerBlockButton->setObjectName("PeerActionButton");
    m_peerFriendButton = new QPushButton("Добавить в друзья", m_peerActionBar);
    m_peerFriendButton->setObjectName("PeerActionButton");
    m_peerReportButton = new QPushButton("Пожаловаться", m_peerActionBar);
    m_peerReportButton->setObjectName("PeerActionButton");
    m_peerNotifyButton = new QPushButton(m_peerActionBar);
    m_peerNotifyButton->setObjectName("PeerIconButton");
    m_peerNotifyButton->setIcon(makeUiIcon(UiIcon::Bell));
    m_peerNotifyButton->setIconSize(QSize(18, 18));
    m_peerNotifyButton->setToolTip("Уведомления");
    for (auto *button : {m_peerRenameButton, m_peerBlockButton, m_peerFriendButton, m_peerReportButton, m_peerNotifyButton}) {
        button->setCursor(Qt::PointingHandCursor);
        peerActionLayout->addWidget(button);
    }
    peerActionLayout->addStretch(1);
    contentLayout->addWidget(m_peerActionBar);
    m_peerActionBar->hide();

    connect(m_peerRenameButton, &QPushButton::clicked, this, &MainWindow::renameCurrentPeer);
    connect(m_peerBlockButton, &QPushButton::clicked, this, [this]() {
        if (!m_apiClient || m_currentPeerUsername.isEmpty()) return;
        const auto blocked = currentPeerStatus() == "blocked";
        m_apiClient->contactAction(blocked ? "/api/contacts/unblock" : "/api/contacts/block", m_currentPeerUsername);
    });
    connect(m_peerFriendButton, &QPushButton::clicked, this, [this]() {
        if (!m_apiClient || m_currentPeerUsername.isEmpty()) return;
        const auto status = currentPeerStatus();
        QString endpoint = "/api/contacts/add";
        if (status == "incoming") endpoint = "/api/contacts/accept";
        else if (status == "outgoing") endpoint = "/api/contacts/cancel";
        m_apiClient->contactAction(endpoint, m_currentPeerUsername);
    });
    connect(m_peerReportButton, &QPushButton::clicked, this, [this]() {
        reportCurrentChatOrPeer();
    });
    connect(m_peerNotifyButton, &QPushButton::clicked, this, [this]() {
        if (m_currentChatId.isEmpty() || !m_sessionStore) return;
        m_chatNotifyMuted = !m_chatNotifyMuted;
        m_sessionStore->setChatMuted(m_currentChatId, m_chatNotifyMuted);
        if (m_peerNotifyButton) {
            m_peerNotifyButton->setIcon(makeUiIcon(m_chatNotifyMuted ? UiIcon::BellOff : UiIcon::Bell));
        }
        setStatusText(m_chatNotifyMuted ? "Уведомления для этого чата выключены"
                                        : "Уведомления для этого чата включены");
    });

    auto *profileScroll = new QScrollArea(content);
    m_profilePage = profileScroll;
    m_profilePage->setObjectName("ProfilePage");
    profileScroll->setWidgetResizable(true);
    profileScroll->setFrameShape(QFrame::NoFrame);
    profileScroll->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    auto *profileContent = new QWidget(profileScroll);
    profileContent->setObjectName("ProfilePageContent");
    profileScroll->setWidget(profileContent);
    auto *profileOuter = new QVBoxLayout(profileContent);
    profileOuter->setSizeConstraint(QLayout::SetMinimumSize);
    profileOuter->setContentsMargins(72, 18, 72, 24);
    profileOuter->setSpacing(12);

    auto *profileHero = new QWidget(profileContent);
    profileHero->setObjectName("ProfileCard");
    auto *heroLayout = new QHBoxLayout(profileHero);
    heroLayout->setContentsMargins(24, 18, 24, 18);
    heroLayout->setSpacing(20);
    m_profileAvatarLabel = new QLabel(profileHero);
    m_profileAvatarLabel->setObjectName("ProfileAvatar");
    m_profileAvatarLabel->setFixedSize(88, 88);
    m_profileAvatarLabel->setAlignment(Qt::AlignCenter);
    auto *heroCopy = new QWidget(profileHero);
    auto *heroCopyLayout = new QVBoxLayout(heroCopy);
    heroCopyLayout->setContentsMargins(0, 0, 0, 0);
    heroCopyLayout->setSpacing(6);
    m_profileNameLabel = new QLabel("Akhenaten", heroCopy);
    m_profileNameLabel->setObjectName("ProfileHeroName");
    m_profilePublicIdLabel = new QLabel("@akhenaten", heroCopy);
    m_profilePublicIdLabel->setObjectName("MutedText");
    m_profileBioLabel = new QLabel(heroCopy);
    m_profileBioLabel->setObjectName("ProfileHeroStatus");
    m_profileBioLabel->setWordWrap(true);
    m_profileVerifiedLabel = new QLabel("Профиль верифицирован ✓", heroCopy);
    m_profileVerifiedLabel->setObjectName("ProfileVerifiedPill");
    m_profileAvatarButton = new QPushButton("Изменить фото", heroCopy);
    m_profileAvatarButton->setObjectName("SecondaryButton");
    connect(m_profileAvatarButton, &QPushButton::clicked, this, &MainWindow::selectProfileAvatar);
    heroCopyLayout->addWidget(m_profileNameLabel);
    heroCopyLayout->addWidget(m_profilePublicIdLabel);
    heroCopyLayout->addWidget(m_profileBioLabel);
    heroCopyLayout->addWidget(m_profileVerifiedLabel);
    heroCopyLayout->addWidget(m_profileAvatarButton, 0, Qt::AlignLeft);
    heroCopyLayout->addStretch(1);
    heroLayout->addWidget(m_profileAvatarLabel);
    heroLayout->addWidget(heroCopy, 1);
    profileOuter->addWidget(profileHero);

    auto *profileForm = new QWidget(profileContent);
    profileForm->setObjectName("ProfileCard");
    auto *profileFormLayout = new QVBoxLayout(profileForm);
    profileFormLayout->setContentsMargins(24, 18, 24, 20);
    profileFormLayout->setSpacing(14);
    auto addProfileField = [&](const QString &text, QWidget *editor) {
        auto *field = new QWidget(profileForm);
        field->setObjectName("ProfileFieldGroup");
        field->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);
        auto *fieldLayout = new QVBoxLayout(field);
        fieldLayout->setContentsMargins(0, 0, 0, 0);
        fieldLayout->setSpacing(7);
        auto *label = new QLabel(text, field);
        label->setObjectName("ProfileFieldLabel");
        editor->setParent(field);
        fieldLayout->addWidget(label);
        fieldLayout->addWidget(editor);
        field->setFixedHeight(
            label->sizeHint().height() + editor->height() + fieldLayout->spacing());
        profileFormLayout->addWidget(field);
    };
    m_profileEmailInput = new QLineEdit(profileForm);
    m_profileEmailInput->setReadOnly(true);
    m_profileEmailInput->setObjectName("ProfileInput");
    m_profileEmailInput->setFixedHeight(44);
    addProfileField("EMAIL АККАУНТА", m_profileEmailInput);
    m_profileNameInput = new QLineEdit(profileForm);
    m_profileNameInput->setObjectName("ProfileInput");
    m_profileNameInput->setFixedHeight(44);
    addProfileField("ОТОБРАЖАЕМОЕ ИМЯ", m_profileNameInput);
    m_profileBioInput = new QTextEdit(profileForm);
    m_profileBioInput->setObjectName("ProfileTextEdit");
    m_profileBioInput->setFixedHeight(64);
    addProfileField("СТАТУС", m_profileBioInput);
    m_profilePublicIdInput = new QLineEdit(profileForm);
    m_profilePublicIdInput->setObjectName("ProfileInput");
    m_profilePublicIdInput->setFixedHeight(44);
    addProfileField("ID ПРОФИЛЯ", m_profilePublicIdInput);

    auto *profileLanguageField = new QWidget(profileForm);
    profileLanguageField->setObjectName("ProfileFieldGroup");
    auto *profileLanguageLayout = new QVBoxLayout(profileLanguageField);
    profileLanguageLayout->setContentsMargins(0, 0, 0, 0);
    profileLanguageLayout->setSpacing(8);
    m_profileLanguageLabel = new QLabel(profileLanguageField);
    m_profileLanguageLabel->setObjectName("ProfileFieldLabel");
    auto *profileLanguageButtons = new QWidget(profileLanguageField);
    auto *profileLanguageButtonsLayout = new QHBoxLayout(profileLanguageButtons);
    profileLanguageButtonsLayout->setContentsMargins(0, 0, 0, 0);
    profileLanguageButtonsLayout->setSpacing(8);
    m_profileRuButton = new QPushButton(profileLanguageButtons);
    m_profileDeButton = new QPushButton(profileLanguageButtons);
    m_profileEnButton = new QPushButton(profileLanguageButtons);
    m_profileRuButton->setIcon(QIcon(makeFlagPixmap("ru")));
    m_profileDeButton->setIcon(QIcon(makeFlagPixmap("de")));
    m_profileEnButton->setIcon(QIcon(makeFlagPixmap("en")));
    for (auto *btn : {m_profileRuButton, m_profileDeButton, m_profileEnButton}) {
        btn->setIconSize(QSize(34, 34));
        btn->setCursor(Qt::PointingHandCursor);
    }
    profileLanguageButtonsLayout->addWidget(m_profileRuButton);
    profileLanguageButtonsLayout->addWidget(m_profileDeButton);
    profileLanguageButtonsLayout->addWidget(m_profileEnButton);
    profileLanguageButtonsLayout->addStretch(1);
    profileLanguageLayout->addWidget(m_profileLanguageLabel);
    profileLanguageLayout->addWidget(profileLanguageButtons);
    profileFormLayout->addWidget(profileLanguageField);

    auto *profileActions = new QHBoxLayout();
    profileActions->addStretch(1);
    auto *cancelProfileButton = new QPushButton("Отмена", profileForm);
    cancelProfileButton->setObjectName("SecondaryButton");
    auto *logoutProfileButton = new QPushButton("Выйти", profileForm);
    logoutProfileButton->setObjectName("DangerButton");
    auto *saveProfileButton = new QPushButton("Сохранить", profileForm);
    saveProfileButton->setObjectName("PrimaryButton");
    profileActions->addWidget(cancelProfileButton);
    profileActions->addWidget(logoutProfileButton);
    profileActions->addWidget(saveProfileButton);
    profileFormLayout->addLayout(profileActions);
    profileOuter->addWidget(profileForm);
    profileOuter->addStretch(1);
    contentLayout->addWidget(m_profilePage, 1);
    m_profilePage->hide();

    connect(cancelProfileButton, &QPushButton::clicked, this, &MainWindow::closeProfilePage);
    connect(saveProfileButton, &QPushButton::clicked, this, &MainWindow::saveProfilePage);
    connect(m_profileRuButton, &QPushButton::clicked, this, [this]() { setLanguage("ru"); });
    connect(m_profileDeButton, &QPushButton::clicked, this, [this]() { setLanguage("de"); });
    connect(m_profileEnButton, &QPushButton::clicked, this, [this]() { setLanguage("en"); });
    connect(logoutProfileButton, &QPushButton::clicked, this, [this]() {
        if (m_apiClient) m_apiClient->logout();
        if (m_sessionStore) m_sessionStore->clear();
        refreshSessionUi();
    });

    m_messageList = new QListWidget(content);
    m_messageList->setObjectName("MessageList");
    m_messageList->setSpacing(0);
    m_messageList->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    m_messageList->addItem("Выберите чат");
    connect(m_messageList->verticalScrollBar(), &QScrollBar::valueChanged, this, [this](int value) {
        if (value <= 24) {
            loadOlderMessagesForCurrentChat();
        }
    });
    contentLayout->addWidget(m_messageList, 1);

    auto *composer = new QWidget(content);
    m_composerPanel = composer;
    composer->setObjectName("Composer");
    auto *composerOuter = new QVBoxLayout(composer);
    composerOuter->setContentsMargins(20, 10, 20, 12);
    composerOuter->setSpacing(8);
    m_replyCompose = new QWidget(composer);
    m_replyCompose->setObjectName("ReplyCompose");
    auto *replyComposeLayout = new QHBoxLayout(m_replyCompose);
    replyComposeLayout->setContentsMargins(16, 10, 12, 10);
    replyComposeLayout->setSpacing(10);
    auto *replyAccent = new QWidget(m_replyCompose);
    replyAccent->setObjectName("ReplyComposeAccent");
    replyAccent->setFixedWidth(4);
    auto *replyCopy = new QWidget(m_replyCompose);
    auto *replyCopyLayout = new QVBoxLayout(replyCopy);
    replyCopyLayout->setContentsMargins(0, 0, 0, 0);
    replyCopyLayout->setSpacing(2);
    m_replyComposeAuthorLabel = new QLabel("Ответ на сообщение", replyCopy);
    m_replyComposeAuthorLabel->setObjectName("ReplyComposeAuthor");
    m_replyComposeTextLabel = new QLabel(replyCopy);
    m_replyComposeTextLabel->setObjectName("ReplyComposeText");
    m_replyComposeTextLabel->setWordWrap(true);
    replyCopyLayout->addWidget(m_replyComposeAuthorLabel);
    replyCopyLayout->addWidget(m_replyComposeTextLabel);
    m_replyComposeCloseButton = new QPushButton("×", m_replyCompose);
    m_replyComposeCloseButton->setObjectName("ReplyComposeCloseButton");
    m_replyComposeCloseButton->setCursor(Qt::PointingHandCursor);
    m_replyComposeCloseButton->setToolTip("Отменить ответ");
    replyComposeLayout->addWidget(replyAccent);
    replyComposeLayout->addWidget(replyCopy, 1);
    replyComposeLayout->addWidget(m_replyComposeCloseButton);
    m_replyCompose->hide();
    composerOuter->addWidget(m_replyCompose);
    auto *composerBox = new QWidget(composer);
    composerBox->setObjectName("ComposerBox");
    auto *composerLayout = new QHBoxLayout(composerBox);
    composerLayout->setContentsMargins(14, 7, 7, 7);
    composerLayout->setSpacing(6);
    m_composer = new QTextEdit(composer);
    m_composer->setObjectName("ComposerInput");
    m_composer->setPlaceholderText("Текст — Enter. Новая строка — Shift+Enter");
    m_composer->setAcceptRichText(false);
    m_composer->setLineWrapMode(QTextEdit::WidgetWidth);
    m_composer->setWordWrapMode(QTextOption::WrapAtWordBoundaryOrAnywhere);
    m_composer->setVerticalScrollBarPolicy(Qt::ScrollBarAsNeeded);
    m_composer->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    m_composer->setFixedHeight(46);
    m_composer->installEventFilter(this);
    auto *attachButton = new QPushButton(composerBox);
    attachButton->setObjectName("RoundComposerButton");
    attachButton->setFixedSize(40, 40);
    attachButton->setIcon(makeUiIcon(UiIcon::Paperclip, QColor("#6d91c7"), 20));
    attachButton->setIconSize(QSize(20, 20));
    attachButton->setToolTip("Отправить изображение");
    connect(attachButton, &QPushButton::clicked, this, &MainWindow::sendImageAttachment);
    m_micButton = new QPushButton(composerBox);
    m_micButton->setObjectName("RoundComposerButton");
    m_micButton->setFixedSize(40, 40);
    m_micButton->setIcon(makeUiIcon(UiIcon::Mic, QColor("#6d91c7"), 20));
    m_micButton->setIconSize(QSize(20, 20));
    m_micButton->setToolTip("Удерживайте для записи голосового сообщения");
    connect(m_micButton, &QPushButton::pressed, this, &MainWindow::startVoiceRecording);
    connect(m_micButton, &QPushButton::released, this, &MainWindow::stopVoiceRecording);
    m_sendButton = new QPushButton("Отправить", composerBox);
    m_sendButton->setObjectName("PrimaryButton");
    composerLayout->addWidget(m_composer, 1);
    composerLayout->addWidget(attachButton);
    composerLayout->addWidget(m_micButton);
    composerLayout->addWidget(m_sendButton);
    composerOuter->addWidget(composerBox);
    contentLayout->addWidget(composer);
    connect(m_sendButton, &QPushButton::clicked, this, &MainWindow::sendComposerText);
    connect(m_composer, &QTextEdit::textChanged, this, [this]() {
        if (!m_composer) return;
        const int documentHeight = qCeil(m_composer->document()->size().height());
        m_composer->setFixedHeight(std::clamp(documentHeight + 12, 46, 116));
    });
    connect(m_replyComposeCloseButton, &QPushButton::clicked, this, &MainWindow::clearReplyToMessage);
    connect(m_chatSearch, &QLineEdit::textChanged, this, [this](const QString &text) {
        m_chatFilter = text.trimmed();
        renderSidebar();
    });

    splitter->addWidget(sidebar);
    splitter->addWidget(content);
    splitter->setSizes({330, 1170});
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
            if (m_apiClient) {
                m_apiClient->resetSessionAuthState();
            }
            setStatusText(trAuth(m_authLanguage, "signedIn"));
            m_messageBaselineReady = false;
            m_messagesAllRequested = false;
            m_knownMessageIds.clear();
            m_renderedDialogsFingerprint.clear();
            m_renderedMessagesFingerprint.clear();
            m_renderedMessagesChatId.clear();
            refreshSessionUi();
            return;
        }
        if (endpoint == "/api/register") {
            setStatusText(trAuth(m_authLanguage, "verifyEmail"));
            switchAuthMode(false);
            return;
        }
        if (endpoint == "/api/logout") {
            if (m_syncTimer) m_syncTimer->stop();
            m_currentUser = {};
            m_messageBaselineReady = false;
            m_messagesAllRequested = false;
            m_knownMessageIds.clear();
            m_unreadByChat.clear();
            m_renderedDialogsFingerprint.clear();
            m_renderedMessagesFingerprint.clear();
            m_renderedMessagesChatId.clear();
            if (m_sessionStore) {
                m_sessionStore->clearChatReads();
            }
            if (m_notifications) {
                m_notifications->setUnreadCount(0);
            }
            updateAdminControls();
            setStatusText(trAuth(m_authLanguage, "signedOut"));
            return;
        }
        if (endpoint == "/api/me") {
            const auto obj = body.object();
            const auto userObj = obj.value("user").toObject(obj);
            m_currentUser = userObj;
            m_currentUsername = userObj.value("username").toString();
            const auto name = userObj.value("displayName").toString(m_currentUsername.isEmpty() ? "ATEN user" : m_currentUsername);
            if (m_accountLabel) {
                m_accountLabel->setText(name);
            }
            if (m_userPillButton) {
                m_userPillButton->setText(name);
            }
            updateAdminControls();
            setStatusText(QString(trAuth(m_authLanguage, "signedInAs")).arg(name));
            populateProfilePage();
            return;
        }
        if (endpoint == "/api/profile") {
            m_currentUser = body.object();
            m_currentUsername = m_currentUser.value("username").toString(m_currentUsername);
            const auto name = m_currentUser.value("displayName").toString(m_currentUsername);
            if (m_accountLabel) m_accountLabel->setText(name);
            if (m_userPillButton) m_userPillButton->setText(name);
            m_profileAvatarDataUrl = m_currentUser.value("avatarDataUrl").toString();
            updateAdminControls();
            populateProfilePage();
            setStatusText("Профиль сохранён");
            return;
        }
        if (endpoint == "/api/admin/users") {
            if (m_adminUsersDialogRequested) {
                m_adminUsersDialogRequested = false;
                showAdminUsersDialog(body);
            }
            return;
        }
        if (endpoint == "/api/reports") {
            if (m_reportsDialogRequested) {
                m_reportsDialogRequested = false;
                showReportsDialog(body);
            }
            return;
        }
        if (endpoint == "/api/admin/chats") {
            m_adminChats = body.array();
            return;
        }
        if (endpoint.endsWith("/report")) {
            setStatusText("Жалоба отправлена");
            return;
        }
        if (endpoint == "/api/users") {
            m_users = body.array();
            m_peerBioByUsername.clear();
            for (const auto &value : m_users) {
                const auto user = value.toObject();
                rememberLastSeen(m_peerLastSeenByUsername, user);
                rememberBio(m_peerBioByUsername, user);
            }
            m_renderedDialogsFingerprint.clear();
            if (m_apiClient) {
                m_apiClient->getDialogs();
            }
            refreshChatStatusText();
            return;
        }
        if (endpoint == "/api/chats/discover") {
            m_discoverChats = body.array();
            return;
        }
        if (endpoint == "/api/contacts") {
            m_contacts = body.object();
            if (m_contactsDialogRequested) {
                m_contactsDialogRequested = false;
                showContactsDialog(body);
            }
            for (const auto key : { "friends", "blocked", "requestsIn", "requestsOut" }) {
                const auto items = m_contacts.value(QString::fromLatin1(key)).toArray();
                for (const auto &value : items) {
                    const auto user = value.toObject();
                    rememberLastSeen(m_peerLastSeenByUsername, user);
                    rememberBio(m_peerBioByUsername, user);
                }
            }
            updatePeerActionBar();
            if (!m_currentChatId.isEmpty()) {
                refreshChatStatusText();
            } else {
                setStatusText("Контакты загружены");
            }
            return;
        }
        if (endpoint.startsWith("/api/contacts/") || endpoint == "/api/peer-alias") {
            if (m_apiClient) {
                m_apiClient->getContacts();
                m_apiClient->getDialogs();
            }
            setStatusText("Данные чата обновлены");
            return;
        }
        if (endpoint == "/api/chats") {
            if (body.isArray()) {
                renderChats(body);
            } else {
                const auto chat = body.object();
                const auto chatId = chat.value("id").toString();
                setStatusText("Чат создан");
                if (m_apiClient) {
                    m_apiClient->getChats();
                    m_apiClient->getDialogs();
                }
                if (!chatId.isEmpty()) {
                    m_currentChatId = chatId;
                }
            }
            return;
        }
        if (endpoint.startsWith("/api/chats/") && (endpoint.endsWith("/join") || endpoint.endsWith("/leave"))) {
            if (m_apiClient) {
                m_apiClient->getChats();
                if (isSuperAdmin()) m_apiClient->getAdminChats();
                m_apiClient->getDialogs();
                m_apiClient->getDiscoverChats();
            }
            setStatusText(endpoint.endsWith("/leave") ? "Вы вышли из чата" : "Чат добавлен");
            return;
        }
        if (endpoint.startsWith("/api/chats/") && endpoint.endsWith("/verify")) {
            if (m_apiClient) {
                m_apiClient->getChats();
                if (isSuperAdmin()) m_apiClient->getAdminChats();
                m_apiClient->getDialogs();
                m_apiClient->getDiscoverChats();
            }
            setStatusText("Чат верифицирован");
            return;
        }
        if (endpoint.startsWith("/api/users/") && endpoint.endsWith("/verify")) {
            if (m_apiClient) {
                m_apiClient->getUsers();
                if (isSuperAdmin()) m_apiClient->getAdminChats();
                m_adminUsersDialogRequested = true;
                m_apiClient->getAdminUsers();
            }
            setStatusText("Профиль верифицирован");
            return;
        }
        if (endpoint.startsWith("/api/reports/") && (endpoint.endsWith("/resolve") || endpoint.endsWith("/reject"))) {
            if (m_apiClient) {
                m_reportsDialogRequested = true;
                m_apiClient->getReports();
            }
            setStatusText(endpoint.endsWith("/resolve") ? "Жалоба закрыта" : "Жалоба отклонена");
            return;
        }
        if (!m_pendingChatDeleteEndpoint.isEmpty() && endpoint == m_pendingChatDeleteEndpoint
            && body.object().value("ok").toBool()) {
            m_pendingChatDeleteEndpoint.clear();
            m_currentChatId.clear();
            m_currentPeerUsername.clear();
            m_renderedMessagesFingerprint.clear();
            m_renderedMessagesChatId.clear();
            if (m_messageList) m_messageList->clear();
            if (m_apiClient) {
                m_apiClient->getChats();
                m_apiClient->getDialogs();
                m_apiClient->getDiscoverChats();
            }
            if (m_chatTitleLabel) m_chatTitleLabel->setText("Выберите чат");
            setStatusText("Группа или канал удалены");
            updatePeerActionBar();
            return;
        }
        if (endpoint.startsWith("/api/chats/") && body.object().value("ok").toBool()) {
            if (m_apiClient) {
                m_apiClient->getChats();
                if (isSuperAdmin()) m_apiClient->getAdminChats();
                m_apiClient->getDialogs();
                m_apiClient->getDiscoverChats();
            }
            setStatusText("Чат удалён");
            return;
        }
        if (endpoint == "/api/dialogs") {
            renderDialogs(body);
            return;
        }
        if (endpoint == "/api/messages/all") {
            renderMessagesAll(body);
            return;
        }
        if (endpoint == "/api/messages/read") {
            return;
        }
        if (endpoint.startsWith("/api/messages?")) {
            const QUrl endpointUrl(QString("https://aton.local%1").arg(endpoint));
            const QUrlQuery query(endpointUrl);
            const auto chatId = query.queryItemValue("chatId", QUrl::FullyDecoded);
            const bool olderPage = query.hasQueryItem("before") || m_pendingOlderMessageRequests.contains(chatId);
            if (chatId.isEmpty()) return;

            QMap<QString, QJsonObject> mergedById;
            for (const auto &value : m_allMessages) {
                const auto msg = value.toObject();
                const auto id = msg.value("id").toString();
                if (id.isEmpty()) continue;
                if (messageChatId(msg) == chatId || olderPage) {
                    mergedById.insert(id, msg);
                }
            }
            const auto page = body.array();
            for (const auto &value : page) {
                const auto msg = value.toObject();
                const auto id = msg.value("id").toString();
                if (!id.isEmpty()) mergedById.insert(id, msg);
            }
            if (page.size() < 20) {
                m_messagesHistoryComplete.insert(chatId);
            }
            if (olderPage) {
                m_messagesHistoryLoading.remove(chatId);
            }
            QJsonArray nextAll;
            for (const auto &value : m_allMessages) {
                const auto msg = value.toObject();
                if (messageChatId(msg) != chatId) nextAll.append(msg);
            }
            QVector<QJsonObject> chatMessageObjects;
            for (const auto &msg : std::as_const(mergedById)) {
                if (messageChatId(msg) == chatId) chatMessageObjects.append(msg);
            }
            std::sort(chatMessageObjects.begin(), chatMessageObjects.end(), [this](const QJsonObject &a, const QJsonObject &b) {
                return messageTimeIso(a) < messageTimeIso(b);
            });
            QJsonArray chatMessages;
            for (const auto &msg : std::as_const(chatMessageObjects)) chatMessages.append(msg);
            for (const auto &value : chatMessages) nextAll.append(value);
            m_allMessages = nextAll;
            renderMessages(QJsonDocument(chatMessages), chatId);
            if (olderPage) {
                m_pendingOlderMessageRequests.remove(chatId);
            }
            return;
        }
        if (endpoint == "/api/messages") {
            setStatusText("Сообщение отправлено");
            if (!m_currentChatId.isEmpty()) {
                m_scrollToBottomOnNextMessages = true;
                m_apiClient->getMessages(m_currentChatId);
                if (m_currentChatId.contains("golos_aton", Qt::CaseInsensitive)) {
                    const QString chatId = m_currentChatId;
                    for (const int delayMs : {1500, 3500, 7000, 12000}) {
                        QTimer::singleShot(delayMs, this, [this, chatId]() {
                            if (m_apiClient && m_currentChatId == chatId) {
                                m_apiClient->getMessages(chatId);
                            }
                        });
                    }
                }
            }
            m_apiClient->getDialogs();
            return;
        }
        if (endpoint.startsWith("/api/messages/") && endpoint.endsWith("/react")) {
            if (!m_currentChatId.isEmpty()) {
                m_apiClient->getMessages(m_currentChatId);
            }
            m_apiClient->getDialogs();
            return;
        }
        if (endpoint.startsWith("/api/messages/")) {
            if (!m_currentChatId.isEmpty()) {
                m_apiClient->getMessages(m_currentChatId);
            }
            m_apiClient->getDialogs();
            return;
        }
        if (endpoint.startsWith("/api/link-preview")) return;
        refreshChatStatusText();
    });

    connect(m_apiClient, &ApiClient::requestFailed, this, [this](const QString &endpoint, const QString &message) {
        if (endpoint == "/api/messages/read") {
            refreshChatStatusText();
            return;
        }
        if (!m_pendingChatDeleteEndpoint.isEmpty() && endpoint == m_pendingChatDeleteEndpoint) {
            m_pendingChatDeleteEndpoint.clear();
        }
        if (endpoint == "/api/admin/users") {
            m_adminUsersDialogRequested = false;
        }
        if (endpoint == "/api/reports") {
            m_reportsDialogRequested = false;
        }
        if (endpoint == "/api/messages/all") {
            m_messagesAllRequested = false;
            if (m_currentChatId.isEmpty()) {
                setStatusText(QString("Не удалось загрузить сообщения: %1").arg(message));
            } else {
                refreshChatStatusText();
            }
            return;
        }
        if (endpoint == "/api/dialogs") {
            if (!m_sessionStore || !m_sessionStore->hasToken()) {
                if (m_chatList) {
                    m_chatList->clear();
                }
                if (m_authStatusLabel && m_stack && m_stack->currentWidget() == m_authPage) {
                    m_authStatusLabel->setText(trAuth(m_authLanguage, m_registerMode ? "registerHint" : "loginHint"));
                }
                return;
            }
            if (m_chatList && m_chatList->count() == 0) {
                m_chatList->addItem("Не удалось загрузить диалоги");
            }
            setStatusText(QString("Не удалось загрузить диалоги: %1").arg(message));
            return;
        }
        setStatusText(QString("Ошибка %1: %2").arg(endpoint, message));
    });

    connect(m_apiClient, &ApiClient::sessionExpired, this, [this]() {
        if (m_sessionStore) {
            m_sessionStore->clear();
        }
        if (m_syncTimer) {
            m_syncTimer->stop();
        }
        m_currentChatId.clear();
        m_currentPeerUsername.clear();
        m_groupChats = {};
        m_allMessages = {};
        m_unreadByChat.clear();
        m_messageBaselineReady = false;
        if (m_sessionStore) {
            m_sessionStore->clearChatReads();
        }
        if (m_notifications) {
            m_notifications->setUnreadCount(0);
        }
        setStatusText(trAuth(m_authLanguage, "sessionExpired"));
        refreshSessionUi();
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
    } else if (m_syncTimer) {
        m_syncTimer->stop();
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
    if (m_sessionStore) {
        m_sessionStore->setUiLanguage(lang);
    }
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
    if (m_profileLanguageLabel) {
        if (m_authLanguage == "de") {
            m_profileLanguageLabel->setText("SPRACHE DER OBERFLÄCHE");
        } else if (m_authLanguage == "en") {
            m_profileLanguageLabel->setText("INTERFACE LANGUAGE");
        } else {
            m_profileLanguageLabel->setText("ЯЗЫК ИНТЕРФЕЙСА");
        }
    }
    if (m_authStatusLabel) {
        m_authStatusLabel->setText(trAuth(m_authLanguage, m_registerMode ? "registerHint" : "loginHint"));
    }
    if (m_ruButton) m_ruButton->setObjectName(m_authLanguage == "ru" ? "LangButtonActive" : "LangButton");
    if (m_deButton) m_deButton->setObjectName(m_authLanguage == "de" ? "LangButtonActive" : "LangButton");
    if (m_enButton) m_enButton->setObjectName(m_authLanguage == "en" ? "LangButtonActive" : "LangButton");
    if (m_profileRuButton) m_profileRuButton->setObjectName(m_authLanguage == "ru" ? "LangButtonActive" : "LangButton");
    if (m_profileDeButton) m_profileDeButton->setObjectName(m_authLanguage == "de" ? "LangButtonActive" : "LangButton");
    if (m_profileEnButton) m_profileEnButton->setObjectName(m_authLanguage == "en" ? "LangButtonActive" : "LangButton");
    for (auto *btn : {m_ruButton, m_deButton, m_enButton, m_profileRuButton, m_profileDeButton, m_profileEnButton}) {
        if (!btn) continue;
        btn->style()->unpolish(btn);
        btn->style()->polish(btn);
    }
}

void MainWindow::loadAuthenticatedData()
{
    if (!m_apiClient || !m_sessionStore || !m_sessionStore->hasToken()) return;
    if (m_syncTimer && !m_syncTimer->isActive()) m_syncTimer->start();
    m_apiClient->getMe();
    m_apiClient->getDialogs();
    QTimer::singleShot(150, this, [this]() {
        if (!m_apiClient || !m_sessionStore || !m_sessionStore->hasToken()) return;
        m_apiClient->getChats();
        m_apiClient->getContacts();
        m_apiClient->getUsers();
        if (isSuperAdmin()) m_apiClient->getAdminChats();
    });
}

void MainWindow::renderChats(const QJsonDocument &body)
{
    m_groupChats = body.array();
    if (m_chatList && m_chatList->count() == 0 && !m_allMessages.isEmpty()) {
        renderSidebar();
    }
}

void MainWindow::renderDialogs(const QJsonDocument &body)
{
    if (!m_chatList) return;
    QByteArray fingerprint = body.toJson(QJsonDocument::Compact);
    fingerprint += '\n';
    fingerprint += m_chatFilter.toUtf8();
    for (auto it = m_unreadByChat.cbegin(); it != m_unreadByChat.cend(); ++it) {
        fingerprint += '\n';
        fingerprint += it.key().toUtf8();
        fingerprint += '=';
        fingerprint += QByteArray::number(it.value());
    }
    if (fingerprint == m_renderedDialogsFingerprint) return;
    m_renderedDialogsFingerprint = fingerprint;

    const auto previousChatId = m_currentChatId;
    m_chatList->clear();

    const auto dialogs = body.array();
    if (dialogs.isEmpty()) {
        m_chatList->addItem("Нет чатов");
        return;
    }

    QList<ChatRow> rows;
    for (const auto &value : dialogs) {
        const auto dialog = value.toObject();
        ChatRow row{
            dialog.value("id").toString(),
            dialog.value("title").toString("Чат"),
            dialog.value("type").toString("private"),
            dialog.value("preview").toString(),
            dialog.value("lastTime").toString(),
            dialog.value("peerUsername").toString(),
            dialog.value("avatarDataUrl").toString(dialog.value("peerAvatarDataUrl").toString()),
            dialog.value("isSystem").toBool()
                || dialog.value("official").toBool()
                || dialog.value("isOfficial").toBool()
                || dialog.value("officialAccount").toBool()
                || dialog.value("peerUsername").toString().compare("golos_aton", Qt::CaseInsensitive) == 0,
            dialog.value("isSystem").toBool()
                || dialog.value("peerUsername").toString().compare("golos_aton", Qt::CaseInsensitive) == 0,
            dialog.contains("unread")
                ? dialog.value("unread").toInt()
                : m_unreadByChat.value(dialog.value("id").toString(), 0),
        };
        if (row.id.isEmpty()) continue;
        if (row.peerUsername.isEmpty() && isDirectChatId(row.id)) {
            row.peerUsername = peerFromDirectChatId(row.id, m_currentUsername);
        }
        m_dialogTitles.insert(row.id, row.title);
        const auto peerLastSeen = dialog.value("peerLastSeen").toString();
        if (!peerLastSeen.isEmpty()) {
            m_dialogPeerLastSeen.insert(row.id, peerLastSeen);
        }
        if (!row.peerUsername.isEmpty() && !peerLastSeen.isEmpty()) {
            m_peerLastSeenByUsername.insert(row.peerUsername.toLower(), peerLastSeen);
        }
        const auto peerBio = dialog.value("peerBio").toString().simplified();
        if (!row.peerUsername.isEmpty() && !peerBio.isEmpty()) {
            m_peerBioByUsername.insert(row.peerUsername.toLower(), peerBio);
        }
        if (!m_chatFilter.isEmpty()) {
            const auto haystack = QString("%1 %2 %3").arg(row.title, row.type, row.preview);
            if (!haystack.contains(m_chatFilter, Qt::CaseInsensitive)) continue;
        }
        rows.append(row);
    }

    std::sort(rows.begin(), rows.end(), chatRowLess);

    int selectedRow = 0;
    int visibleRow = 0;
    for (const auto &row : rows) {
        auto *item = new QListWidgetItem();
        item->setData(Qt::UserRole, row.id);
        item->setData(Qt::UserRole + 1, row.title);
        item->setData(Qt::UserRole + 2, row.peerUsername);
        item->setData(Qt::UserRole + 3, row.type);
        item->setData(Qt::UserRole + 4, row.verified);
        item->setData(Qt::UserRole + 5, row.system);
        item->setSizeHint(QSize(340, 72));
        m_chatList->addItem(item);
        m_chatList->setItemWidget(item, makeChatRowWidget(row, m_chatList));
        if (row.id == previousChatId) selectedRow = visibleRow;
        ++visibleRow;
    }

    if (m_chatList->count() == 0) {
        m_chatList->addItem("Ничего не найдено");
        return;
    }
    m_chatList->setCurrentRow(std::min(selectedRow, m_chatList->count() - 1));
    QTimer::singleShot(0, this, &MainWindow::openSelectedChat);
}

void MainWindow::renderMessagesAll(const QJsonDocument &body)
{
    m_messagesAllRequested = true;
    m_allMessages = body.array();
    processMessageSnapshot(m_allMessages, true);
    if (m_chatList && m_chatList->count() == 0 && !m_groupChats.isEmpty()) {
        renderSidebar();
    }
    if (m_apiClient && m_messageBaselineReady) {
        m_apiClient->getDialogs();
    }
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
                                 {},
                                 chat.value("avatarDataUrl").toString(),
                                 chat.value("official").toBool()
                                     || chat.value("isOfficial").toBool()
                                     || chat.value("officialAccount").toBool(),
                                 chat.value("isSystem").toBool(),
                                 m_unreadByChat.value(id, 0),
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
                auto title = peer;
                if (title.isEmpty()) {
                    const auto parts = chatId.split("|");
                    title = parts.isEmpty() ? chatId : parts.last();
                }
                row = ChatRow{
                    chatId,
                    title,
                    "private",
                    {},
                    {},
                    peer,
                    {},
                    peer.compare("golos_aton", Qt::CaseInsensitive) == 0,
                    peer.compare("golos_aton", Qt::CaseInsensitive) == 0,
                    m_unreadByChat.value(chatId, 0)};
                for (const auto &userValue : m_users) {
                    const auto user = userValue.toObject();
                    if (user.value("username").toString().compare(peer, Qt::CaseInsensitive) != 0) continue;
                    row.title = user.value("displayName").toString(peer);
                    row.avatarDataUrl = user.value("avatarDataUrl").toString();
                    row.verified = user.value("official").toBool()
                        || user.value("isOfficial").toBool()
                        || user.value("officialAccount").toBool()
                        || row.system;
                    rememberLastSeen(m_peerLastSeenByUsername, user);
                    rememberBio(m_peerBioByUsername, user);
                    break;
                }
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
    for (auto &row : rows) {
        row.unread = m_unreadByChat.value(row.id, 0);
    }
    std::sort(rows.begin(), rows.end(), chatRowLess);

    if (rows.isEmpty()) {
        m_chatList->addItem("Нет чатов");
        return;
    }

    int selectedRow = 0;
    int visibleRow = 0;
    for (int i = 0; i < rows.size(); ++i) {
        const auto &row = rows[i];
        if (!m_chatFilter.isEmpty()) {
            const auto haystack = QString("%1 %2 %3").arg(row.title, row.type, row.preview);
            if (!haystack.contains(m_chatFilter, Qt::CaseInsensitive)) {
                continue;
            }
        }
        auto *item = new QListWidgetItem();
        item->setData(Qt::UserRole, row.id);
        item->setData(Qt::UserRole + 1, row.title);
        item->setData(Qt::UserRole + 2, row.peerUsername);
        item->setData(Qt::UserRole + 3, row.type);
        item->setData(Qt::UserRole + 4, row.verified);
        item->setData(Qt::UserRole + 5, row.system);
        item->setSizeHint(QSize(340, 72));
        m_chatList->addItem(item);
        m_chatList->setItemWidget(item, makeChatRowWidget(row, m_chatList));
        if (row.id == previousChatId) selectedRow = visibleRow;
        ++visibleRow;
    }
    if (m_chatList->count() == 0) {
        m_chatList->addItem("Ничего не найдено");
        return;
    }
    if (m_chatList->count() > 0) {
        m_chatList->setCurrentRow(std::min(selectedRow, m_chatList->count() - 1));
        QTimer::singleShot(0, this, &MainWindow::openSelectedChat);
    }
}

void MainWindow::renderMessages(const QJsonDocument &body, const QString &requestedChatId)
{
    if (!m_messageList) return;
    if (requestedChatId.isEmpty() || requestedChatId != m_currentChatId) return;

    const auto messages = body.array();
    const auto fingerprint = body.toJson(QJsonDocument::Compact);
    const bool sameChat = m_renderedMessagesChatId == requestedChatId;
    if (sameChat && fingerprint == m_renderedMessagesFingerprint) {
        refreshChatStatusText();
        if (isActiveWindow() && !isMinimized()) {
            markCurrentChatRead();
        }
        return;
    }

    auto *scrollBar = m_messageList->verticalScrollBar();
    const int oldScrollValue = scrollBar ? scrollBar->value() : 0;
    const int oldScrollMaximum = scrollBar ? scrollBar->maximum() : 0;
    const bool olderResponse = m_pendingOlderMessageRequests.contains(requestedChatId);
    const bool wasNearBottom = oldScrollMaximum - oldScrollValue <= 48;
    const bool scrollToBottom = !olderResponse && (!sameChat || m_scrollToBottomOnNextMessages || wasNearBottom);

    m_renderedMessagesChatId = requestedChatId;
    m_renderedMessagesFingerprint = fingerprint;
    m_scrollToBottomOnNextMessages = false;
    m_messageList->setUpdatesEnabled(false);
    m_messageList->clear();
    if (messages.isEmpty()) {
        auto *item = new QListWidgetItem("Нет сообщений");
        item->setTextAlignment(Qt::AlignCenter);
        m_messageList->addItem(item);
        m_messageList->setUpdatesEnabled(true);
        refreshChatStatusText();
        return;
    }
    if (!m_messagesHistoryComplete.contains(requestedChatId)) {
        auto *loaderItem = new QListWidgetItem(
            m_messagesHistoryLoading.contains(requestedChatId)
                ? "Загружаем ранние сообщения..."
                : "Прокрутите выше, чтобы открыть ранние сообщения");
        loaderItem->setFlags(Qt::NoItemFlags);
        loaderItem->setTextAlignment(Qt::AlignCenter);
        loaderItem->setSizeHint(QSize(900, 34));
        m_messageList->addItem(loaderItem);
    }
    QString previousMessageDateKey;
    for (const auto &value : messages) {
        const auto msg = value.toObject();
        const auto messageIso = msg.value("createdAt").toString(msg.value("time").toString());
        const auto currentMessageDateKey = messageDateKey(messageIso);
        if (!currentMessageDateKey.isEmpty() && currentMessageDateKey != previousMessageDateKey) {
            const auto label = messageDaySeparatorLabel(messageIso);
            if (!label.isEmpty()) {
                auto *dateItem = new QListWidgetItem();
                dateItem->setFlags(Qt::NoItemFlags);
                dateItem->setSizeHint(QSize(900, 34));
                m_messageList->addItem(dateItem);
                m_messageList->setItemWidget(dateItem, makeMessageDateSeparatorWidget(label, m_messageList));
            }
            previousMessageDateKey = currentMessageDateKey;
        }
        auto *row = makeMessageRowWidget(
            msg,
            m_currentUsername,
            m_apiClient,
            messages,
            [this](const QJsonObject &message) { setReplyToMessage(message); },
            [this](const QJsonObject &message) { reportMessage(message); },
            [this](const QString &messageId) { removeMessageRowAnimated(messageId); },
            m_messageList);
        auto *item = new QListWidgetItem();
        item->setData(Qt::UserRole, msg.value("id").toString());
        row->ensurePolished();
        row->adjustSize();
        item->setSizeHint(QSize(900, std::max(messageRowHeight(msg), row->sizeHint().height() + 8)));
        m_messageList->addItem(item);
        m_messageList->setItemWidget(item, row);
    }
    m_messageList->setUpdatesEnabled(true);
    QTimer::singleShot(0, this, [this, scrollToBottom, olderResponse, oldScrollValue, oldScrollMaximum]() {
        if (!m_messageList) return;
        if (scrollToBottom) {
            m_messageList->scrollToBottom();
        } else if (olderResponse) {
            if (auto *bar = m_messageList->verticalScrollBar()) {
                const int delta = bar->maximum() - oldScrollMaximum;
                bar->setValue(std::clamp(oldScrollValue + delta, 0, bar->maximum()));
            }
        } else if (auto *bar = m_messageList->verticalScrollBar()) {
            bar->setValue(std::min(oldScrollValue, bar->maximum()));
        }
    });
    refreshChatStatusText();
    if (isActiveWindow() && !isMinimized()) {
        markCurrentChatRead();
    }
}

void MainWindow::removeMessageRowAnimated(const QString &messageId)
{
    if (!m_messageList || messageId.isEmpty()) return;

    auto findRow = [this, &messageId]() -> int {
        for (int i = 0; i < m_messageList->count(); ++i) {
            auto *item = m_messageList->item(i);
            if (item && item->data(Qt::UserRole).toString() == messageId) {
                return i;
            }
        }
        return -1;
    };

    const int rowIndex = findRow();
    if (rowIndex < 0) return;
    auto *item = m_messageList->item(rowIndex);
    auto *rowWidget = item ? m_messageList->itemWidget(item) : nullptr;
    if (!item || !rowWidget) return;

    auto *effect = new QGraphicsOpacityEffect(rowWidget);
    rowWidget->setGraphicsEffect(effect);

    auto *fade = new QPropertyAnimation(effect, "opacity", m_messageList);
    fade->setDuration(180);
    fade->setStartValue(1.0);
    fade->setEndValue(0.0);

    const int startHeight = std::max(1, item->sizeHint().height());
    auto *collapse = new QVariantAnimation(m_messageList);
    collapse->setDuration(180);
    collapse->setStartValue(startHeight);
    collapse->setEndValue(0);
    connect(collapse, &QVariantAnimation::valueChanged, this, [this, messageId](const QVariant &value) {
        if (!m_messageList) return;
        for (int i = 0; i < m_messageList->count(); ++i) {
            auto *candidate = m_messageList->item(i);
            if (candidate && candidate->data(Qt::UserRole).toString() == messageId) {
                candidate->setSizeHint(QSize(900, value.toInt()));
                break;
            }
        }
    });
    connect(collapse, &QVariantAnimation::finished, this, [this, messageId, fade, collapse]() {
        if (m_messageList) {
            for (int i = 0; i < m_messageList->count(); ++i) {
                auto *candidate = m_messageList->item(i);
                if (!candidate || candidate->data(Qt::UserRole).toString() != messageId) continue;
                auto *widget = m_messageList->itemWidget(candidate);
                if (widget) {
                    m_messageList->removeItemWidget(candidate);
                    widget->deleteLater();
                }
                delete m_messageList->takeItem(i);
                break;
            }
        }
        fade->deleteLater();
        collapse->deleteLater();
    });

    fade->start();
    collapse->start();
}

void MainWindow::showProfileDialog()
{
    if (m_currentUser.isEmpty()) {
        setStatusText("Профиль ещё загружается");
        return;
    }

    populateProfilePage();
    if (m_messageList) m_messageList->hide();
    if (m_composerPanel) m_composerPanel->hide();
    if (m_peerActionBar) m_peerActionBar->hide();
    if (m_profilePage) m_profilePage->show();
    if (m_chatTitleLabel) m_chatTitleLabel->setText("Профиль пользователя");
    setStatusText("Настройки профиля");
    return;

    QDialog dialog(this);
    dialog.setWindowTitle("Профиль пользователя");
    dialog.setMinimumWidth(460);

    auto *layout = new QVBoxLayout(&dialog);
    auto *form = new QFormLayout();
    form->setLabelAlignment(Qt::AlignLeft);

    auto *email = new QLineEdit(m_currentUser.value("email").toString(), &dialog);
    email->setReadOnly(true);
    auto *name = new QLineEdit(m_currentUser.value("displayName").toString(m_currentUsername), &dialog);
    auto *publicId = new QLineEdit(m_currentUser.value("publicId").toString(m_currentUsername), &dialog);
    auto *bio = new QTextEdit(m_currentUser.value("bio").toString(), &dialog);
    bio->setFixedHeight(86);

    const auto verified = m_currentUser.value("isVerified").toBool();
    auto *verifiedLabel = new QLabel(verified ? "Профиль верифицирован ✓" : "Профиль не верифицирован", &dialog);
    verifiedLabel->setObjectName("MutedText");

    form->addRow("Email аккаунта", email);
    form->addRow("Отображаемое имя", name);
    form->addRow("ID профиля", publicId);
    form->addRow("Статус", bio);
    form->addRow("Верификация", verifiedLabel);
    layout->addLayout(form);

    auto *buttons = new QDialogButtonBox(QDialogButtonBox::Save | QDialogButtonBox::Cancel, &dialog);
    buttons->button(QDialogButtonBox::Save)->setText("Сохранить");
    buttons->button(QDialogButtonBox::Cancel)->setText("Отмена");
    layout->addWidget(buttons);

    connect(buttons, &QDialogButtonBox::accepted, &dialog, [&]() {
        if (m_apiClient) {
            m_apiClient->updateProfile(
                name->text(),
                bio->toPlainText(),
                publicId->text(),
                m_currentUser.value("avatarDataUrl").toString()
            );
            setStatusText("Сохранение профиля...");
        }
        dialog.accept();
    });
    connect(buttons, &QDialogButtonBox::rejected, &dialog, &QDialog::reject);
    dialog.exec();
}

bool MainWindow::isSuperAdmin() const
{
    return m_currentUser.value("isSuperAdmin").toBool();
}

QJsonObject MainWindow::currentGroupChatObject() const
{
    if (m_currentChatId.isEmpty() || isDirectChatId(m_currentChatId)) return {};
    for (const auto &value : m_groupChats) {
        const auto chat = value.toObject();
        if (chat.value("id").toString() == m_currentChatId) return chat;
    }
    for (const auto &value : m_adminChats) {
        const auto chat = value.toObject();
        if (chat.value("id").toString() == m_currentChatId) return chat;
    }
    return {};
}

bool MainWindow::canPostCurrentChat() const
{
    if (m_currentChatId.isEmpty()) return false;
    if (isDirectChatId(m_currentChatId)) return true;

    const auto chat = currentGroupChatObject();
    const auto type = chat.value("type").toString(m_currentChatId.startsWith("channel:") ? "channel" : "group");
    if (type != "channel") return true;
    if (isSuperAdmin()) return true;
    if (chat.value("owner").toString().compare(m_currentUsername, Qt::CaseInsensitive) == 0) return true;
    if (chat.value("ownerId").toString() == m_currentUser.value("id").toString()) return true;

    const auto admins = chat.value("admins").toArray();
    const auto currentUserId = m_currentUser.value("id").toString();
    for (const auto &value : admins) {
        if (value.toString() == currentUserId) return true;
    }
    return false;
}

void MainWindow::updateAdminControls()
{
    const bool visible = isSuperAdmin();
    if (m_adminUsersButton) m_adminUsersButton->setVisible(visible);
    if (m_reportsButton) m_reportsButton->setVisible(visible);
}

void MainWindow::requestAdminUsers()
{
    if (!m_apiClient) return;
    m_adminUsersDialogRequested = true;
    setStatusText("Загрузка списка пользователей...");
    m_apiClient->getAdminUsers();
}

void MainWindow::requestReports()
{
    if (!m_apiClient) return;
    m_reportsDialogRequested = true;
    setStatusText("Загрузка жалоб...");
    if (isSuperAdmin()) m_apiClient->getAdminChats();
    m_apiClient->getReports();
}

void MainWindow::verifyCurrentChat()
{
    if (!m_apiClient || !isSuperAdmin() || m_currentChatId.isEmpty() || isDirectChatId(m_currentChatId)) {
        setStatusText("Верифицировать можно только группу или канал от имени суперадмина");
        return;
    }
    setStatusText("Верификация чата...");
    m_apiClient->verifyChat(m_currentChatId);
}

void MainWindow::showReportDialog(const QString &title, const std::function<void(const QString &)> &submit)
{
    if (!submit) return;
    const QStringList reasons = {
        "Спам",
        "Оскорбления",
        "Мошенничество",
        "Нарушение правил",
        "Другое",
    };
    bool ok = false;
    const auto reason = QInputDialog::getItem(this, title, "Причина", reasons, 0, false, &ok).trimmed();
    if (!ok || reason.isEmpty()) return;
    submit(reason);
    setStatusText("Жалоба отправляется...");
}

void MainWindow::reportCurrentChatOrPeer()
{
    if (!m_apiClient || m_currentChatId.isEmpty()) return;
    if (isDirectChatId(m_currentChatId) && !m_currentPeerUsername.isEmpty()) {
        const auto peer = m_currentPeerUsername;
        showReportDialog("Пожаловаться на пользователя", [this, peer](const QString &reason) {
            if (m_apiClient) m_apiClient->reportUser(peer, reason);
        });
        return;
    }
    const auto chatId = m_currentChatId;
    showReportDialog("Пожаловаться на чат", [this, chatId](const QString &reason) {
        if (m_apiClient) m_apiClient->reportChat(chatId, reason);
    });
}

void MainWindow::reportMessage(const QJsonObject &message)
{
    if (!m_apiClient) return;
    const auto messageId = message.value("id").toString();
    if (messageId.isEmpty()) return;
    showReportDialog("Пожаловаться на сообщение", [this, messageId](const QString &reason) {
        if (m_apiClient) m_apiClient->reportMessage(messageId, reason);
    });
}

void MainWindow::showAdminUsersDialog(const QJsonDocument &body)
{
    const auto users = body.isArray() ? body.array() : body.object().value("users").toArray();
    QDialog dialog(this);
    dialog.setObjectName("UtilityDialog");
    dialog.setWindowTitle("Все пользователи");
    dialog.setMinimumSize(920, 620);

    auto *layout = new QVBoxLayout(&dialog);
    layout->setContentsMargins(22, 20, 22, 20);
    layout->setSpacing(10);

    auto *heading = new QLabel("Все зарегистрированные пользователи", &dialog);
    heading->setObjectName("UtilityDialogHeading");
    auto *hint = new QLabel("Суперадмин может проверить профиль и выдать синюю галочку.", &dialog);
    hint->setObjectName("UtilityDialogHint");
    auto *search = new QLineEdit(&dialog);
    search->setObjectName("UtilityDialogInput");
    search->setPlaceholderText("Поиск по имени, username или email");
    auto *table = new QTableWidget(&dialog);
    table->setObjectName("AdminUsersTable");
    table->setColumnCount(7);
    table->setHorizontalHeaderLabels({"Имя", "Username", "Email", "Статус", "Создан", "Был(а) в сети", "Действие"});
    table->verticalHeader()->hide();
    table->setSelectionBehavior(QAbstractItemView::SelectRows);
    table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    table->setAlternatingRowColors(true);
    table->horizontalHeader()->setStretchLastSection(false);
    table->horizontalHeader()->setSectionResizeMode(0, QHeaderView::Stretch);
    table->horizontalHeader()->setSectionResizeMode(1, QHeaderView::ResizeToContents);
    table->horizontalHeader()->setSectionResizeMode(2, QHeaderView::Stretch);
    table->horizontalHeader()->setSectionResizeMode(3, QHeaderView::ResizeToContents);
    table->horizontalHeader()->setSectionResizeMode(4, QHeaderView::ResizeToContents);
    table->horizontalHeader()->setSectionResizeMode(5, QHeaderView::ResizeToContents);
    table->horizontalHeader()->setSectionResizeMode(6, QHeaderView::ResizeToContents);

    auto formatDate = [](const QString &iso) {
        if (iso.trimmed().isEmpty()) return QString("—");
        const auto dt = QDateTime::fromString(iso, Qt::ISODateWithMs).isValid()
            ? QDateTime::fromString(iso, Qt::ISODateWithMs)
            : QDateTime::fromString(iso, Qt::ISODate);
        if (!dt.isValid()) return iso.left(16);
        return QLocale(QLocale::Russian).toString(dt.toLocalTime(), "d MMM yyyy, HH:mm");
    };

    auto fillTable = [&, table, users, formatDate]() {
        const auto needle = search->text().trimmed().toLower();
        table->setRowCount(0);
        for (const auto &value : users) {
            const auto user = value.toObject();
            const auto id = user.value("id").toString();
            const auto username = user.value("username").toString();
            const auto publicId = user.value("publicId").toString(username);
            const auto name = user.value("displayName").toString(username);
            const auto email = user.value("email").toString();
            const bool emailVerified = user.value("verified").toBool();
            const bool verified = user.value("isVerified").toBool();
            const bool superAdmin = user.value("isSuperAdmin").toBool();
            const auto haystack = QString("%1 %2 %3 %4").arg(name, username, publicId, email).toLower();
            if (!needle.isEmpty() && !haystack.contains(needle)) continue;

            const int row = table->rowCount();
            table->insertRow(row);
            table->setItem(row, 0, new QTableWidgetItem(name));
            table->setItem(row, 1, new QTableWidgetItem(QString("@%1").arg(publicId)));
            table->setItem(row, 2, new QTableWidgetItem(email));
            table->setItem(row, 3, new QTableWidgetItem(superAdmin ? "superadmin" : (verified ? "verified" : "нет галочки")));
            QStringList flags;
            if (superAdmin) flags << "superadmin";
            if (emailVerified) flags << "email";
            if (verified) flags << "profile";
            table->setItem(row, 3, new QTableWidgetItem(flags.isEmpty() ? QStringLiteral("нет галочки") : flags.join(", ")));
            table->setItem(row, 4, new QTableWidgetItem(formatDate(user.value("createdAt").toString())));
            table->setItem(row, 5, new QTableWidgetItem(formatDate(user.value("lastSeen").toString())));

            auto *verifyButton = new QPushButton(verified ? "Верифицирован" : "Верифицировать", table);
            verifyButton->setObjectName(verified ? "UtilitySecondaryButton" : "UtilityPrimaryButton");
            verifyButton->setEnabled(!verified && !id.isEmpty());
            verifyButton->setCursor(Qt::PointingHandCursor);
            connect(verifyButton, &QPushButton::clicked, this, [this, id, &dialog]() {
                if (!m_apiClient || id.isEmpty()) return;
                setStatusText("Верификация профиля...");
                m_apiClient->verifyUser(id);
                dialog.accept();
            });
            table->setCellWidget(row, 6, verifyButton);
        }
    };

    auto *closeButton = new QPushButton("Закрыть", &dialog);
    closeButton->setObjectName("UtilitySecondaryButton");
    connect(closeButton, &QPushButton::clicked, &dialog, &QDialog::accept);
    connect(search, &QLineEdit::textChanged, &dialog, fillTable);

    layout->addWidget(heading);
    layout->addWidget(hint);
    layout->addWidget(search);
    layout->addWidget(table, 1);
    layout->addWidget(closeButton, 0, Qt::AlignRight);
    fillTable();
    dialog.exec();
}

void MainWindow::showReportsDialog(const QJsonDocument &body)
{
    const auto reports = body.isArray() ? body.array() : body.object().value("reports").toArray();
    QDialog dialog(this);
    dialog.setObjectName("UtilityDialog");
    dialog.setWindowTitle("Жалобы");
    dialog.setMinimumSize(760, 560);

    auto *layout = new QVBoxLayout(&dialog);
    layout->setContentsMargins(22, 20, 22, 20);
    layout->setSpacing(10);
    auto *heading = new QLabel("Жалобы пользователей", &dialog);
    heading->setObjectName("UtilityDialogHeading");
    auto *hint = new QLabel("Можно открыть чат, удалить нарушающий чат и закрыть жалобу, либо отклонить её.", &dialog);
    hint->setObjectName("UtilityDialogHint");
    auto *scroll = new QScrollArea(&dialog);
    scroll->setWidgetResizable(true);
    scroll->setObjectName("UtilityScrollArea");
    auto *container = new QWidget(scroll);
    auto *list = new QVBoxLayout(container);
    list->setContentsMargins(0, 0, 0, 0);
    list->setSpacing(10);

    if (reports.isEmpty()) {
        auto *empty = new QLabel("Жалоб пока нет.", container);
        empty->setObjectName("UtilityDialogHint");
        list->addWidget(empty);
    }

    auto findUserName = [this](const QString &idOrName) {
        if (idOrName.isEmpty()) return QString("неизвестно");
        for (const auto &value : m_users) {
            const auto user = value.toObject();
            if (user.value("id").toString() == idOrName || user.value("username").toString() == idOrName) {
                return user.value("displayName").toString(user.value("username").toString(idOrName));
            }
        }
        return idOrName;
    };

    for (const auto &value : reports) {
        const auto report = value.toObject();
        const auto reportId = report.value("id").toString();
        const auto targetType = report.value("targetType").toString(
            !report.value("messageId").toString().isEmpty()
                ? "message"
                : !report.value("targetUserId").toString().isEmpty() ? "user" : "chat");
        const auto chatId = report.value("chatId").toString();
        const auto chatObj = report.value("chat").toObject();
        const auto targetUserObj = report.value("targetUser").toObject();
        const auto messageObj = report.value("message").toObject();
        const auto chatTitle = chatObj.value("title").toString(chatTitleForId(chatId));
        const auto targetUser = targetUserObj.value("displayName").toString(
            targetUserObj.value("username").toString(report.value("targetUserId").toString()));
        const auto title = targetType == "message"
            ? QString("Сообщение%1").arg(chatTitle.isEmpty() ? QString() : QString(" в чате «%1»").arg(chatTitle))
            : targetType == "user"
                ? QString("Пользователь %1").arg(targetUser.isEmpty() ? report.value("targetUserId").toString() : targetUser)
                : chatTitle;
        const auto reason = report.value("reason").toString(report.value("message").toString());
        const auto reporterObj = report.value("reporter").toObject();
        const auto reporter = reporterObj.value("displayName").toString(
            reporterObj.value("username").toString(findUserName(report.value("reportedBy").toString(report.value("reporterId").toString(report.value("reporter").toString())))));
        const auto status = report.value("status").toString("open");

        auto *card = new QFrame(container);
        card->setObjectName("UtilityCard");
        auto *cardLayout = new QVBoxLayout(card);
        cardLayout->setContentsMargins(16, 14, 16, 14);
        cardLayout->setSpacing(8);
        auto *titleLabel = new QLabel(QString("%1  ·  %2").arg(title.isEmpty() ? chatId : title, status), card);
        titleLabel->setObjectName("UtilityCardTitle");
        auto *metaLabel = new QLabel(QString("От: %1\nПричина: %2").arg(reporter, reason.isEmpty() ? "без описания" : reason), card);
        metaLabel->setObjectName("UtilityDialogHint");
        metaLabel->setWordWrap(true);
        auto *buttons = new QHBoxLayout();
        buttons->setSpacing(8);
        auto *openButton = new QPushButton("Открыть чат", card);
        openButton->setObjectName("UtilitySecondaryButton");
        auto *deleteButton = new QPushButton("Удалить чат и закрыть", card);
        deleteButton->setObjectName("UtilityDangerButton");
        openButton->setEnabled(!chatId.isEmpty());
        deleteButton->setEnabled(targetType == "chat" && !chatId.isEmpty());
        auto *rejectButton = new QPushButton("Отклонить", card);
        rejectButton->setObjectName("UtilitySecondaryButton");
        buttons->addWidget(openButton);
        buttons->addWidget(deleteButton);
        buttons->addWidget(rejectButton);
        buttons->addStretch(1);
        connect(openButton, &QPushButton::clicked, this, [this, chatId, &dialog]() {
            if (chatId.isEmpty()) return;
            m_currentChatId = chatId;
            m_currentPeerUsername.clear();
            if (m_apiClient) m_apiClient->getMessages(chatId);
            if (m_chatTitleLabel) m_chatTitleLabel->setText(chatTitleForId(chatId));
            closeProfilePage();
            dialog.accept();
        });
        connect(deleteButton, &QPushButton::clicked, this, [this, chatId, reportId, &dialog]() {
            if (!m_apiClient || chatId.isEmpty()) return;
            const auto choice = QMessageBox::warning(this, "Удалить чат", "Удалить чат по жалобе без восстановления?", QMessageBox::Yes | QMessageBox::No, QMessageBox::No);
            if (choice != QMessageBox::Yes) return;
            m_apiClient->deleteChat(chatId);
            if (!reportId.isEmpty()) m_apiClient->resolveReport(reportId);
            dialog.accept();
        });
        connect(rejectButton, &QPushButton::clicked, this, [this, reportId, &dialog]() {
            if (!m_apiClient || reportId.isEmpty()) return;
            m_apiClient->rejectReport(reportId);
            dialog.accept();
        });
        cardLayout->addWidget(titleLabel);
        cardLayout->addWidget(metaLabel);
        cardLayout->addLayout(buttons);
        list->addWidget(card);
    }
    list->addStretch(1);
    scroll->setWidget(container);

    auto *closeButton = new QPushButton("Закрыть", &dialog);
    closeButton->setObjectName("UtilitySecondaryButton");
    connect(closeButton, &QPushButton::clicked, &dialog, &QDialog::accept);

    layout->addWidget(heading);
    layout->addWidget(hint);
    layout->addWidget(scroll, 1);
    layout->addWidget(closeButton, 0, Qt::AlignRight);
    dialog.exec();
}

void MainWindow::populateProfilePage()
{
    if (m_currentUser.isEmpty()) return;
    const auto name = m_currentUser.value("displayName").toString(m_currentUsername);
    const auto publicId = m_currentUser.value("publicId").toString(m_currentUsername);
    const auto email = m_currentUser.value("email").toString();
    const auto bio = m_currentUser.value("bio").toString();
    const auto verified = m_currentUser.value("isVerified").toBool();
    m_profileAvatarDataUrl = m_currentUser.value("avatarDataUrl").toString();

    if (m_profileNameLabel) m_profileNameLabel->setText(name);
    if (m_profilePublicIdLabel) m_profilePublicIdLabel->setText(QString("@%1").arg(publicId));
    if (m_profileBioLabel) {
        const auto cleanBio = bio.simplified();
        m_profileBioLabel->setText(cleanBio);
        m_profileBioLabel->setVisible(!cleanBio.isEmpty());
    }
    if (m_profileVerifiedLabel) {
        m_profileVerifiedLabel->setText(verified ? "Профиль верифицирован ✓" : "Профиль не верифицирован");
    }
    if (m_profileEmailInput) m_profileEmailInput->setText(email);
    if (m_profileNameInput) m_profileNameInput->setText(name);
    if (m_profilePublicIdInput) m_profilePublicIdInput->setText(publicId);
    if (m_profileBioInput) m_profileBioInput->setPlainText(bio);
    if (m_profileAvatarLabel) {
        const auto avatar = circularPixmap(pixmapFromAvatarRef(m_currentUser.value("avatarDataUrl").toString()), 88);
        if (!avatar.isNull()) {
            m_profileAvatarLabel->setProperty("hasAvatar", true);
            m_profileAvatarLabel->setPixmap(avatar);
            m_profileAvatarLabel->setText({});
        } else {
            m_profileAvatarLabel->setProperty("hasAvatar", false);
            m_profileAvatarLabel->setPixmap({});
            m_profileAvatarLabel->setText(name.left(1).toUpper());
        }
        m_profileAvatarLabel->style()->unpolish(m_profileAvatarLabel);
        m_profileAvatarLabel->style()->polish(m_profileAvatarLabel);
    }
}

void MainWindow::closeProfilePage()
{
    if (m_profilePage) m_profilePage->hide();
    if (m_messageList) m_messageList->show();
    if (m_composerPanel) m_composerPanel->setVisible(canPostCurrentChat());
    updatePeerActionBar();
    if (m_chatList && m_chatList->currentItem()) {
        const auto *item = m_chatList->currentItem();
        const auto title = item->data(Qt::UserRole + 1).toString();
        const auto verified = item->data(Qt::UserRole + 4).toBool();
        const auto displayTitle = title.isEmpty() ? "Чат" : title;
        if (m_chatTitleLabel) m_chatTitleLabel->setText(verified ? QString("%1 ✓").arg(displayTitle) : displayTitle);
    }
    setStatusText(m_currentChatId.isEmpty() ? "Выберите чат" : "Готово");
}

void MainWindow::saveProfilePage()
{
    if (!m_apiClient || !m_profileNameInput || !m_profileBioInput || !m_profilePublicIdInput) return;
    setStatusText("Сохранение профиля...");
    m_apiClient->updateProfile(
        m_profileNameInput->text(),
        m_profileBioInput->toPlainText(),
        m_profilePublicIdInput->text(),
        m_profileAvatarDataUrl
    );
}

void MainWindow::selectProfileAvatar()
{
    const auto path = QFileDialog::getOpenFileName(
        this,
        "Выбрать фото профиля",
        {},
        "Images (*.png *.jpg *.jpeg *.webp)"
    );
    if (path.isEmpty()) return;

    const auto dataUrl = fileToDataUrl(path, {"image/jpeg", "image/png", "image/webp"}, 4 * 1024 * 1024);
    if (dataUrl.isEmpty()) {
        QMessageBox::warning(this, "Фото профиля", "Выберите PNG, JPG или WEBP до 4 МБ.");
        return;
    }
    m_profileAvatarDataUrl = dataUrl;
    if (m_profileAvatarLabel) {
        const auto avatar = circularPixmap(pixmapFromAvatarRef(dataUrl), 88);
        m_profileAvatarLabel->setProperty("hasAvatar", !avatar.isNull());
        m_profileAvatarLabel->setPixmap(avatar);
        m_profileAvatarLabel->setText({});
        m_profileAvatarLabel->style()->unpolish(m_profileAvatarLabel);
        m_profileAvatarLabel->style()->polish(m_profileAvatarLabel);
    }
}

void MainWindow::showDiscoveryDialog()
{
    if (!m_apiClient) return;
    m_apiClient->getUsers();
    m_apiClient->getDiscoverChats();

    QDialog dialog(this);
    dialog.setObjectName("UtilityDialog");
    dialog.setWindowTitle("Поиск");
    dialog.setMinimumSize(620, 560);
    auto *layout = new QVBoxLayout(&dialog);
    layout->setContentsMargins(22, 20, 22, 20);
    layout->setSpacing(10);

    auto *heading = new QLabel("Найти людей и группы", &dialog);
    heading->setObjectName("UtilityDialogHeading");
    auto *hint = new QLabel("Начните личный диалог или присоединитесь к публичной группе.", &dialog);
    hint->setObjectName("UtilityDialogHint");
    auto *search = new QLineEdit(&dialog);
    search->setObjectName("UtilityDialogInput");
    search->setPlaceholderText("Имя, @username или название группы");
    auto *results = new QListWidget(&dialog);
    results->setObjectName("UtilityResults");
    results->setSpacing(4);
    auto *actionButton = new QPushButton("Открыть", &dialog);
    actionButton->setObjectName("UtilityPrimaryButton");
    actionButton->setEnabled(false);
    auto *closeButton = new QPushButton("Закрыть", &dialog);
    closeButton->setObjectName("UtilitySecondaryButton");
    auto *buttons = new QHBoxLayout();
    buttons->addStretch(1);
    buttons->addWidget(closeButton);
    buttons->addWidget(actionButton);
    layout->addWidget(heading);
    layout->addWidget(hint);
    layout->addSpacing(4);
    layout->addWidget(search);
    layout->addWidget(results, 1);
    layout->addLayout(buttons);

    dialog.setStyleSheet(m_darkTheme ? QStringLiteral(R"(
        QDialog#UtilityDialog { background: #151a21; color: #f8fafc; }
        QLabel#UtilityDialogHeading { color: #f8fafc; font-size: 20px; font-weight: 800; }
        QLabel#UtilityDialogHint { color: #94a3b8; font-size: 13px; }
        QLineEdit#UtilityDialogInput {
            min-height: 42px; padding: 0 12px; color: #f8fafc; background: #0f172a;
            border: 1px solid #334155; border-radius: 8px; selection-background-color: #2563eb;
        }
        QLineEdit#UtilityDialogInput:focus { border-color: #3b82f6; }
        QListWidget#UtilityResults {
            color: #e5e7eb; background: #11161c; border: 1px solid #303741;
            border-radius: 8px; padding: 6px; outline: none;
        }
        QListWidget#UtilityResults::item { min-height: 40px; padding: 4px 10px; border-radius: 6px; }
        QListWidget#UtilityResults::item:selected { color: #ffffff; background: #2557a7; }
        QPushButton#UtilityPrimaryButton, QPushButton#UtilitySecondaryButton {
            min-height: 40px; padding: 0 18px; border-radius: 8px; font-weight: 700;
        }
        QPushButton#UtilityPrimaryButton { color: #ffffff; background: #2563eb; border: 1px solid #2563eb; }
        QPushButton#UtilityPrimaryButton:disabled { color: #64748b; background: #1e293b; border-color: #334155; }
        QPushButton#UtilitySecondaryButton { color: #cbd5e1; background: transparent; border: 1px solid #475569; }
    )") : QStringLiteral(R"(
        QDialog#UtilityDialog { background: #ffffff; color: #172033; }
        QLabel#UtilityDialogHeading { color: #172033; font-size: 20px; font-weight: 800; }
        QLabel#UtilityDialogHint { color: #64748b; font-size: 13px; }
        QLineEdit#UtilityDialogInput {
            min-height: 42px; padding: 0 12px; color: #172033; background: #f8fafc;
            border: 1px solid #cbd5e1; border-radius: 8px; selection-background-color: #2563eb;
        }
        QLineEdit#UtilityDialogInput:focus { border-color: #2563eb; }
        QListWidget#UtilityResults {
            color: #172033; background: #ffffff; border: 1px solid #dbe4ef;
            border-radius: 8px; padding: 6px; outline: none;
        }
        QListWidget#UtilityResults::item { min-height: 40px; padding: 4px 10px; border-radius: 6px; }
        QListWidget#UtilityResults::item:selected { color: #ffffff; background: #2563eb; }
        QPushButton#UtilityPrimaryButton, QPushButton#UtilitySecondaryButton {
            min-height: 40px; padding: 0 18px; border-radius: 8px; font-weight: 700;
        }
        QPushButton#UtilityPrimaryButton { color: #ffffff; background: #2563eb; border: 1px solid #2563eb; }
        QPushButton#UtilityPrimaryButton:disabled { color: #94a3b8; background: #e2e8f0; border-color: #e2e8f0; }
        QPushButton#UtilitySecondaryButton { color: #475569; background: #ffffff; border: 1px solid #cbd5e1; }
    )"));

    const auto rebuild = [this, results, search]() {
        results->clear();
        const auto filter = search->text().trimmed();
        for (const auto &value : m_users) {
            const auto user = value.toObject();
            const auto username = user.value("username").toString();
            if (username.isEmpty() || username.compare(m_currentUsername, Qt::CaseInsensitive) == 0) continue;
            const auto name = user.value("displayName").toString(username);
            const auto publicId = user.value("publicId").toString(username);
            const auto haystack = QString("%1 %2 %3").arg(name, username, publicId);
            if (!filter.isEmpty() && !haystack.contains(filter, Qt::CaseInsensitive)) continue;
            auto *item = new QListWidgetItem(QString("%1  @%2").arg(name, publicId), results);
            item->setData(Qt::UserRole, "user");
            item->setData(Qt::UserRole + 1, username);
            item->setData(Qt::UserRole + 2, name);
        }
        for (const auto &value : m_discoverChats) {
            const auto chat = value.toObject();
            const auto title = chat.value("title").toString();
            const auto description = chat.value("description").toString();
            if (!filter.isEmpty() && !QString("%1 %2").arg(title, description).contains(filter, Qt::CaseInsensitive)) continue;
            auto *item = new QListWidgetItem(QString("# %1%2").arg(title, description.isEmpty() ? QString() : QString(" — %1").arg(description)), results);
            item->setData(Qt::UserRole, "chat");
            item->setData(Qt::UserRole + 1, chat.value("id").toString());
            item->setData(Qt::UserRole + 2, title);
        }
        if (results->count() > 0) {
            results->setCurrentRow(0);
        } else {
            auto *empty = new QListWidgetItem(
                filter.isEmpty() ? "Нет доступных результатов" : "Ничего не найдено",
                results);
            empty->setFlags(Qt::NoItemFlags);
            empty->setTextAlignment(Qt::AlignCenter);
        }
    };
    rebuild();
    connect(search, &QLineEdit::textChanged, &dialog, rebuild);
    connect(closeButton, &QPushButton::clicked, &dialog, &QDialog::reject);
    connect(results, &QListWidget::currentItemChanged, &dialog, [actionButton](QListWidgetItem *item) {
        actionButton->setEnabled(item && item->flags().testFlag(Qt::ItemIsSelectable));
        actionButton->setText(item && item->data(Qt::UserRole).toString() == "chat" ? "Вступить" : "Открыть чат");
    });

    auto *refreshTimer = new QTimer(&dialog);
    refreshTimer->setInterval(750);
    refreshTimer->setProperty("attempt", 0);
    connect(refreshTimer, &QTimer::timeout, &dialog, [refreshTimer, rebuild]() {
        rebuild();
        const int attempt = refreshTimer->property("attempt").toInt() + 1;
        refreshTimer->setProperty("attempt", attempt);
        if (attempt >= 4) refreshTimer->stop();
    });
    refreshTimer->start();

    const auto activate = [this, results, &dialog]() {
        auto *item = results->currentItem();
        if (!item || !m_apiClient) return;
        if (item->data(Qt::UserRole).toString() == "chat") {
            const auto chatId = item->data(Qt::UserRole + 1).toString();
            if (!chatId.isEmpty()) m_apiClient->joinChat(chatId);
        } else {
            const auto username = item->data(Qt::UserRole + 1).toString();
            const auto title = item->data(Qt::UserRole + 2).toString();
            QStringList users{m_currentUsername, username};
            users.sort(Qt::CaseInsensitive);
            m_currentChatId = users.join("|");
            m_currentPeerUsername = username;
            m_scrollToBottomOnNextMessages = true;
            m_renderedMessagesFingerprint.clear();
            m_renderedMessagesChatId.clear();
            if (m_chatTitleLabel) m_chatTitleLabel->setText(title);
            m_apiClient->getMessages(m_currentChatId);
            m_apiClient->getDialogs();
            updatePeerActionBar();
        }
        dialog.accept();
    };
    connect(actionButton, &QPushButton::clicked, &dialog, activate);
    connect(results, &QListWidget::itemDoubleClicked, &dialog, [activate](QListWidgetItem *) { activate(); });
    dialog.exec();
}

void MainWindow::showContactsDialog(const QJsonDocument &body)
{
    const auto obj = body.object();
    QDialog dialog(this);
    dialog.setObjectName("ContactsDialog");
    dialog.setWindowTitle("Друзья и контакты");
    dialog.setMinimumSize(680, 520);

    auto *layout = new QVBoxLayout(&dialog);
    layout->setContentsMargins(18, 18, 18, 18);
    auto *tabs = new QTabWidget(&dialog);
    layout->addWidget(tabs, 1);

    const auto openDirect = [this, &dialog](const QJsonObject &user) {
        const auto username = user.value("username").toString();
        if (username.isEmpty()) return;
        QStringList users{m_currentUsername, username};
        users.sort(Qt::CaseInsensitive);
        m_currentChatId = users.join("|");
        m_currentPeerUsername = username;
        m_scrollToBottomOnNextMessages = true;
        m_renderedMessagesFingerprint.clear();
        m_renderedMessagesChatId.clear();
        if (m_chatTitleLabel) m_chatTitleLabel->setText(user.value("displayName").toString(username));
        if (m_apiClient) {
            m_apiClient->getMessages(m_currentChatId);
            m_apiClient->getDialogs();
        }
        updatePeerActionBar();
        dialog.accept();
    };

    auto addTab = [&](const QString &title, const QJsonArray &items, const QString &mode) {
        auto *page = new QWidget(tabs);
        auto *pageLayout = new QVBoxLayout(page);
        pageLayout->setContentsMargins(10, 14, 10, 14);
        pageLayout->setSpacing(8);
        if (items.isEmpty()) {
            auto *empty = new QLabel("Здесь пока пусто", page);
            empty->setObjectName("MutedText");
            empty->setAlignment(Qt::AlignCenter);
            pageLayout->addWidget(empty, 1);
        }
        for (const auto &value : items) {
            const auto user = value.toObject();
            const auto username = user.value("username").toString();
            const auto display = user.value("displayName").toString(username);
            const auto handle = user.value("publicId").toString(username);
            auto *row = new QWidget(page);
            row->setObjectName("ProfileCard");
            auto *rowLayout = new QHBoxLayout(row);
            rowLayout->setContentsMargins(12, 10, 12, 10);
            auto *avatar = new QLabel(row);
            avatar->setFixedSize(42, 42);
            auto pixmap = circularPixmap(pixmapFromAvatarRef(user.value("avatarDataUrl").toString()), 42);
            if (pixmap.isNull()) pixmap = letterAvatarPixmap(display, 42, false);
            avatar->setPixmap(pixmap);
            auto *copy = new QLabel(QString("%1\n@%2").arg(display, handle), row);
            copy->setTextFormat(Qt::PlainText);
            rowLayout->addWidget(avatar);
            rowLayout->addWidget(copy, 1);

            const auto addAction = [&](const QString &label, const QString &endpoint) {
                auto *button = new QPushButton(label, row);
                button->setObjectName("SecondaryButton");
                connect(button, &QPushButton::clicked, &dialog, [this, endpoint, username, &dialog]() {
                    if (m_apiClient) m_apiClient->contactAction(endpoint, username);
                    dialog.accept();
                });
                rowLayout->addWidget(button);
            };
            if (mode == "incoming") {
                addAction("Отклонить", "/api/contacts/decline");
                addAction("Принять", "/api/contacts/accept");
            } else if (mode == "outgoing") {
                addAction("Отменить", "/api/contacts/cancel");
            } else if (mode == "blocked") {
                addAction("Разблокировать", "/api/contacts/unblock");
            } else {
                auto *message = new QPushButton("Написать", row);
                message->setObjectName("PrimaryButton");
                connect(message, &QPushButton::clicked, &dialog, [openDirect, user]() { openDirect(user); });
                rowLayout->addWidget(message);
            }
            pageLayout->addWidget(row);
        }
        pageLayout->addStretch(1);
        tabs->addTab(page, QString("%1 (%2)").arg(title).arg(items.size()));
    };

    addTab("Друзья", obj.value("friends").toArray(), "friends");
    addTab("Входящие", obj.value("requestsIn").toArray(), "incoming");
    addTab("Исходящие", obj.value("requestsOut").toArray(), "outgoing");
    addTab("Блокировки", obj.value("blocked").toArray(), "blocked");

    auto *close = new QPushButton("Закрыть", &dialog);
    close->setObjectName("SecondaryButton");
    layout->addWidget(close, 0, Qt::AlignRight);
    connect(close, &QPushButton::clicked, &dialog, &QDialog::reject);
    if (m_darkTheme) {
        dialog.setStyleSheet(R"(
            QDialog#ContactsDialog { background: #151a21; color: #f8fafc; }
            QTabWidget::pane { background: #11161c; border: 1px solid #303741; border-radius: 8px; }
            QTabBar::tab {
                color: #94a3b8; background: #1b2027; border: 1px solid #303741;
                padding: 9px 13px; margin-right: 2px;
            }
            QTabBar::tab:selected { color: #ffffff; background: #2557a7; border-color: #3b82f6; }
            QWidget#ProfileCard { background: #1b2027; border: 1px solid #303741; border-radius: 8px; }
            QWidget#ProfileCard QLabel { color: #e5e7eb; background: transparent; }
            QPushButton#PrimaryButton { color: #ffffff; background: #2563eb; border: 1px solid #2563eb; }
            QPushButton#SecondaryButton { color: #cbd5e1; background: #1e293b; border: 1px solid #475569; }
        )");
    }
    dialog.exec();
}

void MainWindow::showNotReady(const QString &title)
{
    setStatusText(QString("%1: будет подключено в следующем проходе").arg(title));
}

void MainWindow::openSelectedChat()
{
    if (!m_apiClient || !m_chatList) return;
    auto *item = m_chatList->currentItem();
    if (!item) return;
    const auto chatId = item->data(Qt::UserRole).toString();
    if (chatId.isEmpty()) return;
    if (chatId != m_currentChatId) {
        clearReplyToMessage();
        m_scrollToBottomOnNextMessages = true;
        m_renderedMessagesFingerprint.clear();
        m_renderedMessagesChatId.clear();
    }
    if (m_stack && m_stack->currentWidget() != m_messengerPage) {
        m_stack->setCurrentWidget(m_messengerPage);
    }
    if (m_profilePage && m_profilePage->isVisible()) {
        m_profilePage->hide();
        if (m_messageList) m_messageList->show();
        if (m_composerPanel) m_composerPanel->show();
    }
    const auto title = item->data(Qt::UserRole + 1).toString();
    const auto peer = item->data(Qt::UserRole + 2).toString();
    const auto verified = item->data(Qt::UserRole + 4).toBool();
    m_chatNotifyMuted = m_sessionStore && m_sessionStore->isChatMuted(chatId);
    if (m_peerNotifyButton) {
        m_peerNotifyButton->setIcon(makeUiIcon(m_chatNotifyMuted ? UiIcon::BellOff : UiIcon::Bell));
    }
    if (chatId == m_currentChatId) {
        m_currentPeerUsername = peer.isEmpty() && isDirectChatId(chatId) ? peerFromDirectChatId(chatId, m_currentUsername) : peer;
        if (m_chatTitleLabel) {
            const auto displayTitle = title.isEmpty() ? "Чат" : title;
            m_chatTitleLabel->setText(verified ? QString("%1 ✓").arg(displayTitle) : displayTitle);
        }
        updatePeerActionBar();
        if (m_composerPanel) m_composerPanel->setVisible(canPostCurrentChat());
        if (m_messageList && m_messageList->count() > 0) {
            refreshChatStatusText();
        }
        if (m_messageList && m_messageList->count() == 0) {
            m_apiClient->getMessages(m_currentChatId);
        }
        return;
    }
    m_currentChatId = chatId;
    m_currentPeerUsername = peer;
    if (m_currentPeerUsername.isEmpty() && isDirectChatId(chatId)) {
        m_currentPeerUsername = peerFromDirectChatId(chatId, m_currentUsername);
    }
    if (m_chatTitleLabel) {
        const auto displayTitle = title.isEmpty() ? "Чат" : title;
        m_chatTitleLabel->setText(verified ? QString("%1 ✓").arg(displayTitle) : displayTitle);
    }
    updatePeerActionBar();
    if (m_composerPanel) m_composerPanel->setVisible(canPostCurrentChat());
    setStatusText("Загрузка сообщений...");
    m_apiClient->getMessages(m_currentChatId);
    markCurrentChatRead();
}

QString MainWindow::currentPeerStatus() const
{
    if (m_currentPeerUsername.isEmpty()) return "none";
    const auto containsPeer = [this](const QJsonArray &items) {
        for (const auto &value : items) {
            const auto user = value.toObject();
            if (user.value("username").toString().compare(m_currentPeerUsername, Qt::CaseInsensitive) == 0) {
                return true;
            }
        }
        return false;
    };
    if (containsPeer(m_contacts.value("blocked").toArray())) return "blocked";
    if (containsPeer(m_contacts.value("friends").toArray())) return "friend";
    if (containsPeer(m_contacts.value("requestsIn").toArray())) return "incoming";
    if (containsPeer(m_contacts.value("requestsOut").toArray())) return "outgoing";
    return "none";
}

void MainWindow::updatePeerActionBar()
{
    if (!m_peerActionBar) return;
    const auto isSystemPeer = m_currentPeerUsername.compare("golos_aton", Qt::CaseInsensitive) == 0
                              || m_currentChatId.contains("golos_aton", Qt::CaseInsensitive);
    const auto direct = isDirectChatId(m_currentChatId) && !m_currentPeerUsername.isEmpty() && !isSystemPeer;
    m_peerActionBar->setVisible(direct);
    if (!direct) return;

    const auto status = currentPeerStatus();
    if (m_peerBlockButton) {
        m_peerBlockButton->setText(status == "blocked" ? "Разблокировать" : "Заблокировать");
    }
    if (m_peerFriendButton) {
        QString text = "Добавить в друзья";
        if (status == "friend") text = "В друзьях";
        else if (status == "incoming") text = "Принять заявку";
        else if (status == "outgoing") text = "Отменить заявку";
        else if (status == "blocked") text = "Заблокирован";
        m_peerFriendButton->setText(text);
        m_peerFriendButton->setEnabled(status != "friend" && status != "blocked");
    }
}

void MainWindow::renameCurrentPeer()
{
    if (!m_apiClient || m_currentPeerUsername.isEmpty()) return;
    const auto currentName = m_chatTitleLabel ? m_chatTitleLabel->text().remove(" ✓").trimmed() : QString();
    bool ok = false;
    const auto alias = QInputDialog::getText(
        this,
        "Переименовать контакт",
        "Как показывать в чатах",
        QLineEdit::Normal,
        currentName,
        &ok
    );
    if (!ok) return;
    m_apiClient->updatePeerAlias(m_currentPeerUsername, alias);
    setStatusText("Сохранение имени контакта...");
}

void MainWindow::showCreateChatDialog()
{
    if (!m_apiClient || !m_sessionStore || !m_sessionStore->hasToken()) {
        setStatusText("Сначала войдите в аккаунт");
        return;
    }

    QDialog dialog(this);
    dialog.setObjectName("CreateChatDialog");
    dialog.setWindowTitle("Новый чат");
    dialog.setMinimumSize(700, 700);
    dialog.resize(720, 720);
    auto *layout = new QVBoxLayout(&dialog);
    layout->setContentsMargins(24, 18, 24, 18);
    layout->setSpacing(7);
    layout->setAlignment(Qt::AlignTop);

    auto *heading = new QLabel("Создать новый чат", &dialog);
    heading->setObjectName("DialogHeading");
    heading->setFixedHeight(32);
    auto *intro = new QLabel("Настройте пространство для общения или публикаций.", &dialog);
    intro->setObjectName("DialogHint");
    intro->setWordWrap(true);
    intro->setFixedHeight(36);

    auto *titleLabel = new QLabel("Название", &dialog);
    titleLabel->setObjectName("DialogFieldLabel");
    titleLabel->setFixedHeight(20);
    auto *titleInput = new QLineEdit(&dialog);
    titleInput->setObjectName("DialogInput");
    titleInput->setPlaceholderText("Например, Команда проекта");
    titleInput->setMaxLength(80);
    titleInput->setFixedHeight(44);
    titleInput->setMaximumWidth(500);

    auto *descriptionLabel = new QLabel("Описание (необязательно)", &dialog);
    descriptionLabel->setObjectName("DialogFieldLabel");
    descriptionLabel->setFixedHeight(20);
    auto *descriptionInput = new QTextEdit(&dialog);
    descriptionInput->setObjectName("DialogTextEdit");
    descriptionInput->setPlaceholderText("О чём этот чат?");
    descriptionInput->setAcceptRichText(false);
    descriptionInput->setFixedHeight(58);
    descriptionInput->setMaximumWidth(500);

    auto *typeLabel = new QLabel("Тип чата", &dialog);
    typeLabel->setObjectName("DialogFieldLabel");
    typeLabel->setFixedHeight(20);
    auto *typeRow = new QWidget(&dialog);
    typeRow->setFixedHeight(44);
    typeRow->setMaximumWidth(500);
    auto *typeLayout = new QHBoxLayout(typeRow);
    typeLayout->setContentsMargins(0, 0, 0, 0);
    typeLayout->setSpacing(8);
    typeLayout->setAlignment(Qt::AlignLeft);
    auto *groupButton = new QPushButton("Группа", typeRow);
    auto *channelButton = new QPushButton("Канал", typeRow);
    groupButton->setObjectName("ChoiceButton");
    channelButton->setObjectName("ChoiceButton");
    groupButton->setCheckable(true);
    channelButton->setCheckable(true);
    groupButton->setFixedWidth(196);
    channelButton->setFixedWidth(196);
    groupButton->setChecked(true);
    auto *typeGroup = new QButtonGroup(&dialog);
    typeGroup->setExclusive(true);
    typeGroup->addButton(groupButton);
    typeGroup->addButton(channelButton);
    typeLayout->addWidget(groupButton);
    typeLayout->addWidget(channelButton);
    auto *typeHint = new QLabel("Группа: все участники могут писать сообщения.", &dialog);
    typeHint->setObjectName("ChoiceHint");
    typeHint->setWordWrap(true);
    typeHint->setFixedHeight(36);
    QObject::connect(typeGroup, &QButtonGroup::buttonClicked, typeHint, [typeHint, channelButton]() {
        typeHint->setText(channelButton->isChecked()
            ? "Канал: публикации создаёт владелец, участники их читают."
            : "Группа: все участники могут писать сообщения.");
    });

    auto *visibilityLabel = new QLabel("Кто сможет найти чат", &dialog);
    visibilityLabel->setObjectName("DialogFieldLabel");
    visibilityLabel->setFixedHeight(20);
    auto *visibilityRow = new QWidget(&dialog);
    visibilityRow->setFixedHeight(44);
    visibilityRow->setMaximumWidth(500);
    auto *visibilityLayout = new QHBoxLayout(visibilityRow);
    visibilityLayout->setContentsMargins(0, 0, 0, 0);
    visibilityLayout->setSpacing(8);
    visibilityLayout->setAlignment(Qt::AlignLeft);
    auto *publicButton = new QPushButton("Публичный", visibilityRow);
    auto *privateButton = new QPushButton("Приватный", visibilityRow);
    publicButton->setObjectName("ChoiceButton");
    privateButton->setObjectName("ChoiceButton");
    publicButton->setCheckable(true);
    privateButton->setCheckable(true);
    publicButton->setFixedWidth(196);
    privateButton->setFixedWidth(196);
    privateButton->setChecked(true);
    auto *visibilityGroup = new QButtonGroup(&dialog);
    visibilityGroup->setExclusive(true);
    visibilityGroup->addButton(publicButton);
    visibilityGroup->addButton(privateButton);
    visibilityLayout->addWidget(publicButton);
    visibilityLayout->addWidget(privateButton);
    auto *visibilityHint = new QLabel("Приватный: присоединиться можно только по приглашению.", &dialog);
    visibilityHint->setObjectName("ChoiceHint");
    visibilityHint->setWordWrap(true);
    visibilityHint->setFixedHeight(36);
    QObject::connect(visibilityGroup, &QButtonGroup::buttonClicked, visibilityHint, [visibilityHint, publicButton]() {
        visibilityHint->setText(publicButton->isChecked()
            ? "Публичный: чат виден в поиске, к нему может присоединиться любой."
            : "Приватный: присоединиться можно только по приглашению.");
    });

    auto *buttons = new QDialogButtonBox(QDialogButtonBox::Cancel | QDialogButtonBox::Ok, &dialog);
    buttons->setMaximumWidth(500);
    buttons->button(QDialogButtonBox::Ok)->setText("Создать чат");
    buttons->button(QDialogButtonBox::Cancel)->setText("Отмена");
    buttons->button(QDialogButtonBox::Ok)->setObjectName("DialogPrimaryButton");
    buttons->button(QDialogButtonBox::Cancel)->setObjectName("DialogSecondaryButton");
    buttons->button(QDialogButtonBox::Ok)->setEnabled(false);
    QObject::connect(titleInput, &QLineEdit::textChanged, buttons->button(QDialogButtonBox::Ok),
                     [createButton = buttons->button(QDialogButtonBox::Ok)](const QString &text) {
                         createButton->setEnabled(!text.trimmed().isEmpty());
                     });

    layout->addWidget(heading);
    layout->addWidget(intro);
    layout->addSpacing(2);
    layout->addWidget(titleLabel);
    layout->addWidget(titleInput);
    layout->addWidget(descriptionLabel);
    layout->addWidget(descriptionInput);
    layout->addSpacing(2);
    layout->addWidget(typeLabel);
    layout->addWidget(typeRow);
    layout->addWidget(typeHint);
    layout->addSpacing(2);
    layout->addWidget(visibilityLabel);
    layout->addWidget(visibilityRow);
    layout->addWidget(visibilityHint);
    layout->addSpacing(4);
    layout->addWidget(buttons);

    const QString dialogStyle = m_darkTheme ? QStringLiteral(R"(
        QDialog#CreateChatDialog { background: #151a21; color: #f8fafc; }
        QLabel#DialogHeading { color: #f8fafc; font-size: 21px; font-weight: 800; }
        QLabel#DialogHint, QLabel#ChoiceHint { color: #94a3b8; font-size: 13px; }
        QLabel#DialogFieldLabel { color: #e2e8f0; font-size: 13px; font-weight: 700; }
        QLineEdit#DialogInput, QTextEdit#DialogTextEdit {
            min-height: 0;
            color: #f8fafc; background: #0f172a; border: 1px solid #334155;
            border-radius: 8px; padding: 6px 10px; selection-background-color: #2563eb;
        }
        QLineEdit#DialogInput:focus, QTextEdit#DialogTextEdit:focus { border-color: #3b82f6; }
        QPushButton#ChoiceButton {
            min-height: 36px; color: #cbd5e1; background: #1e293b;
            border: 1px solid #334155; border-radius: 8px; font-weight: 700;
        }
        QPushButton#ChoiceButton:hover { border-color: #64748b; }
        QPushButton#ChoiceButton:checked {
            color: #ffffff; background: #2563eb; border-color: #60a5fa;
        }
        QPushButton#DialogPrimaryButton, QPushButton#DialogSecondaryButton {
            min-height: 38px; padding: 0 18px; border-radius: 8px; font-weight: 700;
        }
        QPushButton#DialogPrimaryButton { color: #ffffff; background: #2563eb; border: 1px solid #2563eb; }
        QPushButton#DialogPrimaryButton:disabled { color: #64748b; background: #1e293b; border-color: #334155; }
        QPushButton#DialogSecondaryButton { color: #cbd5e1; background: transparent; border: 1px solid #475569; }
    )") : QStringLiteral(R"(
        QDialog#CreateChatDialog { background: #ffffff; color: #172033; }
        QLabel#DialogHeading { color: #172033; font-size: 21px; font-weight: 800; }
        QLabel#DialogHint, QLabel#ChoiceHint { color: #64748b; font-size: 13px; }
        QLabel#DialogFieldLabel { color: #334155; font-size: 13px; font-weight: 700; }
        QLineEdit#DialogInput, QTextEdit#DialogTextEdit {
            min-height: 0;
            color: #172033; background: #f8fafc; border: 1px solid #cbd5e1;
            border-radius: 8px; padding: 6px 10px; selection-background-color: #2563eb;
        }
        QLineEdit#DialogInput:focus, QTextEdit#DialogTextEdit:focus { border-color: #2563eb; }
        QPushButton#ChoiceButton {
            min-height: 36px; color: #475569; background: #f8fafc;
            border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 700;
        }
        QPushButton#ChoiceButton:hover { border-color: #94a3b8; }
        QPushButton#ChoiceButton:checked {
            color: #ffffff; background: #2563eb; border-color: #2563eb;
        }
        QPushButton#DialogPrimaryButton, QPushButton#DialogSecondaryButton {
            min-height: 38px; padding: 0 18px; border-radius: 8px; font-weight: 700;
        }
        QPushButton#DialogPrimaryButton { color: #ffffff; background: #2563eb; border: 1px solid #2563eb; }
        QPushButton#DialogPrimaryButton:disabled { color: #94a3b8; background: #e2e8f0; border-color: #e2e8f0; }
        QPushButton#DialogSecondaryButton { color: #475569; background: #ffffff; border: 1px solid #cbd5e1; }
    )");
    dialog.setStyleSheet(dialogStyle);
    titleInput->setFocus();

    QObject::connect(buttons, &QDialogButtonBox::rejected, &dialog, &QDialog::reject);
    QObject::connect(buttons, &QDialogButtonBox::accepted, &dialog, [&]() {
        const auto title = titleInput->text().trimmed();
        if (title.isEmpty()) {
            titleInput->setFocus();
            return;
        }
        const auto type = channelButton->isChecked() ? QString("channel") : QString("group");
        const auto visibility = privateButton->isChecked() ? QString("private") : QString("public");
        m_apiClient->createChat(title, type, visibility, descriptionInput->toPlainText());
        setStatusText("Создание чата...");
        dialog.accept();
    });
    dialog.exec();
}

bool MainWindow::canDeleteCurrentChat() const
{
    if (m_currentChatId.isEmpty() || isDirectChatId(m_currentChatId)) return false;
    if (m_currentUser.value("isSuperAdmin").toBool()) return true;

    const auto chat = currentGroupChatObject();
    if (chat.isEmpty()) return false;
    if (chat.value("owner").toString().compare(m_currentUsername, Qt::CaseInsensitive) == 0) return true;
    return chat.value("ownerId").toString() == m_currentUser.value("id").toString();
}

void MainWindow::deleteCurrentChat()
{
    if (!m_apiClient || !canDeleteCurrentChat()) {
        setStatusText("Удалить группу или канал может только владелец или суперадмин");
        return;
    }

    QString title = chatTitleForId(m_currentChatId);
    if (title.trimmed().isEmpty()) title = "этот чат";
    QMessageBox confirmation(this);
    confirmation.setObjectName("DeleteChatConfirmation");
    confirmation.setWindowTitle("Удалить группу или канал");
    confirmation.setIcon(QMessageBox::Warning);
    confirmation.setText(QString("Удалить «%1» и все сообщения без возможности восстановления?").arg(title));
    auto *deleteButton = confirmation.addButton("Удалить", QMessageBox::DestructiveRole);
    auto *cancelButton = confirmation.addButton("Отмена", QMessageBox::RejectRole);
    confirmation.setDefaultButton(qobject_cast<QPushButton *>(cancelButton));
    confirmation.setEscapeButton(cancelButton);
    confirmation.setStyleSheet(m_darkTheme ? QStringLiteral(R"(
        QMessageBox#DeleteChatConfirmation {
            background: #151a21;
        }
        QMessageBox#DeleteChatConfirmation QLabel {
            color: #f8fafc;
            background: transparent;
            min-width: 420px;
        }
        QMessageBox#DeleteChatConfirmation QPushButton {
            min-width: 96px;
            min-height: 38px;
            color: #e5e7eb;
            background: #1e293b;
            border: 1px solid #475569;
            border-radius: 8px;
        }
        QMessageBox#DeleteChatConfirmation QPushButton:hover {
            background: #334155;
        }
    )") : QStringLiteral(R"(
        QMessageBox#DeleteChatConfirmation {
            background: #ffffff;
        }
        QMessageBox#DeleteChatConfirmation QLabel {
            color: #172033;
            background: transparent;
            min-width: 420px;
        }
        QMessageBox#DeleteChatConfirmation QPushButton {
            min-width: 96px;
            min-height: 38px;
            color: #334155;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
        }
    )"));
    confirmation.exec();
    if (confirmation.clickedButton() != deleteButton) return;

    m_pendingChatDeleteEndpoint = QString("/api/chats/%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(m_currentChatId)));
    setStatusText("Удаление группы или канала...");
    m_apiClient->deleteChat(m_currentChatId);
}

void MainWindow::sendImageAttachment()
{
    if (!m_apiClient || m_currentChatId.isEmpty()) {
        setStatusText(trAuth(m_authLanguage, "selectChat"));
        return;
    }
    const auto path = QFileDialog::getOpenFileName(this, "Отправить изображение", {}, "Images (*.png *.jpg *.jpeg *.webp *.gif)");
    if (path.isEmpty()) return;

    const auto dataUrl = fileToDataUrl(path, {"image/jpeg", "image/png", "image/webp", "image/gif"}, 4 * 1024 * 1024);
    if (dataUrl.isEmpty()) {
        QMessageBox::warning(this, "Изображение", "Выберите PNG, JPG, WEBP или GIF до 4 МБ.");
        return;
    }
    const auto replyTo = m_replyToMessageId;
    clearReplyToMessage();
    setStatusText("Отправка изображения...");
    m_apiClient->sendImageMessage(m_currentChatId, dataUrl, replyTo);
}

void MainWindow::sendAudioAttachment()
{
    if (!m_apiClient || m_currentChatId.isEmpty()) {
        setStatusText(trAuth(m_authLanguage, "selectChat"));
        return;
    }
    const auto path = QFileDialog::getOpenFileName(this, "Отправить аудио", {}, "Audio (*.webm *.ogg *.mp3 *.mpeg *.wav *.m4a *.mp4)");
    if (path.isEmpty()) return;

    const auto dataUrl = fileToDataUrl(path, {"audio/webm", "audio/ogg", "audio/mpeg", "audio/mp3", "audio/wav", "audio/mp4"}, 6 * 1024 * 1024);
    if (dataUrl.isEmpty()) {
        QMessageBox::warning(this, "Аудио", "Выберите WEBM, OGG, MP3, WAV или MP4 до 6 МБ.");
        return;
    }
    const auto replyTo = m_replyToMessageId;
    clearReplyToMessage();
    setStatusText("Отправка аудио...");
    m_apiClient->sendAudioMessage(m_currentChatId, dataUrl, replyTo);
}

void MainWindow::startVoiceRecording()
{
    if (!m_apiClient || m_currentChatId.isEmpty()) {
        setStatusText(trAuth(m_authLanguage, "selectChat"));
        return;
    }
    if (m_voiceRecording) return;
    if (QMediaDevices::audioInputs().isEmpty()) {
        setStatusText(QString::fromUtf8("Микрофон не найден"));
        return;
    }

    if (!m_voiceCaptureSession) {
        m_voiceCaptureSession = new QMediaCaptureSession(this);
        m_voiceAudioInput = new QAudioInput(this);
        m_voiceRecorder = new QMediaRecorder(this);
        m_voiceCaptureSession->setAudioInput(m_voiceAudioInput);
        m_voiceCaptureSession->setRecorder(m_voiceRecorder);
        QMediaFormat format;
        format.setFileFormat(QMediaFormat::MPEG4);
        format.setAudioCodec(QMediaFormat::AudioCodec::AAC);
        m_voiceRecorder->setMediaFormat(format);
        m_voiceRecorder->setQuality(QMediaRecorder::NormalQuality);
        connect(m_voiceRecorder, &QMediaRecorder::errorOccurred, this,
                [this](QMediaRecorder::Error, const QString &errorString) {
                    m_voiceRecording = false;
                    if (m_micButton) {
                        m_micButton->setProperty("recording", false);
                        m_micButton->style()->unpolish(m_micButton);
                        m_micButton->style()->polish(m_micButton);
                    }
                    setStatusText(QString("Не удалось записать голос: %1").arg(errorString));
                });
    }

    const auto directory = QStandardPaths::writableLocation(QStandardPaths::TempLocation);
    QDir().mkpath(directory);
    m_voiceRecordingPath = QDir(directory).filePath(QString("aten-voice-%1.m4a").arg(QUuid::createUuid().toString(QUuid::WithoutBraces)));
    m_voiceRecorder->setOutputLocation(QUrl::fromLocalFile(m_voiceRecordingPath));
    m_voiceRecording = true;
    if (m_micButton) {
        m_micButton->setProperty("recording", true);
        m_micButton->style()->unpolish(m_micButton);
        m_micButton->style()->polish(m_micButton);
    }
    setStatusText("Запись голосового сообщения...");
    m_voiceRecorder->record();
    if (m_voiceRecorder->recorderState() == QMediaRecorder::StoppedState) {
        m_voiceRecording = false;
        if (m_micButton) {
            m_micButton->setProperty("recording", false);
            m_micButton->style()->unpolish(m_micButton);
            m_micButton->style()->polish(m_micButton);
        }
        setStatusText(QString::fromUtf8("Не удалось начать запись голоса"));
    }
}

void MainWindow::stopVoiceRecording()
{
    if (!m_voiceRecording || !m_voiceRecorder) return;
    m_voiceRecording = false;
    if (m_micButton) {
        m_micButton->setProperty("recording", false);
        m_micButton->style()->unpolish(m_micButton);
        m_micButton->style()->polish(m_micButton);
    }
    m_voiceRecorder->stop();
    QTimer::singleShot(900, this, &MainWindow::finishVoiceRecording);
}

void MainWindow::finishVoiceRecording()
{
    if (!m_voiceRecorder || m_voiceRecordingPath.isEmpty()) return;
    const auto path = std::exchange(m_voiceRecordingPath, {});
    if (m_voiceRecorder->duration() < 450) {
        QFile::remove(path);
        setStatusText("Удерживайте микрофон чуть дольше");
        return;
    }
    QString dataUrl;
    QFile recorded(path);
    if (recorded.open(QIODevice::ReadOnly)
        && recorded.size() > 0
        && recorded.size() <= 6 * 1024 * 1024) {
        dataUrl = QString("data:audio/mp4;base64,%1")
                      .arg(QString::fromLatin1(recorded.readAll().toBase64()));
    }
    recorded.close();
    QFile::remove(path);
    if (dataUrl.isEmpty()) {
        setStatusText("Голосовое сообщение не удалось подготовить");
        return;
    }
    const auto replyTo = m_replyToMessageId;
    clearReplyToMessage();
    setStatusText("Отправка голосового сообщения...");
    m_apiClient->sendAudioMessage(m_currentChatId, dataUrl, replyTo);
}

void MainWindow::setReplyToMessage(const QJsonObject &message)
{
    const auto id = message.value("id").toString();
    if (id.isEmpty()) return;
    m_replyToMessage = message;
    m_replyToMessageId = id;
    if (m_replyComposeAuthorLabel) {
        m_replyComposeAuthorLabel->setText(QString("Ответ на сообщение · %1").arg(messageReplyAuthorLabel(message, m_currentUsername)));
    }
    if (m_replyComposeTextLabel) {
        m_replyComposeTextLabel->setText(messageReplyExcerpt(message));
    }
    if (m_replyCompose) m_replyCompose->show();
    if (m_composer) m_composer->setFocus();
}

void MainWindow::clearReplyToMessage()
{
    m_replyToMessage = {};
    m_replyToMessageId.clear();
    if (m_replyComposeAuthorLabel) m_replyComposeAuthorLabel->clear();
    if (m_replyComposeTextLabel) m_replyComposeTextLabel->clear();
    if (m_replyCompose) m_replyCompose->hide();
}

void MainWindow::syncActiveChat()
{
    if (!m_apiClient || !m_sessionStore || !m_sessionStore->hasToken()) return;
    if (!m_stack || m_stack->currentWidget() != m_messengerPage) return;
    m_apiClient->getDialogs();
    if (!m_currentChatId.isEmpty() && (!m_profilePage || !m_profilePage->isVisible())) {
        m_apiClient->getMessages(m_currentChatId);
    }
}

void MainWindow::loadOlderMessagesForCurrentChat()
{
    if (!m_apiClient || m_currentChatId.isEmpty()) return;
    if (m_messagesHistoryComplete.contains(m_currentChatId) || m_messagesHistoryLoading.contains(m_currentChatId)) return;

    QString oldestIso;
    for (const auto &value : m_allMessages) {
        const auto msg = value.toObject();
        if (messageChatId(msg) != m_currentChatId) continue;
        const auto iso = messageTimeIso(msg);
        if (iso.isEmpty()) continue;
        if (oldestIso.isEmpty() || iso < oldestIso) oldestIso = iso;
    }
    if (oldestIso.isEmpty()) {
        m_messagesHistoryComplete.insert(m_currentChatId);
        return;
    }

    m_messagesHistoryLoading.insert(m_currentChatId);
    m_pendingOlderMessageRequests.insert(m_currentChatId);
    setStatusText("Загружаем ранние сообщения...");
    m_apiClient->getMessages(m_currentChatId, 20, oldestIso);
}

void MainWindow::requestMessagesBootstrap()
{
    if (!m_apiClient || !m_sessionStore || !m_sessionStore->hasToken()) return;
    if (m_messageBaselineReady || m_messagesAllRequested) return;
    m_messagesAllRequested = true;
    m_apiClient->getMessagesAll();
}

void MainWindow::sendComposerText()
{
    if (!m_apiClient || !m_composer) return;
    const auto text = m_composer->toPlainText().trimmed();
    if (m_currentChatId.isEmpty()) {
        setStatusText(trAuth(m_authLanguage, "selectChat"));
        return;
    }
    if (!canPostCurrentChat()) {
        setStatusText("В канале писать могут только владелец и администраторы");
        return;
    }
    if (text.isEmpty()) return;
    m_composer->clear();
    setStatusText(trAuth(m_authLanguage, "sending"));
    const auto replyTo = m_replyToMessageId;
    clearReplyToMessage();
    m_apiClient->sendTextMessage(m_currentChatId, text, replyTo);
}

bool MainWindow::eventFilter(QObject *watched, QEvent *event)
{
    if (watched == m_composer && event && event->type() == QEvent::KeyPress) {
        const auto *keyEvent = static_cast<QKeyEvent *>(event);
        if ((keyEvent->key() == Qt::Key_Return || keyEvent->key() == Qt::Key_Enter)
            && !(keyEvent->modifiers() & Qt::ShiftModifier)) {
            sendComposerText();
            return true;
        }
    }
    return QMainWindow::eventFilter(watched, event);
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

void MainWindow::applyDesktopTheme(bool dark)
{
    if (!dark) {
        setStyleSheet(Theme::styleSheet());
        return;
    }

    setStyleSheet(Theme::styleSheet() + R"(
        QMainWindow,
        #MessengerShell,
        #ChatContent,
        #GuestShell,
        #GuestMain,
        #AuthPanel {
            background: #0b1220;
        }
        QWidget {
            color: #e5e7eb;
        }
        #Sidebar,
        #ChatHeader,
        #PeerActionBar,
        #Composer,
        #ProfilePage,
        #ProfilePageContent,
        #GuestSidebar,
        #GuestTopbar {
            background: #0f172a;
            border-color: #263449;
        }
        #MessengerSplitter::handle {
            background: #263449;
        }
        #MutedText,
        #SidebarSectionLabel,
        #ChatRowSubtitle,
        #ChatRowPreview,
        #ChatRowTime,
        #MessageTime,
        #ProfileFieldLabel,
        #ProfileFooterLink,
        #MessageReplyText,
        #ReplyComposeText {
            color: #94a3b8;
        }
        #ChatSubtitle,
        #MessageReplyAuthor,
        #ReplyComposeAuthor {
            color: #34d399;
        }
        #ChatRowTitle,
        #ProfileHeroName,
        QLabel {
            color: #f8fafc;
            background: transparent;
        }
        #ProfileHeroStatus {
            color: #34d399;
        }
        #MessagePinnedBadge {
            background: #422006;
            border: 1px solid #b45309;
            border-radius: 10px;
            color: #fed7aa;
            font-size: 12px;
            font-weight: 800;
            padding: 3px 8px;
        }
        #MessageDateSeparatorWrap {
            background: transparent;
        }
        #MessageDateSeparatorLabel {
            border-radius: 13px;
            padding: 5px 12px;
            background: rgba(30, 41, 59, 0.88);
            border: 1px solid rgba(148, 163, 184, 0.18);
            color: #e5edf8;
            font-size: 13px;
            font-weight: 700;
        }
        QListWidget#ChatList,
        QListWidget#MessageList,
        QListWidget {
            background: #0b1220;
            border-color: #263449;
            color: #e5e7eb;
        }
        QListWidget#ChatList::item:selected,
        QListWidget::item:selected {
            background: #1e3a5f;
            color: #f8fafc;
            border-color: #3b82f6;
        }
        QLineEdit,
        QLineEdit#ChatSearch,
        QTextEdit#ComposerInput,
        QLineEdit#ProfileInput,
        QTextEdit#ProfileTextEdit,
        #ComposerBox,
        #AuthTabs {
            background: #111827;
            color: #f8fafc;
            border-color: #334155;
        }
        QLineEdit::placeholder {
            color: #94a3b8;
        }
        QLineEdit#ProfileInput:read-only {
            background: #111827;
            color: #cbd5e1;
            border-color: #334155;
        }
        #ProfileCard,
        #ReplyCompose {
            background: #111827;
            border-color: #334155;
        }
        #MessageBubbleOther {
            background: #172033;
            border-color: #334155;
            color: #f8fafc;
        }
        #MessageBubbleSelf {
            background: #064e3b;
            border-color: #10b981;
            color: #ecfdf5;
        }
        #MessageText,
        #MessageMediaFallback,
        #VoiceMessageLabel {
            color: inherit;
            background: transparent;
        }
        #LinkPreviewCard {
            background: rgba(15, 23, 42, 0.16);
            border: 1px solid rgba(96, 165, 250, 0.22);
            border-radius: 12px;
            margin-top: 6px;
        }
        #LinkPreviewSite {
            color: #93c5fd;
            font-size: 12px;
            font-weight: 700;
            background: transparent;
        }
        #LinkPreviewTitle {
            color: inherit;
            font-weight: 700;
            background: transparent;
        }
        #LinkPreviewDescription {
            color: rgba(226, 232, 240, 0.76);
            background: transparent;
        }
        #LinkPreviewImage {
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.22);
            border: 1px solid rgba(96, 165, 250, 0.18);
        }
        QPushButton#HeaderIconButton,
        QPushButton#PeerIconButton,
        QPushButton#RoundComposerButton,
        QPushButton#SmallPillButton,
        QPushButton#SidebarLogoutButton,
        QPushButton#SecondaryButton,
        QPushButton#UserPillButton,
        QPushButton {
            background: #172033;
            border-color: #334155;
            color: #93c5fd;
        }
        QPushButton#HeaderIconButton:hover,
        QPushButton#PeerIconButton:hover,
        QPushButton#RoundComposerButton:hover,
        QPushButton#SmallPillButton:hover,
        QPushButton#UserPillButton:hover,
        QPushButton:hover {
            background: #1e293b;
            border-color: #3b82f6;
        }
        QPushButton#PrimaryButton {
            background: #2563eb;
            border-color: #2563eb;
            color: #ffffff;
        }
        QPushButton#DangerButton,
        QPushButton#MessageDeleteButton {
            background: transparent;
            border-color: transparent;
            color: #b97878;
        }
        QPushButton#MessageActionButton,
        QPushButton#ReactionPill,
        QPushButton#VoicePlayButton {
            background: transparent;
            border-color: transparent;
            color: #8aa0bc;
        }
        QPushButton#MessageActionButtonActive,
        QPushButton#ReactionPillActive {
            background: rgba(59, 130, 246, 0.16);
            border-color: rgba(96, 165, 250, 0.28);
            color: #bfdbfe;
        }
        QScrollBar:vertical {
            background: #0f172a;
        }
        QScrollBar::handle:vertical {
            background: #475569;
        }
        QSlider#VoiceTrack::groove:horizontal {
            background: #334155;
        }
        QMainWindow,
        #MessengerShell,
        #ChatContent,
        QListWidget#MessageList {
            background: #141618;
        }
        #Sidebar,
        #ChatHeader,
        #Composer,
        #PeerActionBar {
            background: #1a1d20;
            border-color: #2b2f34;
        }
        QListWidget#ChatList {
            background: transparent;
        }
        QListWidget#ChatList::item:selected {
            background: #272d35;
            border-color: #3b4654;
        }
        QLineEdit#ChatSearch,
        #ComposerBox {
            background: #202327;
            border-color: #32373d;
        }
        QPushButton#HeaderIconButton,
        QPushButton#RoundComposerButton {
            background: transparent;
            border-color: transparent;
        }
        QPushButton#HeaderIconButton:hover,
        QPushButton#RoundComposerButton:hover {
            background: #282c31;
            border-color: #383e45;
        }
        QPushButton#SmallIconButton,
        QPushButton#SmallPillButton,
        QPushButton#UserPillButton,
        QPushButton#PeerIconButton,
        QPushButton#PeerActionButton {
            background: #202327;
            border-color: #343941;
            color: #d8dde6;
        }
        #MessageBubbleOther {
            background: #202327;
            border-color: #32373d;
            color: #f0f2f5;
        }
        #MessageBubbleSelf {
            background: #203757;
            border-color: #31527e;
            color: #f2f6fc;
        }
        #MessageText,
        #MessageBubbleSelf #MessageText,
        #VoiceMessageLabel {
            color: #e6eaf0;
        }
        #LinkPreviewCard {
            background: rgba(148, 163, 184, 0.10);
            border: 1px solid rgba(148, 163, 184, 0.22);
            border-radius: 12px;
            margin-top: 6px;
        }
        #LinkPreviewSite {
            color: #93c5fd;
            font-size: 12px;
            font-weight: 700;
            background: transparent;
        }
        #LinkPreviewTitle {
            color: #f2f6fc;
            font-weight: 700;
            background: transparent;
        }
        #LinkPreviewDescription {
            color: rgba(230, 234, 240, 0.72);
            background: transparent;
        }
        #LinkPreviewImage {
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.28);
            border: 1px solid rgba(148, 163, 184, 0.18);
        }
        QPushButton#MessageActionButton,
        QPushButton#MessageDeleteButton,
        QPushButton#VoicePlayButton {
            background: transparent;
            border-color: transparent;
        }
        QPushButton#MessageReplyButton {
            background: transparent;
            border-color: transparent;
            color: #8aa0bc;
        }
        QPushButton#MessageReplyButton:hover {
            background: rgba(148, 163, 184, 0.12);
            border-color: rgba(148, 163, 184, 0.18);
        }
        QPushButton#MessageReplyButton:pressed {
            background: rgba(59, 130, 246, 0.14);
            border-color: rgba(96, 165, 250, 0.24);
        }
        QMenu#ReactionMenu {
            background: #172033;
            border-color: #334155;
        }
        QMenu#ReactionMenu::item {
            color: #e5e7eb;
        }
        QMenu#ReactionMenu::item:selected {
            background: #243b5a;
            color: #ffffff;
        }
        QMenu#ReactionMenu::item:checked {
            background: #1d4ed8;
            color: #ffffff;
        }
        QPushButton#ReplyComposeCloseButton {
            background: #172033;
            border-color: #334155;
            color: #94a3b8;
        }
        QPushButton#ReplyComposeCloseButton:hover {
            background: #3f1d25;
            border-color: #7f1d1d;
            color: #fca5a5;
        }
        QPushButton#MessageActionButton:hover,
        QPushButton#VoicePlayButton:hover {
            background: rgba(148, 163, 184, 0.12);
            border-color: rgba(148, 163, 184, 0.18);
        }
        QPushButton#MessageDeleteButton:hover {
            background: rgba(239, 68, 68, 0.12);
            border-color: rgba(239, 68, 68, 0.22);
        }
        QScrollBar:vertical {
            background: #17191c;
        }
        QScrollBar::handle:vertical {
            background: #484e56;
        }
    )");
}

void MainWindow::refreshChatStatusText()
{
    if (!m_statusLabel) return;
    if (m_currentChatId.isEmpty()) {
        m_statusLabel->setText("Выберите чат");
        return;
    }
    if (m_currentPeerUsername.compare("golos_aton", Qt::CaseInsensitive) == 0
        || m_currentChatId.contains("golos_aton", Qt::CaseInsensitive)) {
        m_statusLabel->setText("Принцип, не служба");
        return;
    }
    if (m_currentChatId.startsWith("group:") || m_currentChatId.startsWith("channel:")) {
        if (m_currentChatId.startsWith("channel:") && !canPostCurrentChat()) {
            m_statusLabel->setText("Канал · писать могут владелец и администраторы");
        } else {
            m_statusLabel->setText(m_currentChatId.startsWith("channel:") ? "Канал" : "Групповой чат");
        }
        return;
    }
    if (isDirectChatId(m_currentChatId)) {
        if (currentPeerStatus() == "blocked") {
            m_statusLabel->setText("Заблокирован");
        } else {
            auto lastSeen = m_dialogPeerLastSeen.value(m_currentChatId);
            if (lastSeen.isEmpty() && !m_currentPeerUsername.isEmpty()) {
                lastSeen = m_peerLastSeenByUsername.value(m_currentPeerUsername.toLower());
            }
            const auto lastSeenText = formatPeerLastSeenText(lastSeen);
            const auto bio = m_currentPeerUsername.isEmpty()
                ? QString()
                : m_peerBioByUsername.value(m_currentPeerUsername.toLower()).simplified();
            m_statusLabel->setText(bio.isEmpty() ? lastSeenText : QString("%1 · %2").arg(bio, lastSeenText));
        }
        return;
    }
    m_statusLabel->setText("Чат");
}

void MainWindow::showMainWindow()
{
    showNormal();
    raise();
    activateWindow();
}

void MainWindow::showEvent(QShowEvent *event)
{
    QMainWindow::showEvent(event);
    if (!m_notifications) {
        return;
    }
    int totalUnread = 0;
    for (auto it = m_unreadByChat.cbegin(); it != m_unreadByChat.cend(); ++it) {
        totalUnread += it.value();
    }
    m_notifications->setUnreadCount(totalUnread);
}

void MainWindow::closeEvent(QCloseEvent *event)
{
    if (m_forceQuit) {
        QMainWindow::closeEvent(event);
        return;
    }
    const bool canBackground =
        m_sessionStore && m_sessionStore->hasToken() && m_notifications && m_notifications->isTrayActive();
    if (!canBackground) {
        m_forceQuit = true;
        QMainWindow::closeEvent(event);
        qApp->quit();
        return;
    }
    event->ignore();
    hide();
    m_notifications->showBackgroundHint();
}

void MainWindow::changeEvent(QEvent *event)
{
    QMainWindow::changeEvent(event);
    if (!event) {
        return;
    }
    if (event->type() == QEvent::WindowStateChange || event->type() == QEvent::ActivationChange) {
        if (isActiveWindow() && !isMinimized() && !m_currentChatId.isEmpty()) {
            markCurrentChatRead();
        }
    }
}

void MainWindow::markCurrentChatRead()
{
    if (m_currentChatId.isEmpty() || !m_sessionStore || !m_sessionStore->hasToken()) {
        return;
    }
    const auto now = QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs);
    m_sessionStore->setChatReadAt(m_currentChatId, now);
    m_unreadByChat[m_currentChatId] = 0;
    if (m_notifications) {
        int total = 0;
        for (auto it = m_unreadByChat.cbegin(); it != m_unreadByChat.cend(); ++it) {
            total += it.value();
        }
        m_notifications->setUnreadCount(total);
    }
    if (m_apiClient) {
        m_apiClient->markMessagesRead(m_currentChatId);
    }
}

QString MainWindow::messageTimeIso(const QJsonObject &msg) const
{
    return msg.value("createdAt").toString(msg.value("time").toString());
}

QString MainWindow::messageSender(const QJsonObject &msg) const
{
    return msg.value("from").toString(msg.value("senderUsername").toString());
}

QString MainWindow::messageChatId(const QJsonObject &msg) const
{
    auto chatId = msg.value("chatId").toString();
    if (!chatId.isEmpty()) {
        return chatId;
    }
    const auto from = messageSender(msg);
    const auto to = msg.value("to").toString(msg.value("recipientUsername").toString());
    if (from.isEmpty() || to.isEmpty()) {
        return {};
    }
    return directChatIdForUsers(from, to);
}

QString MainWindow::chatTitleForId(const QString &chatId) const
{
    if (m_dialogTitles.contains(chatId)) {
        return m_dialogTitles.value(chatId);
    }
    if (isDirectChatId(chatId)) {
        return peerFromDirectChatId(chatId, m_currentUsername);
    }
    return chatId;
}

bool MainWindow::shouldAlertForMessage(const QJsonObject &msg) const
{
    if (m_currentUsername.isEmpty()) {
        return false;
    }
    const auto chatId = messageChatId(msg);
    if (m_sessionStore && m_sessionStore->isChatMuted(chatId)) return false;
    const auto from = messageSender(msg);
    if (from.isEmpty() || from.compare(m_currentUsername, Qt::CaseInsensitive) == 0) {
        return false;
    }
    if (chatId.isEmpty()) {
        return false;
    }
    if (isActiveWindow() && !isMinimized() && chatId == m_currentChatId) {
        return false;
    }
    return true;
}

void MainWindow::processMessageSnapshot(const QJsonArray &messages, bool allowAlerts)
{
    QMap<QString, int> unreadByChat;
    QSet<QString> snapshotIds;
    int totalUnread = 0;

    for (const auto &value : messages) {
        const auto msg = value.toObject();
        const auto id = msg.value("id").toString();
        if (!id.isEmpty()) {
            snapshotIds.insert(id);
        }

        const auto chatId = messageChatId(msg);
        if (chatId.isEmpty()) {
            continue;
        }
        const auto from = messageSender(msg);
        if (from.isEmpty() || from.compare(m_currentUsername, Qt::CaseInsensitive) == 0) {
            continue;
        }

        const auto readAt = m_sessionStore ? m_sessionStore->chatReadAt(chatId) : QString();
        const auto msgTime = messageTimeIso(msg);
        if (!readAt.isEmpty() && !msgTime.isEmpty() && msgTime <= readAt) {
            continue;
        }
        unreadByChat[chatId] += 1;
        totalUnread += 1;
    }

    if (!m_messageBaselineReady) {
        m_knownMessageIds = snapshotIds;
        m_messageBaselineReady = true;
        m_unreadByChat = unreadByChat;
        if (m_notifications) {
            m_notifications->setUnreadCount(totalUnread);
        }
        return;
    }

    if (allowAlerts && m_notifications) {
        bool playedSound = false;
        for (const auto &value : messages) {
            const auto msg = value.toObject();
            const auto id = msg.value("id").toString();
            if (id.isEmpty() || m_knownMessageIds.contains(id)) {
                continue;
            }
            if (!shouldAlertForMessage(msg)) {
                continue;
            }
            const auto chatId = messageChatId(msg);
            const auto title = chatTitleForId(chatId);
            const auto from = messageSender(msg);
            QString senderTitle = msg.value("senderDisplayName").toString(from);
            QIcon senderIcon;
            const auto messageAvatar = pixmapFromAvatarRef(msg.value("senderAvatarDataUrl").toString());
            if (!messageAvatar.isNull()) senderIcon = QIcon(messageAvatar);
            for (const auto &userValue : m_users) {
                const auto user = userValue.toObject();
                if (user.value("username").toString().compare(from, Qt::CaseInsensitive) != 0) continue;
                if (senderTitle.isEmpty() || senderTitle == from) {
                    senderTitle = user.value("displayName").toString(from);
                }
                if (senderIcon.isNull()) {
                    const auto avatar = pixmapFromAvatarRef(user.value("avatarDataUrl").toString());
                    if (!avatar.isNull()) senderIcon = QIcon(avatar);
                }
                break;
            }
            if (senderIcon.isNull() && from.compare("golos_aton", Qt::CaseInsensitive) == 0) {
                const auto avatar = pixmapFromAvatarRef("/golos-aton-avatar.png");
                if (!avatar.isNull()) senderIcon = QIcon(avatar);
            }
            auto preview = messagePreview(msg);
            if (!title.isEmpty() && title.compare(senderTitle, Qt::CaseInsensitive) != 0) {
                preview = QString("%1: %2").arg(title, preview);
            }
            m_notifications->enqueueNotification(senderTitle, preview, chatId, senderIcon);
            if (!playedSound) {
                m_notifications->playMessageSound();
                playedSound = true;
            }
        }
    }

    m_knownMessageIds = snapshotIds;
    m_unreadByChat = unreadByChat;
    if (m_notifications) {
        m_notifications->setUnreadCount(totalUnread);
    }
}

} // namespace aten
