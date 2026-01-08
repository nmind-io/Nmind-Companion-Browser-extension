/**
 * 
 * Type definitions for the CommonJS module `EventEmitter`.
 * 
 * @author Nmind.io <osp@nmind.io>
 */
declare namespace NmindEventEmitter {
  /** Listener signature used by the emitter. */
  type Listener = (...args: unknown[]) => void;

  /**
   * Minimal event emitter implementation.
   */
  class EventEmitter {
    constructor();

    /** Registers a listener for an event. */
    on(eventName: string, fn: Listener): void;

    /** Unregisters a listener for an event. */
    off(eventName: string, fn: Listener): void;

    /** Registers a listener that will be called at most once. */
    once(eventName: string, fn: Listener): void;

    /** Emits an event to all listeners. */
    emit(eventName: string, ...args: unknown[]): void;

    /** Alias for `off`, kept for compatibility. */
    removeListener(eventName: string, fn: Listener): void;
  }
}

declare const EventEmitterModule: {
  /**
   * Exported class constructor.
   */
  EventEmitter: typeof NmindEventEmitter.EventEmitter;
};

export = EventEmitterModule;