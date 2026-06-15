import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Garante que o alias `@/...` resolva no build de produção mesmo em
  // ambientes onde o tsconfig paths não é aplicado (ex.: certos Docker setups).
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname),
    };
    return config;
  },
  experimental: {
    // Origens permitidas para Server Actions. Inclui o dominio de producao.
    // Configuravel via DASHBOARD_ALLOWED_ORIGINS (CSV) sem rebuild de codigo.
    serverActions: {
      allowedOrigins: [
        "localhost:3001",
        "app.systemvita.com.br",
        ...(process.env.DASHBOARD_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
      ],
    },
  },
};

export default nextConfig;
