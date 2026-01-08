/**
 *
 * CommonJS declarations for the nmind-services barrel module.
 *
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindServicesIndex {
  // Data objects
  class DownloadJob {
    id: number;
    name: string;
    url: string;
    conflictAction: string;
    filename: string;
    headers: Array<{ name: string; value: string }>;
    method: string;
    saveAs: boolean;
    constructor();
  }

  class DownloadJobResponse {
    id: number;
    name: string;
    destination: string;
    reason: string;
    success: boolean;
    downloading: boolean;
    constructor();
  }

  class PrintJob {
    id: number;
    name: string;
    filename: string;
    reason: string;
    success: boolean;
    printing: boolean;
    printerName: string;
    constructor(response?: any);
    fromDownloadJobResponse(response: any): void;
  }

  // Services
  class DownloadService {
    dirDownloads: string | null;
    jobs: Record<number, any>;
    constructor();
    configure(dirDownloads: string): void;
    createJob(port: any, job: any): Promise<any>;
  }

  class PrinterService {
    dirPrinters: string | null;
    hostClient: any;
    jobs: Record<string, any>;
    constructor();
    configure(dirPrinters: string, hostClient: any): void;
    createJob(port: any, job: any): void;
  }
}

declare const NmindServices: {
  downloadService: NmindServicesIndex.DownloadService;
  printerService: NmindServicesIndex.PrinterService;

  DownloadJob: typeof NmindServicesIndex.DownloadJob;
  PrintJob: typeof NmindServicesIndex.PrintJob;
  DownloadJobResponse: typeof NmindServicesIndex.DownloadJobResponse;
};

export = NmindServices;
