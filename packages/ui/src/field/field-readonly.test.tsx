// `Field.Root readOnly` and a read-only control inside a Field (conventions 3.6.1,
// design/components/field-form.md 4.1, 4.3, 6.1): "own or the Field's" like `disabled`,
// `data-readonly` on every Field part, and the control barred from constraint validation: the
// custom-validity slot stays empty (`validate` and a server error never block), its own
// `input` / `change` is not an edit, and a server error is still shown. The text controls render
// `data-readonly` and take the Field's `readOnly`.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { flushMicrotasks, hydrateFromServer, silenceErrors } from "../__tests__/helpers.js";
import { Checkbox } from "../checkbox/index.js";
import { Form } from "../form/index.js";
import { NumberField } from "../number-field/index.js";
import { OTPField } from "../otp-field/index.js";
import { TextField } from "../text-field/index.js";
import { Field } from "./index.js";

const control = () => screen.getByTestId("c") as HTMLInputElement;

describe("Field.Root readOnly", () => {
  it("every part carries data-readonly and readOnly in its state; Field.Control renders native readonly", () => {
    const rootState = vi.fn(() => "r");
    render(
      <Field.Root name="handle" readOnly className={rootState} data-testid="root">
        <Field.Label data-testid="label">Handle</Field.Label>
        <Field.Control data-testid="c" />
        <Field.Description data-testid="desc">Shown on your profile.</Field.Description>
      </Field.Root>,
    );
    for (const id of ["root", "label", "c", "desc"]) {
      expect(screen.getByTestId(id)).toHaveAttribute("data-readonly", "");
    }
    expect(control()).toHaveAttribute("readonly");
    expect(control()).not.toHaveAttribute("aria-readonly");
    expect(rootState).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
  });

  it("an explicit readOnly={false} on the control does not override the Field", () => {
    render(
      <Field.Root name="handle" readOnly>
        <Field.Control data-testid="c" readOnly={false} />
      </Field.Root>,
    );
    expect(control()).toHaveAttribute("readonly");
  });

  it("the control's own readOnly marks the Field parts (through the registration)", () => {
    render(
      <Field.Root name="handle" data-testid="root">
        <Field.Control data-testid="c" readOnly />
      </Field.Root>,
    );
    expect(screen.getByTestId("root")).toHaveAttribute("data-readonly", "");
    expect(control()).toHaveAttribute("readonly");
  });

  it("not read-only: no data-readonly anywhere", () => {
    render(
      <Field.Root name="handle" data-testid="root">
        <Field.Control data-testid="c" />
      </Field.Root>,
    );
    expect(screen.getByTestId("root")).not.toHaveAttribute("data-readonly");
    expect(control()).not.toHaveAttribute("readonly");
  });

  it("validate never reaches the slot while read-only; it does again when the lock goes", async () => {
    const validate = () => "Not allowed.";
    const { rerender } = render(
      <Field.Root name="handle" readOnly validate={validate}>
        <Field.Control data-testid="c" defaultValue="x" />
      </Field.Root>,
    );
    await flushMicrotasks();
    expect(control().validity.customError).toBe(false);
    rerender(
      <Field.Root name="handle" validate={validate}>
        <Field.Control data-testid="c" defaultValue="x" />
      </Field.Root>,
    );
    await flushMicrotasks();
    expect(control().validationMessage).toBe("Not allowed.");
  });

  it("a server error is shown but does not block, and the control's events do not dismiss it", async () => {
    render(
      <Form.Root action={() => {}} errors={{ handle: "Taken." }} data-testid="form">
        <Field.Root name="handle" readOnly data-testid="root">
          <Field.Control data-testid="c" defaultValue="x" />
          <Field.Error data-testid="error" />
        </Field.Root>
      </Form.Root>,
    );
    await flushMicrotasks();
    expect(screen.getByTestId("root")).toHaveAttribute("data-invalid", "");
    expect(screen.getByTestId("error")).toHaveTextContent("Taken.");
    expect(control().validationMessage).toBe("");
    expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(true);
    // A stray input (autofill writing past `readonly`) is not an edit.
    fireEvent.input(control(), { target: { value: "y" } });
    await flushMicrotasks();
    expect(screen.getByTestId("error")).toHaveTextContent("Taken.");
  });

  it("a read-only checkbox inside a required Field never blocks (native required withheld)", () => {
    render(
      <form data-testid="form">
        <Field.Root name="agree" required readOnly>
          <Field.Label>Agree</Field.Label>
          <Checkbox data-testid="c" />
        </Field.Root>
      </form>,
    );
    expect(control()).not.toBeRequired();
    expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(true);
  });

  it("Field.Control warns in development on an element readonly does not apply to", () => {
    const consoleError = silenceErrors();
    render(
      <Field.Root name="agree" readOnly>
        <Field.Control data-testid="c" type="checkbox" />
      </Field.Root>,
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('`readOnly` has no effect on <input type="checkbox">'),
    );
    consoleError.mockRestore();
  });

  it("Field.Control warns for a <select> render; not for a text input or a textarea", () => {
    const consoleError = silenceErrors();
    const { unmount } = render(
      <Field.Root name="a" readOnly>
        <Field.Control
          render={
            <select>
              <option>x</option>
            </select>
          }
        />
      </Field.Root>,
    );
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("no effect on <select>"));
    unmount();
    consoleError.mockClear();
    render(
      <>
        <Field.Root name="b" readOnly>
          <Field.Control aria-label="b" />
        </Field.Root>
        <Field.Root name="c" readOnly>
          <Field.Control aria-label="c" render={<textarea />} />
        </Field.Root>
      </>,
    );
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("Field.Control outside a Field: readOnly passes through and the state reports it", () => {
    const className = vi.fn(() => "c");
    render(<Field.Control data-testid="c" aria-label="q" readOnly className={className} />);
    expect(control()).toHaveAttribute("readonly");
    expect(control()).not.toHaveAttribute("data-readonly");
    expect(className).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
  });
});

describe("the text controls: data-readonly, and the Field's readOnly", () => {
  it("TextField: data-readonly from its own prop and from Field.Root readOnly", () => {
    const { unmount } = render(<TextField aria-label="Name" data-testid="c" readOnly />);
    expect(control()).toHaveAttribute("readonly");
    expect(control()).toHaveAttribute("data-readonly", "");
    unmount();
    render(
      <Field.Root name="name" readOnly>
        <Field.Label>Name</Field.Label>
        <TextField data-testid="c" />
      </Field.Root>,
    );
    expect(control()).toHaveAttribute("readonly");
    expect(control()).toHaveAttribute("data-readonly", "");
  });

  it("NumberField: data-readonly on every part; the Field's readOnly disables the buttons", () => {
    render(
      <Field.Root name="qty" readOnly>
        <Field.Label>Quantity</Field.Label>
        <NumberField.Root defaultValue={1} data-testid="root">
          <NumberField.Decrement data-testid="dec" />
          <NumberField.Input data-testid="c" />
          <NumberField.Increment data-testid="inc" />
        </NumberField.Root>
      </Field.Root>,
    );
    expect(control()).toHaveAttribute("readonly");
    for (const id of ["root", "c", "dec", "inc"]) {
      expect(screen.getByTestId(id)).toHaveAttribute("data-readonly", "");
    }
    expect(screen.getByTestId("inc")).toBeDisabled();
    expect(screen.getByTestId("inc")).toHaveAttribute("data-disabled", "");
  });

  it("OTPField: data-readonly on the Root and the Input; the Field's readOnly", () => {
    render(
      <Field.Root name="code" readOnly>
        <Field.Label>Code</Field.Label>
        <OTPField.Root length={4} data-testid="root">
          <OTPField.Input data-testid="c" />
        </OTPField.Root>
      </Field.Root>,
    );
    expect(control()).toHaveAttribute("readonly");
    expect(control()).toHaveAttribute("data-readonly", "");
    expect(screen.getByTestId("root")).toHaveAttribute("data-readonly", "");
  });

  it("a read-only TextField whose DOM text differs at hydration is restored, not dispatched", async () => {
    const commit = vi.fn();
    await hydrateFromServer(
      <TextField
        aria-label="Name"
        data-testid="c"
        readOnly
        defaultValue="Ada"
        valueCommitAction={commit}
      />,
      {
        mutate: (container) => {
          container.querySelector("input")!.value = "Grace";
        },
      },
    );
    await act(async () => {});
    expect(control().value).toBe("Ada");
    expect(commit).not.toHaveBeenCalled();
  });

  it("a read-only NumberField whose DOM text differs at hydration is restored, not dispatched", async () => {
    const commit = vi.fn();
    await hydrateFromServer(
      <NumberField.Root locale="en-US" readOnly defaultValue={5} valueCommitAction={commit}>
        <NumberField.Input data-testid="c" aria-label="Qty" />
      </NumberField.Root>,
      {
        mutate: (container) => {
          container.querySelector("input")!.value = "9";
        },
      },
    );
    expect(control().value).toBe("5");
    expect(commit).not.toHaveBeenCalled();
  });

  it("a read-only OTPField whose DOM text differs at hydration is restored, not dispatched", async () => {
    const onValueChange = vi.fn();
    await hydrateFromServer(
      <OTPField.Root length={4} readOnly defaultValue="12" onValueChange={onValueChange}>
        <OTPField.Input data-testid="c" aria-label="Code" />
      </OTPField.Root>,
      {
        mutate: (container) => {
          container.querySelector("input")!.value = "9876";
        },
      },
    );
    expect(control().value).toBe("12");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
