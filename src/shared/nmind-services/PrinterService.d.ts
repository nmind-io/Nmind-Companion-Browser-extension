/**
 *
 * CommonJS declarations for PrinterService.
 *
 * Exports:
 * - PrinterService: class constructor
 * - printerService: singleton instance
 *
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindServicesPrinterService {
  type HostClient = {
    request: (route: string, params: any) => Promise<any>;
  };

  type PrintJobLike = {
    filename: string;
    printerName?: string;
    onFinish?: (port: any, job: any) => void;
    [k: string]: any;
  };

  class PrinterService {
    dirPrinters: string | null;
    hostClient: HostClient | null;
    jobs: Record<string, any>;

    constructor();

    configure(dirPrinters: string, hostClient: HostClient): void;

    createJob(port: any, job: PrintJobLike): void;
  }
}

declare const PrinterServiceModule: {
  PrinterService: typeof NmindServicesPrinterService.PrinterService;
  printerService: NmindServicesPrinterService.PrinterService;
};

export = PrinterServiceModule;
