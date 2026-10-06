use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;

/// Buffer canónico aprovado pela AGT para a assinatura digital em cadeia.
///
/// Formato canónico (Decreto Presidencial n.º 71/25):
/// `{DataEmissão};{DataHoraRegisto};{NúmeroDocumento};{TotalBruto};{HashAnterior}`
///
/// A string é serializada em UTF-8 e assinada com RSA-2048 / SHA-256 PKCS#1 v1.5.
/// O primeiro documento da série usa string vazia no lugar de `HashAnterior`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CanonicalBuffer(String);

impl CanonicalBuffer {
    pub fn build(
        invoice_date: NaiveDate,
        system_entry_date: DateTime<Utc>,
        document_number: &str,
        gross_total: Decimal,
        previous_hash: &str,
    ) -> Self {
        let date_part = invoice_date.format("%Y-%m-%d").to_string();
        let entry_part = system_entry_date.format("%Y-%m-%dT%H:%M:%S").to_string();
        let gross_part = format!("{:.2}", gross_total);
        let previous = previous_hash.trim();

        Self(format!(
            "{date_part};{entry_part};{document_number};{gross_part};{previous}"
        ))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for CanonicalBuffer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}
