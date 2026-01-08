/**
 *
 * CommonJS declarations for `DownloadJob`.
 *
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindServicesDownloadJob {
  /**
   * Represents a download job configuration for `browser.downloads.download`.
   */
  class DownloadJob {
    id: number;
    name: string;
    url: string;
    conflictAction: string;
    filename: string;
    headers: Array<{ name: string; value: string }>;
    method: string;
    saveAs: boolean;

    /** Creates a DownloadJob with default values. */
    constructor();
  }
}

declare const DownloadJobModule: {
  /** DownloadJob class constructor. */
  DownloadJob: typeof NmindServicesDownloadJob.DownloadJob;
};

export = DownloadJobModule;
