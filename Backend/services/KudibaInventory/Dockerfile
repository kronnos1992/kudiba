FROM rust:alpine AS builder

WORKDIR /build/services/KudibaInventory

RUN apk add --no-cache musl-dev pkgconfig openssl-dev openssl-libs-static git ca-certificates

COPY Backend/Cargo.lock ./Cargo.lock
COPY Backend/services/KudibaInventory/Cargo.toml ./
COPY Backend/gateway_signature/Cargo.toml /build/gateway_signature/Cargo.toml

RUN mkdir -p src /build/gateway_signature/src \
    && echo "pub fn dummy() {}" > src/lib.rs \
    && echo "fn main() {}" > src/main.rs \
    && echo "" > /build/gateway_signature/src/lib.rs \
    && cargo build --release || true \
    && rm -rf src

COPY Backend/services/KudibaInventory/src ./src
COPY Backend/gateway_signature/src /build/gateway_signature/src

RUN touch src/main.rs src/lib.rs /build/gateway_signature/src/lib.rs && cargo build --release

FROM alpine:3.20 AS runner

RUN addgroup -S kudiba && adduser -S kudiba -G kudiba

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata wget \
    && cp /usr/share/zoneinfo/Africa/Luanda /etc/localtime \
    && echo "Africa/Luanda" > /etc/timezone

COPY --from=builder /build/services/KudibaInventory/target/release/kudiba-inventory /app/kudiba-inventory

USER kudiba:kudiba

ENV PORT=8083 \
    RUST_LOG=info,kudiba_inventory=debug

EXPOSE 8083

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8083/health || exit 1

ENTRYPOINT ["/app/kudiba-inventory"]
