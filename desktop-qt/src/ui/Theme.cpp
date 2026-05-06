#include "ui/Theme.h"

namespace aten {

QString Theme::styleSheet()
{
    return R"(
        QMainWindow {
            background: #f8fafc;
        }
        QWidget {
            color: #172033;
            font-family: "Inter", "Segoe UI", Arial, sans-serif;
            font-size: 14px;
        }
        #AuthPanel {
            background: #ffffff;
            border: 1px solid #dbe4ef;
            border-radius: 14px;
        }
        #MutedText {
            color: #64748b;
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
