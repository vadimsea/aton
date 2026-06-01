#include "ui/MainWindow.h"

#include <algorithm>
#include <functional>
#include <QGuiApplication>
#include <QApplication>
#include <QAudioOutput>
#include <QCoreApplication>
#include <QDateTime>
#include <QDialog>
#include <QDialogButtonBox>
#include <QDir>
#include <QFile>
#include <QFormLayout>
#include <QFontMetrics>
#include <QFrame>
#include <QHBoxLayout>
#include <QIcon>
#include <QInputDialog>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QListWidgetItem>
#include <QMap>
#include <QMediaPlayer>
#include <QMenu>
#include <QMessageBox>
#include <QPainter>
#include <QPainterPath>
#include <QPixmap>
#include <QPushButton>
#include <QSizePolicy>
#include <QSlider>
#include <QSplitter>
#include <QStandardPaths>
#include <QStackedWidget>
#include <QStatusBar>
#include <QStyle>
#include <QTextOption>
#include <QTextEdit>
#include <QTimer>
#include <QUrl>
#include <QUuid>
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
    QString peerUsername;
    QString avatarDataUrl;
    bool verified = false;
    bool system = false;
};

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
    const auto path = QDir(dir).filePath(QString("voice-%1.%2").arg(QUuid::createUuid().toString(QUuid::WithoutBraces), ext));
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

QPushButton *makeToolbarButton(const QString &text, QWidget *parent)
{
    auto *button = new QPushButton(text, parent);
    button->setObjectName("HeaderIconButton");
    button->setFixedSize(50, 50);
    button->setCursor(Qt::PointingHandCursor);
    return button;
}

int messageRowHeight(const QJsonObject &msg)
{
    const auto type = msg.value("type").toString("text");
    if (type == "image") return 320;
    if (type == "audio") return 142;
    const auto text = msg.value("text").toString().simplified();
    const auto lines = std::max(1, static_cast<int>(text.size() / 34 + 1));
    return std::clamp(78 + lines * 28, 96, 760);
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

QWidget *makeChatRowWidget(const ChatRow &row, QWidget *parent)
{
    auto *wrap = new QWidget(parent);
    wrap->setObjectName("ChatRowWidget");
    auto *layout = new QHBoxLayout(wrap);
    layout->setContentsMargins(8, 8, 10, 8);
    layout->setSpacing(12);

    auto *avatar = new QLabel(wrap);
    const bool voice = row.id.contains("golos_aton", Qt::CaseInsensitive) || row.system;
    avatar->setObjectName("ChatAvatarImage");
    avatar->setFixedSize(48, 48);
    avatar->setAlignment(Qt::AlignCenter);
    auto avatarSource = row.avatarDataUrl;
    if (voice && avatarSource.isEmpty()) {
        avatarSource = "/golos-aton-avatar.png";
    }
    auto avatarPixmap = circularPixmap(pixmapFromAvatarRef(avatarSource), 48);
    if (avatarPixmap.isNull()) {
        avatarPixmap = letterAvatarPixmap(row.title, 48, voice);
    }
    avatar->setPixmap(avatarPixmap);

    auto *copy = new QWidget(wrap);
    auto *copyLayout = new QVBoxLayout(copy);
    copyLayout->setContentsMargins(0, 0, 0, 0);
    copyLayout->setSpacing(2);
    auto *title = new QLabel(row.verified ? QString("%1 ✓").arg(row.title) : row.title, copy);
    title->setObjectName("ChatRowTitle");
    title->setTextFormat(Qt::PlainText);
    auto *subtitle = new QLabel(row.type == "private" ? "" : row.type, copy);
    subtitle->setObjectName("ChatRowSubtitle");
    subtitle->setTextFormat(Qt::PlainText);
    auto *preview = new QLabel(row.preview.isEmpty() ? "Нет сообщений" : row.preview, copy);
    preview->setObjectName("ChatRowPreview");
    preview->setTextFormat(Qt::PlainText);
    preview->setMaximumWidth(250);
    copyLayout->addWidget(title);
    copyLayout->addWidget(subtitle);
    copyLayout->addWidget(preview);

    auto *meta = new QLabel(compactTime(row.lastTime), wrap);
    meta->setObjectName("ChatRowTime");
    meta->setAlignment(Qt::AlignTop | Qt::AlignRight);
    meta->setMinimumWidth(44);

    layout->addWidget(avatar);
    layout->addWidget(copy, 1);
    layout->addWidget(meta);
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
    const QStringList preferred = {"👍", "❤️", "🔥", "😁", "😢", "👏", "🤯", "👎"};
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
    QWidget *parent)
{
    const auto from = msg.value("from").toString(msg.value("senderUsername").toString("user"));
    const auto type = msg.value("type").toString("text");
    const auto time = compactTime(msg.value("createdAt").toString(msg.value("time").toString()));

    const bool isSelf = !currentUsername.isEmpty() && from == currentUsername;
    auto *row = new QWidget(parent);
    row->setObjectName("MessageRow");
    auto *rowLayout = new QHBoxLayout(row);
    rowLayout->setContentsMargins(18, 8, 18, 8);
    rowLayout->setSpacing(0);

    auto *bubble = new QFrame(row);
    bubble->setObjectName(isSelf ? "MessageBubbleSelf" : "MessageBubbleOther");
    bubble->setMinimumWidth(type == "audio" ? 360 : 72);
    bubble->setMaximumWidth(type == "image" ? 390 : 430);
    auto *bubbleLayout = new QVBoxLayout(bubble);
    bubbleLayout->setContentsMargins(16, 12, 16, 12);
    bubbleLayout->setSpacing(8);

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
        voiceLayout->setContentsMargins(0, 6, 0, 6);
        voiceLayout->setSpacing(12);
        auto *playButton = new QPushButton(audioPath.isEmpty() ? "!" : "▶", voiceRow);
        playButton->setObjectName("VoicePlayButton");
        playButton->setFixedSize(56, 56);
        playButton->setEnabled(!audioPath.isEmpty());
        auto *track = new QSlider(Qt::Horizontal, voiceRow);
        track->setObjectName("VoiceTrack");
        track->setRange(0, 0);
        track->setEnabled(!audioPath.isEmpty());
        auto *label = new QLabel(audioPath.isEmpty() ? "Голосовое недоступно" : "0:00 / 0:00", voiceRow);
        label->setObjectName("VoiceMessageLabel");
        voiceLayout->addWidget(playButton);
        voiceLayout->addWidget(track, 1);
        voiceLayout->addWidget(label);
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
                playButton->setText(state == QMediaPlayer::PlayingState ? "Ⅱ" : "▶");
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
                    playButton->setText("▶");
                }
            });
        }
    } else {
        const auto textValue = type == "text" ? msg.value("text").toString() : QString("[%1]").arg(type);
        auto *label = new QLabel(textValue, bubble);
        label->setObjectName("MessageText");
        label->setWordWrap(true);
        label->setTextFormat(Qt::PlainText);
        const auto textWidth = messageTextWidth(textValue, label->font());
        label->setFixedWidth(textWidth);
        bubble->setFixedWidth(textWidth + 32);
        label->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::MinimumExpanding);
        bubbleLayout->addWidget(label);
    }

    if (!time.isEmpty()) {
        auto *timeLabel = new QLabel(time, bubble);
        timeLabel->setObjectName("MessageTime");
        timeLabel->setAlignment(Qt::AlignRight);
        bubbleLayout->addWidget(timeLabel);
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
    if (!messageId.isEmpty() && apiClient) {
        auto *actionsRow = new QWidget(bubble);
        actionsRow->setObjectName("MessageActionsRow");
        auto *actionsLayout = new QHBoxLayout(actionsRow);
        actionsLayout->setContentsMargins(0, 0, 0, 0);
        actionsLayout->setSpacing(6);
        actionsLayout->addStretch(1);
        const auto ownEmoji = ownReactionEmoji(reactions, currentUsername);
        auto *reactButton = new QPushButton(ownEmoji.isEmpty() ? "♡" : ownEmoji, actionsRow);
        reactButton->setObjectName(ownEmoji.isEmpty() ? "MessageActionButton" : "MessageActionButtonActive");
        reactButton->setCursor(Qt::PointingHandCursor);
        reactButton->setToolTip("Реакция");
        auto *menu = new QMenu(reactButton);
        const QStringList emojis = {"👍", "❤️", "🔥", "😁", "😢", "👏", "🤯", "👎"};
        for (const auto &emoji : emojis) {
            auto *action = menu->addAction(emoji);
            QObject::connect(action, &QAction::triggered, reactButton, [apiClient, messageId, emoji]() {
                apiClient->reactToMessage(messageId, emoji);
            });
        }
        reactButton->setMenu(menu);
        actionsLayout->addWidget(reactButton);
        auto *replyButton = new QPushButton("↩", actionsRow);
        replyButton->setObjectName("MessageActionButton");
        replyButton->setCursor(Qt::PointingHandCursor);
        replyButton->setToolTip("Ответить");
        QObject::connect(replyButton, &QPushButton::clicked, replyButton, [replyHandler, msg]() {
            if (replyHandler) replyHandler(msg);
        });
        actionsLayout->addWidget(replyButton);

        if (isSelf) {
            if (type == "text") {
                auto *editButton = new QPushButton("✎", actionsRow);
                editButton->setObjectName("MessageActionButton");
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

            auto *pinButton = new QPushButton(msg.value("pinned").toBool() ? "★" : "☆", actionsRow);
            pinButton->setObjectName(msg.value("pinned").toBool() ? "MessageActionButtonActive" : "MessageActionButton");
            pinButton->setCursor(Qt::PointingHandCursor);
            pinButton->setToolTip(msg.value("pinned").toBool() ? "Снять закрепление" : "Закрепить");
            QObject::connect(pinButton, &QPushButton::clicked, pinButton, [apiClient, messageId]() {
                apiClient->pinMessage(messageId);
            });
            actionsLayout->addWidget(pinButton);

            auto *deleteButton = new QPushButton("×", actionsRow);
            deleteButton->setObjectName("MessageDeleteButton");
            deleteButton->setCursor(Qt::PointingHandCursor);
            deleteButton->setToolTip("Удалить");
            QObject::connect(deleteButton, &QPushButton::clicked, deleteButton, [apiClient, messageId, deleteButton]() {
                const auto answer = QMessageBox::question(deleteButton, "Удалить сообщение", "Удалить это сообщение?");
                if (answer == QMessageBox::Yes) {
                    apiClient->deleteMessage(messageId);
                }
            });
            actionsLayout->addWidget(deleteButton);
        }
        bubbleLayout->addWidget(actionsRow);
    }

    if (isSelf) {
        rowLayout->addStretch(1);
        rowLayout->addWidget(bubble);
    } else {
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
    setStyleSheet(Theme::styleSheet());

    buildUi();
    wireApi();
    m_syncTimer = new QTimer(this);
    m_syncTimer->setInterval(30000);
    connect(m_syncTimer, &QTimer::timeout, this, &MainWindow::syncActiveChat);
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
    heroLogo->setPixmap(loadAtenLogoPixmap(300, true));
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
    page->setObjectName("MessengerShell");
    auto *rootLayout = new QHBoxLayout(page);
    rootLayout->setContentsMargins(0, 0, 0, 0);
    rootLayout->setSpacing(0);

    auto *splitter = new QSplitter(Qt::Horizontal, page);
    splitter->setObjectName("MessengerSplitter");
    splitter->setChildrenCollapsible(false);

    auto *sidebar = new QWidget(splitter);
    sidebar->setObjectName("Sidebar");
    sidebar->setMinimumWidth(360);
    sidebar->setMaximumWidth(400);
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
    newGroupButton->setEnabled(false);
    newGroupButton->setToolTip("Создание групп в desktop-клиенте ещё не подключено. Используйте веб-версию.");
    chatToolsLayout->addWidget(chatsLabel, 1);
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
    footerLayout->addWidget(m_accountLabel);
    footerLayout->addWidget(logoutButton);
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
    headerLayout->setContentsMargins(16, 8, 14, 8);
    headerLayout->setSpacing(12);
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
    auto *profileButton = makeToolbarButton("✎", header);
    profileButton->setToolTip("Редактировать профиль");
    connect(profileButton, &QPushButton::clicked, this, &MainWindow::showProfileDialog);
    auto *friendsButton = makeToolbarButton("👥", header);
    friendsButton->setToolTip("Друзья, заявки и блокировки");
    connect(friendsButton, &QPushButton::clicked, this, [this]() {
        if (!m_apiClient) return;
        m_contactsDialogRequested = true;
        setStatusText("Загрузка контактов...");
        m_apiClient->getContacts();
    });
    auto *themeButton = makeToolbarButton("☼", header);
    themeButton->setToolTip("Тема интерфейса");
    connect(themeButton, &QPushButton::clicked, this, [this]() { showNotReady("Переключение темы"); });
    auto *menuButton = makeToolbarButton("☰", header);
    menuButton->setToolTip("Меню");
    connect(menuButton, &QPushButton::clicked, this, [this]() { showNotReady("Меню desktop-клиента"); });
    auto *securityButton = makeToolbarButton("🛡", header);
    securityButton->setToolTip("Безопасность");
    connect(securityButton, &QPushButton::clicked, this, [this]() { showNotReady("Безопасность"); });
    headerLayout->addWidget(profileButton);
    headerLayout->addWidget(friendsButton);
    headerLayout->addWidget(themeButton);
    headerLayout->addWidget(menuButton);
    headerLayout->addWidget(securityButton);
    m_userPillButton = new QPushButton("●  Akhenaten ✓", header);
    m_userPillButton->setObjectName("UserPillButton");
    m_userPillButton->setCursor(Qt::PointingHandCursor);
    connect(m_userPillButton, &QPushButton::clicked, this, &MainWindow::showProfileDialog);
    connect(m_userPillButton, &QPushButton::clicked, this, [this]() {
        setStatusText("Профиль в desktop-клиенте будет добавлен отдельным экраном. Сейчас профиль редактируется в веб-версии.");
    });
    m_userPillButton->disconnect();
    connect(m_userPillButton, &QPushButton::clicked, this, &MainWindow::showProfileDialog);
    headerLayout->addWidget(m_userPillButton);
    contentLayout->addWidget(header);

    m_peerActionBar = new QWidget(content);
    m_peerActionBar->setObjectName("PeerActionBar");
    auto *peerActionLayout = new QHBoxLayout(m_peerActionBar);
    peerActionLayout->setContentsMargins(18, 8, 18, 8);
    peerActionLayout->setSpacing(10);
    m_peerRenameButton = new QPushButton("✎", m_peerActionBar);
    m_peerRenameButton->setObjectName("PeerIconButton");
    m_peerRenameButton->setToolTip("Переименовать контакт");
    m_peerBlockButton = new QPushButton("Заблокировать", m_peerActionBar);
    m_peerBlockButton->setObjectName("PeerActionButton");
    m_peerFriendButton = new QPushButton("Добавить в друзья", m_peerActionBar);
    m_peerFriendButton->setObjectName("PeerActionButton");
    m_peerNotifyButton = new QPushButton("🔔", m_peerActionBar);
    m_peerNotifyButton->setObjectName("PeerIconButton");
    m_peerNotifyButton->setToolTip("Уведомления");
    for (auto *button : {m_peerRenameButton, m_peerBlockButton, m_peerFriendButton, m_peerNotifyButton}) {
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
    connect(m_peerNotifyButton, &QPushButton::clicked, this, [this]() {
        setStatusText("Настройки уведомлений для чата будут синхронизированы с веб-версией отдельным проходом");
    });

    m_profilePage = new QWidget(content);
    m_profilePage->setObjectName("ProfilePage");
    auto *profileOuter = new QVBoxLayout(m_profilePage);
    profileOuter->setContentsMargins(72, 30, 72, 30);
    profileOuter->setSpacing(18);

    auto *profileHero = new QWidget(m_profilePage);
    profileHero->setObjectName("ProfileCard");
    auto *heroLayout = new QHBoxLayout(profileHero);
    heroLayout->setContentsMargins(28, 24, 28, 24);
    heroLayout->setSpacing(24);
    m_profileAvatarLabel = new QLabel(profileHero);
    m_profileAvatarLabel->setObjectName("ProfileAvatar");
    m_profileAvatarLabel->setFixedSize(104, 104);
    m_profileAvatarLabel->setAlignment(Qt::AlignCenter);
    auto *heroCopy = new QWidget(profileHero);
    auto *heroCopyLayout = new QVBoxLayout(heroCopy);
    heroCopyLayout->setContentsMargins(0, 0, 0, 0);
    heroCopyLayout->setSpacing(6);
    m_profileNameLabel = new QLabel("Akhenaten", heroCopy);
    m_profileNameLabel->setObjectName("ProfileHeroName");
    m_profilePublicIdLabel = new QLabel("@akhenaten", heroCopy);
    m_profilePublicIdLabel->setObjectName("MutedText");
    m_profileVerifiedLabel = new QLabel("Профиль верифицирован ✓", heroCopy);
    m_profileVerifiedLabel->setObjectName("ProfileVerifiedPill");
    heroCopyLayout->addWidget(m_profileNameLabel);
    heroCopyLayout->addWidget(m_profilePublicIdLabel);
    heroCopyLayout->addWidget(m_profileVerifiedLabel);
    heroCopyLayout->addStretch(1);
    heroLayout->addWidget(m_profileAvatarLabel);
    heroLayout->addWidget(heroCopy, 1);
    profileOuter->addWidget(profileHero);

    auto *profileForm = new QWidget(m_profilePage);
    profileForm->setObjectName("ProfileCard");
    auto *profileFormLayout = new QVBoxLayout(profileForm);
    profileFormLayout->setContentsMargins(28, 24, 28, 24);
    profileFormLayout->setSpacing(12);
    auto addProfileLabel = [&](const QString &text) {
        auto *label = new QLabel(text, profileForm);
        label->setObjectName("ProfileFieldLabel");
        profileFormLayout->addWidget(label);
    };
    addProfileLabel("EMAIL АККАУНТА");
    m_profileEmailInput = new QLineEdit(profileForm);
    m_profileEmailInput->setReadOnly(true);
    m_profileEmailInput->setObjectName("ProfileInput");
    profileFormLayout->addWidget(m_profileEmailInput);
    addProfileLabel("ОТОБРАЖАЕМОЕ ИМЯ");
    m_profileNameInput = new QLineEdit(profileForm);
    m_profileNameInput->setObjectName("ProfileInput");
    profileFormLayout->addWidget(m_profileNameInput);
    addProfileLabel("СТАТУС");
    m_profileBioInput = new QTextEdit(profileForm);
    m_profileBioInput->setObjectName("ProfileTextEdit");
    m_profileBioInput->setFixedHeight(96);
    profileFormLayout->addWidget(m_profileBioInput);
    addProfileLabel("ID ПРОФИЛЯ");
    m_profilePublicIdInput = new QLineEdit(profileForm);
    m_profilePublicIdInput->setObjectName("ProfileInput");
    profileFormLayout->addWidget(m_profilePublicIdInput);

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
    contentLayout->addWidget(m_messageList, 1);

    auto *composer = new QWidget(content);
    m_composerPanel = composer;
    composer->setObjectName("Composer");
    auto *composerOuter = new QVBoxLayout(composer);
    composerOuter->setContentsMargins(30, 12, 28, 14);
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
    composerLayout->setContentsMargins(24, 12, 8, 12);
    composerLayout->setSpacing(10);
    m_composer = new QLineEdit(composer);
    m_composer->setObjectName("ComposerInput");
    m_composer->setPlaceholderText("Текст — Enter. Голос — удерживайте кнопку с микрофоном, отпустите для отправки");
    auto *attachButton = new QPushButton("📎", composerBox);
    attachButton->setObjectName("RoundComposerButton");
    attachButton->setFixedSize(50, 50);
    attachButton->setEnabled(false);
    attachButton->setToolTip("Вложения в desktop-клиенте ещё не подключены.");
    auto *micButton = new QPushButton("🎙", composerBox);
    micButton->setObjectName("RoundComposerButton");
    micButton->setFixedSize(50, 50);
    micButton->setEnabled(false);
    micButton->setToolTip("Голосовые сообщения в desktop-клиенте ещё не подключены.");
    m_sendButton = new QPushButton("ОТПРАВИТЬ", composerBox);
    m_sendButton->setObjectName("PrimaryButton");
    composerLayout->addWidget(m_composer, 1);
    composerLayout->addWidget(attachButton);
    composerLayout->addWidget(micButton);
    composerLayout->addWidget(m_sendButton);
    composerOuter->addWidget(composerBox);
    contentLayout->addWidget(composer);
    connect(m_sendButton, &QPushButton::clicked, this, &MainWindow::sendComposerText);
    connect(m_composer, &QLineEdit::returnPressed, this, &MainWindow::sendComposerText);
    connect(m_replyComposeCloseButton, &QPushButton::clicked, this, &MainWindow::clearReplyToMessage);
    connect(m_chatSearch, &QLineEdit::textChanged, this, [this](const QString &text) {
        m_chatFilter = text.trimmed();
        renderSidebar();
    });

    splitter->addWidget(sidebar);
    splitter->addWidget(content);
    splitter->setSizes({398, 1100});
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
            if (m_syncTimer) m_syncTimer->stop();
            setStatusText("Signed out");
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
                m_userPillButton->setText(QString("●  %1 ✓").arg(name));
            }
            setStatusText(QString("Signed in as %1").arg(name));
            populateProfilePage();
            renderSidebar();
            return;
        }
        if (endpoint == "/api/profile") {
            m_currentUser = body.object();
            m_currentUsername = m_currentUser.value("username").toString(m_currentUsername);
            const auto name = m_currentUser.value("displayName").toString(m_currentUsername);
            if (m_accountLabel) m_accountLabel->setText(name);
            if (m_userPillButton) m_userPillButton->setText(QString("●  %1 ✓").arg(name));
            setStatusText("Профиль сохранён");
            return;
        }
        if (endpoint == "/api/contacts") {
            m_contacts = body.object();
            if (m_contactsDialogRequested) {
                m_contactsDialogRequested = false;
                showContactsDialog(body);
            }
            updatePeerActionBar();
            setStatusText("Контакты загружены");
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
            renderChats(body);
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
        if (endpoint.startsWith("/api/messages?chatId=")) {
            renderMessages(body);
            return;
        }
        if (endpoint == "/api/messages") {
            if (!m_currentChatId.isEmpty()) {
                m_apiClient->getMessages(m_currentChatId);
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
        setStatusText(QString("Loaded %1").arg(endpoint));
    });

    connect(m_apiClient, &ApiClient::requestFailed, this, [this](const QString &endpoint, const QString &message) {
        if (endpoint == "/api/dialogs") {
            if (m_chatList && m_chatList->count() == 0) {
                m_chatList->addItem("Не удалось загрузить диалоги");
            }
            setStatusText(QString("Не удалось загрузить диалоги: %1").arg(message));
            return;
        }
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
    if (m_syncTimer && !m_syncTimer->isActive()) m_syncTimer->start();
    m_apiClient->getMe();
    m_apiClient->getDialogs();
    m_apiClient->getContacts();
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

void MainWindow::renderDialogs(const QJsonDocument &body)
{
    if (!m_chatList) return;
    const auto previousChatId = m_currentChatId;
    m_chatList->clear();

    const auto dialogs = body.array();
    if (dialogs.isEmpty()) {
        m_chatList->addItem("Нет чатов");
        return;
    }

    int selectedRow = 0;
    int visibleRow = 0;
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
            dialog.value("verified").toBool(dialog.value("peerVerified").toBool()),
            dialog.value("isSystem").toBool(),
        };
        if (row.id.isEmpty()) continue;
        if (!m_chatFilter.isEmpty()) {
            const auto haystack = QString("%1 %2 %3").arg(row.title, row.type, row.preview);
            if (!haystack.contains(m_chatFilter, Qt::CaseInsensitive)) continue;
        }

        auto *item = new QListWidgetItem();
        item->setData(Qt::UserRole, row.id);
        item->setData(Qt::UserRole + 1, row.title);
        item->setData(Qt::UserRole + 2, row.peerUsername);
        item->setData(Qt::UserRole + 3, row.type);
        item->setData(Qt::UserRole + 4, row.verified);
        item->setData(Qt::UserRole + 5, row.system);
        item->setData(Qt::UserRole + 4, row.verified);
        item->setData(Qt::UserRole + 5, row.system);
        item->setSizeHint(QSize(340, 88));
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
                                 {},
                                 chat.value("avatarDataUrl").toString(),
                                 chat.value("verified").toBool(),
                                 false,
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
                row = ChatRow{chatId, title, "private", {}, {}, peer, {}, false, peer.compare("golos_aton", Qt::CaseInsensitive) == 0};
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
        item->setSizeHint(QSize(340, 88));
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
    }
}

void MainWindow::renderMessages(const QJsonDocument &body)
{
    if (!m_messageList) return;
    m_messageList->clear();
    const auto messages = body.array();
    if (messages.isEmpty()) {
        auto *item = new QListWidgetItem("Нет сообщений");
        item->setTextAlignment(Qt::AlignCenter);
        m_messageList->addItem(item);
        return;
    }
    for (const auto &value : messages) {
        const auto msg = value.toObject();
        auto *row = makeMessageRowWidget(
            msg,
            m_currentUsername,
            m_apiClient,
            messages,
            [this](const QJsonObject &message) { setReplyToMessage(message); },
            m_messageList);
        auto *item = new QListWidgetItem();
        row->ensurePolished();
        row->adjustSize();
        item->setSizeHint(QSize(900, std::max(messageRowHeight(msg), row->sizeHint().height() + 8)));
        m_messageList->addItem(item);
        m_messageList->setItemWidget(item, row);
    }
    m_messageList->scrollToBottom();
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

    const auto verified = m_currentUser.value("isVerified").toBool(m_currentUser.value("verified").toBool());
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
            m_apiClient->updateProfile(name->text(), bio->toPlainText(), publicId->text());
            setStatusText("Сохранение профиля...");
        }
        dialog.accept();
    });
    connect(buttons, &QDialogButtonBox::rejected, &dialog, &QDialog::reject);
    dialog.exec();
}

void MainWindow::populateProfilePage()
{
    if (m_currentUser.isEmpty()) return;
    const auto name = m_currentUser.value("displayName").toString(m_currentUsername);
    const auto publicId = m_currentUser.value("publicId").toString(m_currentUsername);
    const auto email = m_currentUser.value("email").toString();
    const auto bio = m_currentUser.value("bio").toString();
    const auto verified = m_currentUser.value("isVerified").toBool(m_currentUser.value("verified").toBool());

    if (m_profileNameLabel) m_profileNameLabel->setText(name);
    if (m_profilePublicIdLabel) m_profilePublicIdLabel->setText(QString("@%1").arg(publicId));
    if (m_profileVerifiedLabel) {
        m_profileVerifiedLabel->setText(verified ? "Профиль верифицирован ✓" : "Профиль не верифицирован");
    }
    if (m_profileEmailInput) m_profileEmailInput->setText(email);
    if (m_profileNameInput) m_profileNameInput->setText(name);
    if (m_profilePublicIdInput) m_profilePublicIdInput->setText(publicId);
    if (m_profileBioInput) m_profileBioInput->setPlainText(bio);
    if (m_profileAvatarLabel) {
        const auto avatar = circularPixmap(pixmapFromAvatarRef(m_currentUser.value("avatarDataUrl").toString()), 104);
        if (!avatar.isNull()) {
            m_profileAvatarLabel->setPixmap(avatar);
            m_profileAvatarLabel->setText({});
        } else {
            m_profileAvatarLabel->setPixmap({});
            m_profileAvatarLabel->setText(name.left(1).toUpper());
        }
    }
}

void MainWindow::closeProfilePage()
{
    if (m_profilePage) m_profilePage->hide();
    if (m_messageList) m_messageList->show();
    if (m_composerPanel) m_composerPanel->show();
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
    m_apiClient->updateProfile(m_profileNameInput->text(), m_profileBioInput->toPlainText(), m_profilePublicIdInput->text());
}

void MainWindow::showContactsDialog(const QJsonDocument &body)
{
    const auto obj = body.object();
    QDialog dialog(this);
    dialog.setWindowTitle("Друзья и контакты");
    dialog.setMinimumSize(520, 520);

    auto *layout = new QVBoxLayout(&dialog);
    auto addSection = [&](const QString &title, const QJsonArray &items) {
        auto *sectionTitle = new QLabel(QString("%1 (%2)").arg(title).arg(items.size()), &dialog);
        sectionTitle->setObjectName("SidebarSectionLabel");
        layout->addWidget(sectionTitle);

        if (items.isEmpty()) {
            auto *empty = new QLabel("Пусто", &dialog);
            empty->setObjectName("MutedText");
            layout->addWidget(empty);
            return;
        }

        for (const auto &value : items) {
            const auto user = value.toObject();
            const auto display = user.value("displayName").toString(user.value("username").toString());
            const auto handle = user.value("publicId").toString(user.value("username").toString());
            auto *row = new QLabel(QString("%1  @%2").arg(display, handle), &dialog);
            row->setTextFormat(Qt::PlainText);
            layout->addWidget(row);
        }
    };

    addSection("Входящие заявки", obj.value("requestsIn").toArray());
    addSection("Исходящие заявки", obj.value("requestsOut").toArray());
    addSection("Друзья", obj.value("friends").toArray());
    addSection("Заблокированные", obj.value("blocked").toArray());

    auto *buttons = new QDialogButtonBox(QDialogButtonBox::Close, &dialog);
    buttons->button(QDialogButtonBox::Close)->setText("Закрыть");
    layout->addWidget(buttons);
    connect(buttons, &QDialogButtonBox::rejected, &dialog, &QDialog::reject);
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
    if (chatId == m_currentChatId) {
        m_currentPeerUsername = peer.isEmpty() && isDirectChatId(chatId) ? peerFromDirectChatId(chatId, m_currentUsername) : peer;
        if (m_chatTitleLabel) {
            const auto displayTitle = title.isEmpty() ? "Чат" : title;
            m_chatTitleLabel->setText(verified ? QString("%1 ✓").arg(displayTitle) : displayTitle);
        }
        updatePeerActionBar();
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
    setStatusText("Загрузка сообщений...");
    m_apiClient->getMessages(m_currentChatId);
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
    const auto replyTo = m_replyToMessageId;
    clearReplyToMessage();
    m_apiClient->sendTextMessage(m_currentChatId, text, replyTo);
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
