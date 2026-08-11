FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --include=dev \
  && npx prisma generate \
  && npm prune --omit=dev

COPY server.js ./
COPY index.html forgot.html reset.html admin-users.html ./
COPY main.js style.css notification.mp3 aten-logo.png golos-aton-avatar.png manifest.webmanifest ./
COPY icons ./icons

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
