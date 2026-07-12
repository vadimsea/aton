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
                    UIApplication.shared.registerForRemoteNotifications()
                }
            } else if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            print("Push permission failed:", error.localizedDescription)
        }
    }
}
