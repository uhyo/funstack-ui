"use client";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export interface FormStatusWatcherProps {
  readonly onPendingChange: (pending: boolean) => void;
  readonly onSettled: () => void;
}

/**
 * Observes React's form channel (Dialog design 8.1, Field/Form design 3.2): rendered inside a
 * `<form>`, `useFormStatus().pending` covers the action's whole transition, including the
 * Suspense wait of what it re-renders. On `true → false` the submission settled without throwing
 * (a rejection unmounts the form through the nearest Error Boundary, so the edge is never seen).
 * Used by `Dialog.Form` and `Form.Root`.
 */
export function FormStatusWatcher({ onPendingChange, onSettled }: FormStatusWatcherProps) {
  const { pending } = useFormStatus();
  const previous = useRef(false);
  useEffect(() => {
    const was = previous.current;
    previous.current = pending;
    if (was === pending) return;
    onPendingChange(pending);
    if (was && !pending) onSettled();
  }, [pending, onPendingChange, onSettled]);
  return null;
}
