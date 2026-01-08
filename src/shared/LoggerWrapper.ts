/**
 *
 * Small logging utility for the Nmind Companion Browser Extension.
 *
 * This module:
 * - detects the current browser (chrome/opera/edge/firefox)
 * - exposes a debug-gated logger (info/debug/trace/error)
 * - pretty-prints extra arguments using `varDump`
 * 
 * @author Nmind.io <osp@nmind.io>
 */
const misc = require("../shared/nmind-misc") as {
  varDump: (...args: unknown[]) => string;
};

/** Supported browser identifiers used by the logger. */
type BrowserType = "chrome" | "opera" | "edge" | "firefox";

/**
 * Function signature for console handlers like `console.info`, `console.debug`, etc.
 */
type ConsoleHandler = (...args: unknown[]) => void;

/**
 * Wraps console logging behind a debug flag, and groups extra values in a
 * collapsed console group.
 *
 * The browser type is detected once at construction.
 */
class LoggerWrapper {
  /** Whether logs should be emitted. */
  public isDebugMode: boolean;

  /** Browser identifier computed at construction time. */
  public browserType: BrowserType;

  /**
   * Creates a logger wrapper.
   *
   * @param debug - If `true`, logs are emitted; if `false`, all logging calls are no-ops.
   */
  constructor(debug: boolean) {
    this.isDebugMode = debug;
    this.browserType = "firefox";

    // NOTE: This keeps the original behavior (same checks & order).
    // In Chrome/Opera, `browser` is typically undefined, but `chrome.runtime` exists.
    if (typeof (globalThis as any).browser === "undefined" && typeof (globalThis as any).chrome !== "undefined" && (globalThis as any).chrome.runtime) {
      if (/\bOPR\//.test(navigator.userAgent)) {
        this.browserType = "opera";
      } else {
        this.browserType = "chrome";
      }
    } else if (/\bEdge\//.test(navigator.userAgent)) {
      this.browserType = "edge";
    } else {
      this.browserType = "firefox";
    }
  }

  /**
   * Logs an informational message (debug-gated).
   *
   * @param message - Message displayed as the main line or group title.
   * @param rest - Optional values to be dumped and printed under a collapsed group.
   */
  info(message: string, ...rest: unknown[]): void {
    this.consoleIf(message, console.info.bind(console), rest);
  }

  /**
   * Logs a debug message (debug-gated).
   *
   * @param message - Message displayed as the main line or group title.
   * @param rest - Optional values to be dumped and printed under a collapsed group.
   */
  debug(message: string, ...rest: unknown[]): void {
    this.consoleIf(message, console.debug.bind(console), rest);
  }

  /**
   * Logs a trace message (debug-gated).
   *
   * @param message - Message displayed as the main line or group title.
   * @param rest - Optional values to be dumped and printed under a collapsed group.
   */
  trace(message: string, ...rest: unknown[]): void {
    this.consoleIf(message, console.trace.bind(console), rest);
  }

  /**
   * Internal helper: logs only when debug mode is enabled.
   *
   * Behavior:
   * - If debug is disabled => returns immediately
   * - If `groups` contains items => prints a collapsed group titled `message`
   *   and logs each dumped item via the provided handler
   * - Otherwise => prints `message` directly via the handler
   *
   * @param message - Main message or group title.
   * @param handler - Console handler used to print output.
   * @param groups - Additional values to dump and print as grouped lines.
   */
  consoleIf(message: string, handler: ConsoleHandler, groups?: unknown[] | unknown): void {
    if (!this.isDebugMode) return;

    const strings: string[] = [];

    // Keep original semantics: accept only objects for grouping.
    // In original JS: groups is expected to be an array (rest) OR something "object".
    if (groups && typeof groups === "object") {
      // If it's an array => iterate values
      if (Array.isArray(groups)) {
        for (const v of groups) strings.push(misc.varDump(v));
      } else {
        // If it’s a plain object => iterate enumerable keys (original had for..in)
        for (const k in groups as Record<string, unknown>) {
          strings.push(misc.varDump((groups as Record<string, unknown>)[k]));
        }
      }
    }

    if (strings.length > 0) {
      console.groupCollapsed(message);
      for (const s of strings) {
        handler(s);
      }
      console.groupEnd();
    } else {
      handler(message);
    }
  }

  /**
   * Logs an error (debug-gated).
   *
   * Supported inputs:
   * - string: logged as-is
   * - Error-like objects: logs `err.message` and tries to include stack details
   *
   * Note: the original code passes `err.stack` into `consoleIf` in a way that
   * behaves like "no grouping" for string stacks. Here we keep the behavior
   * but accept both string and array/object stack inputs.
   *
   * @param err - Error message or Error-like object.
   */
  error(err: unknown): void {
    if (typeof err === "string") {
      this.consoleIf(err, console.error.bind(console));
      return;
    }

    const e = err as { message?: unknown; stack?: unknown };
    const msg = typeof e?.message === "string" ? e.message : String(e?.message ?? err);

    // Try to keep compatibility: stack may be string; allow it without grouping.
    if (typeof e?.stack === "string") {
      // Original behavior effectively logs only message when stack is a string,
      // because `groups` is string => typeof !== "object".
      this.consoleIf(msg, console.error.bind(console));
    } else {
      // If stack is array/object (rare) => group it
      this.consoleIf(msg, console.error.bind(console), e?.stack as any);
    }
  }

  /**
   * Checks whether the current detected browser matches one of the provided identifiers.
   *
   * @param args - Browser identifiers to test (e.g. "chrome", "firefox").
   * @returns `true` if any argument equals `browserType`, otherwise `false`.
   *
   * @example
   * ```ts
   * if (logger.isBrowser("chrome", "opera")) { ... }
   * ```
   */
  isBrowser(...args: BrowserType[]): boolean {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === this.browserType) return true;
    }
    return false;
  }
}

/**
 * Public singleton logger (default: debug disabled).
 * Consumers can still flip the flag at runtime if needed:
 * `Logger.isDebugMode = true;`
 */
exports.Logger = new LoggerWrapper(false);