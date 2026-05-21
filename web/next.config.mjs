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
    serverActions: { allowedOrigins: ["localhost:3001"] },
  },
};

export default nextConfig;
