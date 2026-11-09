use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const SESSION_ID: &str = "01a1b9ae-8986-7295-b1cc-487c4a1396f4";

/// The extension's own migrations, so the binary is tested against the real schema. Each test gets its own folder, since
/// tests run in parallel.
fn create_database(test_name: &str) -> PathBuf {
    let directory = std::env::temp_dir().join(format!("aggregor-pty-test-{}-{test_name}", std::process::id()));
    fs::create_dir_all(&directory).unwrap();
    let database_path = directory.join("aggregor.db");
    let connection = Connection::open(&database_path).unwrap();
    let migrations_directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("../extension/assets/migrations");
    let mut migration_paths: Vec<PathBuf> = fs::read_dir(migrations_directory)
        .unwrap()
        .map(|entry| entry.unwrap().path().join("migration.sql"))
        .collect();
    migration_paths.sort();
    for migration_path in migration_paths {
        for statement in fs::read_to_string(migration_path)
            .unwrap()
            .split("--> statement-breakpoint")
        {
            connection.execute_batch(statement).unwrap();
        }
    }
    connection
        .execute_batch(&format!(
            "INSERT INTO projects (id, updatedAt, path) VALUES ('project', '2026-11-08T00:00:00.000Z', '/tmp');
            INSERT INTO sessions (id, updatedAt, projectId, agentId, name)
            VALUES ('{SESSION_ID}', '2026-11-08T00:00:00.000Z', 'project', 'claude', 'test');"
        ))
        .unwrap();

    database_path
}

#[test]
fn passes_output_through_and_writes_the_session_row() {
    let database_path = create_database("status");
    let message = STANDARD.encode("Approve Write: notes.txt");
    let title = STANDARD.encode("Write the notes");
    // The agent asks whether the terminal supports OSC 7501 and reads the reply in non-canonical mode (`read -n`).
    let script = format!(
        r#"printf '\033]7501;?\033\\'
        IFS= read -r -s -n 9 -t 5 reply
        case "$reply" in *7501*) printf '\033]2;answered\007' ;; esac
        printf '\033]7501;state=working:progress=40\007'
        printf '\033]7501;state=blocked:kind=permission:msg={message}:title={title}\033\\'
        printf 'plain output\n'
        exit 3"#
    );

    let output = Command::new(env!("CARGO_BIN_EXE_aggregor-pty"))
        .args([
            "--database",
            database_path.to_str().unwrap(),
            "--session",
            SESSION_ID,
            "--",
        ])
        .args(["bash", "-c", &script])
        .stdin(Stdio::null())
        .output()
        .unwrap();

    assert_eq!(output.status.code(), Some(3));
    assert!(String::from_utf8_lossy(&output.stdout).contains("plain output"));
    let connection = Connection::open(&database_path).unwrap();
    let row: (
        String,
        Option<String>,
        bool,
        Option<String>,
        Option<String>,
        Option<String>,
    ) = connection
        .query_row(
            "SELECT status, statusKind, hasWorked, reportedTitle, terminalTitle, statusChangedAt FROM sessions",
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                ))
            },
        )
        .unwrap();
    assert_eq!(row.0, "exited");
    assert_eq!(row.1, None);
    assert!(row.2, "a working report sets hasWorked");
    assert_eq!(row.3.as_deref(), Some("Write the notes"));
    assert_eq!(row.4.as_deref(), Some("answered"), "the query was answered");
    assert!(row.5.is_some_and(|changed_at| changed_at.ends_with('Z')));
    fs::remove_dir_all(database_path.parent().unwrap()).unwrap();
}

#[test]
fn records_the_agents_own_session_id_from_its_title() {
    let database_path = create_database("agent-session-id");
    let agent_session_id = "01a1c1a2-27df-7a02-9403-56722f44f32e";

    let output = Command::new(env!("CARGO_BIN_EXE_aggregor-pty"))
        .args([
            "--database",
            database_path.to_str().unwrap(),
            "--session",
            SESSION_ID,
            "--",
        ])
        .args(["bash", "-c", &format!(r"printf '\033]2;{agent_session_id}\007'")])
        .stdin(Stdio::null())
        .output()
        .unwrap();

    assert_eq!(output.status.code(), Some(0));
    let connection = Connection::open(&database_path).unwrap();
    let stored_agent_session_id: Option<String> = connection
        .query_row("SELECT agentSessionId FROM sessions", [], |row| row.get(0))
        .unwrap();
    assert_eq!(stored_agent_session_id.as_deref(), Some(agent_session_id));
    fs::remove_dir_all(database_path.parent().unwrap()).unwrap();
}
