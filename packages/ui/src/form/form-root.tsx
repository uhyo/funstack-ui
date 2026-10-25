"use client";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import type { ComponentPropsWithRef, CSSProperties, FormEvent, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import { sortByDocumentOrder } from "../internal/dom-order.js";
import { FormContext } from "../internal/field-context.js";
import type { FormContextValue, FormFieldRegistration } from "../internal/field-context.js";
import { announce } from "../internal/announce.js";
import { FormStatusWatcher } from "../internal/form-status-watcher.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useLatest } from "../internal/use-latest.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import { hasAnyError } from "../internal/validity.js";
import type { FormErrors } from "../internal/validity.js";

const isDev = process.env.NODE_ENV !== "production";

export type { FieldErrorValue, FormErrors } from "../internal/validity.js";

export interface FormRootState {
  /** A submission is in flight: the Form's own transition, or the form's status (`useFormStatus`), including the Suspense wait of the result. */
  readonly pending: boolean;
}

export interface FormRootProps extends Omit<
  ComponentPropsWithRef<"form">,
  "onSubmit" | "method" | "action" | "className" | "style" | "children"
> {
  /**
   * React form action (`(formData) => unknown`: a Server Function, a `useActionState` dispatch,
   * or a client function), rendered on the form unwrapped so React's progressive enhancement is
   * kept, and run by the Form inside its own transition after hydration (no automatic reset; see
   * `autoReset`). A string is a navigating form. A submitter with its own `formAction` is left to
   * React (automatic reset applies to it).
   */
  action?: string | ((formData: FormData) => unknown);
  /**
   * Field errors keyed by field `name` (usually `state.errors` from `useActionState`). Each
   * `Field.Root` with that name shows its entry, writes it into the control's custom validity,
   * and clears it on the user's next edit; the next settled submission shows the new entries.
   * Errors present at mount are shown without moving focus.
   */
  errors?: FormErrors;
  /**
   * Reset the form (`form.reset()`) when a submission the Form ran settles with no non-empty
   * entry in `errors`. Default `true`. A submission that reports errors never resets, so the
   * user's input, `:user-invalid` and custom validity stay. `false`: never reset.
   */
  autoReset?: boolean;
  /** Only with a string `action`. Owned otherwise (React's own with a function action). */
  method?: ComponentPropsWithRef<"form">["method"];
  className?: StateValue<string | undefined, FormRootState>;
  style?: StateValue<CSSProperties | undefined, FormRootState>;
  children?: StateValue<ReactNode, FormRootState>;
  /** Must render a `<form>`. */
  render?: RenderProp<ComponentPropsWithRef<"form">, FormRootState>;
}

interface Submission {
  /** The Form ran the action itself (`onSubmit` + its own transition). */
  readonly intercepted: boolean;
  readonly formData: FormData | null;
}

/**
 * A `<form>` that runs its function `action` itself after hydration (design/components/field-form.md
 * 3): `onSubmit` cancels the native submission, so react-dom neither runs the action nor schedules
 * its automatic reset, and the Form awaits `action(formData)` inside its own transition, which
 * still starts the form's status (`useFormStatus`). The action stays rendered unwrapped on the
 * element, so a Server Function posts before hydration.
 *
 * When a submission settles, the Form focuses the first Field that shows a server error (from
 * `errors`), or, when `errors` has no entry and `autoReset` is on, resets the form.
 *
 * Owned keys (conventions 1.2): `action`, `method` (except with a string `action`), `onSubmit`,
 * `data-pending`.
 */
export function FormRoot({
  action,
  errors,
  autoReset = true,
  method,
  className,
  style,
  children,
  render,
  ...rest
}: FormRootProps) {
  const [isPending, startTransition] = useTransition();
  const [statusPending, setStatusPending] = useState(false);
  const pending = isPending || statusPending;

  const formRef = useRef<HTMLFormElement | null>(null);
  const submission = useRef<Submission | null>(null);
  const fields = useRef(new Set<FormFieldRegistration>());
  const latest = useLatest({ errors, autoReset });
  const isFunction = typeof action === "function";

  // A native capture listener sees every submission, React's path included (a submitter with its
  // own `formAction`), before React's `onSubmit` runs and marks it intercepted.
  const checkElement = useElementCheck<HTMLFormElement>(
    isDev &&
      ((form) =>
        form.tagName !== "FORM"
          ? `Form.Root: expected to render a <form> element but got <${form.tagName.toLowerCase()}>.`
          : null),
  );
  const libraryRef = useCallback(
    (form: HTMLFormElement) => {
      formRef.current = form;
      checkElement?.(form);
      const onSubmit = (event: Event) => {
        if (event.target !== form) return;
        submission.current = { intercepted: false, formData: null };
      };
      form.addEventListener("submit", onSubmit, true);
      return () => {
        form.removeEventListener("submit", onSubmit, true);
        if (formRef.current === form) formRef.current = null;
      };
    },
    [checkElement],
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (typeof action !== "function") return; // a navigating form: the browser's
    // A `render` element's own `onSubmit` (merged, it runs first) vetoed the submission
    // (conventions: a `preventDefault()` in the consumer's handler cancels the library's work).
    if (event.defaultPrevented) {
      submission.current = null;
      return;
    }
    const native = event.nativeEvent as SubmitEvent;
    const submitter = native.submitter;
    // A per-button action: React's own path (and its automatic reset).
    if (submitter?.hasAttribute("formaction") === true) return;
    // react-dom now skips its action run and its reset, and still starts the form's status.
    event.preventDefault();
    const formData = new FormData(event.currentTarget, submitter);
    submission.current = { intercepted: true, formData };
    startTransition(async () => {
      await action(formData);
    });
  };

  const registerField = useCallback((registration: FormFieldRegistration) => {
    fields.current.add(registration);
    return () => {
      fields.current.delete(registration);
    };
  }, []);

  // The settle (design 3.2): the form's status went `true → false`. The Fields rendered the
  // result's errors in that commit; this effect runs after it.
  const onSettled = useCallback(() => {
    const settled = submission.current;
    submission.current = null;
    const form = formRef.current;
    if (form === null) return;
    const shown = [...fields.current]
      .filter((field) => field.showsServerError())
      .map((field) => ({ field, target: field.getFocusTarget() }))
      .filter(
        (entry): entry is { field: FormFieldRegistration; target: HTMLElement } =>
          entry.target !== null && entry.target.isConnected,
      );
    if (shown.length > 0) {
      const first = sortByDocumentOrder(shown, (entry) => entry.target)[0]!;
      // Focus already there (the user pressed Enter in that field): `focus()` does nothing and
      // nothing reads the new description, so the message is announced instead (design 5.3).
      if (first.target.ownerDocument.activeElement === first.target) {
        announce(first.target, first.field.serverMessages().join(" "));
      } else {
        first.target.focus();
      }
      return;
    }
    const { errors, autoReset } = latest.current;
    if (autoReset && settled?.intercepted === true && !hasAnyError(errors)) form.reset();
  }, [latest]);

  const submittedData = useCallback(() => {
    const current = submission.current;
    return current?.intercepted === true ? current.formData : null;
  }, []);

  const refreshFields = useCallback((source: FormFieldRegistration | null) => {
    for (const field of fields.current) if (field !== source) field.refresh();
  }, []);

  const context = useMemo<FormContextValue>(
    () => ({ errors, registerField, submittedData, refreshFields }),
    [errors, registerField, submittedData, refreshFields],
  );

  const state: FormRootState = { pending };

  const element = useRender<ComponentPropsWithRef<"form">, FormRootState>({
    defaultElement: "form",
    render,
    state,
    className,
    style,
    children: (s) => (
      <>
        {resolveStateValue(children, s)}
        {isFunction && (
          <FormStatusWatcher onPendingChange={setStatusPending} onSettled={onSettled} />
        )}
      </>
    ),
    props: rest,
    libraryProps: {
      method: typeof action === "string" ? method : undefined,
      // React's own type wants `void | Promise<void>`; the library's actions return `unknown`
      // (conventions 2.2) and React ignores the result.
      action: action as ComponentPropsWithRef<"form">["action"],
      onSubmit: isFunction ? onSubmit : undefined,
      "data-pending": dataAttr(pending),
    },
    ref: libraryRef,
  });

  return <FormContext value={context}>{element}</FormContext>;
}

FormRoot.displayName = "FormRoot";
