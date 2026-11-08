const ESCAPE: u8 = 0x1B;
const BELL: u8 = 0x07;
const CANCEL: u8 = 0x18;
const SUBSTITUTE: u8 = 0x1A;

// The spec caps a whole sequence, OSC through ST, at 4096 bytes: two for `ESC ]` and at most two for the terminator.
const MAX_BODY_LENGTH: usize = 4096 - 4;

#[derive(Debug, PartialEq, Eq)]
pub enum Event {
    /// What follows `OSC 7501 ;`.
    ProgramStatus(Vec<u8>),
    /// What follows `OSC 0 ;` or `OSC 2 ;`.
    Title(Vec<u8>),
    /// RIS (`ESC c`), which removes every record.
    FullReset,
}

#[derive(Default)]
enum Mode {
    #[default]
    Ground,
    Escape,
    Osc,
    OscEscape,
}

/// Finds the sequences it cares about in a byte stream, across read boundaries.
#[derive(Default)]
pub struct Scanner {
    mode: Mode,
    body: Vec<u8>,
    is_oversized: bool,
}

impl Scanner {
    pub fn feed(&mut self, bytes: &[u8], on_event: &mut impl FnMut(Event)) {
        for &byte in bytes {
            self.step(byte, on_event);
        }
    }

    fn step(&mut self, byte: u8, on_event: &mut impl FnMut(Event)) {
        match self.mode {
            Mode::Ground => {
                if byte == ESCAPE {
                    self.mode = Mode::Escape;
                }
            }
            Mode::Escape => match byte {
                b']' => {
                    self.mode = Mode::Osc;
                    self.body.clear();
                    self.is_oversized = false;
                }
                b'c' => {
                    self.mode = Mode::Ground;
                    on_event(Event::FullReset);
                }
                ESCAPE => {}
                _ => self.mode = Mode::Ground,
            },
            Mode::Osc => match byte {
                BELL => self.finish(on_event),
                ESCAPE => self.mode = Mode::OscEscape,
                CANCEL | SUBSTITUTE => self.mode = Mode::Ground,
                _ if self.body.len() < MAX_BODY_LENGTH => self.body.push(byte),
                _ => self.is_oversized = true,
            },
            Mode::OscEscape => {
                if byte == b'\\' {
                    self.finish(on_event);
                } else {
                    // An ESC that doesn't make ST abandons the OSC and starts a new sequence.
                    self.mode = Mode::Escape;
                    self.step(byte, on_event);
                }
            }
        }
    }

    fn finish(&mut self, on_event: &mut impl FnMut(Event)) {
        self.mode = Mode::Ground;
        if self.is_oversized {
            return;
        }
        if let Some(program_status) = self.body.strip_prefix(b"7501;") {
            on_event(Event::ProgramStatus(program_status.to_vec()));
        } else if let Some(title) = self.body.strip_prefix(b"0;").or_else(|| self.body.strip_prefix(b"2;")) {
            on_event(Event::Title(title.to_vec()));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scan(chunks: &[&[u8]]) -> Vec<Event> {
        let mut scanner = Scanner::default();
        let mut events = Vec::new();
        for chunk in chunks {
            scanner.feed(chunk, &mut |event| events.push(event));
        }
        events
    }

    #[test]
    fn ends_a_sequence_with_bell_or_string_terminator() {
        assert_eq!(
            scan(&[b"a\x1b]7501;state=idle\x07b\x1b]7501;state=done\x1b\\c"]),
            [
                Event::ProgramStatus(b"state=idle".to_vec()),
                Event::ProgramStatus(b"state=done".to_vec())
            ]
        );
    }

    #[test]
    fn finds_a_sequence_split_across_reads() {
        let sequence = b"\x1b]7501;state=working\x1b\\";
        let chunks: Vec<&[u8]> = sequence.chunks(1).collect();
        assert_eq!(scan(&chunks), [Event::ProgramStatus(b"state=working".to_vec())]);
    }

    #[test]
    fn reads_window_titles_and_skips_other_sequences() {
        assert_eq!(
            scan(&[b"\x1b[31m\x1b]0;one\x07\x1b]1;icon\x07\x1b]2;two\x1b\\\x1b]8;;link\x07"]),
            [Event::Title(b"one".to_vec()), Event::Title(b"two".to_vec())]
        );
    }

    #[test]
    fn drops_an_oversized_sequence_and_reads_the_next() {
        let oversized = [b"\x1b]7501;".as_slice(), &[b'a'; 5000], b"\x07"].concat();
        assert_eq!(
            scan(&[&oversized, b"\x1b]7501;state=idle\x07"]),
            [Event::ProgramStatus(b"state=idle".to_vec())]
        );
    }

    #[test]
    fn abandons_a_sequence_on_escape_or_cancel() {
        assert_eq!(
            scan(&[b"\x1b]7501;state=working\x1b[0m\x1b]7501;state=done\x18\x1b]7501;state=idle\x07"]),
            [Event::ProgramStatus(b"state=idle".to_vec())]
        );
    }

    #[test]
    fn reports_a_full_reset() {
        assert_eq!(scan(&[b"\x1bc"]), [Event::FullReset]);
    }
}
