use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::value_objects::{AccountClass, AccountNature};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub account_code: String,
    pub parent_account_code: Option<String>,
    pub account_name: String,
    pub account_class: AccountClass,
    pub account_nature: AccountNature,
    pub is_analytical: bool,
    pub is_system_reserved: bool,
    pub saft_grouping_code: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl Account {
    pub fn new(
        tenant_id: Uuid,
        account_code: String,
        parent_account_code: Option<String>,
        account_name: String,
        account_nature: Option<AccountNature>,
        is_analytical: bool,
        is_system_reserved: bool,
        saft_grouping_code: Option<String>,
    ) -> Result<Self, DomainError> {
        let code = account_code.trim();
        if code.is_empty() {
            return Err(DomainError::ValidationError(
                "Código de conta não pode ser vazio".to_string(),
            ));
        }

        let name = account_name.trim();
        if name.is_empty() {
            return Err(DomainError::ValidationError(
                "Nome da conta não pode ser vazio".to_string(),
            ));
        }

        let account_class = AccountClass::from_account_code(code).ok_or_else(|| {
            DomainError::ValidationError(format!(
                "Código de conta '{}' não pertence a nenhuma das 8 classes do PGC Angolano",
                code
            ))
        })?;

        // Natureza padrão com base na classe do PGC
        let nature = account_nature.unwrap_or_else(|| match account_class {
            AccountClass::Class1MeiosFinanceiros
            | AccountClass::Class2Existencias
            | AccountClass::Class4Imobilizacoes
            | AccountClass::Class6Custos => AccountNature::Debit,
            AccountClass::Class3Terceiros => {
                // Clientes são tipicamente Débito (Activo); Fornecedores e Estado Crédito (Passivo)
                if code.starts_with("31") {
                    AccountNature::Debit
                } else {
                    AccountNature::Credit
                }
            }
            AccountClass::Class5CapitalProprio
            | AccountClass::Class7Proveitos
            | AccountClass::Class8Resultados => AccountNature::Credit,
        });

        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            account_code: code.to_string(),
            parent_account_code: parent_account_code.map(|s| s.trim().to_string()),
            account_name: name.to_string(),
            account_class,
            account_nature: nature,
            is_analytical,
            is_system_reserved,
            saft_grouping_code,
            is_active: true,
            created_at: Utc::now(),
        })
    }
}
