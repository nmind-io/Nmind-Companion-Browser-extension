/**
 * Type declarations for the CommonJS module `nmind-misc`.
 * Provides typing for consumers using `require()` or TS import assignment.
 *  
 * @author Nmind.io <osp@nmind.io>
 */

declare namespace NmindMisc {
  /** 
   * JavaScript typeof values accepted by ensureType().
   */
  type JsTypeof =
    | "string"
    | "number"
    | "boolean"
    | "bigint"
    | "symbol"
    | "undefined"
    | "object"
    | "function";

  /**
   * Ensures that `target[property]` is of `expected` JS typeof; if not, assigns `value`.
   *
   * @param target - Any value; only objects (non-null) are modified.
   * @param property - Property name to check / initialize.
   * @param expected - Expected JS typeof value.
   * @param value - Default value to assign when the check fails.
   */
  function ensureType(
    target: unknown,
    property: string,
    expected: JsTypeof,
    value: unknown
  ): void;

  /** 
   * Ensures that `target[property]` is a string; otherwise assigns `value`.
   */
  function typeOfString(target: unknown, property: string, value: string): void;

  /**
   * Ensures that `target[property]` is a number; otherwise assigns `value`.
   * Note: does not validate NaN/Infinity (only `typeof === "number"`).
   */
  function typeOfNumber(target: unknown, property: string, value: number): void;

  /**
   * Ensures that `target[property]` is a boolean; otherwise assigns `value`.
   * Note: no coercion (e.g., "true" is not accepted).
   */
  function typeOfBoolean(target: unknown, property: string, value: boolean): void;

  /**
   * Dumps information about variable(s). Returns one line per argument, joined by "\n".
   */
  function varDump(...args: unknown[]): string;
}

/**
 * CommonJS export: `require("./nmind-misc")` returns this object.
 */
declare const nmindMisc: {
  ensureType: typeof NmindMisc.ensureType;
  typeOfString: typeof NmindMisc.typeOfString;
  typeOfNumber: typeof NmindMisc.typeOfNumber;
  typeOfBoolean: typeof NmindMisc.typeOfBoolean;
  varDump: typeof NmindMisc.varDump;
};

export = nmindMisc;