#include "ui/Theme.h"

namespace aten {

QString Theme::styleSheet()
{
    return R"(
        QMainWindow {
            background: #f8fafc;
        }
        #GuestShell {
            background: #f8fafc;
        }
        #GuestSidebar {
            background: #f9fafb;
            border-right: 1px solid #dbe4ef;
        }
        #GuestMain {
            background: #ffffff;
        }
        #GuestTopbar {
            background: #ffffff;
            border-bottom: 1px solid #e5e7eb;
        }
        QWidget {
            color: #172033;
            font-family: "Inter", "Segoe UI", Arial, sans-serif;
            font-size: 14px;
        }
        #AtenLogo {
            border-radius: 19px;
            background: transparent;
        }
        #AtenHeroLogo {
            background: transparent;
        }
        #AuthPanel {
            background: transparent;
        }
        #AuthTabs {
            background: #eef4fb;
            border: 1px solid #d7e1ec;
            border-radius: 12px;
        }
        QPushButton#AuthTab,
        QPushButton#AuthTabActive {
            min-height: 40px;
            border-radius: 9px;
            border: 0;
            background: transparent;
            color: #64748b;
        }
        QPushButton#AuthTabActive {
            background: #ffffff;
            color: #2563eb;
            border: 1px solid #e2e8f0;
        }
        QPushButton#LinkButton {
            border: 0;
            background: transparent;
            color: #2563eb;
            padding: 0;
            min-height: 24px;
            text-align: left;
        }
        QPushButton#LangButton,
        QPushButton#LangButtonActive {
            min-width: 42px;
            max-width: 42px;
            min-height: 42px;
            max-height: 42px;
            border-radius: 21px;
            background: #ffffff;
            padding: 0;
        }
        QPushButton#LangButtonActive {
            background: #eaf2ff;
            border-color: #93c5fd;
        }
        #MutedText {
            color: #64748b;
        }
        #AuthFieldLabel {
            color: #334155;
            font-size: 12px;
            letter-spacing: 0.16em;
            padding-top: 10px;
        }
        #HeroEyebrow {
            color: #c46a00;
            font-size: 12px;
            letter-spacing: 0.18em;
            padding-top: 2px;
        }
        #HeroText {
            color: #64748b;
            font-size: 18px;
            line-height: 1.5;
            padding-top: 6px;
        }
        QPushButton#ThemeIconButton {
            border-radius: 14px;
            border: 1px solid #111827;
            background: #f1f5f9;
            color: #475569;
            font-size: 24px;
            padding: 0;
        }
        #Sidebar {
            background: #fbfcfe;
            border-right: 1px solid #dbe4ef;
        }
        #MessengerShell,
        #ChatContent {
            background: #ffffff;
        }
        #MessengerSplitter::handle {
            background: #e5e7eb;
            width: 1px;
        }
        #SidebarSectionLabel {
            color: #64748b;
            font-size: 12px;
            letter-spacing: 0.18em;
        }
        QPushButton#SmallPillButton {
            min-height: 30px;
            border-radius: 11px;
            background: #eef4ff;
            border: 1px solid #bfdbfe;
            color: #2563eb;
            padding: 0 12px;
            font-size: 13px;
        }
        QPushButton#SmallPillButton:disabled {
            background: #f8fafc;
            border-color: #dbe4ef;
            color: #94a3b8;
        }
        QLineEdit#ChatSearch {
            min-height: 34px;
            max-height: 34px;
            border-radius: 16px;
            font-size: 14px;
            padding: 0 12px;
        }
        QListWidget#ChatList {
            padding: 8px 0 0 0;
        }
        QListWidget#ChatList::item {
            min-height: 76px;
            padding: 0;
            border-radius: 10px;
        }
        QListWidget#ChatList::item:selected {
            background: #dfe7ff;
            border: 1px solid #a7c0ff;
        }
        #ChatRowWidget {
            background: transparent;
        }
        #ChatAvatarImage {
            background: transparent;
            border: 0;
        }
        #ChatAvatar {
            border-radius: 25px;
            background: #dbeafe;
            border: 1px solid #bfdbfe;
            color: #2563eb;
            font-size: 20px;
            font-weight: 800;
        }
        #VoiceAvatar {
            border-radius: 25px;
            background: qradialgradient(cx:0.45, cy:0.38, radius:0.85,
                stop:0 #fef3c7, stop:0.42 #f59e0b, stop:1 #111827);
            border: 2px solid #111827;
            color: #111827;
            font-size: 0px;
        }
        #ChatRowTitle {
            color: #172033;
            font-size: 16px;
            font-weight: 800;
        }
        #ChatRowSubtitle,
        #ChatRowPreview {
            color: #64748b;
            font-size: 13px;
        }
        #ChatRowTime {
            color: #64748b;
            font-size: 12px;
        }
        #SidebarFooter {
            border-top: 1px solid #e5e7eb;
        }
        #ProfileFooterLink {
            color: #64748b;
            font-size: 13px;
        }
        QPushButton#SidebarLogoutButton {
            min-height: 46px;
            border-radius: 9px;
            background: #eef4ff;
            border: 1px solid #bfdbfe;
            color: #2563eb;
        }
        #ChatHeader {
            background: #ffffff;
            border-bottom: 1px solid #dbe4ef;
        }
        #ChatHeader QLabel {
            background: transparent;
        }
        #ChatSubtitle {
            color: #10b981;
            font-size: 14px;
        }
        QPushButton#HeaderIconButton {
            min-height: 50px;
            max-height: 50px;
            border-radius: 12px;
            background: #f1f5f9;
            border: 1px solid #dbe4ef;
            color: #2563eb;
            font-size: 22px;
            padding: 0;
        }
        QPushButton#UserPillButton {
            min-height: 40px;
            border-radius: 20px;
            background: #f8fafc;
            border: 1px solid #dbe4ef;
            color: #172033;
            padding: 0 14px;
        }
        QPushButton#UserPillButton:hover {
            background: #eef4ff;
            border-color: #bfdbfe;
        }
        #PeerActionBar {
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        }
        #ProfilePage {
            background: #ffffff;
        }
        #ProfileCard {
            background: #f8fafc;
            border: 1px solid #dbe4ef;
            border-radius: 18px;
        }
        #ProfileAvatar {
            border-radius: 52px;
            background: #dbeafe;
            border: 1px solid #bfdbfe;
            color: #2563eb;
            font-size: 36px;
            font-weight: 800;
        }
        #ProfileHeroName {
            color: #0f172a;
            font-size: 32px;
            font-weight: 900;
        }
        #ProfileVerifiedPill {
            max-width: 260px;
            border-radius: 15px;
            padding: 6px 12px;
            background: #eaf2ff;
            border: 1px solid #bfdbfe;
            color: #2563eb;
            font-weight: 800;
        }
        #ProfileFieldLabel {
            color: #64748b;
            font-size: 12px;
            letter-spacing: 2px;
            font-weight: 700;
        }
        QLineEdit#ProfileInput,
        QTextEdit#ProfileTextEdit {
            background: #ffffff;
            border: 1px solid #d4dde8;
            border-radius: 13px;
            color: #172033;
            font-size: 17px;
            padding: 10px 14px;
        }
        QLineEdit#ProfileInput:read-only {
            color: #475569;
            background: #f8fafc;
        }
        QPushButton#SecondaryButton,
        QPushButton#DangerButton {
            min-height: 48px;
            border-radius: 13px;
            padding: 0 20px;
            font-size: 15px;
            font-weight: 800;
        }
        QPushButton#SecondaryButton {
            background: #eef4ff;
            border: 1px solid #bfdbfe;
            color: #2563eb;
        }
        QPushButton#DangerButton {
            background: #fff1f2;
            border: 1px solid #fecdd3;
            color: #dc2626;
        }
        QPushButton#PeerActionButton {
            min-height: 30px;
            padding: 0 16px;
            border-radius: 10px;
            background: #ffffff;
            border: 1px solid #dbe4ef;
            color: #172033;
            font-size: 13px;
        }
        QPushButton#PeerActionButton:hover,
        QPushButton#PeerIconButton:hover {
            background: #eef5ff;
            border-color: #a9c7ff;
        }
        QPushButton#PeerActionButton:disabled {
            color: #64748b;
            background: transparent;
            border-color: transparent;
        }
        QPushButton#PeerIconButton {
            min-width: 48px;
            max-width: 48px;
            min-height: 48px;
            max-height: 48px;
            border-radius: 11px;
            background: #eef5ff;
            border: 1px solid #b7d0ff;
            color: #2563eb;
            font-size: 21px;
            padding: 0;
        }
        QListWidget#MessageList {
            background: #ffffff;
            padding: 12px 18px 10px 0;
        }
        QListWidget#MessageList::item {
            padding: 0;
            border: 0;
            background: transparent;
        }
        #MessageRow {
            background: transparent;
        }
        #MessageBubbleOther {
            background: #e8eef5;
            border: 1px solid #cfd8e3;
            border-radius: 10px;
            color: #001437;
            font-size: 16px;
        }
        #MessageBubbleSelf {
            background: #ccebbb;
            border: 1px solid #a4cf91;
            border-radius: 10px;
            color: #052e16;
            font-size: 16px;
        }
        #MessageText {
            background: transparent;
            color: inherit;
            font-size: 16px;
        }
        #MessageTime {
            background: transparent;
            color: #64748b;
            font-size: 12px;
        }
        #MessageReplyPreview {
            background: rgba(255, 255, 255, 0.55);
            border-left: 4px solid #60a5fa;
            border-radius: 8px;
        }
        #MessageReplyAuthor {
            background: transparent;
            color: #2563eb;
            font-size: 13px;
            font-weight: 800;
        }
        #MessageReplyText {
            background: transparent;
            color: #475569;
            font-size: 13px;
        }
        #ReactionPillsRow {
            background: transparent;
        }
        QPushButton#ReactionPill,
        QPushButton#ReactionPillActive {
            min-height: 25px;
            border-radius: 13px;
            padding: 2px 9px;
            font-size: 15px;
            font-weight: 700;
            text-align: center;
        }
        QPushButton#ReactionPill {
            background: rgba(255, 255, 255, 0.55);
            border: 1px solid rgba(148, 163, 184, 0.34);
            color: #172033;
        }
        QPushButton#ReactionPill:hover {
            background: #eef4ff;
            border-color: #93c5fd;
        }
        QPushButton#ReactionPillActive {
            background: #dbeafe;
            border: 1px solid #60a5fa;
            color: #1d4ed8;
        }
        #MessageActionsRow {
            background: transparent;
        }
        QPushButton#MessageActionButton,
        QPushButton#MessageActionButtonActive {
            min-width: 28px;
            max-width: 28px;
            min-height: 28px;
            max-height: 28px;
            border-radius: 14px;
            padding: 0;
            font-size: 15px;
        }
        QPushButton#MessageActionButton {
            background: rgba(255, 255, 255, 0.72);
            border: 1px solid rgba(148, 163, 184, 0.4);
            color: #2563eb;
        }
        QPushButton#MessageActionButtonActive {
            background: #dbeafe;
            border: 1px solid #60a5fa;
            color: #1d4ed8;
        }
        QPushButton#MessageActionButton:hover,
        QPushButton#MessageActionButtonActive:hover {
            background: #eef4ff;
            border-color: #93c5fd;
        }
        #MessageImage {
            background: transparent;
            border-radius: 10px;
        }
        QPushButton#MessageImageButton {
            background: transparent;
            border: 0;
            padding: 0;
            border-radius: 10px;
        }
        QPushButton#MessageImageButton:hover {
            border: 1px solid #93c5fd;
        }
        #MessageMediaFallback,
        #VoiceMessageLabel {
            background: transparent;
            color: inherit;
            font-size: 16px;
        }
        QPushButton#VoicePlayButton {
            min-width: 56px;
            max-width: 56px;
            min-height: 56px;
            max-height: 56px;
            border-radius: 28px;
            background: #ffffff;
            border: 1px solid #bfdbfe;
            color: #2563eb;
            padding: 0;
            font-size: 18px;
        }
        QPushButton#VoicePlayButton:hover {
            background: #eef4ff;
        }
        QSlider#VoiceTrack {
            min-height: 18px;
        }
        QSlider#VoiceTrack::groove:horizontal {
            height: 6px;
            border-radius: 3px;
            background: #cbd5e1;
        }
        QSlider#VoiceTrack::sub-page:horizontal {
            height: 6px;
            border-radius: 3px;
            background: #2563eb;
        }
        QSlider#VoiceTrack::handle:horizontal {
            width: 14px;
            height: 14px;
            margin: -4px 0;
            border-radius: 7px;
            background: #ffffff;
            border: 1px solid #93c5fd;
        }
        #Composer {
            background: #ffffff;
            border-top: 1px solid #dbe4ef;
        }
        #ReplyCompose {
            background: #f8fbff;
            border: 1px solid #dbeafe;
            border-radius: 14px;
        }
        #ReplyComposeAccent {
            background: #60a5fa;
            border-radius: 2px;
        }
        #ReplyComposeAuthor {
            color: #2563eb;
            font-size: 13px;
            font-weight: 800;
        }
        #ReplyComposeText {
            color: #475569;
            font-size: 13px;
        }
        QPushButton#ReplyComposeCloseButton {
            min-width: 32px;
            max-width: 32px;
            min-height: 32px;
            max-height: 32px;
            border-radius: 16px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            color: #475569;
            font-size: 18px;
            font-weight: 800;
            padding: 0;
        }
        QPushButton#ReplyComposeCloseButton:hover {
            background: #fee2e2;
            border-color: #fca5a5;
            color: #dc2626;
        }
        #ComposerBox {
            background: #ffffff;
            border: 1px solid #dbe4ef;
            border-radius: 30px;
        }
        QLineEdit#ComposerInput {
            min-height: 44px;
            border: 0;
            background: transparent;
            font-size: 16px;
            color: #172033;
        }
        QPushButton#RoundComposerButton {
            min-width: 50px;
            max-width: 50px;
            min-height: 50px;
            max-height: 50px;
            border-radius: 25px;
            background: #c7e8fb;
            border: 1px solid #93c5fd;
            color: #075985;
            padding: 0;
            font-size: 22px;
        }
        QPushButton#RoundComposerButton:disabled {
            background: #f1f5f9;
            border-color: #dbe4ef;
            color: #94a3b8;
        }
        QScrollBar:vertical {
            background: #f8fafc;
            width: 12px;
            margin: 0;
            border: 0;
        }
        QScrollBar::handle:vertical {
            background: #cbd5e1;
            min-height: 36px;
            border-radius: 6px;
        }
        QScrollBar::handle:vertical:hover {
            background: #94a3b8;
        }
        QScrollBar::add-line:vertical,
        QScrollBar::sub-line:vertical {
            height: 0;
            background: transparent;
            border: 0;
        }
        QScrollBar::add-page:vertical,
        QScrollBar::sub-page:vertical {
            background: transparent;
        }
        QListWidget {
            border: 0;
            background: transparent;
            outline: 0;
        }
        QListWidget::item {
            min-height: 56px;
            padding: 8px 10px;
            border-radius: 8px;
        }
        QListWidget::item:selected {
            background: #dfe8ff;
            color: #172033;
        }
        QLineEdit {
            min-height: 52px;
            padding: 0 12px;
            border: 1px solid #d4dde8;
            border-radius: 12px;
            background: #ffffff;
            font-size: 16px;
        }
        QPushButton {
            min-height: 36px;
            padding: 0 14px;
            border: 1px solid #c9d7ec;
            border-radius: 8px;
            background: #edf4ff;
            color: #2563eb;
            font-weight: 700;
        }
        QPushButton:disabled {
            background: #f8fafc;
            border-color: #dbe4ef;
            color: #94a3b8;
        }
        QPushButton#PrimaryButton {
            min-height: 58px;
            border-radius: 13px;
            background: #2563eb;
            border-color: #2563eb;
            color: #ffffff;
            font-size: 20px;
            box-shadow: 0 14px 28px rgba(37, 99, 235, 0.22);
        }
    )";
}

} // namespace aten
