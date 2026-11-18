use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;
use std::time::Duration;

use chrono::{DateTime, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use subtle::ConstantTimeEq;
use uuid::Uuid;

use crate::domain::error::DeviceError;

const PAIRING_TTL: Duration = Duration::from_secs(300);
const MAX_PAIRING_ATTEMPTS: u8 = 5;
const PAIRING_LOCKOUT: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCredential {
    pub token: String,
    pub tenant_id: Uuid,
    pub label: String,
    pub paired_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
struct PairingChallenge {
    code: String,
    expires_at: DateTime<Utc>,
    attempts: u8,
}

#[derive(Debug, Clone)]
enum PairingState {
    Idle,
    Challenge(PairingChallenge),
    LockedUntil(DateTime<Utc>),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingStatus {
    pub paired: bool,
    pub awaiting_code: bool,
    pub locked: bool,
    pub lockout_until: Option<DateTime<Utc>>,
}

pub struct CredentialStore {
    credential: RwLock<Option<DeviceCredential>>,
    pairing: RwLock<PairingState>,
    path: Option<PathBuf>,
    fixed: bool,
}

impl CredentialStore {
    pub fn new(env_token: Option<String>, path: Option<PathBuf>) -> Result<Self, DeviceError> {
        if let Some(token) = env_token {
            if !is_lowercase_hex_64(&token) {
                return Err(DeviceError::InvalidProfile(
                    "KUDIBA_BRIDGE_TOKEN deve ter exatamente 64 caracteres hex minúsculos"
                        .to_string(),
                ));
            }
            let tenant_id = env::var("KUDIBA_BRIDGE_TENANT_ID")
                .ok()
                .and_then(|value| Uuid::parse_str(value.trim()).ok())
                .ok_or_else(|| {
                    DeviceError::InvalidProfile(
                        "KUDIBA_BRIDGE_TENANT_ID é obrigatório e deve ser um UUID válido"
                            .to_string(),
                    )
                })?;
            return Ok(Self {
                credential: RwLock::new(Some(DeviceCredential {
                    token,
                    tenant_id,
                    label: "token estático por variável de ambiente".to_string(),
                    paired_at: Utc::now(),
                })),
                pairing: RwLock::new(PairingState::Idle),
                path,
                fixed: true,
            });
        }

        let stored = match path.as_ref() {
            Some(file) if file.exists() => {
                let content = fs::read_to_string(file)
                    .map_err(|_| DeviceError::Busy("credencial local ilegível".to_string()))?;
                let credential: DeviceCredential =
                    serde_json::from_str(&content).map_err(|_| {
                        DeviceError::InvalidProfile("credencial local corrompida".to_string())
                    })?;
                if !is_lowercase_hex_64(&credential.token) {
                    return Err(DeviceError::InvalidProfile(
                        "credencial local inválida".to_string(),
                    ));
                }
                Some(credential)
            }
            _ => None,
        };

        let store = Self {
            credential: RwLock::new(stored),
            pairing: RwLock::new(PairingState::Idle),
            path,
            fixed: false,
        };
        if store.credential.read().unwrap().is_none() {
            store.issue_challenge();
        }
        Ok(store)
    }

    pub fn with_fixed_token(token: impl Into<String>) -> Self {
        Self {
            credential: RwLock::new(Some(DeviceCredential {
                token: token.into(),
                tenant_id: Uuid::nil(),
                label: "teste".to_string(),
                paired_at: Utc::now(),
            })),
            pairing: RwLock::new(PairingState::Idle),
            path: None,
            fixed: true,
        }
    }

    pub fn status(&self) -> PairingStatus {
        let mut pairing = self
            .pairing
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        self.normalize(&mut pairing);
        let (awaiting_code, lockout_until) = match &*pairing {
            PairingState::Challenge(_) => (true, None),
            PairingState::LockedUntil(until) => (false, Some(*until)),
            PairingState::Idle => (false, None),
        };
        PairingStatus {
            paired: self.credential.read().unwrap().is_some(),
            awaiting_code,
            locked: lockout_until.is_some(),
            lockout_until,
        }
    }

    pub fn pending_code(&self) -> Option<String> {
        let mut pairing = self
            .pairing
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        self.normalize(&mut pairing);
        match &*pairing {
            PairingState::Challenge(challenge) => Some(challenge.code.clone()),
            _ => None,
        }
    }

    pub fn current_token(&self) -> Option<String> {
        self.credential
            .read()
            .unwrap()
            .as_ref()
            .map(|credential| credential.token.clone())
    }

    pub fn credential(&self) -> Option<DeviceCredential> {
        self.credential.read().unwrap().clone()
    }

    pub fn pair(&self, code: &str, tenant_id: Uuid, label: &str) -> Result<String, DeviceError> {
        let mut pairing = self
            .pairing
            .write()
            .map_err(|_| DeviceError::Busy("emparelhamento".to_string()))?;
        let now = Utc::now();

        match pairing.clone() {
            PairingState::LockedUntil(until) => {
                if now < until {
                    return Err(DeviceError::PairingLocked);
                }
                *pairing = PairingState::Challenge(self.new_challenge());
            }
            PairingState::Challenge(challenge) if now > challenge.expires_at => {
                *pairing = PairingState::Idle;
                return Err(DeviceError::PairingExpired);
            }
            PairingState::Challenge(_) | PairingState::Idle => {}
        }

        let challenge = match &mut *pairing {
            PairingState::Challenge(challenge) => challenge,
            _ => return Err(DeviceError::NotPaired),
        };

        let matches = bool::from(code.trim().as_bytes().ct_eq(challenge.code.as_bytes()));
        if !matches {
            challenge.attempts += 1;
            if challenge.attempts < MAX_PAIRING_ATTEMPTS {
                return Err(DeviceError::PairingInvalid);
            }
            *pairing = PairingState::LockedUntil(now + PAIRING_LOCKOUT);
            return Err(DeviceError::PairingLocked);
        }

        let credential = DeviceCredential {
            token: random_token(),
            tenant_id,
            label: label.trim().to_string(),
            paired_at: Utc::now(),
        };
        *self
            .credential
            .write()
            .map_err(|_| DeviceError::Busy("credencial".to_string()))? = Some(credential.clone());
        *pairing = PairingState::Idle;
        self.persist(Some(&credential))?;
        Ok(credential.token)
    }

    pub fn regenerate_challenge(&self) -> Result<String, DeviceError> {
        if self.fixed {
            return Err(DeviceError::FixedToken);
        }
        if self.credential.read().unwrap().is_some() {
            return Err(DeviceError::Busy("agente já emparelhado".to_string()));
        }
        Ok(self.issue_challenge())
    }

    pub fn rotate(&self) -> Result<String, DeviceError> {
        if self.fixed {
            return Err(DeviceError::FixedToken);
        }
        let mut guard = self
            .credential
            .write()
            .map_err(|_| DeviceError::Busy("credencial".to_string()))?;
        let credential = guard.as_mut().ok_or(DeviceError::NotPaired)?;
        credential.token = random_token();
        credential.paired_at = Utc::now();
        self.persist(Some(credential))?;
        Ok(credential.token.clone())
    }

    pub fn revoke(&self) -> Result<String, DeviceError> {
        if self.fixed {
            return Err(DeviceError::FixedToken);
        }
        *self
            .credential
            .write()
            .map_err(|_| DeviceError::Busy("credencial".to_string()))? = None;
        self.persist(None)?;
        Ok(self.issue_challenge())
    }

    fn normalize(&self, pairing: &mut PairingState) {
        let now = Utc::now();
        match pairing.clone() {
            PairingState::Challenge(challenge) if now > challenge.expires_at => {
                *pairing = PairingState::Idle;
            }
            PairingState::LockedUntil(until) if now >= until => {
                *pairing = PairingState::Challenge(self.new_challenge());
            }
            _ => {}
        }
    }

    fn new_challenge(&self) -> PairingChallenge {
        let code = rand::thread_rng().gen_range(100000..=999999).to_string();
        PairingChallenge {
            code,
            expires_at: Utc::now() + PAIRING_TTL,
            attempts: 0,
        }
    }

    fn issue_challenge(&self) -> String {
        let challenge = self.new_challenge();
        let code = challenge.code.clone();
        *self
            .pairing
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = PairingState::Challenge(challenge);
        code
    }

    fn persist(&self, credential: Option<&DeviceCredential>) -> Result<(), DeviceError> {
        let Some(path) = self.path.as_ref() else {
            return Ok(());
        };
        if credential.is_none() {
            if path.exists() {
                fs::remove_file(path)
                    .map_err(|_| DeviceError::Busy("remoção da credencial".to_string()))?;
            }
            return Ok(());
        }

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|_| DeviceError::Busy("diretório da credencial".to_string()))?;
        }
        let temporary = path.with_extension("tmp");
        let mut options = fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let file = options
            .open(&temporary)
            .map_err(|_| DeviceError::Busy("escrita da credencial".to_string()))?;
        serde_json::to_writer(file, &credential)
            .map_err(|_| DeviceError::Busy("serialização da credencial".to_string()))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&temporary, fs::Permissions::from_mode(0o600))
                .map_err(|_| DeviceError::Busy("permissões da credencial".to_string()))?;
        }
        fs::rename(&temporary, path)
            .map_err(|_| DeviceError::Busy("renomeação da credencial".to_string()))?;
        Ok(())
    }
}

fn is_lowercase_hex_64(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn random_token() -> String {
    let bytes: [u8; 32] = rand::random();
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_token() -> String {
        "a".repeat(64)
    }

    #[test]
    fn pairing_creates_a_bound_credential_and_rotates_it() {
        let store = CredentialStore::new(None, None).unwrap();
        let code = store.pending_code().unwrap();
        let tenant = Uuid::new_v4();
        let token = store.pair(&code, tenant, "Terminal 1").unwrap();
        assert_eq!(store.current_token().as_deref(), Some(token.as_str()));
        assert_eq!(store.credential().unwrap().tenant_id, tenant);

        let rotated = store.rotate().unwrap();
        assert_ne!(rotated, token);
        assert_eq!(store.current_token().as_deref(), Some(rotated.as_str()));
    }

    #[test]
    fn pairing_code_is_single_use_and_fifth_failure_enters_lockout() {
        let store = CredentialStore::new(None, None).unwrap();
        let code = store.pending_code().unwrap();
        let tenant = Uuid::new_v4();
        store.pair(&code, tenant, "Terminal 1").unwrap();
        assert!(store.pair(&code, tenant, "Terminal 2").is_err());

        let store = CredentialStore::new(None, None).unwrap();
        let code = store.pending_code().unwrap();
        for attempt in 0..MAX_PAIRING_ATTEMPTS {
            let expected = if attempt + 1 == MAX_PAIRING_ATTEMPTS {
                DeviceError::PairingLocked
            } else {
                DeviceError::PairingInvalid
            };
            assert_eq!(store.pair("000000", tenant, "Atacante"), Err(expected));
        }
        assert_eq!(
            store.pair(&code, tenant, "Atacante"),
            Err(DeviceError::PairingLocked)
        );
        assert_eq!(store.pending_code(), None);
        assert!(store.status().locked);
        assert!(store.status().lockout_until.is_some());
    }

    #[test]
    fn expired_challenge_is_absent_from_status_and_pending_code() {
        let store = CredentialStore::new(None, None).unwrap();
        assert!(store.pending_code().is_some());
        {
            let mut pairing = store
                .pairing
                .write()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            *pairing = PairingState::Challenge(PairingChallenge {
                code: "123456".to_string(),
                expires_at: Utc::now() - Duration::from_secs(1),
                attempts: 0,
            });
        }
        assert_eq!(store.pending_code(), None);
        assert!(!store.status().awaiting_code);
    }

    #[test]
    fn static_token_requires_lowercase_hex_64_and_tenant_uuid() {
        env::set_var(
            "KUDIBA_BRIDGE_TENANT_ID",
            "11111111-1111-1111-1111-111111111111",
        );
        assert!(CredentialStore::new(Some(valid_token()), None).is_ok());
        assert!(CredentialStore::new(Some("A".repeat(64)), None).is_err());
        assert!(CredentialStore::new(Some("abc".to_string()), None).is_err());

        env::remove_var("KUDIBA_BRIDGE_TENANT_ID");
        assert!(CredentialStore::new(Some(valid_token()), None).is_err());
        env::set_var("KUDIBA_BRIDGE_TENANT_ID", "not-a-uuid");
        assert!(CredentialStore::new(Some(valid_token()), None).is_err());
        env::remove_var("KUDIBA_BRIDGE_TENANT_ID");
    }
}
