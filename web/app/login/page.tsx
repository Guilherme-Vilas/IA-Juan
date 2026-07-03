import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · Vita OS" };

export default function LoginPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      {/* palco: glow central + anéis concêntricos atrás do card */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2"
      >
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgba(176,141,87,0.10),transparent_70%)]" />
        <div className="absolute inset-[12%] rounded-full border border-accent-bronze/[0.07]" />
        <div className="absolute inset-[26%] rounded-full border border-accent-bronze/[0.09]" />
        <div className="absolute inset-[40%] rounded-full border border-accent-bronze/[0.11]" />
      </div>
      <LoginForm />
    </main>
  );
}
