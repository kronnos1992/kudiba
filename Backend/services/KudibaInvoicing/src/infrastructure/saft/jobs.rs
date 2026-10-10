//! Gestor de Trabalhos Assíncronos de Geração SAF-T (AO)
//!
//! Permite o processamento desacoplado de grandes volumes de dados fiscais
//! sem bloqueio do cliente gRPC ou REST, com persistência em memória concorrente
//! e notificação de conclusão.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Estado do trabalho de geração do SAF-T
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SaftJobStatus {
    Queued,
    Processing,
    Completed,
    Failed,
}

impl SaftJobStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Queued => "QUEUED",
            Self::Processing => "PROCESSING",
            Self::Completed => "COMPLETED",
            Self::Failed => "FAILED",
        }
    }
}

/// Metadados e resultado de um trabalho SAF-T
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaftJobInfo {
    pub job_id: String,
    pub tenant_id: Uuid,
    pub fiscal_year: i32,
    pub fiscal_month: Option<u32>,
    pub status: String,
    pub filename: Option<String>,
    pub invoice_count: Option<usize>,
    pub total_gross: Option<Decimal>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(skip)]
    pub xml_content: Option<String>,
}

/// Registo seguro e concorrente de trabalhos SAF-T
#[derive(Clone, Default)]
pub struct SaftJobRegistry {
    jobs: Arc<RwLock<HashMap<String, SaftJobInfo>>>,
}

impl SaftJobRegistry {
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Cria e enfileira um novo trabalho de exportação
    pub fn enqueue(
        &self,
        tenant_id: Uuid,
        fiscal_year: i32,
        fiscal_month: Option<u32>,
    ) -> String {
        let job_id = Uuid::new_v4().simple().to_string();
        let job = SaftJobInfo {
            job_id: job_id.clone(),
            tenant_id,
            fiscal_year,
            fiscal_month,
            status: SaftJobStatus::Queued.as_str().to_string(),
            filename: None,
            invoice_count: None,
            total_gross: None,
            error: None,
            created_at: Utc::now(),
            completed_at: None,
            xml_content: None,
        };

        if let Ok(mut map) = self.jobs.write() {
            map.insert(job_id.clone(), job);
        }
        job_id
    }

    /// Marca o início do processamento do ficheiro pesado
    pub fn mark_processing(&self, job_id: &str) {
        if let Ok(mut map) = self.jobs.write() {
            if let Some(job) = map.get_mut(job_id) {
                job.status = SaftJobStatus::Processing.as_str().to_string();
            }
        }
    }

    /// Marca o trabalho como concluído com sucesso
    pub fn mark_completed(
        &self,
        job_id: &str,
        filename: String,
        invoice_count: usize,
        total_gross: Decimal,
        xml_content: String,
    ) {
        if let Ok(mut map) = self.jobs.write() {
            if let Some(job) = map.get_mut(job_id) {
                job.status = SaftJobStatus::Completed.as_str().to_string();
                job.filename = Some(filename);
                job.invoice_count = Some(invoice_count);
                job.total_gross = Some(total_gross);
                job.xml_content = Some(xml_content);
                job.completed_at = Some(Utc::now());
            }
        }
    }

    /// Marca o trabalho com falha de validação ou de base de dados
    pub fn mark_failed(&self, job_id: &str, error: String) {
        if let Ok(mut map) = self.jobs.write() {
            if let Some(job) = map.get_mut(job_id) {
                job.status = SaftJobStatus::Failed.as_str().to_string();
                job.error = Some(error);
                job.completed_at = Some(Utc::now());
            }
        }
    }

    /// Consulta o estado de um trabalho pelo seu identificador
    pub fn get_job(&self, job_id: &str) -> Option<SaftJobInfo> {
        let map = self.jobs.read().ok()?;
        map.get(job_id).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gere_ciclo_de_vida_completo_de_trabalho_saft() {
        let registry = SaftJobRegistry::new();
        let tenant_id = Uuid::new_v4();

        // 1. Enfileirar
        let job_id = registry.enqueue(tenant_id, 2026, Some(10));
        let job = registry.get_job(&job_id).expect("trabalho deve existir");
        assert_eq!(job.status, "QUEUED");
        assert_eq!(job.tenant_id, tenant_id);
        assert_eq!(job.fiscal_year, 2026);
        assert_eq!(job.fiscal_month, Some(10));
        assert!(job.completed_at.is_none());

        // 2. Marcar em processamento
        registry.mark_processing(&job_id);
        let job = registry.get_job(&job_id).expect("trabalho deve existir");
        assert_eq!(job.status, "PROCESSING");

        // 3. Concluir com sucesso
        let xml = "<AuditFile>...</AuditFile>".to_string();
        let total = Decimal::new(125000050, 2);
        registry.mark_completed(
            &job_id,
            "SAFT_AO_2026_10.xml".to_string(),
            42,
            total,
            xml.clone(),
        );

        let job = registry.get_job(&job_id).expect("trabalho deve existir");
        assert_eq!(job.status, "COMPLETED");
        assert_eq!(job.filename.as_deref(), Some("SAFT_AO_2026_10.xml"));
        assert_eq!(job.invoice_count, Some(42));
        assert_eq!(job.total_gross, Some(total));
        assert_eq!(job.xml_content.as_deref(), Some(xml.as_str()));
        assert!(job.completed_at.is_some());
    }

    #[test]
    fn marca_trabalho_com_falha() {
        let registry = SaftJobRegistry::new();
        let tenant_id = Uuid::new_v4();

        let job_id = registry.enqueue(tenant_id, 2026, None);
        registry.mark_failed(&job_id, "Erro de ligação à base de dados".to_string());

        let job = registry.get_job(&job_id).expect("trabalho deve existir");
        assert_eq!(job.status, "FAILED");
        assert_eq!(
            job.error.as_deref(),
            Some("Erro de ligação à base de dados")
        );
        assert!(job.completed_at.is_some());
    }
}

