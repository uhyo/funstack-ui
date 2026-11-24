// The rule of every `on*` handler (conventions 2.1, #148), implemented once. The component suites
// cover the three call sites (onOpenChange, a toast's onClose, onInputValueChange).
import { describe, expect, it, vi } from "vitest";
import { callUrgentHandler } from "./call-urgent-handler.js";

describe("callUrgentHandler", () => {
  it("calls the handler synchronously with the arguments", () => {
    const handler = vi.fn();
    callUrgentHandler(handler, false, { reason: "dismiss" });
    expect(handler).toHaveBeenCalledExactlyOnceWith(false, { reason: "dismiss" });
  });

  it("a missing handler is a no-op", () => {
    expect(() => callUrgentHandler(undefined, 1)).not.toThrow();
  });

  it("a synchronous throw goes to reportError and does not escape", () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const err = new Error("bug");
    expect(() =>
      callUrgentHandler(() => {
        throw err;
      }),
    ).not.toThrow();
    expect(reportError).toHaveBeenCalledExactlyOnceWith(err);
  });

  it("a returned promise is not awaited; its rejection goes to reportError", async () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const err = new Error("rejected");
    let reject!: (e: unknown) => void;
    const result = callUrgentHandler(
      () =>
        new Promise((_, r) => {
          reject = r;
        }),
    );
    expect(result).toBeUndefined();
    expect(reportError).not.toHaveBeenCalled();
    reject(err);
    await Promise.resolve();
    await Promise.resolve();
    expect(reportError).toHaveBeenCalledExactlyOnceWith(err);
  });

  it("a resolved promise or any other value reports nothing", async () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    callUrgentHandler(() => Promise.resolve(1));
    callUrgentHandler(() => 1);
    callUrgentHandler(() => ({ then: 1 }));
    await Promise.resolve();
    expect(reportError).not.toHaveBeenCalled();
  });

  it("falls back to console.error where reportError does not exist", () => {
    vi.stubGlobal("reportError", undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("bug");
    callUrgentHandler(() => {
      throw err;
    });
    expect(error).toHaveBeenCalledWith(err);
  });
});
