/**
 *
 * CommonJS type declarations for the `nmind-messaging` barrel module.
 *
 * This module is the public entry point and aggregates:
 * - Endpoint router
 * - TabListener (document-side bridge)
 * - BackgroundClient / BackgroundListener (background transport)
 * - NativeHostClient (native messaging transport)
 * - Message model (Message, Request, Response, Success, Failure, Unknown, ScriptError)
 *
 * Notes:
 * - This file generates no JavaScript.
 * - The declarations are structural (do not rely on `import("./X")`) to remain
 *   resilient during partial JS ↔ TS migration.
 * 
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindMessagingIndex {
  // ---------------------------------------------------------------------------
  // Message model
  // ---------------------------------------------------------------------------

  /** Request parameter payload type (kept permissive). */
  type Params = unknown;

  /**
   * Message factory.
   * Provides helpers to create Request and various Response objects.
   */
  class Message {
    /** Creates a Success response wrapper. */
    static success(data: unknown, name?: string): any;

    /** Creates a Failure response wrapper. */
    static failure(message: string, type?: string | null, name?: string): any;

    /** Creates a ScriptError response wrapper. */
    static error(err: unknown, type?: string | null, name?: string): any;

    /** Creates an Unknown response wrapper. */
    static unknown(message: string, name?: string): any;

    /** Creates a Request object. */
    static request(name: string, params?: Params): any;
  }

  /**
   * Request model.
   * Used to call routes on endpoints.
   */
  class Request {
    /** Route name. */
    name: string;

    /** Payload (any shape). */
    params: Params;

    /** Correlation id (string). */
    id: string;

    /** Delay before execution (ms). */
    delay: number;

    /** Async flag (fire-and-forget semantics in some clients). */
    async: boolean;

    /** Silent flag (endpoint may not return a value). */
    silent: boolean;

    /** Creates a new request with defaults. */
    constructor(name: string, params?: Params);

    /** Normalizes core fields (delay/async/silent/id). */
    check(): void;
  }

  /**
   * Base Response.
   * Uses HTTP-like `code` semantics (200/403/404/500).
   */
  class Response {
    /** Status code. */
    code: number;
    constructor(code: number);
  }

  /** Success response (code 200). */
  class Success extends Response {}

  /** Failure response (code 403). */
  class Failure extends Response {}

  /** Unknown route response (code 404). */
  class Unknown extends Response {}

  /** Script/runtime error response (code 500). */
  class ScriptError extends Response {}

  // ---------------------------------------------------------------------------
  // Endpoint and transports
  // ---------------------------------------------------------------------------

  /** Generic handler signature for endpoint routes. */
  type Handler = (...args: any[]) => any;

  /**
   * Endpoint router.
   * Allows registering route handlers and routing Request objects.
   */
  class Endpoint {
    constructor();

    /** Registers a handler for a route name. */
    on(name: string, handler: Handler): void;

    /** Unregisters a handler for a route name. */
    off(name: string): void;

    /** Forwards a route to a joined endpoint (if any). */
    forward(route: string, params: unknown): any;

    /** Adds pipes (string/RegExp) to automatically forward routes. */
    pipe(...routes: Array<string | RegExp>): void;

    /** Removes previously registered pipes. */
    unpipe(...routes: Array<string | RegExp>): void;

    /** Joins another endpoint for mutual forwarding. */
    join(endpoint: Endpoint): void;

    /** Routes a Request-like object (optionally with a Port/sender). */
    route(request: any, port?: unknown): any;
  }

  /**
   * TabListener (document-side bridge).
   * Listens to "io.nmind.request" and writes back to a TextNode response.
   */
  class TabListener extends Endpoint {
    constructor(ownerDocument: Document);

    /** Push message to the page via "io.nmind.message". */
    post(route: string, params?: unknown): void;

    /** Writes response to the TextNode and dispatches "io.nmind.response". */
    sendResponse(node: CharacterData, response: unknown): void;

    /** Handles a DOM request event and responds. */
    handleRequest(event: any): boolean;
  }

  /**
   * BackgroundClient.
   * Client-side background communication (Port + runtime.sendMessage).
   */
  class BackgroundClient extends Endpoint {
    constructor();

    /** Fire-and-forget message to background through Port. */
    post(route: string, params?: unknown): void;

    /** Promise-based message to background through runtime.sendMessage. */
    request(route: string, params?: unknown): Promise<unknown>;

    /** Routes a Port message through Endpoint router. */
    handleMessage(request: any): void;
  }

  /**
   * BackgroundListener.
   * Background-side listener/router (runtime.onConnect / runtime.onMessage).
   */
  class BackgroundListener extends Endpoint {
    constructor();

    /** Posts a message to a registered Port. */
    post(port: any, message: unknown): void;

    /** Handles new Port connections. */
    handleConnect(port: any): void;

    /** Handles Port disconnection and cleanup. */
    handleDisconnect(port: any): void;

    /** Routes a Port message through Endpoint router. */
    handleMessage(message: unknown, port: any): void;

    /** Handles runtime.sendMessage style requests. */
    handleRequest(message: any, port: any): any;
  }

  /**
   * NativeHostClient.
   * Client communicating with native messaging host (connectNative/sendNativeMessage).
   */
  class NativeHostClient extends Endpoint {
    constructor();

    /** Connects to the native host and returns connection state. */
    connect(): boolean;

    /** True if a native Port exists. */
    isConnected(): boolean;

    /** Disconnects from the native host and returns disconnection state. */
    disconnect(): boolean;

    /** Fire-and-forget to native host via Port (optional async flag). */
    post(route: string, params?: unknown, async?: boolean): void;

    /** Promise-based request/response via sendNativeMessage (optional async flag). */
    request(route: string, params?: unknown, async?: boolean): Promise<unknown>;
  }
}

/**
 * CommonJS export surface of the barrel module.
 *
 * Consumers receive an object with constructors for:
 * - Endpoint, TabListener, BackgroundClient, BackgroundListener, NativeHostClient
 * - Message, Request, Response, Success, Failure, Unknown, ScriptError
 */
declare const NmMessaging: {
  Endpoint: typeof NmindMessagingIndex.Endpoint;
  TabListener: typeof NmindMessagingIndex.TabListener;
  BackgroundClient: typeof NmindMessagingIndex.BackgroundClient;
  BackgroundListener: typeof NmindMessagingIndex.BackgroundListener;
  NativeHostClient: typeof NmindMessagingIndex.NativeHostClient;

  Message: typeof NmindMessagingIndex.Message;
  Request: typeof NmindMessagingIndex.Request;
  Response: typeof NmindMessagingIndex.Response;
  Success: typeof NmindMessagingIndex.Success;
  Failure: typeof NmindMessagingIndex.Failure;
  Unknown: typeof NmindMessagingIndex.Unknown;
  ScriptError: typeof NmindMessagingIndex.ScriptError;
};

export = NmMessaging;
