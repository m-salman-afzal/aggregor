export const REQUIRED_TOOLS_COMMANDS = {
  INSTALL: "aggregorApp.installRequiredTools"
} as const;

export const REQUIRED_TOOLS = {
  GITHUB_CLI: "gh",
  TMUX: "tmux"
} as const;

export const TOOL_INSTALL_COMMANDS = [
  {installCommandLine: "brew install", packageManager: "brew", packageNames: {gh: "gh", tmux: "tmux"}},
  {installCommandLine: "sudo apt-get install -y", packageManager: "apt-get", packageNames: {gh: "gh", tmux: "tmux"}},
  {installCommandLine: "sudo dnf install -y", packageManager: "dnf", packageNames: {gh: "gh", tmux: "tmux"}},
  {
    installCommandLine: "sudo pacman -S --noconfirm",
    packageManager: "pacman",
    packageNames: {gh: "github-cli", tmux: "tmux"}
  },
  {installCommandLine: "sudo zypper install -y", packageManager: "zypper", packageNames: {gh: "gh", tmux: "tmux"}},
  {installCommandLine: "sudo apk add", packageManager: "apk", packageNames: {gh: "github-cli", tmux: "tmux"}}
] as const;

export const TOOL_INSTALL_PAGES = {
  gh: "https://github.com/cli/cli#installation",
  tmux: "https://github.com/tmux/tmux/wiki/Installing"
} as const;

export const SETUP_TERMINAL = {
  CLOSE_PROMPT: "; printf '\\nPress Enter to close.'; read -r _",
  NAME: "Aggregor Setup",
  SHELL: "sh"
} as const;

export const REQUIRED_TOOLS_LABELS = {
  INSTALL: "Install",
  INSTALL_PAGE: (toolName: string) => `Install ${toolName}`
} as const;

export const REQUIRED_TOOL_NEEDS = {
  gh: "the GitHub CLI (gh) to show each session's pull request",
  tmux: "tmux 3.2 or newer to run sessions",
  tmuxTooOld: (foundVersion: string) => `tmux 3.2 or newer to run sessions, and this machine has ${foundVersion}`
} as const;

export const REQUIRED_TOOLS_NOTICES = {
  MISSING: (toolNeeds: string, installCommandLine: string) =>
    `Aggregor needs ${toolNeeds}. Install runs \`${installCommandLine}\` in a terminal.`,
  MISSING_WITHOUT_PACKAGE_MANAGER: (toolNeeds: string) =>
    `Aggregor needs ${toolNeeds}, and no package manager it knows is installed; each tool's install page says how.`
} as const;

export const REQUIRED_TOOLS_ERRORS = {
  NO_PACKAGE_MANAGER: "No package manager Aggregor knows is installed, so tmux and gh have to be installed by hand."
} as const;
