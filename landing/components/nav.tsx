"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { LogoMark } from "./logo";
import { SITE, primaryCtaHref } from "@/lib/site";

const LINKS = [
  { href: "#produto", label: "Produto" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#segmentos", label: "Segmentos" },
  { href: "#faq", label: "Dúvidas" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="glass fixed inset-x-0 top-0 z-50 border-b border-line">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8 border border-line" />
          <span className="font-serif text-lg text-ink">Vita OS</span>
        </a>

        <div className="hidden items-center gap-8 text-[13px] text-ink-muted md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={SITE.appUrl}
            className="hidden rounded-md px-4 py-2 text-[13px] text-ink-soft transition-colors hover:text-ink sm:block"
          >
            Entrar
          </a>
          <a
            href={primaryCtaHref()}
            className="shine hidden rounded-md bg-bronze-metal px-4 py-2 text-[13px] font-semibold text-ink-inverse md:block"
          >
            Falar com a gente
          </a>
          {/* menu mobile — a maioria do público chega pelo celular */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            className="rounded-md border border-line p-2 text-ink-soft md:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="glass animate-fade-in border-t border-line px-6 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-[14px] text-ink-soft transition-colors hover:bg-canvas-surface hover:text-ink"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
              <a
                href={primaryCtaHref()}
                className="shine rounded-md bg-bronze-metal px-4 py-2.5 text-center text-[14px] font-semibold text-ink-inverse"
              >
                Falar com a gente
              </a>
              <a
                href={SITE.appUrl}
                className="rounded-md border border-line px-4 py-2.5 text-center text-[14px] text-ink-soft"
              >
                Entrar na plataforma
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
