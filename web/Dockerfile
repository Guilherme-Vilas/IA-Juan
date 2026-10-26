FROM node:20-alpine

WORKDIR /app

# Configs primeiro (camada cacheada)
COPY package*.json tsconfig.json next.config.mjs postcss.config.mjs tailwind.config.ts ./

# --include=dev força instalar devDependencies mesmo quando NODE_ENV=production
# (Coolify/CI setam isso por default e o npm pula devDeps senão).
RUN npm install --include=dev --no-audit --no-fund

# Código
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public

# Origens extras de Server Actions são lidas no BUILD (next.config) — passa por
# build-arg; o default do config já cobre o domínio de produção.
ARG DASHBOARD_ALLOWED_ORIGINS=""
ENV DASHBOARD_ALLOWED_ORIGINS=$DASHBOARD_ALLOWED_ORIGINS

# Build AQUI, uma vez por deploy — nunca na subida do container. Buildar no
# start fazia o pod reiniciar em loop por OOM (o build do Next passa de 1GB;
# o runtime do `next start` usa ~200MB). Páginas são force-dynamic: o build
# não precisa de banco/env de runtime.
RUN npm run build

EXPOSE 3001

# dev = hot reload via bind-mount (compose dev troca o command); prod = só servir
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then npm start; else npm run dev; fi"]
