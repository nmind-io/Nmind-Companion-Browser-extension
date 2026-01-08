/**
 *
 * Aggregates and re-exports the public API of the shared layer for the Nmind
 * Companion Browser Extension.
 *
 * This module returns a single object composed of:
 * - constants
 * - EventEmitter constructor
 * - Storage singleton
 * - Logger singleton
 * - nmind-core barrel (browser polyfill + singletons)
 * - misc utilities
 *
 * @author Nmind.io <osp@nmind.io>
 */

/**
 * Helper: safe require returning an object (so spreading never throws).
 */
function req(path: string): AnyRecord {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(path) as unknown;
  return (mod && typeof mod === "object") ? (mod as AnyRecord) : {};
}

module.exports = {
  ...req("./constants"),
  ...req("./EventEmitter"),
  ...req("./Storage"),
  ...req("./LoggerWrapper"),
  ...req("./nmind-core"),
  ...req("./nmind-misc"),
} as AnyRecord;