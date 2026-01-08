/**
 * Miscellaneous low-level helper utilities shared across the Nmind Companion
 * Browser Extension
 * 
 * All helpers are defensive and silent: they never throw and never log.
 * 
 * @author Nmind.io <osp@nmind.io>
 */

/**
 * Ensures that a given property of an object has a specific JavaScript `typeof`.
 * If the current value does NOT match the expected type, the property is
 * overwritten with the provided default value.
 *
 * Important semantic notes:
 * - The function only operates if `target` is an object (`typeof === "object"`)
 * - `null` is explicitly excluded
 * - If the property does not exist, it is considered invalid and will be set
 * - The check is based strictly on JavaScript `typeof`
 * - No exception is ever thrown
 *
 * Typical usage:
 * - normalizing configuration objects
 * - ensuring runtime safety when reading untrusted data
 *
 * @param target
 *   The object on which the property should be checked.
 *   If not an object, the function does nothing.
 *
 * @param property
 *   The name of the property to validate or initialize.
 *
 * @param expected
 *   The expected JavaScript `typeof` value.
 *
 * @param value
 *   The default value to assign if the property type is invalid.
 *
 * @example
 * ```ts
 * const cfg: any = {};
 * ensureType(cfg, "timeout", "number", 5000);
 * // cfg.timeout === 5000
 * ```
 */
function ensureType(
  target: unknown,
  property: string,
  expected:
    | "string"
    | "number"
    | "boolean"
    | "bigint"
    | "symbol"
    | "undefined"
    | "object"
    | "function",
  value: unknown
): void {
  if (typeof target === "object" && target !== null) {
    const obj = target as Record<string, unknown>;
    if (typeof obj[property] !== expected) {
      obj[property] = value;
    }
  }
}

/**
 * Ensures that a property is a string.
 * If the property is missing or not a string, it is replaced by the provided
 * default value.
 *
 * This is a typed convenience wrapper around {@link ensureType}.
 *
 * @param target
 *   The object to validate.
 *
 * @param property
 *   The name of the property to enforce as a string.
 *
 * @param value
 *   The default string value to apply if the check fails.
 *
 * @example
 * ```ts
 * typeOfString(options, "locale", "en-US");
 * ```
 */
function typeOfString(
  target: unknown,
  property: string,
  value: string
): void {
  ensureType(target, property, "string", value);
}

/**
 * Ensures that a property is a number.
 * If the property is missing or not a number, it is replaced by the provided
 * default value.
 *
 * This function does NOT validate:
 * - NaN
 * - Infinity
 *
 * It strictly relies on `typeof === "number"`.
 *
 * @param target
 *   The object to validate.
 *
 * @param property
 *   The name of the property to enforce as a number.
 *
 * @param value
 *   The default numeric value to apply if the check fails.
 *
 * @example
 * ```ts
 * typeOfNumber(config, "retryCount", 3);
 * ```
 */
function typeOfNumber(
  target: unknown,
  property: string,
  value: number
): void {
  ensureType(target, property, "number", value);
}

/**
 * Ensures that a property is a boolean.
 * If the property is missing or not a boolean, it is replaced by the provided
 * default value.
 *
 * This function does NOT coerce values:
 * - `"true"` → X
 * - `1` → X
 *
 * @param target
 *   The object to validate.
 *
 * @param property
 *   The name of the property to enforce as a boolean.
 *
 * @param value
 *   The default boolean value to apply if the check fails.
 *
 * @example
 * ```ts
 * typeOfBoolean(flags, "enabled", false);
 * ```
 */
function typeOfBoolean(
  target: unknown,
  property: string,
  value: boolean
): void {
  ensureType(target, property, "boolean", value);
}

/**
 * Produces a human-readable dump of one or more variables.
 *
 * Output format:
 * - One line per argument
 * - Each line starts with `(typeof value)`
 * - Objects are recursively expanded
 *
 * Important characteristics:
 * - Uses `for...in` (enumerable properties, including inherited)
 * - No circular reference detection
 * - Intended for debugging, NOT serialization
 *
 * @param args
 *   One or more variables to dump.
 *
 * @returns
 *   A formatted multi-line string representation.
 *
 * @example
 * ```ts
 * console.log(varDump({ a: 1 }, "test"));
 * ```
 *
 * Output:
 * ```
 * (object) { a: (number) 1 }
 * (string) "test"
 * ```
 */
function varDump(...args: unknown[]): string {
  const dumpOne = (mVar: unknown): string => {
    let sOut = "(" + typeof mVar + ") ";

    if (typeof mVar === "object" && mVar !== null) {
      sOut += "{ ";

      for (const mKey in mVar as Record<string, unknown>) {
        const v = (mVar as Record<string, unknown>)[mKey];
        sOut += `${mKey}: ${dumpOne(v)}, `;
      }

      if (sOut.endsWith(", ")) {
        sOut = sOut.slice(0, -2);
      }

      sOut += " }";
    } else if (typeof mVar === "string") {
      sOut += `"${mVar}"`;
    } else {
      sOut += String(mVar);
    }

    return sOut;
  };

  return args.map(dumpOne).join("\n");
}

/**
 * =============================================================================
 * CommonJS public API
 * =============================================================================
 */
exports.ensureType = ensureType;
exports.typeOfString = typeOfString;
exports.typeOfNumber = typeOfNumber;
exports.typeOfBoolean = typeOfBoolean;
exports.varDump = varDump;