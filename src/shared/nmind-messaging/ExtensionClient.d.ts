/**
 * 
 * CommonJS type declarations for the `ExtensionClient` module.
 *
 * This module exports:
 * - `ExtensionClient`: page-side client constructor
 * - `configureWindow(windowObj)`: helper to inject `supportClient` and dispatch
 *   a readiness event.
 * 
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindMessagingExtensionClient {
  /**
   * Push-message handler signature for "io.nmind.message".
   *
   * The runtime passes request.params to the handler:
   * - spread if params is an array
   * - wrapped as [params] if params is an object
   * - wrapped as [params] otherwise
   */
  type RouteHandler = (...args: any[]) => void;

  /**
   * Page-side client used to:
   * - listen to push messages from the extension ("io.nmind.message")
   * - send request/response messages via TextNode transport ("io.nmind.request"/"io.nmind.response")
   */
  class ExtensionClient {
    /**
     * Creates a client and registers a listener for "io.nmind.message".
     */
    constructor();

    /**
     * Creates a Request object for a route.
     *
     * @param route - Route name.
     * @param params - Optional payload.
     * @returns A Request-like object.
     */
    create(route: string, params?: unknown): any;

    /**
     * Registers a push-message handler for a route name.
     *
     * @param name - Route name.
     * @param handler - Handler function.
     */
    on(name: string, handler: RouteHandler): void;

    /**
     * Unregisters a push-message handler.
     *
     * @param name - Route name.
     */
    off(name: string): void;

    /**
     * Helper to detect the extension.
     *
     * - If name is provided: returns true only if name equals "Support Companion".
     * - Otherwise: sends "extension.version" request and returns a Promise.
     *
     * @param name - Optional extension display name.
     */
    version(name?: string): boolean | Promise<unknown>;

    /**
     * Sends a request.
     *
     * Supported calling forms (runtime):
     * - send(request)
     * - send(name, params?)
     * - send(name, ...paramsArray)
     *
     * Behavior:
     * - If request.async is true: returns void (fire-and-forget)
     * - Otherwise: returns a Promise resolved/rejected based on response.code
     *
     * @param nameOrRequest - Request instance or route name.
     * @param params - Optional payload.
     */
    send(nameOrRequest: any, params?: any): any;
  }

  /**
   * Injects a `supportClient` instance into the given window and dispatches
   * a readiness event ("supportClient.ready").
   *
   * @param windowObj - Window-like object.
   */
  function configureWindow(windowObj: any): void;
}

/**
 * CommonJS module export surface.
 *
 * Consumers receive an object:
 * - `{ ExtensionClient: <constructor>, configureWindow: <function> }`
 */
declare const ExtensionClientModule: {
  /** ExtensionClient class constructor. */
  ExtensionClient: typeof NmindMessagingExtensionClient.ExtensionClient;

  /** Helper to inject `supportClient` into a window. */
  configureWindow: typeof NmindMessagingExtensionClient.configureWindow;
};

export = ExtensionClientModule;
