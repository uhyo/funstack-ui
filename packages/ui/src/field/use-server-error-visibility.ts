"use client";
import { useCallback, useState } from "react";

export interface ServerErrorVisibility {
  /** The server's messages for this field are shown. */
  readonly serverShown: boolean;
  /** Stable. The user edited the control: hide the server error until the next settle. */
  readonly dismiss: () => void;
  /**
   * Stable. Whether the value differs from the one the submission in flight sent: if so, that
   * submission's errors stay hidden when it settles (design 3.2 item 2).
   */
  readonly setSuppressNext: (differs: boolean) => void;
}

/**
 * When `Field.Root` shows the server error for its field (design 3.4): shown, dismissed by an
 * edit, re-armed at the enclosing form's settle, and suppressed when it answers a value the user
 * had already changed during the flight.
 *
 * The settle edge is seen in the render that commits the result (the action's result and
 * `useFormStatus`'s NotPending land together), so the next submission's errors are shown in that
 * same commit, before the Form's settle effect focuses them.
 */
export function useServerErrorVisibility(
  formPending: boolean,
  serverMessages: readonly string[],
): ServerErrorVisibility {
  /** The user edited the control since the last settled submission. */
  const [dismissed, setDismissed] = useState(false);
  /**
   * The errors shown now answer a value the user had already changed during their flight
   * (intercepted path). Fixed from one settle to the next, so a hidden stale error stays hidden
   * while the next submission is in flight (the `errors` prop still holds that result).
   */
  const [suppressed, setSuppressed] = useState(false);
  /** The user changed the value during the flight in progress: becomes `suppressed` at its settle. */
  const [suppressNext, setSuppressNext] = useState(false);
  const [previousFormPending, setPreviousFormPending] = useState(formPending);
  if (previousFormPending !== formPending) {
    setPreviousFormPending(formPending);
    if (formPending) {
      setSuppressNext(false);
    } else {
      setDismissed(false);
      setSuppressed(suppressNext);
      setSuppressNext(false);
    }
  }
  const dismiss = useCallback(() => setDismissed(true), []);
  return {
    serverShown: serverMessages.length > 0 && !dismissed && !suppressed,
    dismiss,
    setSuppressNext,
  };
}
