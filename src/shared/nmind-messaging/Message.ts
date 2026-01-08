/**
 *
 * Defines the message primitives exchanged in the nmind-messaging layer.
 *
 * The model is intentionally simple and uses HTTP-like status codes:
 * - 200: Success
 * - 403: Failure (functional error)
 * - 404: Unknown (unknown route)
 * - 500: ScriptError (unexpected error / exception)
 *
 * Components that typically exchange these objects:
 * - Endpoint routing layer
 * - BackgroundClient / BackgroundListener
 * - NativeHostClient
 * - ExtensionClient / TabListener bridge
 *
 * @author Nmind.io <osp@nmind.io>
 */

const misc = require("../nmind-misc") as {
  /**
   * Ensures `target[property]` is a string; otherwise sets `value`.
   */
  typeOfString: (target: unknown, property: string, value: string) => void;

  /**
   * Ensures `target[property]` is a boolean; otherwise sets `value`.
   */
  typeOfBoolean: (target: unknown, property: string, value: boolean) => void;

  /**
   * Ensures `target[property]` is a number; otherwise sets `value`.
   */
  typeOfNumber: (target: unknown, property: string, value: number) => void;
};

/**
 * Request payload type.
 * Kept as `unknown` to preserve compatibility with existing JS usage.
 */
export type Params = unknown;

/**
 * Factory helpers to build requests and responses.
 *
 * This mirrors the legacy JS API and centralizes object creation.
 */
export class Message {
  /**
   * Builds a Success response (`code = 200`).
   *
   * @param data - Response payload.
   * @param name - Optional route name (useful for correlation/debugging).
   */
  static success(data: unknown, name?: string) {
    return new Success(data, name);
  }

  /**
   * Builds a Failure response (`code = 403`).
   *
   * Used for "expected" functional errors (validation, authorization, etc.)
   * as opposed to exceptions.
   *
   * @param message - Human-readable error message.
   * @param type - Optional error type/category.
   * @param name - Optional route name for correlation/debugging.
   */
  static failure(message: string, type?: string | null, name?: string) {
    return new Failure(message, type, name);
  }

  /**
   * Builds a ScriptError response (`code = 500`).
   *
   * Used for unexpected errors (exceptions).
   *
   * @param err - Any error-like value (Error, string, object...).
   * @param type - Optional error type/category.
   * @param name - Optional route name for correlation/debugging.
   */
  static error(err: unknown, type?: string | null, name?: string) {
    return new ScriptError(err, type, name);
  }

  /**
   * Builds an Unknown response (`code = 404`).
   *
   * Typically used when a route does not exist in an Endpoint.
   *
   * @param message - Human-readable message describing the issue.
   * @param name - Optional route name for correlation/debugging.
   */
  static unknown(message: string, name?: string) {
    return new Unknown(message, name);
  }

  /**
   * Builds a Request object.
   *
   * @param name - Route name.
   * @param params - Optional payload.
   */
  static request(name: string, params?: Params) {
    return new Request(name, params);
  }
}

/**
 * Represents a route invocation request.
 *
 * Fields:
 * - name: route name
 * - params: payload
 * - id: correlation id (string)
 * - delay: delay in ms before execution
 * - async: fire-and-forget hint for some clients
 * - silent: if true, the endpoint may not return any response
 */
export class Request {
  /** Route name. */
  name: string;

  /** Payload passed to the route. */
  params: Params;

  /** Correlation id (string). Default: "-1". */
  id: string;

  /** Execution delay (ms). Default: 0. */
  delay: number;

  /**
   * If true, some clients will send without returning a Promise
   * (fire-and-forget semantics).
   */
  async: boolean;

  /**
   * If true, the Endpoint may not return a response (undefined).
   */
  silent: boolean;

  /**
   * Creates a new Request with defaults.
   *
   * @param name - Route name.
   * @param params - Optional payload.
   */
  constructor(name: string, params?: Params) {
    this.name = name;
    this.params = params;
    this.id = "-1";
    this.delay = 0;
    this.async = false;
    this.silent = false;
  }

  /**
   * Normalizes core fields of the request.
   *
   * This mirrors the legacy JS behavior:
   * - delay: number (default 0)
   * - async: boolean (default false)
   * - silent: boolean (default false)
   * - id: string (default "-1")
   */
  check(): void {
    misc.typeOfNumber(this, "delay", 0);
    misc.typeOfBoolean(this, "async", false);
    misc.typeOfBoolean(this, "silent", false);
    misc.typeOfString(this, "id", "-1");
  }
}

/**
 * Base class for all responses.
 */
export class Response {
  /** Response code (HTTP-like semantics). */
  code: number;

  /**
   * @param code - Response status code.
   */
  constructor(code: number) {
    this.code = code;
  }
}

/**
 * Success response (`code = 200`).
 */
export class Success extends Response {
  /** Optional route name for correlation/debugging. */
  name?: string;

  /** Optional reference id. */
  refid?: string;

  /** Payload returned by the route. */
  content: unknown;

  /**
   * @param data - Payload to return to caller.
   * @param name - Optional route name.
   */
  constructor(data: unknown, name?: string) {
    super(200);
    this.name = name;
    this.refid = undefined;
    this.content = data;
  }
}

/**
 * Failure response (`code = 403`).
 *
 * Used for expected / functional errors.
 */
export class Failure extends Response {
  /** Optional route name for correlation/debugging. */
  name?: string;

  /** Optional error type/category. */
  type: string | null;

  /** Human-readable error message. */
  message: string;

  /**
   * @param message - Error message.
   * @param type - Optional error type/category.
   * @param name - Optional route name.
   */
  constructor(message: string, type?: string | null, name?: string) {
    super(403);
    this.name = name;
    this.type = type || null;
    this.message = message;
  }
}

/**
 * Unknown response (`code = 404`).
 *
 * Used when a route does not exist.
 */
export class Unknown extends Response {
  /** Optional route name for correlation/debugging. */
  name?: string;

  /** Human-readable message describing the unknown route. */
  message: string;

  /**
   * @param message - Message describing the issue.
   * @param name - Optional route name.
   */
  constructor(message: string, name?: string) {
    super(404);
    this.name = name;
    this.message = message;
  }
}

/**
 * Script error response (`code = 500`).
 *
 * Used for unexpected errors (exceptions). Attempts to extract `message` and
 * `type` from Error-like objects.
 */
export class ScriptError extends Response {
  /** Optional route name for correlation/debugging. */
  name?: string;

  /** Optional error type/category. */
  type: string | null;

  /** Error payload (may be string, object, etc.). */
  message: unknown;

  /**
   * Creates a ScriptError response.
   *
   * Behavior:
   * - If `err` looks like `{ message, type }`, then:
   *   - `message` is taken from `err.message`
   *   - `type` is taken from `err.type` (overrides parameter)
   *
   * @param err - Error-like value.
   * @param type - Optional error type/category.
   * @param name - Optional route name.
   */
  constructor(err: unknown, type?: string | null, name?: string) {
    super(500);

    if (typeof err === "object" && err !== null && (err as any).message) {
      if ((err as any).message) err = (err as any).message;
      if ((err as any).type) type = (err as any).type;
    }

    this.name = name;
    this.type = type || null;
    this.message = err;
  }
}

/** CommonJS exports (pure CJS). */
exports.Message = Message;
exports.Request = Request;
exports.Response = Response;
exports.Success = Success;
exports.Failure = Failure;
exports.Unknown = Unknown;
exports.ScriptError = ScriptError;

/**
 * Forces TS module scope (prevents global symbol collisions).
 */
export {};
