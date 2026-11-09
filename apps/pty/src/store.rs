use rusqlite::{Connection, OpenFlags, params};
use std::fmt::Display;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{Receiver, RecvTimeoutError, Sender, channel};
use std::thread::{JoinHandle, spawn};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const LOG_FILE_NAME: &str = "aggregor-pty.log";
// Enough to see what went wrong without letting a broken database grow the log on every write.
const MAX_LOG_LINES_PER_RUN: u32 = 10;
const BUSY_TIMEOUT: Duration = Duration::from_secs(5);
// A title spinner can change ten times a second; the extension re-reads sessions on every write.
const TITLE_WRITE_INTERVAL: Duration = Duration::from_millis(500);
const IDLE_WAIT: Duration = Duration::from_secs(3600);

// The extension's timestamp format, such as 2026-11-07T22:13:46.836Z.
const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Status {
    pub state: &'static str,
    pub kind: Option<&'static str>,
    pub progress: Option<u8>,
    pub message: Option<String>,
    pub reported_title: Option<String>,
}

impl Status {
    pub fn unknown() -> Self {
        Self {
            state: "unknown",
            kind: None,
            progress: None,
            message: None,
            reported_title: None,
        }
    }
}

pub enum Update {
    Status(Status),
    TerminalTitle(String),
    Exited,
}

/// Writes the session's row on its own thread, so a busy database never holds up the agent's output.
pub struct Store {
    sender: Sender<Update>,
    writer: JoinHandle<()>,
}

impl Store {
    pub fn start(database_path: PathBuf, session_id: String) -> Self {
        let (sender, receiver) = channel();
        let writer = spawn(move || {
            let mut writer = Writer::open(&database_path, session_id);
            writer.write_start();
            writer.run(&receiver);
        });

        Self { sender, writer }
    }

    pub fn sender(&self) -> Sender<Update> {
        self.sender.clone()
    }

    /// Records the exit and waits until it is written.
    pub fn finish(self) {
        let _ = self.sender.send(Update::Exited);
        let _ = self.writer.join();
    }
}

#[derive(Default)]
struct Pending {
    status: Option<Status>,
    has_worked: bool,
    terminal_title: Option<String>,
    has_exited: bool,
}

impl Pending {
    fn add(&mut self, update: Update) {
        match update {
            Update::Status(status) => {
                self.has_worked |= status.state == "working";
                self.status = Some(status);
            }
            Update::TerminalTitle(title) => self.terminal_title = Some(title),
            Update::Exited => self.has_exited = true,
        }
    }
}

struct Writer {
    connection: Option<Connection>,
    session_id: String,
    log: ErrorLog,
    written_title: Option<String>,
    title_written_at: Option<Instant>,
}

impl Writer {
    fn open(database_path: &Path, session_id: String) -> Self {
        let mut log = ErrorLog::beside(database_path, &session_id);
        let connection = Connection::open_with_flags(database_path, OpenFlags::SQLITE_OPEN_READ_WRITE)
            .and_then(|connection| connection.busy_timeout(BUSY_TIMEOUT).map(|()| connection))
            .inspect_err(|error| log.record("open the database", error))
            .ok();

        Self {
            connection,
            session_id,
            log,
            written_title: None,
            title_written_at: None,
        }
    }

    fn run(&mut self, receiver: &Receiver<Update>) {
        let mut pending = Pending::default();
        loop {
            match receiver.recv_timeout(self.time_until_title_write(&pending)) {
                Ok(update) => pending.add(update),
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => pending.has_exited = true,
            }
            while let Ok(update) = receiver.try_recv() {
                pending.add(update);
            }
            if let Some(status) = pending.status.take() {
                self.write_status(&status, std::mem::take(&mut pending.has_worked));
            }
            if pending.has_exited || self.time_until_title_write(&pending).is_zero() {
                self.write_title(pending.terminal_title.take());
            }
            if pending.has_exited {
                self.write_exited();
                return;
            }
        }
    }

    fn time_until_title_write(&self, pending: &Pending) -> Duration {
        match (&pending.terminal_title, self.title_written_at) {
            (None, _) => IDLE_WAIT,
            (Some(_), None) => Duration::ZERO,
            (Some(_), Some(written_at)) => TITLE_WRITE_INTERVAL.saturating_sub(written_at.elapsed()),
        }
    }

    fn write_start(&mut self) {
        let unknown = Status::unknown();
        execute(
            self.connection.as_ref(),
            &mut self.log,
            "record the start",
            &format!(
                "UPDATE sessions SET status = ?2, statusKind = NULL, statusMessage = NULL, statusProgress = NULL,
                reportedTitle = NULL, statusChangedAt = {NOW}, updatedAt = {NOW} WHERE id = ?1 AND deletedAt IS NULL"
            ),
            params![self.session_id, unknown.state],
        );
    }

    fn write_status(&mut self, status: &Status, has_worked: bool) {
        execute(
            self.connection.as_ref(),
            &mut self.log,
            "record a status",
            &format!(
                "UPDATE sessions SET status = ?2, statusKind = ?3, statusMessage = ?4, statusProgress = ?5,
                reportedTitle = ?6, hasWorked = hasWorked OR ?7,
                statusChangedAt = CASE WHEN status IS ?2 THEN statusChangedAt ELSE {NOW} END, updatedAt = {NOW}
                WHERE id = ?1 AND deletedAt IS NULL"
            ),
            params![
                self.session_id,
                status.state,
                status.kind,
                status.message,
                status.progress,
                status.reported_title,
                has_worked
            ],
        );
    }

    fn write_title(&mut self, title: Option<String>) {
        let Some(title) = title.filter(|title| self.written_title.as_ref() != Some(title)) else {
            return;
        };
        execute(
            self.connection.as_ref(),
            &mut self.log,
            "record a title",
            &format!("UPDATE sessions SET terminalTitle = ?2, updatedAt = {NOW} WHERE id = ?1 AND deletedAt IS NULL"),
            params![self.session_id, title],
        );
        self.written_title = Some(title);
        self.title_written_at = Some(Instant::now());
    }

    fn write_exited(&mut self) {
        execute(
            self.connection.as_ref(),
            &mut self.log,
            "record the exit",
            &format!(
                "UPDATE sessions SET status = 'exited', statusKind = NULL, statusMessage = NULL, statusProgress = NULL,
                statusChangedAt = CASE WHEN status IS 'exited' THEN statusChangedAt ELSE {NOW} END, updatedAt = {NOW}
                WHERE id = ?1 AND deletedAt IS NULL"
            ),
            params![self.session_id],
        );
    }
}

fn execute(
    connection: Option<&Connection>,
    log: &mut ErrorLog,
    action: &str,
    sql: &str,
    parameters: impl rusqlite::Params,
) {
    let Some(connection) = connection else {
        return;
    };
    if let Err(error) = connection.execute(sql, parameters) {
        log.record(action, &error);
    }
}

/// `aggregor-pty.log` beside the database. Nothing goes to the terminal, which is the agent's screen.
struct ErrorLog {
    path: PathBuf,
    session_id: String,
    lines_left: u32,
}

impl ErrorLog {
    fn beside(database_path: &Path, session_id: &str) -> Self {
        Self {
            path: database_path.with_file_name(LOG_FILE_NAME),
            session_id: session_id.to_owned(),
            lines_left: MAX_LOG_LINES_PER_RUN,
        }
    }

    fn record(&mut self, action: &str, error: &impl Display) {
        if self.lines_left == 0 {
            return;
        }
        self.lines_left -= 1;
        let line = format!(
            "{} session {}: could not {action}: {error}\n",
            format_utc(SystemTime::now()),
            self.session_id
        );
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&self.path) {
            let _ = file.write_all(line.as_bytes());
        }
    }
}

/// ISO 8601 in UTC, to the second, from days since the epoch (Howard Hinnant's civil_from_days).
fn format_utc(time: SystemTime) -> String {
    let seconds = time
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since_epoch| since_epoch.as_secs());
    let (days, second_of_day) = (seconds / 86_400, seconds % 86_400);
    let shifted_days = days + 719_468;
    let era = shifted_days / 146_097;
    let day_of_era = shifted_days % 146_097;
    let year_of_era = (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    };
    let year = year_of_era + era * 400 + u64::from(month <= 2);

    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        second_of_day / 3600,
        second_of_day % 3600 / 60,
        second_of_day % 60
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_times_in_utc() {
        assert_eq!(format_utc(UNIX_EPOCH), "1970-01-01T00:00:00Z");
        assert_eq!(
            format_utc(UNIX_EPOCH + Duration::from_secs(1_794_085_880)),
            "2026-11-07T21:11:20Z"
        );
        assert_eq!(
            format_utc(UNIX_EPOCH + Duration::from_secs(951_782_400)),
            "2000-02-29T00:00:00Z"
        );
    }
}
