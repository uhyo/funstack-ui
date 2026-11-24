// The fallback route of a rejection React would drop (conventions 2.4), shared by the two action
// hooks, Form.Root and `callUrgentHandler`. The hook suites cover when it is called.
import { describe, expect, it, vi } from "vitest";
import { reportDropped } from "./report-dropped.js";

describe("reportDropped", () => {
  it("passes the error to the global reportError", () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("dropped");
    reportDropped(err);
    expect(reportError).toHaveBeenCalledExactlyOnceWith(err);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("falls back to console.error where reportError does not exist", () => {
    vi.stubGlobal("reportError", undefined);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("dropped");
    reportDropped(err);
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(err);
  });
});
