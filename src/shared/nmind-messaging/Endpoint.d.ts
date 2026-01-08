/**
 * CommonJS type declarations for the `Endpoint` module.
 *
 * This file:
 * - Describes the public API surface exposed by `require("./Endpoint")`
 * - Generates no JavaScript
 *
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindMessagingEndpoint {
  /**
   * Route handler signature.
   *
   * Notes:
   * - Arguments are built by the runtime implementation based on request.params
   * - When a `port` is provided to `route(request, port)`, it is prepended to args
   */
  type Handler = (...args: any[]) => any;

  /**
   * Endpoint forwarding interface (duck-typed).
   *
   * A forwarder may implement request-style forwarding, post-style forwarding, or both.
   */
  interface Forwarder {
    /**
     * Request/response forwarding.
     *
     * @param route - route name
     * @param params - payload to forward
     */
    request?: (route: string, params: unknown) => any;

    /**
     * Fire-and-forget forwarding.
     *
     * @param route - route name
     * @param params - payload to forward
     */
    post?: (route: string, params: unknown) => any;
  }

  /**
   * Lightweight request router.
   */
  class Endpoint {
    /**
     * Explicit route handlers keyed by route name.
     */
    routes: Record<string, Handler>;

    /**
     * Pipes registry:
     * - plain: exact names
     * - regexp: pattern matchers
     */
    pipes: { plain: Array<string>; regexp: Array<RegExp> };

    /**
     * Joined endpoint used by `forward()` and pipe handlers.
     */
    forwarder: Forwarder;

    /** Creates an empty endpoint. */
    constructor();

    /**
     * Registers a handler for a route.
     *
     * @param name - route name
     * @param handler - route handler function
     */
    on(name: string, handler: Handler): void;

    /**
     * Unregisters a handler for a route.
     *
     * @param name - route name
     */
    off(name: string): void;

    /**
     * Forwards a route to the joined endpoint (forwarder).
     *
     * @param route - route name
     * @param params - payload to forward
     */
    forward(route: string, params: unknown): any;

    /**
     * Adds one or more pipes (exact strings or RegExp).
     *
     * @param routes - routes to pipe
     */
    pipe(...routes: Array<string | RegExp>): void;

    /**
     * Removes one or more pipes.
     *
     * @param routes - routes to unpipe
     */
    unpipe(...routes: Array<string | RegExp>): void;

    /**
     * Joins this endpoint with another, enabling mutual forwarding.
     *
     * @param endpoint - other endpoint
     */
    join(endpoint: Endpoint): void;

    /**
     * Routes an incoming request.
     *
     * @param request - Request-like object (expects at least { name, params }).
     * @param port - Optional port/transport object to pass to handlers.
     */
    route(request: any, port?: unknown): any;
  }
}

declare const EndpointModule: {
  /** Endpoint class constructor exported by the module. */
  Endpoint: typeof NmindMessagingEndpoint.Endpoint;
};

export = EndpointModule;
