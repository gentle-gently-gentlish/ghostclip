# Ghostcut — Next.js + canvas + ffmpeg + SQLite (node:sqlite)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# puppeteer is only used by local tests — don't download Chrome into the image
ENV PUPPETEER_SKIP_DOWNLOAD=1
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV GHOSTCUT_DATA_DIR=/data

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data \
  && chown -R node:node /data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# node-canvas native binding from the build (standalone may omit it)
COPY --from=builder --chown=node:node /app/node_modules/canvas ./node_modules/canvas

# Fly mounts the volume root-owned at runtime (overriding the chown above), so
# fix ownership on boot, then drop to the unprivileged node user.
EXPOSE 8080
CMD ["sh", "-c", "mkdir -p /data && chown -R node:node /data; if command -v setpriv >/dev/null 2>&1; then exec setpriv --reuid=node --regid=node --init-groups node server.js; else exec node server.js; fi"]
