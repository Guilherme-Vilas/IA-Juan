import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · Vita OS" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-page-glow px-4">
      <LoginForm />
    </main>
  );
}
