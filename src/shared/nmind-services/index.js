/*
 * @author Nmind.io <osp@nmind.io>
 */
const { downloadService } = require('./DownloadService');
const { printerService } = require('./PrinterService');
const { DownloadJob } = require('./DownloadJob');
const { PrintJob } = require('./PrintJob');
const { DownloadJobResponse } = require('./DownloadJobResponse');

exports.downloadService = downloadService;
exports.printerService = printerService;
exports.DownloadJob = DownloadJob;
exports.PrintJob = PrintJob;
exports.DownloadJobResponse = DownloadJobResponse;