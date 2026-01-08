/**
 *
 * CommonJS declarations for DownloadService.
 *
 * Exports:
 * - DownloadService: class constructor
 * - downloadService: singleton instance
 *
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindServicesDownloadService {
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

  class DownloadService {
    dirDownloads: string | null;
    jobs: Record<number, any>;

    constructor();

    configure(dirDownloads: string): void;

    createJob(port: any, job: DownloadJobLike): Promise<any>;

    _sanitizeJobProperties(job: Record<string, any>): void;

    _createReponse(job: any): any;

    _onCreatedListener(item: any): void;

    _onChangedListener(delta: any): void;

    _notifyDownloadJob(id: number, success: boolean, reason?: any): boolean;

    _cleanupJob(id: number, removeFile: boolean): void;
  }
}

declare const DownloadServiceModule: {
  DownloadService: typeof NmindServicesDownloadService.DownloadService;
  downloadService: NmindServicesDownloadService.DownloadService;
};

export = DownloadServiceModule;
