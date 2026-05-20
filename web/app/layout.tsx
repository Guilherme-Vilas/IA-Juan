import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stella CRM — Juan Monteiro",
  description: "Painel de controle de leads do consórcio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans">{children}</body>
    </html>
  );
}
