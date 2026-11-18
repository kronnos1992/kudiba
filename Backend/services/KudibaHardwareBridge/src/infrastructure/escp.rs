#[derive(Debug, Clone)]
pub struct EscPosProfile {
    pub columns: u8,
    pub code_page_select: Option<u8>,
    pub drawer_on_ms: u8,
    pub drawer_off_ms: u8,
    pub has_cutter: bool,
    pub ascii_only: bool,
}

impl Default for EscPosProfile {
    fn default() -> Self {
        Self {
            columns: 48,
            code_page_select: None,
            drawer_on_ms: 50,
            drawer_off_ms: 100,
            has_cutter: true,
            ascii_only: true,
        }
    }
}

pub fn initialize() -> Vec<u8> {
    vec![0x1B, 0x40]
}

pub fn select_code_page(profile: &EscPosProfile) -> Vec<u8> {
    match profile.code_page_select {
        Some(n) => vec![0x1B, 0x74, n],
        None => Vec::new(),
    }
}

pub fn encode_text(text: &str, profile: &EscPosProfile) -> Vec<u8> {
    if profile.ascii_only {
        transliterate_ascii(text).into_bytes()
    } else {
        text.as_bytes().to_vec()
    }
}

pub fn left(text: &str, profile: &EscPosProfile) -> Vec<u8> {
    let mut out = encode_text(text, profile);
    out.push(b'\n');
    out
}

pub fn center(text: &str, profile: &EscPosProfile) -> Vec<u8> {
    let used = text.chars().count().min(profile.columns as usize);
    let pad = (profile.columns as usize - used) / 2;
    let mut out = vec![b' '; pad];
    out.extend_from_slice(&encode_text(text, profile));
    out.push(b'\n');
    out
}

pub fn drawer_pulse(profile: &EscPosProfile) -> Vec<u8> {
    vec![
        0x1B,
        0x70,
        0x00,
        profile.drawer_on_ms,
        profile.drawer_off_ms,
    ]
}

pub fn feed(lines: u8) -> Vec<u8> {
    vec![0x1B, 0x64, lines]
}

pub fn cut(profile: &EscPosProfile) -> Vec<u8> {
    if profile.has_cutter {
        vec![0x1D, 0x56, 0x42, 0x00]
    } else {
        Vec::new()
    }
}

pub fn build_receipt(lines: &[String], profile: &EscPosProfile) -> Vec<u8> {
    let mut out = initialize();
    out.extend_from_slice(&select_code_page(profile));
    for line in lines {
        out.extend_from_slice(&left(line, profile));
    }
    out.extend_from_slice(&feed(3));
    out.extend_from_slice(&cut(profile));
    out
}

fn transliterate_ascii(text: &str) -> String {
    text.chars()
        .map(|c| match c {
            'à'..='å' | 'À'..='Å' => 'a',
            'ç' | 'Ç' => 'c',
            'è'..='ë' | 'È'..='Ë' => 'e',
            'ì'..='ï' | 'Ì'..='Ï' => 'i',
            'ñ' | 'Ñ' => 'n',
            'ò'..='ö' | 'Ò'..='Ö' | 'ø' | 'Ø' => 'o',
            'ù'..='ü' | 'Ù'..='Ü' => 'u',
            'ý' | 'ÿ' | 'Ý' => 'y',
            c if c.is_ascii() => c,
            _ => '?',
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initialize_is_esc_at() {
        assert_eq!(initialize(), vec![0x1B, 0x40]);
    }

    #[test]
    fn drawer_pulse_is_esc_p_with_configured_timings() {
        let profile = EscPosProfile {
            drawer_on_ms: 50,
            drawer_off_ms: 120,
            ..EscPosProfile::default()
        };
        assert_eq!(drawer_pulse(&profile), vec![0x1B, 0x70, 0x00, 50, 120]);
    }

    #[test]
    fn cut_is_only_emitted_when_the_profile_has_a_cutter() {
        let mut profile = EscPosProfile::default();
        assert_eq!(cut(&profile), vec![0x1D, 0x56, 0x42, 0x00]);

        profile.has_cutter = false;
        assert!(cut(&profile).is_empty());
    }

    #[test]
    fn code_page_is_only_emitted_when_configured() {
        let mut profile = EscPosProfile::default();
        assert!(select_code_page(&profile).is_empty());

        profile.code_page_select = Some(2);
        assert_eq!(select_code_page(&profile), vec![0x1B, 0x74, 0x02]);
    }

    #[test]
    fn center_pads_for_a_48_column_paper() {
        let profile = EscPosProfile::default();
        let mut expected = vec![b' '; 21];
        expected.extend_from_slice(b"KUDIBA\n");
        assert_eq!(center("KUDIBA", &profile), expected);
    }

    #[test]
    fn center_handles_58mm_eight_column_layout() {
        let profile = EscPosProfile {
            columns: 32,
            ..EscPosProfile::default()
        };
        let mut expected = vec![b' '; 13];
        expected.extend_from_slice(b"KUDIBA\n");
        assert_eq!(center("KUDIBA", &profile), expected);
    }

    #[test]
    fn ascii_mode_transliterates_portuguese_accents() {
        let profile = EscPosProfile::default();
        assert_eq!(
            left("Pastelaria São José", &profile),
            b"Pastelaria Sao Jose\n".to_vec()
        );
    }

    #[test]
    fn native_mode_preserves_utf8_bytes() {
        let profile = EscPosProfile {
            ascii_only: false,
            ..EscPosProfile::default()
        };
        assert_eq!(left("São", &profile), "São\n".as_bytes().to_vec());
    }

    #[test]
    fn receipt_never_contains_a_drawer_pulse() {
        let profile = EscPosProfile::default();
        let lines = vec!["KUDIBA".to_string(), "Total: 1250 AOA".to_string()];
        let bytes = build_receipt(&lines, &profile);
        let pulse = drawer_pulse(&profile);

        assert!(bytes.starts_with(&initialize()));
        assert!(bytes.ends_with(&cut(&profile)));
        assert!(!bytes.windows(pulse.len()).any(|w| w == pulse));
    }
}
