/**
 * 
 * Page-side client that communicates with the extension using DOM events and a
 * temporary TextNode as a transport channel.
 *
 * Two channels:
 * 1) Request/response:
 *    - create a TextNode containing JSON request
 *    - listen on this TextNode for "io.nmind.response"
 *    - dispatch "io.nmind.request"
 *    - TabListener reads the node, routes the request, writes JSON response back
 *      into the node, then dispatches "io.nmind.response" on that node
 *
 * 2) Push messages:
 *    - page listens for "io.nmind.message" dispatched by the extension
 *
 * API overview:
 * - create(route, params?): creates a Request object
 * - on/off: registers push-message handlers
 * - send(...): sends a Request; returns Promise unless request.async is true
 * - version(name?): helper to detect extension presence / identity
 *
 *
 * @author Nmind.io <osp@nmind.io>
 */

const msg = require("./Message") as any;
const loggerMod = require("../LoggerWrapper") as any;

/**
 * Handler signature for push messages ("io.nmind.message").
 *
 * The handler receives the request parameters:
 * - request.params spread if it's an array
 * - [request.params] if it's an object
 * - [request.params] otherwise
 */
export type RouteHandler = (...args: any[]) => void;

/**
 *
 * Client used to communicate with the extension
 * Simplified version of Endpoint adapted to this specific use case
 *
 * The goal of this client is to send a message to the TabListener and obtain
 * a Promise as a response.
 *
 * The solution works as follows:
 *      1 - Create a TextNode in document.head containing the serialized request,
 *          allowing data to be exchanged between the two execution contexts
 *      2 - Attach an event listener for the 'io.nmind.response' event on this TextNode
 *      3 - Dispatch an 'io.nmind.request' event from this TextNode,
 *          which bubbles up to the window level
 *      4 - TabListener listens for all 'io.nmind.request' events at the window level.
 *          It can then retrieve the source TextNode and process the request
 *      5 - TabListener serializes the response back into the TextNode and dispatches
 *          an 'io.nmind.response' event on the TextNode
 *      6 - The event listener added in step 2 can then remove the TextNode
 *          and retrieve the response
 *
 * This mechanism allows request/response exchanges to be handled using Promises
 * without interfering with other requests or other elements on the page
 *
 * It is still possible to send asynchronous requests that do not return a Promise.
 * In this case, asynchronous requests may or may not trigger a later message
 */
class ExtensionClient {
  /**
   * Push route handlers keyed by route name.
   *
   * Example:
   * ```ts
   * client.on("extension.someEvent", (payload) => { ... });
   * ```
   */
  private routes: Record<string, RouteHandler>;

  /**
   * Constructs the client and registers a listener for "io.nmind.message".
   *
   * Runtime behavior:
   * - When an "io.nmind.message" event is received:
   *   - parse `e.detail` as JSON request object
   *   - if a handler is registered for request.name, call it with derived args
   * - Errors in handlers are caught and logged to console.
   */
  constructor() {
    this.routes = {};
    const self = this;

    window.document.addEventListener(
      "io.nmind.message",
      function (e: any) {
        const request = JSON.parse(e.detail);

        if (self.routes[request.name] != undefined) {
          try {
            let args: any[];

            if (Array.isArray(request.params)) args = request.params;
            else if (typeof request.params === "object")
              args = [request.params];
            else args = [request.params];

            self.routes[request.name].apply(null, args);
          } catch (err) {
            console.error(err);
          }
        }
      },
      false
    );
  }

  /**
   * Creates a Request object for the given route.
   *
   * @param route - Route name.
   * @param params - Optional payload.
   * @returns A Request-like object (as built by Message.request()).
   */
  create(route: string, params?: unknown): any {
    return msg.Message.request(route, params);
  }

  /**
   * Registers a push-message handler.
   *
   * @param name - Route name.
   * @param handler - Handler function.
   * @throws if handler is not a function.
   */
  on(name: string, handler: RouteHandler): void {
    if (typeof handler === "function") this.routes[name] = handler;
    else throw `Handler for '${name}' is not a function`;
  }

  /**
   * Unregisters a push-message handler.
   *
   * @param name - Route name.
   */
  off(name: string): void {
    if (this.routes[name]) delete this.routes[name];
  }

  /**
   * Helper method to detect the extension.
   *
   * Behavior:
   * - If `name` is provided: returns true only if name equals "Support Companion".
   *   (This matches legacy behavior and acts as an identity check.)
   * - If `name` is not provided: sends "extension.version" request and returns its Promise.
   *
   * @param name - Optional extension display name.
   */
  version(name?: string): boolean | Promise<unknown> {
    if (name !== undefined) return name === "Support Companion";
    return this.send("extension.version");
  }

  /**
   * Sends a request.
   *
   * Supported calling forms (runtime):
   * 1) send(request: Request)
   * 2) send(name: string, params?: any)
   * 3) send(name: string, ...paramsArray)   // when more than 2 arguments
   *
   * Behavior:
   * - Builds/uses a Request object.
   * - Calls request.check() to normalize fields (delay/async/silent/id).
   * - If request.async is true:
   *   - sends the request and returns undefined (fire-and-forget).
   * - Otherwise:
   *   - returns a Promise resolved/rejected based on response.code.
   *
   * @param __name - Request instance or route name.
   * @param __params - Optional payload or first payload.
   */
  send(__name: any, __params?: any): any {
    let request: any;

    if (__name instanceof msg.Request) {
      request = __name;
    } else {
      // If called with multiple args: pack them into an array
      if (arguments.length > 2)
        __params = Array.prototype.slice.call(arguments, 1);
      else __params = __params || {};

      request = msg.Message.request(__name, __params);
    }

    request.check();

    if (request.async) {
      this._sendAsyncRequest(request);
      return;
    }

    return this._sendPromiseRequest(request);
  }

  /**
   * Low-level transport: sends a Request using a TextNode and DOM events.
   *
   * Steps:
   * - Creates a TextNode containing JSON request.
   * - Attaches a listener on "io.nmind.response" to parse JSON response.
   * - Appends the node to document.head.
   * - Dispatches "io.nmind.request" from the node.
   *
   * Cleanup:
   * - On response, removes the TextNode from the DOM.
   *
   * @param request - Request object to send (will be stringified).
   * @param handler - Optional callback receiving the parsed response.
   */
  private _sendRequest(request: any, handler?: (response: any) => void): void {
    const jsnode = document.createTextNode(JSON.stringify(request));

    jsnode.addEventListener("io.nmind.response", function (event: any) {
      loggerMod.Logger.debug(
        "ExtensionClient-Received response",
        jsnode.nodeValue
      );
      event.cancelBubble = true;
      jsnode.parentNode?.removeChild(jsnode);
      if (handler) handler(JSON.parse(jsnode.nodeValue || "null"));
    });

    document.head.appendChild(jsnode);
    jsnode.dispatchEvent(
      new Event("io.nmind.request", { bubbles: true, cancelable: false })
    );
  }

  /**
   * Sends a request and returns a Promise resolved/rejected based on response.code.
   *
   * - Resolves when response.code == 200
   * - Rejects otherwise (the raw response is passed to reject)
   *
   * Delay handling:
   * - If request.delay > 0, waits the delay then sends.
   * - Resets request.delay to 0 before sending (legacy behavior).
   *
   * @param request - Request object.
   */
  private _sendPromiseRequest(request: any): Promise<any> {
    const self = this;

    return new Promise(function (resolve, reject) {
      const handler = (response: any) => {
        response.code == 200 ? resolve(response) : reject(response);
      };

      const runnable = () => {
        request.delay = 0;
        self._sendRequest(request, handler);
      };

      if (request.delay > 0) setTimeout(runnable, request.delay);
      else runnable();
    });
  }

  /**
   * Sends a request in fire-and-forget mode.
   *
   * The request is sent, and the response (if any) is only logged.
   *
   * Delay handling:
   * - If request.delay > 0, waits the delay then sends.
   * - Resets request.delay to 0 before sending (legacy behavior).
   *
   * @param request - Request object.
   */
  private _sendAsyncRequest(request: any): void {
    const self = this;

    const runnable = () => {
      request.delay = 0;
      self._sendRequest(request, (response: any) => {
        loggerMod.Logger.debug(
          "ExtensionClient-AsyncRequest received response",
          response
        );
      });
    };

    if (request.delay > 0) setTimeout(runnable, request.delay);
    else runnable();
  }
}

/**
 * Attaches a `supportClient` instance to the provided window object and notifies
 * readiness by dispatching the "supportClient.ready" event.
 *
 * @param windowObj - Window-like object that will receive `supportClient`.
 */
function configureWindow(windowObj: any): void {
  windowObj.supportClient = new ExtensionClient();

  windowObj.document.dispatchEvent(
    new Event("supportClient.ready", { bubbles: true, cancelable: false })
  );
}

exports.ExtensionClient = ExtensionClient;
exports.configureWindow = configureWindow;

/**
 * Forces TS module scope (prevents "Cannot redeclare block-scoped variable ..." when
 * mixing JS/TS during migration).
 */
export {};
