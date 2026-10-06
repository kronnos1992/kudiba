# ==============================================================================
# Multi-stage Dockerfile para o Kudiba API Gateway em RUST
# ==============================================================================

# Estágio 1: Build & Compilação Otimizada
FROM rust:alpine AS builder

WORKDIR /app

# Instalar dependências de build musl e certificados CA
RUN apk add --no-cache musl-dev pkgconfig openssl-dev openssl-libs-static git ca-certificates

# Copiar arquivos de dependências para cache inteligente
COPY Cargo.toml Cargo.lock* ./

# Criar dummy source para compilar apenas as dependências (camada de cache)
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release || true
RUN rm -rf src

# Copiar código-fonte real e documentação OpenAPI
COPY src ./src
COPY docs ./docs

# Compilação final estática para produção
RUN touch src/main.rs && cargo build --release

# Estágio 2: Imagem Mínima de Execução (Alpine < 20MB)
FROM alpine:3.20 AS runner

# Usuário de segurança não-root
RUN addgroup -S kudiba && adduser -S kudiba -G kudiba

WORKDIR /app

# Copiar certificados TLS e timezone
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copiar o binário compilado em Rust
COPY --from=builder /app/target/release/kudiba-gateway /app/kudiba-gateway

USER kudiba:kudiba

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/app/kudiba-gateway"]
