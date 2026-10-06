//! CAMADA 1 — NÚCLEO DE DOMÍNIO (PURE BUSINESS CORE)
//!
//! Regras de negócio, entidades e contratos (portas) do motor fiscal.
//! Esta camada não conhece Axum, Tonic, SQLx nem o PostgreSQL: apenas os tipos
//! necessários à integração são declarados em `ports`.
pub mod entities;
pub mod error;
pub mod ports;
pub mod services;
pub mod value_objects;
