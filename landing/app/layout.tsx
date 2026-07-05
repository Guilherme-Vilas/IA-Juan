import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Newsreader } from "next/font/google";
import { SITE } from "@/lib/site";

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
  metadataBase: new URL(SITE.url),
  title: "Vita OS — IA que atende, qualifica e agenda no WhatsApp",
  description:
    "Plataforma de atendimento e vendas com IA para imobiliárias e consórcios. Responde em segundos, qualifica no WhatsApp, agenda visitas e entrega o lead pronto pro corretor — com você no controle.",
  icons: { icon: "/brand/vitaos-logo.png" },
  openGraph: {
    title: "Vita OS — IA de atendimento e vendas no WhatsApp",
    description:
      "Responde em segundos, qualifica, agenda e entrega o lead mastigado pro corretor fechar.",
    type: "website",
    locale: "pt_BR",
    url: SITE.url,
    siteName: SITE.name,
  },
  twitter: {
    card: "summary_large_image",
    title: "Vita OS — IA de atendimento e vendas no WhatsApp",
    description: "Responde em segundos, qualifica, agenda e entrega o lead pronto pro corretor.",
  },
};

// Dados estruturados — legitimidade pra buscadores (e rich preview).
function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    email: SITE.email,
    logo: `${SITE.url}/brand/vitaos-logo.png`,
    ...(SITE.cnpj ? { taxID: SITE.cnpj } : {}),
    ...(SITE.instagram ? { sameAs: [`https://instagram.com/${SITE.instagram}`] } : {}),
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${serif.variable}`}>
      <body className="font-sans">
        {/* aurora bronze fixa atrás de tudo (mesma atmosfera do produto) */}
        <div className="atmosphere" aria-hidden />
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
        />
        {/* Analytics — só carregam quando configurados no lib/site.ts */}
        {SITE.gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${SITE.gaId}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${SITE.gaId}');`}
            </Script>
          </>
        )}
        {SITE.metaPixelId && (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${SITE.metaPixelId}');fbq('track','PageView');`}
          </Script>
        )}
      </body>
    </html>
  );
}
