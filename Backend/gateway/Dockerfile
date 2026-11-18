# ==============================================================================
# Multi-stage Dockerfile para o Kudiba API Gateway em RUST
# ==============================================================================

FROM rust:alpine AS builder

WORKDIR /build/gateway

RUN apk add --no-cache musl-dev pkgconfig openssl-dev openssl-libs-static git ca-certificates

COPY Backend/Cargo.lock ./Cargo.lock
COPY Backend/gateway/Cargo.toml ./
COPY Backend/gateway_signature/Cargo.toml /build/gateway_signature/Cargo.toml

RUN mkdir -p src /build/gateway_signature/src \
    && echo "fn main() {}" > src/main.rs \
    && echo "" > /build/gateway_signature/src/lib.rs \
    && cargo build --release || true \
    && rm -rf src

COPY Backend/gateway/src ./src
COPY Backend/gateway/docs ./docs
COPY Backend/gateway_signature/src /build/gateway_signature/src

RUN touch src/main.rs /build/gateway_signature/src/lib.rs && cargo build --release

FROM alpine:3.20 AS runner

RUN addgroup -S kudiba && adduser -S kudiba -G kudiba

WORKDIR /app

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

COPY --from=builder /build/gateway/target/release/kudiba-gateway /app/kudiba-gateway

USER kudiba:kudiba

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/app/kudiba-gateway"]
