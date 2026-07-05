import { ImageResponse } from "next/og";

// Card de compartilhamento (WhatsApp/redes) — gerado no build, sem asset externo.
// Preto + "V" bronze em serifa: a marca reconhecível no preview do link.

export const runtime = "edge";
export const alt = "Vita OS — IA que atende, qualifica e agenda no WhatsApp";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0C",
          backgroundImage:
            "radial-gradient(800px 500px at 50% -10%, rgba(176,141,87,0.25), transparent 60%)",
          color: "#E6E6E6",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: 28,
            background: "#16161A",
            border: "1px solid rgba(176,141,87,0.45)",
            fontSize: 72,
            color: "#C9A876",
            marginBottom: 36,
          }}
        >
          V
        </div>
        <div style={{ fontSize: 64, letterSpacing: -2, display: "flex" }}>Vita OS</div>
        <div
          style={{
            fontSize: 30,
            marginTop: 18,
            color: "#A1A1AA",
            display: "flex",
            textAlign: "center",
          }}
        >
          Seu melhor vendedor, trabalhando 24 horas no WhatsApp.
        </div>
        <div
          style={{
            marginTop: 42,
            fontSize: 22,
            color: "#B08D57",
            letterSpacing: 4,
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          systemvita.com.br
        </div>
      </div>
    ),
    { ...size },
  );
}
