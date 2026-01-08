/**
 *
 * Service that orchestrates printing a local file through the native host.
 *
 * Responsibilities:
 * - Keep configuration (dirPrinters + hostClient)
 * - Create print jobs and execute them via the native host route:
 *   `companion.document.print`
 * - Track in-flight print jobs and notify completion via `onFinish(port, job)`
 *
 * @author Nmind.io <osp@nmind.io>
 */

const loggerMod = require("../LoggerWrapper") as any;

/**
 * Shape of a host client expected by this service.
 * It must implement a `request(route, params)` method returning a Promise.
 */
type HostClient = {
  request: (route: string, params: any) => Promise<any>;
};

/**
 * Print job shape expected by createJob.
 * We keep it permissive to match legacy code and because jobs may carry extra
 * keys (which are ignored).
 */
type PrintJobLike = {
  filename: string;
  printerName?: string;
  onFinish?: (port: any, job: any) => void;
  [k: string]: any;
};

/**
 * Printer service implementation.
 */
class PrinterService {
  /**
   * Directory where printer-related files/assets may be stored.
   * (Kept for compatibility; current legacy implementation just stores it.)
   */
  dirPrinters: string | null;

  /**
   * Native host client used to execute print requests.
   */
  hostClient: HostClient | null;

  /**
   * In-flight jobs indexed by job id (legacy uses filename as id).
   */
  jobs: Record<string, any>;

  constructor() {
    this.dirPrinters = null;
    this.hostClient = null;
    this.jobs = {};
  }

  /**
   * Configures the service.
   *
   * @param dirPrinters - Base directory for printers.
   * @param hostClient - Native host client to call.
   */
  configure(dirPrinters: string, hostClient: HostClient): void {
    this.dirPrinters = dirPrinters;
    this.hostClient = hostClient;
  }

  /**
   * Creates and starts a print job.
   *
   * Legacy behavior:
   * - Uses `job.filename` as job id.
   * - Extracts `job.onFinish` callback, removes it from the job object,
   *   and stores it in the internal registry.
   * - Calls native host route `companion.document.print` with:
   *   - printerName: job.printerName
   *   - path: job.filename
   *
   * When the native request resolves:
   * - marks the job as success and calls onFinish(port, job)
   * When it rejects:
   * - marks the job as failure, sets reason, calls onFinish(port, job)
   *
   * @param port - Caller port / context reference.
   * @param job - Job payload containing at least filename and printerName.
   */
  createJob(port: any, job: PrintJobLike): void {
    if (!job.printerName) {
      return;
    }

    const id = job.filename;
    loggerMod.Logger.debug(
      `New printjob ${id} created` +
        ` for ${job.filename}` +
        ` to ${job.printerName}` +
        ` by ${port.contextId}`
    );

    const onFinish = job.onFinish;
    delete job.onFinish;

    this.jobs[id] = job;

    if (!this.hostClient) {
      // Keep behavior permissive: just fail the job if not configured.
      this.jobs[id].success = false;
      this.jobs[id].reason = "PrinterService not configured (hostClient is null)";
      if (onFinish) onFinish(port, this.jobs[id]);
      delete this.jobs[id];
      return;
    }

    this.hostClient
      .request("companion.document.print", {
        printerName: job.printerName,
        path: job.filename,
      })
      .then((_response) => {
        this.jobs[id].success = true;
        if (onFinish) onFinish(port, this.jobs[id]);
        delete this.jobs[id];
      })
      .catch((error) => {
        this.jobs[id].success = false;
        this.jobs[id].reason = error;
        if (onFinish) onFinish(port, this.jobs[id]);
        delete this.jobs[id];
      });
  }
}

exports.PrinterService = PrinterService;
exports.printerService = new PrinterService();

/** Forces TS module scope. */
export {};
