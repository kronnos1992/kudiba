# ==============================================================================
# Multi-stage Dockerfile para o Frontend Kudiba ERP (React + Vite + TypeScript)
# ==============================================================================

# Estágio 1: Build da aplicação estática
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/
ARG VITE_SESSION_IDLE_MINUTES=30
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_SESSION_IDLE_MINUTES=${VITE_SESSION_IDLE_MINUTES}

RUN npm run build

# Estágio 2: Servidor estático Nginx com proxy para o Gateway
FROM nginx:1.27-alpine AS runner

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
