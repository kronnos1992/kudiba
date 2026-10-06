//! Normalização das datas fiscais recebidas em texto (contratos gRPC e
//! integrações de POS offline-first).
use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};

/// Interpreta a data de emissão do documento (`YYYY-MM-DD` ou RFC 3339)
pub fn parse_invoice_date(raw: &str) -> NaiveDate {
    parse_datetime(raw)
        .map(|value| value.date_naive())
        .unwrap_or_else(|| Utc::now().date_naive())
}

/// Interpreta a data/hora de registo no sistema (`YYYY-MM-DDTHH:MM:SS` ou RFC 3339)
pub fn parse_system_entry_date(raw: &str) -> DateTime<Utc> {
    parse_datetime(raw).unwrap_or_else(Utc::now)
}

fn parse_datetime(raw: &str) -> Option<DateTime<Utc>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(parsed) = DateTime::parse_from_rfc3339(trimmed) {
        return Some(parsed.with_timezone(&Utc));
    }

    const DATETIME_FORMATS: [&str; 3] = [
        "%Y-%m-%dT%H:%M:%S%.f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
    ];

    for format in DATETIME_FORMATS {
        if let Ok(naive) = NaiveDateTime::parse_from_str(trimmed, format) {
            return Some(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc));
        }
    }

    NaiveDate::parse_from_str(trimmed, "%Y-%m-%d")
        .ok()
        .and_then(|date| date.and_hms_opt(0, 0, 0))
        .map(|naive| DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interpreta_formatos_de_data_suportados() {
        assert_eq!(parse_invoice_date("2026-10-03").to_string(), "2026-10-03");
        assert_eq!(
            parse_invoice_date("2026-10-03T10:11:11Z").to_string(),
            "2026-10-03"
        );
        assert_eq!(
            parse_system_entry_date("2026-10-03T10:11:11").to_rfc3339(),
            "2026-10-03T10:11:11+00:00"
        );
    }

    #[test]
    fn faz_fallback_para_o_presente_em_payloads_invalidos() {
        assert_eq!(
            parse_invoice_date("").to_string(),
            Utc::now().date_naive().to_string()
        );
    }
}
