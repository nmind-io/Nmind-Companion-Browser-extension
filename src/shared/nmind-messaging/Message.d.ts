/**
 *
 * CommonJS type declarations for the Message model module.
 *
 * This module exports constructors:
 * - Message (factory helpers)
 * - Request / Response
 * - Success / Failure / Unknown / ScriptError
 * 
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindMessagingMessage {
  /** Request payload type (kept permissive). */
  type Params = unknown;

  /**
   * Factory helpers to create requests/responses.
   */
  class Message {
    /** Creates a Success response (`code = 200`). */
    static success(data: unknown, name?: string): Success;

    /** Creates a Failure response (`code = 403`). */
    static failure(message: string, type?: string | null, name?: string): Failure;

    /** Creates a ScriptError response (`code = 500`). */
    static error(err: unknown, type?: string | null, name?: string): ScriptError;

    /** Creates an Unknown response (`code = 404`). */
    static unknown(message: string, name?: string): Unknown;

    /** Creates a Request object. */
    static request(name: string, params?: Params): Request;
  }

  /**
   * Represents a route invocation request.
   */
  class Request {
    /** Route name. */
    name: string;

    /** Request payload. */
    params: Params;

    /** Correlation id (string). Default: "-1". */
    id: string;

    /** Delay before execution (ms). */
    delay: number;

    /** Async hint (fire-and-forget semantics for some clients). */
    async: boolean;

    /** Silent hint (endpoint may not return any response). */
    silent: boolean;

    constructor(name: string, params?: Params);

    /** Normalizes fields (delay/async/silent/id). */
    check(): void;
  }

  /**
   * Base response with HTTP-like status code.
   */
  class Response {
    /** Status code (200/403/404/500). */
    code: number;
    constructor(code: number);
  }

  /**
   * Success response (`code = 200`).
   */
  class Success extends Response {
    name?: string;
    refid?: string;
    content: unknown;
    constructor(data: unknown, name?: string);
  }

  /**
   * Failure response (`code = 403`).
   */
  class Failure extends Response {
    name?: string;
    type: string | null;
    message: string;
    constructor(message: string, type?: string | null, name?: string);
  }

  /**
   * Unknown route response (`code = 404`).
   */
  class Unknown extends Response {
    name?: string;
    message: string;
    constructor(message: string, name?: string);
  }

  /**
   * Script error response (`code = 500`).
   */
  class ScriptError extends Response {
    name?: string;
    type: string | null;
    message: unknown;
    constructor(err: unknown, type?: string | null, name?: string);
  }
}

/**
 * CommonJS export surface.
 */
declare const MessageModule: {
  Message: typeof NmindMessagingMessage.Message;
  Request: typeof NmindMessagingMessage.Request;
  Response: typeof NmindMessagingMessage.Response;
  Success: typeof NmindMessagingMessage.Success;
  Failure: typeof NmindMessagingMessage.Failure;
  Unknown: typeof NmindMessagingMessage.Unknown;
  ScriptError: typeof NmindMessagingMessage.ScriptError;
};

export = MessageModule;
