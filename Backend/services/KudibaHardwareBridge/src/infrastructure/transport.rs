use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;

use crate::domain::error::DeviceError;
use crate::domain::port::{PrinterPort, TransportOutcome};

pub struct RawTcpPrinter {
    host: String,
    port: u16,
}

impl RawTcpPrinter {
    pub fn new(host: impl Into<String>, port: u16) -> Self {
        Self {
            host: host.into(),
            port,
        }
    }
}

#[async_trait]
impl PrinterPort for RawTcpPrinter {
    async fn print_bytes(&self, bytes: &[u8]) -> Result<TransportOutcome, DeviceError> {
        let stream = tokio::net::TcpStream::connect((self.host.as_str(), self.port))
            .await
            .map_err(|error| DeviceError::TransportUnavailable(format!("TCP: {error}")))?;
        let mut stream = stream;
        tokio::io::AsyncWriteExt::write_all(&mut stream, bytes)
            .await
            .map_err(|error| DeviceError::TransportUnavailable(format!("TCP write: {error}")))?;
        tokio::io::AsyncWriteExt::flush(&mut stream)
            .await
            .map_err(|error| DeviceError::TransportUnavailable(format!("TCP flush: {error}")))?;
        Ok(TransportOutcome::TransportAccepted)
    }
}

pub struct SerialPrinter {
    path: String,
    baud_rate: u32,
}

impl SerialPrinter {
    pub fn new(path: impl Into<String>, baud_rate: u32) -> Self {
        Self {
            path: path.into(),
            baud_rate,
        }
    }
}

#[async_trait]
impl PrinterPort for SerialPrinter {
    async fn print_bytes(&self, bytes: &[u8]) -> Result<TransportOutcome, DeviceError> {
        let path = self.path.clone();
        let baud_rate = self.baud_rate;
        let data = bytes.to_vec();
        tokio::task::spawn_blocking(move || -> Result<TransportOutcome, DeviceError> {
            use std::io::Write;
            let mut port = serialport::new(&path, baud_rate)
                .timeout(Duration::from_secs(5))
                .open()
                .map_err(|error| DeviceError::TransportUnavailable(format!("SERIAL: {error}")))?;
            port.write_all(&data).map_err(|error| {
                DeviceError::TransportUnavailable(format!("SERIAL write: {error}"))
            })?;
            port.flush().map_err(|error| {
                DeviceError::TransportUnavailable(format!("SERIAL flush: {error}"))
            })?;
            Ok(TransportOutcome::TransportAccepted)
        })
        .await
        .map_err(|error| DeviceError::Busy(format!("SERIAL: {error}")))?
    }
}

pub struct UsbPrinter {
    vendor_id: u16,
    product_id: u16,
    endpoint: u8,
    interface: u8,
}

impl UsbPrinter {
    pub fn new(vendor_id: u16, product_id: u16, endpoint: u8, interface: u8) -> Self {
        Self {
            vendor_id,
            product_id,
            endpoint,
            interface,
        }
    }
}

#[async_trait]
impl PrinterPort for UsbPrinter {
    async fn print_bytes(&self, bytes: &[u8]) -> Result<TransportOutcome, DeviceError> {
        let vendor_id = self.vendor_id;
        let product_id = self.product_id;
        let endpoint = self.endpoint;
        let interface = self.interface;
        let data = bytes.to_vec();
        tokio::task::spawn_blocking(move || -> Result<TransportOutcome, DeviceError> {
            use rusb::UsbContext;
            let context = rusb::Context::new()
                .map_err(|error| DeviceError::TransportUnavailable(format!("USB: {error}")))?;
            let handle = context
                .open_device_with_vid_pid(vendor_id, product_id)
                .ok_or_else(|| {
                    DeviceError::TransportUnavailable("USB device não encontrado".into())
                })?;
            if let Ok(active) = handle.kernel_driver_active(interface) {
                if active {
                    let _ = handle.detach_kernel_driver(interface);
                }
            }
            handle.claim_interface(interface).map_err(|error| {
                DeviceError::TransportUnavailable(format!("USB claim: {error}"))
            })?;
            handle
                .write_bulk(endpoint, &data, Duration::from_secs(5))
                .map_err(|error| {
                    DeviceError::TransportUnavailable(format!("USB write: {error}"))
                })?;
            Ok(TransportOutcome::TransportAccepted)
        })
        .await
        .map_err(|error| DeviceError::Busy(format!("USB: {error}")))?
    }
}

pub struct WinSpoolPrinter {
    name: String,
}

impl WinSpoolPrinter {
    pub fn new(name: impl Into<String>) -> Self {
        Self { name: name.into() }
    }
}

#[cfg(windows)]
#[async_trait]
impl PrinterPort for WinSpoolPrinter {
    async fn print_bytes(&self, bytes: &[u8]) -> Result<TransportOutcome, DeviceError> {
        use std::ffi::c_void;

        use windows_sys::Win32::Foundation::HANDLE;
        use windows_sys::Win32::Graphics::Printing::{
            ClosePrinter, EndDocPrinter, EndPagePrinter, OpenPrinterW, StartDocPrinterW,
            StartPagePrinter, WritePrinter, DOC_INFO_1W,
        };

        let name: Vec<u16> = self.name.encode_utf16().chain(std::iter::once(0)).collect();
        let mut document: Vec<u16> = "Kudiba Recibo POS"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let mut datatype: Vec<u16> = "RAW".encode_utf16().chain(std::iter::once(0)).collect();
        let data = bytes.to_vec();
        let handle =
            tokio::task::spawn_blocking(move || -> Result<TransportOutcome, DeviceError> {
                let mut printer: HANDLE = 0;
                let opened = unsafe { OpenPrinterW(name.as_ptr(), &mut printer, std::ptr::null()) };
                if opened == 0 {
                    return Err(DeviceError::TransportUnavailable(
                        "WIN_SPOOL: impressora não encontrada".to_string(),
                    ));
                }
                let info = DOC_INFO_1W {
                    pDocName: document.as_mut_ptr(),
                    pOutputFile: std::ptr::null_mut(),
                    pDatatype: datatype.as_mut_ptr(),
                };
                let job_id = unsafe { StartDocPrinterW(printer, 1, &info) };
                if job_id == 0 {
                    unsafe { ClosePrinter(printer) };
                    return Err(DeviceError::TransportUnavailable(
                        "WIN_SPOOL: falha ao iniciar documento".to_string(),
                    ));
                }
                let mut written: u32 = 0;
                unsafe {
                    StartPagePrinter(printer);
                    WritePrinter(
                        printer,
                        data.as_ptr() as *const c_void,
                        data.len() as u32,
                        &mut written,
                    );
                    EndPagePrinter(printer);
                    EndDocPrinter(printer);
                    ClosePrinter(printer);
                }
                if written as usize != data.len() {
                    return Err(DeviceError::TransportUnavailable(
                        "WIN_SPOOL: escrita incompleta".to_string(),
                    ));
                }
                Ok(TransportOutcome::TransportAccepted)
            })
            .await
            .map_err(|error| DeviceError::Busy(format!("WIN_SPOOL: {error}")))?;
        handle
    }
}

#[cfg(not(windows))]
#[async_trait]
impl PrinterPort for WinSpoolPrinter {
    async fn print_bytes(&self, _bytes: &[u8]) -> Result<TransportOutcome, DeviceError> {
        Err(DeviceError::InvalidProfile(format!(
            "WIN_SPOOL ({}) apenas disponível no Windows",
            self.name
        )))
    }
}

#[derive(Clone)]
pub enum PrinterTransport {
    RawTcp(Arc<RawTcpPrinter>),
    Serial(Arc<SerialPrinter>),
    Usb(Arc<UsbPrinter>),
    WinSpool(Arc<WinSpoolPrinter>),
}

#[async_trait]
impl PrinterPort for PrinterTransport {
    async fn print_bytes(&self, bytes: &[u8]) -> Result<TransportOutcome, DeviceError> {
        match self {
            Self::RawTcp(printer) => printer.print_bytes(bytes).await,
            Self::Serial(printer) => printer.print_bytes(bytes).await,
            Self::Usb(printer) => printer.print_bytes(bytes).await,
            Self::WinSpool(printer) => printer.print_bytes(bytes).await,
        }
    }
}

pub fn parse_printer_spec(spec: &str) -> Result<PrinterTransport, DeviceError> {
    let (scheme, target) = spec
        .split_once(':')
        .ok_or_else(|| DeviceError::InvalidProfile("transporte sem esquema".to_string()))?;
    match scheme.to_ascii_uppercase().as_str() {
        "RAW_TCP" | "RAW-TCP" | "TCP" => {
            let (host, port) = target.rsplit_once(':').ok_or_else(|| {
                DeviceError::InvalidProfile("RAW_TCP requer host:porta".to_string())
            })?;
            let port = port
                .parse::<u16>()
                .map_err(|_| DeviceError::InvalidProfile("RAW_TCP porta inválida".to_string()))?;
            Ok(PrinterTransport::RawTcp(Arc::new(RawTcpPrinter::new(
                host, port,
            ))))
        }
        "RAW_SERIAL" | "RAW-SERIAL" | "SERIAL" => {
            let (path, baud) = target.rsplit_once(':').ok_or_else(|| {
                DeviceError::InvalidProfile("RAW_SERIAL requer path:baud".to_string())
            })?;
            let baud = baud
                .parse::<u32>()
                .map_err(|_| DeviceError::InvalidProfile("RAW_SERIAL baud inválido".to_string()))?;
            Ok(PrinterTransport::Serial(Arc::new(SerialPrinter::new(
                path, baud,
            ))))
        }
        "RAW_USB_DIRECT" | "RAW-USB-DIRECT" | "USB" => {
            let parts: Vec<&str> = target.split(':').collect();
            if parts.len() < 2 || parts.len() > 4 {
                return Err(DeviceError::InvalidProfile(
                    "RAW_USB_DIRECT requer vid:pid[:endpoint[:interface]]".to_string(),
                ));
            }
            let vendor_id = u16::from_str_radix(parts[0], 16).map_err(|_| {
                DeviceError::InvalidProfile("RAW_USB_DIRECT vid inválido".to_string())
            })?;
            let product_id = u16::from_str_radix(parts[1], 16).map_err(|_| {
                DeviceError::InvalidProfile("RAW_USB_DIRECT pid inválido".to_string())
            })?;
            let endpoint = parts
                .get(2)
                .map(|value| u8::from_str_radix(value, 16))
                .transpose()
                .map_err(|_| {
                    DeviceError::InvalidProfile("RAW_USB_DIRECT endpoint inválido".to_string())
                })?
                .unwrap_or(0x01);
            let interface = parts
                .get(3)
                .map(|value| value.parse::<u8>())
                .transpose()
                .map_err(|_| {
                    DeviceError::InvalidProfile("RAW_USB_DIRECT interface inválida".to_string())
                })?
                .unwrap_or(0);
            Ok(PrinterTransport::Usb(Arc::new(UsbPrinter::new(
                vendor_id, product_id, endpoint, interface,
            ))))
        }
        "WIN_SPOOL" | "WIN-SPOOL" | "SPOOL" => Ok(PrinterTransport::WinSpool(Arc::new(
            WinSpoolPrinter::new(target),
        ))),
        _ => Err(DeviceError::InvalidProfile(format!(
            "transporte desconhecido: {scheme}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_printer_spec_accepts_all_documented_modes() {
        assert!(matches!(
            parse_printer_spec("RAW_TCP:127.0.0.1:9100").unwrap(),
            PrinterTransport::RawTcp(_)
        ));
        assert!(matches!(
            parse_printer_spec("RAW_SERIAL:/dev/ttyUSB0:9600").unwrap(),
            PrinterTransport::Serial(_)
        ));
        assert!(matches!(
            parse_printer_spec("RAW_USB_DIRECT:04b8:0202").unwrap(),
            PrinterTransport::Usb(_)
        ));
        assert!(matches!(
            parse_printer_spec("WIN_SPOOL:POS-80").unwrap(),
            PrinterTransport::WinSpool(_)
        ));
    }

    #[test]
    fn parse_printer_spec_rejects_unknown_schemes() {
        assert!(parse_printer_spec("HTTP:localhost").is_err());
    }
}
