use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

pub static REQUESTS_TOTAL: AtomicU64 = AtomicU64::new(0);
pub static REQUESTS_IN_FLIGHT: AtomicU64 = AtomicU64::new(0);
pub static REQUESTS_2XX: AtomicU64 = AtomicU64::new(0);
pub static REQUESTS_3XX: AtomicU64 = AtomicU64::new(0);
pub static REQUESTS_4XX: AtomicU64 = AtomicU64::new(0);
pub static REQUESTS_5XX: AtomicU64 = AtomicU64::new(0);
pub static DURATION_MICROS_TOTAL: AtomicU64 = AtomicU64::new(0);

pub fn request_started() {
    REQUESTS_IN_FLIGHT.fetch_add(1, Ordering::Relaxed);
}

pub fn record(status: u16, elapsed: Duration) {
    REQUESTS_TOTAL.fetch_add(1, Ordering::Relaxed);
    DURATION_MICROS_TOTAL.fetch_add(elapsed.as_micros() as u64, Ordering::Relaxed);
    REQUESTS_IN_FLIGHT.fetch_sub(1, Ordering::Relaxed);

    match status {
        200..=299 => {
            REQUESTS_2XX.fetch_add(1, Ordering::Relaxed);
        }
        300..=399 => {
            REQUESTS_3XX.fetch_add(1, Ordering::Relaxed);
        }
        400..=499 => {
            REQUESTS_4XX.fetch_add(1, Ordering::Relaxed);
        }
        500..=599 => {
            REQUESTS_5XX.fetch_add(1, Ordering::Relaxed);
        }
        _ => {}
    }
}

pub fn render() -> String {
    let total = REQUESTS_TOTAL.load(Ordering::Relaxed);
    let duration_seconds = DURATION_MICROS_TOTAL.load(Ordering::Relaxed) as f64 / 1_000_000.0;

    format!(
        "# HELP http_requests_total Total number of HTTP requests processed by the gateway.\n\
         # TYPE http_requests_total counter\n\
         http_requests_total {total}\n\
         # HELP http_requests_in_flight Number of HTTP requests currently being processed.\n\
         # TYPE http_requests_in_flight gauge\n\
         http_requests_in_flight {in_flight}\n\
         # HELP http_requests_by_status_total HTTP requests grouped by response status class.\n\
         # TYPE http_requests_by_status_total counter\n\
         http_requests_by_status_total{{class=\"2xx\"}} {s2xx}\n\
         http_requests_by_status_total{{class=\"3xx\"}} {s3xx}\n\
         http_requests_by_status_total{{class=\"4xx\"}} {s4xx}\n\
         http_requests_by_status_total{{class=\"5xx\"}} {s5xx}\n\
         # HELP http_request_duration_seconds_sum Cumulative time spent processing HTTP requests.\n\
         # TYPE http_request_duration_seconds_sum counter\n\
         http_request_duration_seconds_sum {duration_seconds:.6}\n\
         # HELP http_request_duration_seconds_count Number of observed HTTP request durations.\n\
         # TYPE http_request_duration_seconds_count counter\n\
         http_request_duration_seconds_count {total}\n",
        total = total,
        in_flight = REQUESTS_IN_FLIGHT.load(Ordering::Relaxed),
        s2xx = REQUESTS_2XX.load(Ordering::Relaxed),
        s3xx = REQUESTS_3XX.load(Ordering::Relaxed),
        s4xx = REQUESTS_4XX.load(Ordering::Relaxed),
        s5xx = REQUESTS_5XX.load(Ordering::Relaxed),
        duration_seconds = duration_seconds,
    )
}
