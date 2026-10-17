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
   * `value` as `returnValue` once the action's transition settles (see `closeOnSettle`): in
   * library mode through the Root (`openChangeAction(false)` awaited, view transition if set),
   * in JS-free mode with `close(value)`. A rejection leaves the dialog open. Without `action`
   * the form renders `method="dialog"`: submitting closes the dialog, natively in JS-free mode
   * and through the Root in library mode (a `preventDefault()` in your own `onSubmit` blocks
   * both; `stopPropagation()` there leaves the close to the browser, notified as a dismissal).
   * A string `action` (a URL) is a plain navigating form.
   */
  action?: string | ((formData: FormData) => unknown);
  /**
   * With a function `action`: close the dialog once the action's transition settles without
   * throwing. Default `true`.
   *
   * Any result that does not throw counts as success, including a `useActionState`-style result
   * that reports validation errors: with the default the dialog closes and those errors are never
   * seen. Throw to keep the dialog open, or set `closeOnSettle={false}` and close it yourself:
   * a `Dialog.Close`, a submitter with `formMethod="dialog"`, or a controlled `open`.
   *
   * The dialog is not closed either when it was closed (Escape, a Close part) while the action
   * ran, also if the user re-opened it meanwhile.
   */
  closeOnSettle?: boolean;
  /**
   * Only with a string `action` (a navigating form, for example `"post"`). Owned otherwise:
   * `"dialog"` without `action`, React's own with a function `action`.
   */
  method?: ComponentPropsWithRef<"form">["method"];
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
 * closes the dialog with the submitter's `value` as `returnValue` (natively in JS-free mode;
 * in library mode the Popup cancels the submission and closes through the Root). With a
 * function `action`: `<form action={action}>` (React overrides the method) and a status watcher
 * that closes the dialog once the action has settled, with the submitter's `value`, unless
 * `closeOnSettle` is `false` or the dialog was closed while the action ran.
 *
 * `DialogFormState.pending` is this form's own status; it is not emitted as `data-pending` and
 * is not folded into any control's `pending` (conventions 2.7). Submit buttons read
 * `useFormStatus()` themselves.
 *
 * Owned keys (conventions 1.2): `method` (except with a string `action`), `action`.
 */
export function DialogForm({
  action,
  closeOnSettle = true,
  method,
  className,
  style,
  children,
  render,
  ...rest
}: DialogFormProps) {
  const ctx = useDialogContext("Dialog.Form");
  const { dialogRef, recordCloseIntent, requestClose } = ctx;
  const isLibrary = ctx.mode === "library";
  const [pending, setPending] = useState(false);
  const submission = useRef<{ event: Event; returnValue: string } | null>(null);
  // The dialog closed after the last submit (Escape, a Close part): the settle must not close it
  // again, also when the user re-opened it meanwhile (the review's walkthrough 11.8 variant).
  const closedSinceSubmit = useRef(false);
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
      closedSinceSubmit.current = false;
    };
    const dialog = form.closest("dialog");
    const onClose = (event: Event) => {
      if (event.target === dialog) closedSinceSubmit.current = true;
    };
    form.addEventListener("submit", onSubmit, true);
    dialog?.addEventListener("close", onClose);
    return () => {
      form.removeEventListener("submit", onSubmit, true);
      dialog?.removeEventListener("close", onClose);
    };
  }, []);

  const onSettled = useCallback(() => {
    const dialog = dialogRef.current;
    const submitted = submission.current;
    submission.current = null;
    if (!closeOnSettle || closedSinceSubmit.current) return;
    if (dialog === null || !dialog.open) return;
    const returnValue = submitted?.returnValue ?? "";
    if (isLibrary) {
      // A library-owned close (design 2.3): `openChangeAction(false)` awaited, then
      // `close(returnValue)` in the commit, inside the view transition if set.
      requestClose(submitted?.event, "activate", returnValue);
      return;
    }
    recordCloseIntent({ reason: "activate", event: submitted?.event });
    dialog.close(returnValue);
  }, [closeOnSettle, dialogRef, isLibrary, recordCloseIntent, requestClose]);

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
      method: action === undefined ? "dialog" : typeof action === "string" ? method : undefined,
      // React's own type wants `void | Promise<void>`; the library's actions return `unknown`
      // (conventions 2.2) and React ignores the result.
      action: action as ComponentPropsWithRef<"form">["action"],
    },
    ref: libraryRef,
  });
}

DialogForm.displayName = "DialogForm";
