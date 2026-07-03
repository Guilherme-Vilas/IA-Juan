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
        "2xl": "20px",
        xl: "16px",
        lg: "12px",
        md: "8px",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 2px 10px rgba(0,0,0,0.35)",
        "card-hover":
          "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 14px 36px -10px rgba(0,0,0,0.65)",
        elevated: "0 24px 70px rgba(0,0,0,0.6)",
        glass: "0 8px 32px rgba(0,0,0,0.45)",
        // brilho bronze — hover de cards, drag-over, ação-chave
        "glow-bronze": "0 0 0 1px rgba(176,141,87,0.22), 0 8px 32px -6px rgba(176,141,87,0.28)",
        "glow-bronze-strong":
          "0 0 0 1px rgba(176,141,87,0.4), 0 0 44px -4px rgba(176,141,87,0.45)",
        "glow-ice": "0 4px 28px -4px rgba(230,230,230,0.25)",
      },
      backdropBlur: {
        glass: "20px",
      },
      backgroundImage: {
        // brilho sutil, frio (não colorido) — profundidade sem pirotecnia
        "page-glow":
          "radial-gradient(900px 500px at 85% -15%, rgba(255,255,255,0.035), transparent 60%)",
        "bronze-line": "linear-gradient(90deg, transparent, rgba(176,141,87,0.4), transparent)",
        // véu bronze no topo de superfícies (sidebar, colunas, cards-hero)
        "bronze-veil":
          "radial-gradient(120% 90% at 50% 0%, rgba(176,141,87,0.09), transparent 70%)",
        // sheen de vidro — highlight de topo em cards
        sheen: "linear-gradient(180deg, rgba(255,255,255,0.04), transparent 38%)",
        // gradiente do botão bronze (metal escovado)
        "bronze-metal": "linear-gradient(180deg, #C9A876 0%, #B08D57 55%, #9C7A47 100%)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96) translateY(10px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-out-right": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        "ping-dot": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "80%, 100%": { transform: "scale(2.4)", opacity: "0" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-5px)" },
          "40%": { transform: "translateX(5px)" },
          "60%": { transform: "translateX(-3px)" },
          "80%": { transform: "translateX(3px)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        // curvas Apple: entrada desacelerada longa (easeOutExpo-like)
        "fade-up": "fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.3s ease-out both",
        "fade-out": "fade-out 0.25s ease-in both",
        "scale-in": "scale-in 0.38s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-right": "slide-in-right 0.45s cubic-bezier(0.32, 0.72, 0, 1) both",
        "slide-out-right": "slide-out-right 0.3s cubic-bezier(0.32, 0.72, 0, 1) both",
        "pulse-soft": "pulse-soft 3.6s ease-in-out infinite",
        "ping-dot": "ping-dot 1.6s cubic-bezier(0, 0, 0.2, 1) infinite",
        shake: "shake 0.4s ease-in-out",
        shimmer: "shimmer 2.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
