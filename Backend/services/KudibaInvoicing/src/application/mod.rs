//! CAMADA 2 — APLICAÇÃO (ORQUESTRAÇÃO CQRS)
//!
//! Casos de uso (Commands e Queries) que coordenam o domínio e as portas de
//! saída, sem depender de HTTP, gRPC, SQLx ou criptografia concretos.
pub mod commands;
pub mod dto;
pub mod parsing;
pub mod queries;
