import type { Config } from "tailwindcss";

// Mesma identidade Vita OS do dashboard (Apple Dark + Claude).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#0A0A0C",
          deep: "#0D0D10",
          surface: "#16161A",
          "surface-2": "#1C1C21",
          glass: "rgba(22,22,26,0.7)",
        },
        line: { DEFAULT: "#232329", strong: "#2E2E38" },
        ink: {
          DEFAULT: "#E6E6E6",
          soft: "#A1A1AA",
          muted: "#71717A",
          faint: "#52525B",
          inverse: "#0A0A0C",
        },
        accent: {
          DEFAULT: "#E6E6E6",
          bronze: "#B08D57",
          "bronze-soft": "#C9A876",
        },
        success: "#4ADE80",
        warning: "#FBBF24",
        danger: "#F87171",
        info: "#60A5FA",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["var(--font-serif)", "Newsreader", "Georgia", "serif"],
      },
      fontSize: {
        hero: ["clamp(2.5rem, 6vw, 4.5rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "section-title": ["clamp(1.75rem, 3.5vw, 2.75rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      borderRadius: { "2xl": "20px", xl: "16px", lg: "12px", md: "8px" },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 2px 8px rgba(0,0,0,0.4)",
        elevated: "0 20px 60px rgba(0,0,0,0.55)",
        "glow-bronze": "0 0 0 1px rgba(176,141,87,0.22), 0 8px 32px -6px rgba(176,141,87,0.28)",
        "glow-ice": "0 4px 28px -4px rgba(230,230,230,0.25)",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(1000px 600px at 50% -10%, rgba(176,141,87,0.12), transparent 60%), radial-gradient(800px 500px at 85% 20%, rgba(255,255,255,0.04), transparent 55%)",
        "bronze-line": "linear-gradient(90deg, transparent, rgba(176,141,87,0.45), transparent)",
        "bronze-metal": "linear-gradient(180deg, #C9A876 0%, #B08D57 55%, #9C7A47 100%)",
        sheen: "linear-gradient(180deg, rgba(255,255,255,0.04), transparent 38%)",
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
        "pulse-soft": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-3px)", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "pulse-soft": "pulse-soft 3.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
