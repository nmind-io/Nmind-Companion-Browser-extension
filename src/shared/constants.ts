/**
 * Centralized constants and default configuration values for the
 * Nmind Companion Browser Extension.
 *
 * This module:
 * - exposes immutable configuration values (URLs, IDs, delays, paths)
 * - defines the default runtime options structure
 * - is consumed by background, content scripts and UI layers
 * 
 * @author Nmind.io <osp@nmind.io>
 */

//---------------------------------------------------------------------------
//#region Constants
//---------------------------------------

/** 
 * Delay (ms) before hiding extension notifications. 
 */
const NOTIFICATION_HIDE_DELAY = 3000 as const;

/** 
 * DOM id used to identify the notification element. 
 */
const NOTIFICATION_ID = "nmind-notification-id" as const;

/** 
 * Public landing page for the extension.
 */
const URL_EXTENSION = "https://nmind.io/companion" as const;

/** 
 * URL opened right after install (empty means "none" / disabled).
 */
const URL_AFTER_INSTALL = "" as const;

/** 
 * Settings page URL for the extension. 
 */
const URL_SETTINGS = "https://nmind.io/companion/#nmind-companion-settings" as const;

/** 
 * Native messaging host name (Chrome/Firefox). 
 */
const COMPANION_HOST = "nmindcompanionhost" as const;

/** 
 * Relative directory for print jobs.
 */
const DIR_PRINT_JOBS = "nmind/printjobs/" as const;

/** 
 * Relative directory for download jobs.
 */
const DIR_DOWNLOAD_JOBS = "nmind/downloads/" as const;

/**
 * Options structure used across the extension.
 * Keep this in sync with wherever options are read/written.
 */
export interface DefaultOptions {
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
 * Default options (runtime value).
 * `as const satisfies DefaultOptions` ensures:
 * - the object matches the interface
 * - literal values are preserved where useful
 */
const DEFAULT_OPTIONS = {
  console: false,
  printer: {
    activate: false,
    default: "",
  },
  pos: {
    activate: false,
    device: "",
    port: "",
    protocol: "",
    ethip: "",
  },
} as const satisfies DefaultOptions;

//#endregion

/**
 * CommonJS exports (pure CJS)
 */
exports.NOTIFICATION_HIDE_DELAY = NOTIFICATION_HIDE_DELAY;
exports.NOTIFICATION_ID = NOTIFICATION_ID;
exports.URL_EXTENSION = URL_EXTENSION;
exports.URL_AFTER_INSTALL = URL_AFTER_INSTALL;
exports.URL_SETTINGS = URL_SETTINGS;
exports.COMPANION_HOST = COMPANION_HOST;
exports.DIR_PRINT_JOBS = DIR_PRINT_JOBS;
exports.DIR_DOWNLOAD_JOBS = DIR_DOWNLOAD_JOBS;
exports.DEFAULT_OPTIONS = DEFAULT_OPTIONS;
