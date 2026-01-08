/**
 *
 * Type definitions for the CommonJS module `Storage`.
 * 
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindStorage {
  /** Default options shape (from `constants`). */
  type Options = import("../shared/constants").DefaultOptions;

  interface Storage {
    /** Current in-memory options (merged from local storage). */
    options: Options;

    /** Synchronizes `options` with `browser.storage.local`. */
    synchronize(): Promise<void>;

    /** Registers the change listener (replaces any previous listener). */
    onChange(listener: () => void): void;
  }
}

declare const StorageModule: {
  Storage: NmindStorage.Storage;
};

export = StorageModule;