/**
 *
 * This `.d.ts` file describes the public API of the CommonJS module
 * `BackgroundClient`.
 *
 * The module exports a single class constructor:
 * - `BackgroundClient`
 *
 * Usage (CommonJS):
 * ```js
 * const { BackgroundClient } = require("./BackgroundClient");
 * const client = new BackgroundClient();
 * client.post("route.name", { any: "payload" });
 * const res = await client.request("route.name", { any: "payload" });
 * ```
 *
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindMessagingBackgroundClient {
  /**
   * Client used to communicate with the background script.
   *
   * Transport:
   * - Port-based push channel via `browser.runtime.connect()` (fire-and-forget)
   * - Promise-based request/response via `browser.runtime.sendMessage()`
   *
   * The runtime implementation extends an Endpoint router so incoming Port
   * messages can be routed to handlers.
   */
  class BackgroundClient {
    /**
     * Creates a client and connects immediately to the background runtime.
     *
     * Side effects (runtime):
     * - opens a Port via `browser.runtime.connect()`
     * - subscribes to `port.onMessage` and routes incoming messages
     */
    constructor();

    /**
     * Sends a message to background over the connected Port (fire-and-forget).
     *
     * Use when you do not need a Promise response.
     *
     * @param route - Route name (ex: "extension.version", "companion.print").
     * @param params - Optional payload forwarded to background.
     */
    post(route: string, params?: unknown): void;

    /**
     * Sends a message to background via `runtime.sendMessage` and returns a Promise.
     *
     * Use for request/response interactions.
     *
     * @param route - Route name (ex: "extension.version", "companion.print").
     * @param params - Optional payload forwarded to background.
     * @returns A Promise that resolves with the background response payload.
     */
    request(route: string, params?: unknown): Promise<unknown>;

    /**
     * Handles an incoming Port message by routing it through the Endpoint router.
     *
     * This enables the background script to push requests/events to this client.
     *
     * @param request - Request-like object received from background.
     */
    handleMessage(request: any): void;
  }
}

/**
 * CommonJS module export surface.
 *
 * Consumers receive an object:
 * - `{ BackgroundClient: <constructor> }`
 */
declare const BackgroundClientModule: {
  BackgroundClient: typeof NmindMessagingBackgroundClient.BackgroundClient;
};

export = BackgroundClientModule;
