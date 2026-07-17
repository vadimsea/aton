import Foundation
import UIKit
import UserNotifications

@MainActor
final class PushManager {
    static let shared = PushManager()

    func requestPermissionIfUseful() async {
        do {
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            if settings.authorizationStatus == .notDetermined {
                let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
                if granted {
#if !SIDELOAD
                    UIApplication.shared.registerForRemoteNotifications()
#endif
                }
            } else if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
#if !SIDELOAD
                UIApplication.shared.registerForRemoteNotifications()
#endif
            }
        } catch {
            print("Push permission failed:", error.localizedDescription)
        }
    }
}
