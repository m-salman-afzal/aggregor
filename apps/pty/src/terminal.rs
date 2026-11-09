use portable_pty::PtySize;
use rustix::termios::{OptionalActions, Termios, tcgetattr, tcgetwinsize, tcsetattr};
use std::io::{IsTerminal, stdin};

const DEFAULT_SIZE: PtySize = PtySize {
    rows: 24,
    cols: 80,
    pixel_width: 0,
    pixel_height: 0,
};

/// Our own terminal in raw mode, so every key reaches the agent as it was typed; dropping it restores the settings.
pub struct RawMode {
    original_settings: Termios,
}

impl RawMode {
    /// `None` when stdin is not a terminal, as in tests.
    pub fn enable() -> Option<Self> {
        if !stdin().is_terminal() {
            return None;
        }
        let original_settings = tcgetattr(stdin()).ok()?;
        let mut raw_settings = original_settings.clone();
        raw_settings.make_raw();
        tcsetattr(stdin(), OptionalActions::Now, &raw_settings).ok()?;

        Some(Self { original_settings })
    }
}

impl Drop for RawMode {
    fn drop(&mut self) {
        let _ = tcsetattr(stdin(), OptionalActions::Now, &self.original_settings);
    }
}

pub fn read_size() -> PtySize {
    match tcgetwinsize(stdin()) {
        Ok(size) if size.ws_row > 0 && size.ws_col > 0 => PtySize {
            rows: size.ws_row,
            cols: size.ws_col,
            pixel_width: size.ws_xpixel,
            pixel_height: size.ws_ypixel,
        },
        _ => DEFAULT_SIZE,
    }
}
