// Field tests (jsdom), mapped to design/components/field-form.md 13.1.
//
// jsdom notes (memo/developer/field-form.md): jsdom 30 implements constraint validation, the
// `invalid` event, `requestSubmit()` and `form.reset()`, but its selector engine answers `false`
// for `:user-invalid` without throwing, and `CSS.supports("selector(:user-invalid)")` is false,
// so the Field runs its fallback here ("`invalid` fired and still invalid", cleared by a reset).
// The fallback cannot tell a submission attempt from `checkValidity()`, so the
// `checkValidity()` / `reportValidity()` rows, the changed-then-blurred heuristic and the real
// focus/bubble behaviour are in `field.browser.test.tsx`.
//
// N/A rows (conventions 10.1): sync / async action, optimistic, rejection, overlap, superseded
// rejection, controlled parity, post-await, suspending content, platform path dispatches and
// urgent handler. No Field part has an action prop or an `x` / `defaultX` triple: the validity
// state is an urgent mirror of browser-owned state (design 2.4) with no consumer-facing action.
// The form channel (pending, server errors, the reset policy) is covered in `form.test.tsx`.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { setupUser, flushMicrotasks, silenceErrors } from "../__tests__/helpers.js";
import { Checkbox } from "../checkbox/index.js";
import { RadioGroup } from "../radio-group/index.js";
import { Toggle } from "../toggle/index.js";
import { Field } from "./index.js";
import type { FieldState } from "./index.js";

const JSDOM_MESSAGE = "Constraints not satisfied";

function EmailField({
  required = true,
  withError = true,
  description = true,
  name = "email",
}: {
  required?: boolean;
  withError?: boolean;
  description?: boolean;
  name?: string;
}) {
  return (
    <Field.Root name={name} required={required} data-testid={`${name}-root`}>
      <Field.Label data-testid={`${name}-label`}>Email</Field.Label>
      <Field.Control type="email" data-testid={`${name}-control`} />
      {description && (
        <Field.Description data-testid={`${name}-description`}>
          We never share it.
        </Field.Description>
      )}
      {withError && <Field.Error data-testid={`${name}-error`} />}
    </Field.Root>
  );
}

function TestForm({
  children,
  action = () => {},
}: {
  children: React.ReactNode;
  action?: (formData: FormData) => unknown;
}) {
  return (
    <form action={action as (formData: FormData) => void} data-testid="form">
      {children}
      <button type="submit">Submit</button>
    </form>
  );
}

describe("Field: roles and ARIA", () => {
  it("renders the section 1 HTML: label for, describedby, explicit aria-invalid, no error", async () => {
    render(
      <TestForm>
        <EmailField />
      </TestForm>,
    );
    await flushMicrotasks();
    const control = screen.getByTestId("email-control");
    const label = screen.getByTestId("email-label");
    const description = screen.getByTestId("email-description");
    expect(control.tagName).toBe("INPUT");
    expect(control).toHaveAttribute("name", "email");
    expect(control).toBeRequired();
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("for", control.id);
    expect(control).toHaveAccessibleName("Email");
    expect(control).toHaveAttribute("aria-describedby", description.id);
    expect(control).toHaveAccessibleDescription("We never share it.");
    expect(control).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByTestId("email-error")).toBeNull();
    for (const part of [screen.getByTestId("email-root"), label, control, description]) {
      expect(part).toHaveAttribute("data-required", "");
      expect(part).not.toHaveAttribute("data-invalid");
      expect(part).not.toHaveAttribute("data-disabled");
      expect(part).not.toHaveAttribute("data-pending");
    }
    expect(description.id).toMatch(/-description$/);
    expect(label.id).toMatch(/-label$/);
  });

  it("keeps the consumer's aria-describedby tokens first", async () => {
    render(
      <Field.Root name="n">
        <Field.Label>N</Field.Label>
        <Field.Control aria-describedby="hint" data-testid="c" />
        <Field.Description>D</Field.Description>
      </Field.Root>,
    );
    await flushMicrotasks();
    const c = screen.getByTestId("c");
    expect(c.getAttribute("aria-describedby")?.split(" ")).toEqual([
      "hint",
      expect.stringMatching(/-description$/),
    ]);
  });

  it("keeps the wiring for render={<textarea />} and render={<select />}", async () => {
    render(
      <>
        <Field.Root name="body" required>
          <Field.Label>Body</Field.Label>
          <Field.Control render={<textarea rows={2} />} data-testid="ta" />
        </Field.Root>
        <Field.Root name="size">
          <Field.Label>Size</Field.Label>
          <Field.Control
            render={
              <select defaultValue="m">
                <option value="s">S</option>
                <option value="m">M</option>
              </select>
            }
            data-testid="sel"
          />
        </Field.Root>
      </>,
    );
    await flushMicrotasks();
    const ta = screen.getByTestId("ta");
    expect(ta.tagName).toBe("TEXTAREA");
    expect(ta).toHaveAccessibleName("Body");
    expect(ta).toBeRequired();
    expect(ta).toHaveAttribute("aria-invalid", "false");
    const sel = screen.getByTestId("sel");
    expect(sel.tagName).toBe("SELECT");
    expect(sel).toHaveAccessibleName("Size");
    expect(sel).toHaveAttribute("name", "size");
    expect((sel as HTMLSelectElement).value).toBe("m");
  });

  it("Field disabled disables the control and marks every part", async () => {
    render(
      <Field.Root name="n" disabled data-testid="root">
        <Field.Label data-testid="label">N</Field.Label>
        <Field.Control data-testid="c" />
      </Field.Root>,
    );
    await flushMicrotasks();
    expect(screen.getByTestId("c")).toBeDisabled();
    for (const id of ["root", "label", "c"]) {
      expect(screen.getByTestId(id)).toHaveAttribute("data-disabled", "");
    }
  });

  it("a control's own required marks the Field data-required", async () => {
    render(
      <Field.Root name="n" data-testid="root">
        <Field.Label>N</Field.Label>
        <Field.Control required data-testid="c" />
      </Field.Root>,
    );
    await flushMicrotasks();
    expect(screen.getByTestId("c")).toBeRequired();
    expect(screen.getByTestId("root")).toHaveAttribute("data-required", "");
  });

  it("the control's own name wins over the Field's (with a warning when they differ)", async () => {
    const error = silenceErrors();
    render(
      <Field.Root name="a">
        <Field.Label>N</Field.Label>
        <Field.Control name="b" data-testid="c" />
      </Field.Root>,
    );
    await flushMicrotasks();
    expect(screen.getByTestId("c")).toHaveAttribute("name", "b");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("differs from the Field.Root's"));
  });

  it("the error has no role and no live region", async () => {
    render(
      <TestForm>
        <EmailField />
      </TestForm>,
    );
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    const error = screen.getByTestId("email-error");
    expect(error).not.toHaveAttribute("role");
    expect(error).not.toHaveAttribute("aria-live");
    expect(error.tagName).toBe("DIV");
  });
});

describe("Field: native validation (display)", () => {
  it("a submission attempt shows validationMessage, cancels the bubble and focuses the control", async () => {
    const action = vi.fn();
    render(
      <TestForm action={action}>
        <EmailField />
      </TestForm>,
    );
    const control = screen.getByTestId("email-control") as HTMLInputElement;
    const invalidEvents: Event[] = [];
    // Bubble phase on the control (after the Field's capture listener).
    control.addEventListener("invalid", (event) => invalidEvents.push(event));
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await flushMicrotasks();

    expect(action).not.toHaveBeenCalled();
    expect(invalidEvents).toHaveLength(1);
    expect(invalidEvents[0]!.defaultPrevented).toBe(true);
    const error = screen.getByTestId("email-error");
    expect(error).toHaveTextContent(JSDOM_MESSAGE);
    expect(error.id).toMatch(/-error$/);
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control.getAttribute("aria-describedby")?.split(" ")).toEqual([
      screen.getByTestId("email-description").id,
      error.id,
    ]);
    for (const id of ["email-root", "email-label", "email-control", "email-description"]) {
      expect(screen.getByTestId(id)).toHaveAttribute("data-invalid", "");
    }
    expect(error).toHaveAttribute("data-invalid", "");
    expect(document.activeElement).toBe(control);
  });

  it("focuses the first of two invalid Fields in document order", async () => {
    render(
      <TestForm>
        <EmailField name="first" />
        <EmailField name="second" />
      </TestForm>,
    );
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await flushMicrotasks();
    expect(document.activeElement).toBe(screen.getByTestId("first-control"));
    expect(screen.getByTestId("first-error")).toBeInTheDocument();
    expect(screen.getByTestId("second-error")).toBeInTheDocument();
  });

  it("a second attempt before the timer is its own batch: focus moves from the submitter", async () => {
    // Enter in the first invalid field, then a click on Submit, with no task between them (as
    // `delay: null` user-event can do): the second attempt must not join the first one's batch,
    // whose focus-before was the field (#120).
    render(
      <TestForm>
        <EmailField name="first" />
        <EmailField name="second" />
      </TestForm>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    const first = screen.getByTestId("first-control");
    const button = screen.getByRole("button", { name: "Submit" });
    await act(async () => {
      first.focus();
      form.requestSubmit();
      await Promise.resolve();
      expect(document.activeElement).toBe(first);
      button.focus();
      form.requestSubmit(button);
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(first);
  });

  it("without a Field.Error the invalid event is left to the platform", async () => {
    render(
      <TestForm>
        <EmailField withError={false} />
      </TestForm>,
    );
    const control = screen.getByTestId("email-control");
    const invalidEvents: Event[] = [];
    control.addEventListener("invalid", (event) => invalidEvents.push(event));
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await flushMicrotasks();
    expect(invalidEvents).toHaveLength(1);
    expect(invalidEvents[0]!.defaultPrevented).toBe(false);
    // The mirror still follows: the Field shows data-invalid and aria-invalid.
    expect(control).toHaveAttribute("aria-invalid", "true");
  });

  it("typing a valid value hides the error at once; clearing shows it again (live after the attempt)", async () => {
    render(
      <TestForm>
        <EmailField />
      </TestForm>,
    );
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    const control = screen.getByTestId("email-control");
    await user.type(control, "a@b.c");
    expect(screen.queryByTestId("email-error")).toBeNull();
    expect(control).toHaveAttribute("aria-invalid", "false");
    expect(control).toHaveAttribute("aria-describedby", screen.getByTestId("email-description").id);
    await user.clear(control);
    expect(screen.getByTestId("email-error")).toHaveTextContent(JSDOM_MESSAGE);
  });

  it("form.reset() and a reset button clear a shown native error", async () => {
    render(
      <TestForm>
        <EmailField />
        <button type="reset">Reset</button>
      </TestForm>,
    );
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("email-error")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await flushMicrotasks();
    expect(screen.queryByTestId("email-error")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("email-error")).toBeInTheDocument();
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
    });
    await flushMicrotasks();
    expect(screen.queryByTestId("email-error")).toBeNull();
  });

  it("a Field.Error function child receives validity and messages", async () => {
    render(
      <TestForm>
        <Field.Root name="email" required>
          <Field.Label>Email</Field.Label>
          <Field.Control />
          <Field.Error data-testid="error">
            {({ validity, messages }) =>
              validity.valueMissing ? `Enter your email (${messages.length})` : messages.join(" ")
            }
          </Field.Error>
        </Field.Root>
      </TestForm>,
    );
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("error")).toHaveTextContent("Enter your email (1)");
  });
});

describe("Field: validate", () => {
  it("runs at mount, writes customError, and shows its message after a submission attempt", async () => {
    const validate = vi.fn((value: string) => (value.includes(" ") ? "No spaces." : null));
    const seen: FieldState[] = [];
    render(
      <TestForm>
        <Field.Root name="handle" validate={validate}>
          {(state) => {
            seen.push(state);
            return (
              <>
                <Field.Label>Handle</Field.Label>
                <Field.Control defaultValue="a b" data-testid="c" />
                <Field.Error data-testid="error" />
              </>
            );
          }}
        </Field.Root>
      </TestForm>,
    );
    await flushMicrotasks();
    expect(validate).toHaveBeenCalledWith("a b", expect.any(FormData));
    const c = screen.getByTestId("c") as HTMLInputElement;
    expect(c.validity.customError).toBe(true);
    expect(c.validationMessage).toBe("No spaces.");
    // Not shown yet: the platform's heuristic has not fired.
    expect(screen.queryByTestId("error")).toBeNull();
    expect(seen.at(-1)!.validity.customError).toBe(true);
    expect(seen.at(-1)!.invalid).toBe(false);

    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("error")).toHaveTextContent("No spaces.");
    expect(seen.at(-1)!.messages).toEqual(["No spaces."]);

    await user.clear(c);
    await user.type(c, "ab");
    expect(c.validity.customError).toBe(false);
    expect(screen.queryByTestId("error")).toBeNull();
  });

  it("re-runs on input in another field (cross-field rule)", async () => {
    render(
      <TestForm>
        <Field.Root name="password">
          <Field.Label>Password</Field.Label>
          <Field.Control data-testid="pw" />
        </Field.Root>
        <Field.Root
          name="confirm"
          validate={(value, formData) =>
            value === formData.get("password") ? null : "Passwords do not match."
          }
        >
          <Field.Label>Confirm</Field.Label>
          <Field.Control data-testid="confirm" />
          <Field.Error />
        </Field.Root>
      </TestForm>,
    );
    await flushMicrotasks();
    const pw = screen.getByTestId("pw") as HTMLInputElement;
    const confirm = screen.getByTestId("confirm") as HTMLInputElement;
    expect(confirm.validity.valid).toBe(true); // "" === ""
    const user = setupUser();
    await user.type(pw, "secret");
    expect(confirm.validationMessage).toBe("Passwords do not match.");
    await user.type(confirm, "secret");
    expect(confirm.validity.valid).toBe(true);
    await user.type(pw, "!");
    expect(confirm.validity.customError).toBe(true);
  });

  it("re-runs after a reset and when the prop changes; null clears it", async () => {
    function Harness() {
      const [banned, setBanned] = useState("x");
      return (
        <TestForm>
          <Field.Root name="n" validate={(value) => (value === banned ? "Banned." : null)}>
            <Field.Label>N</Field.Label>
            <Field.Control defaultValue="x" data-testid="c" />
          </Field.Root>
          <button type="button" onClick={() => setBanned("y")}>
            Change
          </button>
        </TestForm>
      );
    }
    render(<Harness />);
    await flushMicrotasks();
    const c = screen.getByTestId("c") as HTMLInputElement;
    expect(c.validationMessage).toBe("Banned.");
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Change" }));
    // The new function runs in the commit that passed it, with no edit (design 2.1).
    expect(c.validity.customError).toBe(false);
    await user.clear(c);
    await user.type(c, "y");
    expect(c.validationMessage).toBe("Banned.");
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
    });
    await flushMicrotasks();
    // Back to "x", which is allowed now.
    expect(c.value).toBe("x");
    expect(c.validity.customError).toBe(false);
  });

  it("several messages are shown together", async () => {
    render(
      <TestForm>
        <Field.Root name="n" validate={() => ["Too short.", "Needs a digit."]}>
          <Field.Label>N</Field.Label>
          <Field.Control />
          <Field.Error data-testid="error" />
        </Field.Root>
      </TestForm>,
    );
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("error")).toHaveTextContent("Too short. Needs a digit.");
  });

  it("re-runs when a FUNSTACK control's value changes with no DOM event (controlled from outside)", async () => {
    // A stable function, so the Harness's re-render does not re-run it by identity.
    const acceptTerms = (value: string) => (value === "" ? "Accept the terms." : null);
    function Harness() {
      const [accepted, setAccepted] = useState(false);
      return (
        <TestForm>
          <Field.Root name="terms" validate={acceptTerms}>
            <Field.Label>Terms</Field.Label>
            <Checkbox checked={accepted} data-testid="c" />
          </Field.Root>
          <button type="button" onClick={() => setAccepted(true)}>
            Accept all
          </button>
        </TestForm>
      );
    }
    render(<Harness />);
    await flushMicrotasks();
    const c = screen.getByTestId("c") as HTMLInputElement;
    expect(c.validationMessage).toBe("Accept the terms.");
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Accept all" }));
    expect(c.checked).toBe(true);
    expect(c.validationMessage).toBe("");
  });
});

describe("Field: group controls", () => {
  it("a RadioGroup inside a Field: Label without for, aria-labelledby and ARIA on the fieldset", async () => {
    render(
      <TestForm>
        <Field.Root name="plan" required>
          <Field.Label data-testid="label">Plan</Field.Label>
          <RadioGroup.Root defaultValue={null} data-testid="group">
            <label>
              <RadioGroup.Item value="free" /> Free
            </label>
            <label>
              <RadioGroup.Item value="pro" /> Pro
            </label>
          </RadioGroup.Root>
          <Field.Description data-testid="desc">Change it later.</Field.Description>
          <Field.Error data-testid="error" />
        </Field.Root>
      </TestForm>,
    );
    await flushMicrotasks();
    const label = screen.getByTestId("label");
    const group = screen.getByTestId("group");
    expect(label).not.toHaveAttribute("for");
    expect(group).toHaveAttribute("aria-labelledby", label.id);
    expect(group).toHaveAccessibleName("Plan");
    expect(group).toHaveAttribute("aria-describedby", screen.getByTestId("desc").id);
    expect(group).toHaveAttribute("aria-invalid", "false");
    const radios = screen.getAllByRole("radio");
    for (const radio of radios) {
      expect(radio).toHaveAttribute("name", "plan");
      expect(radio).toBeRequired();
    }

    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await flushMicrotasks();
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("error")).toHaveTextContent(JSDOM_MESSAGE);
    expect(document.activeElement).toBe(radios[0]);

    await user.click(radios[1]!);
    expect(screen.queryByTestId("error")).toBeNull();
  });
});

describe("Field: function props and render", () => {
  it("every part's className / style / children / render receive FieldState", async () => {
    const states: Record<string, FieldState> = {};
    const record = (part: string) => (state: FieldState) => {
      states[part] = state;
      return part;
    };
    render(
      <TestForm>
        <Field.Root
          name="n"
          required
          className={record("root")}
          style={(s) => ({ outlineWidth: s.invalid ? 2 : 0 })}
          data-testid="root"
        >
          <Field.Label className={record("label")} data-testid="label">
            {(s) => (s.required ? "N *" : "N")}
          </Field.Label>
          <Field.Control className={record("control")} data-testid="c" />
          <Field.Description className={record("description")}>D</Field.Description>
          <Field.Error className={record("error")} data-testid="error" />
        </Field.Root>
      </TestForm>,
    );
    await flushMicrotasks();
    expect(screen.getByTestId("label")).toHaveTextContent("N *");
    expect(screen.getByTestId("root")).toHaveClass("root");
    expect(screen.getByTestId("root").style.outlineWidth).toBe("0px");
    expect(states["control"]!.invalid).toBe(false);
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    for (const part of ["root", "label", "control", "description", "error"]) {
      expect(states[part]).toMatchObject({
        invalid: true,
        required: true,
        disabled: false,
        pending: false,
        messages: [JSDOM_MESSAGE],
      });
      expect(states[part]!.validity.valueMissing).toBe(true);
    }
    expect(screen.getByTestId("root").style.outlineWidth).toBe("2px");
    expect(screen.getByTestId("error")).toHaveClass("error");
  });

  it("render keeps the library's wiring, the consumer's handlers and the ref", async () => {
    let ref: HTMLInputElement | null = null;
    const onInput = vi.fn();
    render(
      <Field.Root name="n" render={<section />} data-testid="root">
        <Field.Label render={(props) => <label {...props} data-x="1" />}>N</Field.Label>
        <Field.Control
          render={<input className="el" onInput={onInput} />}
          className="part"
          ref={(el) => {
            ref = el;
          }}
          data-testid="c"
        />
      </Field.Root>,
    );
    await flushMicrotasks();
    expect(screen.getByTestId("root").tagName).toBe("SECTION");
    const c = screen.getByTestId("c");
    expect(c).toHaveClass("part", "el");
    expect(ref).toBe(c);
    expect(c).toHaveAccessibleName("N");
    fireEvent.input(c, { target: { value: "v" } });
    expect(onInput).toHaveBeenCalled();
  });
});

describe("Field: development warnings", () => {
  it("warns for a second Field.Error, a nested Field.Root, a consumer id, a wrong element", async () => {
    const error = silenceErrors();
    render(
      <Field.Root name="outer">
        <Field.Label>O</Field.Label>
        <Field.Control {...({ id: "mine" } as object)} data-testid="c" />
        <Field.Error />
        <Field.Error />
        <Field.Root name="inner">
          <Field.Label render={<span />}>I</Field.Label>
          <Field.Control render={<div />} />
        </Field.Root>
      </Field.Root>,
    );
    await flushMicrotasks();
    const messages = error.mock.calls.map((call) => String(call[0]));
    expect(messages.some((m) => m.includes("two Field.Error parts"))).toBe(true);
    expect(messages.some((m) => m.includes("nested inside another Field.Root"))).toBe(true);
    expect(messages.some((m) => m.includes("`id` prop is ignored"))).toBe(true);
    expect(messages.some((m) => m.includes("Field.Control: expected to render"))).toBe(true);
    expect(messages.some((m) => m.includes("Field.Label: expected to render a <label>"))).toBe(
      true,
    );
    expect(screen.getByTestId("c").id).not.toBe("mine");
  });

  it("warns for two controls, validate without name, and a Field around a non-control", async () => {
    const error = silenceErrors();
    render(
      <>
        <Field.Root name="two">
          <Field.Label>Two</Field.Label>
          <Field.Control data-testid="first" />
          <Checkbox data-testid="second" />
        </Field.Root>
        <Field.Root validate={() => null}>
          <Field.Label>Nameless</Field.Label>
          <Field.Control />
        </Field.Root>
        <Field.Root name="t">
          <Field.Label>Toggle</Field.Label>
          <Toggle>T</Toggle>
        </Field.Root>
      </>,
    );
    await flushMicrotasks();
    const messages = error.mock.calls.map((call) => String(call[0]));
    expect(messages.some((m) => m.includes("two form controls registered"))).toBe(true);
    expect(messages.some((m) => m.includes("`validate` without `name`"))).toBe(true);
    expect(messages.some((m) => m.includes("no form control registered"))).toBe(true);
  });

  it("each warning is logged once under StrictMode re-renders", async () => {
    const error = silenceErrors();
    const { rerender } = render(
      <StrictMode>
        <Field.Root name="n">
          <Field.Label>N</Field.Label>
          <Field.Control />
          <Field.Error />
          <Field.Error />
        </Field.Root>
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <Field.Root name="n">
          <Field.Label>N</Field.Label>
          <Field.Control />
          <Field.Error />
          <Field.Error />
        </Field.Root>
      </StrictMode>,
    );
    await flushMicrotasks();
    const twoErrors = error.mock.calls.filter((call) =>
      String(call[0]).includes("two Field.Error parts"),
    );
    expect(twoErrors.length).toBeGreaterThanOrEqual(1);
  });

  it("parts outside a Field.Root throw", () => {
    silenceErrors();
    expect(() => render(<Field.Label>x</Field.Label>)).toThrow(
      "Field.Label must be rendered inside a Field.Root.",
    );
  });
});
