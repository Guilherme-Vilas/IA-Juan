import "./globals.css";
import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";

// Sans geométrica para dados/UI (Apple)
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Serif editorial para títulos (Claude/Anthropic)
const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stella · SaaS de Atendimento",
  description: "Plataforma de atendimento e vendas — imobiliárias e consórcios",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${serif.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
