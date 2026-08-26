"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { WifiOff, QrCode, RefreshCw, CheckCircle2 } from "lucide-react";

// Alerta GLOBAL de WhatsApp desconectado (todas as abas) + reconexão por QR
// sem sair do painel. Polling leve (o backend cacheia o estado por 20s).

const DISCONNECTED_STATES = new Set(["close", "closed", "connecting", "refused", "disconnected"]);

export function WhatsappAlert({ tenantSlug }: { tenantSlug: string }) {
  const [state, setState] = useState<string>("open");
  const [modalOpen, setModalOpen] = useState(false);
  const disconnected = DISCONNECTED_STATES.has(state);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/whatsapp/status`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data?.state) setState(data.state);
      }
    } catch {
      /* rede falhou — não alarmar por isso */
    }
  }, [tenantSlug]);

  // desconectado → checa mais rápido pra sumir logo após reconectar
  useEffect(() => {
    check();
    const id = setInterval(check, disconnected ? 10_000 : 30_000);
    return () => clearInterval(id);
  }, [check, disconnected]);

  if (!disconnected) return null;

  return (
    <>
      {/* pílula vermelha fixa no topo — visível em qualquer aba */}
      <div className="fixed left-1/2 top-3 z-40 -translate-x-1/2 animate-fade-up">
        <div className="flex items-center gap-3 rounded-full border border-danger/50 bg-[#2a1215] py-2 pl-4 pr-2 shadow-elevated">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute h-full w-full animate-ping rounded-full bg-danger opacity-60" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-danger" />
          </span>
          <span className="text-[13px] font-medium text-danger">
            WhatsApp desconectado — a IA não está atendendo
          </span>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-danger px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-danger/80"
          >
            <QrCode size={13} /> Reconectar agora
          </button>
        </div>
      </div>

      {modalOpen && (
        <ReconnectModal
          tenantSlug={tenantSlug}
          onClose={() => setModalOpen(false)}
          onConnected={() => {
            setState("open");
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}

function ReconnectModal({
  tenantSlug,
  onClose,
  onConnected,
}: {
  tenantSlug: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const alive = useRef(true);

  const fetchQr = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/whatsapp/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro ao gerar o QR");
      if (!alive.current) return;
      setQr(data.qr_base64 ?? null);
      setPairing(data.pairing_code ?? null);
    } catch (e) {
      if (alive.current) setErr(String(e instanceof Error ? e.message : e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    alive.current = true;
    fetchQr();
    // QR do WhatsApp expira (~40s) — renova sozinho
    const qrTimer = setInterval(fetchQr, 30_000);
    // detecta a conexão em tempo quase-real
    const statusTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/whatsapp/status`, { cache: "no-store" });
        const data = await res.json();
        if (data?.state === "open" && alive.current) {
          setConnected(true);
          clearInterval(qrTimer);
          clearInterval(statusTimer);
        }
      } catch {
        /* segue tentando */
      }
    }, 3_000);
    return () => {
      alive.current = false;
      clearInterval(qrTimer);
      clearInterval(statusTimer);
    };
  }, [fetchQr, tenantSlug]);

  const qrSrc = qr ? (qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`) : null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Reconectar WhatsApp"
      subtitle="Escaneie com o celular do número da IA — igual conectar o WhatsApp Web"
    >
      {connected ? (
        <div className="grid place-items-center gap-3 py-8 text-center">
          <CheckCircle2 size={40} className="text-success" />
          <p className="font-serif text-xl text-ink">Conectado!</p>
          <p className="text-[13px] text-ink-muted">A IA voltou a atender normalmente.</p>
          <Button variant="bronze" onClick={onConnected}>
            Fechar
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <ol className="list-inside list-decimal space-y-1 rounded-lg bg-canvas-deep/60 p-3.5 text-[12.5px] leading-relaxed text-ink-soft">
            <li>No celular do número, abra o WhatsApp</li>
            <li>
              Toque em <strong className="text-ink">Configurações → Dispositivos conectados → Conectar dispositivo</strong>
            </li>
            <li>Aponte a câmera pro código abaixo</li>
          </ol>

          <div className="grid place-items-center">
            {loading && !qrSrc ? (
              <div className="grid h-56 w-56 place-items-center rounded-xl border border-line bg-canvas-deep">
                <RefreshCw size={22} className="animate-spin text-ink-muted" />
              </div>
            ) : qrSrc ? (
              <div className="rounded-xl border border-accent-bronze/30 bg-white p-3 shadow-glow-bronze">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="QR code de conexão" className="h-56 w-56" />
              </div>
            ) : (
              <div className="grid h-40 w-full place-items-center rounded-xl border border-line bg-canvas-deep px-6 text-center">
                <span className="flex items-center gap-2 text-[13px] text-ink-muted">
                  <WifiOff size={15} /> {err ?? "QR indisponível no momento"}
                </span>
              </div>
            )}
          </div>

          {pairing && (
            <p className="text-center text-[12px] text-ink-muted">
              Ou use o código de pareamento:{" "}
              <code className="rounded bg-canvas-deep px-2 py-0.5 font-mono text-accent-bronze-soft">{pairing}</code>
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-ink-faint">O código renova sozinho a cada 30s.</p>
            <Button size="sm" variant="outline" onClick={fetchQr} disabled={loading}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Atualizar QR
            </Button>
          </div>
          {err && qrSrc && <p className="text-[11.5px] text-danger">{err}</p>}
        </div>
      )}
    </Modal>
  );
}
