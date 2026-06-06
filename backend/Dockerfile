FROM node:24-bookworm-slim AS build

WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json ./
COPY scripts ./scripts
RUN npm ci --include=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY scripts ./scripts
RUN npm ci --include=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && npm run prisma:seed && node dist/main.js"]
