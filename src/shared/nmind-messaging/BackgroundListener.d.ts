/**
 *
 * CommonJS type declarations for the `BackgroundListener` module.
 *
 * This module exports:
 * - `BackgroundListener` class constructor
 *
 * Purpose:
 * - Background-side listener/router for:
 *   - Port connections (`runtime.onConnect`)
 *   - sendMessage requests (`runtime.onMessage`)
 *
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindMessagingBackgroundListener {
  /**
   * Background-side listener/router.
   *
   * Runtime behavior:
   * - Maintains a registry of Ports indexed by sender.contextId
   * - Routes Port messages via Endpoint routing
   * - Routes runtime.onMessage (sendMessage) via Endpoint routing and returns Promises
   */
  class BackgroundListener {
    /**
     * Creates the listener and attaches:
     * - runtime.onConnect
     * - runtime.onMessage
     */
    constructor();

    /**
     * Posts a message to a registered Port (lookup by port.contextId).
     *
     * @param port - Port-like object containing `contextId`.
     * @param message - Message payload.
     */
    post(port: any, message: unknown): void;

    /**
     * Handles a new Port connection.
     *
     * @param port - Connected Port.
     */
    handleConnect(port: any): void;

    /**
     * Handles Port disconnection and removes it from the registry.
     *
     * @param port - Disconnected Port.
     */
    handleDisconnect(port: any): void;

    /**
     * Handles a message received on a Port.
     *
     * @param message - Message payload.
     * @param port - Port that emitted the message.
     */
    handleMessage(message: unknown, port: any): void;

    /**
     * Handles a request received via runtime.onMessage (sendMessage).
     *
     * @param message - Request payload.
     * @param port - Sender info.
     * @returns A Promise or Response-like value depending on routing result.
     */
    handleRequest(message: any, port: any): any;
  }
}

/**
 * CommonJS export surface.
 */
declare const BackgroundListenerModule: {
  /** BackgroundListener class constructor. */
  BackgroundListener: typeof NmindMessagingBackgroundListener.BackgroundListener;
};

export = BackgroundListenerModule;
