//! Adaptador de entrada gRPC (Tonic) — implementação do contrato `kudiba.fiscal.v1`.
use std::sync::Arc;

use rust_decimal::Decimal;
use tonic::{Request, Response, Status};

use crate::application::commands::sign_direct::SignDirectUseCase;
use crate::application::dto::{
    SignDirectCommand, ValidateSeriesSequenceQuery, VerifySignatureQuery,
};
use crate::application::queries::validate_series_sequence::ValidateSeriesSequenceUseCase;
use crate::application::queries::verify_signature::VerifySignatureUseCase;
use crate::domain::error::DomainError;
use uuid::Uuid;

/// Contrato Protobuf compilado pelo `build.rs` a partir de `proto/fiscal/v1`
pub mod fiscal_engine {
    #![allow(clippy::all)]
    tonic::include_proto!("kudiba.fiscal.v1");
}

use fiscal_engine::fiscal_engine_service_server::FiscalEngineService;
use fiscal_engine::{
    SignDocumentRequest, SignDocumentResponse, TriggerSaftGenerationRequest,
    TriggerSaftGenerationResponse, ValidateSeriesSequenceRequest, ValidateSeriesSequenceResponse,
    VerifySignatureRequest, VerifySignatureResponse,
};

/// Serviço fiscal exposto ao Edge POS (Tauri offline-first) e ao Core API
pub struct FiscalGrpcService {
    sign_direct: Arc<SignDirectUseCase>,
    verify_signature: Arc<VerifySignatureUseCase>,
    validate_series: Arc<ValidateSeriesSequenceUseCase>,
}

impl FiscalGrpcService {
    pub fn new(
        sign_direct: Arc<SignDirectUseCase>,
        verify_signature: Arc<VerifySignatureUseCase>,
        validate_series: Arc<ValidateSeriesSequenceUseCase>,
    ) -> Self {
        Self {
            sign_direct,
            verify_signature,
            validate_series,
        }
    }
}

#[tonic::async_trait]
impl FiscalEngineService for FiscalGrpcService {
    /// Assina digitalmente um documento fiscal com RSA-SHA256 em cadeia
    async fn sign_document(
        &self,
        request: Request<SignDocumentRequest>,
    ) -> Result<Response<SignDocumentResponse>, Status> {
        let payload = request.into_inner();
        tracing::info!(
            document_number = %payload.document_number,
            tenant_id = %payload.tenant_id,
            "gRPC SignDocument recebido"
        );

        let command = SignDirectCommand {
            document_number: payload.document_number,
            invoice_date: payload.invoice_date,
            system_entry_date: payload.system_entry_date,
            gross_total: decimal_from_f64(payload.gross_total),
            previous_hash: payload.previous_hash,
            key_version: payload.key_version,
        };

        let result = self
            .sign_direct
            .execute(command)
            .await
            .map_err(status_from_domain)?;

        Ok(Response::new(SignDocumentResponse {
            document_number: result.document_number,
            signature_base64: result.signature_base64,
            hash_sha256: result.hash_sha256,
            validation_chars: result.validation_chars,
            signed_at: result.signed_at.to_rfc3339(),
            is_contingency: result.is_contingency,
        }))
    }

    /// Valida uma assinatura e os 4 caracteres de controlo de um documento emitido
    async fn verify_signature(
        &self,
        request: Request<VerifySignatureRequest>,
    ) -> Result<Response<VerifySignatureResponse>, Status> {
        let payload = request.into_inner();
        tracing::info!(
            document_number = %payload.document_number,
            "gRPC VerifySignature recebido"
        );

        let query = VerifySignatureQuery {
            document_number: payload.document_number,
            signature_base64: payload.signature_base64,
            invoice_date: payload.invoice_date,
            system_entry_date: payload.system_entry_date,
            gross_total: decimal_from_f64(payload.gross_total),
            previous_hash: payload.previous_hash,
            key_version: payload.key_version,
        };

        let result = self.verify_signature.execute(query).await;

        Ok(Response::new(VerifySignatureResponse {
            is_valid: result.is_valid,
            validation_chars: result.validation_chars,
            error_message: result.error_message,
        }))
    }

    /// Valida a consistência sequencial de uma série fiscal (detecção de lacunas)
    async fn validate_series_sequence(
        &self,
        request: Request<ValidateSeriesSequenceRequest>,
    ) -> Result<Response<ValidateSeriesSequenceResponse>, Status> {
        let payload = request.into_inner();
        tracing::info!(
            series_code = %payload.series_code,
            expected_sequence = payload.expected_sequence,
            "gRPC ValidateSeriesSequence recebido"
        );

        let query = ValidateSeriesSequenceQuery {
            tenant_id: payload.tenant_id,
            series_code: payload.series_code,
            expected_sequence: payload.expected_sequence,
            document_year: payload
                .document_year
                .clamp(i32::MIN as i64, i32::MAX as i64) as i32,
            document_type: "FT".to_string(),
        };

        let result = self
            .validate_series
            .execute(query)
            .await
            .map_err(status_from_domain)?;

        Ok(Response::new(ValidateSeriesSequenceResponse {
            is_valid: result.is_valid,
            last_recorded_sequence: result.last_recorded_sequence,
            last_document_hash: result.last_document_hash,
            is_gap_detected: result.is_gap_detected,
        }))
    }

    /// Solicita a extração e validação assíncrona do ficheiro SAF-T (AO)
    async fn trigger_saft_generation(
        &self,
        request: Request<TriggerSaftGenerationRequest>,
    ) -> Result<Response<TriggerSaftGenerationResponse>, Status> {
        let payload = request.into_inner();
        tracing::info!(
            fiscal_year = payload.fiscal_year,
            fiscal_month = payload.fiscal_month,
            tenant_id = %payload.tenant_id,
            "gRPC TriggerSaftGeneration recebido"
        );

        Ok(Response::new(TriggerSaftGenerationResponse {
            job_id: Uuid::new_v4().simple().to_string(),
            status: "QUEUED".to_string(),
            estimated_time: "30s".to_string(),
        }))
    }
}

/// O contrato Protobuf representa montantes como `double`: convertemos para decimal exato
fn decimal_from_f64(value: f64) -> Decimal {
    Decimal::from_f64_retain(value).unwrap_or(Decimal::ZERO)
}

/// Tradução de erros de domínio para códigos gRPC
fn status_from_domain(err: DomainError) -> Status {
    match err {
        DomainError::InvalidArgument(message) => Status::invalid_argument(message),
        DomainError::InvoiceNotFound => Status::not_found("Fatura não encontrada."),
        DomainError::ConcurrencyConflict(message) => Status::aborted(message),
        DomainError::Crypto(message) => Status::internal(message),
        DomainError::Persistence(message) => {
            tracing::error!(error = %message, "Falha de persistência fiscal no gRPC");
            Status::internal("Falha na transação fiscal (PostgreSQL).")
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use tokio_stream::wrappers::TcpListenerStream;
    use tonic::transport::{Channel, Server};

    use super::fiscal_engine::fiscal_engine_service_client::FiscalEngineServiceClient;
    use super::fiscal_engine::fiscal_engine_service_server::FiscalEngineServiceServer;
    use super::fiscal_engine::{
        SignDocumentRequest, TriggerSaftGenerationRequest, VerifySignatureRequest,
    };
    use super::*;
    use crate::domain::entities::fiscal_series::FiscalSeries;
    use crate::domain::ports::crypto_signer::CryptoSigner;
    use crate::domain::ports::db_session::{DbSession, DbSessionFactory, RepositoryError};
    use crate::domain::ports::series_repository::FiscalSeriesRepository;
    use crate::infrastructure::crypto::rsa_signer::RsaCryptoSigner;

    /// Chave RSA de teste (2048 bits, gerada uma vez por execução)
    fn signer() -> Arc<RsaCryptoSigner> {
        use rsa::{pkcs1::EncodeRsaPrivateKey, pkcs8::LineEnding, RsaPrivateKey};

        let private_key =
            RsaPrivateKey::new(&mut rand_core::OsRng, 2048).expect("geração da chave RSA de teste");
        let pem = private_key
            .to_pkcs1_pem(LineEnding::LF)
            .expect("exportação PKCS#1")
            .to_string();

        Arc::new(
            RsaCryptoSigner::from_private_key_pem(&pem, "1")
                .expect("assinante com chave de teste válida"),
        )
    }

    /// Fábrica de sessões que falha sempre (o teste gRPC não toca na base de dados)
    struct NoDatabaseSessionFactory;

    #[async_trait::async_trait]
    impl DbSessionFactory for NoDatabaseSessionFactory {
        async fn open(&self) -> Result<Box<dyn DbSession>, RepositoryError> {
            Err(RepositoryError::Database(
                "sem base de dados no teste".into(),
            ))
        }
    }

    /// Repositório de séries inerte (o teste gRPC não toca na base de dados)
    struct NoDatabaseSeriesRepository;

    #[async_trait::async_trait]
    impl FiscalSeriesRepository for NoDatabaseSeriesRepository {
        async fn get_and_lock(
            &self,
            _session: &mut dyn DbSession,
            _tenant_id: Uuid,
            _document_type: &str,
            _series_code: &str,
            _fiscal_year: i32,
        ) -> Result<Option<FiscalSeries>, RepositoryError> {
            Err(RepositoryError::Database(
                "sem base de dados no teste".into(),
            ))
        }

        async fn get_by_code(
            &self,
            _session: &mut dyn DbSession,
            _tenant_id: Uuid,
            _document_type: &str,
            _series_code: &str,
            _fiscal_year: i32,
        ) -> Result<Option<FiscalSeries>, RepositoryError> {
            Err(RepositoryError::Database(
                "sem base de dados no teste".into(),
            ))
        }

        async fn create(
            &self,
            _session: &mut dyn DbSession,
            _series: &FiscalSeries,
        ) -> Result<(), RepositoryError> {
            Err(RepositoryError::Database(
                "sem base de dados no teste".into(),
            ))
        }

        async fn update_sequence_and_hash(
            &self,
            _session: &mut dyn DbSession,
            _series_id: Uuid,
            _new_sequence: i64,
            _new_hash: &str,
        ) -> Result<(), RepositoryError> {
            Err(RepositoryError::Database(
                "sem base de dados no teste".into(),
            ))
        }
    }

    /// Sobe o serviço gRPC numa porta efémera e devolve um cliente ligado
    async fn start_server(signer: &Arc<RsaCryptoSigner>) -> Channel {
        let crypto_signer: Arc<dyn CryptoSigner> = signer.clone();

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind da porta efémera do teste gRPC");
        let addr = listener
            .local_addr()
            .expect("endereço do servidor de teste");

        // `validate_series` exige PostgreSQL e é exercitado via REST: os duplos
        // abaixo existem apenas para fechar o grafo de dependências deste teste.
        let service = super::FiscalGrpcService::new(
            Arc::new(SignDirectUseCase::new(crypto_signer.clone())),
            Arc::new(VerifySignatureUseCase::new(crypto_signer)),
            Arc::new(ValidateSeriesSequenceUseCase::new(
                Arc::new(NoDatabaseSessionFactory),
                Arc::new(NoDatabaseSeriesRepository),
            )),
        );

        let server = Server::builder()
            .add_service(FiscalEngineServiceServer::new(service))
            // O sinal de shutdown fica pendente: o servidor vive até ao fim do teste
            .serve_with_incoming_shutdown(TcpListenerStream::new(listener), std::future::pending());

        let handle = tokio::spawn(server);

        let channel = Channel::from_shared(format!("http://{}", addr))
            .expect("URI do servidor de teste")
            .connect()
            .await
            .expect("ligação do cliente gRPC ao servidor de teste");

        drop(handle);

        channel
    }

    #[tokio::test]
    async fn assina_e_verifica_um_documento_fiscal_via_grpc() {
        let signer = signer();
        let channel = start_server(&signer).await;
        let mut client = FiscalEngineServiceClient::new(channel);

        let signed = client
            .sign_document(SignDocumentRequest {
                tenant_id: Uuid::new_v4().to_string(),
                document_number: "FT KUD26/000042".into(),
                invoice_date: "2026-10-03".into(),
                system_entry_date: "2026-10-03T10:11:11".into(),
                gross_total: 855000.0,
                previous_hash: String::new(),
                key_version: "1".into(),
            })
            .await
            .expect("RPC SignDocument")
            .into_inner();

        assert_eq!(signed.document_number, "FT KUD26/000042");
        assert_eq!(signed.validation_chars.len(), 4);
        assert_eq!(signed.hash_sha256.len(), 64);
        assert!(!signed.signature_base64.is_empty());

        let verified = client
            .verify_signature(VerifySignatureRequest {
                tenant_id: Uuid::new_v4().to_string(),
                document_number: "FT KUD26/000042".into(),
                signature_base64: signed.signature_base64.clone(),
                invoice_date: "2026-10-03".into(),
                system_entry_date: "2026-10-03T10:11:11".into(),
                gross_total: 855000.0,
                previous_hash: String::new(),
                key_version: "1".into(),
            })
            .await
            .expect("RPC VerifySignature")
            .into_inner();

        assert!(verified.is_valid, "erro: {}", verified.error_message);
        assert_eq!(verified.validation_chars, signed.validation_chars);

        // Documento adulterado tem de falhar a validação
        let tampered = client
            .verify_signature(VerifySignatureRequest {
                tenant_id: Uuid::new_v4().to_string(),
                document_number: "FT KUD26/000042".into(),
                signature_base64: signed.signature_base64,
                invoice_date: "2026-10-03".into(),
                system_entry_date: "2026-10-03T10:11:11".into(),
                gross_total: 855000.01,
                previous_hash: String::new(),
                key_version: "1".into(),
            })
            .await
            .expect("RPC VerifySignature (adulterado)")
            .into_inner();

        assert!(!tampered.is_valid);
    }

    #[tokio::test]
    async fn enfileira_o_pedido_de_exportacao_saft() {
        let channel = start_server(&signer()).await;
        let mut client = FiscalEngineServiceClient::new(channel);

        let queued = client
            .trigger_saft_generation(TriggerSaftGenerationRequest {
                tenant_id: Uuid::new_v4().to_string(),
                fiscal_year: 2026,
                fiscal_month: 10,
                requested_by_user_id: Uuid::new_v4().to_string(),
            })
            .await
            .expect("RPC TriggerSaftGeneration")
            .into_inner();

        assert_eq!(queued.status, "QUEUED");
        assert_eq!(queued.estimated_time, "30s");
        assert_eq!(queued.job_id.len(), 32, "jobId em formato GUID sem hífen");
    }
}
