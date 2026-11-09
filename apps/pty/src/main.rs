mod report;
mod scanner;
mod store;
mod terminal;

use portable_pty::{ChildKiller, CommandBuilder, MasterPty, native_pty_system};
use report::{ProgramStatus, State, is_control_character, parse_program_status};
use scanner::{Event, Scanner};
use signal_hook::consts::{SIGHUP, SIGINT, SIGTERM, SIGWINCH};
use signal_hook::iterator::Signals;
use std::error::Error;
use std::ffi::OsString;
use std::io::{Read, Write, stdin, stdout};
use std::path::PathBuf;
use std::process::exit;
use std::sync::mpsc::{Sender, channel};
use std::sync::{Arc, Mutex};
use std::thread::spawn;
use std::time::Duration;
use store::{Status, Store, Update};

const USAGE: &str = "usage: aggregor-pty --database <path> --session <session id> -- <command> [<argument>...]";
const QUERY_REPLY: &[u8] = b"\x1b]7501;?\x1b\\";
const READ_BUFFER_SIZE: usize = 16 * 1024;
// Output still in the pty after the agent exits; a background process that keeps the pty open must not keep us waiting.
const OUTPUT_DRAIN_TIMEOUT: Duration = Duration::from_millis(500);

type SharedWriter = Arc<Mutex<Box<dyn Write + Send>>>;

struct Arguments {
    database_path: PathBuf,
    session_id: String,
    command: Vec<OsString>,
}

fn main() {
    let Some(arguments) = parse_arguments(std::env::args_os().skip(1)) else {
        eprintln!("{USAGE}");
        exit(2);
    };
    match run(arguments) {
        Ok(exit_code) => exit(exit_code),
        Err(error) => {
            eprintln!("aggregor-pty: {error}");
            exit(1);
        }
    }
}

fn parse_arguments(mut arguments: impl Iterator<Item = OsString>) -> Option<Arguments> {
    let mut database_path = None;
    let mut session_id = None;
    loop {
        let argument = arguments.next()?;
        match argument.to_str() {
            Some("--database") => database_path = Some(PathBuf::from(arguments.next()?)),
            Some("--session") => session_id = Some(arguments.next()?.into_string().ok()?),
            Some("--") => break,
            _ => return None,
        }
    }
    let command: Vec<OsString> = arguments.collect();
    if command.is_empty() {
        return None;
    }

    Some(Arguments {
        database_path: database_path?,
        session_id: session_id?,
        command,
    })
}

fn run(arguments: Arguments) -> Result<i32, Box<dyn Error>> {
    let pty = native_pty_system().openpty(terminal::read_size())?;
    let mut command = CommandBuilder::from_argv(arguments.command);
    command.cwd(std::env::current_dir()?);
    let mut agent = pty.slave.spawn_command(command)?;
    drop(pty.slave);

    let store = Store::start(arguments.database_path, arguments.session_id);
    let raw_mode = terminal::RawMode::enable();
    let reader = pty.master.try_clone_reader()?;
    let writer: SharedWriter = Arc::new(Mutex::new(pty.master.take_writer()?));
    copy_input(Arc::clone(&writer));
    forward_signals(pty.master, agent.clone_killer())?;
    let (output_done, output_finished) = channel();
    copy_output(reader, writer, store.sender(), output_done);

    let exit_code = agent.wait().map_or(1, |status| status.exit_code());
    let _ = output_finished.recv_timeout(OUTPUT_DRAIN_TIMEOUT);
    store.finish();
    drop(raw_mode);

    Ok(i32::try_from(exit_code).unwrap_or(1))
}

fn copy_input(writer: SharedWriter) {
    spawn(move || {
        let mut buffer = [0; READ_BUFFER_SIZE];
        let mut input = stdin().lock();
        while let Ok(read_length) = input.read(&mut buffer) {
            if read_length == 0 {
                return;
            }
            let Ok(mut writer) = writer.lock() else {
                return;
            };
            if writer.write_all(&buffer[..read_length]).is_err() {
                return;
            }
        }
    });
}

/// Resizes follow our terminal; a hangup or termination is passed on to the agent, and we exit when it does.
fn forward_signals(
    master: Box<dyn MasterPty + Send>,
    mut killer: Box<dyn ChildKiller + Send + Sync>,
) -> Result<(), Box<dyn Error>> {
    let mut signals = Signals::new([SIGWINCH, SIGHUP, SIGTERM, SIGINT])?;
    spawn(move || {
        for signal in signals.forever() {
            if signal == SIGWINCH {
                let _ = master.resize(terminal::read_size());
            } else {
                let _ = killer.kill();
            }
        }
    });

    Ok(())
}

fn copy_output(mut reader: Box<dyn Read + Send>, writer: SharedWriter, updates: Sender<Update>, done: Sender<()>) {
    spawn(move || {
        let mut buffer = [0; READ_BUFFER_SIZE];
        let mut output = stdout().lock();
        let mut scanner = Scanner::default();
        while let Ok(read_length) = reader.read(&mut buffer) {
            if read_length == 0 {
                break;
            }
            let chunk = &buffer[..read_length];
            // Once our terminal is gone the agent's output has nowhere to go, but it is still read so the agent never blocks.
            let _ = output.write_all(chunk).and_then(|()| output.flush());
            scanner.feed(chunk, &mut |event| handle_event(event, &writer, &updates));
        }
        let _ = done.send(());
    });
}

fn handle_event(event: Event, writer: &SharedWriter, updates: &Sender<Update>) {
    let update = match event {
        Event::ProgramStatus(body) => match parse_program_status(&body) {
            Some(ProgramStatus::Query) => {
                if let Ok(mut writer) = writer.lock() {
                    let _ = writer.write_all(QUERY_REPLY);
                }
                return;
            }
            // Records with an id are the session's tasks, which nothing stores yet.
            Some(ProgramStatus::Report(report)) if report.id.is_none() => Update::Status(match report.state {
                State::Clear => Status::unknown(),
                state => Status {
                    state: state.as_str(),
                    kind: report.kind,
                    progress: report.progress,
                    message: report.message,
                    reported_title: report.title,
                },
            }),
            _ => return,
        },
        Event::Title(title) => match String::from_utf8(title) {
            Ok(title) if !title.chars().any(is_control_character) => Update::TerminalTitle(title),
            _ => return,
        },
        Event::FullReset => Update::Status(Status::unknown()),
    };
    let _ = updates.send(update);
}
