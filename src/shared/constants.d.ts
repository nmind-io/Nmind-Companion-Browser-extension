/**
 * Type definitions for the CommonJS module `constants`.
 * 
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindConstants {
  export interface DefaultOptions {
    console: boolean;
    printer: { activate: boolean; default: string };
    pos: { activate: boolean; device: string; port: string; protocol: string; ethip: string };
  }
}

declare const constants: {
  NOTIFICATION_HIDE_DELAY: 3000;
  NOTIFICATION_ID: "nmind-notification-id";
  URL_EXTENSION: "https://nmind.io/companion";
  URL_AFTER_INSTALL: "";
  URL_SETTINGS: "https://nmind.io/companion/#nmind-companion-settings";
  COMPANION_HOST: "nmindcompanionhost";
  DIR_PRINT_JOBS: "nmind/printjobs/";
  DIR_DOWNLOAD_JOBS: "nmind/downloads/";
  DEFAULT_OPTIONS: NmindConstants.DefaultOptions;
};

export = constants;