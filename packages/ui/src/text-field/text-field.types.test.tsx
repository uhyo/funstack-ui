import type { ChangeAction, ChangeReason } from "../internal/types.js";
import { describe, expectTypeOf, it } from "vitest";
import { TextField } from "./index.js";
import type { TextFieldProps, TextFieldState, TextFieldValueCommitDetails } from "./index.js";

/**
 * Type-level checks (design/components/text-field.md 14 "Types"). `expectTypeOf` is a no-op at
 * runtime; `pnpm typecheck` (`tsc` over the test files) makes these fail.
 */
describe("TextField types", () => {
  it("value is a string; valueCommitAction is a ChangeAction<string, details>", () => {
    expectTypeOf<TextFieldProps["value"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TextFieldProps["defaultValue"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TextFieldProps["valueCommitAction"]>().toEqualTypeOf<
      ChangeAction<string, TextFieldValueCommitDetails> | undefined
    >();
    const element = (
      <TextField
        valueCommitAction={async (next, details) => {
          expectTypeOf(next).toEqualTypeOf<string>();
          expectTypeOf(details.reason).toEqualTypeOf<ChangeReason>();
          expectTypeOf(details.event).toEqualTypeOf<Event | undefined>();
        }}
        className={(state) => {
          expectTypeOf(state).toEqualTypeOf<TextFieldState>();
          return undefined;
        }}
        render={<textarea rows={4} />}
      />
    );
    void element;
  });

  it("state.invalid is a boolean (conventions 4.1 rule 5)", () => {
    expectTypeOf<TextFieldState["invalid"]>().toEqualTypeOf<boolean>();
  });

  it("no step action, no handler, no transition; the library's handlers are not accepted", () => {
    expectTypeOf<TextFieldProps>().not.toHaveProperty("valueChangeAction");
    expectTypeOf<TextFieldProps>().not.toHaveProperty("onValueChange");
    expectTypeOf<TextFieldProps>().not.toHaveProperty("transition");
    expectTypeOf<TextFieldProps>().not.toHaveProperty("onChange");
    expectTypeOf<TextFieldProps>().not.toHaveProperty("onKeyDown");
    expectTypeOf<TextFieldProps>().not.toHaveProperty("onBlur");
    expectTypeOf<TextFieldProps>().not.toHaveProperty("aria-invalid");
    // @ts-expect-error onChange is the library's
    void (<TextField onChange={() => {}} />);
    // Other handlers pass through.
    void (<TextField onInput={() => {}} onFocus={() => {}} onKeyUp={() => {}} />);
  });
});
