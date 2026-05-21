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

EXPOSE 3001

# dev = hot reload via bind-mount; prod = next build && next start
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then npm run build && npm start; else npm run dev; fi"]
