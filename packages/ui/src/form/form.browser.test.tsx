// Form rows that need a real engine (design/components/field-form.md 13.2, "Submit plugin"):
// the `action` attribute rendered **and** the Form's `onSubmit` cancelling the submission, with
// real clicks, so react-dom's submit plugin takes the "defaultPrevented + transition requested"
// branch: the action runs once (the Form's call), `useFormStatus` is pending with `data` in a
// child and through a portal, and no automatic reset follows a result with errors.
import { act, render, screen } from "@testing-library/react";
import { startTransition, useActionState, useState } from "react";
import type { ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { deferred, expectNotPending, expectPending } from "../__tests__/helpers.js";
import type { Deferred } from "../__tests__/helpers.js";
import { Field } from "../field/index.js";
import { Form } from "./index.js";
import type { FormErrors } from "./index.js";

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

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
      await flush();
      expect(calls).toHaveLength(1);
      expect(calls[0]!.formData.get("email")).toBe("a@b.c");
      expectPending(screen.getByTestId("form"));
      expectPending(submit());
      expectPending(screen.getByTestId("root"));
      const pending = seen.filter((s) => s.pending);
      expect(pending.map((s) => s.where)).toEqual(expect.arrayContaining(["child", "portal"]));
      expect(pending.every((s) => s.email === "a@b.c")).toBe(true);
      await act(async () => calls[0]!.d.resolve({}));
      await flush();
      expect(calls).toHaveLength(1);
      expectNotPending(screen.getByTestId("form"));
    });

    it("no automatic reset after a result with errors (value and :user-invalid stay)", async () => {
      const { calls } = setup();
      await user.type(email(), "a@b.c");
      await user.click(submit());
      await act(async () => calls[0]!.d.resolve({ errors: { email: "Already registered" } }));
      await flush();
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
      await flush();
      expect(email().value).toBe("");
      expect(email().matches(":user-invalid")).toBe(false);
      expect(screen.queryByTestId("error")).toBeNull();
    });
  },
);

describe("Form: invalid submission", () => {
  it("an invalid form never reaches the action; the Field shows the error and focuses", async () => {
    const action = vi.fn();
    render(<PlainForm action={action} seen={[]} />);
    await user.click(submit());
    await flush();
    expect(action).not.toHaveBeenCalled();
    expectNotPending(screen.getByTestId("form"));
    expect(screen.getByTestId("error")).toHaveTextContent(email().validationMessage);
    expect(document.activeElement).toBe(email());
  });
});
