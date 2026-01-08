/**
 *
 * CommonJS type declarations for the `TabListener` module.
 *
 * This module exports:
 * - `TabListener` class constructor
 *
 * Purpose:
 * - Provide a DOM-event + TextNode based bridge between page scripts and
 *   extension scripts.
 *
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindMessagingTabListener {
  /**
   * Document-side listener used to handle request/response events and push messages.
   *
   * Runtime responsibilities:
   * - Listen for "io.nmind.request" at the document level
   * - Read the request from the TextNode target
   * - Route the request and write the response back into the same TextNode
   * - Dispatch "io.nmind.response" from that node
   */
  class TabListener {
    /**
     * Creates the listener and registers the document-level request handler.
     *
     * @param ownerDocument - Document used as event hub (typically window.document).
     */
    constructor(ownerDocument: Document);

    /**
     * Sends a push message to the page via "io.nmind.message".
     *
     * @param route - Route name.
     * @param params - Optional payload.
     */
    post(route: string, params?: unknown): void;

    /**
     * Writes the response into the TextNode and dispatches "io.nmind.response".
     *
     * @param node - TextNode used as transport.
     * @param response - Response payload to serialize.
     */
    sendResponse(node: CharacterData, response: unknown): void;

    /**
     * Handles an "io.nmind.request" event dispatched from a TextNode.
     *
     * @param event - Request event.
     * @returns true when handled.
     */
    handleRequest(event: any): boolean;
  }
}

/**
 * CommonJS export surface.
 */
declare const TabListenerModule: {
  /** TabListener class constructor. */
  TabListener: typeof NmindMessagingTabListener.TabListener;
};

export = TabListenerModule;
