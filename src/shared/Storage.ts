/**
 * Thin wrapper around `browser.storage.local` used by the Nmind Companion
 * Browser Extension to keep an in-memory options object synchronized with
 * persisted extension storage.
 *
 * Features:
 * - listens to `browser.storage.onChanged` and re-syncs when local storage changes
 * - merges stored values into the current options object
 * - supports a single change listener callback
 * 
 * @author Nmind.io <osp@nmind.io>
 */

const webext = require("webextension-polyfill") as {
  storage: {
    onChanged: { addListener: (cb: (changes: unknown, area: string) => void) => void };
    local: {
      get: () => Promise<Partial<import("./constants").DefaultOptions> & Record<string, unknown>>;
    };
  };
};

const constants = require("./constants") as {
  DEFAULT_OPTIONS: import("./constants").DefaultOptions;
};
const DEFAULT_OPTIONS = constants.DEFAULT_OPTIONS;

/**
 * Listener called after options have been synchronized.
 */
type ChangeListener = (() => void) | null;

/**
 * Wraps storage synchronization for a mutable options object.
 */
class StorageWrapper {
  /**
   * Current options (in-memory).
   * It is updated by merging stored values on each synchronization.
   */
  public options: import("../shared/constants").DefaultOptions;

  /**
   * Optional callback invoked after each successful synchronization.
   */
  private listener: ChangeListener;

  /**
   * Creates a storage wrapper bound to an initial options object.
   *
   * The instance subscribes to `browser.storage.onChanged` and triggers
   * a synchronization whenever the `"local"` area changes.
   *
   * @param __options - Initial options object (will be mutated over time).
   */
  constructor(__options: import("../shared/constants").DefaultOptions) {
    this.options = __options;
    this.listener = null;

    // Keep original behavior: re-sync on any local storage change.
    webext.storage.onChanged.addListener((changes: unknown, area: string) => {
      if (area === "local") {
        this.synchronize();
      }
    });
  }

  /**
   * Synchronizes in-memory options with persisted `browser.storage.local`.
   *
   * Behavior:
   * - reads the whole local storage via `browser.storage.local.get()`
   * - merges retrieved values into `this.options` via `Object.assign`
   * - calls the registered listener (if any)
   * - logs errors to console (same as original)
   *
   * @returns A promise that resolves when synchronization completes.
   */
  synchronize(): Promise<void> {
    return webext.storage.local
      .get()
      .then((values: Record<string, unknown>) => {
        this.options = Object.assign(this.options, values);
        if (this.listener) {
          this.listener();
        }
      })
      .catch((error: unknown) => {
        console.log(error);
      });
  }

  /**
   * Registers a callback invoked after each successful synchronization.
   * Only one listener is supported; a new one replaces the previous.
   *
   * @param listener - Callback function.
   */
  onChange(listener: () => void): void {
    this.listener = listener;
  }
}

/**
 * CommonJS export (pure CJS).
 * Kept identical to original: exports a singleton instance bound to DEFAULT_OPTIONS.
 */
exports.Storage = new StorageWrapper(DEFAULT_OPTIONS);