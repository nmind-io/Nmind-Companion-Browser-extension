/**
 *
 * Barrel module exporting the public API of `nmind-messaging`.
 *
 * Purpose:
 * - Provide a single import/require entry point for all messaging building blocks:
 *   - routing: Endpoint
 *   - page <-> extension bridge: TabListener, ExtensionClient
 *   - background communications: BackgroundClient, BackgroundListener
 *   - native messaging: NativeHostClient
 *   - message model: Message/Request/Response + subclasses
 *
 * Runtime style:
 * - CommonJS (pure CJS): assigns to `exports.*`
 *
 * Migration note:
 * - Requires are done without destructuring the `require()` call itself,
 *   to avoid fragile behaviors during partial JS ↔ TS migration.
 *
 * @author Nmind.io <osp@nmind.io>
 */

/**
 * Endpoint router module.
 * Exposes a class constructor: `Endpoint`.
 */
const endpointMod = require("./Endpoint") as { Endpoint: any };

/**
 * TabListener module (document-side listener used for DOM event bridging).
 * Exposes a class constructor: `TabListener`.
 */
const tabListenerMod = require("./TabListener") as { TabListener: any };

/**
 * BackgroundClient module (client-side background messaging).
 * Exposes a class constructor: `BackgroundClient`.
 */
const bgClientMod = require("./BackgroundClient") as { BackgroundClient: any };

/**
 * BackgroundListener module (background-side router/listener).
 * Exposes a class constructor: `BackgroundListener`.
 */
const bgListenerMod = require("./BackgroundListener") as {
  BackgroundListener: any;
};

/**
 * NativeHostClient module (native messaging client).
 * Exposes a class constructor: `NativeHostClient`.
 */
const nativeClientMod = require("./NativeHostClient") as {
  NativeHostClient: any;
};

/**
 * Message model module.
 * Exposes constructors:
 * - Message (factory)
 * - Request / Response base types
 * - Success / Failure / Unknown / ScriptError subclasses
 */
const messageMod = require("./Message") as any;

/**
 * -----------------------------------------------------------------------------
 * Exported API: routers / clients / listeners
 * -----------------------------------------------------------------------------
 */

/** Endpoint router constructor. */
exports.Endpoint = endpointMod.Endpoint;

/** TabListener constructor. */
exports.TabListener = tabListenerMod.TabListener;

/** BackgroundClient constructor. */
exports.BackgroundClient = bgClientMod.BackgroundClient;

/** BackgroundListener constructor. */
exports.BackgroundListener = bgListenerMod.BackgroundListener;

/** NativeHostClient constructor. */
exports.NativeHostClient = nativeClientMod.NativeHostClient;

/**
 * -----------------------------------------------------------------------------
 * Exported API: message model
 * -----------------------------------------------------------------------------
 */

/** Message factory (static helpers). */
exports.Message = messageMod.Message;

/** Request constructor. */
exports.Request = messageMod.Request;

/** Response base constructor. */
exports.Response = messageMod.Response;

/** Success response constructor. */
exports.Success = messageMod.Success;

/** Failure response constructor. */
exports.Failure = messageMod.Failure;

/** Unknown response constructor. */
exports.Unknown = messageMod.Unknown;

/** ScriptError response constructor. */
exports.ScriptError = messageMod.ScriptError;

/**
 * Forces TS module scope (prevents global symbol collisions when compiling
 * multiple files during partial migration).
 */
export {};
