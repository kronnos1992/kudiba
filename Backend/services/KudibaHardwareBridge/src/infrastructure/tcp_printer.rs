use std::time::Duration;

use async_trait::async_trait;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::time::timeout;

use crate::domain::error::DeviceError;
use crate::domain::port::{PrinterPort, TransportOutcome};

pub struct RawTcpPrinter {
    host: String,
    port: u16,
    connect_timeout: Duration,
    write_timeout: Duration,
}

impl RawTcpPrinter {
    pub fn new(host: impl Into<String>, port: u16) -> Self {
        Self {
            host: host.into(),
            port,
            connect_timeout: Duration::from_secs(2),
            write_timeout: Duration::from_secs(5),
        }
    }

    pub fn with_timeouts(mut self, connect: Duration, write: Duration) -> Self {
        self.connect_timeout = connect;
        self.write_timeout = write;
        self
    }
}

#[async_trait]
impl PrinterPort for RawTcpPrinter {
    async fn print_bytes(&self, bytes: &[u8]) -> Result<TransportOutcome, DeviceError> {
        let addr = format!("{}:{}", self.host, self.port);

        let mut stream = timeout(self.connect_timeout, TcpStream::connect(addr.as_str()))
            .await
            .map_err(|_| DeviceError::TransportUnavailable(format!("timeout a ligar a {}", addr)))?
            .map_err(|e| DeviceError::TransportUnavailable(format!("{}: {}", addr, e)))?;

        timeout(self.write_timeout, async {
            stream.write_all(bytes).await?;
            stream.shutdown().await
        })
        .await
        .map_err(|_| DeviceError::TransportUnavailable(format!("timeout a escrever em {}", addr)))?
        .map_err(|e| DeviceError::TransportUnavailable(format!("{}: {}", addr, e)))?;

        Ok(TransportOutcome::TransportAccepted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncReadExt;

    #[tokio::test]
    async fn sends_exact_bytes_and_reports_transport_acceptance() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let expected = vec![
            0x1B, 0x40, b'K', b'U', b'D', b'I', b'B', b'A', 0x1D, 0x56, 0x42, 0x00,
        ];

        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut received = Vec::new();
            socket.read_to_end(&mut received).await.unwrap();
            received
        });

        let printer = RawTcpPrinter::new("127.0.0.1", port);
        let outcome = printer.print_bytes(&expected).await.unwrap();
        let received = server.await.unwrap();

        assert_eq!(outcome, TransportOutcome::TransportAccepted);
        assert_eq!(received, expected);
    }

    #[tokio::test]
    async fn connection_refused_is_a_transport_error() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);

        let printer = RawTcpPrinter::new("127.0.0.1", port);
        assert!(matches!(
            printer.print_bytes(&[0x1B, 0x40]).await,
            Err(DeviceError::TransportUnavailable(_))
        ));
    }
}
