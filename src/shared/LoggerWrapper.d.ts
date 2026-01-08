/**
 *
 * Type definitions for the CommonJS module `LoggerWrapper`.
 * 
 * @author Nmind.io <osp@nmind.io>
 */
declare namespace NmindLoggerWrapper {
  /** Supported browser identifiers used by the logger. */
  type BrowserType = "chrome" | "opera" | "edge" | "firefox";

  /**
   * Debug-gated logger instance.
   * In this project, it is exported as a singleton named `Logger`.
   */
  interface Logger {
    /** Whether logs are emitted. */
    isDebugMode: boolean;

    /** Detected browser identifier. */
    browserType: BrowserType;

    /** Logs an informational message (debug-gated). */
    info(message: string, ...rest: unknown[]): void;

    /** Logs a debug message (debug-gated). */
    debug(message: string, ...rest: unknown[]): void;

    /** Logs a trace message (debug-gated). */
    trace(message: string, ...rest: unknown[]): void;

    /** Logs an error message or Error-like object (debug-gated). */
    error(err: unknown): void;

    /**
     * Checks whether the current detected browser matches one of the provided identifiers.
     */
    isBrowser(...args: BrowserType[]): boolean;
  }
}

declare const LoggerWrapperModule: {
  Logger: NmindLoggerWrapper.Logger;
};

export = LoggerWrapperModule;