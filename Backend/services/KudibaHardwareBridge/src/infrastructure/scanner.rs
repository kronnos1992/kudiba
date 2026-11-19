use std::sync::Mutex;

use async_trait::async_trait;

use crate::domain::error::DeviceError;
use crate::domain::port::ScannerPort;

pub struct BrowserScanner {
    last_code: Mutex<Option<String>>,
}

impl BrowserScanner {
    pub fn new() -> Self {
        Self {
            last_code: Mutex::new(None),
        }
    }
}

impl Default for BrowserScanner {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ScannerPort for BrowserScanner {
    async fn submit(&self, code: &str) -> Result<(), DeviceError> {
        let code = code.trim();
        if code.is_empty() {
            return Err(DeviceError::EmptyField("código de barras"));
        }
        *self
            .last_code
            .lock()
            .map_err(|_| DeviceError::Busy("leitor".to_string()))? = Some(code.to_string());
        tracing::info!(barcode = %code, "código lido pelo leitor");
        Ok(())
    }

    async fn last_code(&self) -> Option<String> {
        self.last_code.lock().ok().and_then(|guard| guard.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn scanner_records_barcode() {
        let scanner = BrowserScanner::new();
        scanner.submit(" 5601234567890\r").await.unwrap();
        assert_eq!(scanner.last_code().await.as_deref(), Some("5601234567890"));
    }

    #[tokio::test]
    async fn scanner_rejects_empty_code() {
        let scanner = BrowserScanner::new();
        assert_eq!(
            scanner.submit(" ").await.unwrap_err(),
            DeviceError::EmptyField("código de barras")
        );
    }
}
