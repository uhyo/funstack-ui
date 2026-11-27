"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

export interface ServerErrorVisibility {
  /** The server's messages for this field are shown. */
  readonly serverShown: boolean;
  /** Stable. The user edited the control: hide the server error until the next settle. */
  readonly dismiss: () => void;
  /**
   * Stable. Records an edit now and returns the state write that applies it, for a caller that
   * must not write state yet (an event still being dispatched, design 2.4). Applied after the next
   * settle, an edit recorded before it dismisses nothing: the settle re-armed the errors.
   */
  readonly recordEdit: () => () => void;
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
  /** Settles seen so far: an edit dismisses the errors of the settle it was made after. */
  const [settles, setSettles] = useState(0);
  /**
   * The `settles` count at the user's last edit (`-1`: none). Dismissed while it equals `settles`.
   * A count, not a flag: an edit applied late (after its event's dispatch) and React's rebase of
   * that update over a settle's render-phase reset both leave a stale count, never a stale flag.
   */
  const [editedAt, setEditedAt] = useState(-1);
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
      setSettles(settles + 1);
      setSuppressed(suppressNext);
      setSuppressNext(false);
    }
  }
  // The committed count, read when an edit is recorded.
  const committedSettles = useRef(settles);
  useLayoutEffect(() => {
    committedSettles.current = settles;
  });
  const recordEdit = useCallback(() => {
    const at = committedSettles.current;
    return () => setEditedAt(at);
  }, []);
  const dismiss = useCallback(() => recordEdit()(), [recordEdit]);
  return {
    serverShown: serverMessages.length > 0 && editedAt !== settles && !suppressed,
    dismiss,
    recordEdit,
    setSuppressNext,
  };
}
