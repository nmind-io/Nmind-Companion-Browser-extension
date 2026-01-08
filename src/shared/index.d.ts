/**
 *
 * Type definitions for the CommonJS module `index`.
 *
 * This module aggregates the exports of:
 * - ./constants
 * - ./EventEmitter
 * - ./Storage
 * - ./LoggerWrapper
 * - ./nmind-core
 * - ./nmind-misc
 *
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace SharedIndexTypes {
  // ---------------------------------------------------------------------------
  // constants (from constants.ts)
  // ---------------------------------------------------------------------------

  interface DefaultOptions {
    console: boolean;

    printer: {
      activate: boolean;
      default: string;
    };

    pos: {
      activate: boolean;
      device: string;
      port: string;
      protocol: string;
      ethip: string;
    };
  }

  // ---------------------------------------------------------------------------
  // Logger (from LoggerWrapper.ts)
  // ---------------------------------------------------------------------------

  type BrowserType = "chrome" | "opera" | "edge" | "firefox";

  interface Logger {
    isDebugMode: boolean;
    browserType: BrowserType;

    info(message: string, ...rest: unknown[]): void;
    debug(message: string, ...rest: unknown[]): void;
    trace(message: string, ...rest: unknown[]): void;
    error(err: unknown): void;

    isBrowser(...args: BrowserType[]): boolean;
  }

  // ---------------------------------------------------------------------------
  // Storage (from Storage.ts)
  // ---------------------------------------------------------------------------

  interface Storage {
    options: DefaultOptions;
    synchronize(): Promise<void>;
    onChange(listener: () => void): void;
  }

  // ---------------------------------------------------------------------------
  // EventEmitter (from EventEmitter.ts)
  // ---------------------------------------------------------------------------

  type Listener = (...args: unknown[]) => void;

  interface EventEmitterInstance {
    on(eventName: string, fn: Listener): void;
    off(eventName: string, fn: Listener): void;
    once(eventName: string, fn: Listener): void;
    emit(eventName: string, ...args: unknown[]): void;
    removeListener(eventName: string, fn: Listener): void;
  }

  interface EventEmitterCtor {
    new (): EventEmitterInstance;
  }

  // ---------------------------------------------------------------------------
  // misc (from nmind-misc.ts)
  // ---------------------------------------------------------------------------

  type JsTypeof =
    | "string"
    | "number"
    | "boolean"
    | "bigint"
    | "symbol"
    | "undefined"
    | "object"
    | "function";

  interface Misc {
    ensureType(target: unknown, property: string, expected: JsTypeof, value: unknown): void;
    typeOfString(target: unknown, property: string, value: string): void;
    typeOfNumber(target: unknown, property: string, value: number): void;
    typeOfBoolean(target: unknown, property: string, value: boolean): void;
    varDump(...args: unknown[]): string;
  }

  // ---------------------------------------------------------------------------
  // browser polyfill (from nmind-core.ts)
  // ---------------------------------------------------------------------------

  type Browser = Record<string, unknown>;
}

declare const shared: {
  // ----- constants -----
  NOTIFICATION_HIDE_DELAY: number;
  NOTIFICATION_ID: string;
  URL_EXTENSION: string;
  URL_AFTER_INSTALL: string;
  URL_SETTINGS: string;
  COMPANION_HOST: string;
  DIR_PRINT_JOBS: string;
  DIR_DOWNLOAD_JOBS: string;
  DEFAULT_OPTIONS: SharedIndexTypes.DefaultOptions;

  // ----- event emitter -----
  Eventemitter: SharedIndexTypes.EventEmitterCtor;

  // ----- singletons -----
  Logger: SharedIndexTypes.Logger;
  Storage: SharedIndexTypes.Storage;

  // ----- nmind-core exports -----
  browser: SharedIndexTypes.Browser;
  EventEmitter: SharedIndexTypes.EventEmitterCtor;

  // ----- misc -----
  ensureType: SharedIndexTypes.Misc["ensureType"];
  typeOfString: SharedIndexTypes.Misc["typeOfString"];
  typeOfNumber: SharedIndexTypes.Misc["typeOfNumber"];
  typeOfBoolean: SharedIndexTypes.Misc["typeOfBoolean"];
  varDump: SharedIndexTypes.Misc["varDump"];
};

export = shared;