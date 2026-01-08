/**
 *
 * Value object describing a print task.
 *
 * Print jobs are typically created from a DownloadJobResponse (the file that was
 * downloaded is then printed).
 *
 * Notes:
 * - This is primarily a data holder.
 * - Runtime style: CommonJS (pure CJS).
 * - `export {}` forces TS module scope.
 *
 * @author Nmind.io <osp@nmind.io>
 */

const djrMod = require("./DownloadJobResponse") as any;

/**
 * Represents a print job.
 */
class PrintJob {
  /** Job identifier (often copied from the download id). */
  id: number;

  /** Human-readable job name. */
  name: string;

  /** File path to print. */
  filename: string;

  /** Error reason or message (empty when successful). */
  reason: string;

  /** True when the print succeeded. */
  success: boolean;

  /** True while a print request is in progress. */
  printing: boolean;

  /** Target printer name. */
  printerName: string;

  /**
   * Creates a PrintJob. If a DownloadJobResponse is provided, fields are
   * initialized from it.
   *
   * @param response - Optional DownloadJobResponse to initialize from.
   */
  constructor(response?: InstanceType<typeof djrMod.DownloadJobResponse>) {
    this.id = 0;
    this.name = "";
    this.filename = "";
    this.reason = "";
    this.success = false;
    this.printing = false;
    this.printerName = "";

    if (response) {
      this.fromDownloadJobResponse(response);
    }
  }

  /**
   * Populates this print job from a DownloadJobResponse.
   *
   * Mapping (legacy behavior):
   * - id <- response.id
   * - name <- response.name
   * - filename <- response.destination
   *
   * Resets status flags.
   *
   * @param response - Download job response.
   */
  fromDownloadJobResponse(response: any): void {
    this.id = response.id;
    this.name = response.name;
    this.filename = response.destination;
    this.reason = "";
    this.success = false;
    this.printing = false;
  }
}

exports.PrintJob = PrintJob;

/** Forces TS module scope. */
export {};
