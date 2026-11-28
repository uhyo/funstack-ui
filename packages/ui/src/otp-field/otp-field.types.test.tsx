import { describe, expectTypeOf, it } from "vitest";
import type { Action, ChangeReason, UrgentChangeHandler } from "../internal/types.js";
import { OTPField } from "./index.js";
import type {
  OTPFieldCharset,
  OTPFieldCompleteDetails,
  OTPFieldInputProps,
  OTPFieldInputState,
  OTPFieldRootProps,
  OTPFieldRootState,
  OTPFieldState,
  OTPFieldValueChangeDetails,
} from "./index.js";

/**
 * Type-level checks (design/components/otp-field.md 3). `expectTypeOf` is a no-op at runtime;
 * `pnpm typecheck` (`tsc` over the test files) makes these fail.
 */
describe("OTPField state types (conventions 9.4, 4.1 rule 5)", () => {
  it("Root and Input alias OTPFieldState, which has invalid and required", () => {
    expectTypeOf<OTPFieldRootState>().toEqualTypeOf<OTPFieldState>();
    expectTypeOf<OTPFieldInputState>().toEqualTypeOf<OTPFieldState>();
    expectTypeOf<OTPFieldState["required"]>().toEqualTypeOf<boolean>();
    expectTypeOf<OTPFieldState["invalid"]>().toEqualTypeOf<boolean>();
  });
});

describe("OTPField props", () => {
  it("the text is a fact, the completion a request", () => {
    expectTypeOf<OTPFieldRootProps["onValueChange"]>().toEqualTypeOf<
      UrgentChangeHandler<string, OTPFieldValueChangeDetails> | undefined
    >();
    expectTypeOf<OTPFieldRootProps["completeAction"]>().toEqualTypeOf<
      Action<[value: string, details: OTPFieldCompleteDetails]> | undefined
    >();
    expectTypeOf<OTPFieldCompleteDetails["reason"]>().toEqualTypeOf<ChangeReason>();
    expectTypeOf<OTPFieldRootProps["charset"]>().toEqualTypeOf<OTPFieldCharset | undefined>();
    expectTypeOf<OTPFieldRootProps>().not.toHaveProperty("valueChangeAction");
    expectTypeOf<OTPFieldRootProps>().not.toHaveProperty("whilePending");
    // A Server Function's shape: returns data.
    void (<OTPField.Root length={6} completeAction={async () => ({ ok: true })} />);
  });

  it("length is required; a Slot needs its index", () => {
    // @ts-expect-error `length` is required
    void (<OTPField.Root />);
    // @ts-expect-error `index` is required
    void (<OTPField.Slot />);
    void (<OTPField.Slot index={0}>{({ char }) => char ?? "·"}</OTPField.Slot>);
  });

  it("the Input owns its value and form wiring and has no children", () => {
    expectTypeOf<OTPFieldInputProps>().not.toHaveProperty("value");
    expectTypeOf<OTPFieldInputProps>().not.toHaveProperty("maxLength");
    expectTypeOf<OTPFieldInputProps>().not.toHaveProperty("name");
    expectTypeOf<OTPFieldInputProps>().not.toHaveProperty("onChange");
    expectTypeOf<OTPFieldInputProps>().not.toHaveProperty("children");
    void (<OTPField.Input aria-label="Code" inputMode="text" autoComplete="off" />);
  });
});
