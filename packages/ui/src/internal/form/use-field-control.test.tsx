// `useFieldValueChange` (design/components/field-form.md 2.1): the Field hears a value change the
// DOM made without an `input` / `change` event, once per real change. #157 safety net
// (memo/reviewer/refactor-test-safety.md FC3): the change detection had no row of its own.
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FieldContext } from "./field-context.js";
import type { FieldContextValue } from "./field-context.js";
import { useFieldValueChange } from "./use-field-control.js";

function Control({ value, takeEdit }: { value: unknown; takeEdit?: () => boolean }) {
  useFieldValueChange(value, takeEdit);
  return null;
}

function setup(first: unknown, takeEdit?: () => boolean) {
  const notifyChange = vi.fn<(edit: boolean) => void>();
  // Only `notifyChange` is read by the hook.
  const field = { notifyChange } as unknown as FieldContextValue;
  const ui = (value: unknown) => (
    <FieldContext value={field}>
      <Control value={value} takeEdit={takeEdit} />
    </FieldContext>
  );
  const view = render(ui(first));
  return { notifyChange, rerender: (value: unknown) => view.rerender(ui(value)) };
}

describe("useFieldValueChange", () => {
  it("notifies nothing at mount or for a commit with the same value", () => {
    const { notifyChange, rerender } = setup("a");
    expect(notifyChange).not.toHaveBeenCalled();
    rerender("a");
    rerender("a");
    expect(notifyChange).not.toHaveBeenCalled();
  });

  it("notifies once per change, compared with the last committed value", () => {
    const { notifyChange, rerender } = setup("a");
    rerender("b");
    expect(notifyChange).toHaveBeenCalledTimes(1);
    rerender("b");
    expect(notifyChange).toHaveBeenCalledTimes(1);
    rerender("a");
    expect(notifyChange).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
  ] as const)(
    "a first value of %s (an empty Combobox) still notifies the first change",
    (_, first) => {
      const { notifyChange, rerender } = setup(first);
      rerender(first);
      expect(notifyChange).not.toHaveBeenCalled();
      rerender("jp");
      expect(notifyChange).toHaveBeenCalledTimes(1);
      rerender(first);
      expect(notifyChange).toHaveBeenCalledTimes(2);
    },
  );

  it("compares with Object.is: NaN to NaN is no change", () => {
    const { notifyChange, rerender } = setup(Number.NaN);
    rerender(Number.NaN);
    expect(notifyChange).not.toHaveBeenCalled();
  });

  it("passes takeEdit's answer, read only for a change", () => {
    const takeEdit = vi.fn(() => true);
    const { notifyChange, rerender } = setup("a", takeEdit);
    rerender("a");
    expect(takeEdit).not.toHaveBeenCalled();
    rerender("b");
    expect(takeEdit).toHaveBeenCalledTimes(1);
    expect(notifyChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("without takeEdit a change is not an edit", () => {
    const { notifyChange, rerender } = setup("a");
    rerender("b");
    expect(notifyChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("outside a Field it does nothing (and does not throw)", () => {
    const view = render(<Control value="a" />);
    expect(() => view.rerender(<Control value="b" />)).not.toThrow();
  });
});
