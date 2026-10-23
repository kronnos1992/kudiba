use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

const DURATION_BUCKET_LIMITS_SECONDS: [f64; 11] = [
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
];

pub static REQUESTS_TOTAL: AtomicU64 = AtomicU64::new(0);
pub static REQUESTS_IN_FLIGHT: AtomicU64 = AtomicU64::new(0);
pub static REQUESTS_2XX: AtomicU64 = AtomicU64::new(0);
pub static REQUESTS_3XX: AtomicU64 = AtomicU64::new(0);
pub static REQUESTS_4XX: AtomicU64 = AtomicU64::new(0);
pub static REQUESTS_5XX: AtomicU64 = AtomicU64::new(0);
pub static DURATION_MICROS_TOTAL: AtomicU64 = AtomicU64::new(0);
pub static DURATION_BUCKET_COUNTS: [AtomicU64; 11] = [const { AtomicU64::new(0) }; 11];

pub fn request_started() {
    REQUESTS_IN_FLIGHT.fetch_add(1, Ordering::Relaxed);
}

pub fn record(status: u16, elapsed: Duration) {
    REQUESTS_TOTAL.fetch_add(1, Ordering::Relaxed);
    DURATION_MICROS_TOTAL.fetch_add(elapsed.as_micros() as u64, Ordering::Relaxed);
    let elapsed_seconds = elapsed.as_secs_f64();
    for (index, limit) in DURATION_BUCKET_LIMITS_SECONDS.iter().enumerate() {
        if elapsed_seconds <= *limit {
            DURATION_BUCKET_COUNTS[index].fetch_add(1, Ordering::Relaxed);
        }
    }
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

    let mut output = format!(
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
         ",
        total = total,
        in_flight = REQUESTS_IN_FLIGHT.load(Ordering::Relaxed),
        s2xx = REQUESTS_2XX.load(Ordering::Relaxed),
        s3xx = REQUESTS_3XX.load(Ordering::Relaxed),
        s4xx = REQUESTS_4XX.load(Ordering::Relaxed),
        s5xx = REQUESTS_5XX.load(Ordering::Relaxed),
    );

    output.push_str(
        "# HELP http_request_duration_seconds Duration of HTTP requests in seconds.\n\
         # TYPE http_request_duration_seconds histogram\n",
    );
    for (index, limit) in DURATION_BUCKET_LIMITS_SECONDS.iter().enumerate() {
        output.push_str(&format!(
            "http_request_duration_seconds_bucket{{le=\"{limit}\"}} {count}\n",
            count = DURATION_BUCKET_COUNTS[index].load(Ordering::Relaxed),
        ));
    }
    output.push_str(&format!(
        "http_request_duration_seconds_bucket{{le=\"+Inf\"}} {total}\n\
         http_request_duration_seconds_sum {duration_seconds:.6}\n\
         http_request_duration_seconds_count {total}\n",
        total = total,
    ));
    output
}

#[cfg(test)]
mod tests {
    use super::{record, render};
    use std::time::Duration;

    #[test]
    fn exports_prometheus_duration_histogram() {
        record(200, Duration::from_millis(20));
        let metrics = render();

        assert!(metrics.contains("# TYPE http_request_duration_seconds histogram"));
        assert!(metrics.contains("http_request_duration_seconds_bucket{le=\"0.025\"}"));
        assert!(metrics.contains("http_request_duration_seconds_bucket{le=\"+Inf\"}"));
    }
}
