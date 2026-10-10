# =============================================================================
# KUDIBA ERP — MOTOR FISCAL E MICROSSERVIÇO DE FACTURAÇÃO (RUST)
# Conformidade: Decreto Presidencial n.º 71/25 (AGT Angola)
# =============================================================================

# Stage 1: Build & Compilação Otimizada
FROM rust:1-alpine AS builder

WORKDIR /src

# protoc é obrigatório para compilar o contrato gRPC `kudiba.fiscal.v1` (tonic-prost-build)
RUN apk add --no-cache musl-dev pkgconfig openssl-dev openssl-libs-static protobuf-dev git ca-certificates

# Contratos Protobuf partilhados do monorepo (fonte única de verdade);
# o build.rs aceita ./proto (contentor) e ../../proto (layout do monorepo)
COPY proto ./proto

# Manifestos primeiro para aproveitamento da cache de camadas de dependências
COPY Backend/services/KudibaInvoicing/Cargo.toml Backend/services/KudibaInvoicing/Cargo.lock* ./
RUN mkdir -p src && echo "fn main() {}" > src/main.rs \
    && mkdir -p src/domain src/application src/infrastructure src/presentation \
    && echo "" > src/domain/mod.rs && echo "" > src/application/mod.rs \
    && echo "" > src/infrastructure/mod.rs && echo "" > src/presentation/mod.rs \
    && touch build.rs \
    && cargo build --release || true \
    && rm -rf src build.rs

# Código-fonte do motor fiscal e especificação OpenAPI embebida
COPY Backend/services/KudibaInvoicing/build.rs ./build.rs
COPY Backend/services/KudibaInvoicing/src ./src
COPY Backend/services/KudibaInvoicing/docs ./docs
COPY Backend/services/KudibaInvoicing/schemas ./schemas

RUN cargo build --release

# Stage 2: Imagem Mínima de Execução (Alpine)
FROM alpine:3.20 AS runner

# Usuário de segurança não-root
RUN addgroup -S kudiba && adduser -S kudiba -G kudiba

WORKDIR /app

# Certificados TLS, fusos horários e ferramentas mínimas de diagnóstico
RUN apk add --no-cache ca-certificates tzdata wget \
    && cp /usr/share/zoneinfo/Africa/Luanda /etc/localtime \
    && echo "Africa/Luanda" > /etc/timezone

COPY --from=builder /src/target/release/kudiba-invoicing /app/kudiba-invoicing

USER kudiba:kudiba

ENV PORT=9090 \
    GRPC_PORT=9091 \
    RUST_LOG=info,kudiba_invoicing=debug

EXPOSE 9090 9091

# Liveness probe do motor fiscal
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:9090/health || exit 1

ENTRYPOINT ["/app/kudiba-invoicing"]