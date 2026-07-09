"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  GraduationCap,
  PlayCircle,
  CheckCircle2,
  Circle,
  Clock,
  Settings2,
  Plus,
  Trash2,
  Pencil,
  Lock,
} from "lucide-react";

type Video = {
  id: number;
  module: string;
  title: string;
  description: string;
  video_url: string;
  duration_min: number | null;
  position: number;
  published: boolean;
  completed?: boolean;
};

// Converte URLs comuns (YouTube/Vimeo/Loom) pra URL de embed.
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("vimeo.com") && !u.pathname.includes("/video/")) {
      return `https://player.vimeo.com/video/${u.pathname.split("/").filter(Boolean)[0]}`;
    }
    if (u.hostname.includes("loom.com") && u.pathname.includes("/share/")) {
      return url.replace("/share/", "/embed/");
    }
    return url; // já é embed ou formato desconhecido — usa como veio
  } catch {
    return url;
  }
}

export function TrainingHub({ tenantSlug, isSuperadmin }: { tenantSlug: string; isSuperadmin: boolean }) {
  const [enabled, setEnabled] = useState(true);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Video | null>(null);
  const [managing, setManaging] = useState(false);

  const base = `/api/admin-proxy/tenants/${tenantSlug}/training`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setEnabled(!!data.enabled);
        setVideos(data.videos ?? []);
      }
    } catch {
      /* silencioso */
    } finally {
      setLoaded(true);
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const modules = useMemo(() => {
    const map = new Map<string, Video[]>();
    for (const v of videos) {
      const list = map.get(v.module) ?? [];
      list.push(v);
      map.set(v.module, list);
    }
    return [...map.entries()];
  }, [videos]);

  const done = videos.filter((v) => v.completed).length;
  const pct = videos.length ? Math.round((done / videos.length) * 100) : 0;

  async function toggleComplete(v: Video) {
    const method = v.completed ? "DELETE" : "POST";
    setVideos((prev) => prev.map((x) => (x.id === v.id ? { ...x, completed: !v.completed } : x)));
    await fetch(`${base}/${v.id}/complete`, { method }).catch(() => load());
  }

  if (!loaded) return <div className="grid h-40 place-items-center text-sm text-ink-muted">Carregando…</div>;

  if (!enabled && !isSuperadmin) {
    return (
      <Card>
        <CardBody>
          <div className="grid place-items-center gap-3 py-14 text-center">
            <Lock size={26} className="text-ink-faint" />
            <p className="font-serif text-lg text-ink">Área ainda não liberada</p>
            <p className="max-w-sm text-xs text-ink-muted">
              Os treinamentos são liberados pelo administrador da plataforma. Fale com o suporte.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {!enabled && isSuperadmin && (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Este tenant ainda NÃO tem a área liberada — você vê por ser superadmin. Libere em Instâncias.
        </p>
      )}

      {/* Progresso */}
      <Card>
        <CardBody className="flex items-center gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent-bronze/30 bg-accent-bronze/10">
            <GraduationCap size={20} className="text-accent-bronze-soft" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13.5px] font-medium text-ink">Seu progresso</p>
              <p className="text-[12px] text-ink-muted">
                {done}/{videos.length} concluídos · {pct}%
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas-surface-2">
              <div
                className="h-full rounded-full bg-bronze-metal transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {isSuperadmin && (
            <Button size="sm" variant="outline" onClick={() => setManaging(true)}>
              <Settings2 size={13} /> Gerenciar vídeos
            </Button>
          )}
        </CardBody>
      </Card>

      {/* Player do vídeo selecionado */}
      {selected && (
        <Card className="animate-fade-up">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-serif text-[15px] text-ink">{selected.title}</h2>
                <p className="text-[11.5px] text-ink-muted">{selected.description}</p>
              </div>
              <Button
                size="sm"
                variant={selected.completed ? "outline" : "bronze"}
                onClick={() => toggleComplete(selected)}
              >
                {selected.completed ? "Concluído ✓" : "Marcar concluído"}
              </Button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="aspect-video w-full overflow-hidden">
              <iframe
                key={selected.id}
                src={toEmbedUrl(selected.video_url)}
                title={selected.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Módulos */}
      {videos.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-10 text-center text-sm text-ink-muted">
              Nenhum vídeo publicado ainda{isSuperadmin ? " — use “Gerenciar vídeos” pra publicar o catálogo." : "."}
            </p>
          </CardBody>
        </Card>
      ) : (
        modules.map(([mod, vids], mi) => {
          const modDone = vids.filter((v) => v.completed).length;
          return (
            <details key={mod} open={mi === 0} className="group rounded-xl border border-line bg-canvas-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="font-serif text-[15px] text-ink">{mod}</span>
                <span className="text-[11px] text-ink-muted">
                  {modDone}/{vids.length} <span className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
                </span>
              </summary>
              <div className="border-t border-line/60">
                {vids.map((v) => (
                  <div
                    key={v.id}
                    className={`flex items-center gap-3 border-b border-line/40 px-5 py-3 last:border-0 ${
                      selected?.id === v.id ? "bg-accent-bronze/[0.06]" : ""
                    }`}
                  >
                    <button
                      onClick={() => toggleComplete(v)}
                      title={v.completed ? "Desmarcar" : "Marcar concluído"}
                      className="shrink-0"
                    >
                      {v.completed ? (
                        <CheckCircle2 size={17} className="text-success" />
                      ) : (
                        <Circle size={17} className="text-ink-faint hover:text-accent-bronze-soft" />
                      )}
                    </button>
                    <button
                      onClick={() => setSelected(v)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className={`truncate text-[13px] ${v.completed ? "text-ink-muted line-through" : "text-ink"}`}>
                        {v.title}
                      </span>
                    </button>
                    <span className="flex shrink-0 items-center gap-3 text-[11px] text-ink-faint">
                      {v.duration_min && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {v.duration_min} min
                        </span>
                      )}
                      <button onClick={() => setSelected(v)} className="text-accent-bronze-soft hover:text-ink">
                        <PlayCircle size={18} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          );
        })
      )}

      {isSuperadmin && managing && <ManageModal onClose={() => setManaging(false)} onChanged={load} />}
    </div>
  );
}

// ===== Gerenciador (superadmin): catálogo completo, incl. rascunhos =====

type EditState = Partial<Video> & { isNew?: boolean };

function ManageModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [all, setAll] = useState<Video[]>([]);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin-proxy/training/videos", { cache: "no-store" });
    if (res.ok) setAll((await res.json()).videos ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      const path = editing.isNew
        ? "/api/admin-proxy/training/videos"
        : `/api/admin-proxy/training/videos/${editing.id}`;
      const res = await fetch(path, {
        method: editing.isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: editing.module,
          title: editing.title,
          description: editing.description ?? "",
          video_url: editing.video_url ?? "",
          duration_min: editing.duration_min ?? null,
          position: editing.position ?? 0,
          published: editing.published ?? false,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "erro ao salvar");
      setEditing(null);
      await load();
      onChanged();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    await fetch(`/api/admin-proxy/training/videos/${id}`, { method: "DELETE" });
    await load();
    onChanged();
  }

  async function togglePublish(v: Video) {
    if (!v.video_url && !v.published) {
      setErr(`"${v.title}": cole a URL do vídeo antes de publicar`);
      return;
    }
    setErr(null);
    await fetch(`/api/admin-proxy/training/videos/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !v.published }),
    });
    await load();
    onChanged();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Gerenciar vídeos"
      subtitle="Catálogo global — publique quando a URL estiver pronta"
      className="max-w-3xl"
    >
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Módulo">
              <Input value={editing.module ?? ""} onChange={(e) => setEditing({ ...editing, module: e.target.value })} placeholder="1. Primeiros passos" />
            </Field>
            <Field label="Título">
              <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
          </div>
          <Field label="Descrição">
            <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </Field>
          <Field label="URL do vídeo" hint="YouTube (não listado), Vimeo ou Loom — cole o link normal">
            <Input value={editing.video_url ?? ""} onChange={(e) => setEditing({ ...editing, video_url: e.target.value })} placeholder="https://youtu.be/…" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Duração (min)">
              <Input type="number" value={editing.duration_min ?? ""} onChange={(e) => setEditing({ ...editing, duration_min: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Posição">
              <Input type="number" value={editing.position ?? 0} onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })} />
            </Field>
            <label className="flex cursor-pointer items-end gap-2 pb-2 text-sm text-ink">
              <input type="checkbox" checked={!!editing.published} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} />
              Publicado
            </label>
          </div>
          {err && <p className="text-xs text-danger">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button variant="bronze" onClick={save} disabled={busy || !editing.module?.trim() || !editing.title?.trim()}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-ink-muted">{all.length} vídeos · {all.filter((v) => v.published).length} publicados</p>
            <Button size="sm" variant="bronze" onClick={() => setEditing({ isNew: true, position: (all.at(-1)?.position ?? 0) + 1 })}>
              <Plus size={12} /> Novo vídeo
            </Button>
          </div>
          {err && <p className="text-xs text-danger">{err}</p>}
          <div className="max-h-[55vh] space-y-1 overflow-y-auto">
            {all.map((v) => (
              <div key={v.id} className="flex items-center gap-2 rounded-md bg-canvas-deep/60 px-3 py-2 text-[12.5px]">
                <button
                  onClick={() => togglePublish(v)}
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    v.published ? "bg-success/15 text-success" : "bg-canvas-surface-2 text-ink-faint"
                  }`}
                  title={v.published ? "Clique pra despublicar" : "Clique pra publicar"}
                >
                  {v.published ? "publicado" : "rascunho"}
                </button>
                <span className="min-w-0 flex-1 truncate text-ink">
                  <span className="text-ink-faint">{v.module} · </span>
                  {v.title}
                  {!v.video_url && <span className="ml-1 text-warning">(sem URL)</span>}
                </span>
                <button onClick={() => setEditing(v)} className="p-1 text-ink-muted hover:text-ink" title="Editar">
                  <Pencil size={13} />
                </button>
                <button onClick={() => remove(v.id)} className="p-1 text-ink-muted hover:text-danger" title="Excluir">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
