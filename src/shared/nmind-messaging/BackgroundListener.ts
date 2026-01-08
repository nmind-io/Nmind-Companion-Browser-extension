/**
 *
 * Background-side message router/listener.
 *
 * Responsibilities:
 * - Listen to `browser.runtime.onConnect`:
 *   - store active Ports indexed by `contextId`
 *   - route messages received on Ports via Endpoint routing
 *   - remove Ports on disconnect
 *
 * - Listen to `browser.runtime.onMessage` (sendMessage channel):
 *   - route the incoming message
 *   - return a Promise that resolves only when response.code == 200
 *   - reject otherwise with `Message.error(...)`
 *
 * This class extends `Endpoint`:
 * - Incoming requests are routed by `Endpoint.route(...)`
 * - You can register handlers with `on(route, handler)`
 *
 * @author Nmind.io <osp@nmind.io>
 */

const msg = require("./Message") as any;
const ep = require("./Endpoint") as any;
const core = require("../nmind-core") as any;

/**
 * Background listener endpoint.
 */
class BackgroundListener extends ep.Endpoint {
  /**
   * Registry of active runtime Ports.
   *
   * Key:
   * - `contextId` (usually `port.sender.contextId`)
   *
   * Value:
   * - Port instance returned by `browser.runtime.onConnect`
   */
  private ports: Record<string, any>;

  /**
   * Creates the listener and registers runtime listeners:
   * - `runtime.onConnect` -> handleConnect
   * - `runtime.onMessage` -> handleRequest
   */
  constructor() {
    super();
    this.ports = {};

    const self = this;

    // Port-based channel: connect() from other extension parts
    core.browser.runtime.onConnect.addListener((port: any) => {
      return self.handleConnect(port);
    });

    // sendMessage channel: request/response
    core.browser.runtime.onMessage.addListener(
      (message: unknown, sender: unknown) => {
        return self.handleRequest(message as any, sender as any);
      }
    );
  }

  /**
   * Posts a message to an already-registered Port.
   *
   * The provided `port` argument is expected to contain a `contextId` property.
   * If no matching Port is found in the registry, nothing happens.
   *
   * @param port - Object containing a `contextId` field used as registry key.
   * @param message - Any message to send to the connected port.
   */
  post(port: any, message: unknown): void {
    core.Logger.debug("BackgroundListener-postMessage: ", message);

    if (port && port.contextId && this.ports[port.contextId]) {
      this.ports[port.contextId].postMessage(message);
    }
  }

  /**
   * Handles a new runtime Port connection.
   *
   * Behavior:
   * - Stores the port in `ports` using `port.sender.contextId` as key
   * - Attaches:
   *   - `port.onMessage` -> handleMessage(message, port)
   *   - `port.onDisconnect` -> handleDisconnect(port)
   *
   * @param port - Runtime Port object provided by `runtime.onConnect`.
   */
  handleConnect(port: any): void {
    core.Logger.debug(
      "BackgroundListener-connected : " + port.sender.contextId
    );
    this.ports[port.sender.contextId] = port;

    const self = this;

    port.onMessage.addListener((message: unknown, __port: any) => {
      self.handleMessage(message, __port);
    });

    port.onDisconnect.addListener((__port: any) => {
      self.handleDisconnect(__port);
    });
  }

  /**
   * Handles a Port disconnection.
   *
   * Behavior:
   * - Removes the Port from the registry using `port.sender.contextId` as key.
   *
   * @param port - Disconnected Port.
   */
  handleDisconnect(port: any): void {
    core.Logger.debug(
      "BackgroundListener-handleDisconnect: ",
      port.sender.contextId
    );
    if (this.ports[port.sender.contextId])
      delete this.ports[port.sender.contextId];
  }

  /**
   * Handles a message received through a runtime Port.
   *
   * Behavior:
   * - Routes the incoming message through `Endpoint.route(message, port)`
   * - This enables port messages to be handled by registered route handlers.
   *
   * @param message - Incoming message payload.
   * @param port - Port instance that emitted the message.
   */
  handleMessage(message: unknown, port: any): void {
    core.Logger.debug("BackgroundListener-handleMessage: ", message);
    super.route(message as any, port);
  }

  /**
   * Handles a request received through `runtime.onMessage` (sendMessage).
   *
   * Behavior:
   * - Routes the request through `Endpoint.route(message, port)`
   * - If the response is a Promise -> returns it (WebExtension will await it)
   * - Otherwise -> wraps it into a Promise that:
   *     - resolves when response.code == 200
   *     - rejects with Message.error(response.message, response.type) otherwise
   *
   * @param message - Incoming request.
   * @param port - Sender info (named "port" in legacy code).
   * @returns A Promise in most cases, to satisfy WebExtension async response rules.
   */
  handleRequest(message: any, port: any): any {
    core.Logger.debug("BackgroundListener-handleRequest: ", message);

    const response = super.route(message, port);
    core.Logger.debug("BackgroundListener-response: ", response);

    if (response instanceof Promise) return response;

    return new Promise((resolve, reject) => {
      if (response.code == 200) resolve(response);
      else reject(msg.Message.error(response.message, response.type));
    });
  }

  /**
   * Creates a pipe handler adapted for background use.
   *
   * Background routes often receive:
   * - first arg: `port` (sender/transport)
   * - remaining args: params
   *
   * This method returns a handler that:
   * - removes the first argument (port)
   * - builds params:
   *   - null if no params
   *   - single param if one
   *   - array if multiple
   * - forwards the route via `this.forward(route, params)`
   *
   * @param route - Route name to forward.
   * @returns A handler function.
   */
  protected _createPipe(route: string): any {
    return function (this: BackgroundListener, port: any) {
      let params: unknown;

      if (arguments.length === 1) params = null;
      else if (arguments.length === 2) params = arguments[1];
      else {
        const arr = Array.from(arguments);
        arr.shift(); // drop port
        params = arr;
      }

      return (this as any).forward(route, params);
    };
  }
}

/**
 * CommonJS export (pure CJS).
 * Consumers use: `require("./BackgroundListener").BackgroundListener`
 */
exports.BackgroundListener = BackgroundListener;

/**
 * Forces TS module scope (prevents global symbol collisions).
 */
export {};
