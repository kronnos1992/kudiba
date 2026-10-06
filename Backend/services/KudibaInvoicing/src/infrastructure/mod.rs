//! CAMADA 3 — INFRAESTRUTURA (ADAPTADORES DE SAÍDA)
//!
//! Implementações concretas das portas do domínio: persistência transacional
//! PostgreSQL (SQLx) e criptografia RSA (conformidade AGT).
pub mod agt;
pub mod crypto;
pub mod persistence;
pub mod saft;
