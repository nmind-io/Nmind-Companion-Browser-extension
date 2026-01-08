/**
 *
 * Lightweight request router used across the nmind-messaging layer.
 *
 * Main features:
 * - Register/unregister handlers: `on(name, handler)`, `off(name)`
 * - Route a request: `route(request, port?)`
 * - Forward routes to another endpoint: `pipe(...)`, `unpipe(...)`
 * - Connect two endpoints so they can forward to each other: `join(endpoint)`
 *
 * Routing rules (precedence):
 * 1) Exact match in `routes`
 * 2) Exact match in `pipes.plain`
 * 3) RegExp match in `pipes.regexp`
 *
 * Handler return values:
 * - Promise            -> returned as-is
 * - Response instance  -> returned as-is
 * - any other value    -> wrapped into `Message.success(value)`
 *
 * @author Nmind.io <osp@nmind.io>
 *
 */

const loggerMod = require("../LoggerWrapper") as { Logger: any };
const msgMod = require("./Message") as { Message: any; Response: any };

/**
 * Route handler function signature.
 *
 * Notes:
 * - Arguments are created by `_buildArguments(request, port?)`
 * - If `port` exists, it is prepended to the args list
 * - The handler `this` is bound to the Endpoint instance
 */
export type Handler = (...args: any[]) => any;

/**
 * Endpoint forwarding interface (duck-typed).
 *
 * The joined endpoint (or endpoint-like object) may provide:
 * - request(route, params): request/response style forwarding
 * - post(route, params): fire-and-forget forwarding
 */
export interface Forwarder {
  /**
   * Forwards a request expecting a response (may return Promise).
   *
   * @param route - route name
   * @param params - payload to forward
   */
  request?: (route: string, params: unknown) => any;

  /**
   * Forwards a request as fire-and-forget.
   *
   * @param route - route name
   * @param params - payload to forward
   */
  post?: (route: string, params: unknown) => any;
}

/**
 * Core Endpoint router.
 */
export class Endpoint {
  /**
   * Explicit route handlers keyed by route name.
   *
   * Example:
   * ```ts
   * endpoint.on("ping", () => "pong");
   * ```
   */
  routes: Record<string, Handler>;

  /**
   * Pipes registry.
   *
   * - `plain`: route names forwarded as-is
   * - `regexp`: patterns that forward when `regexp.test(request.name)` is true
   */
  pipes: { plain: Array<string>; regexp: Array<RegExp> };

  /**
   * Forwarder implementation used by pipe handlers and `forward()`.
   *
   * When two endpoints are joined via `join()`, each becomes the other's forwarder.
   */
  forwarder: Forwarder;

  /**
   * Creates a new Endpoint with empty registries.
   */
  constructor() {
    this.routes = {};
    this.pipes = { plain: [], regexp: [] };

    // Keep a defined object (safer than `undefined` during mixed JS/TS migration)
    this.forwarder = {};
  }

  /**
   * Registers a handler for a route name.
   *
   * @param name - route name
   * @param handler - function to call when the route is invoked
   * @throws if `handler` is not a function
   */
  on(name: string, handler: Handler): void {
    if (typeof handler === "function") {
      this.routes[name] = handler;
    } else {
      throw `Handler for '${name}' is not a function`;
    }
  }

  /**
   * Unregisters a handler for a route name.
   *
   * @param name - route name
   */
  off(name: string): void {
    if (this.routes[name]) {
      delete this.routes[name];
    }
  }

  /**
   * Forwards a route and parameters to the joined endpoint (forwarder).
   *
   * Selection:
   * - If `forwarder.request` exists: call it and return its value
   * - Else if `forwarder.post` exists: call it and return its value
   * - Else: return `undefined`
   *
   * @param route - route name
   * @param params - payload to forward
   */
  forward(route: string, params: unknown): any {
    loggerMod.Logger.debug(
      `${this.constructor.name}-Endpoint-forward-request: ${route}`,
      params
    );

    if (this.forwarder && typeof this.forwarder.request === "function") {
      return this.forwarder.request(route, params);
    } else if (this.forwarder && typeof this.forwarder.post === "function") {
      return this.forwarder.post(route, params);
    }
  }

  /**
   * Declares route names or patterns that should be automatically forwarded.
   *
   * @param routes - strings (exact match) or RegExp (pattern match)
   */
  pipe(...routes: Array<string | RegExp>): void {
    for (const route of routes) {
      let type: "plain" | "regexp";
      if (typeof route === "string") {
        type = "plain";
      } else if (route instanceof RegExp) {
        type = "regexp";
      } else {
        return;
      }

      (this.pipes[type] as any).push(route as any);
    }
  }

  /**
   * Removes previously declared pipes.
   *
   * Note:
   * - Keeps the original JS behavior: uses `delete` on the array slot,
   *   which may leave holes.
   *
   * @param routes - strings (exact match) or RegExp (pattern match)
   */
  unpipe(...routes: Array<string | RegExp>): void {
    for (const route of routes) {
      let type: "plain" | "regexp";
      if (typeof route === "string") {
        type = "plain";
      } else if (route instanceof RegExp) {
        type = "regexp";
      } else {
        return;
      }

      const list = this.pipes[type] as any[];
      const idx = list.indexOf(route as any);
      if (idx >= 0) {
        delete list[idx];
      }
    }
  }

  /**
   * Joins this endpoint with another endpoint so each can forward to the other.
   *
   * @param endpoint - endpoint to join
   */
  join(endpoint: Endpoint): void {
    this.forwarder = endpoint as any;
    (endpoint as any).forwarder = this;
  }

  /**
   * Routes an incoming request.
   *
   * Behavior:
   * - normalizes request flags:
   *   - silent default false
   *   - async default false
   *   - delay default 0
   * - resolves a route handler (routes / pipes)
   * - builds handler args (optionally prepending `port`)
   * - executes the handler using `_routeCall(...)`
   * - if request.silent is true: returns undefined (even if handler returns something)
   *
   * @param request - Request-like object (expects at least { name, params }).
   * @param port - Optional transport object (e.g. runtime Port).
   * @returns Response-like object, Promise, or undefined (silent).
   */
  route(request: any, port?: unknown): any {
    loggerMod.Logger.debug(`${this.constructor.name}-Endpoint-route`, request);

    request.silent = request.silent || false;
    request.async = request.async || false;
    request.delay = request.delay || 0;

    const handler = this._findRoute(request);

    if (handler) {
      const args = this._buildArguments(request, port);
      const response = this._routeCall(handler, args, this);

      if (request.silent === false) {
        return response;
      }
    } else {
      return msgMod.Message.unknown(`Unknown route '${request.name}'`);
    }
  }

  /**
   * Finds the handler for a request.
   *
   * @param request - Request-like object containing a `name` string.
   * @returns handler function or null if none matches.
   */
  protected _findRoute(request: any): Handler | null {
    if (this.routes[request.name] !== undefined) {
      return this.routes[request.name];
    } else if (this.pipes.plain.includes(request.name)) {
      return this._createPipe(request.name);
    } else {
      for (const regexp of this.pipes.regexp) {
        if (regexp && regexp.test(request.name)) {
          return this._createPipe(request.name);
        }
      }
    }
    return null;
  }

  /**
   * Creates a forwarding handler for a given route name.
   *
   * The returned handler:
   * - converts arguments into params (null / single / array)
   * - calls `this.forward(route, params)`
   *
   * @param route - route name to forward
   * @returns a handler function
   */
  protected _createPipe(route: string): Handler {
    return function (this: Endpoint) {
      let params: unknown;
      if (arguments.length === 0) {
        params = null;
      } else if (arguments.length === 1) {
        params = arguments[0];
      } else {
        params = Array.from(arguments);
      }

      return this.forward(route, params);
    };
  }

  /**
   * Builds the argument list for a route handler call.
   *
   * With `port`:
   * - if params is array -> [port, ...params]
   * - else -> [port, params]
   *
   * Without `port`:
   * - if params is array -> params
   * - else if params is object -> [params]
   * - else -> [params]
   *
   * @param request - Request-like object containing `params`.
   * @param port - Optional port to inject.
   */
  protected _buildArguments(request: any, port?: unknown): any[] {
    let args: any[];

    if (port) {
      if (Array.isArray(request.params)) {
        args = [port, ...request.params];
      } else {
        args = [port, request.params];
      }
    } else {
      if (Array.isArray(request.params)) {
        args = request.params;
      } else if (typeof request.params === "object") {
        args = [request.params];
      } else {
        args = [request.params];
      }
    }

    return args;
  }

  /**
   * Calls a handler and wraps its return value into a Response when needed.
   *
   * Wrapping rules:
   * - Promise -> returned as-is
   * - Response instance -> returned as-is
   * - any other value -> wrapped into `Message.success(value)`
   *
   * Error handling:
   * - Catches thrown errors
   * - Logs via Logger.error(...)
   * - Returns `Message.failure(err.message)`
   *
   * @param route - handler function
   * @param args - arguments list
   * @param context - `this` context for handler call
   */
  protected _routeCall(route: Handler, args: any[], context: any): any {
    try {
      const response = route.apply(context, args);

      if (response instanceof Promise) {
        return response;
      }
      if (response instanceof msgMod.Response) {
        return response;
      }

      return msgMod.Message.success(response);
    } catch (err: any) {
      loggerMod.Logger.error(err);
      return msgMod.Message.failure(err?.message);
    }
  }

  /**
   * Calls a handler after a delay.
   *
   * Behavior:
   * - If `silent` is true:
   *   - schedules execution and returns `undefined`
   * - Else:
   *   - returns a Promise resolving to a Response-like value
   *
   * @param route - handler function
   * @param args - handler args
   * @param context - `this` context
   * @param delay - delay in milliseconds
   * @param silent - whether to suppress return value
   */
  protected _routeCallDelay(
    route: Handler,
    args: any[],
    context: any,
    delay: number,
    silent: boolean
  ): any {
    const self = this;

    if (silent) {
      setTimeout(self._routeCall as any, delay, route, args, context);
      return;
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        const response = self._routeCall(route, args, context);

        if (response instanceof Promise) {
          resolve(response);
        } else if (response instanceof msgMod.Response) {
          resolve(response);
        } else {
          resolve(msgMod.Message.success(response));
        }
      }, delay);
    });
  }
}

/** CommonJS export (pure CJS). */
exports.Endpoint = Endpoint;
