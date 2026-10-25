// No "use client" directive: the manager uses no React and no DOM API beyond `queueMicrotask`,
// so a Server Component may import `toast` (for its type, or to pass nothing) without a client
// reference (design/components/toast.md 13). The parts are client modules.
import type { ReactNode } from "react";
import type { Action, ActionDetails, ChangeReason } from "../internal/types.js";

/** Announcement priority and role of a toast. */
export type ToastPriority = "normal" | "high";

/** The `action` of a toast: what `Toast.Action` renders and runs by default. */
export interface ToastActionOptions {
  /** The Action button's content. */
  readonly label: ReactNode;
  /**
   * Runs in the Action part's own transition (`data-pending` on the Action and the Root, the
   * timer paused). The toast closes with `reason: "activate"` when it resolves; a rejection
   * keeps the toast and reaches the nearest Error Boundary above the Viewport. A caught error
   * resolves the action and therefore closes the toast: rethrow after `toast.update` to keep it.
   */
  readonly action: Action<[details: ToastActionDetails]>;
}

/**
 * What `toast(options)` shows: the content and behaviour of one toast. `toast.update(id, options)`
 * takes a partial of it.
 *
 * @see https://ui.funstack.work/components/toast
 */
export interface ToastOptions {
  /**
   * Explicit id: an existing one updates that toast.
   *
   * @defaultValue generated
   */
  readonly id?: string | undefined;
  /** Rendered by `Toast.Title`, which names the Root (`aria-labelledby`). */
  readonly title?: ReactNode;
  /** Rendered by `Toast.Description`, which describes the Root (`aria-describedby`). */
  readonly description?: ReactNode;
  /** Free-form, rendered as `data-type` on the Root (`"success"`, `"error"`, ...). */
  readonly type?: string | undefined;
  /**
   * Announcement priority and role: `"high"` announces with `ariaNotify` priority `"high"` and
   * renders the Root as an `alertdialog`.
   *
   * @defaultValue `"normal"`
   */
  readonly priority?: ToastPriority | undefined;
  /**
   * Milliseconds before the toast closes with `reason: "timeout"`; `null` never. A timed action
   * toast must keep its action reachable elsewhere too (WCAG 2.2.1).
   *
   * @defaultValue the Viewport's `duration`, or `null` (persistent) when the toast has an `action`
   */
  readonly duration?: number | null | undefined;
  /**
   * A button the toast offers (Undo, Retry), rendered and run by `Toast.Action`. A toast with an
   * action is persistent unless `duration` is set.
   */
  readonly action?: ToastActionOptions | undefined;
  /**
   * Called once when the toast leaves, with the reason: `"activate"` (the Action part settled),
   * `"dismiss"` (Close, Escape, `toast.dismiss()`, a promise toast with no message for its
   * outcome) or `"timeout"`. Runs in the Viewport's transition; a rejection reaches the boundary
   * above the Viewport. Not called when the Viewport unmounts.
   */
  readonly closeAction?: Action<[details: ToastCloseDetails]> | undefined;
  /**
   * The text `document.ariaNotify()` speaks for this toast; `null` announces nothing.
   *
   * @defaultValue the Viewport's `announce`, else the text of the toast's Title and Description
   */
  readonly announce?: ((toast: ToastItem) => string | null) | undefined;
  /** Anything the Viewport's children want to render. */
  readonly data?: unknown;
}

/** A toast in the queue, as the Viewport's `children(state)` receives it. */
export interface ToastItem extends ToastOptions {
  readonly id: string;
  /**
   * The promise given to `toast.promise` is unsettled, or an action dispatched through this
   * toast's Action part is in flight.
   */
  readonly pending: boolean;
  /** Closed; kept mounted (and `inert`) for its exit animation. */
  readonly ending: boolean;
}

/** Details passed to a toast's Action. */
export interface ToastActionDetails extends ActionDetails {
  /** The toast's id, so an inline action can `toast.update` or `toast.dismiss` its own toast. */
  readonly id: string;
}

/** Details passed to a toast's `closeAction`. */
export interface ToastCloseDetails extends ActionDetails {
  /** The id of the toast that closed. */
  readonly id: string;
  /** `"activate"`, `"dismiss"` or `"timeout"`. */
  readonly reason: ChangeReason;
}

/**
 * The second argument of `toast.promise(promise, options)`: the toast to show while `promise` is
 * pending and the ones that replace it when it settles.
 *
 * @see https://ui.funstack.work/components/toast
 */
export interface ToastPromiseOptions<T> {
  /** Shown at once, with `data-pending`; no timer until the promise settles. */
  readonly pending: ToastOptions;
  /**
   * Replaces the toast when the promise fulfils; omitted: the toast is dismissed. A function that
   * throws dismisses the toast, and the returned promise rejects with what it threw.
   */
  readonly success?: ToastOptions | ((value: T) => ToastOptions) | undefined;
  /**
   * Replaces the toast when the promise rejects; the returned promise then resolves with
   * `undefined` (the toast is the handler). Omitted: the toast is dismissed and the returned
   * promise rejects with the same reason. A function that throws dismisses the toast, and the
   * returned promise rejects with what it threw.
   */
  readonly error?: ToastOptions | ((reason: unknown) => ToastOptions) | undefined;
  /**
   * Explicit id of the toast; an existing one is updated.
   *
   * @defaultValue generated
   */
  readonly id?: string | undefined;
}

/** The queue's input: `toast(options)` and its methods. */
export interface ToastManager {
  /** Adds a toast (or updates the one with `options.id`) and returns its id. */
  (options: ToastOptions): string;
  /**
   * The same as calling the manager: adds a toast (or updates the one with `options.id`) and
   * returns its id.
   */
  readonly add: (options: ToastOptions) => string;
  /**
   * Shows `options.pending` at once and swaps to `success` / `error` when `promise` settles.
   * Returns a promise that settles with `promise`, except that a rejection resolves with
   * `undefined` when `error` was given.
   */
  readonly promise: <T>(
    promise: PromiseLike<T>,
    options: ToastPromiseOptions<T>,
  ) => Promise<T | undefined>;
  /** Changes a toast in place (same position, same element). Unknown or closed ids are ignored. */
  readonly update: (id: string, options: Partial<ToastOptions>) => void;
  /** Closes one toast, or every toast when `id` is omitted, with `reason: "dismiss"`. */
  readonly dismiss: (id?: string) => void;
}

// --- Internal: the command channel between a manager and its Viewport --------------------------

/** A queue mutation, applied by the subscribed Viewport (or buffered until one subscribes). */
export type ToastCommand =
  | {
      readonly kind: "add";
      readonly id: string;
      readonly options: ToastOptions;
      /** Added by `toast.promise`: pending until the promise settles. */
      readonly pending: boolean;
    }
  | {
      readonly kind: "update";
      readonly id: string;
      readonly options: Partial<ToastOptions>;
      /** A promise settle: the options replace the toast's (keeping its id), pending ends. */
      readonly settle: boolean;
    }
  | { readonly kind: "dismiss"; readonly id: string | undefined };

/** What a Viewport hands its manager. */
export interface ToastListener {
  /**
   * Takes over the toasts a previous Viewport left behind (called on subscribe, before the
   * buffer is applied).
   */
  readonly restore: (toasts: readonly RetainedToast[]) => void;
  /** Applies a batch of commands, in dispatch order. */
  readonly apply: (commands: readonly ToastCommand[]) => void;
  /** The toasts to keep when this Viewport unsubscribes. */
  readonly retain: () => readonly RetainedToast[];
}

/** A retained queue entry: what a Viewport leaves behind when it unmounts (design 14 item 11). */
export interface RetainedToast {
  readonly options: ToastOptions & { readonly id: string };
  readonly pending: boolean;
  /**
   * The text last announced for it (`null`: silenced), so the next Viewport does not announce
   * it again; `undefined` when nothing was announced yet.
   */
  readonly announced?: string | null | undefined;
}

export interface ToastManagerInternals {
  /**
   * Sets the listener, hands it the retained toasts and drains the buffer into it. Returns the
   * unsubscribe function, or `null` (changing nothing) when a different listener is subscribed:
   * the second-Viewport case.
   */
  readonly subscribe: (listener: ToastListener) => (() => void) | null;
  /** Whether a listener other than `listener` is subscribed (read during render). */
  readonly isTaken: (listener: ToastListener) => boolean;
}

const internals = new WeakMap<ToastManager, ToastManagerInternals>();

/** The command channel of `manager` (library-internal). */
export function toastManagerInternals(manager: ToastManager): ToastManagerInternals {
  const value = internals.get(manager);
  if (value === undefined) {
    throw new TypeError("Toast.Viewport: `manager` must come from `createToastManager()`.");
  }
  return value;
}

const isDev = process.env.NODE_ENV !== "production";

let warnedServer = false;

/**
 * Generated ids are unique across managers, so a Viewport whose `manager` prop changes never
 * mistakes a late close from the old queue (an Undo settling) for one of the new queue's toasts.
 */
let nextId = 0;

/** On the server every method is a no-op, never buffered (design 13). */
function onServer(): boolean {
  if (typeof document !== "undefined") return false;
  if (isDev && !warnedServer) {
    warnedServer = true;
    console.error(
      "toast(): called on the server. Toasts are client-only; the call does nothing. Return data " +
        "from the Server Function and call `toast()` on the client.",
    );
  }
  return true;
}

/** Resets the once-per-process server warning (tests only). */
export function resetToastServerWarning(): void {
  warnedServer = false;
}

function resolveOptions<V>(
  options: ToastOptions | ((value: V) => ToastOptions),
  value: V,
): ToastOptions {
  return typeof options === "function" ? options(value) : options;
}

/**
 * Creates an isolated queue: `<Toast.Viewport manager={m}>` renders it. For a second React root,
 * a micro-frontend, or a test that wants a clean queue. `toast` is the default manager.
 *
 * @see https://ui.funstack.work/components/toast
 */
export function createToastManager(): ToastManager {
  let listener: ToastListener | null = null;
  let retained: readonly RetainedToast[] = [];
  /** Commands issued before any Viewport subscribed (client only). */
  let buffer: ToastCommand[] = [];
  /** Commands of the current tick, flushed together from one microtask. */
  let batch: ToastCommand[] = [];
  let scheduled = false;

  const flush = (): void => {
    scheduled = false;
    const commands = batch;
    batch = [];
    if (commands.length === 0) return;
    if (listener !== null) listener.apply(commands);
    else buffer.push(...commands);
  };

  // A microtask, not a synchronous dispatch: a call made inside a `startTransition` scope (an
  // action's sync prefix) is no longer inside it when the microtask runs, so the queue update is
  // urgent and shows at once even while the action is pending (design 3.4).
  const dispatch = (command: ToastCommand): void => {
    batch.push(command);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(flush);
  };

  const generateId = (): string => `fsui-toast-${++nextId}`;

  const add = (options: ToastOptions): string => {
    const id = options.id ?? generateId();
    if (onServer()) return id;
    dispatch({ kind: "add", id, options, pending: false });
    return id;
  };

  const update = (id: string, options: Partial<ToastOptions>): void => {
    if (onServer()) return;
    dispatch({ kind: "update", id, options, settle: false });
  };

  const dismiss = (id?: string): void => {
    if (onServer()) return;
    dispatch({ kind: "dismiss", id });
  };

  const promise = <T>(
    input: PromiseLike<T>,
    options: ToastPromiseOptions<T>,
  ): Promise<T | undefined> => {
    const { success, error } = options;
    if (onServer()) {
      return Promise.resolve(input).then(
        (value) => value,
        (reason: unknown) => {
          if (error !== undefined) return undefined;
          throw reason;
        },
      );
    }
    const id = options.id ?? options.pending.id ?? generateId();
    dispatch({ kind: "add", id, options: options.pending, pending: true });
    // The returned promise is built from the same `then`, so it settles in the same tick as the
    // toast's update and an awaiting action prop is pending exactly as long as the toast.
    // A `success` / `error` function that throws dismisses the toast (it must not stay pending
    // forever) and the returned promise rejects with what it threw: the operation's outcome is
    // known, but its message is not, and the `error` message would misreport a fulfilment.
    const settle = <V>(options: ToastOptions | ((value: V) => ToastOptions), value: V): void => {
      let resolved: ToastOptions;
      try {
        resolved = resolveOptions(options, value);
      } catch (thrown) {
        dismiss(id);
        throw thrown;
      }
      dispatch({ kind: "update", id, options: resolved, settle: true });
    };
    return Promise.resolve(input).then(
      (value) => {
        if (success === undefined) dismiss(id);
        else settle(success, value);
        return value;
      },
      (reason: unknown) => {
        if (error === undefined) {
          dismiss(id);
          throw reason;
        }
        settle(error, reason);
        return undefined;
      },
    );
  };

  const manager = Object.assign((options: ToastOptions) => add(options), {
    add,
    promise,
    update,
    dismiss,
  }) as ToastManager;

  internals.set(manager, {
    subscribe: (next) => {
      if (listener !== null && listener !== next) return null;
      listener = next;
      const handedOver = retained;
      retained = [];
      if (handedOver.length > 0) next.restore(handedOver);
      // Commands issued before this Viewport subscribed, in order.
      const pending = buffer;
      buffer = [];
      if (pending.length > 0) next.apply(pending);
      return () => {
        if (listener !== next) return;
        // The queue survives the Viewport (a route-level Viewport remounting on navigation does
        // not lose an Undo); timers and `closeAction`s do not.
        retained = next.retain();
        listener = null;
      };
    },
    isTaken: (candidate) => listener !== null && listener !== candidate,
  });

  return manager;
}

/**
 * The default toast manager: `toast({ title: "Saved" })` from anywhere on the client (action
 * bodies, stores, effects). `<Toast.Viewport>` without `manager` renders it. On the server every
 * call is a no-op.
 *
 * @see https://ui.funstack.work/components/toast
 */
export const toast: ToastManager = createToastManager();
