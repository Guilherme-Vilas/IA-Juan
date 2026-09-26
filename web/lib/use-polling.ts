"use client";

import { useEffect, useRef } from "react";

// Polling educado: pausa quando a aba está oculta e dispara uma atualização
// imediata quando ela volta. Corta ~90% das requisições de quem deixa o painel
// aberto em segundo plano — importante com o polling de 4-5s do kanban/drawer.
export function usePolling(fn: () => void | Promise<void>, ms: number, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => void fnRef.current(), ms);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fnRef.current(); // atualiza na hora ao voltar pra aba
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms, enabled]);
}
