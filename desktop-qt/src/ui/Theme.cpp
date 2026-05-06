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
            background: #f9fafb;
            border-right: 1px solid #dbe4ef;
        }
        #ChatHeader {
            background: #ffffff;
            border-bottom: 1px solid #dbe4ef;
        }
        #Composer {
            background: #ffffff;
            border-top: 1px solid #dbe4ef;
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
        QPushButton#PrimaryButton {
            min-height: 60px;
            border-radius: 13px;
            background: #d97706;
            border-color: #d97706;
            color: #ffffff;
            font-size: 20px;
            box-shadow: 0 14px 28px rgba(217, 119, 6, 0.22);
        }
    )";
}

} // namespace aten
