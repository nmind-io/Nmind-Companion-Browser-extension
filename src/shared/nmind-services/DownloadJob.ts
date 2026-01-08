/**
 * =============================================================================
 * NMIND SERVICES – DOWNLOAD JOB
 * =============================================================================
 *
 * Value object describing the options used to start a download via
 * `browser.downloads.download(...)`.
 *
 * This object is meant to be passed to DownloadService.createJob(port, job).
 *
 * Notes:
 * - This is a *data holder* (no behavior besides the constructor).
 * - Runtime style is CommonJS (pure CJS): `exports.DownloadJob = ...`
 * - `export {}` at the end forces TS module scope (prevents global redeclare).
 * =============================================================================
 *
 * @author Nmind.io <osp@nmind.io>
 */

/**
 * Represents a download job configuration.
 */
class DownloadJob {
  /** Optional job id (used for correlation at higher layers). */
  id: number;

  /** Human-readable job name (free form). */
  name: string;

  /** URL to download. */
  url: string;

  /**
   * Conflict action for `browser.downloads.download`.
   * Common values: "uniquify", "overwrite", "prompt".
   */
  conflictAction: string;

  /**
   * Target filename relative to the configured download directory.
   * DownloadService will typically prefix it with `dirDownloads`.
   */
  filename: string;

  /**
   * Request headers forwarded to the downloads API.
   */
  headers: Array<{ name: string; value: string }>;

  /**
   * HTTP method used by the download (default: "GET").
   */
  method: string;

  /**
   * If true, the browser will prompt the user to choose the save location.
   */
  saveAs: boolean;

  /**
   * Creates a DownloadJob with safe defaults mirroring the legacy JS module.
   */
  constructor() {
    this.id = 0;
    this.name = "";
    this.url = "";
    this.conflictAction = "uniquify";
    this.filename = "";
    this.headers = [{ name: "Accept", value: "application/json, text/plain, */*" }];
    this.method = "GET";
    this.saveAs = false;
  }
}

exports.DownloadJob = DownloadJob;

/** Forces TS module scope. */
export {};
