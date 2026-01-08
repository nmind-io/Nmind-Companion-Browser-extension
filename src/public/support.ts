/**
 *
 * Small bootstrap script executed in the "support" page context.
 *
 * Responsibility:
 * - Initialize the page-side extension client by calling `configureWindow(window)`.
 *
 * What `configureWindow` does (from nmind-messaging/ExtensionClient):
 * - Creates a page-side `ExtensionClient` instance
 * - Attaches it to the given window object (typically as `window.supportClient`)
 * - Dispatches a readiness event (e.g. "supportClient.ready")
 *
 * @author Nmind.io <osp@nmind.io>
 */

/**
 * Module providing the `configureWindow` helper for wiring the page-side client.
 */
const extensionClientMod =
  require("../shared/nmind-messaging/ExtensionClient") as {
    /**
     * Injects the page-side `supportClient` and dispatches a readiness event.
     *
     * @param windowObj - Window-like object that will receive `supportClient`.
     */
    configureWindow: (windowObj: Window) => void;
  };

/**
 * Shortcut reference to the configure function.
 */
const configureWindow = extensionClientMod.configureWindow;

/**
 * Bootstrap: configure the current window.
 */
configureWindow(window);

/**
 * Forces TS module scope (prevents "Cannot redeclare block-scoped variable" errors).
 */
export {};
