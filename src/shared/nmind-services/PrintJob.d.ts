/**
 *
 * CommonJS declarations for `PrintJob`.
 *
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindServicesPrintJob {
  class PrintJob {
    id: number;
    name: string;
    filename: string;
    reason: string;
    success: boolean;
    printing: boolean;
    printerName: string;

    /**
     * @param response Optional DownloadJobResponse-like object.
     */
    constructor(response?: any);

    /**
     * Initializes fields from a DownloadJobResponse-like object.
     */
    fromDownloadJobResponse(response: any): void;
  }
}

declare const PrintJobModule: {
  PrintJob: typeof NmindServicesPrintJob.PrintJob;
};

export = PrintJobModule;
