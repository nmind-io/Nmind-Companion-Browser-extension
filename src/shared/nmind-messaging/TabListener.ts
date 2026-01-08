/**
 *
 * Document-side listener that bridges page scripts and extension scripts using
 * DOM events and a TextNode as the transport channel.
 *
 * Request/response flow:
 * 1) A caller creates a TextNode containing a JSON serialized Request.
 * 2) The caller attaches an event listener on the TextNode for "io.nmind.response".
 * 3) The caller dispatches "io.nmind.request" from the TextNode (bubbles up).
 * 4) TabListener listens for all "io.nmind.request" events at the document level,
 *    reads the TextNode content, routes the request, and produces a response.
 * 5) TabListener writes the JSON serialized response back into the TextNode and
 *    dispatches "io.nmind.response" from the TextNode.
 * 6) The caller reads the TextNode content, removes the node, and resolves/rejects.
 *
 * Push-message channel:
 * - TabListener can dispatch "io.nmind.message" events to the document, allowing
 *   page scripts to receive messages without using the request/response mechanism.
 *
 * @author Nmind.io <osp@nmind.io>
 */

const msg = require("./Message") as any;
const ep = require("./Endpoint") as any;
const core = require("../nmind-core") as any;

/**
 * Tab-side listener endpoint.
 *
 * Extends Endpoint so that incoming requests can be routed using route handlers.
 */
class TabListener extends ep.Endpoint {
  /**
   * Owner document used as the event hub.
   *
   * TabListener listens on this document for "io.nmind.request" events
   * and dispatches push messages ("io.nmind.message") through it.
   */
  private document: Document;

  /**
   * Creates a TabListener and registers the "io.nmind.request" listener.
   *
   * @param ownerDocument - Document used as the event hub (typically window.document).
   */
  constructor(ownerDocument: Document) {
    super();
    this.document = ownerDocument;

    const self = this;

    // Listen for request events emitted by ExtensionClient (TextNode transport).
    this.document.addEventListener("io.nmind.request", (event: Event) => {
      self.handleRequest(event as any);
    });
  }

  /**
   * Sends a push message to the page via a CustomEvent "io.nmind.message".
   *
   * This does NOT use the TextNode request/response transport and therefore does
   * not return any Promise.
   *
   * @param route - Route name (used as request.name).
   * @param params - Optional payload to send.
   */
  post(route: string, params?: unknown): void {
    const request = msg.Message.request(route, params);
    core.Logger.debug(`TabListener-postMessage:  ${route}`, request);

    const event = new CustomEvent("io.nmind.message", {
      bubbles: true,
      cancelable: false,
      detail: JSON.stringify(request),
    });

    this.document.dispatchEvent(event);
  }

  /**
   * Writes the response into the TextNode and dispatches "io.nmind.response".
   *
   * @param node - The TextNode used as the request/response carrier.
   * @param response - Any response object to serialize.
   */
  sendResponse(node: CharacterData, response: unknown): void {
    const event = new Event("io.nmind.response", {
      bubbles: true,
      cancelable: false,
    });
    node.nodeValue = JSON.stringify(response);
    (node as any).dispatchEvent(event);
  }

  /**
   * Handles an "io.nmind.request" event.
   *
   * Expected contract:
   * - event.target is a TextNode (Node.TEXT_NODE)
   * - node.nodeValue contains a JSON serialized request
   *
   * Behavior:
   * - If the response is synchronous: serialize it back into the node and dispatch response event.
   * - If the response is a Promise:
   *   - resolve: serialize resolved value and dispatch response event
   *   - reject: serialize Message.error(error) and dispatch response event
   *
   * @param event - Event dispatched from the TextNode.
   * @returns true (legacy pattern, keeps behavior consistent).
   */
  handleRequest(event: any): boolean {
    const node = event.target as CharacterData | null;
    const self = this;

    // Ignore if target is not a TextNode
    if (!node || (node as any).nodeType != Node.TEXT_NODE) return true;

    // Route the request through the Endpoint.
    const response = super.route(JSON.parse(node.nodeValue || "null"));

    // Promise-based response
    if (response instanceof Promise) {
      response
        .then((r: unknown) => {
          core.Logger.debug("TabListener-promise-resolve: ", r);
          self.sendResponse(node, r);
        })
        .catch((error: unknown) => {
          core.Logger.debug("TabListener-promise-reject: ", error);
          self.sendResponse(node, msg.Message.error(error));
        });
    } else {
      // Synchronous response
      core.Logger.debug("TabListener-response: ", response);
      this.sendResponse(node, response);
    }

    return true;
  }
}

exports.TabListener = TabListener;

/**
 * Forces TS module scope (prevents global symbol collisions).
 */
export {};
