FROM rust:alpine AS builder

WORKDIR /app

RUN apk add --no-cache musl-dev pkgconfig openssl-dev openssl-libs-static git ca-certificates

COPY Cargo.toml Cargo.lock* ./

RUN mkdir src && echo "pub fn dummy() {}" > src/lib.rs && echo "fn main() {}" > src/main.rs
RUN cargo build --release || true
RUN rm -rf src

COPY src ./src

RUN touch src/main.rs src/lib.rs && cargo build --release

FROM alpine:3.20 AS runner

RUN addgroup -S kudiba && adduser -S kudiba -G kudiba

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata wget \
    && cp /usr/share/zoneinfo/Africa/Luanda /etc/localtime \
    && echo "Africa/Luanda" > /etc/timezone

COPY --from=builder /app/target/release/kudiba-accounting /app/kudiba-accounting

USER kudiba:kudiba

ENV PORT=8085 \
    RUST_LOG=info,kudiba_accounting=debug

EXPOSE 8085

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8085/health || exit 1

ENTRYPOINT ["/app/kudiba-accounting"]
