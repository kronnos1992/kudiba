//! CAMADA 4 — APRESENTAÇÃO (PORTAS DE ENTRADA)
//!
//! Adaptadores de protocolo: REST (Axum) com Scalar API Reference e gRPC (Tonic)
//! expondo o contrato `kudiba.fiscal.v1`.
pub mod grpc;
pub mod http;
