"use client";

// Toast global sem provider: qualquer componente chama toast() e o <Toaster>
// (montado no layout) escuta via CustomEvent. Zero plumbing de contexto.

export type ToastKind = "success" | "error" | "info";

export function toast(message: string, kind: ToastKind = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("vita:toast", { detail: { message, kind } }));
}

export const toastError = (message: string) => toast(message, "error");
export const toastSuccess = (message: string) => toast(message, "success");
