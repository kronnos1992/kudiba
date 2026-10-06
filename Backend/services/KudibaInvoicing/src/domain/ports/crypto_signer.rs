use async_trait::async_trait;
use chrono::{DateTime, Utc};

use crate::domain::error::DomainError;
use crate::domain::value_objects::canonical_buffer::CanonicalBuffer;

/// Bloco de assinatura de um documento fiscal
#[derive(Debug, Clone)]
pub struct SignedDocument {
    /// Assinatura digital RSA-2048 codificada em Base64
    pub signature_base64: String,
    /// Hash SHA-256 (minúsculo, hexadecimal) do buffer canónico assinado
    pub hash_sha256: String,
    /// 4 caracteres de controlo impressos no documento (posições 1ª, 11ª, 21ª, 31ª)
    pub validation_chars: String,
    pub signed_at: DateTime<Utc>,
}

/// Porta de assinatura criptográfica (RSA-2048 / SHA-256 PKCS#1 v1.5)
#[async_trait]
pub trait CryptoSigner: Send + Sync {
    /// Assina um buffer canónico e devolve o bloco de assinatura
    async fn sign_canonical_buffer(
        &self,
        canonical_buffer: &CanonicalBuffer,
    ) -> Result<SignedDocument, DomainError>;

    /// Verifica uma assinatura Base64 contra o buffer canónico reconstruído
    async fn verify_signature(
        &self,
        canonical_buffer: &CanonicalBuffer,
        signature_base64: &str,
    ) -> bool;

    /// Chave pública RSA em formato PEM (SubjectPublicKeyInfo) para validação independente
    fn public_key_pem(&self) -> String;

    /// Versão da chave privada registada na AGT
    fn key_version(&self) -> String;
}
