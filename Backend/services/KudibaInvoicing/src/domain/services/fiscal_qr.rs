//! Gerador de Código QR Fiscal em Conformidade com a AGT de Angola
//!
//! Conforme as directrizes da Administração Geral Tributária (AGT) e o
//! Decreto Presidencial n.º 71/25, as faturas e documentos equivalentes
//! devem conter uma representação bidimensional (QR Code) contendo os dados
//! essenciais do documento para validação tributária por agentes e consumidores.

use qrcode::{Color, QrCode};

use crate::domain::entities::invoice::{Invoice, CONSUMIDOR_FINAL};
use crate::domain::error::DomainError;

pub struct AgtQrCodeService;

impl AgtQrCodeService {
    /// Constrói a string canónica do QR Code fiscal nos moldes regulamentares da AGT:
    ///
    /// Formato:
    /// `A:NIF_EMITENTE*B:NIF_ADQUIRENTE*C:PAIS*D:TIPO*E:ESTADO*F:DATA*G:NUMERO*H:ATCUD*I1:PAIS_IMP*I7:BASE*I8:IVA*N:SELO*O:TOTAL*Q:VAL_CHARS*R:CERT_NUM`
    pub fn build_payload(invoice: &Invoice, software_cert: &str) -> String {
        let issuer_nif = invoice
            .issuer_nif
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or("999999999");

        let customer_nif = {
            let n = invoice.customer_nif.trim();
            if n.is_empty() || n.eq_ignore_ascii_case(CONSUMIDOR_FINAL) {
                "999999999"
            } else {
                n
            }
        };

        let customer_country = invoice
            .customer_country
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or("AO");

        let doc_type = invoice.document_type.trim().to_uppercase();
        let status = "N"; // N = Normal
        let doc_date = invoice.issued_at.format("%Y-%m-%d").to_string();
        let doc_number = invoice.document_number.trim();
        let atcud = "0";
        let tax_country = "AO";

        let net_total = format!("{:.2}", invoice.net_total);
        let tax_total = format!("{:.2}", invoice.tax_total);
        let stamp_duty = format!("{:.2}", invoice.stamp_duty_total);
        let gross_total = format!("{:.2}", invoice.gross_total);
        let validation_chars = invoice.validation_chars.trim();
        let cert_number = software_cert.trim();

        format!(
            "A:{issuer_nif}*B:{customer_nif}*C:{customer_country}*D:{doc_type}*E:{status}*F:{doc_date}*G:{doc_number}*H:{atcud}*I1:{tax_country}*I7:{net_total}*I8:{tax_total}*N:{stamp_duty}*O:{gross_total}*Q:{validation_chars}*R:{cert_number}"
        )
    }

    /// Gera a matriz bidimensional de módulos (true = preto, false = branco)
    pub fn generate_matrix(payload: &str) -> Result<Vec<Vec<bool>>, DomainError> {
        let code = QrCode::new(payload.as_bytes())
            .map_err(|err| DomainError::invalid(format!("Falha ao compilar QR Code: {err}")))?;

        let width = code.width();
        let colors = code.to_colors();

        let mut matrix = Vec::with_capacity(width);
        for y in 0..width {
            let mut row = Vec::with_capacity(width);
            for x in 0..width {
                let is_dark = colors[y * width + x] == Color::Dark;
                row.push(is_dark);
            }
            matrix.push(row);
        }

        Ok(matrix)
    }

    /// Renderiza uma representação vetorial SVG do QR Code
    pub fn generate_svg(payload: &str, module_size_px: u32) -> Result<String, DomainError> {
        let matrix = Self::generate_matrix(payload)?;
        let width = matrix.len();
        let quiet_zone = 2; // Margem de segurança de 2 módulos
        let total_modules = width + quiet_zone * 2;
        let total_size = total_modules as u32 * module_size_px;

        let mut svg = format!(
            r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_size} {total_size}" width="{total_size}" height="{total_size}">"##,
        );
        svg.push_str(r##"<rect width="100%" height="100%" fill="#FFFFFF"/>"##);

        for (y, row) in matrix.iter().enumerate() {
            for (x, &is_dark) in row.iter().enumerate() {
                if is_dark {
                    let px = (x + quiet_zone) as u32 * module_size_px;
                    let py = (y + quiet_zone) as u32 * module_size_px;
                    svg.push_str(&format!(
                        r##"<rect x="{px}" y="{py}" width="{module_size_px}" height="{module_size_px}" fill="#000000"/>"##
                    ));
                }
            }
        }

        svg.push_str("</svg>");
        Ok(svg)
    }

    /// Renderiza o QR Code em caracteres ASCII/Unicode compactos
    /// Ideal para talões térmicos (80mm) ou saída de consola
    pub fn generate_ascii(payload: &str) -> Result<String, DomainError> {
        let code = QrCode::new(payload.as_bytes())
            .map_err(|err| DomainError::invalid(format!("Falha ao gerar QR Code ASCII: {err}")))?;

        // Rendezação usando blocos unicode compactos
        Ok(code.render::<char>().quiet_zone(true).module_dimensions(2, 1).build())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use chrono::Utc;
    use rust_decimal::Decimal;
    use uuid::Uuid;

    fn sample_invoice() -> Invoice {
        Invoice {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            issuer_nif: Some("5412345678".to_string()),
            issuer_address: Some("Rua Direita de Luanda, 100".to_string()),
            issuer_city: Some("Luanda".to_string()),
            issuer_country: Some("AO".to_string()),
            series_id: Uuid::new_v4(),
            document_number: "FT KUD26/000042".to_string(),
            sequence_number: 42,
            document_type: "FT".to_string(),
            customer_name: "Empresa Cliente Lda".to_string(),
            customer_nif: "5498765432".to_string(),
            customer_address: Some("Talatona".to_string()),
            customer_city: Some("Luanda".to_string()),
            customer_country: Some("AO".to_string()),
            source_document_number: None,
            payment_methods: vec!["TRANSFERENCIA".to_string()],
            currency: "AOA".to_string(),
            net_total: Decimal::new(10000000, 2),
            tax_total: Decimal::new(1400000, 2),
            gross_total: Decimal::new(11400000, 2),
            withholding_total: Decimal::new(650000, 2),
            stamp_duty_total: Decimal::new(100000, 2),
            amount_due: Decimal::new(10850000, 2),
            hash_sha256: "abcdef1234567890abcdef1234567890".to_string(),
            signature_rsa_base64: "a8b2c3d4...".to_string(),
            validation_chars: "a8b2".to_string(),
            key_version: "1".to_string(),
            is_contingency: false,
            tax_regime_code: "GERAL".to_string(),
            issued_at: Utc.with_ymd_and_hms(2026, 10, 7, 14, 30, 0).unwrap(),
            system_entry_date: Utc.with_ymd_and_hms(2026, 10, 7, 14, 30, 0).unwrap(),
            created_at: Utc.with_ymd_and_hms(2026, 10, 7, 14, 30, 0).unwrap(),
            lines: vec![],
            transport: None,
        }
    }

    #[test]
    fn constroi_payload_canonico_agt() {
        let invoice = sample_invoice();
        let payload = AgtQrCodeService::build_payload(&invoice, "999/AGT/2026");

        assert!(payload.starts_with("A:5412345678*B:5498765432*C:AO*D:FT*E:N*F:2026-10-07*G:FT KUD26/000042"));
        assert!(payload.contains("*H:0*I1:AO*I7:100000.00*I8:14000.00*N:1000.00*O:114000.00*Q:a8b2*R:999/AGT/2026"));
    }

    #[test]
    fn trata_consumidor_final_com_nif_generico() {
        let mut invoice = sample_invoice();
        invoice.customer_nif = CONSUMIDOR_FINAL.to_string();

        let payload = AgtQrCodeService::build_payload(&invoice, "999/AGT/2026");
        assert!(payload.contains("*B:999999999*"));
    }

    #[test]
    fn gera_matriz_svg_e_ascii_validos() {
        let invoice = sample_invoice();
        let payload = AgtQrCodeService::build_payload(&invoice, "999/AGT/2026");

        let matrix = AgtQrCodeService::generate_matrix(&payload).expect("matriz QR");
        assert!(!matrix.is_empty());
        assert_eq!(matrix.len(), matrix[0].len());

        let svg = AgtQrCodeService::generate_svg(&payload, 4).expect("SVG QR");
        assert!(svg.starts_with("<svg"));
        assert!(svg.ends_with("</svg>"));

        let ascii = AgtQrCodeService::generate_ascii(&payload).expect("ASCII QR");
        assert!(!ascii.is_empty());
    }
}
