use crate::domain::error::DomainError;

/// Extrai os 4 caracteres de controlo obrigatórios na impressão do documento fiscal.
///
/// O Decreto Presidencial n.º 71/25 (AGT Angola) determina que os caracteres de
/// validação sejam retirados das posições 1ª, 11ª, 21ª e 31ª da assinatura digital
/// codificada em Base64 (índices 0, 10, 20 e 30 em base zero).
pub fn extract_from_base64_signature(signature_base64: &str) -> Result<String, DomainError> {
    const REQUIRED_LEN: usize = 31;
    const POSITIONS: [usize; 4] = [0, 10, 20, 30];

    if signature_base64.is_empty() {
        return Err(DomainError::invalid(
            "Base64 signature string is too short to extract 4 validation characters (min 31 chars required).",
        ));
    }

    let chars: Vec<char> = signature_base64.chars().collect();
    if chars.len() < REQUIRED_LEN {
        return Err(DomainError::invalid(
            "Base64 signature string is too short to extract 4 validation characters (min 31 chars required).",
        ));
    }

    Ok(POSITIONS
        .iter()
        .map(|index| chars[*index])
        .collect::<String>())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extrai_quatro_caracteres_nas_posicoes_mandadas() {
        // Assinatura RSA-2048 em Base64 tem 344 caracteres
        let signature: String = "A".repeat(344);
        let mut varied = signature.clone();
        varied.replace_range(10..11, "B");
        varied.replace_range(20..21, "C");
        varied.replace_range(30..31, "D");

        assert_eq!(extract_from_base64_signature(&varied).unwrap(), "ABCD");
    }

    #[test]
    fn rejeita_assinatura_curta() {
        assert!(extract_from_base64_signature("abc").is_err());
        assert!(extract_from_base64_signature("").is_err());
    }
}
