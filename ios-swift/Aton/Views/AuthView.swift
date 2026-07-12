import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var app: AppState
    @State private var mode: AuthMode = .login
    @State private var email = ""
    @State private var username = ""
    @State private var password = ""

    var body: some View {
        VStack(spacing: 22) {
            Spacer(minLength: 24)
            VStack(spacing: 14) {
                Image("AtonLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 132, height: 132)
                    .clipShape(Circle())
                    .shadow(color: .orange.opacity(0.35), radius: 30)
                Text("Атон")
                    .font(.system(size: 38, weight: .black, design: .rounded))
                Text("Спокойные диалоги под светом диска")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Picker("", selection: $mode) {
                Text("Вход").tag(AuthMode.login)
                Text("Регистрация").tag(AuthMode.register)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)

            VStack(spacing: 12) {
                if mode == .register {
                    AtonTextField(title: "Имя пользователя", text: $username, keyboard: .default)
                }
                AtonTextField(title: "Email", text: $email, keyboard: .emailAddress)
                AtonSecureField(title: "Пароль", text: $password)

                LanguagePicker()
                    .padding(.top, 4)

                Button {
                    Task {
                        if mode == .login {
                            await app.login(email: email, password: password)
                        } else {
                            await app.register(username: username, email: email, password: password)
                        }
                    }
                } label: {
                    HStack {
                        if app.isLoading { ProgressView().tint(.black) }
                        Text(mode == .login ? "Войти" : "Создать аккаунт")
                            .fontWeight(.bold)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(AtonPrimaryButtonStyle())
                .disabled(app.isLoading)
            }
            .padding(18)
            .background(AtonPalette.surface, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
            .padding(.horizontal)
            Spacer(minLength: 20)
        }
    }
}

enum AuthMode {
    case login
    case register
}
