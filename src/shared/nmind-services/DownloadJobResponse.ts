/**
 *
 * Value object describing the outcome/progress of a download job.
 *
 * Instances are created by DownloadService and are sent back to the caller
 * through the `onFinish(port, response)` callback or Promise resolution/rejection.
 *
 * @author Nmind.io <osp@nmind.io>
 */

/**
 * Represents a download job response (status + metadata).
 */
class DownloadJobResponse {
  /** Download id returned by `browser.downloads.download`. */
  id: number;

  /** Human-readable job name. */
  name: string;

  /** Absolute destination path (or filename as provided by downloads API). */
  destination: string;

  /** Error reason or message (empty when successful). */
  reason: string;

  /** True when the job succeeded. */
  success: boolean;

  /** True while the download is in progress. */
  downloading: boolean;

  /** Initializes defaults mirroring the legacy JS implementation. */
  constructor() {
    this.id = 0;
    this.name = "";
    this.destination = "";
    this.reason = "";
    this.success = false;
    this.downloading = false;
  }
}

exports.DownloadJobResponse = DownloadJobResponse;

/** Forces TS module scope. */
export {};
