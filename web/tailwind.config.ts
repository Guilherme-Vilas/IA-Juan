import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dark roxo/magenta — identidade Stella SaaS (inspirado IFC Star).
        brand: {
          50: "#f1efff",
          100: "#e3deff",
          200: "#c9c1ff",
          300: "#aea2ff",
          400: "#9d92ff", // primary-2 (claro)
          500: "#8676ff",
          600: "#7a6cff", // primary
          700: "#6354e8",
          800: "#4f43c0",
          900: "#3d348f",
        },
        accent: {
          DEFAULT: "#e52862",
          soft: "#ff5d7d",
        },
        canvas: {
          DEFAULT: "#0a070f",  // bg principal
          dark: "#0a070f",
          surface: "#140f1d",   // cards / sidebar
          "surface-2": "#1b1526", // hover / chips
        },
        ink: {
          DEFAULT: "#f4f2f8",
          muted: "#8b8595",
          faint: "#5c5668",
          inverse: "#0a070f",
        },
        line: {
          DEFAULT: "#2a2235",
          strong: "#3a2f47",
        },
        // status colors
        success: "#32cc7e",
        warn: "#ffac48",
        warning: "#ffac48",
        danger: "#ff5d7d",
        info: "#43bdde",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.25), 0 1px 3px 0 rgb(0 0 0 / 0.35)",
        elevated: "0 8px 30px rgba(0,0,0,.35)",
        glow: "0 0 0 1px rgba(122,108,255,.35)",
      },
      borderRadius: {
        lg: "14px",
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(135deg,#7a6cff,#e52862)",
        "nav-active": "linear-gradient(90deg,rgba(122,108,255,.22),rgba(229,40,98,.10))",
        "page-glow":
          "radial-gradient(1200px 600px at 80% -10%, rgba(122,108,255,.12), transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
