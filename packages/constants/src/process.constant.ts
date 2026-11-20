export const EXIT_CODES = {
  SUCCESSFUL: 0
} as const;

// As Node's platform() names them.
export const PLATFORMS = {
  LINUX: "linux",
  MACOS: "darwin",
  WINDOWS: "win32"
} as const;

// WSL's kernel names itself in its release, as in 6.6.87.2-microsoft-standard-WSL2.
export const WSL_KERNEL_RELEASE_MARKER = "microsoft";

export const COMMAND_SEARCH = {
  DEFAULT_PATH_EXTENSIONS: ".COM;.EXE;.BAT;.CMD",
  EXECUTE_BITS: [0o100, 0o010, 0o001],
  PATH_ENV: "PATH",
  PATH_EXTENSIONS_ENV: "PATHEXT",
  POSIX_PATH_SEPARATOR: ":",
  WINDOWS_PATH_SEPARATOR: ";"
} as const;

export const PROCESS_SAMPLING = {
  INTERVAL: "2 seconds"
} as const;

export const LINUX_PROCESS_FILES = {
  CGROUP_FILE: (processId: number) => `/proc/${processId}/cgroup`,
  CGROUP_PROCESSES_FILE: "cgroup.procs",
  CGROUP_ROOT: "/sys/fs/cgroup"
} as const;

export const PROCESS_LISTING = {
  // The command line comes last, since it alone can hold spaces.
  ARGUMENTS: ["-A", "-o", "pid=,ppid=,command="],
  COMMAND: "ps",
  // "  123     1 /usr/bin/node server.js": ps right-aligns its numbers.
  LINE: /^\s*(?<processId>\d+)\s+(?<parentProcessId>\d+)\s+(?<commandLine>.*)$/u
} as const;
