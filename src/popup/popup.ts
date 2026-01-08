/**
 *
 * Popup script used by the extension UI.
 *
 * Responsibilities:
 * - Load persisted options from `browser.storage.local`
 * - Fetch runtime data from the native host (printers, serial ports, devices, protocols)
 *   via BackgroundClient routes
 * - Hydrate the popup form with the loaded data
 * - Persist changes back to `browser.storage.local`
 * - Provide "test printer" and "test POS ping" actions with user feedback (SweetAlert)
 *
 * @author Nmind.io <osp@nmind.io>
 */

/* -------------------------------------------------------------------------- */
/* External globals (provided by popup HTML)                                  */
/* -------------------------------------------------------------------------- */

/**
 * jQuery global (provided by the popup page).
 * We keep it as `any` to avoid depending on external typings.
 */
declare const jQuery: any;

/**
 * SweetAlert2 global (provided by the popup page).
 */
declare const Swal: any;

/* -------------------------------------------------------------------------- */
/* Shared modules (CommonJS)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Core shared module: provides the logger singleton and the webextension polyfill.
 */
const core = require("../shared/nmind-core") as any;

/** Shared logger singleton. */
const Logger = core.Logger as any;

/** WebExtension polyfill object (browser.*). */
const browser = core.browser as any;

/**
 * Shared constants module: provides settings URL and default options object.
 */
const constants = require("../shared/constants") as any;

/** URL used to open the settings/help page. */
const URL_SETTINGS: string = constants.URL_SETTINGS;

/**
 * Default options (baseline).
 * We clone/merge into this object as we load persisted values.
 */
const DEFAULT_OPTIONS: DefaultOptions = constants.DEFAULT_OPTIONS;

/**
 * Shared messaging module: provides BackgroundClient constructor.
 */
const messaging = require("../shared/nmind-messaging") as any;

/** Background messaging client used by the popup to call background/native routes. */
const BackgroundClient = messaging.BackgroundClient as any;

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Shape of popup options persisted in `browser.storage.local`.
 * (Matches the constants DEFAULT_OPTIONS structure.)
 */
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

/**
 * Generic response envelope returned by BackgroundClient routes in this project.
 * Many routes return `{ code, content }`.
 */
interface ServiceResponse<T = unknown> {
  code: number;
  content: T;
  message?: string;
  type?: string;
}

/* -------------------------------------------------------------------------- */
/* State (module-level variables)                                             */
/* -------------------------------------------------------------------------- */

/**
 * Background client instance.
 * Used to call background/native services from the popup.
 */
const __client = new BackgroundClient();

/**
 * Current options snapshot (in-memory).
 * - Initialized with DEFAULT_OPTIONS
 * - Merged with storage values by loadData()
 * - Written back by syncOptions()
 */
let __options: DefaultOptions = DEFAULT_OPTIONS;

/**
 * Available printers (returned by `companion.printers.list`).
 */
let __printersList: string[] = [];

/**
 * Available serial ports (returned by `companion.serialPorts.list`).
 */
let __serialPortsList: string[] = [];

/**
 * Supported payment devices (returned by `companion.epayment.supportedDevices`).
 * Key is typically a device id/model, value is display label.
 */
let __devicesList: Record<string, string> = {};

/**
 * Supported payment protocols (returned by `companion.epayment.supportedProtocols`).
 * Key is typically protocol id, value is display label.
 */
let __protocolsList: Record<string, string> = {};

/* -------------------------------------------------------------------------- */
/* jQuery setup                                                               */
/* -------------------------------------------------------------------------- */

jQuery.noConflict();

/**
 * Entry point: registers handlers and triggers initial load.
 */
jQuery(function ($: any) {
  $(document).ready(function () {
    /* ---------------------------------------------------------------------- */
    /* Navigation / window actions                                            */
    /* ---------------------------------------------------------------------- */

    /**
     * Opens the settings/help page in a new tab, then closes the popup.
     */
    $("#trigger-help").on("click", function (_e: Event) {
      browser.tabs.create({ url: URL_SETTINGS });
      window.close();
    });

    /**
     * Printer activation toggle:
     * - enables/disables printer select + test button based on checkbox.
     */
    $("#options-printer-activate").on("change", function (_e: Event) {
      const disabled = !$(this).is(":checked");
      $("#options-printer-default").prop("disabled", disabled);
      $("#options-printer-trigger-test").prop("disabled", disabled);
    });

    /**
     * POS activation toggle:
     * - enables/disables device/port/protocol/ethip inputs + ping button.
     */
    $("#options-pos-activate").on("change", function (_e: Event) {
      const disabled = !$(this).is(":checked");
      $("#options-pos-device").prop("disabled", disabled);
      $("#options-pos-port").prop("disabled", disabled);
      $("#options-pos-protocol").prop("disabled", disabled);
      $("#options-pos-ethip").prop("disabled", disabled);
      $("#options-pos-trigger-ping").prop("disabled", disabled);
    });

    /**
     * Initial UI state: ensure toggle handlers run once with a known baseline.
     * (This mirrors the legacy JS behavior.)
     */
    $("#options-printer-activate").prop("checked", false);
    $("#options-printer-activate").change();

    $("#options-pos-activate").prop("checked", false);
    $("#options-pos-activate").change();

    /**
     * Any element with `.sync-trigger` causes options persistence on change.
     */
    $(".sync-trigger").on("change", function (_e: Event) {
      syncOptions();
    });

    /* ---------------------------------------------------------------------- */
    /* Actions: Printer test                                                   */
    /* ---------------------------------------------------------------------- */

    /**
     * Triggers a printer test:
     * - shows a spinner
     * - calls `companion.printers.test` with { printerName }
     * - shows a SweetAlert success/error
     */
    $("#options-printer-trigger-test").on("click", function (_e: Event) {
      const $this = $(this);
      $this.children(".spinner-border").show();
      $this.prop("disabled", true);

      const params = {
        printerName: $("#options-printer-default").val(),
      };

      __client
        .request("companion.printers.test", params)
        .then(function (_response: ServiceResponse) {
          Swal.fire({
            icon: "success",
            title: "Test réussi",
            html:
              "Une page de test est encours d'impression sur <br/>" +
              "<i>" +
              $("#options-printer-default").val() +
              "</i>",
            timer: 3000,
            timerProgressBar: true,
          });
        })
        .catch(function (err: any) {
          Swal.fire({
            icon: "error",
            title: err.message,
            timer: 3000,
            timerProgressBar: true,
          });
        })
        .finally(function () {
          $this.children(".spinner-border").hide();
          $this.prop("disabled", false);
        });
    });

    /* ---------------------------------------------------------------------- */
    /* Actions: POS ping                                                       */
    /* ---------------------------------------------------------------------- */

    /**
     * Triggers a POS ping:
     * - shows a spinner
     * - calls `companion.epayment.ping` with { port, device, protocol }
     * - shows a SweetAlert success/error with guidance text
     */
    $("#options-pos-trigger-ping").on("click", function (_e: Event) {
      const $this = $(this);
      $this.children(".spinner-border").show();
      $this.prop("disabled", true);

      const params = {
        port: $("#options-pos-port").val(),
        device: $("#options-pos-device").val(),
        protocol: $("#options-pos-protocol").val(),
      };

      __client
        .request("companion.epayment.ping", params)
        .then(function (_response: ServiceResponse) {
          Swal.fire({
            icon: "success",
            title: "Test réussi !",
            html: "Le terminal affiche <i>fonction impossible</i>, cela est normal",
            timer: 3000,
            timerProgressBar: true,
          });
        })
        .catch(function (err: any) {
          Swal.fire({
            icon: "error",
            title: err.message,
            html: "Vérifiez le modèle du device, le port, le branchement, ...",
            timer: 3000,
            timerProgressBar: true,
          });
        })
        .finally(function () {
          $this.children(".spinner-border").hide();
          $this.prop("disabled", false);
        });
    });

    /* ---------------------------------------------------------------------- */
    /* Window controls                                                         */
    /* ---------------------------------------------------------------------- */

    /**
     * Closes the popup window.
     */
    $("#window-trigger-close").on("click", function (_e: Event) {
      window.close();
    });

    /**
     * Reloads data and re-hydrates the form.
     */
    $("#window-trigger-refresh").on("click", function (_e: Event) {
      loadData();
    });

    /**
     * Initial load (storage + lists from background/native).
     */
    loadData();
  });

  /* ------------------------------------------------------------------------ */
  /* Data loading + hydration                                                 */
  /* ------------------------------------------------------------------------ */

  /**
   * Loads:
   * - current stored options
   * - printers list
   * - serial ports list
   * - supported devices
   * - supported protocols
   *
   * Then merges options into `__options` and hydrates the UI.
   */
  function loadData(): void {
    Promise.all([
      browser.storage.local.get(),
      __client.request("companion.printers.list"),
      __client.request("companion.serialPorts.list"),
      __client.request("companion.epayment.supportedDevices"),
      __client.request("companion.epayment.supportedProtocols"),
    ]).then(function (values: any[]) {
      __options = Object.assign(__options, values[0]) as DefaultOptions;

      __printersList = (values[1] as ServiceResponse<string[]>).content;
      __serialPortsList = (values[2] as ServiceResponse<string[]>).content;
      __devicesList = (values[3] as ServiceResponse<Record<string, string>>).content;
      __protocolsList = (values[4] as ServiceResponse<Record<string, string>>).content;

      hydrateForm();
    });
  }

  /**
   * Populates select inputs and sets checkbox/fields from `__options`.
   *
   * Steps:
   * - Fill printers select
   * - Fill serial ports select
   * - Fill protocols select
   * - Fill devices select
   * - Apply options values to form inputs
   * - Trigger change handlers for printer/pos activation toggles
   */
  function hydrateForm(): void {
    $("#options-printer-default").find("option").remove();
    __printersList.forEach((name) => {
      $("#options-printer-default").append(new Option(name, name));
    });

    $("#options-pos-port").find("option").remove();
    __serialPortsList.forEach((name) => {
      $("#options-pos-port").append(new Option(name, name));
    });

    $("#options-pos-protocol").find("option").remove();
    for (const property in __protocolsList) {
      $("#options-pos-protocol").append(new Option(__protocolsList[property], property));
    }

    $("#options-pos-device").find("option").remove();
    for (const property in __devicesList) {
      $("#options-pos-device").append(new Option(__devicesList[property], property));
    }

    $("#options-console-activate").prop("checked", __options.console);

    $("#options-printer-activate").prop("checked", __options.printer.activate);
    $("#options-printer-default").val(__options.printer.default);

    $("#options-pos-activate").prop("checked", __options.pos.activate);
    $("#options-pos-device").val(__options.pos.device);
    $("#options-pos-port").val(__options.pos.port);
    $("#options-pos-protocol").val(__options.pos.protocol);
    $("#options-pos-ethip").val(__options.pos.ethip);

    $("#options-printer-activate").change();
    $("#options-pos-activate").change();
  }

  /* ------------------------------------------------------------------------ */
  /* Persist options                                                          */
  /* ------------------------------------------------------------------------ */

  /**
   * Reads current form values and persists them to `browser.storage.local`.
   *
   * Behavior:
   * - Updates `__options.console` and toggles Logger.isDebugMode accordingly
   * - Updates printer activation + default printer
   * - Updates POS activation + device/port/protocol/ethip (or clears them if disabled)
   * - Persists the full `__options` object to storage
   */
  function syncOptions(): void {
    __options.console = $("#options-console-activate").is(":checked");
    Logger.isDebugMode = __options.console;

    __options.printer.activate = $("#options-printer-activate").is(":checked");
    if (__options.printer.activate) {
      __options.printer.default = $("#options-printer-default").val();
    } else {
      __options.printer.default = "";
    }

    __options.pos.activate = $("#options-pos-activate").is(":checked");
    if (__options.pos.activate) {
      __options.pos.device = $("#options-pos-device").val();
      __options.pos.port = $("#options-pos-port").val();
      __options.pos.protocol = $("#options-pos-protocol").val();
      __options.pos.ethip = $("#options-pos-ethip").val();
    } else {
      __options.pos.device = "";
      __options.pos.port = "";
      __options.pos.protocol = "";
      __options.pos.ethip = "";
    }

    browser.storage.local.set(__options).then(
      function () {
        // success: nothing to do
      },
      onError
    );
  }

  /**
   * Generic error handler for async operations in this popup.
   *
   * @param error - Any error-like value.
   */
  function onError(error: unknown): void {
    Logger.error(error);
  }
});

/** Forces TS module scope (prevents global symbol collisions). */
export {};
