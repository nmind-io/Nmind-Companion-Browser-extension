/**
 * BackgroundClient is the client-side entry point to communicate with the
 * extension background script.
 *
 * It uses two WebExtension transports:
 * 1) Port-based channel (push / fire-and-forget):
 *    - `browser.runtime.connect()` -> Port
 *    - `port.postMessage(...)`
 *    - `port.onMessage.addListener(...)`
 *
 * 2) Request/response channel:
 *    - `browser.runtime.sendMessage(...)` -> Promise
 *
 * This class extends `Endpoint` so incoming Port messages can be routed through
 * the same route/handler mechanism as the rest of the messaging stack.
 *
 * @author Nmind.io <osp@nmind.io>
 */

/**
 * Message model module (CommonJS).
 * Expected to expose `Message.request(name, params)` for building Request objects.
 */
const msg = require("./Message") as any;

/**
 * Endpoint module (CommonJS).
 * Expected to expose `Endpoint` base class implementing `route(...)`.
 */
const ep = require("./Endpoint") as any;

/**
 * Shared core module (CommonJS).
 * Expected to expose:
 * - `browser`: webextension-polyfill compatible object
 * - `Logger`: logger singleton
 *
 * Note: kept as `any` to avoid tight coupling while the project is mid-migration.
 */
const core = require("../nmind-core") as any;

/**
 * Client that connects to background (Port + sendMessage).
 *
 * Responsibilities:
 * - Create and maintain a runtime Port connection to background
 * - Route Port messages through the Endpoint router (`handleMessage` -> `route`)
 * - Provide two sending APIs:
 *   - `post()` for Port messaging (fire-and-forget)
 *   - `request()` for Promise-based messaging (sendMessage)
 */
class BackgroundClient extends ep.Endpoint {
  /**
   * Runtime Port returned by `browser.runtime.connect()`.
   *
   * Used for:
   * - sending push messages: `port.postMessage(...)`
   * - receiving pushed messages: `port.onMessage.addListener(...)`
   *
   * Type is `any` because the concrete Port type differs slightly across
   * browser implementations and polyfills.
   */
  private port: any;

  /**
   * Creates the client and connects immediately to the background runtime.
   *
   * Side effects:
   * - Calls `browser.runtime.connect()` once
   * - Registers an `onMessage` handler on the created Port
   *
   * Incoming messages are routed through the Endpoint router via `handleMessage`.
   */
  constructor() {
    super();
    const self = this;
    this.port = core.browser.runtime.connect();
    this.port.onMessage.addListener((m: any) => self.handleMessage(m));
  }

  /**
   * Sends a request to background over the connected Port (fire-and-forget).
   *
   * This is appropriate for notifications, “push” events, or commands where the
   * sender does not need a Promise response.
   *
   * @param route - Route name (ex: "companion.print", "extension.version").
   * @param params - Optional payload passed to the route.
   */
  post(route: string, params?: unknown): void {
    core.Logger.debug(`BackgroundClient-post:  ${route}`, params);
    this.port.postMessage(msg.Message.request(route, params));
  }

  /**
   * Sends a request to background using `runtime.sendMessage` and returns a Promise.
   *
   * This is appropriate for request/response interactions.
   *
   * @param route - Route name (ex: "companion.print", "extension.version").
   * @param params - Optional payload passed to the route.
   * @returns A Promise resolved with the background response payload.
   */
  request(route: string, params?: unknown): Promise<unknown> {
    core.Logger.debug(`BackgroundClient-request:  ${route}`, params);
    return core.browser.runtime.sendMessage(msg.Message.request(route, params));
  }

  /**
   * Handles an incoming message from the Port by routing it through the Endpoint.
   *
   * This allows the background to push requests/events to the client and have
   * them handled via `Endpoint.on(route, handler)`.
   *
   * @param request - Request-like object received from background.
   */
  handleMessage(request: any): void {
    super.route(request);
  }
}

/**
 * CommonJS export (pure CJS).
 * Consumers use: `require("./BackgroundClient").BackgroundClient`
 */
exports.BackgroundClient = BackgroundClient;

/**
 * Ensures this file is treated as a TypeScript module (not a global script),
 * preventing "Cannot redeclare block-scoped variable 'BackgroundClient'" when
 * multiple TS/JS files are compiled together.
 */
export {};
