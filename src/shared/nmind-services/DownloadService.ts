/**
 *
 * Service that orchestrates file downloads through the WebExtension downloads API.
 *
 * Responsibilities:
 * - Keep configuration (dirDownloads)
 * - Start downloads via `browser.downloads.download(job)`
 * - Track in-flight downloads and update their state via downloads events:
 *   - `downloads.onCreated`
 *   - `downloads.onChanged`
 * - Notify completion/failure via an `onFinish(port, response)` callback
 *
 * Internal state:
 * - `jobs[id]` stores metadata for each download id:
 *   - port: caller port / context
 *   - response: DownloadJobResponse instance
 *   - onFinish: completion callback
 *   - filename/fileSize/totalBytes: progress metadata
 *
 * @author Nmind.io <osp@nmind.io>
 */

const core = require("../nmind-core") as any;
const djrMod = require("./DownloadJobResponse") as any;

/**
 * Download job shape expected by the downloads API.
 * We keep it permissive; DownloadService sanitizes unknown keys.
 */
type DownloadJobLike = {
  id?: number;
  name?: string;
  url: string;
  filename: string;
  conflictAction?: string;
  headers?: Array<{ name: string; value: string }>;
  method?: string;
  saveAs?: boolean;
  onFinish?: (port: any, response: any) => void;
  [k: string]: any;
};

/**
 * Download service implementation.
 */
class DownloadService {
  /**
   * Base directory prefix for download filenames.
   * Must be configured with `configure(dirDownloads)`.
   */
  dirDownloads: string | null;

  /**
   * In-flight jobs indexed by download id.
   */
  jobs: Record<number, any>;

  /**
   * Registers downloads listeners on construction.
   */
  constructor() {
    this.dirDownloads = null;
    this.jobs = {};

    const self = this;

    core.browser.downloads.onCreated.addListener((item: any) => {
      self._onCreatedListener(item);
    });

    core.browser.downloads.onChanged.addListener((delta: any) => {
      self._onChangedListener(delta);
    });
  }

  /**
   * Configures the base directory used for downloads.
   *
   * @param dirDownloads - Base path prefix to prepend to job.filename.
   */
  configure(dirDownloads: string): void {
    this.dirDownloads = dirDownloads;
  }

  /**
   * Starts a download job.
   *
   * Legacy behavior:
   * - Prefixes job.filename with configured dirDownloads.
   * - Creates a DownloadJobResponse (id/name), marks `downloading=true` on start.
   * - Stores job state in `jobs[id]`.
   * - Resolves with the response when download starts, rejects with response on failure.
   *
   * @param port - Caller port/context (used for logging and callback).
   * @param job - Job payload (will be sanitized before sending to downloads API).
   * @returns Promise resolving/rejecting with DownloadJobResponse-like object.
   */
  createJob(port: any, job: DownloadJobLike): Promise<any> {
    if (!this.dirDownloads) {
      return Promise.reject({
        code: 500,
        message: "DownloadService not configured (dirDownloads is null)",
      });
    }

    job.filename = this.dirDownloads + job.filename;
    const response = this._createReponse(job);
    const onFinish = job.onFinish;

    this._sanitizeJobProperties(job);

    const self = this;

    return new Promise(function (resolve, reject) {
      core.browser.downloads.download(job).then(
        function (id: number) {
          core.Logger.debug(`Download job  ${id} started from ${port.contextId}`);

          if (self.jobs[id]) {
            self.jobs[id].response = response;
            self.jobs[id].port = port;
            self.jobs[id].id = id;
            self.jobs[id].onFinish = onFinish;
          } else {
            self.jobs[id] = {
              port: port,
              response: response,
              onFinish,
              id: id,
              filename: "",
              fileSize: 0,
              totalBytes: 0,
            };
          }

          response.downloading = true;
          resolve(response);
        },
        function (error: unknown) {
          core.Logger.error("Download-failed ", error);
          response.downloading = false;
          response.success = false;
          response.reason = error as any;
          reject(response);
        }
      );
    });
  }

  /**
   * Removes any unsupported keys from the job before passing it to downloads API.
   *
   * Legacy allowed keys:
   * - body, conflictAction, filename, headers, incognito, method, saveAs, url
   *
   * @param job - Job object to sanitize (mutated in place).
   */
  _sanitizeJobProperties(job: Record<string, any>): void {
    const allowed = [
      "body",
      "conflictAction",
      "filename",
      "headers",
      "incognito",
      "method",
      "saveAs",
      "url",
    ];

    for (const key in job) {
      if (!allowed.includes(key)) {
        delete job[key];
      }
    }
  }

  /**
   * Creates a DownloadJobResponse from an input job.
   *
   * The response is partially filled:
   * - id <- job.id (may be 0/undefined at this stage)
   * - name <- job.name
   *
   * @param job - Input job.
   */
  _createReponse(job: any): any {
    const response = new djrMod.DownloadJobResponse();
    response.id = job.id;
    response.name = job.name;
    return response;
  }

  /**
   * Downloads API onCreated hook.
   *
   * Ensures we have a registry entry even if the download was initiated outside
   * of this service (rare but possible).
   *
   * @param item - downloads.onCreated item.
   */
  _onCreatedListener(item: any): void {
    core.Logger.debug(`New Download job  ${item.id} created : ${item.filename}`);

    if (this.jobs[item.id]) {
      this.jobs[item.id].filename = item.filename;
      this.jobs[item.id].fileSize = item.fileSize;
      this.jobs[item.id].totalBytes = item.totalBytes;
      this.jobs[item.id].response.destination = item.filename;
    } else {
      this.jobs[item.id] = {
        port: null,
        response: null,
        onFinish: null,
        id: item.id,
        filename: item.filename,
        fileSize: item.fileSize,
        totalBytes: item.totalBytes,
      };
    }
  }

  /**
   * Downloads API onChanged hook.
   *
   * Updates job progress metadata and notifies completion/error.
   *
   * @param delta - downloads.onChanged delta object.
   */
  _onChangedListener(delta: any): void {
    if (this.jobs[delta.id] == undefined) {
      return;
    }

    if (delta.error) {
      core.Logger.debug(`Download job ${delta.id} has error`, delta.error);
      this._notifyDownloadJob(delta.id, false, delta.error.current);
      this._cleanupJob(delta.id, true);
    }

    if (delta.filename) {
      this.jobs[delta.id].filename = delta.filename.current;
      this.jobs[delta.id].response.destination = delta.filename.current;
    }

    if (delta.fileSize) {
      this.jobs[delta.id].fileSize = delta.fileSize.current;
    }

    if (delta.totalBytes) {
      this.jobs[delta.id].totalBytes = delta.totalBytes.current;
    }

    if (delta.exists) {
      this.jobs[delta.id].exists = delta.exists.current;
    }

    if (delta.state) {
      switch (delta.state.current) {
        case "complete":
          // If fileSize is 0, consider it an error.
          // A fileSize of -1 means "unknown".
          if (this.jobs[delta.id].fileSize == 0) {
            this._notifyDownloadJob(delta.id, false, "Empty content");
            this._cleanupJob(delta.id, true);
          } else {
            this._notifyDownloadJob(delta.id, true);
            this._cleanupJob(delta.id, false);
          }
          break;

        case "interrupted":
          break;
      }
    }
  }

  /**
   * Notifies the caller that a download job has finished (success or failure).
   *
   * - Updates the stored response:
   *   - downloading=false
   *   - success flag
   *   - reason
   *   - destination <- filename
   * - Calls `onFinish(port, response)` when both are available.
   *
   * @param id - Download id.
   * @param success - Success flag.
   * @param reason - Optional failure reason.
   * @returns true if notified, false if job not ready (missing response or callback).
   */
  _notifyDownloadJob(id: number, success: boolean, reason?: any): boolean {
    if (success) {
      core.Logger.debug(`DownloadJob ${id} has been completed in ${this.jobs[id].filename}`);
    } else {
      core.Logger.debug(`DownloadJob ${id} has error : ${reason}`);
    }

    if (this.jobs[id].response && this.jobs[id].onFinish) {
      this.jobs[id].response.downloading = false;
      this.jobs[id].response.success = success;
      this.jobs[id].response.reason = reason || "";
      this.jobs[id].response.destination = this.jobs[id].filename;

      this.jobs[id].onFinish(this.jobs[id].port, this.jobs[id].response);
      return true;
    }
    return false;
  }

  /**
   * Cleans internal job registry and optionally removes the downloaded file.
   *
   * When `removeFile === true`:
   * - `browser.downloads.removeFile(id)`
   * - `browser.downloads.erase({id})`
   *
   * @param id - Download id.
   * @param removeFile - Whether to remove file and erase history.
   */
  _cleanupJob(id: number, removeFile: boolean): void {
    delete this.jobs[id];
    if (removeFile === true) {
      core.browser.downloads.removeFile(id);
      core.browser.downloads.erase({ id: id });
    }
  }
}

exports.DownloadService = DownloadService;
exports.downloadService = new DownloadService();

/** Forces TS module scope. */
export {};
