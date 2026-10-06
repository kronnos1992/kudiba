use std::sync::Arc;

use crate::application::dto::{VerifySignatureQuery, VerifySignatureResult};
use crate::application::parsing::{parse_invoice_date, parse_system_entry_date};
use crate::domain::ports::crypto_signer::CryptoSigner;
use crate::domain::services::chained_hash::ChainedHashCalculator;
use crate::domain::value_objects::validation_code::extract_from_base64_signature;

/// Caso de uso de verificação independente da assinatura de um documento fiscal
pub struct VerifySignatureUseCase {
    crypto_signer: Arc<dyn CryptoSigner>,
}

impl VerifySignatureUseCase {
    pub fn new(crypto_signer: Arc<dyn CryptoSigner>) -> Self {
        Self { crypto_signer }
    }

    pub async fn execute(&self, query: VerifySignatureQuery) -> VerifySignatureResult {
        // A versão da chave pedida tem de coincidir com a chave activa: só esta
        // consegue reconstruir o buffer canónico e verificar a assinatura.
        let active_key_version = self.crypto_signer.key_version();
        if !query.key_version.trim().is_empty() && query.key_version != active_key_version {
            return VerifySignatureResult {
                is_valid: false,
                validation_chars: String::new(),
                error_message: format!(
                    "Chave solicitada ({}) não corresponde à chave activa ({}).",
                    query.key_version, active_key_version
                ),
            };
        }

        let canonical_buffer = ChainedHashCalculator::build_canonical_buffer(
            &query.previous_hash,
            parse_invoice_date(&query.invoice_date),
            &query.document_number,
            query.gross_total,
            parse_system_entry_date(&query.system_entry_date),
        );

        let is_valid = self
            .crypto_signer
            .verify_signature(&canonical_buffer, &query.signature_base64)
            .await;

        if !is_valid {
            return VerifySignatureResult {
                is_valid: false,
                validation_chars: String::new(),
                error_message: "Digital signature verification failed against canonical buffer."
                    .to_string(),
            };
        }

        match extract_from_base64_signature(&query.signature_base64) {
            Ok(validation_chars) => VerifySignatureResult {
                is_valid: true,
                validation_chars,
                error_message: String::new(),
            },
            Err(err) => VerifySignatureResult {
                is_valid: false,
                validation_chars: String::new(),
                error_message: format!("Verification error: {}", err),
            },
        }
    }
}
