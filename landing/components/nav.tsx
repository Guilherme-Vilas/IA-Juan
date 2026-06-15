import { LogoMark } from "./logo";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.systemvita.com.br";

export function Nav() {
  return (
    <header className="glass fixed inset-x-0 top-0 z-50 border-b border-line">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8 border border-line" />
          <span className="font-serif text-lg text-ink">Vita OS</span>
        </a>

        <div className="hidden items-center gap-8 text-[13px] text-ink-muted md:flex">
          <a href="#produto" className="transition-colors hover:text-ink">
            Produto
          </a>
          <a href="#como-funciona" className="transition-colors hover:text-ink">
            Como funciona
          </a>
          <a href="#segmentos" className="transition-colors hover:text-ink">
            Segmentos
          </a>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`${APP_URL}`}
            className="hidden rounded-md px-4 py-2 text-[13px] text-ink-soft transition-colors hover:text-ink sm:block"
          >
            Entrar
          </a>
          <a
            href="#contato"
            className="rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-ink-inverse transition-colors hover:bg-white"
          >
            Falar com a gente
          </a>
        </div>
      </nav>
    </header>
  );
}
