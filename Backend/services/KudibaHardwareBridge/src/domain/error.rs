use thiserror::Error;

use crate::domain::job::PrintState;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum DeviceError {
    #[error("transporte indisponível: {0}")]
    TransportUnavailable(String),
    #[error("dispositivo ocupado: {0}")]
    Busy(String),
    #[error("perfil inválido: {0}")]
    InvalidProfile(String),
    #[error("transição de estado inválida: {0:?} -> {1:?}")]
    InvalidTransition(PrintState, PrintState),
    #[error("chave de idempotência inválida")]
    InvalidIdempotencyKey,
    #[error("campo obrigatório vazio: {0}")]
    EmptyField(&'static str),
    #[error("emparelhamento expirado")]
    PairingExpired,
    #[error("código de emparelhamento inválido")]
    PairingInvalid,
    #[error("demasiadas tentativas de emparelhamento")]
    PairingLocked,
    #[error("agente local ainda não emparelhado")]
    NotPaired,
    #[error("token já emparelhado; rotação não disponível neste modo")]
    FixedToken,
}
