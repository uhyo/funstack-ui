import { attachReject } from "./action-details.js";
import type { ActionDetails, Rejectable } from "../types.js";

/**
 * What `callAction` throws for an action that called `details.reject()` (conventions 2.4.1). A
 * frozen object, not an `Error`: it never leaves the library, because every catch that sees an
 * action's outcome (`useControllableAction`, `useActionTrigger`, and the library wrappers that
 * roll something back on a rejection) either rethrows it to one of those two hooks or takes the
 * rejection path itself, and the two hooks swallow it instead of rethrowing or reporting it.
 */
const HANDLED_REJECTION: object = Object.freeze({ handledRejection: true });

/** `error` is the sentinel of an action that called `details.reject()`, not a real rejection. */
export function isHandledRejection(error: unknown): boolean {
  return error === HANDLED_REJECTION;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * Calls a consumer's action with `details` given a `reject` (conventions 2.4.1), and turns a
 * `reject()` the action made before it settled into a throw of the internal sentinel
 * (`isHandledRejection`), so the caller's existing rejection path runs: optimistic state reverts,
 * uncontrolled state is not written, a continuation does not run. The two hooks that own an
 * action's transition recognise the sentinel and neither rethrow it (no Error Boundary) nor
 * report it (no `reportError`).
 *
 * - **Read once, when the action settles**: at its synchronous return, or when the thenable it
 *   returned resolved. Until then nothing changes (pending does not end early).
 * - A synchronous throw, or a rejection of the returned thenable, propagates as is, even after
 *   `reject()`: the throw wins.
 * - Calling `reject()` twice is calling it once. Calling it after the action settled does
 *   nothing, and warns in development (once per dispatch), with `part` as the prefix.
 *
 * Returns `undefined` for a synchronous action (or throws the sentinel synchronously), else a
 * promise to await. Callers call it where they called the action, so the action's synchronous
 * prefix still runs in the caller's transition scope. Directive-free: no client-only API.
 */
export function callAction<D extends ActionDetails>(
  part: string,
  details: D,
  call: (details: D & Rejectable) => unknown,
): Promise<void> | undefined {
  let rejected = false;
  let settled = false;
  let warned = false;
  const target = attachReject(details, () => {
    if (!settled) {
      rejected = true;
      return;
    }
    if (process.env.NODE_ENV === "production" || warned) return;
    warned = true;
    console.error(
      `${part}: \`details.reject()\` was called after the action settled, so it has no effect. ` +
        "Call it before the action returns or its promise resolves: return or await the " +
        "promise the call depends on (`return save().catch(...)`, not " +
        "`void save().catch(() => details.reject())`).",
    );
  });
  const outcome = (): void => {
    settled = true;
    if (rejected) throw HANDLED_REJECTION;
  };
  let result: unknown;
  try {
    result = call(target);
  } catch (error) {
    settled = true;
    throw error;
  }
  if (!isThenable(result)) {
    outcome();
    return undefined;
  }
  return Promise.resolve(result).then(outcome, (error: unknown) => {
    settled = true;
    throw error;
  });
}
