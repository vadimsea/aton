#pragma once

class QIcon;
class QWidget;

namespace aten {

QIcon appIconWithUnreadBadge(const QIcon &baseIcon, int unreadCount);
void applyUnreadBadgeToWindow(QWidget *window, const QIcon &baseIcon, int unreadCount);

} // namespace aten
