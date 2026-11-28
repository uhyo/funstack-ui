// Form.Root `error` and Form.Error (design/components/field-form.md 3.7, 4.7; #208), jsdom.
// The announcement in real engines (ariaNotify on the form, focus kept on the submit button) is
// pinned again in form.browser.test.tsx.
import { act, render, screen, waitFor } from "@testing-library/react";
import { useActionState } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  deferred,
  flushMicrotasks,
  hydrateFromServer,
  setupUser,
  silenceErrors,
} from "../__tests__/helpers.js";
import { Dialog } from "../dialog/index.js";
import { Field } from "../field/index.js";
import { Form } from "./index.js";
import type {
  FieldErrorValue,
  FormErrorProps,
  FormErrorState,
  FormErrors,
  FormRootProps,
} from "./index.js";

interface Result {
  readonly errors?: FormErrors;
  readonly error?: FieldErrorValue;
}

function TitleField() {
  return (
    <Field.Root name="title">
      <Field.Label>Title</Field.Label>
      <Field.Control data-testid="title-control" />
      <Field.Error data-testid="title-error" />
    </Field.Root>
  );
}

const title = () => screen.getByTestId("title-control") as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: "Save" });
const formElement = () => screen.getByTestId("form") as HTMLFormElement;
const formError = () => screen.queryByTestId("form-error");

function ActionStateForm({
  run,
  withPart = true,
  children,
}: {
  run: (formData: FormData) => Promise<Result>;
  withPart?: boolean;
  children?: ReactNode;
}) {
  const [state, formAction] = useActionState(
    (_prev: Result, formData: FormData) => run(formData),
    {},
  );
  return (
    <Form.Root action={formAction} errors={state.errors} error={state.error} data-testid="form">
      {withPart && <Form.Error data-testid="form-error" />}
      {children ?? <TitleField />}
      <Form.Submit>Save</Form.Submit>
    </Form.Root>
  );
}

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

describe("Form.Error: a mirror of Form.Root error (3.7 rule 1)", () => {
  it("an error at mount is rendered, not announced, and moves no focus", async () => {
    const notify = stubAriaNotify();
    render(
      <Form.Root action={async () => {}} error="Server down">
        <Form.Error data-testid="form-error" />
        <TitleField />
      </Form.Root>,
    );
    await flushMicrotasks();
    const part = formError();
    expect(part).not.toBeNull();
    expect(part!.tagName).toBe("DIV");
    expect(part).toHaveTextContent("Server down");
    expect(part).not.toHaveAttribute("role");
    expect(part).not.toHaveAttribute("aria-live");
    expect(part).not.toHaveAttribute("data-pending");
    expect(notify).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it.each([
    ["an empty string", ""],
    ["an empty array", []],
    ["an array of empty strings", ["", ""]],
    ["null", null],
    ["undefined", undefined],
  ] as const)("%s renders no element", (_label, error) => {
    render(
      <Form.Root action={async () => {}} error={error}>
        <Form.Error data-testid="form-error" />
      </Form.Root>,
    );
    expect(formError()).toBeNull();
  });

  it("several messages are joined by a space; function children get { messages, pending }", () => {
    const states: FormErrorState[] = [];
    render(
      <Form.Root action={async () => {}} error={["One.", "", "Two."]}>
        <Form.Error data-testid="form-error" />
        <Form.Error data-testid="custom">
          {(state) => {
            states.push(state);
            return state.messages.map((m) => <span key={m}>{m}</span>);
          }}
        </Form.Error>
      </Form.Root>,
    );
    expect(formError()).toHaveTextContent("One. Two.");
    expect(screen.getByTestId("custom").querySelectorAll("span")).toHaveLength(2);
    expect(states.at(-1)).toEqual({ messages: ["One.", "Two."], pending: false });
  });

  it("className and style functions get the state; render replaces the element", () => {
    render(
      <Form.Root action={async () => {}} error="Down">
        <Form.Error
          data-testid="form-error"
          className={(s) => `count-${s.messages.length}`}
          style={(s) => ({ opacity: s.pending ? 0.5 : 1 })}
          render={<p />}
        />
      </Form.Root>,
    );
    expect(formError()!.tagName).toBe("P");
    expect(formError()).toHaveClass("count-1");
    expect(formError()).toHaveStyle({ opacity: "1" });
  });

  it("function props are not called while the part renders nothing", () => {
    const children = vi.fn((s: FormErrorState) => s.messages[0]);
    const className = vi.fn(() => "x");
    const renderFn = vi.fn();
    render(
      <Form.Root action={async () => {}} error={null}>
        <Form.Error className={className} render={renderFn}>
          {children}
        </Form.Error>
      </Form.Root>,
    );
    expect(children).not.toHaveBeenCalled();
    expect(className).not.toHaveBeenCalled();
    expect(renderFn).not.toHaveBeenCalled();
  });

  it("outside a Form.Root it throws", () => {
    silenceErrors();
    expect(() => render(<Form.Error />)).toThrow("Form.Error must be rendered inside a Form.Root.");
  });
});

describe("Form.Error: the settle (3.7 rules 2 to 4)", () => {
  it("a settle with only error: no reset, no focus move, announced once on the form; a retry runs and is announced again", async () => {
    const notify = stubAriaNotify();
    const run = vi.fn(async (): Promise<Result> => ({ error: "Server down" }));
    render(<ActionStateForm run={run} />);
    const user = setupUser();
    await user.type(title(), "Groceries");
    await user.click(submit());
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(1);
    expect(formError()).toHaveTextContent("Server down");
    expect(title().value).toBe("Groceries");
    expect(document.activeElement).toBe(submit());
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(formElement(), "Server down");
    // Never written into a control's validity: the same values may be submitted again.
    expect(formElement().checkValidity()).toBe(true);
    expect(title().validity.customError).toBe(false);

    await user.click(submit());
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenLastCalledWith(formElement(), "Server down");
    expect(title().value).toBe("Groceries");
  });

  it("with a field error too: the field is focused and both are shown; the form-level text is announced on the form", async () => {
    const notify = stubAriaNotify();
    render(
      <ActionStateForm
        run={async () => ({ errors: { title: "Already exists" }, error: "Not saved" })}
      />,
    );
    const user = setupUser();
    await user.type(title(), "Groceries");
    await user.click(submit());
    await flushMicrotasks();
    expect(document.activeElement).toBe(title());
    expect(formError()).toHaveTextContent("Not saved");
    expect(screen.getByTestId("title-error")).toHaveTextContent("Already exists");
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(formElement(), "Not saved");
  });

  it("with focus already on the errored field: one announcement, form-level text first", async () => {
    const notify = stubAriaNotify();
    render(
      <ActionStateForm
        run={async () => ({ errors: { title: "Already exists" }, error: "Not saved" })}
      />,
    );
    const user = setupUser();
    await user.type(title(), "Groceries{Enter}");
    await flushMicrotasks();
    expect(document.activeElement).toBe(title());
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(title(), "Not saved Already exists");
  });

  it("without a mounted Form.Error nothing is announced, and the form is still not reset", async () => {
    const notify = stubAriaNotify();
    render(<ActionStateForm run={async () => ({ error: "Server down" })} withPart={false} />);
    const user = setupUser();
    await user.type(title(), "Groceries");
    await user.click(submit());
    await flushMicrotasks();
    expect(notify).not.toHaveBeenCalled();
    expect(title().value).toBe("Groceries");
    expect(document.activeElement).toBe(submit());
  });

  it("several Form.Error parts: one announcement", async () => {
    const notify = stubAriaNotify();
    render(
      <ActionStateForm run={async () => ({ error: "Server down" })}>
        <TitleField />
        <Form.Error data-testid="bottom" />
      </ActionStateForm>,
    );
    const user = setupUser();
    await user.click(submit());
    await flushMicrotasks();
    expect(formError()).toHaveTextContent("Server down");
    expect(screen.getByTestId("bottom")).toHaveTextContent("Server down");
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("a clean settle after an error unmounts the part and resets the form", async () => {
    let fail = true;
    render(<ActionStateForm run={async () => (fail ? { error: "Server down" } : {})} />);
    const user = setupUser();
    await user.type(title(), "Groceries");
    await user.click(submit());
    await flushMicrotasks();
    expect(formError()).not.toBeNull();
    expect(title().value).toBe("Groceries");
    fail = false;
    await user.click(submit());
    await flushMicrotasks();
    expect(formError()).toBeNull();
    expect(title().value).toBe("");
  });

  it("data-pending during the next flight, with the previous message still rendered", async () => {
    const gates = [deferred<Result>(), deferred<Result>()];
    let call = 0;
    render(<ActionStateForm run={() => gates[call++]!.promise} />);
    const user = setupUser();
    await user.click(submit());
    await act(async () => gates[0]!.resolve({ error: "Server down" }));
    await flushMicrotasks();
    expect(formError()).toHaveTextContent("Server down");
    expect(formError()).not.toHaveAttribute("data-pending");

    await user.click(submit());
    expect(formError()).toHaveTextContent("Server down");
    expect(formError()).toHaveAttribute("data-pending", "");
    await act(async () => gates[1]!.resolve({ error: "Still down" }));
    await flushMicrotasks();
    expect(formError()).toHaveTextContent("Still down");
    expect(formError()).not.toHaveAttribute("data-pending");
  });
});

describe("Form.Error in a Dialog.Form (dialog.md 8.1, field-form.md 11.9)", () => {
  function DialogWithForm({
    run,
    reverse = false,
  }: {
    run: (formData: FormData) => Promise<Result>;
    reverse?: boolean;
  }) {
    const [state, dispatch] = useActionState(
      (_prev: Result, formData: FormData) => run(formData),
      {},
    );
    const content = (
      <>
        <Form.Error data-testid="form-error" />
        <TitleField />
        <Form.Submit value="save">Save</Form.Submit>
      </>
    );
    return (
      <Dialog.Root defaultOpen>
        <Dialog.Popup aria-label="New task" data-testid="popup">
          {reverse ? (
            <Form.Root
              action={dispatch}
              errors={state.errors}
              error={state.error}
              render={<Dialog.Form />}
            >
              {content}
            </Form.Root>
          ) : (
            <Dialog.Form
              action={dispatch}
              render={<Form.Root errors={state.errors} error={state.error} />}
            >
              {content}
            </Dialog.Form>
          )}
        </Dialog.Popup>
      </Dialog.Root>
    );
  }

  const popup = () => screen.getByTestId("popup") as HTMLDialogElement;

  it.each([
    ["Dialog.Form render={<Form.Root />}", false],
    ["Form.Root render={<Dialog.Form />}", true],
  ])(
    "%s: a settle with error keeps the dialog open and the values; a clean one closes",
    async (_label, reverse) => {
      let fail = true;
      const run = vi.fn(async (): Promise<Result> => (fail ? { error: "Server down" } : {}));
      render(<DialogWithForm run={run} reverse={reverse} />);
      const user = setupUser();
      await user.type(title(), "Groceries");
      await user.click(submit());
      await flushMicrotasks();
      expect(popup().open).toBe(true);
      expect(formError()).toHaveTextContent("Server down");
      expect(title().value).toBe("Groceries");
      expect(document.activeElement).toBe(submit());

      fail = false;
      await user.click(submit());
      await flushMicrotasks();
      expect(run).toHaveBeenCalledTimes(2);
      expect(popup().open).toBe(false);
      expect(popup().returnValue).toBe("save");
    },
  );

  it("11.9: with useActionState inside the Popup, a reopened dialog shows no stale error", async () => {
    function NewTaskForm() {
      const [state, dispatch] = useActionState(
        async (): Promise<Result> => ({ errors: { title: "Already exists" }, error: "Not saved" }),
        {},
      );
      return (
        <Dialog.Form
          action={dispatch}
          render={<Form.Root errors={state.errors} error={state.error} />}
        >
          <Form.Error data-testid="form-error" />
          <TitleField />
          <Form.Submit>Save</Form.Submit>
          <Dialog.Close>Cancel</Dialog.Close>
        </Dialog.Form>
      );
    }
    render(
      // Library mode (`defaultOpen={false}`): only there is the Popup's content unmounted while
      // closed. In JS-free mode it is always mounted, so the action state would outlive a close.
      <Dialog.Root defaultOpen={false}>
        <Dialog.Trigger>New task</Dialog.Trigger>
        <Dialog.Popup aria-label="New task" data-testid="popup">
          <NewTaskForm />
        </Dialog.Popup>
      </Dialog.Root>,
    );
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "New task" }));
    await flushMicrotasks();
    await user.type(title(), "Groceries");
    await user.click(submit());
    await flushMicrotasks();
    expect(formError()).toHaveTextContent("Not saved");
    expect(screen.getByTestId("title-error")).toHaveTextContent("Already exists");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await flushMicrotasks();
    expect(popup().open).toBe(false);
    // The content unmounts once the close settles (no keepMounted), taking the action state.
    await waitFor(() => expect(screen.queryByTestId("title-control")).toBeNull());
    await user.click(screen.getByRole("button", { name: "New task" }));
    await flushMicrotasks();
    expect(popup().open).toBe(true);
    expect(formError()).toBeNull();
    expect(screen.queryByTestId("title-error")).toBeNull();
    expect(title().value).toBe("");
  });
});

describe("Form.Error: server render (3.7 rule 7)", () => {
  it("is in the server HTML for the error the page was rendered with, and hydrates cleanly", async () => {
    const error = silenceErrors();
    const ui = (
      <Form.Root action={async () => {}} error="Server down">
        <Form.Error data-testid="form-error" />
        <TitleField />
      </Form.Root>
    );
    const { container } = await hydrateFromServer(ui, {
      mutate: (c) => {
        expect(c.querySelector('[data-testid="form-error"]')).toHaveTextContent("Server down");
      },
    });
    expect(container.querySelector('[data-testid="form-error"]')).toHaveTextContent("Server down");
    expect(error).not.toHaveBeenCalled();
  });
});

describe("types", () => {
  it("error accepts a FieldErrorValue; FormErrorState has messages and pending", () => {
    expectTypeOf<FormRootProps["error"]>().toEqualTypeOf<FieldErrorValue>();
    expectTypeOf<FormErrorState>().toEqualTypeOf<{
      readonly messages: readonly string[];
      readonly pending: boolean;
    }>();
    expectTypeOf<FormErrorProps["children"]>().toExtend<
      ReactNode | ((state: FormErrorState) => ReactNode)
    >();
  });
});
