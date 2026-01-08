/**
 *
 * This script runs in the content-script context and acts as a bridge between:
 * - the web page (injected `public.js` running in the page context)
 * - the extension messaging stack (TabListener <-> BackgroundClient)
 * - persisted options (Storage)
 *
 * Responsibilities:
 * 1) Keep Logger debug mode in sync with persisted options (Storage).
 * 2) Inject `bundles/public.js` into the page context.
 * 3) Create and wire messaging endpoints:
 *    - TabListener(document): DOM event/TextNode bridge
 *    - BackgroundClient(): background messaging (runtime)
 *    - join(): connect them so routes can be piped/forwarded
 * 4) Register default routes:
 *    - content.ping / content.echo
 *    - extension.version
 *    - test routes: content.addition / content.multiplication
 *
 * @author Nmind.io <osp@nmind.io>
 */

/* -------------------------------------------------------------------------- */
/* External globals                                                           */
/* -------------------------------------------------------------------------- */

/**
 * In a WebExtension content script, `chrome` may exist even if the project uses
 * the `browser` polyfill elsewhere. We declare it to avoid TS errors.
 */
declare const chrome: any;

/* -------------------------------------------------------------------------- */
/* Shared modules (CommonJS)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Core module providing:
 * - Logger singleton
 * - browser polyfill object
 * - Storage singleton (options sync)
 */
const core = require("../shared/nmind-core") as any;

/** Logger singleton (debug/info/error). */
const Logger = core.Logger as any;

/** WebExtension polyfill object (browser.*). */
const browser = core.browser as any;

/** Storage singleton holding persisted options (and change notifications). */
const Storage = core.Storage as any;

/**
 * Messaging module providing:
 * - TabListener (DOM-event/TextNode bridge)
 * - BackgroundClient (runtime background messaging)
 */
const messaging = require("../shared/nmind-messaging") as any;

/** TabListener constructor. */
const TabListener = messaging.TabListener as any;

/** BackgroundClient constructor. */
const BackgroundClient = messaging.BackgroundClient as any;

/* -------------------------------------------------------------------------- */
/* Startup logging                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Logs a banner in debug mode during temporary installation.
 */
if (Logger.isDebugMode) {
  Logger.info(
    `Temporary installation on ${Logger.browserType}. Debug mode on.`
  );
}

/* -------------------------------------------------------------------------- */
/* Storage integration                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Keeps Logger debug mode synchronized with persisted options.
 *
 * Behavior:
 * - On any Storage change:
 *   - sets `Logger.isDebugMode` from `Storage.options.console`
 *   - prints the current options in debug logs
 */
Storage.onChange(() => {
  Logger.isDebugMode = Storage.options.console;
  Logger.debug(`Content-script : Fetch options`, Storage.options);
});

/**
 * Triggers initial options load from browser storage.
 */
Storage.synchronize();

/* -------------------------------------------------------------------------- */
/* Page script injection                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Injects `bundles/public.js` into the page context.
 *
 * Why:
 * - Content scripts and page scripts run in different JS worlds.
 * - Injecting a script tag is a common way to run code in the page context.
 *
 * Implementation details:
 * - Uses `chrome.runtime.getURL` when available (common in content scripts).
 * - Falls back to `browser.runtime.getURL` when `chrome` is not present.
 * - Removes the script element after it loads.
 */
function injectPublicBundle(): void {
  const script = document.createElement("script");

  const getURL =
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    typeof chrome.runtime.getURL === "function"
      ? chrome.runtime.getURL.bind(chrome.runtime)
      : browser?.runtime?.getURL?.bind(browser.runtime);

  script.src = getURL ? getURL("bundles/public.js") : "bundles/public.js";

  script.onload = function () {
    // `this` is the <script> element
    (this as HTMLScriptElement).remove();
  };

  (document.head || document.documentElement).appendChild(script);
}

injectPublicBundle();

/* -------------------------------------------------------------------------- */
/* Messaging endpoints wiring                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Background client used to communicate with the extension background script.
 */
const __client = new BackgroundClient();

/**
 * Pipes response routes related to print/download back through the client.
 *
 * Matches routes:
 * - companion.document.print.response
 * - companion.document.download.response
 */
__client.pipe(/companion\.document\.(print|download)\.response/);

/**
 * TabListener instance bound to the current document.
 *
 * TabListener listens to DOM events ("io.nmind.request") coming from the page
 * and routes them to registered handlers or to joined endpoints.
 */
const __listener = new TabListener(document);

/**
 * Joins TabListener and BackgroundClient so they can forward to each other.
 * This is what enables piping / forwarding between the two endpoints.
 */
__listener.join(__client);

/* -------------------------------------------------------------------------- */
/* Default route wiring                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Pipes all routes matching:
 * - background.*
 * - companion.*
 *
 * Meaning:
 * - calls originating from page side can be forwarded to background/native services.
 */
__listener.pipe(/background\..+/, /companion\..+/);

/**
 * Route: content.ping
 * Simple health check used by the page-side client.
 *
 * @returns a fixed string "content-pong"
 */
__listener.on("content.ping", () => {
  return "content-pong";
});

/**
 * Route: extension.version
 * Returns the extension manifest version.
 *
 * @returns the extension version string
 */
__listener.on("extension.version", function () {
  return browser.runtime.getManifest().version;
});

/**
 * Route: content.echo
 * Echoes back the provided message.
 *
 * @param message - any value from the caller
 * @returns the same message
 */
__listener.on("content.echo", function (message: unknown) {
  return message;
});

/* -------------------------------------------------------------------------- */
/* Test routes                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Route: content.addition
 * Test handler demonstrating argument forwarding.
 *
 * @param left - first operand
 * @param right - second operand
 * @returns left + right
 */
__listener.on("content.addition", (left: number, right: number) => {
  return left + right;
});

/**
 * Route: content.multiplication
 * Test handler demonstrating argument forwarding.
 *
 * @param left - first operand
 * @param right - second operand
 * @returns left * right
 */
__listener.on("content.multiplication", (left: number, right: number) => {
  return left * right;
});

/**
 * Forces TS module scope (prevents "Cannot redeclare block-scoped variable" when
 * compiling multiple scripts during partial migration).
 */
export {};
