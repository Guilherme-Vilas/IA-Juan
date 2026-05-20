import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // paleta inspirada no Odoo
        brand: {
          50: "#faf5f9",
          100: "#f3e9ef",
          200: "#e6d1de",
          300: "#cfa4b9",
          400: "#a87490",
          500: "#875276",
          600: "#714B67", // odoo primary
          700: "#5c3d56",
          800: "#4a3346",
          900: "#3d2b3a",
        },
        canvas: {
          DEFAULT: "#f7f8fa", // background do conteúdo
          dark: "#1f1f24",
        },
        ink: {
          DEFAULT: "#1f2937",
          muted: "#6b7280",
          inverse: "#ffffff",
        },
        line: {
          DEFAULT: "#e5e7eb",
          strong: "#d1d5db",
        },
        // status colors
        success: "#10b981",
        warn: "#f59e0b",
        danger: "#ef4444",
        info: "#3b82f6",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
