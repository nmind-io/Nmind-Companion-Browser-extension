/**
 * =============================================================================
 * NMIND SERVICES – DOWNLOAD JOB RESPONSE (TYPE DECLARATIONS)
 * =============================================================================
 *
 * CommonJS declarations for `DownloadJobResponse`.
 * This file generates no JavaScript output.
 * =============================================================================
 */

declare namespace NmindServicesDownloadJobResponse {
  /**
   * Represents a download job response (status + metadata).
   */
  class DownloadJobResponse {
    id: number;
    name: string;
    destination: string;
    reason: string;
    success: boolean;
    downloading: boolean;

    constructor();
  }
}

declare const DownloadJobResponseModule: {
  /** DownloadJobResponse class constructor. */
  DownloadJobResponse: typeof NmindServicesDownloadJobResponse.DownloadJobResponse;
};

export = DownloadJobResponseModule;
