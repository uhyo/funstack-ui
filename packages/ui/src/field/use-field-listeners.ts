"use client";
import { useLayoutEffect, useMemo } from "react";
import type { RefObject } from "react";
import type { FieldControlRegistration } from "../internal/field-context.js";
import { collectInvalid } from "../internal/focus-first-invalid.js";
import { useFormOwnerEvent } from "../internal/use-form-owner-event.js";
import { focusTargetOf, supportsUserInvalid } from "../internal/validity.js";
import type { ValidatableElement } from "../internal/validity.js";

/** What `Field.Root`'s `refresh` takes (see field-root.tsx). */
export interface RefreshOptions {
  /** The user edited the control: the server message is dropped from the slot at once. */
  readonly dismiss?: boolean;
  /** After a form reset: the user-validity flag is clear again. */
  readonly reset?: boolean;
}

export interface FieldListenersOptions {
  /** The registered control, current (handlers read it). */
  readonly controlRef: RefObject<FieldControlRegistration | null>;
  /** The registered control's element as of this render (the listeners follow it). */
  readonly element: HTMLElement | null;
  /** Stable. Re-reads the slot and the mirror; returns the messages shown. */
  readonly refresh: (options?: RefreshOptions) => readonly string[];
  /** Stable. Hides the shown server error (an edit). */
  readonly dismiss: () => void;
  /** From `useServerErrorVisibility`: cleared by a new submission. */
  readonly setSuppressNext: (differs: boolean) => void;
  /** jsdom fallback for `:user-invalid`: set by `invalid`. */
  readonly attempted: RefObject<boolean>;
  /** Mounted `Field.Error` parts: with one, a submission's `invalid` is collected for focus. */
  readonly errorCount: RefObject<number>;
}

/**
 * `Field.Root`'s native listeners (design 2.2, 2.5, 3.2): the control's own `input` / `change`
 * (an edit dismisses the server error), `focusout` and `invalid`, in the capture phase so a
 * group's members are seen on its fieldset; and the form owner's `input` / `change` (another
 * field's edit re-runs `validate`), `submit` and `reset`.
 */
export function useFieldListeners(options: FieldListenersOptions): void {
  const { controlRef, element, refresh, dismiss, setSuppressNext, attempted, errorCount } = options;

  useLayoutEffect(() => {
    if (element === null) return;
    const onEdit = () => {
      dismiss();
      refresh({ dismiss: true });
    };
    const onBlur = () => refresh();
    const onInvalid = (event: Event) => {
      const target = event.target as ValidatableElement;
      // A submission attempt sets user validity before validating; `checkValidity()` and
      // `reportValidity()` do not (design 2.5). The fallback cannot tell them apart.
      const attempt = supportsUserInvalid() ? target.matches(":user-invalid") : true;
      if (!supportsUserInvalid()) attempted.current = true;
      if (attempt && errorCount.current > 0) {
        event.preventDefault();
        const messages = refresh();
        collectInvalid(focusTargetOf(element), messages.join(" "));
        return;
      }
      refresh();
    };
    element.addEventListener("input", onEdit, true);
    element.addEventListener("change", onEdit, true);
    element.addEventListener("focusout", onBlur, true);
    element.addEventListener("invalid", onInvalid, true);
    return () => {
      element.removeEventListener("input", onEdit, true);
      element.removeEventListener("change", onEdit, true);
      element.removeEventListener("focusout", onBlur, true);
      element.removeEventListener("invalid", onInvalid, true);
    };
  }, [element, refresh, dismiss, attempted, errorCount]);

  const ownerRef = useMemo<RefObject<Element | null>>(
    () => ({
      get current() {
        return controlRef.current?.element ?? null;
      },
      set current(_ignored) {},
    }),
    [controlRef],
  );
  const onOwnerEdit = (event: Event) => {
    const target = event.target;
    if (target instanceof Node && controlRef.current?.element.contains(target) === true) return;
    refresh();
  };
  useFormOwnerEvent(ownerRef, "input", onOwnerEdit);
  useFormOwnerEvent(ownerRef, "change", onOwnerEdit);
  // A new submission sends the current values: nothing differs from it yet (a queued second
  // submit arrives while the status stays pending, so the pending edge alone would miss it).
  useFormOwnerEvent(ownerRef, "submit", () => {
    setSuppressNext(false);
  });
  // A reset clears the user-validity flag, re-read when the controls hold their reset values.
  useFormOwnerEvent(ownerRef, "reset", (event) => {
    queueMicrotask(() => {
      if (event.defaultPrevented) return;
      refresh({ reset: true });
    });
  });
}
