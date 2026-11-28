import type { Ref } from "react";
import { describe, expectTypeOf, it } from "vitest";
import { NumberField } from "./index.js";
import type {
  NumberFieldInputProps,
  NumberFieldInputState,
  NumberFieldLabelState,
  NumberFieldRootProps,
  NumberFieldRootState,
  NumberFieldSource,
  NumberFieldState,
  NumberFieldValueChangeDetails,
  NumberFieldValueCommitDetails,
} from "./index.js";

/**
 * Type-level checks (design/components/number-field.md 14.1 "Types"). `expectTypeOf` is a no-op
 * at runtime; `pnpm typecheck` (`tsc` over the test files) makes these fail.
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
        valueCommitAction={(next, details) => {
          expectTypeOf(next).toEqualTypeOf<number | null>();
          // A commit action has its own details type (conventions 9.4).
          expectTypeOf(details).toEqualTypeOf<NumberFieldValueCommitDetails>();
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

  it("the source union, exported as NumberFieldSource", () => {
    expectTypeOf<NumberFieldSource>().toEqualTypeOf<
      "input" | "increment" | "decrement" | "keyboard" | "wheel"
    >();
    expectTypeOf<
      NumberFieldValueChangeDetails["source"]
    >().toEqualTypeOf<NumberFieldSource | null>();
    expectTypeOf<
      NumberFieldValueCommitDetails["source"]
    >().toEqualTypeOf<NumberFieldSource | null>();
  });

  it("every part has a state type; state.invalid is a boolean", () => {
    expectTypeOf<NumberFieldRootState>().toEqualTypeOf<NumberFieldState>();
    expectTypeOf<NumberFieldInputState>().toEqualTypeOf<NumberFieldState>();
    expectTypeOf<NumberFieldLabelState>().toEqualTypeOf<NumberFieldState>();
    expectTypeOf<NumberFieldState["invalid"]>().toEqualTypeOf<boolean>();
  });

  it("composition handlers pass through on Input", () => {
    void (<NumberField.Input onCompositionStart={() => {}} onCompositionEnd={() => {}} />);
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
