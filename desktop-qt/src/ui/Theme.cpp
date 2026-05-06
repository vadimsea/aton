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
        QWidget {
            color: #172033;
            font-family: "Inter", "Segoe UI", Arial, sans-serif;
            font-size: 14px;
        }
        #AtenLogo {
            border-radius: 19px;
            background: qradialgradient(cx:0.35, cy:0.3, radius:0.85,
                stop:0 #86efac, stop:0.34 #f59e0b, stop:0.68 #d97706, stop:1 #0ea5e9);
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
            min-height: 36px;
            border-radius: 18px;
            background: #ffffff;
        }
        QPushButton#LangButtonActive {
            background: #eaf2ff;
            border-color: #93c5fd;
        }
        #MutedText {
            color: #64748b;
        }
        #HeroText {
            color: #64748b;
            font-size: 17px;
            line-height: 1.45;
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
            min-height: 38px;
            padding: 0 12px;
            border: 1px solid #d4dde8;
            border-radius: 8px;
            background: #ffffff;
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
            background: #2563eb;
            border-color: #2563eb;
            color: #ffffff;
        }
    )";
}

} // namespace aten
