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

# em dev (default): tsx watch pra hot-reload no bind-mount
# em prod (NODE_ENV=production): sem watch
CMD ["sh", "-c", "npx tsx scripts/migrate.ts && if [ \"$NODE_ENV\" = \"production\" ]; then npx tsx src/index.ts; else npx tsx watch src/index.ts; fi"]
