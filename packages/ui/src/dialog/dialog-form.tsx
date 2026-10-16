"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { RenderProp, StateValue } from "../internal/types.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import { useDialogContext } from "./dialog-context.js";

export interface DialogFormState {
  /** `useFormStatus().pending` of this form, exposed for `className` / `children` functions. */
  readonly pending: boolean;
}

export interface DialogFormProps extends Omit<
  ComponentPropsWithRef<"form">,
  "method" | "action" | "className" | "style" | "children"
> {
  /**
   * React form action (`(formData) => unknown`, may be a Server Function). Passed to the form
   * unwrapped so React's progressive enhancement is kept; the dialog closes with the submitter's
   * `value` as `returnValue` once the action's transition settles. A rejection leaves the dialog
   * open. Without `action` the form renders `method="dialog"`: submitting closes the dialog
   * natively. A string `action` (a URL) is a plain navigating form.
   */
  action?: string | ((formData: FormData) => unknown);
  className?: StateValue<string | undefined, DialogFormState>;
  style?: StateValue<CSSProperties | undefined, DialogFormState>;
  children?: StateValue<ReactNode, DialogFormState>;
  render?: RenderProp<ComponentPropsWithRef<"form">, DialogFormState>;
}

interface FormStatusWatcherProps {
  readonly onPendingChange: (pending: boolean) => void;
  readonly onSettled: () => void;
}

/**
 * Observes React's form channel (design 8.1): `useFormStatus().pending` covers the action's
 * whole transition, including the Suspense wait of what it re-renders. On `true → false` the
 * submission succeeded (a rejection unmounts the form through the nearest Error Boundary, so the
 * edge is never seen).
 */
function FormStatusWatcher({ onPendingChange, onSettled }: FormStatusWatcherProps) {
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

/**
 * A form that completes the dialog. Without `action`: `<form method="dialog">`, so a submit
 * closes the dialog natively (JS-free) with the submitter's `value` as `returnValue`. With a
 * function `action`: `<form action={action}>` (React overrides the method) and a status watcher
 * that closes the dialog once the action has settled, with the submitter's `value`.
 *
 * `DialogFormState.pending` is this form's own status; it is not emitted as `data-pending` and
 * is not folded into any control's `pending` (conventions 2.7). Submit buttons read
 * `useFormStatus()` themselves.
 *
 * Owned keys (conventions 1.2): `method`, `action`.
 */
export function DialogForm({
  action,
  className,
  style,
  children,
  render,
  ...rest
}: DialogFormProps) {
  const ctx = useDialogContext("Dialog.Form");
  const { dialogRef, recordCloseIntent } = ctx;
  const [pending, setPending] = useState(false);
  const submission = useRef<{ event: Event; returnValue: string } | null>(null);
  const watches = typeof action === "function";

  // The submitter's `value` comes from the native `submit` event (capture, before React's
  // handler runs the action).
  const libraryRef = useCallback((form: HTMLFormElement) => {
    const onSubmit = (event: Event) => {
      if (event.target !== form) return;
      const submitter = (event as SubmitEvent).submitter as
        | HTMLButtonElement
        | HTMLInputElement
        | null;
      submission.current = { event, returnValue: submitter?.value ?? "" };
    };
    form.addEventListener("submit", onSubmit, true);
    return () => form.removeEventListener("submit", onSubmit, true);
  }, []);

  const onSettled = useCallback(() => {
    const dialog = dialogRef.current;
    const submitted = submission.current;
    submission.current = null;
    if (dialog === null || !dialog.open) return;
    recordCloseIntent({ reason: "activate", event: submitted?.event });
    dialog.close(submitted?.returnValue ?? "");
  }, [dialogRef, recordCloseIntent]);

  const state: DialogFormState = { pending };

  return useRender<ComponentPropsWithRef<"form">, DialogFormState>({
    defaultElement: "form",
    render,
    state,
    className,
    style,
    children: (s) => (
      <>
        {resolveStateValue(children, s)}
        {watches && <FormStatusWatcher onPendingChange={setPending} onSettled={onSettled} />}
      </>
    ),
    props: rest,
    libraryProps: {
      method: action === undefined ? "dialog" : undefined,
      // React's own type wants `void | Promise<void>`; the library's actions return `unknown`
      // (conventions 2.2) and React ignores the result.
      action: action as ComponentPropsWithRef<"form">["action"],
    },
    ref: libraryRef,
  });
}

DialogForm.displayName = "DialogForm";
