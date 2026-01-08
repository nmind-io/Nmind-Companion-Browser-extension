/**
 *
 * Main background script that wires:
 * - Options synchronization (Storage -> Logger)
 * - Installation hook (open URL_AFTER_INSTALL)
 * - Messaging endpoints:
 *   - BackgroundListener: routes requests coming from content/page scripts
 *   - NativeHostClient: forwards companion.* calls to native host
 * - Services:
 *   - downloadService: manages downloads through browser.downloads.*
 *   - printerService: prints files through native host client
 *
 * Exposed routes (via BackgroundListener):
 * - background.ping / background.version / background.echo
 * - companion.capabilities / companion.isConnected / companion.connect / companion.disconnect
 * - companion.document.download / companion.document.print (+ *.response pushed back)
 * - companion.location.open.download
 * - companion.pos.ping / companion.pos.process
 *
 * @author Nmind.io <osp@nmind.io>
 */

/* -------------------------------------------------------------------------- */
/* Shared core (Logger / browser / Storage)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Core shared module.
 * Exposes:
 * - Logger: debug/info/error wrapper
 * - browser: webextension polyfill object
 * - Storage: options synchronization singleton
 */
const core = require("../shared/nmind-core") as any;

/** Logger singleton (debug/info/error). */
const Logger = core.Logger as any;

/** WebExtension polyfill object (browser.*). */
const browser = core.browser as any;

/** Storage singleton used to keep options in memory (and in sync). */
const Storage = core.Storage as any;

/* -------------------------------------------------------------------------- */
/* Messaging layer                                                            */
/* -------------------------------------------------------------------------- */

/**
 * nmind-messaging barrel.
 * Exposes:
 * - Message: message factory (success/error/request/…)
 * - NativeHostClient: native messaging client endpoint
 * - BackgroundListener: runtime listener endpoint (routes requests)
 */
const messaging = require("../shared/nmind-messaging") as any;

/** Message factory (Message.success / Message.error / Message.request). */
const Message = messaging.Message as any;

/** Native host client constructor (connectNative / sendNativeMessage). */
const NativeHostClient = messaging.NativeHostClient as any;

/** Background listener constructor (runtime.onConnect / runtime.onMessage). */
const BackgroundListener = messaging.BackgroundListener as any;

/* -------------------------------------------------------------------------- */
/* Services (download/print)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * nmind-services barrel (migrated to TS).
 * Exposes singletons + job models.
 */
const services = require("../shared/nmind-services") as any;

/** Singleton download service. */
const downloadService = services.downloadService as any;

/** Singleton printer service. */
const printerService = services.printerService as any;

/** PrintJob constructor (built from a DownloadJobResponse). */
const PrintJob = services.PrintJob as any;

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Shared constants.
 * - URL_AFTER_INSTALL: optional tab URL opened at install
 * - DIR_PRINT_JOBS: relative dir for print jobs
 * - DIR_DOWNLOAD_JOBS: relative dir for download jobs
 */
const constants = require("../shared/constants") as any;

/** Optional URL opened after install. */
const URL_AFTER_INSTALL: string = constants.URL_AFTER_INSTALL;

/** Print jobs base directory (relative). */
const DIR_PRINT_JOBS: string = constants.DIR_PRINT_JOBS;

/** Download jobs base directory (relative). */
const DIR_DOWNLOAD_JOBS: string = constants.DIR_DOWNLOAD_JOBS;

/* -------------------------------------------------------------------------- */
/* Installation hook                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Hook executed on extension install/update.
 *
 * Behavior:
 * - If temporary install: log debug banner
 * - If URL_AFTER_INSTALL is a non-empty string: open it in a new tab
 */
browser.runtime.onInstalled.addListener((details: any) => {
  if (details.temporary) {
    Logger.debug("Temporary installation. Debug mode on.");
  }

  if (typeof URL_AFTER_INSTALL === "string" && URL_AFTER_INSTALL.length > 0) {
    browser.tabs.create({ url: URL_AFTER_INSTALL });
  }
});

/* -------------------------------------------------------------------------- */
/* Options synchronization                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Keep Logger debug mode synchronized with Storage options.
 */
Storage.onChange(() => {
  Logger.isDebugMode = Storage.options.console;
  Logger.debug(`Background-script : Fetch options`, Storage.options);
});

/**
 * Trigger initial synchronization from persisted storage into Storage.options.
 */
Storage.synchronize();

/* -------------------------------------------------------------------------- */
/* Endpoints wiring                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Native host client instance:
 * - manages connect/disconnect to native messaging host
 * - routes companion.* calls to native host
 */
const __hostClient = new NativeHostClient();

/**
 * Background listener instance:
 * - listens to runtime.onConnect/runtime.onMessage
 * - routes incoming requests to handlers registered with `on(route, handler)`
 */
const __listener = new BackgroundListener();

/**
 * Join endpoints so they can forward to each other.
 *
 * - __listener.forward(...) can call __hostClient.request/post
 * - __hostClient.forward(...) can call back into __listener if needed
 */
__listener.join(__hostClient);

/**
 * Pipe all `companion.*` routes to the joined endpoint by default (native host).
 * This means: if BackgroundListener does not have an explicit handler for a given
 * companion.* route, it will forward it to __hostClient.
 */
__listener.pipe(/companion\..+/);

/* -------------------------------------------------------------------------- */
/* Services configuration                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Configures downloadService with download directory.
 */
downloadService.configure(DIR_DOWNLOAD_JOBS);

/**
 * Configures printerService with print directory and host client.
 */
printerService.configure(DIR_PRINT_JOBS, __hostClient);

/* -------------------------------------------------------------------------- */
/* BackgroundListener – Default handlers                                       */
/* -------------------------------------------------------------------------- */

/**
 * Route: background.ping
 * Simple health check.
 */
__listener.on("background.ping", function (_port: any, _message: any) {
  return "background-pong";
});

/**
 * Route: background.version
 * Returns the extension version from manifest.
 */
__listener.on("background.version", function (_port: any, _message: any) {
  return browser.runtime.getManifest().version;
});

/**
 * Route: background.echo
 * Echo back any payload.
 */
__listener.on("background.echo", function (_port: any, message: any) {
  return message;
});

/**
 * Route: companion.capabilities
 * Returns a list of supported capabilities depending on current options:
 * - "printer" if Storage.options.printer.activate
 * - "pos" if Storage.options.pos.activate
 * - "companion" if native host responds to companion.ping
 *
 * @returns Message.success(string[]) wrapped in a Promise
 */
__listener.on("companion.capabilities", function (_port: any, _message: any) {
  return new Promise((resolve) => {
    const capabilities: string[] = [];

    if (Storage.options.printer.activate) {
      capabilities.push("printer");
    }

    if (Storage.options.pos.activate) {
      capabilities.push("pos");
    }

    __hostClient
      .request("companion.ping")
      .then(function () {
        capabilities.push("companion");
      })
      .finally(function () {
        resolve(Message.success(capabilities));
      });
  });
});

/**
 * Route: companion.isConnected
 * Returns whether native host client is connected.
 */
__listener.on("companion.isConnected", function (_port: any, _message: any) {
  return __hostClient.isConnected();
});

/**
 * Route: companion.connect
 * Connects to the native host.
 */
__listener.on("companion.connect", function (_port: any, _message: any) {
  return __hostClient.connect();
});

/**
 * Route: companion.disconnect
 * Disconnects from the native host.
 */
__listener.on("companion.disconnect", function (_port: any, _message: any) {
  return __hostClient.disconnect();
});

/* -------------------------------------------------------------------------- */
/* BackgroundListener – Test handlers                                          */
/* -------------------------------------------------------------------------- */

/**
 * Route: background.addition
 * Adds two numbers (test route).
 */
__listener.on(
  "background.addition",
  (_port: any, left: number, right: number) => {
    return left + right;
  }
);

/**
 * Route: background.multiplication
 * Multiplies two numbers (test route).
 */
__listener.on(
  "background.multiplication",
  (_port: any, left: number, right: number) => {
    return left * right;
  }
);

/* -------------------------------------------------------------------------- */
/* Companion document: download                                                */
/* -------------------------------------------------------------------------- */

/**
 * Route: companion.document.download
 *
 * Starts a download using downloadService and returns a Promise that resolves to
 * Message.success(response) or rejects to Message.error(response).
 *
 * Additionally:
 * - Attaches an onFinish callback on the job that posts a pushed response event
 *   to the calling port:
 *   route: "companion.document.download.response"
 */
__listener.on("companion.document.download", function (port: any, job: any) {
  Logger.debug("Background-script : companion.document.download", job);

  // Push completion to caller over Port channel
  job.onFinish = (p: any, response: any) => {
    __listener.post(
      p,
      Message.request("companion.document.download.response", response)
    );
  };

  return new Promise((resolve, reject) => {
    downloadService
      .createJob(port, job)
      .then((response: any) => resolve(Message.success(response)))
      .catch((response: any) => reject(Message.error(response)));
  });
});

/* -------------------------------------------------------------------------- */
/* Companion document: print                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Route: companion.document.print
 *
 * Workflow:
 * - Validates printer support is enabled in options
 * - Resolves target printer name:
 *   - dljob.printerName OR Storage.options.printer.default
 * - Attaches an onFinish callback to the download job:
 *   - builds a PrintJob from DownloadJobResponse
 *   - sets printerName
 *   - attaches PrintJob.onFinish to post "companion.document.print.response"
 *   - calls printerService.createJob(port, prjob)
 *
 * Returns:
 * - Message.error(...) synchronously if printer feature is disabled or printer is not defined
 * - Otherwise returns `true` (legacy behavior) after scheduling callbacks
 */
__listener.on("companion.document.print", function (port: any, dljob: any) {
  Logger.debug("Background-script : companion.document.print", dljob);

  if (!Storage.options.printer.activate) {
    return Message.error("Printers support has been disabled");
  }

  const printerName = dljob.printerName || Storage.options.printer.default;

  if (!printerName) {
    return Message.error("Printer not defined");
  }

  dljob.onFinish = (p: any, response: any) => {
    const prjob = new PrintJob(response);
    prjob.printerName = printerName;

    prjob.onFinish = (p2: any, resp2: any) => {
      __listener.post(
        p2,
        Message.request("companion.document.print.response", resp2)
      );
    };

    printerService.createJob(p, prjob);
  };

  // The actual download->print orchestration is callback-driven.
  // The caller usually triggers the download beforehand and receives the push response.
  return true;
});

/* -------------------------------------------------------------------------- */
/* Companion: open downloads folder                                             */
/* -------------------------------------------------------------------------- */

/**
 * Route: companion.location.open.download
 *
 * Opens the browser default download folder.
 */
__listener.on("companion.location.open.download", function (_port: any) {
  browser.downloads.showDefaultFolder();
  return true;
});

/* -------------------------------------------------------------------------- */
/* POS: ping                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Route: companion.pos.ping
 *
 * Validates POS support and forwards to native host route:
 * - companion.epayment.ping
 */
__listener.on("companion.pos.ping", function (_port: any) {
  Logger.debug("Background-script : companion.pos-payment.ping");

  if (!Storage.options.pos.activate) {
    return Message.error("POS terminal support has been disabled");
  }

  const params = {
    port: Storage.options.pos.port,
    device: Storage.options.pos.device,
    protocol: Storage.options.pos.protocol,
  };

  return __hostClient.request("companion.epayment.ping", params);
});

/* -------------------------------------------------------------------------- */
/* POS: process                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Route: companion.pos.process
 *
 * Validates POS support and amount, then calls native host route:
 * - companion.epayment.process
 *
 * Returns a Promise that resolves/rejects with Message.success/error wrappers.
 */
__listener.on("companion.pos.process", function (_port: any, amount: any) {
  if (!Storage.options.pos.activate) {
    return Message.error("POS terminal support has been disabled");
  }

  if (isNaN(amount) || amount <= 0) {
    return Message.error(amount + " bad value");
  }

  const params = {
    amount: amount,
    port: Storage.options.pos.port,
    device: Storage.options.pos.device,
    protocol: Storage.options.pos.protocol,
  };

  return new Promise((resolve, reject) => {
    __hostClient
      .request("companion.epayment.process", params)
      .then((response: any) => resolve(Message.success(response)))
      .catch((response: any) => reject(Message.error(response)));
  });
});

/**
 * Forces TS module scope (prevents "Cannot redeclare block-scoped variable" errors).
 */
export {};
