# =============================================================================
# KUDIBA ERP — MOTOR FISCAL E MICROSSERVIÇO DE FACTURAÇÃO (RUST)
# Conformidade: Decreto Presidencial n.º 71/25 (AGT Angola)
# =============================================================================

FROM rust:1-alpine AS builder

WORKDIR /src

RUN apk add --no-cache musl-dev pkgconfig openssl-dev openssl-libs-static protobuf-dev git ca-certificates

COPY proto ./proto

COPY Backend/services/KudibaInvoicing/Cargo.toml Backend/services/KudibaInvoicing/Cargo.lock* ./
COPY Backend/gateway_signature/Cargo.toml /gateway_signature/Cargo.toml

RUN mkdir -p src /gateway_signature/src \
    && echo "fn main() {}" > src/main.rs \
    && mkdir -p src/domain src/application src/infrastructure src/presentation \
    && echo "" > src/domain/mod.rs && echo "" > src/application/mod.rs \
    && echo "" > src/infrastructure/mod.rs && echo "" > src/presentation/mod.rs \
    && echo "" > /gateway_signature/src/lib.rs \
    && touch build.rs \
    && cargo build --release || true \
    && rm -rf src build.rs

COPY Backend/services/KudibaInvoicing/build.rs ./build.rs
COPY Backend/services/KudibaInvoicing/src ./src
COPY Backend/services/KudibaInvoicing/docs ./docs
COPY Backend/services/KudibaInvoicing/schemas ./schemas
COPY Backend/gateway_signature/src /gateway_signature/src

RUN touch src/main.rs /gateway_signature/src/lib.rs && cargo build --release

FROM alpine:3.20 AS runner

RUN addgroup -S kudiba && adduser -S kudiba -G kudiba

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata wget \
    && cp /usr/share/zoneinfo/Africa/Luanda /etc/localtime \
    && echo "Africa/Luanda" > /etc/timezone

COPY --from=builder /src/target/release/kudiba-invoicing /app/kudiba-invoicing

USER kudiba:kudiba

ENV PORT=9090 \
    GRPC_PORT=9091 \
    RUST_LOG=info,kudiba_invoicing=debug

EXPOSE 9090 9091

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:9090/health || exit 1

ENTRYPOINT ["/app/kudiba-invoicing"]
