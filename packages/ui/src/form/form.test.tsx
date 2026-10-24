// Form tests (jsdom), mapped to design/components/field-form.md 13.1 (Submission, Server errors,
// Reset policy, Rejection, Overlap, Suspending content, Function props, Platform path).
//
// jsdom runs the Field's `:user-invalid` fallback (see field.test.tsx). The real submit plugin
// combination (the `action` attribute rendered and `onSubmit` cancelled, in real engines) and
// `useFormStatus` through a portal are pinned again in `form.browser.test.tsx`.
//
// N/A rows (conventions 10.1): sync / async change actions, optimistic state, controlled parity,
// post-await and urgent handler. `Form.Root action` is React's form channel, not a library action
// prop: there is no `x` / `defaultX` triple, nothing optimistic, and the Form never interprets a
// return value (results reach the Fields as the `errors` prop). Rejection, overlap and suspending
// content apply to the submission and are covered below.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, Suspense, useActionState, useState } from "react";
import type { ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  setupUser,
  PlainButton,
  flushMicrotasks,
  silenceErrors,
} from "../__tests__/helpers.js";
import { Checkbox } from "../checkbox/index.js";
import { Dialog } from "../dialog/index.js";
import type { CheckboxCheckedChangeDetails } from "../checkbox/index.js";
import type { DialogOpenChangeDetails } from "../dialog/index.js";
import { Field } from "../field/index.js";
import { Form } from "./index.js";
import type { FormErrors, FormRootState, FormSubmitState } from "./index.js";

function EmailField({ name = "email" }: { name?: string }) {
  return (
    <Field.Root name={name} data-testid={`${name}-root`}>
      <Field.Label>{name}</Field.Label>
      <Field.Control data-testid={`${name}-control`} />
      <Field.Error data-testid={`${name}-error`} />
    </Field.Root>
  );
}

const control = (name = "email") => screen.getByTestId(`${name}-control`) as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: "Save" });

interface ActionResult {
  readonly errors?: FormErrors;
}

/** A `useActionState` form whose action the test resolves with a result. */
function ActionStateForm({
  run,
  autoReset,
  children,
}: {
  run: (formData: FormData) => Promise<ActionResult>;
  autoReset?: boolean;
  children?: ReactNode;
}) {
  const [state, formAction] = useActionState(
    (_prev: ActionResult, formData: FormData) => run(formData),
    {},
  );
  return (
    <Form.Root action={formAction} errors={state.errors} autoReset={autoReset} data-testid="form">
      {children ?? (
        <>
          <EmailField />
          <EmailField name="name" />
        </>
      )}
      <Form.Submit data-testid="submit">Save</Form.Submit>
    </Form.Root>
  );
}

describe("Form: submission (intercept)", () => {
  it("cancels the native submit and calls the action once with the submitter's FormData", async () => {
    const d = deferred();
    const action = vi.fn((_formData: FormData) => d.promise);
    let submitEvent: Event | undefined;
    render(
      <Form.Root action={action} data-testid="form">
        <EmailField />
        <Form.Submit name="intent" value="save">
          Save
        </Form.Submit>
      </Form.Root>,
    );
    screen.getByTestId("form").addEventListener("submit", (e) => (submitEvent = e));
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    expect(submitEvent!.defaultPrevented).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0]![0];
    expect(formData.get("email")).toBe("a@b.c");
    expect(formData.get("intent")).toBe("save");

    // Pending on the Form, the Submit and the Field (the form channel).
    expectPending(screen.getByTestId("form"));
    expectPending(submit());
    expectPending(screen.getByTestId("email-root"));
    expectPending(control());

    await act(async () => d.resolve());
    expectNotPending(screen.getByTestId("form"));
    expectNotPending(submit());
    expectNotPending(screen.getByTestId("email-root"));
  });

  it("useFormStatus reports pending with data in a child and through a portal", async () => {
    const d = deferred();
    const seen: { where: string; pending: boolean; email: unknown }[] = [];
    function Probe({ where }: { where: string }) {
      const status = useFormStatus();
      seen.push({ where, pending: status.pending, email: status.data?.get("email") ?? null });
      return null;
    }
    render(
      <Form.Root action={() => d.promise}>
        <EmailField />
        <Probe where="child" />
        {createPortal(<Probe where="portal" />, document.body)}
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    const user = setupUser();
    await user.type(control(), "x");
    await user.click(submit());
    expect(seen.filter((s) => s.pending).map((s) => s.where)).toEqual(
      expect.arrayContaining(["child", "portal"]),
    );
    expect(seen.find((s) => s.pending)!.email).toBe("x");
    await act(async () => d.resolve());
  });

  it("a string action is not intercepted", async () => {
    const error = silenceErrors(); // jsdom: "Not implemented: HTMLFormElement.prototype.requestSubmit"
    let defaultPrevented: boolean | undefined;
    const listener = (e: Event) => {
      defaultPrevented = e.defaultPrevented;
      e.preventDefault(); // jsdom cannot navigate
    };
    document.addEventListener("submit", listener);
    try {
      render(
        <Form.Root action="/search" method="get" data-testid="form">
          <EmailField />
          <Form.Submit>Save</Form.Submit>
        </Form.Root>,
      );
      expect(screen.getByTestId("form")).toHaveAttribute("method", "get");
      expect(screen.getByTestId("form")).toHaveAttribute("action", "/search");
      const user = setupUser();
      await user.click(submit());
      expect(defaultPrevented).toBe(false);
    } finally {
      document.removeEventListener("submit", listener);
      error.mockRestore();
    }
  });

  it("a submitter with its own formAction is left to React (and its automatic reset)", async () => {
    const formAction = vi.fn();
    const action = vi.fn();
    render(
      <Form.Root action={action}>
        <Field.Root name="email">
          <Field.Label>Email</Field.Label>
          <Field.Control defaultValue="" data-testid="email-control" />
        </Field.Root>
        <Form.Submit formAction={formAction}>Save</Form.Submit>
      </Form.Root>,
    );
    const user = setupUser();
    await user.type(control(), "typed");
    await user.click(submit());
    await flushMicrotasks();
    expect(action).not.toHaveBeenCalled();
    expect(formAction).toHaveBeenCalledTimes(1);
    expect(formAction.mock.calls[0]![0].get("email")).toBe("typed");
    // React's automatic reset after its own action.
    expect(control().value).toBe("");
  });
});

describe("Form: server errors", () => {
  it("errors present at mount are shown and written into the slot, without focus", async () => {
    render(
      <Form.Root action={() => {}} errors={{ email: "Taken" }}>
        <EmailField />
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    await flushMicrotasks();
    expect(screen.getByTestId("email-error")).toHaveTextContent("Taken");
    expect(control()).toHaveAttribute("aria-invalid", "true");
    expect(control().validationMessage).toBe("Taken");
    expect(control().validity.customError).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it("a settled submission with errors: shown, first errored field focused, nothing reset", async () => {
    let result: ActionResult = {};
    const run = vi.fn(async () => result);
    render(<ActionStateForm run={run} />);
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.type(control("name"), "Ann");
    result = { errors: { name: "Bad name", email: ["Taken", "Try another"] } };
    await user.click(submit());
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("email-error")).toHaveTextContent("Taken Try another");
    expect(screen.getByTestId("name-error")).toHaveTextContent("Bad name");
    // The first in document order.
    expect(document.activeElement).toBe(control());
    expect(control().value).toBe("a@b.c");
    expect(control("name").value).toBe("Ann");
    expect(control().validationMessage).toBe("Taken\nTry another");
  });

  it("the next edit dismisses the error; the next settle re-shows identical strings", async () => {
    const result: ActionResult = { errors: { email: "Taken" } };
    render(<ActionStateForm run={async () => result} />);
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    await flushMicrotasks();
    expect(screen.getByTestId("email-error")).toHaveTextContent("Taken");

    // The slot blocks a resubmission of the unchanged value: the Field shows the error again
    // without the action running.
    await user.type(control(), "x");
    expect(screen.queryByTestId("email-error")).toBeNull();
    expect(control()).toHaveAttribute("aria-invalid", "false");
    expect(control().validationMessage).toBe("");

    await user.click(submit());
    await flushMicrotasks();
    expect(screen.getByTestId("email-error")).toHaveTextContent("Taken");
    expect(document.activeElement).toBe(control());
  });

  it("a resubmission of an unchanged errored value is blocked by the slot", async () => {
    const run = vi.fn(async (): Promise<ActionResult> => ({ errors: { email: "Taken" } }));
    render(<ActionStateForm run={run} />);
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(1);
    await user.click(submit());
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(control());
  });

  it("an error for a value changed while the submission was in flight is suppressed", async () => {
    const d = deferred<ActionResult>();
    render(<ActionStateForm run={() => d.promise} />);
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.type(control("name"), "Ann");
    await user.click(submit());
    expectPending(screen.getByTestId("form"));
    // An edit while the action is pending. (`user.type` here makes React log "A component
    // suspended inside an `act` scope, but the `act` call was not awaited": user-event's own
    // per-event sync `act` sees the pending useActionState transition suspend. A test-harness
    // artefact; the edit itself is what matters.)
    await act(async () => {
      fireEvent.input(control(), { target: { value: "a@b.cx" } });
    });
    await act(async () => d.resolve({ errors: { email: "Taken", name: "Bad name" } }));
    await flushMicrotasks();
    expect(screen.queryByTestId("email-error")).toBeNull();
    expect(control().validationMessage).toBe("");
    // The unchanged field's error is shown and focused.
    expect(screen.getByTestId("name-error")).toHaveTextContent("Bad name");
    expect(document.activeElement).toBe(control("name"));
    expect(control().value).toBe("a@b.cx");
  });

  // Review M1: the hide flag of a result stays fixed until the next settle.
  it("a suppressed error stays hidden while the next submission is in flight", async () => {
    const first = deferred<ActionResult>();
    const second = deferred<ActionResult>();
    const runs = [first, second];
    let call = 0;
    render(<ActionStateForm run={() => runs[call++]!.promise} />);
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    await act(async () => {
      fireEvent.input(control(), { target: { value: "x@y.z" } });
    });
    await act(async () => first.resolve({ errors: { email: "a@b.c is taken" } }));
    await flushMicrotasks();
    expect(screen.queryByTestId("email-error")).toBeNull();

    // Submit "x@y.z": the `errors` prop still holds the first result during this flight.
    await act(async () => {
      submit().click();
    });
    await flushMicrotasks();
    expectPending(screen.getByTestId("form"));
    expect(screen.queryByTestId("email-error")).toBeNull();
    expect(control()).toHaveAttribute("aria-invalid", "false");
    expect(control().validationMessage).toBe("");

    await act(async () => second.resolve({}));
    await flushMicrotasks();
    expect(call).toBe(2);
    expect(screen.queryByTestId("email-error")).toBeNull();
  });

  it("an error for the value sent in the next flight is shown at that settle", async () => {
    const first = deferred<ActionResult>();
    const second = deferred<ActionResult>();
    const runs = [first, second];
    let call = 0;
    render(<ActionStateForm run={() => runs[call++]!.promise} />);
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    await act(async () => {
      fireEvent.input(control(), { target: { value: "x@y.z" } });
    });
    await act(async () => first.resolve({ errors: { email: "a@b.c is taken" } }));
    await flushMicrotasks();
    await act(async () => {
      submit().click();
    });
    await act(async () => second.resolve({ errors: { email: "x@y.z is taken" } }));
    await flushMicrotasks();
    expect(screen.getByTestId("email-error")).toHaveTextContent("x@y.z is taken");
    expect(document.activeElement).toBe(control());
  });

  describe("announcement when focus does not move (review M2)", () => {
    function stubAriaNotify() {
      const notify = vi.fn();
      Object.defineProperty(Element.prototype, "ariaNotify", {
        configurable: true,
        value: function (this: Element, message: string) {
          notify(this, message);
        },
      });
      return notify;
    }
    afterEach(() => {
      delete (Element.prototype as { ariaNotify?: unknown }).ariaNotify;
    });

    it("a server error for the focused field (Enter in it) is announced on the control", async () => {
      const notify = stubAriaNotify();
      render(<ActionStateForm run={async () => ({ errors: { email: "Taken" } })} />);
      const user = setupUser();
      await user.type(control(), "a@b.c{Enter}");
      await flushMicrotasks();
      expect(screen.getByTestId("email-error")).toHaveTextContent("Taken");
      expect(document.activeElement).toBe(control());
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith(control(), "Taken");
    });

    it("focus moving to the errored field announces nothing extra", async () => {
      const notify = stubAriaNotify();
      render(<ActionStateForm run={async () => ({ errors: { email: "Taken" } })} />);
      const user = setupUser();
      await user.type(control(), "a@b.c");
      await user.click(submit());
      await flushMicrotasks();
      expect(document.activeElement).toBe(control());
      expect(notify).not.toHaveBeenCalled();
    });

    it("a failed attempt from the focused, first invalid field announces its message", async () => {
      const notify = stubAriaNotify();
      const action = vi.fn();
      render(
        <Form.Root action={action}>
          <Field.Root name="code" validate={(v) => (v.length < 3 ? "Too short." : null)}>
            <Field.Label>Code</Field.Label>
            <Field.Control data-testid="code-control" />
            <Field.Error data-testid="code-error" />
          </Field.Root>
          <Field.Root name="other" validate={() => "Other."}>
            <Field.Label>Other</Field.Label>
            <Field.Control data-testid="other-control" />
            <Field.Error />
          </Field.Root>
          <Form.Submit>Save</Form.Submit>
        </Form.Root>,
      );
      await flushMicrotasks();
      const user = setupUser();
      await user.type(control("code"), "a{Enter}");
      await flushMicrotasks();
      expect(action).not.toHaveBeenCalled();
      expect(screen.getByTestId("code-error")).toHaveTextContent("Too short.");
      expect(document.activeElement).toBe(control("code"));
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith(control("code"), "Too short.");

      // Focus elsewhere: it moves to the first invalid field, no announcement.
      notify.mockClear();
      await user.click(submit());
      await flushMicrotasks();
      expect(document.activeElement).toBe(control("code"));
      expect(notify).not.toHaveBeenCalled();
    });

    it("does nothing where ariaNotify is missing", async () => {
      render(<ActionStateForm run={async () => ({ errors: { email: "Taken" } })} />);
      const user = setupUser();
      await user.type(control(), "a@b.c{Enter}");
      await flushMicrotasks();
      expect(screen.getByTestId("email-error")).toHaveTextContent("Taken");
      expect(document.activeElement).toBe(control());
    });
  });

  it("an error whose name has no Field focuses nothing and resets nothing", async () => {
    render(<ActionStateForm run={async () => ({ errors: { form: "Server down" } })} />);
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    await flushMicrotasks();
    expect(document.activeElement).toBe(submit());
    expect(control().value).toBe("a@b.c");
    expect(screen.queryByTestId("email-error")).toBeNull();
  });

  it("the round trip works under StrictMode (registrations survive the double effects)", async () => {
    render(
      <StrictMode>
        <ActionStateForm run={async () => ({ errors: { name: "Bad name" } })} />
      </StrictMode>,
    );
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.type(control("name"), "Ann");
    await user.click(submit());
    await flushMicrotasks();
    expect(screen.getByTestId("name-error")).toHaveTextContent("Bad name");
    expect(document.activeElement).toBe(control("name"));
    await user.type(control("name"), "e");
    expect(screen.queryByTestId("name-error")).toBeNull();
  });

  it("a Field outside a Form.Root has no server-error channel", async () => {
    render(
      <form>
        <EmailField />
      </form>,
    );
    await flushMicrotasks();
    expect(control().validity.valid).toBe(true);
    expect(screen.queryByTestId("email-error")).toBeNull();
  });
});

describe("Form: reset policy", () => {
  it("resets after a settle with no errors (autoReset default); a Checkbox sees the reset", async () => {
    const checkboxAction = vi.fn<(next: boolean, details: CheckboxCheckedChangeDetails) => void>();
    render(
      <ActionStateForm run={async () => ({})}>
        <EmailField />
        <Field.Root name="news">
          <Field.Label>News</Field.Label>
          <Checkbox checkedChangeAction={checkboxAction} data-testid="news" />
        </Field.Root>
      </ActionStateForm>,
    );
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(screen.getByTestId("news"));
    checkboxAction.mockClear();
    await user.click(submit());
    await flushMicrotasks();
    expect(control().value).toBe("");
    expect(screen.getByTestId("news")).not.toBeChecked();
    expect(checkboxAction).toHaveBeenCalledTimes(1);
    expect(checkboxAction.mock.calls[0]![0]).toBe(false);
    expect(checkboxAction.mock.calls[0]![1].reason).toBe("platform");
    expect(checkboxAction.mock.calls[0]![1].event?.type).toBe("reset");
  });

  it("autoReset={false} never resets", async () => {
    render(<ActionStateForm run={async () => ({})} autoReset={false} />);
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    await flushMicrotasks();
    expect(control().value).toBe("a@b.c");
  });

  it("a plain async action: reset after it resolves", async () => {
    const d = deferred();
    render(
      <Form.Root action={() => d.promise}>
        <EmailField />
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    expect(control().value).toBe("a@b.c");
    await act(async () => d.resolve());
    await flushMicrotasks();
    expect(control().value).toBe("");
  });
});

describe("Form: rejection", () => {
  it("a rejected action reaches the Error Boundary above the Form; nothing is reset or focused", async () => {
    silenceErrors();
    const d = deferred();
    const onError = vi.fn();
    const reset = vi.fn();
    render(
      <ErrorCatcher onError={onError}>
        <Form.Root action={() => d.promise} onReset={reset}>
          <EmailField />
          <Form.Submit>Save</Form.Submit>
        </Form.Root>
      </ErrorCatcher>,
    );
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    await act(async () => d.reject(new Error("network")));
    await flushMicrotasks();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "network" }));
    expect(screen.getByTestId("error-catcher")).toHaveTextContent("network");
    expect(reset).not.toHaveBeenCalled();
  });
});

describe("Form: overlap", () => {
  it("two submits with a useActionState action run in order; one settle; the last errors shown", async () => {
    const calls: { value: string; d: ReturnType<typeof deferred<ActionResult>> }[] = [];
    const run = (formData: FormData) => {
      const d = deferred<ActionResult>();
      calls.push({ value: String(formData.get("email")), d });
      return d.promise;
    };
    render(<ActionStateForm run={run} />);
    const user = setupUser();
    await user.type(control(), "first");
    await user.click(submit());
    await user.type(control(), "!");
    await user.click(submit());
    // Queued: the second runs after the first settles.
    expect(calls).toHaveLength(1);
    expectPending(screen.getByTestId("form"));
    await act(async () => calls[0]!.d.resolve({ errors: { email: "First" } }));
    expect(calls).toHaveLength(2);
    expect(calls[1]!.value).toBe("first!");
    // Still pending through the queue: nothing shown, nothing reset yet.
    expectPending(screen.getByTestId("form"));
    expect(screen.queryByTestId("email-error")).toBeNull();
    await act(async () => calls[1]!.d.resolve({ errors: { email: "Second" } }));
    await flushMicrotasks();
    expectNotPending(screen.getByTestId("form"));
    expect(screen.getByTestId("email-error")).toHaveTextContent("Second");
    expect(control().value).toBe("first!");
  });
});

describe("Form: suspending content", () => {
  it("data-pending stays while the result's content suspends; error and content land together", async () => {
    const suspender = createSuspender();
    const { Suspender } = suspender;
    function Page() {
      const [state, formAction] = useActionState<{ errors?: FormErrors; key: string }, FormData>(
        async () => ({ errors: { email: "Taken" }, key: "after" }),
        { key: "before" },
      );
      return (
        <Suspense fallback={<span data-testid="fallback" />}>
          <Form.Root action={formAction} errors={state.errors} data-testid="form">
            <EmailField />
            <Form.Submit>Save</Form.Submit>
          </Form.Root>
          <Suspender value={state.key} />
        </Suspense>
      );
    }
    suspender.resolve("before");
    render(<Page />);
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    await flushMicrotasks();
    expect(screen.queryByTestId("fallback")).toBeNull();
    expectPending(screen.getByTestId("form"));
    expect(screen.getByTestId("suspender")).toHaveTextContent("before");
    expect(screen.queryByTestId("email-error")).toBeNull();
    await act(async () => suspender.resolve("after"));
    await flushMicrotasks();
    expectNotPending(screen.getByTestId("form"));
    expect(screen.getByTestId("suspender")).toHaveTextContent("after");
    expect(screen.getByTestId("email-error")).toHaveTextContent("Taken");
    expect(document.activeElement).toBe(control());
  });
});

describe("Form: function props and render", () => {
  it("Form.Root and Form.Submit function props receive their state; render keeps the wiring", async () => {
    const d = deferred();
    const rootStates: FormRootState[] = [];
    const submitStates: FormSubmitState[] = [];
    let formEl: HTMLFormElement | null = null;
    render(
      <Form.Root
        action={() => d.promise}
        className={(s) => {
          rootStates.push(s);
          return s.pending ? "busy" : "idle";
        }}
        ref={(el) => {
          formEl = el;
        }}
        data-testid="form"
      >
        <EmailField />
        <Form.Submit
          render={<button className="btn" />}
          style={(s) => ({ opacity: s.pending ? 0.5 : 1 })}
        >
          {(s) => {
            submitStates.push(s);
            return s.pending ? "Saving" : "Save";
          }}
        </Form.Submit>
      </Form.Root>,
    );
    expect(formEl).toBe(screen.getByTestId("form"));
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveClass("btn");
    expect(screen.getByTestId("form")).toHaveClass("idle");
    const user = setupUser();
    await user.click(button);
    expect(screen.getByTestId("form")).toHaveClass("busy");
    expect(button).toHaveTextContent("Saving");
    expect(button.style.opacity).toBe("0.5");
    expect(submitStates.at(-1)).toEqual({ pending: true, disabled: false });
    expect(rootStates.at(-1)).toEqual({ pending: true });
    await act(async () => d.resolve());
    expect(button).toHaveTextContent("Save");
  });

  it("a render element's onSubmit preventDefault() cancels the submission (review L3)", async () => {
    const action = vi.fn();
    render(
      <Form.Root action={action} render={<form onSubmit={(event) => event.preventDefault()} />}>
        <EmailField />
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    await flushMicrotasks();
    expect(action).not.toHaveBeenCalled();
    expectNotPending(submit());
    expect(control().value).toBe("a@b.c");
  });

  it("Form.Submit is never disabled while pending; disabled is owned and marked", async () => {
    const d = deferred();
    render(
      <Form.Root action={() => d.promise}>
        <EmailField />
        <Form.Submit>Save</Form.Submit>
        <Form.Submit disabled render={<button disabled={false} />}>
          Other
        </Form.Submit>
      </Form.Root>,
    );
    const user = setupUser();
    await user.click(submit());
    expect(submit()).not.toBeDisabled();
    const other = screen.getByRole("button", { name: "Other" });
    expect(other).toBeDisabled();
    expect(other).toHaveAttribute("data-disabled", "");
    await act(async () => d.resolve());
  });

  it("Form.Submit disabled with a component render stays natively disabled, no aria-disabled (#83)", async () => {
    const action = vi.fn();
    render(
      <Form.Root action={action}>
        <EmailField />
        <Form.Submit disabled render={<PlainButton />}>
          Save
        </Form.Submit>
      </Form.Root>,
    );
    // A submitter has no click handler to honour `aria-disabled`: native `disabled` is the only
    // state that stops the submission.
    expect(submit()).toBeDisabled();
    expect(submit()).not.toHaveAttribute("aria-disabled");
    expect(submit()).toHaveAttribute("data-disabled", "");
    await setupUser().click(submit());
    await flushMicrotasks();
    expect(action).not.toHaveBeenCalled();
  });

  it("Form.Submit works in a plain React form (useFormStatus of the nearest form)", async () => {
    const d = deferred();
    render(
      <form action={() => d.promise}>
        <Form.Submit>Save</Form.Submit>
      </form>,
    );
    const user = setupUser();
    await user.click(submit());
    expectPending(submit());
    await act(async () => d.resolve());
    expectNotPending(submit());
  });

  it("warns when Form.Root or Form.Submit render the wrong element", async () => {
    const error = silenceErrors();
    render(
      <Form.Root render={<div />}>
        <Form.Submit render={<span />}>Save</Form.Submit>
      </Form.Root>,
    );
    await flushMicrotasks();
    const messages = error.mock.calls.map((call) => String(call[0]));
    expect(messages.some((m) => m.includes("Form.Root: expected to render a <form>"))).toBe(true);
    expect(messages.some((m) => m.includes("Form.Submit: expected to render a <button>"))).toBe(
      true,
    );
  });
});

describe("Form: platform path", () => {
  it("React's automatic reset (formAction submitter) is observed by the Field like any reset", async () => {
    render(
      <Form.Root action={() => {}}>
        <Field.Root name="email" required>
          <Field.Label>Email</Field.Label>
          <Field.Control data-testid="email-control" />
          <Field.Error data-testid="email-error" />
        </Field.Root>
        <Form.Submit formAction={() => {}}>Save</Form.Submit>
        <button type="submit" data-testid="plain">
          Plain
        </button>
      </Form.Root>,
    );
    const user = setupUser();
    // A submission attempt shows the error.
    await user.click(screen.getByTestId("plain"));
    expect(screen.getByTestId("email-error")).toBeInTheDocument();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    await flushMicrotasks();
    expect(control().value).toBe("");
    // The reset cleared the user-validity (fallback: "attempted") flag.
    expect(screen.queryByTestId("email-error")).toBeNull();
  });

  it("a controlled Field.Control keeps working (value / onChange pass through)", async () => {
    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <Form.Root action={() => {}}>
          <Field.Root name="email" required>
            <Field.Label>Email</Field.Label>
            <Field.Control
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
              data-testid="email-control"
            />
            <Field.Error data-testid="email-error" />
          </Field.Root>
          <output data-testid="out">{value}</output>
          <Form.Submit>Save</Form.Submit>
        </Form.Root>
      );
    }
    render(<Controlled />);
    const user = setupUser();
    await user.click(submit());
    expect(screen.getByTestId("email-error")).toBeInTheDocument();
    await user.type(control(), "ab");
    expect(screen.getByTestId("out")).toHaveTextContent("ab");
    expect(screen.queryByTestId("email-error")).toBeNull();
    fireEvent.input(control(), { target: { value: "" } });
    await flushMicrotasks();
    expect(screen.getByTestId("email-error")).toBeInTheDocument();
  });
});

// Walkthrough 11 and review M3: `Dialog.Form` rendered as `Form.Root` takes the Form's policy.
// #59 (design/components/dialog.md "Dialog.Form and Form.Root"): the settle close is error-aware.
describe("Form: Dialog.Form render={<Form.Root errors />}", () => {
  function DialogWithForm({
    run,
    closeOnSettle,
    openChangeAction,
  }: {
    run: (formData: FormData) => Promise<ActionResult>;
    closeOnSettle?: boolean;
    openChangeAction?: (open: boolean, details: DialogOpenChangeDetails) => unknown;
  }) {
    const [state, dispatch] = useActionState(
      (_prev: ActionResult, formData: FormData) => run(formData),
      {},
    );
    return (
      <Dialog.Root defaultOpen openChangeAction={openChangeAction}>
        <Dialog.Popup aria-label="Profile" data-testid="popup">
          <Dialog.Form
            data-testid="form"
            render={<Form.Root errors={state.errors} />}
            action={dispatch}
            closeOnSettle={closeOnSettle}
          >
            <EmailField />
            <Form.Submit value="save">Save</Form.Submit>
          </Dialog.Form>
        </Dialog.Popup>
      </Dialog.Root>
    );
  }

  const popup = () => screen.getByTestId("popup") as HTMLDialogElement;

  it("errors: shown and focused, not reset, the dialog stays open; success resets", async () => {
    const run = vi.fn(async (formData: FormData): Promise<ActionResult> =>
      formData.get("email") === "bad" ? { errors: { email: "Taken" } } : {},
    );
    render(<DialogWithForm run={run} closeOnSettle={false} />);
    expect(popup().open).toBe(true);
    const user = setupUser();
    await user.type(control(), "bad");
    await user.click(submit());
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("email-error")).toHaveTextContent("Taken");
    // React's own path would have reset the form after this successful action.
    expect(control().value).toBe("bad");
    expect(document.activeElement).toBe(control());
    expect(popup().open).toBe(true);

    await user.clear(control());
    await user.type(control(), "good");
    expect(screen.queryByTestId("email-error")).toBeNull();
    await user.click(submit());
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(2);
    // autoReset: no error in the result.
    expect(control().value).toBe("");
    // closeOnSettle={false}: a clean settle does not close either.
    expect(popup().open).toBe(true);
  });

  it("the default closeOnSettle keeps the dialog open over errors and focuses the field", async () => {
    const run = vi.fn(async (): Promise<ActionResult> => ({ errors: { email: "Taken" } }));
    const openChangeAction = vi.fn();
    render(<DialogWithForm run={run} openChangeAction={openChangeAction} />);
    const user = setupUser();
    await user.type(control(), "x");
    await user.click(submit());
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(1);
    expect(popup().open).toBe(true);
    expect(openChangeAction).not.toHaveBeenCalled();
    expect(screen.getByTestId("email-error")).toHaveTextContent("Taken");
    expect(document.activeElement).toBe(control());
    expect(control().value).toBe("x");
  });

  it("a clean settle resets and closes: reason 'activate', returnValue = the submitter's value", async () => {
    const d = deferred<ActionResult>();
    const run = vi.fn(() => d.promise);
    const close = deferred();
    const openChangeAction = vi.fn(
      (_open: boolean, _details: DialogOpenChangeDetails) => close.promise,
    );
    render(<DialogWithForm run={run} openChangeAction={openChangeAction} />);
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    expectPending(screen.getByTestId("form"));
    await act(async () => d.resolve({}));
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(1);
    expect(control().value).toBe("");
    expect(openChangeAction).toHaveBeenCalledTimes(1);
    const [next, details] = openChangeAction.mock.calls[0]!;
    expect(next).toBe(false);
    expect(details.reason).toBe("activate");
    expect(details.returnValue).toBe("save");
    // openChangeAction is awaited before the close commit.
    expect(popup().open).toBe(true);
    await act(async () => close.resolve());
    await flushMicrotasks();
    expect(popup().open).toBe(false);
    expect(popup().returnValue).toBe("save");
  });

  it("closeOnSettle={false} never closes, also on a clean settle", async () => {
    const run = vi.fn(async (): Promise<ActionResult> => ({}));
    const openChangeAction = vi.fn();
    render(<DialogWithForm run={run} closeOnSettle={false} openChangeAction={openChangeAction} />);
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(1);
    expect(control().value).toBe("");
    expect(openChangeAction).not.toHaveBeenCalled();
    expect(popup().open).toBe(true);
  });

  it("a hidden stale error (value edited during the flight) neither closes, resets nor focuses", async () => {
    const d = deferred<ActionResult>();
    const openChangeAction = vi.fn();
    render(<DialogWithForm run={() => d.promise} openChangeAction={openChangeAction} />);
    const user = setupUser();
    await user.type(control(), "a@b.c");
    await user.click(submit());
    expectPending(screen.getByTestId("form"));
    await act(async () => {
      fireEvent.input(control(), { target: { value: "x@y.z" } });
    });
    await act(async () => d.resolve({ errors: { email: "a@b.c is taken" } }));
    await flushMicrotasks();
    expect(screen.queryByTestId("email-error")).toBeNull();
    expect(control().value).toBe("x@y.z");
    expect(document.activeElement).toBe(submit());
    expect(openChangeAction).not.toHaveBeenCalled();
    expect(popup().open).toBe(true);
  });

  it("the reverse orientation (Form.Root render={<Dialog.Form />}) is detected the same way", async () => {
    function Reverse({ run }: { run: (formData: FormData) => Promise<ActionResult> }) {
      const [state, dispatch] = useActionState(
        (_prev: ActionResult, formData: FormData) => run(formData),
        {},
      );
      return (
        <Dialog.Root defaultOpen>
          <Dialog.Popup aria-label="Profile" data-testid="popup">
            <Form.Root action={dispatch} errors={state.errors} render={<Dialog.Form />}>
              <EmailField />
              <Form.Submit value="save">Save</Form.Submit>
            </Form.Root>
          </Dialog.Popup>
        </Dialog.Root>
      );
    }
    const run = vi.fn(async (formData: FormData): Promise<ActionResult> =>
      formData.get("email") === "bad" ? { errors: { email: "Taken" } } : {},
    );
    const error = vi.spyOn(console, "error");
    render(<Reverse run={run} />);
    const user = setupUser();
    await user.type(control(), "bad");
    await user.click(submit());
    await flushMicrotasks();
    expect(popup().open).toBe(true);
    expect(document.activeElement).toBe(control());
    await user.clear(control());
    await user.type(control(), "good");
    await user.click(submit());
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(2);
    expect(popup().open).toBe(false);
    expect(popup().returnValue).toBe("save");
    expect(error).not.toHaveBeenCalled();
  });

  it("dev warning: the composition without a function action (it would lose method=dialog)", async () => {
    const error = silenceErrors();
    const { unmount } = render(
      <Dialog.Root defaultOpen>
        <Dialog.Popup aria-label="Profile">
          <Dialog.Form render={<Form.Root />}>
            <EmailField />
          </Dialog.Form>
        </Dialog.Popup>
      </Dialog.Root>,
    );
    await flushMicrotasks();
    const warnings = error.mock.calls.filter((args) =>
      String(args[0]).includes("`Dialog.Form` rendered as a `Form.Root` needs a function `action`"),
    );
    expect(warnings).toHaveLength(1);
    unmount();
    error.mockClear();

    // No warning: a plain Dialog.Form without action, the composition with a function action,
    // and the composition with a string action (a navigating form in both parts).
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Popup aria-label="Profile">
          <Dialog.Form>
            <button type="submit">Plain</button>
          </Dialog.Form>
          <Dialog.Form render={<Form.Root />} action={async () => {}}>
            <EmailField />
          </Dialog.Form>
          <Dialog.Form render={<Form.Root />} action="/save" method="post">
            <EmailField name="name" />
          </Dialog.Form>
        </Dialog.Popup>
      </Dialog.Root>,
    );
    await flushMicrotasks();
    expect(error).not.toHaveBeenCalled();
  });

  it("a plain Dialog.Form still closes on a settle whose result has errors (8.1 unchanged)", async () => {
    function Plain() {
      const [state, dispatch] = useActionState(
        async (): Promise<ActionResult> => ({ errors: { email: "Taken" } }),
        {},
      );
      return (
        <Dialog.Root defaultOpen>
          {/* Outside the Popup: the close unmounts the Popup's content (no keepMounted), on a
              microtask after the close commit, so a readout inside it may already be gone. */}
          <output data-testid="state">{state.errors?.email ?? ""}</output>
          <Dialog.Popup aria-label="Profile" data-testid="popup">
            <Dialog.Form action={dispatch}>
              <button type="submit" value="save">
                Save
              </button>
            </Dialog.Form>
          </Dialog.Popup>
        </Dialog.Root>
      );
    }
    render(<Plain />);
    const user = setupUser();
    await user.click(submit());
    await flushMicrotasks();
    expect(screen.getByTestId("state")).toHaveTextContent("Taken");
    expect(popup().open).toBe(false);
    expect(popup().returnValue).toBe("save");
    // The content unmounts once the close settles (no exit animation in jsdom).
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save", hidden: true })).toBeNull(),
    );
  });
});
