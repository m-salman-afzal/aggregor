use base64::Engine;
use base64::alphabet::STANDARD;
use base64::engine::{DecodePaddingMode, GeneralPurpose, GeneralPurposeConfig};

// The spec's limits; a report that breaks one is discarded whole.
const MAX_KEY_LENGTH: usize = 16;
const MAX_ENCODED_MESSAGE_LENGTH: usize = 2732;
const MAX_DECODED_MESSAGE_LENGTH: usize = 2048;
const MAX_ENCODED_TITLE_LENGTH: usize = 256;
const MAX_DECODED_TITLE_LENGTH: usize = 192;
const MAX_APP_LENGTH: usize = 32;
const MAX_ID_LENGTH: usize = 128;
const MAX_ID_SEGMENT_LENGTH: usize = 32;
const MAX_ID_DEPTH: usize = 8;

const BASE64_WITH_OPTIONAL_PADDING: GeneralPurpose = GeneralPurpose::new(
    &STANDARD,
    GeneralPurposeConfig::new().with_decode_padding_mode(DecodePaddingMode::Indifferent),
);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum State {
    Idle,
    Working,
    Done,
    Blocked,
    Error,
    Clear,
}

impl State {
    fn from_value(value: &str) -> Option<Self> {
        match value {
            "idle" => Some(Self::Idle),
            "working" => Some(Self::Working),
            "done" => Some(Self::Done),
            "blocked" => Some(Self::Blocked),
            "error" => Some(Self::Error),
            "clear" => Some(Self::Clear),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Idle => "idle",
            Self::Working => "working",
            Self::Done => "done",
            Self::Blocked => "blocked",
            Self::Error => "error",
            Self::Clear => "clear",
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct Report {
    pub state: State,
    pub id: Option<String>,
    pub kind: Option<&'static str>,
    pub progress: Option<u8>,
    pub message: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ProgramStatus {
    Query,
    Report(Report),
}

/// Parses what follows `OSC 7501 ;`. `None` when the spec says to ignore or discard it.
pub fn parse_program_status(body: &[u8]) -> Option<ProgramStatus> {
    if body.trim_ascii() == b"?" {
        return Some(ProgramStatus::Query);
    }
    let pairs = parse_pairs(body)?;
    let value_of = |key: &str| {
        pairs
            .iter()
            .rev()
            .find(|(pair_key, _)| *pair_key == key)
            .map(|(_, value)| *value)
    };
    let state = State::from_value(value_of("state")?)?;
    if value_of("app").is_some_and(|app| app.len() > MAX_APP_LENGTH) {
        return None;
    }
    let id = match value_of("id") {
        Some(id) => Some(validate_id(id)?.to_owned()),
        None => None,
    };
    let message = decode_text(value_of("msg"), MAX_ENCODED_MESSAGE_LENGTH, MAX_DECODED_MESSAGE_LENGTH)?;
    let title = decode_text(value_of("title"), MAX_ENCODED_TITLE_LENGTH, MAX_DECODED_TITLE_LENGTH)?;

    Some(ProgramStatus::Report(Report {
        state,
        id,
        kind: value_of("kind").and_then(|kind| parse_kind(state, kind)),
        progress: value_of("progress").and_then(|progress| parse_progress(state, progress)),
        message,
        title,
    }))
}

fn parse_pairs(body: &[u8]) -> Option<Vec<(&str, &str)>> {
    let mut pairs = Vec::new();
    for pair in body.split(|byte| *byte == b':') {
        let Some(equals_index) = pair.iter().position(|byte| *byte == b'=') else {
            continue;
        };
        let key = pair[..equals_index].trim_ascii();
        let value = pair[equals_index + 1..].trim_ascii();
        if key.is_empty() || !key.iter().all(u8::is_ascii_lowercase) || !value.iter().all(is_value_byte) {
            continue;
        }
        if key.len() > MAX_KEY_LENGTH {
            return None;
        }
        pairs.push((std::str::from_utf8(key).ok()?, std::str::from_utf8(value).ok()?));
    }

    Some(pairs)
}

fn is_value_byte(byte: &u8) -> bool {
    byte.is_ascii_alphanumeric() || b"_.,+/=-".contains(byte)
}

fn validate_id(id: &str) -> Option<&str> {
    let segments: Vec<&str> = id.split('/').collect();
    let is_valid = id.len() <= MAX_ID_LENGTH
        && segments.len() <= MAX_ID_DEPTH
        && segments.iter().all(|segment| {
            (1..=MAX_ID_SEGMENT_LENGTH).contains(&segment.len())
                && segment
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || b"_.+-".contains(&byte))
        });

    is_valid.then_some(id)
}

/// `Some(None)` when the key is absent; `None` when the text breaks a rule, which discards the report.
fn decode_text(encoded: Option<&str>, max_encoded_length: usize, max_decoded_length: usize) -> Option<Option<String>> {
    let Some(encoded) = encoded else {
        return Some(None);
    };
    if encoded.len() > max_encoded_length {
        return None;
    }
    let decoded = BASE64_WITH_OPTIONAL_PADDING.decode(encoded).ok()?;
    if decoded.len() > max_decoded_length {
        return None;
    }
    let text = String::from_utf8(decoded).ok()?;
    if text.chars().any(is_control_character) {
        return None;
    }

    Some((!text.is_empty()).then_some(text))
}

pub fn is_control_character(character: char) -> bool {
    matches!(character, '\u{0000}'..='\u{001F}' | '\u{007F}'..='\u{009F}')
}

fn parse_kind(state: State, kind: &str) -> Option<&'static str> {
    if state != State::Blocked {
        return None;
    }
    ["permission", "question", "auth"]
        .into_iter()
        .find(|known_kind| *known_kind == kind)
}

fn parse_progress(state: State, progress: &str) -> Option<u8> {
    if !matches!(state, State::Working | State::Blocked) || !progress.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    progress.parse::<u8>().ok().filter(|percent| *percent <= 100)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encode(text: &str) -> String {
        base64::engine::general_purpose::STANDARD.encode(text)
    }

    fn report(body: &str) -> Option<Report> {
        match parse_program_status(body.as_bytes()) {
            Some(ProgramStatus::Report(report)) => Some(report),
            _ => None,
        }
    }

    #[test]
    fn reads_a_query() {
        assert_eq!(parse_program_status(b"?"), Some(ProgramStatus::Query));
    }

    #[test]
    fn reads_a_blocked_report() {
        let body = format!(
            "state=blocked:kind=permission:app=claude-code:msg={}",
            encode("Approve Write: a.txt")
        );
        let blocked = report(&body).unwrap();
        assert_eq!(blocked.state, State::Blocked);
        assert_eq!(blocked.kind, Some("permission"));
        assert_eq!(blocked.message.as_deref(), Some("Approve Write: a.txt"));
        assert_eq!(blocked.id, None);
    }

    #[test]
    fn keeps_kind_and_progress_only_where_the_state_allows_them() {
        let working = report("state=working:kind=permission:progress=40").unwrap();
        assert_eq!((working.kind, working.progress), (None, Some(40)));
        let done = report("state=done:progress=40").unwrap();
        assert_eq!(done.progress, None);
        assert_eq!(report("state=blocked:kind=other").unwrap().kind, None);
        assert_eq!(report("state=working:progress=101").unwrap().progress, None);
        assert_eq!(report("state=working:progress=+4").unwrap().progress, None);
    }

    #[test]
    fn ignores_a_report_without_a_known_state() {
        assert_eq!(report("kind=permission"), None);
        assert_eq!(report("state=sleeping"), None);
    }

    #[test]
    fn skips_malformed_pairs_and_takes_the_last_repeat() {
        let idle = report(" state = working : broken : Key=x : state=idle : msg=a;b : title=!!! ").unwrap();
        assert_eq!(idle.state, State::Idle);
        assert_eq!((idle.message, idle.title), (None, None));
    }

    #[test]
    fn decodes_text_with_or_without_padding() {
        assert_eq!(report("state=done:msg=QQ==").unwrap().message.as_deref(), Some("A"));
        assert_eq!(report("state=done:msg=QQ").unwrap().message.as_deref(), Some("A"));
    }

    #[test]
    fn discards_a_report_that_breaks_a_rule() {
        assert_eq!(report("state=done:msg=Q"), None);
        assert_eq!(report(&format!("state=done:msg={}", encode("two\nlines"))), None);
        assert_eq!(report(&format!("state=done:title={}", encode(&"t".repeat(193)))), None);
        assert_eq!(report(&format!("state=done:msg={}", "QUFB".repeat(684))), None);
        assert_eq!(report("state=done:averyveryverylongkey=1"), None);
        assert_eq!(report(&format!("state=done:app={}", "a".repeat(33))), None);
    }

    #[test]
    fn checks_ids() {
        assert_eq!(
            report("state=working:id=build/test").unwrap().id.as_deref(),
            Some("build/test")
        );
        assert_eq!(report("state=working:id=build//test"), None);
        assert_eq!(report(&format!("state=working:id={}", "a".repeat(33))), None);
        assert_eq!(report("state=working:id=a/b/c/d/e/f/g/h/i"), None);
    }

    #[test]
    fn reads_clear() {
        assert_eq!(report("state=clear").unwrap().state, State::Clear);
    }
}
