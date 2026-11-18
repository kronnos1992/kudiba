use axum::http::HeaderMap;
use chrono::Utc;
use ring::digest;
use serde_json::Value;

pub const MAX_SIGNATURE_AGE_SECS: i64 = 300;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerifyError {
    Missing,
    Duplicated,
    InvalidTimestamp,
    Expired,
    InvalidSignature,
}

fn hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

pub fn body_digest(body: &[u8]) -> String {
    hex(digest::digest(&digest::SHA256, body).as_ref())
}

pub fn signature_canonical(
    timestamp: &str,
    method: &str,
    path: &str,
    query: &str,
    body: &[u8],
) -> String {
    format!(
        "{}:{}:{}:{}:{}",
        timestamp,
        method,
        path,
        query,
        body_digest(body)
    )
}

pub fn compute_signature(
    secret: &str,
    timestamp: &str,
    method: &str,
    path: &str,
    query: &str,
    body: &[u8],
) -> String {
    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret.as_bytes());
    let canonical = signature_canonical(timestamp, method, path, query, body);
    hex(ring::hmac::sign(&key, canonical.as_bytes()).as_ref())
}

fn decode_hex(value: &str) -> Option<Vec<u8>> {
    if !value.len().is_multiple_of(2) {
        return None;
    }
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|chunk| {
            std::str::from_utf8(chunk)
                .ok()
                .and_then(|pair| u8::from_str_radix(pair, 16).ok())
        })
        .collect()
}

fn single_header<'a>(headers: &'a HeaderMap, name: &str) -> Result<&'a str, VerifyError> {
    let mut values = headers.get_all(name).iter();
    let value = values.next().ok_or(VerifyError::Missing)?;
    if values.next().is_some() {
        return Err(VerifyError::Duplicated);
    }
    value
        .to_str()
        .map(str::trim)
        .map_err(|_| VerifyError::Missing)
}

pub fn verify_signature(
    headers: &HeaderMap,
    secret: &str,
    method: &str,
    path: &str,
    query: &str,
    body: &[u8],
) -> Result<(), VerifyError> {
    let timestamp = single_header(headers, "X-Gateway-Timestamp")?;
    let timestamp_secs: i64 = timestamp
        .parse()
        .map_err(|_| VerifyError::InvalidTimestamp)?;
    if (Utc::now().timestamp() - timestamp_secs).abs() > MAX_SIGNATURE_AGE_SECS {
        return Err(VerifyError::Expired);
    }

    let provided = decode_hex(single_header(headers, "X-Gateway-Signature")?)
        .ok_or(VerifyError::InvalidSignature)?;
    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret.as_bytes());
    let canonical = signature_canonical(timestamp, method, path, query, body);
    ring::hmac::verify(&key, canonical.as_bytes(), &provided)
        .map_err(|_| VerifyError::InvalidSignature)
}

pub fn canonical_json_bytes(value: &Value) -> Result<Vec<u8>, serde_json::Error> {
    serde_json::to_vec(value)
}

pub fn compute_payload_signature(secret: &str, payload: &[u8]) -> String {
    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret.as_bytes());
    hex(ring::hmac::sign(&key, payload).as_ref())
}

pub fn verify_payload_signature(secret: &str, payload: &[u8], signature: &str) -> bool {
    let Some(provided) = decode_hex(signature) else {
        return false;
    };
    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret.as_bytes());
    ring::hmac::verify(&key, payload, &provided).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(timestamp: &str, signature: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert("X-Gateway-Timestamp", timestamp.parse().unwrap());
        headers.insert("X-Gateway-Signature", signature.parse().unwrap());
        headers
    }

    fn now() -> String {
        Utc::now().timestamp().to_string()
    }

    #[test]
    fn accepts_a_fresh_valid_signature() {
        let timestamp = now();
        let signature = compute_signature(
            "secret",
            &timestamp,
            "POST",
            "/api/v1/treasury/x",
            "",
            br#"{"amount":"1"}"#,
        );
        assert!(verify_signature(
            &headers(&timestamp, &signature),
            "secret",
            "POST",
            "/api/v1/treasury/x",
            "",
            br#"{"amount":"1"}"#,
        )
        .is_ok());
    }

    #[test]
    fn rejects_a_tampered_body() {
        let timestamp = now();
        let signature = compute_signature(
            "secret",
            &timestamp,
            "POST",
            "/api/v1/treasury/x",
            "",
            br#"{"amount":"1"}"#,
        );
        assert_eq!(
            verify_signature(
                &headers(&timestamp, &signature),
                "secret",
                "POST",
                "/api/v1/treasury/x",
                "",
                br#"{"amount":"2"}"#,
            ),
            Err(VerifyError::InvalidSignature)
        );
    }

    #[test]
    fn rejects_a_tampered_query() {
        let timestamp = now();
        let signature = compute_signature(
            "secret",
            &timestamp,
            "GET",
            "/api/v1/invoices",
            "limit=10",
            b"",
        );
        assert_eq!(
            verify_signature(
                &headers(&timestamp, &signature),
                "secret",
                "GET",
                "/api/v1/invoices",
                "limit=20",
                b"",
            ),
            Err(VerifyError::InvalidSignature)
        );
    }

    #[test]
    fn rejects_a_stale_timestamp() {
        let stale = (Utc::now().timestamp() - MAX_SIGNATURE_AGE_SECS - 1).to_string();
        let signature = compute_signature("secret", &stale, "GET", "/x", "", b"");
        assert_eq!(
            verify_signature(&headers(&stale, &signature), "secret", "GET", "/x", "", b""),
            Err(VerifyError::Expired)
        );
    }

    #[test]
    fn rejects_duplicated_signature_headers() {
        let timestamp = now();
        let signature = compute_signature("secret", &timestamp, "GET", "/x", "", b"");
        let mut duplicated = headers(&timestamp, &signature);
        duplicated.append("X-Gateway-Signature", signature.parse().unwrap());
        assert_eq!(
            verify_signature(&duplicated, "secret", "GET", "/x", "", b""),
            Err(VerifyError::Duplicated)
        );
    }

    #[test]
    fn payload_signature_uses_canonical_json() {
        let value = serde_json::json!({ "b": 2, "a": 1 });
        let other = serde_json::json!({ "a": 1, "b": 2 });
        let payload = canonical_json_bytes(&value).unwrap();
        assert_eq!(payload, canonical_json_bytes(&other).unwrap());
        let signature = compute_payload_signature("secret", &payload);
        assert!(verify_payload_signature("secret", &payload, &signature));
        assert!(!verify_payload_signature("secret", b"other", &signature));
    }
}
