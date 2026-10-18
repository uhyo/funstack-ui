import type { Ref } from "react";
import { describe, expectTypeOf, it } from "vitest";
import { NumberField } from "./index.js";
import type {
  NumberFieldInputProps,
  NumberFieldRootProps,
  NumberFieldState,
  NumberFieldValueChangeDetails,
} from "./index.js";

/**
 * Type-level checks (design/components/number-field.md 14.1 "Types"). `expectTypeOf` is a no-op
 * at runtime; `pnpm typecheck` and vitest's typecheck make these fail.
 */
describe("NumberField types", () => {
  it("value / defaultValue accept number | null; both actions receive it", () => {
    const element = (
      <NumberField.Root
        value={null}
        valueChangeAction={(next, details) => {
          expectTypeOf(next).toEqualTypeOf<number | null>();
          expectTypeOf(details).toEqualTypeOf<NumberFieldValueChangeDetails>();
        }}
        valueCommitAction={(next) => {
          expectTypeOf(next).toEqualTypeOf<number | null>();
        }}
      >
        {(state) => {
          expectTypeOf(state).toEqualTypeOf<NumberFieldState>();
          return null;
        }}
      </NumberField.Root>
    );
    void element;
    expectTypeOf<NumberFieldRootProps["defaultValue"]>().toEqualTypeOf<number | null | undefined>();
  });

  it("the source union", () => {
    expectTypeOf<NumberFieldValueChangeDetails["source"]>().toEqualTypeOf<
      "input" | "increment" | "decrement" | "keyboard" | "wheel" | null
    >();
  });

  it("hiddenInputRef is a Ref<HTMLInputElement>", () => {
    expectTypeOf<NumberFieldInputProps["hiddenInputRef"]>().toEqualTypeOf<
      Ref<HTMLInputElement> | undefined
    >();
  });

  it("transition, inputValue, aria-valuenow and the constraints on Input are not props", () => {
    // @ts-expect-error: no `transition` prop (design 11).
    void (<NumberField.Root transition="none" />);
    // @ts-expect-error: no `inputValue` triple in v1 (design 13).
    void (<NumberField.Root inputValue="1" />);
    // @ts-expect-error: no `role="spinbutton"` (design 8.2).
    void (<NumberField.Root role="spinbutton" />);
    // @ts-expect-error: `required` belongs on the Root (the hidden input).
    void (<NumberField.Input required />);
    // @ts-expect-error: `min` belongs on the Root (the hidden input).
    void (<NumberField.Input min={1} />);
    // @ts-expect-error: `name` belongs on the Root (the hidden input).
    void (<NumberField.Input name="q" />);
  });
});
