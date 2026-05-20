FROM node:20-alpine

WORKDIR /app

COPY package*.json tsconfig.json next.config.mjs postcss.config.mjs tailwind.config.ts ./
RUN npm install --no-audit --no-fund

COPY app ./app
COPY components ./components
COPY lib ./lib

EXPOSE 3001

# dev mode com hot reload (bind-mount no compose)
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then npm run build && npm start; else npm run dev; fi"]
