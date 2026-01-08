/**
 * 
 * Type definitions for the CommonJS module `nmind-core`.
 * 
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindCore {
  /** Minimal typing for the WebExtension browser polyfill object. */
  type Browser = Record<string, unknown>;

  /** Logger singleton type (structural). */
  interface Logger {
    isDebugMode: boolean;
    browserType: "chrome" | "opera" | "edge" | "firefox";
    info(message: string, ...rest: unknown[]): void;
    debug(message: string, ...rest: unknown[]): void;
    trace(message: string, ...rest: unknown[]): void;
    error(err: unknown): void;
    isBrowser(...args: ("chrome" | "opera" | "edge" | "firefox")[]): boolean;
  }

  /** Storage singleton type (strongly typed via DefaultOptions). */
  interface Storage {
    options: import("./constants").DefaultOptions;
    synchronize(): Promise<void>;
    onChange(listener: () => void): void;
  }

  /** Listener signature used by EventEmitter. */
  type Listener = (...args: unknown[]) => void;

  /** EventEmitter instance interface. */
  interface EventEmitterInstance {
    on(eventName: string, fn: Listener): void;
    off(eventName: string, fn: Listener): void;
    once(eventName: string, fn: Listener): void;
    emit(eventName: string, ...args: unknown[]): void;
    removeListener(eventName: string, fn: Listener): void;
  }

  /** EventEmitter constructor type. */
  interface EventEmitterCtor {
    new (): EventEmitterInstance;
  }
}

declare const NmindCoreModule: {
  browser: NmindCore.Browser;
  Logger: NmindCore.Logger;
  Storage: NmindCore.Storage;
  EventEmitter: NmindCore.EventEmitterCtor;
};

export = NmindCoreModule;