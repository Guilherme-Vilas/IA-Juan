FROM node:20-alpine

WORKDIR /app

COPY package*.json tsconfig.json next.config.mjs postcss.config.mjs tailwind.config.ts ./
RUN npm install --include=dev --no-audit --no-fund

COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public

EXPOSE 3002

# dev = hot reload; prod = next build && next start (SSG/estatico)
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then npm run build && npm start; else npm run dev; fi"]
