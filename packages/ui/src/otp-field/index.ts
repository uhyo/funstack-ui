import { OTPFieldInput } from "./otp-field-input.js";
import { OTPFieldRoot } from "./otp-field-root.js";
import { OTPFieldSlot } from "./otp-field-slot.js";

/**
 * OTPField: a field for a short code the user received elsewhere (an SMS or email code, an
 * authenticator's digits, a PIN). `Root` (`div`, owns the text) > `Input` (the one
 * `<input autocomplete="one-time-code">`, covering the Root with transparent text) + `Slot`s
 * (`aria-hidden` spans that draw one character each, `data-filled`, `data-active`). The text is
 * urgent (`value` / `defaultValue` / `onValueChange`); a complete code runs `completeAction` in the
 * Root's transition with `data-pending`, and `submitOnComplete` submits the Input's form.
 *
 * @see https://ui.funstack.work/components/otp-field
 */
export const OTPField = {
  Root: OTPFieldRoot,
  Input: OTPFieldInput,
  Slot: OTPFieldSlot,
} as const;

export type {
  OTPFieldRootProps,
  OTPFieldState,
  OTPFieldValueChangeDetails,
  OTPFieldCompleteDetails,
} from "./otp-field-root.js";
export type { OTPFieldInputProps } from "./otp-field-input.js";
export type { OTPFieldSlotProps, OTPFieldSlotState } from "./otp-field-slot.js";
export type { OTPFieldCharset } from "./otp-field-filter.js";
