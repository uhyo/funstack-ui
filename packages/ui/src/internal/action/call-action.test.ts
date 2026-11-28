// `details.reject()` (conventions 2.4.1): the virtual property and `callAction`'s contract. The
// hooks' rows (what a rejection does to state and continuations) are in their own test files.
import { afterEach, describe, expect, it, vi } from "vitest";
import { deferred, silenceErrors } from "../../__tests__/helpers.js";
import type { Rejectable } from "../types.js";
import { createActionDetails } from "./action-details.js";
import { callAction, isHandledRejection } from "./call-action.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Calls `fn` with details that have `reject`, the way the hooks call an action. */
function capture(fields: object = { reason: "activate" }) {
  const base = createActionDetails(new Event("click"), fields);
  let seen!: typeof base & Rejectable;
  const result = callAction("Probe", base, (d) => {
    seen = d;
  });
  return { base, seen, result };
}

/** How a call ended: pass a function for a call that may throw synchronously. */
async function outcome(
  call: (() => Promise<void> | undefined) | Promise<void> | undefined,
): Promise<"resolved" | "handled" | unknown> {
  try {
    await (typeof call === "function" ? call() : call);
    return "resolved";
  } catch (error) {
    return isHandledRejection(error) ? "handled" : error;
  }
}

describe("details.reject: a virtual property of an action's details", () => {
  it("is a function served like `event`: `in`, but not own, not enumerable, not serialised", () => {
    const { seen } = capture({ reason: "activate" });
    expect(typeof seen.reject).toBe("function");
    expect("reject" in seen).toBe(true);
    expect(Object.hasOwn(seen, "reject")).toBe(false);
    expect(Object.keys(seen)).toEqual(["reason"]);
    expect({ ...seen }).toEqual({ reason: "activate" });
    // A Server Function receives the serialised details: no `reject` crosses the wire.
    expect(JSON.stringify(seen)).toBe('{"reason":"activate"}');
    expect("reject" in { ...seen }).toBe(false);
  });

  it("the details object is the one the library built (maps keyed by it still find it)", () => {
    const { base, seen } = capture();
    expect(seen).toBe(base);
  });

  it("a handler's details has none", () => {
    const details = createActionDetails(new Event("click"), {}) as { reject?: unknown };
    expect(details.reject).toBeUndefined();
    expect("reject" in details).toBe(false);
  });

  it("refuses writes in development, as `event` does", () => {
    const { seen } = capture({});
    const writable = seen as unknown as { reject: unknown };
    expect(() => {
      writable.reject = () => {};
    }).toThrow(TypeError);
    expect(() => Object.defineProperty(seen, "reject", { value: 1 })).toThrow(TypeError);
    expect(Object.keys(seen)).toEqual([]);
    expect(typeof seen.reject).toBe("function");
  });

  it("ignores an assignment in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { seen } = capture({});
    expect(Reflect.set(seen, "reject", 1)).toBe(true);
    expect(Reflect.defineProperty(seen, "reject", { value: 1, configurable: true })).toBe(false);
    expect(typeof seen.reject).toBe("function");
  });

  it("does not depend on `this`: a destructured `reject` works", async () => {
    const base = createActionDetails(undefined, {});
    const result = () =>
      callAction("Probe", base, ({ reject }) => {
        reject();
      });
    expect(await outcome(result)).toBe("handled");
  });

  it("a plain details object is copied into one that has `reject`", async () => {
    let seen!: Rejectable & { item: string };
    const result = () =>
      callAction("Probe", { event: undefined, item: "a" }, (d) => {
        seen = d;
        d.reject();
      });
    expect(await outcome(result)).toBe("handled");
    expect(Object.keys(seen)).toEqual(["item"]);
    expect(seen.item).toBe("a");
  });
});

describe("callAction: the contract of conventions 2.4.1", () => {
  it("a synchronous action that resolves: nothing thrown, `undefined` returned", () => {
    const { result } = capture();
    expect(result).toBeUndefined();
  });

  it("a synchronous action that calls reject() before returning: the sentinel, synchronously", () => {
    const base = createActionDetails(undefined, {});
    let thrown: unknown;
    try {
      callAction("Probe", base, (d) => {
        d.reject();
      });
    } catch (error) {
      thrown = error;
    }
    expect(isHandledRejection(thrown)).toBe(true);
    expect(isHandledRejection(new Error("x"))).toBe(false);
  });

  it("an async action: read when the promise resolves, not when reject() is called", async () => {
    const run = deferred();
    let details!: Rejectable;
    const result = callAction("Probe", createActionDetails(undefined, {}), async (d) => {
      details = d;
      await run.promise;
    });
    const settledAt = vi.fn();
    const watched = outcome(result).then((o) => {
      settledAt(o);
      return o;
    });
    details.reject();
    await Promise.resolve();
    await Promise.resolve();
    expect(settledAt).not.toHaveBeenCalled();
    run.resolve();
    expect(await watched).toBe("handled");
  });

  it("called twice is called once", async () => {
    const result = callAction("Probe", createActionDetails(undefined, {}), async (d) => {
      d.reject();
      d.reject();
    });
    expect(await outcome(result)).toBe("handled");
  });

  it("a throw after reject() wins: the real error propagates", async () => {
    const error = new Error("failed");
    const result = callAction("Probe", createActionDetails(undefined, {}), async (d) => {
      d.reject();
      throw error;
    });
    expect(await outcome(result)).toBe(error);
    const sync = (): unknown =>
      callAction("Probe", createActionDetails(undefined, {}), (d) => {
        d.reject();
        throw error;
      });
    expect(sync).toThrow(error);
  });

  it("called after the action settled: no effect, and one development warning naming the part", async () => {
    const error = silenceErrors();
    let details!: Rejectable;
    const result = callAction("Toggle", createActionDetails(undefined, {}), async (d) => {
      details = d;
    });
    expect(await outcome(result)).toBe("resolved");
    details.reject();
    details.reject();
    expect(error).toHaveBeenCalledOnce();
    expect(String(error.mock.calls[0]![0])).toMatch(
      /^Toggle: `details\.reject\(\)` was called after/,
    );
  });

  it("the usual late call (`void promise.catch(() => details.reject())`) warns", async () => {
    const error = silenceErrors();
    const save = deferred();
    const result = callAction("Checkbox", createActionDetails(undefined, {}), (d) => {
      void save.promise.catch(() => d.reject());
    });
    expect(result).toBeUndefined();
    save.reject(new Error("save failed"));
    await Promise.resolve();
    await Promise.resolve();
    expect(error).toHaveBeenCalledOnce();
  });

  it("no late-call warning in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = silenceErrors();
    let details!: Rejectable;
    callAction("Toggle", createActionDetails(undefined, {}), (d) => {
      details = d;
    });
    details.reject();
    expect(error).not.toHaveBeenCalled();
  });

  it("a library wrapper that calls the consumer through callAction again: the inner reject wins", async () => {
    const base = createActionDetails(undefined, {});
    const result = () =>
      callAction("Outer", base, (outer) =>
        callAction("Inner", outer, (inner) => {
          expect(inner).toBe(base);
          inner.reject();
        }),
      );
    expect(await outcome(result)).toBe("handled");
  });
});
