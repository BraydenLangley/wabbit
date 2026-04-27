# Wabbit wallet iframe host
# Multi-stage: Vite build → static nginx serve
# Build context: the wabbit/ directory

FROM node:20-slim AS builder
WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts index.html eslint.config.js ./
COPY public ./public
COPY src ./src

# Build-time env vars (Vite bakes these in)
ARG VITE_WAB_URL="https://wab.babbage.systems"
ARG VITE_STORAGE_URL="https://storage.babbage.systems"
ARG VITE_CHAIN="main"
ARG VITE_ADMIN_ORIGINATOR="admin.wabbit.local"
ARG VITE_ALLOWED_PARENT_ORIGINS=""
ENV VITE_WAB_URL=${VITE_WAB_URL}
ENV VITE_STORAGE_URL=${VITE_STORAGE_URL}
ENV VITE_CHAIN=${VITE_CHAIN}
ENV VITE_ADMIN_ORIGINATOR=${VITE_ADMIN_ORIGINATOR}
ENV VITE_ALLOWED_PARENT_ORIGINS=${VITE_ALLOWED_PARENT_ORIGINS}

RUN npm run build

# ── Runtime ──────────────────────────────────────────────
FROM nginx:alpine AS runtime

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV PORT=8080
EXPOSE 8080

CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
