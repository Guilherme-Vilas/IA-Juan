import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ===== Apple Dark industrial + Claude editorial =====
        canvas: {
          DEFAULT: "#0A0A0C", // background principal — cinza quase preto, denso
          deep: "#0D0D10",
          surface: "#16161A", // cards / containers (elevação)
          "surface-2": "#1C1C21", // hover / camada superior
          glass: "rgba(22,22,26,0.7)", // vidro (backdrop-blur)
        },
        line: {
          DEFAULT: "#232329", // bordas ultra-finas
          strong: "#2E2E38",
        },
        ink: {
          DEFAULT: "#E6E6E6", // texto principal — branco gelo
          soft: "#A1A1AA",
          muted: "#71717A", // texto de suporte
          faint: "#52525B",
          inverse: "#0A0A0C",
        },
        // Acento: branco gelo (botão primário Apple) + bronze escovado (requinte Claude)
        accent: {
          DEFAULT: "#E6E6E6",
          bronze: "#B08D57", // ouro velho / bronze escovado, sóbrio
          "bronze-soft": "#C9A876",
        },
        // status — saturação contida pra não competir com o tema sóbrio
        success: "#4ADE80",
        warning: "#FBBF24",
        danger: "#F87171",
        info: "#60A5FA",
      },
      fontFamily: {
        // Sans geométrica pra dados/UI (pegada Apple)
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        // Serif editorial pra títulos (pegada Claude/Anthropic)
        serif: ["var(--font-serif)", "Newsreader", "Georgia", "Cambria", "serif"],
      },
      fontSize: {
        // títulos serif respiram mais
        "display-lg": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display": ["1.75rem", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
      },
      borderRadius: {
        // cards generosos (Apple), inputs/botões sóbrios
        xl: "16px",
        lg: "12px",
        md: "8px",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.4)",
        elevated: "0 12px 40px rgba(0,0,0,0.5)",
        glass: "0 8px 32px rgba(0,0,0,0.45)",
      },
      backdropBlur: {
        glass: "20px",
      },
      backgroundImage: {
        // brilho sutil, frio (não colorido) — profundidade sem pirotecnia
        "page-glow":
          "radial-gradient(900px 500px at 85% -15%, rgba(255,255,255,0.035), transparent 60%)",
        "bronze-line": "linear-gradient(90deg, transparent, rgba(176,141,87,0.4), transparent)",
      },
    },
  },
  plugins: [],
};

export default config;
