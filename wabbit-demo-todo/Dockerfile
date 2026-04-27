# Wabbit demo todo app
# Build context: the parent directory (Babbage/), so that ../wabbit-sdk is visible.
# Usage: docker build -f wabbit-demo-todo/Dockerfile -t wabbit-demo-todo .

FROM node:20-slim AS builder
WORKDIR /build

# Bundle wabbit-sdk + wabbit-react into the image so file: deps resolve
COPY wabbit-sdk /build/wabbit-sdk
WORKDIR /build/wabbit-sdk
RUN npm install --ignore-scripts && npm run build

COPY wabbit-react /build/wabbit-react
WORKDIR /build/wabbit-react
RUN npm install --ignore-scripts && npm run build

# Demo app
WORKDIR /build/wabbit-demo-todo
COPY wabbit-demo-todo/package.json wabbit-demo-todo/package-lock.json ./
RUN npm ci --ignore-scripts

COPY wabbit-demo-todo/tsconfig.json wabbit-demo-todo/tsconfig.app.json wabbit-demo-todo/tsconfig.node.json ./
COPY wabbit-demo-todo/vite.config.ts wabbit-demo-todo/index.html wabbit-demo-todo/eslint.config.js ./
COPY wabbit-demo-todo/public ./public
COPY wabbit-demo-todo/src ./src

ARG VITE_WABBIT_ORIGIN="http://127.0.0.1:5173"
ENV VITE_WABBIT_ORIGIN=${VITE_WABBIT_ORIGIN}

RUN npm run build

# ── Runtime ──────────────────────────────────────────────
FROM nginx:alpine AS runtime

COPY --from=builder /build/wabbit-demo-todo/dist /usr/share/nginx/html
COPY wabbit-demo-todo/nginx.conf.template /etc/nginx/templates/default.conf.template

ENV PORT=8080
EXPOSE 8080

CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
