FROM node:20-alpine

WORKDIR /app

# dependências primeiro (cacheável)
COPY package*.json tsconfig.json ./
RUN npm ci --no-audit --no-fund

# código
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
COPY public ./public

EXPOSE 3000

# CMD padrão = API. Aplica migrations (com advisory lock entre réplicas) + seed
# idempotente (prompts no banco) e sobe só a API HTTP.
# O serviço de WORKERS sobrescreve o command no compose: `npx tsx src/workers.ts`.
CMD ["sh", "-c", "npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts && if [ \"$NODE_ENV\" = \"production\" ]; then npx tsx src/index.ts; else npx tsx watch src/index.ts; fi"]
