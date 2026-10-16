// Ambiente mínimo pros testes UNITÁRIOS: o config valida env no import, e os
// módulos criam clientes (pg Pool, ioredis lazy, OpenAI) sem conectar. Nenhum
// teste toca rede — valores são dummies.
// IMPORTANTE: importe este arquivo PRIMEIRO em todo *.test.ts.

process.env.NODE_ENV ??= "test";
process.env.PUBLIC_BASE_URL ??= "http://localhost:3000";
process.env.APP_PUBLIC_URL ??= "http://localhost:3001";
process.env.OPENAI_API_KEY ??= "sk-unit-0000000000000000000000000000000000000000";
process.env.EVOLUTION_BASE_URL ??= "http://localhost:8080";
process.env.EVOLUTION_API_KEY ??= "f3a1b2c4d5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4";
process.env.EVOLUTION_WEBHOOK_TOKEN ??= "9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e";
process.env.REDIS_URL ??= "redis://localhost:6390";
process.env.DATABASE_URL ??= "postgres://unit:unit@localhost:54329/unit";
process.env.JWT_SECRET ??= "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f";
process.env.GOOGLE_OAUTH_STATE_SECRET ??= "7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f";
process.env.ADMIN_API_TOKEN ??= "0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a";

export {};
