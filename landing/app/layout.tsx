import "./globals.css";
import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://systemvita.com.br"),
  title: "Vita OS — IA que atende, qualifica e agenda no WhatsApp",
  description:
    "Plataforma de atendimento e vendas com IA para imobiliárias e consórcios. Qualifica leads no WhatsApp, agenda visitas e entrega o lead pronto pro corretor.",
  icons: { icon: "/brand/vitaos-logo.png" },
  openGraph: {
    title: "Vita OS — IA de atendimento e vendas",
    description:
      "Qualifica leads no WhatsApp, agenda visitas e entrega o lead mastigado pro corretor.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${serif.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
