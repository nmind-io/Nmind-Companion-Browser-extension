/**
 * 
 * Lightweight event emitter used in the Nmind Companion Browser Extension.
 *
 * Features:
 * - `on` / `off`: subscribe & unsubscribe listeners
 * - `once`: subscribe a listener for a single emission
 * - `emit`: notify all listeners for an event name
 * 
 * @author Nmind.io <osp@nmind.io>
 */
type Listener = (...args: unknown[]) => void;

/**
 * Minimal event emitter implementation.
 */
class EventEmitter {
  /**
   * Internal registry of event listeners.
   * Each event name maps to a Set of listener functions.
   */
  private events: Record<string, Set<Listener>>;

  /**
   * Creates an EventEmitter instance.
   */
  constructor() {
    this.events = {};
  }

  /**
   * Returns the Set of listeners for an event name, creating it if needed.
   *
   * @param eventName - Name of the event.
   * @returns A Set of listener functions.
   */
  private _getEventListByName(eventName: string): Set<Listener> {
    if (typeof this.events[eventName] === "undefined") {
      this.events[eventName] = new Set<Listener>();
    }
    return this.events[eventName];
  }

  /**
   * Registers a listener for an event.
   *
   * @param eventName - Name of the event.
   * @param fn - Listener callback.
   */
  on(eventName: string, fn: Listener): void {
    this._getEventListByName(eventName).add(fn);
  }

  /**
   * Unregisters a listener for an event.
   *
   * @param eventName - Name of the event.
   * @param fn - Listener callback to remove.
   */
  off(eventName: string, fn: Listener): void {
    this._getEventListByName(eventName).delete(fn);
  }

  /**
   * Registers a listener that will be called at most once for the given event.
   *
   * Note: the original implementation calls `removeListener(...)`, but the class
   * only defines `off(...)`. To preserve the intended behavior while keeping the
   * original public API intact, we alias `removeListener` to `off`.
   *
   * @param eventName - Name of the event.
   * @param fn - Listener callback.
   */
  once(eventName: string, fn: Listener): void {
    const self = this;

    const onceFn: Listener = function (...args: unknown[]) {
      // original intent: remove the wrapper then call the original fn
      self.removeListener(eventName, onceFn);
      fn.apply(self, args);
    };

    this.on(eventName, onceFn);
  }

  /**
   * Emits an event and calls every registered listener with the provided arguments.
   *
   * Listeners are called with `this` bound to the emitter instance (same behavior
   * as the original JS).
   *
   * @param eventName - Name of the event.
   * @param args - Arguments forwarded to listeners.
   */
  emit(eventName: string, ...args: unknown[]): void {
    this._getEventListByName(eventName).forEach(
      function (fn) {
        fn.apply(this, args);
      }.bind(this)
    );
  }

  /**
   * Alias for {@link off}. Kept because the original `once()` uses it.
   *
   * @param eventName - Name of the event.
   * @param fn - Listener callback to remove.
   */
  removeListener(eventName: string, fn: Listener): void {
    this.off(eventName, fn);
  }
}

/**
 * CommonJS export (pure CJS).
 *
 */
exports.EventEmitter = EventEmitter;