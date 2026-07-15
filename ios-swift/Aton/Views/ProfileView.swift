import PhotosUI
import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var app: AppState
    @State private var displayName = ""
    @State private var bio = ""
    @State private var publicId = ""
    @State private var avatarDataUrl: String?
    @State private var selectedPhoto: PhotosPickerItem?

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                hero
                accountCard
                preferencesCard
                safetyCard
            }
            .padding(18)
        }
        .background(AtonPalette.background.ignoresSafeArea())
        .navigationTitle("Профиль")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Сохранить") {
                    Task { await save() }
                }
                .fontWeight(.bold)
            }
        }
        .onAppear(perform: loadUser)
        .onChange(of: selectedPhoto) { item in
            Task { await loadPhoto(item) }
        }
    }

    private var hero: some View {
        VStack(spacing: 16) {
            HStack(alignment: .center, spacing: 16) {
                AvatarView(title: displayName.isEmpty ? "А" : displayName, imageDataUrl: avatarDataUrl, size: 92)

                VStack(alignment: .leading, spacing: 7) {
                    Text(displayName.isEmpty ? "Атон" : displayName)
                        .font(.system(size: 30, weight: .black, design: .rounded))
                    Text("@\(publicId.isEmpty ? app.currentUser?.username ?? "" : publicId)")
                        .foregroundStyle(.secondary)
                    if app.currentUser?.isVerified == true {
                        Label("Профиль верифицирован", systemImage: "checkmark.seal.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(AtonPalette.blue)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(AtonPalette.blue.opacity(0.14), in: Capsule())
                    }
                }
                Spacer()
            }

            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                Label("Изменить фото", systemImage: "camera.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(AtonSecondaryButtonStyle())
        }
        .padding(18)
        .background(AtonPalette.surface, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.10), lineWidth: 1)
        }
    }

    private var accountCard: some View {
        SettingsCard(title: "Данные аккаунта") {
            ProfileReadonlyRow(title: "Email аккаунта", value: app.currentUser?.email ?? "Не указан")
            AtonTextField(title: "Отображаемое имя", text: $displayName, keyboard: .default)
            AtonTextField(title: "Статус", text: $bio, keyboard: .default)
            AtonTextField(title: "ID профиля", text: $publicId, keyboard: .default)
            Text("ID нужен для поиска по @username. Используйте латиницу, цифры, дефис или подчёркивание.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var preferencesCard: some View {
        SettingsCard(title: "Внешний вид и язык") {
            VStack(alignment: .leading, spacing: 10) {
                Text("Язык интерфейса")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                LanguagePicker()
            }

            Picker("Тема", selection: $app.theme) {
                Text("Как в системе").tag(AtonTheme.system)
                Text("Светлая").tag(AtonTheme.light)
                Text("Тёмная").tag(AtonTheme.dark)
            }
            .pickerStyle(.segmented)
        }
    }

    private var safetyCard: some View {
        SettingsCard(title: "Управление") {
            if app.currentUser?.isSuperAdmin == true {
                NavigationLink(value: Route.admin) {
                    Label("Админ-панель", systemImage: "shield.checkered")
                }
                .buttonStyle(AtonSecondaryButtonStyle())
            }

            Button(role: .destructive) {
                Task { await app.logout() }
            } label: {
                Label("Выйти из аккаунта", systemImage: "rectangle.portrait.and.arrow.right")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(AtonDangerButtonStyle())
        }
    }

    private func loadUser() {
        guard let user = app.currentUser else { return }
        displayName = user.displayName
        bio = user.bio ?? ""
        publicId = user.publicId ?? user.username
        avatarDataUrl = user.avatarDataUrl
    }

    private func save() async {
        await app.updateProfile(
            displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines),
            bio: bio.trimmingCharacters(in: .whitespacesAndNewlines),
            publicId: publicId.trimmingCharacters(in: .whitespacesAndNewlines),
            avatarDataUrl: avatarDataUrl
        )
        loadUser()
    }

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data),
              let jpeg = image.downscaled(maxPixel: 900).jpegData(compressionQuality: 0.82) else {
            app.errorMessage = "Не удалось прочитать фото"
            return
        }
        avatarDataUrl = "data:image/jpeg;base64,\(jpeg.base64EncodedString())"
    }
}

private struct SettingsCard<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title.uppercased())
                .font(.caption.weight(.heavy))
                .tracking(2.5)
                .foregroundStyle(.secondary)
            content
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtonPalette.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(Color.white.opacity(0.10), lineWidth: 1)
        }
    }
}

private struct ProfileReadonlyRow: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(AtonPalette.input, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }
}

struct AtonSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.white)
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity)
            .background(Color.white.opacity(configuration.isPressed ? 0.12 : 0.08), in: RoundedRectangle(cornerRadius: 17, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 17, style: .continuous)
                    .stroke(Color.white.opacity(0.12), lineWidth: 1)
            }
    }
}

struct AtonDangerButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.red)
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity)
            .background(Color.red.opacity(configuration.isPressed ? 0.18 : 0.10), in: RoundedRectangle(cornerRadius: 17, style: .continuous))
    }
}
