/**
 *
 * Script executed in the extension settings page.
 *
 * Responsibilities:
 * - Wire UI events:
 *   - Help: open settings/help URL in a new tab
 *   - Close: close the window (if allowed by browser)
 *   - Refresh: reload data from storage
 *   - Sync triggers: persist current options to storage on change
 * - Load options from `browser.storage.local` and merge into `__options`
 * - Persist options to `browser.storage.local` via `syncOptions()`
 *
 * @author Nmind.io <osp@nmind.io>
 */

/* -------------------------------------------------------------------------- */
/* External globals (provided by the settings page HTML)                       */
/* -------------------------------------------------------------------------- */

/**
 * jQuery global injected by the settings page.
 * Kept as `any` to avoid requiring jQuery typings in the extension build.
 */
declare const jQuery: any;

/**
 * WebExtension polyfill object expected to be available globally on the page.
 * Example usage in this file:
 * - browser.tabs.create(...)
 * - browser.storage.local.get()
 * - browser.storage.local.set(...)
 */
declare const browser: any;

/**
 * Logger singleton expected to be available globally on the page.
 * Used to log errors in onError().
 */
declare const Logger: any;

/**
 * Settings/help URL expected to be available globally on the page.
 * Used by the "help" trigger to open a tab.
 */
declare const URL_SETTINGS: string;

/**
 * Options object expected to be available globally on the page.
 *
 * This script merges persisted values into it and saves it back.
 * The exact shape depends on your shared `constants.DEFAULT_OPTIONS`.
 */
declare let __options: Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/* Shared modules (CommonJS)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Messaging module providing BackgroundClient.
 * Note: the client is instantiated but not used in the current implementation.
 * It is kept for future use or for parity with other UI scripts.
 */
const messaging = require("../shared/nmind-messaging") as any;

/** Background messaging client constructor. */
const BackgroundClient = messaging.BackgroundClient as any;

/**
 * Background client instance.
 * Currently unused in this file, but kept as in the original JS.
 */
const __client = new BackgroundClient();

/* -------------------------------------------------------------------------- */
/* jQuery entry point                                                          */
/* -------------------------------------------------------------------------- */

jQuery.noConflict();

/**
 * Main UI wiring.
 *
 * @param $ - jQuery alias (noConflict-safe).
 */
jQuery(function ($: any) {
  $(document).ready(function () {
    /* ---------------------------------------------------------------------- */
    /* Help / navigation                                                      */
    /* ---------------------------------------------------------------------- */

    /**
     * Opens the settings/help URL in a new tab, then closes the settings window.
     */
    $("#trigger-help").on("click", function (_e: Event) {
      browser.tabs.create({ url: URL_SETTINGS });
      window.close();
    });

    /* ---------------------------------------------------------------------- */
    /* Persistence trigger                                                     */
    /* ---------------------------------------------------------------------- */

    /**
     * Any element with `.sync-trigger` causes options persistence on change.
     */
    $(".sync-trigger").on("change", function (_e: Event) {
      syncOptions();
    });

    /* ---------------------------------------------------------------------- */
    /* Window controls                                                         */
    /* ---------------------------------------------------------------------- */

    /**
     * Closes the settings window.
     */
    $("#window-trigger-close").on("click", function (_e: Event) {
      window.close();
    });

    /**
     * Reloads data from storage and re-hydrates the form.
     */
    $("#window-trigger-refresh").on("click", function (_e: Event) {
      loadData();
    });

    /**
     * Initial load.
     */
    loadData();
  });

  /* ------------------------------------------------------------------------ */
  /* Data loading                                                             */
  /* ------------------------------------------------------------------------ */

  /**
   * Loads persisted options from `browser.storage.local` and merges them into
   * the in-memory `__options` object.
   *
   * Then calls `hydrateForm()` to refresh the UI.
   */
  function loadData(): void {
    Promise.all([browser.storage.local.get()]).then(function (values: any[]) {
      __options = Object.assign(__options, values[0]);
      hydrateForm();
    });
  }

  /**
   * Applies `__options` to the settings page form.
   *
   * Note:
   * - In your original file, this function is empty.
   * - It is kept as a dedicated hook to populate fields (checkboxes/selects/inputs).
   * - You can implement it later without changing the rest of the flow.
   */
  function hydrateForm(): void {
    // Intentionally empty (legacy behavior).
    // Populate the UI from `__options` here when needed.
  }

  /* ------------------------------------------------------------------------ */
  /* Persistence                                                              */
  /* ------------------------------------------------------------------------ */

  /**
   * Persists the current in-memory `__options` object to `browser.storage.local`.
   *
   * Success handler is intentionally empty (legacy behavior).
   * Errors are forwarded to `onError`.
   */
  function syncOptions(): void {
    browser.storage.local.set(__options).then(function () {
      // Success: nothing to do (legacy behavior).
    }, onError);
  }

  /**
   * Generic error handler for async operations in this settings script.
   *
   * @param error - Any error-like value.
   */
  function onError(error: unknown): void {
    Logger.error(error);
  }
});

/**
 * Forces TS module scope (prevents "Cannot redeclare block-scoped variable" errors).
 */
export {};
