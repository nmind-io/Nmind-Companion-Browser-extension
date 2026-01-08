/**
 * 
 * Shared entry-point for cross-module dependencies in the Nmind Companion
 * Browser Extension.
 *
 * This module centralizes:
 * - the WebExtension `browser` polyfill
 * - the shared singleton instances: Logger, Storage
 * - the EventEmitter constructor
 * 
 * @author Nmind.io <osp@nmind.io>
 */
type AnyRecord = Record<string, unknown>;

/**
 * WebExtension `browser` polyfill (runtime dependency).
 * We keep typing permissive here to avoid coupling to external typings.
 */
const webextBrowser = require("webextension-polyfill") as AnyRecord;

/**
 * Logger singleton exported by ./LoggerWrapper as `exports.Logger`.
 */
const loggerSingleton = require("./LoggerWrapper").Logger as unknown;

/**
 * Storage singleton exported by ./Storage as `exports.Storage`.
 */
const storageSingleton = require("./Storage").Storage as unknown;

/**
 * EventEmitter constructor exported by ./EventEmitter.
 *
 */
const eeModule = require("./EventEmitter") as AnyRecord;
const eventEmitterCtor = eeModule.EventEmitter as unknown;

/**
 * CommonJS exports (pure CJS)
 * Public API remains: browser, Logger, Storage, EventEmitter
 */
exports.browser = webextBrowser;
exports.Logger = loggerSingleton;
exports.Storage = storageSingleton;
exports.EventEmitter = eventEmitterCtor;