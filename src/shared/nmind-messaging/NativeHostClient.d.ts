/**
 *
 * CommonJS type declarations for the `NativeHostClient` module.
 *
 * This module exports:
 * - `NativeHostClient` class constructor
 *
 * Runtime responsibilities:
 * - Connect to a native messaging host (connectNative)
 * - Send fire-and-forget requests via Port (post)
 * - Send request/response messages via Promise (request)
 * 
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindMessagingNativeHostClient {
  /**
   * Client used to communicate with the native messaging host.
   *
   * Transport:
   * - Port-based via `runtime.connectNative(host)` (fire-and-forget with `post`)
   * - Promise-based via `runtime.sendNativeMessage(host, request)` (request/response)
   */
  class NativeHostClient {
    /**
     * Creates a disconnected client instance.
     */
    constructor();

    /**
     * Connects to the native host if not already connected.
     *
     * @returns true if connected after the call.
     */
    connect(): boolean;

    /**
     * Indicates whether the client is currently connected.
     *
     * @returns true if a native Port exists, otherwise false.
     */
    isConnected(): boolean;

    /**
     * Disconnects from the native host if connected.
     *
     * @returns true if disconnected after the call.
     */
    disconnect(): boolean;

    /**
     * Sends a request via the native Port (fire-and-forget).
     *
     * @param route - Route name.
     * @param params - Optional payload.
     * @param async - Optional async flag written into the request.
     */
    post(route: string, params?: unknown, async?: boolean): void;

    /**
     * Sends a request via `sendNativeMessage` and returns a Promise.
     *
     * Promise behavior:
     * - resolves if response.code == 200
     * - rejects otherwise
     *
     * @param route - Route name.
     * @param params - Optional payload.
     * @param async - Optional async flag written into the request.
     */
    request(route: string, params?: unknown, async?: boolean): Promise<unknown>;
  }
}

/**
 * CommonJS module export surface.
 */
declare const NativeHostClientModule: {
  /** NativeHostClient class constructor. */
  NativeHostClient: typeof NmindMessagingNativeHostClient.NativeHostClient;
};

export = NativeHostClientModule;
