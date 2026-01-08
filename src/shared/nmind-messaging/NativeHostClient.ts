/**
 *
 * Client to communicate with the native messaging host.
 *
 * Transport options:
 * 1) Port-based communication:
 *    - `browser.runtime.connectNative(host)` returns a Port
 *    - `port.postMessage(request)` sends requests (fire-and-forget)
 *    - `port.onMessage` receives responses/notifications from native host
 *
 * 2) Request/response communication:
 *    - `browser.runtime.sendNativeMessage(host, request)` returns a Promise
 *
 * This class extends `Endpoint`:
 * - Incoming native messages (from the Port) can be routed to handlers.
 * - It can expose routes to consumers the same way as other endpoints.
 *
 * Flags:
 * - `async` can be written into the Request object; it is interpreted by the
 *   messaging stack as a fire-and-forget hint (depends on the caller).
 *
 * Technical notes:
 * - CommonJS runtime style: assigns to `exports.*`
 * - No destructuring on `require()` call (migration-friendly)
 * - `export {}` forces TS module scope to avoid global symbol collisions
 *
 * @author Nmind.io <osp@nmind.io>
 */

const msg = require("./Message") as any;
const ep = require("./Endpoint") as any;

// Shared core module providing `browser` polyfill and `Logger`
const core = require("../nmind-core") as any;

// Constants module providing COMPANION_HOST (native host name)
const constants = require("../constants") as { COMPANION_HOST: string };

/**
 * Client endpoint for native messaging host communication.
 */
class NativeHostClient extends ep.Endpoint {
  /**
   * Current native messaging Port.
   *
   * - `null` when not connected
   * - otherwise an object exposing:
   *   - `postMessage(...)`
   *   - `onMessage.addListener(...)`
   *   - `onDisconnect.addListener(...)`
   *   - `disconnect()`
   *
   * Typed as `any` because the Port shape may vary slightly across polyfills.
   */
  private port: any | null;

  /**
   * Creates a disconnected client.
   */
  constructor() {
    super();
    this.port = null;
  }

  /**
   * Connects to the native host (if not already connected).
   *
   * Side effects (when connecting):
   * - Opens a native port: `browser.runtime.connectNative(COMPANION_HOST)`
   * - Registers:
   *   - `port.onMessage` -> routes incoming messages via `handleMessage`
   *   - `port.onDisconnect` -> cleans state via `handleDisconnect`
   *
   * @returns true if connected after this call.
   */
  connect(): boolean {
    if (!this.isConnected()) {
      const self = this;

      this.port = core.browser.runtime.connectNative(constants.COMPANION_HOST);

      this.port.onMessage.addListener((message: unknown) => {
        self.handleMessage(message);
      });

      this.port.onDisconnect.addListener((port: unknown) => {
        self.handleDisconnect(port);
      });
    }

    return this.isConnected();
  }

  /**
   * Indicates whether the client is currently connected to the native host.
   *
   * @returns true if a Port exists, otherwise false.
   */
  isConnected(): boolean {
    return this.port != null;
  }

  /**
   * Disconnects from the native host (if connected).
   *
   * Side effects:
   * - Calls `port.disconnect()`
   * - Sets internal `port` reference to null
   *
   * @returns true if disconnected after this call.
   */
  disconnect(): boolean {
    if (this.isConnected() && this.port) {
      core.Logger.debug("NativeHostClient-disconnect:", this.port);
      this.port.disconnect();
      this.port = null;
    }
    return !this.isConnected();
  }

  /**
   * Sends a request to the native host using the Port channel (fire-and-forget).
   *
   * This does NOT return a Promise. It is suitable for commands where you do not
   * need a synchronous response, or where responses are handled via pushed messages.
   *
   * Note:
   * - Writes the optional `async` flag into the Request object.
   *
   * @param route - Route name to call on native host side.
   * @param params - Optional payload.
   * @param async - Optional async flag placed on the Request.
   */
  post(route: string, params?: unknown, async?: boolean): void {
    core.Logger.debug(`NativeHostClient-postMessage:  ${route}`, params);

    const request = msg.Message.request(route, params);
    request.async = async || false;

    // Safe optional chaining: if port is null, nothing happens.
    this.port?.postMessage(request);
  }

  /**
   * Handles an incoming message from the native Port.
   *
   * Behavior:
   * - Logs the message
   * - Routes it through the Endpoint router (`route(...)`)
   *
   * This allows the native host to push requests/events back into the extension,
   * and have them handled via `on(route, handler)`.
   *
   * @param message - Incoming message from native host.
   */
  handleMessage(message: unknown): void {
    core.Logger.debug("NativeHostClient-handleMessage:", message);
    this.route(message as any);
  }

  /**
   * Handles a native port disconnection event.
   *
   * Behavior:
   * - Logs the disconnection payload
   * - Sets internal `port` reference to null
   *
   * @param port - Disconnection payload provided by runtime.
   */
  handleDisconnect(port: unknown): void {
    core.Logger.debug("NativeHostClient-handleDisconnect: ", port);
    this.port = null;
  }

  /**
   * Sends a request to the native host using `sendNativeMessage`, returning a Promise.
   *
   * The returned Promise:
   * - resolves when `response.code == 200`
   * - rejects with `Message.error(response.message, response.type)` otherwise
   * - rejects with `Message.error(error)` when the underlying runtime Promise fails
   *
   * Note:
   * - Writes the optional `async` flag into the Request object.
   *
   * @param route - Route name to call on native host side.
   * @param params - Optional payload.
   * @param async - Optional async flag placed on the Request.
   * @returns Promise resolving with the response payload (unknown).
   */
  request(route: string, params?: unknown, async?: boolean): Promise<unknown> {
    const request = msg.Message.request(route, params);
    request.async = async || false;

    core.Logger.debug(
      `NativeHostClient-request:  ${route}`,
      request,
      JSON.stringify(request)
    );

    return new Promise((resolve, reject) => {
      core.browser.runtime
        .sendNativeMessage(constants.COMPANION_HOST, request)
        .then(
          (response: any) => {
            core.Logger.debug("NativeHostClient-response: ", response);

            if (response.code == 200) resolve(response);
            else reject(msg.Message.error(response.message, response.type));
          },
          (error: unknown) => {
            core.Logger.error("NativeHostClient-error: ", error);
            reject(msg.Message.error(error));
          }
        );
    });
  }
}

/**
 * CommonJS export (pure CJS).
 * Consumers use: `require("./NativeHostClient").NativeHostClient`
 */
exports.NativeHostClient = NativeHostClient;

/**
 * Forces TS module scope (prevents global symbol collisions).
 */
export {};
