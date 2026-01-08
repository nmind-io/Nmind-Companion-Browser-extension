/**
 *
 * Barrel module exporting the public API of `nmind-services`.
 *
 * Exports:
 * - downloadService (singleton)
 * - printerService (singleton)
 * - DownloadJob (class)
 * - PrintJob (class)
 * - DownloadJobResponse (class)
 *
 * Runtime style:
 * - CommonJS (pure CJS): assigns to `exports.*`
 *
 * @author Nmind.io <osp@nmind.io>
 */

const downloadServiceMod = require("./DownloadService") as any;
const printerServiceMod = require("./PrinterService") as any;
const downloadJobMod = require("./DownloadJob") as any;
const printJobMod = require("./PrintJob") as any;
const responseMod = require("./DownloadJobResponse") as any;

exports.downloadService = downloadServiceMod.downloadService;
exports.printerService = printerServiceMod.printerService;

exports.DownloadJob = downloadJobMod.DownloadJob;
exports.PrintJob = printJobMod.PrintJob;
exports.DownloadJobResponse = responseMod.DownloadJobResponse;

/** Forces TS module scope. */
export {};
