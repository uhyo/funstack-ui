// A prop fixed at mount, with its once-per-instance dev warning. The component suites cover the
// call sites (the overlay Roots' and Accordion's mode, the exclusive flag of ToggleGroup and
// Accordion).
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMountFixed } from "./use-mount-fixed.js";

function Probe({ value }: { value: string }) {
  const fixed = useMountFixed(value, "Probe: `value` changed after mount.");
  return <output>{fixed}</output>;
}

describe("useMountFixed", () => {
  it("keeps the first render's value", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<Probe value="a" />);
    rerender(<Probe value="b" />);
    expect(screen.getByRole("status")).toHaveTextContent("a");
  });

  it("does not warn while the value stays the same", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<Probe value="a" />);
    rerender(<Probe value="a" />);
    expect(error).not.toHaveBeenCalled();
  });

  it("warns once per instance when the value changes, also when it changes back and again", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<Probe value="a" />);
    rerender(<Probe value="b" />);
    rerender(<Probe value="a" />);
    rerender(<Probe value="c" />);
    expect(error).toHaveBeenCalledExactlyOnceWith("Probe: `value` changed after mount.");
  });

  it("logs nothing when the message is false", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    function Quiet({ value }: { value: string }) {
      return <output>{useMountFixed(value, false)}</output>;
    }
    const { rerender } = render(<Quiet value="a" />);
    rerender(<Quiet value="b" />);
    expect(error).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("a");
  });
});
