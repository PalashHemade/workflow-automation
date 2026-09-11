/**
 * Lightweight tagged logger for server-side code (API routes, lib/, middleware).
 * No external dependency — plain console under the hood, colored only when
 * attached to a real TTY so Docker/CI log output stays clean plain text.
 */

const useColor = typeof process !== "undefined" && !!process.stdout?.isTTY;

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function paint(color: keyof typeof colors, text: string): string {
  return useColor ? `${colors[color]}${text}${colors.reset}` : text;
}

function timestamp(): string {
  return new Date().toTimeString().slice(0, 8); // HH:MM:SS
}

function format(tag: string, symbol: string, symbolColor: keyof typeof colors, msg: string): string {
  const ts = paint("dim", `[${timestamp()}]`);
  const tagStr = paint("cyan", `[${tag}]`);
  return `${ts} ${tagStr} ${paint(symbolColor, symbol)} ${msg}`;
}

export interface Logger {
  info: (msg: string, ...args: any[]) => void;
  success: (msg: string, ...args: any[]) => void;
  warn: (msg: string, ...args: any[]) => void;
  error: (msg: string, ...args: any[]) => void;
}

/**
 * Creates a tagged logger, e.g. createLogger("SyncEngine") logs as
 * "[12:04:31] [SyncEngine] ✔ synced 42 commits"
 */
export function createLogger(tag: string): Logger {
  return {
    info: (msg, ...args) => console.log(format(tag, "ℹ", "cyan", msg), ...args),
    success: (msg, ...args) => console.log(format(tag, "✔", "green", msg), ...args),
    warn: (msg, ...args) => console.warn(format(tag, "⚠", "yellow", msg), ...args),
    error: (msg, ...args) => console.error(format(tag, "✖", "red", msg), ...args),
  };
}
