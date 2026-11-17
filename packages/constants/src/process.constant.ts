export const EXIT_CODES = {
  SUCCESSFUL: 0
} as const;

// The PlatformError reason's method when the command itself couldn't start, as against its cwd missing ("access").
export const CHILD_PROCESS_SPAWN_METHOD = "spawn";

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
