"use client";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import type { ComponentPropsWithRef, CSSProperties, FormEvent, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import { sortByDocumentOrder } from "../internal/dom-order.js";
import { FormContext } from "../internal/form/field-context.js";
import type { FormContextValue, FormFieldRegistration } from "../internal/form/field-context.js";
import { announce } from "../internal/announce.js";
import { FormStatusWatcher } from "../internal/form/form-status-watcher.js";
import { reportDropped } from "../internal/action/report-dropped.js";
import { useConnected } from "../internal/action/use-connected.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useLatest } from "../internal/use-latest.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import { hasFormError, normaliseErrorValue } from "../internal/form/validity.js";
import type { FieldErrorValue, FormErrors } from "../internal/form/validity.js";

const isDev = process.env.NODE_ENV !== "production";

export type { FieldErrorValue, FormErrors } from "../internal/form/validity.js";

/**
 * State of `Form.Root`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface FormRootState {
  /** A submission is in flight: the Form's own transition, or the form's status (`useFormStatus`), including the Suspense wait of the result. */
  readonly pending: boolean;
}

/**
 * Props of `Form.Root`.
 *
 * @see https://ui.funstack.work/components/field
 */
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
   * A form-level error: a failure that is not about one field (usually `state.error` from
   * `useActionState`). Shown by `Form.Error` and announced when a submission settles. Never
   * written into a control's validity, so the same values can be submitted again. While it is
   * not empty the form is not reset and a `Dialog.Form` stays open.
   */
  error?: FieldErrorValue;
  /**
   * Reset the form (`form.reset()`) when a submission the Form ran settles with no error: no
   * non-empty entry in `errors` at all (an error hidden because the user replaced the value
   * during the flight still counts) and an empty `error`. A submission that reports errors never
   * resets, so the user's input, `:user-invalid` and custom validity stay. `false`: never reset.
   *
   * @defaultValue `true`
   */
  autoReset?: boolean;
  /** Only with a string `action`. Owned otherwise (React's own with a function action). */
  method?: ComponentPropsWithRef<"form">["method"];
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, FormRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, FormRootState>;
  /** Content, or a function of the part's state. */
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
 * `errors`), or, when the form has no error (`errors` has no entry and `error` is empty) and
 * `autoReset` is on, resets the form. A form-level `error` is announced at the settle while a
 * `Form.Error` is mounted (design 3.7).
 *
 * Owned keys (conventions 1.2): `action`, `method` (except with a string `action`), `onSubmit`,
 * `data-pending`.
 *
 * @see https://ui.funstack.work/components/field
 */
export function FormRoot({
  action,
  errors,
  error,
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
  // The newest submission the Form ran, and whether the Form is connected (use-connected.ts).
  const latestRun = useRef(0);
  const connected = useConnected();

  const formRef = useRef<HTMLFormElement | null>(null);
  const submission = useRef<Submission | null>(null);
  const fields = useRef(new Set<FormFieldRegistration>());
  const latest = useLatest({ errors, error, autoReset });
  // `Form.Error` parts mounted (design 3.7 rule 3): the form-level announcement is theirs.
  const formErrorCount = useRef(0);
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
    const id = ++latestRun.current;
    startTransition(async () => {
      try {
        await action(formData);
      } catch (error) {
        // The latest submission's rejection takes React's route to the boundary while the Form
        // is there to render it; a superseded one's, or one after the Form unmounted or was
        // hidden, React would drop: reported instead (conventions 2.4, `useActionTrigger`).
        if (id === latestRun.current && connected.current) throw error;
        reportDropped(error);
      }
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
    const { errors, error, autoReset } = latest.current;
    // The form-level messages, spoken once per settle while a `Form.Error` is mounted (3.7).
    const formMessages = formErrorCount.current > 0 ? normaliseErrorValue(error).join(" ") : "";
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
      // The form-level messages come first, in the same announcement (3.7 rule 3).
      if (first.target.ownerDocument.activeElement === first.target) {
        const fieldMessages = first.field.serverMessages().join(" ");
        announce(first.target, [formMessages, fieldMessages].filter((m) => m !== "").join(" "));
      } else {
        // Focus first: a focus change flushes the screen reader's speech queue, and a normal
        // `ariaNotify` queues behind the focus announcement.
        first.target.focus();
        announce(form, formMessages);
      }
      return;
    }
    // No focus move for a form-level error (3.7 rule 4): it is announced on the form.
    announce(form, formMessages);
    if (autoReset && settled?.intercepted === true && !hasFormError(errors, error)) form.reset();
  }, [latest]);

  const submittedData = useCallback(() => {
    const current = submission.current;
    return current?.intercepted === true ? current.formData : null;
  }, []);

  const refreshFields = useCallback((source: FormFieldRegistration | null) => {
    for (const field of fields.current) if (field !== source) field.refresh();
  }, []);

  const registerFormError = useCallback(() => {
    formErrorCount.current += 1;
    return () => {
      formErrorCount.current -= 1;
    };
  }, []);

  const formMessages = useMemo(() => normaliseErrorValue(error), [error]);

  const context = useMemo<FormContextValue>(
    () => ({
      errors,
      error: formMessages,
      registerFormError,
      registerField,
      submittedData,
      refreshFields,
    }),
    [errors, formMessages, registerFormError, registerField, submittedData, refreshFields],
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
