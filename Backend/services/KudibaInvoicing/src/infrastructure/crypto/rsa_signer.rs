use std::sync::Arc;

use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rsa::{
    pkcs1::DecodeRsaPrivateKey,
    pkcs1v15::{Pkcs1v15Sign, Signature, VerifyingKey},
    pkcs8::{DecodePrivateKey, EncodePublicKey, LineEnding},
    signature::Verifier,
    RsaPrivateKey, RsaPublicKey,
};
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

use crate::domain::error::DomainError;
use crate::domain::ports::crypto_signer::{CryptoSigner, SignedDocument};
use crate::domain::value_objects::canonical_buffer::CanonicalBuffer;
use crate::domain::value_objects::validation_code::extract_from_base64_signature;

/// Tamanho obrigatório da chave RSA defined pelo Decreto Presidencial n.º 71/25
const RSA_KEY_BITS: usize = 2048;

/// Assinador RSA-2048 / SHA-256 PKCS#1 v1.5 do motor fiscal.
///
/// Carrega a chave privada a partir de `AGT_RSA_PRIVATE_KEY_PEM` (PKCS#8 ou
/// PKCS#1). Na ausência de chave configurada gera uma chave efémera de 2048 bits
/// (aceite apenas em desenvolvimento — a produção exige certificado AGT).
pub struct RsaCryptoSigner {
    private_key: Arc<RsaPrivateKey>,
    public_key_pem: String,
    key_version: String,
}

impl RsaCryptoSigner {
    pub fn from_env(key_version: &str) -> Result<Self, DomainError> {
        match std::env::var("AGT_RSA_PRIVATE_KEY_PEM") {
            Ok(pem) if !pem.trim().is_empty() => {
                Self::from_private_key_pem(pem.trim(), key_version)
            }
            _ => {
                tracing::warn!(
                    "AGT_RSA_PRIVATE_KEY_PEM não definida: a gerar chave RSA-2048 efémera (apenas desenvolvimento)"
                );
                Self::from_private_key(&generate_ephemeral_key()?, key_version)
            }
        }
    }

    /// Constrói o assinador a partir de uma chave privada PEM explícita
    pub fn from_private_key_pem(pem: &str, key_version: &str) -> Result<Self, DomainError> {
        Self::from_private_key(&load_private_key(pem)?, key_version)
    }

    /// Constrói o assinador a partir de uma chave privada já carregada
    pub fn from_private_key(
        private_key: &RsaPrivateKey,
        key_version: &str,
    ) -> Result<Self, DomainError> {
        let public_key = RsaPublicKey::from(private_key);
        let public_key_pem = public_key
            .to_public_key_pem(LineEnding::LF)
            .map_err(|err| {
                DomainError::Crypto(format!("Falha ao exportar chave pública PEM: {}", err))
            })?;

        Ok(Self {
            private_key: Arc::new(private_key.clone()),
            public_key_pem,
            key_version: key_version.to_string(),
        })
    }

    /// Assina o buffer canónico e devolve o bloco de assinatura fiscal
    pub fn sign_buffer(
        &self,
        canonical_buffer: &CanonicalBuffer,
    ) -> Result<SignedDocument, DomainError> {
        let buffer = Zeroizing::new(canonical_buffer.as_str().as_bytes().to_vec());
        let digest = Zeroizing::new(Sha256::digest(buffer.as_slice()).to_vec());
        let hash_hex = to_lowercase_hex(&digest);

        let signature = self
            .private_key
            .sign(Pkcs1v15Sign::new::<Sha256>(), &digest)
            .map_err(|err| {
                DomainError::Crypto(format!("Falha ao assinar buffer canónico: {}", err))
            })?;

        let signature_bytes: &[u8] = signature.as_ref();
        let signature_base64 = BASE64.encode(signature_bytes);
        let validation_chars = extract_from_base64_signature(&signature_base64)?;

        Ok(SignedDocument {
            signature_base64,
            hash_sha256: hash_hex,
            validation_chars,
            signed_at: chrono::Utc::now(),
        })
    }

    /// Verifica uma assinatura Base64 contra o buffer canónico reconstruído
    pub fn verify_buffer(
        &self,
        canonical_buffer: &CanonicalBuffer,
        signature_base64: &str,
    ) -> bool {
        let Ok(signature_bytes) = BASE64.decode(signature_base64.trim()) else {
            return false;
        };

        let signature = match Signature::try_from(signature_bytes.as_slice()) {
            Ok(signature) => signature,
            Err(_) => return false,
        };

        let verifying_key = VerifyingKey::<Sha256>::new(self.public_key());
        verifying_key
            .verify(canonical_buffer.as_str().as_bytes(), &signature)
            .is_ok()
    }

    fn public_key(&self) -> RsaPublicKey {
        RsaPublicKey::from(self.private_key.as_ref())
    }
}

#[async_trait]
impl CryptoSigner for RsaCryptoSigner {
    async fn sign_canonical_buffer(
        &self,
        canonical_buffer: &CanonicalBuffer,
    ) -> Result<SignedDocument, DomainError> {
        self.sign_buffer(canonical_buffer)
    }

    async fn verify_signature(
        &self,
        canonical_buffer: &CanonicalBuffer,
        signature_base64: &str,
    ) -> bool {
        self.verify_buffer(canonical_buffer, signature_base64)
    }

    fn public_key_pem(&self) -> String {
        self.public_key_pem.clone()
    }

    fn key_version(&self) -> String {
        self.key_version.clone()
    }
}

/// Importa a chave privada de um PEM (aceita PKCS#8 e PKCS#1)
fn load_private_key(pem: &str) -> Result<RsaPrivateKey, DomainError> {
    RsaPrivateKey::from_pkcs8_pem(pem)
        .or_else(|_| RsaPrivateKey::from_pkcs1_pem(pem))
        .map_err(|err| DomainError::Crypto(format!("AGT_RSA_PRIVATE_KEY_PEM inválida: {}", err)))
}

/// Gera a chave efémera de desenvolvimento (2048 bits)
fn generate_ephemeral_key() -> Result<RsaPrivateKey, DomainError> {
    let mut rng = rand_core::OsRng;
    RsaPrivateKey::new(&mut rng, RSA_KEY_BITS)
        .map_err(|err| DomainError::Crypto(format!("Falha ao gerar chave RSA efémera: {}", err)))
}

fn to_lowercase_hex(bytes: &[u8]) -> String {
    use std::fmt::Write;

    let mut hex = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(hex, "{byte:02x}");
    }
    hex
}

#[cfg(test)]
mod tests {
    use super::*;

    fn signer() -> RsaCryptoSigner {
        let pem = generate_test_pem();
        RsaCryptoSigner::from_private_key_pem(&pem, "1").expect("chave de teste válida")
    }

    #[test]
    fn assina_e_verifica_o_buffer_canonico() {
        let signer = signer();
        let canonical = CanonicalBuffer::build(
            chrono::NaiveDate::from_ymd_opt(2026, 10, 3).unwrap(),
            chrono::Utc::now(),
            "FT KUD26/000001",
            rust_decimal::Decimal::from(855000),
            "",
        );

        let signed = signer.sign_buffer(&canonical).expect("assinatura gerada");
        assert_eq!(signed.hash_sha256.len(), 64);
        assert_eq!(signed.validation_chars.len(), 4);
        assert!(signer.verify_buffer(&canonical, &signed.signature_base64));
    }

    #[test]
    fn rejeita_assinatura_de_documento_alterado() {
        let signer = signer();
        let signed = signer
            .sign_buffer(&CanonicalBuffer::build(
                chrono::NaiveDate::from_ymd_opt(2026, 10, 3).unwrap(),
                chrono::Utc::now(),
                "FT KUD26/000001",
                rust_decimal::Decimal::from(855000),
                "",
            ))
            .unwrap();

        let tampered = CanonicalBuffer::build(
            chrono::NaiveDate::from_ymd_opt(2026, 10, 3).unwrap(),
            chrono::Utc::now(),
            "FT KUD26/000001",
            rust_decimal::Decimal::from(999999),
            "",
        );

        assert!(!signer.verify_buffer(&tampered, &signed.signature_base64));
    }

    /// Gera um PEM PKCS#8 descartável apenas para os testes
    fn generate_test_pem() -> String {
        use rsa::pkcs8::{EncodePrivateKey, LineEnding};

        let mut rng = rand_core::OsRng;
        let key = RsaPrivateKey::new(&mut rng, RSA_KEY_BITS).unwrap();
        key.to_pkcs8_pem(LineEnding::LF).unwrap().to_string()
    }
}
