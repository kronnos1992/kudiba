use std::sync::Arc;

use crate::application::dto::{SignDirectCommand, SignDirectResult};
use crate::application::parsing::{parse_invoice_date, parse_system_entry_date};
use crate::domain::error::DomainError;
use crate::domain::ports::crypto_signer::CryptoSigner;
use crate::domain::services::chained_hash::ChainedHashCalculator;

/// Caso de uso de assinatura directa de um documento já emitido.
///
/// Usado pelos terminais POS em modo contingência fiscal (Decreto n.º 71/25):
/// o buffer canónico é reconstruído a partir dos campos do documento e assinado
/// sem qualquer escrita na base de dados.
pub struct SignDirectUseCase {
    crypto_signer: Arc<dyn CryptoSigner>,
}

impl SignDirectUseCase {
    pub fn new(crypto_signer: Arc<dyn CryptoSigner>) -> Self {
        Self { crypto_signer }
    }

    pub async fn execute(
        &self,
        command: SignDirectCommand,
    ) -> Result<SignDirectResult, DomainError> {
        let invoice_date = parse_invoice_date(&command.invoice_date);
        let system_entry_date = parse_system_entry_date(&command.system_entry_date);

        let canonical_buffer = ChainedHashCalculator::build_canonical_buffer(
            &command.previous_hash,
            invoice_date,
            &command.document_number,
            command.gross_total,
            system_entry_date,
        );

        let signature = self
            .crypto_signer
            .sign_canonical_buffer(&canonical_buffer)
            .await?;

        tracing::info!(
            document_number = %command.document_number,
            key_version = %command.key_version,
            gross_total = %command.gross_total,
            validation_chars = %signature.validation_chars,
            "Documento fiscal assinado em modo contingência (POS), sem persistência"
        );

        Ok(SignDirectResult {
            document_number: command.document_number,
            signature_base64: signature.signature_base64,
            hash_sha256: signature.hash_sha256,
            validation_chars: signature.validation_chars,
            signed_at: signature.signed_at,
            is_contingency: false,
        })
    }
}
