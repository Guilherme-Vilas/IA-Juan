"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Check, Building2 } from "lucide-react";
import { TENANT_COOKIE } from "@/lib/tenant-client";
import type { TenantSummary } from "@/lib/tenant-client";

export function TenantSelector({
  tenants,
  currentSlug,
}: {
  tenants: TenantSummary[];
  currentSlug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const current = tenants.find((t) => t.slug === currentSlug) ?? tenants[0];
  if (!current) return null;

  const choose = (slug: string) => {
    document.cookie = `${TENANT_COOKIE}=${slug}; path=/; max-age=${60 * 60 * 24 * 365}`;
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        <Building2 size={14} className="text-ink-muted" />
        <span className="font-medium">{current.name}</span>
        <ChevronDown size={12} className="text-ink-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-line bg-white py-1 shadow-lg">
            {tenants.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => choose(t.slug)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  !t.active ? "opacity-50" : ""
                }`}
              >
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-ink-muted">
                    {t.owner_name} · {t.active ? "ativo" : "inativo"}
                  </div>
                </div>
                {t.slug === current.slug && (
                  <Check size={14} className="text-brand-600" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
