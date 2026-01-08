/**
 *
 * Small utility helpers used by the extension scripts.
 *
 * Current features:
 * - Notifications: create a basic notification and auto-dismiss it after a delay.
 *
 * Dependencies:
 * - `nmind-core` for the WebExtension `browser` polyfill object.
 * - `constants` for `NOTIFICATION_ID` and `NOTIFICATION_HIDE_DELAY`.
 *
 * @author Nmind.io <osp@nmind.io>
 */

/* -------------------------------------------------------------------------- */
/* Shared modules                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Core module providing the `browser` polyfill.
 */
const core = require("../shared/nmind-core") as any;

/**
 * WebExtension polyfill object (browser.*).
 * Used here for notifications and extension asset URLs.
 */
const browser = core.browser as any;

/**
 * Constants module providing notification identifiers and delays.
 */
const constants = require("../shared/constants") as any;

/** DOM/notification identifier used by the extension. */
const NOTIFICATION_ID: string = constants.NOTIFICATION_ID;

/** Auto-hide delay in milliseconds for notifications. */
const NOTIFICATION_HIDE_DELAY: number = constants.NOTIFICATION_HIDE_DELAY;

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Displays a browser notification and auto-dismisses it after
 * `NOTIFICATION_HIDE_DELAY` milliseconds.
 *
 * Current behavior (kept identical to legacy JS):
 * - Creates a "basic" notification with a fixed icon.
 * - Clears the notification after a timeout.
 *
 * Parameters `body` and `link` exist for API compatibility, but are currently
 * not used by the implementation.
 *
 * @param message - Main notification message (displayed as content).
 * @param title - Notification title.
 * @param body - Optional array of extra lines/details (currently unused).
 * @param link - Optional link/URL associated with the notification (currently unused).
 */
function notify(
  message: string,
  title: string,
  body: unknown[] = [],
  link: string | null = null
): void {
  void body; // reserved for future use (keeps signature compatibility)
  void link; // reserved for future use (keeps signature compatibility)

  browser.notifications
    .create(NOTIFICATION_ID, {
      type: "basic",
      iconUrl: browser.extension.getURL("assets/icons/addon-48x48.png"),
      title,
      message,
    })
    .then(function (id: string) {
      setTimeout(() => {
        browser.notifications.clear(id);
      }, NOTIFICATION_HIDE_DELAY);
    });
}

/**
 * CommonJS export (pure CJS).
 * Consumers use: `const { notify } = require("./utils")`
 */
exports.notify = notify;

/**
 * Forces TS module scope (prevents "Cannot redeclare block-scoped variable" errors).
 */
export {};
