// Form rows that need a real engine (design/components/field-form.md 13.2, "Submit plugin"):
// the `action` attribute rendered **and** the Form's `onSubmit` cancelling the submission, with
// real clicks, so react-dom's submit plugin takes the "defaultPrevented + transition requested"
// branch: the action runs once (the Form's call), `useFormStatus` is pending with `data` in a
// child and through a portal, and no automatic reset follows a result with errors.
import { act, render, screen } from "@testing-library/react";
import { Suspense, startTransition, useActionState, useState } from "react";
import type { ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { getAXNodes } from "../__tests__/ax-tree.js";
import { onCleanup } from "../__tests__/browser-helpers.js";
import { user } from "../__tests__/browser-user.js";
import { browserName, supportsAriaNotify } from "../__tests__/engine.js";
import { deferred, expectNotPending, expectPending, flushTasks } from "../__tests__/helpers.js";
import type { Deferred } from "../__tests__/helpers.js";
import { Field } from "../field/index.js";
import { Form } from "./index.js";
import type { FormErrors } from "./index.js";

interface Status {
  readonly where: string;
  readonly pending: boolean;
  readonly email: unknown;
}

function StatusProbe({ where, seen }: { where: string; seen: Status[] }) {
  const status = useFormStatus();
  seen.push({ where, pending: status.pending, email: status.data?.get("email") ?? null });
  return null;
}

function Fields({ seen }: { seen: Status[] }) {
  return (
    <>
      <Field.Root name="email" required data-testid="root">
        <Field.Label>Email</Field.Label>
        <Field.Control data-testid="email" />
        <Field.Error data-testid="error" />
      </Field.Root>
      <StatusProbe where="child" seen={seen} />
      {createPortal(<StatusProbe where="portal" seen={seen} />, document.body)}
      <Form.Submit>Save</Form.Submit>
    </>
  );
}

interface Result {
  readonly errors?: FormErrors;
}

function ActionStateForm({
  run,
  seen,
}: {
  run: (formData: FormData) => Promise<Result>;
  seen: Status[];
}) {
  const [state, formAction] = useActionState((_: Result, formData: FormData) => run(formData), {});
  return (
    <Form.Root action={formAction} errors={state.errors} data-testid="form">
      <Fields seen={seen} />
    </Form.Root>
  );
}

/**
 * A plain async action; a result with `errors` is put into state after the `await` (inside
 * `startTransition`, the post-await rule), so it lands in the settle commit.
 */
function PlainForm({
  action,
  seen,
  children,
}: {
  action: (formData: FormData) => unknown;
  seen: Status[];
  children?: ReactNode;
}) {
  const [errors, setErrors] = useState<FormErrors | undefined>(undefined);
  const run = async (formData: FormData) => {
    const result = (await action(formData)) as Result | undefined;
    startTransition(() => setErrors(result?.errors));
  };
  return (
    <Form.Root action={run} errors={errors} data-testid="form">
      <Fields seen={seen} />
      {children}
    </Form.Root>
  );
}

const email = () => screen.getByTestId("email") as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: "Save" });

describe.each(["useActionState dispatch", "plain async function"] as const)(
  "Form: the submit plugin (%s)",
  (kind) => {
    function setup(): { calls: { formData: FormData; d: Deferred<Result> }[]; seen: Status[] } {
      const calls: { formData: FormData; d: Deferred<Result> }[] = [];
      const seen: Status[] = [];
      const run = (formData: FormData) => {
        const d = deferred<Result>();
        calls.push({ formData, d });
        return d.promise;
      };
      if (kind === "useActionState dispatch") render(<ActionStateForm run={run} seen={seen} />);
      else render(<PlainForm action={run} seen={seen} />);
      return { calls, seen };
    }

    it("runs the action once; useFormStatus is pending with data in a child and a portal", async () => {
      const { calls, seen } = setup();
      await user.type(email(), "a@b.c");
      await user.click(submit());
      await flushTasks();
      expect(calls).toHaveLength(1);
      expect(calls[0]!.formData.get("email")).toBe("a@b.c");
      expectPending(screen.getByTestId("form"));
      expectPending(submit());
      expectPending(screen.getByTestId("root"));
      const pending = seen.filter((s) => s.pending);
      expect(pending.map((s) => s.where)).toEqual(expect.arrayContaining(["child", "portal"]));
      expect(pending.every((s) => s.email === "a@b.c")).toBe(true);
      await act(async () => calls[0]!.d.resolve({}));
      await flushTasks();
      expect(calls).toHaveLength(1);
      expectNotPending(screen.getByTestId("form"));
    });

    it("no automatic reset after a result with errors (value and :user-invalid stay)", async () => {
      const { calls } = setup();
      await user.type(email(), "a@b.c");
      await user.click(submit());
      await act(async () => calls[0]!.d.resolve({ errors: { email: "Already registered" } }));
      await flushTasks();
      expect(email().value).toBe("a@b.c");
      expect(email().matches(":user-invalid")).toBe(true);
      expect(email().validationMessage).toBe("Already registered");
      expect(screen.getByTestId("error")).toHaveTextContent("Already registered");
      expect(document.activeElement).toBe(email());
    });

    it("with no errors and autoReset, the value is cleared", async () => {
      const { calls } = setup();
      await user.type(email(), "a@b.c");
      await user.click(submit());
      expect(email().value).toBe("a@b.c");
      await act(async () => calls[0]!.d.resolve({}));
      await flushTasks();
      expect(email().value).toBe("");
      expect(email().matches(":user-invalid")).toBe(false);
      expect(screen.queryByTestId("error")).toBeNull();
    });
  },
);

describe("Form: editing while the submission is in flight", () => {
  it("real typing during a pending useActionState action: no fallback, the stale error is suppressed", async () => {
    const calls: Deferred<Result>[] = [];
    const run = () => {
      const d = deferred<Result>();
      calls.push(d);
      return d.promise;
    };
    render(
      <Suspense fallback={<p data-testid="fallback" />}>
        <ActionStateForm run={run} seen={[]} />
      </Suspense>,
    );
    await user.type(email(), "a@b.c");
    await user.click(submit());
    await flushTasks();
    expectPending(screen.getByTestId("form"));
    await user.type(email(), "x");
    expect(screen.queryByTestId("fallback")).toBeNull();
    await act(async () => calls[0]!.resolve({ errors: { email: "Already registered" } }));
    await flushTasks();
    expectNotPending(screen.getByTestId("form"));
    expect(screen.queryByTestId("error")).toBeNull();
    expect(email().value).toBe("a@b.cx");
    expect(email().validationMessage).toBe("");
  });
});

describe("Form: a form-level error (field-form.md 3.7, #208)", () => {
  function ErrorForm({ run }: { run: () => Promise<{ error?: string }> }) {
    const [state, formAction] = useActionState(run, {});
    return (
      <Form.Root action={formAction} error={state.error} data-testid="form">
        <Form.Error data-testid="form-error" />
        <Field.Root name="title">
          <Field.Label>Title</Field.Label>
          <Field.Control data-testid="title" />
        </Field.Root>
        <Form.Submit>Save</Form.Submit>
      </Form.Root>
    );
  }

  it("a real settle: the message is rendered and announced on the form, focus stays, a retry runs", async () => {
    const run = vi.fn(async () => ({ error: "Could not reach the server." }));
    render(<ErrorForm run={run} />);
    const form = screen.getByTestId("form") as HTMLFormElement;
    // Every supported engine has `ariaNotify` (announce.ts); a Playwright build may lag, and then
    // a stand-in on the form records the call the library makes (it checks for the method at the
    // call), so the assertions below run in every engine.
    const calls: { target: Element; message: string }[] = [];
    type Notifying = { ariaNotify(message: string, options?: object): void };
    if (supportsAriaNotify) {
      const proto = Element.prototype as unknown as Notifying;
      const real = proto.ariaNotify;
      vi.spyOn(proto, "ariaNotify").mockImplementation(function (this: Element, message: string) {
        calls.push({ target: this, message });
        real.call(this, message);
      });
    } else {
      Object.defineProperty(Element.prototype, "ariaNotify", {
        configurable: true,
        value(this: Element, message: string) {
          calls.push({ target: this, message });
        },
      });
      onCleanup(() => {
        delete (Element.prototype as { ariaNotify?: unknown }).ariaNotify;
      });
    }
    await user.type(screen.getByTestId("title"), "Groceries");
    await user.click(submit());
    await flushTasks();
    const part = screen.getByTestId("form-error");
    expect(part).toBeVisible();
    expect(part).toHaveTextContent("Could not reach the server.");
    expect(document.activeElement).toBe(submit());
    expect((screen.getByTestId("title") as HTMLInputElement).value).toBe("Groceries");
    expect(form.checkValidity()).toBe(true);
    expect(calls).toEqual([{ target: form, message: "Could not reach the server." }]);
    // The message is in the accessibility tree (Chromium's, through CDP; the others have no
    // protocol for it here).
    if (browserName === "chromium") {
      const nodes = await getAXNodes();
      const text = nodes.filter(
        (n) => n.ignored !== true && n.name?.value === "Could not reach the server.",
      );
      expect(text.length).toBeGreaterThan(0);
    }

    await user.click(submit());
    await flushTasks();
    expect(run).toHaveBeenCalledTimes(2);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ target: form, message: "Could not reach the server." });
    expect(document.activeElement).toBe(submit());
  });
});

describe("Form: invalid submission", () => {
  it("an invalid form never reaches the action; the Field shows the error and focuses", async () => {
    const action = vi.fn();
    render(<PlainForm action={action} seen={[]} />);
    await user.click(submit());
    await flushTasks();
    expect(action).not.toHaveBeenCalled();
    expectNotPending(screen.getByTestId("form"));
    expect(screen.getByTestId("error")).toHaveTextContent(email().validationMessage);
    expect(document.activeElement).toBe(email());
  });
});
