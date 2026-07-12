import SwiftUI
import UIKit
import UserNotifications

@main
struct AtonApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var deepLinks = DeepLinkRouter()
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environmentObject(deepLinks)
                .preferredColorScheme(appState.theme.colorScheme)
                .onOpenURL { url in
                    deepLinks.handle(url)
                }
                .onChange(of: appState.currentUser?.id) { _ in
                    Task { await appDelegate.flushPendingDeviceToken() }
                }
                .task {
                    appDelegate.attach(appState: appState, deepLinks: deepLinks)
                    await appState.bootstrap()
                    await appDelegate.flushPendingDeviceToken()
                }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    private weak var appState: AppState?
    private weak var deepLinks: DeepLinkRouter?
    private var pendingDeviceToken: String?

    func attach(appState: AppState, deepLinks: DeepLinkRouter) {
        self.appState = appState
        self.deepLinks = deepLinks
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        pendingDeviceToken = token
        Task { await flushPendingDeviceToken() }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("APNs registration failed:", error.localizedDescription)
    }

    @MainActor
    func flushPendingDeviceToken() async {
        guard let token = pendingDeviceToken, let appState, appState.canRegisterPushToken else { return }
        await appState.registerPushToken(token)
        pendingDeviceToken = nil
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge, .list]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        if let messageId = userInfo["messageId"] as? String {
            await MainActor.run {
                deepLinks?.handle(URL(string: "aten://message/\(messageId)")!)
            }
            return
        }
        if let chatId = userInfo["chatId"] as? String {
            await MainActor.run {
                deepLinks?.handle(URL(string: "aten://chat/\(chatId)")!)
            }
        }
    }
}
