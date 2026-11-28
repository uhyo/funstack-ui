// #217: a Field control references the ids of `Field.Label`, `Field.Description` and
// `Field.Error` only while that part is mounted (design/components/field-form.md 4.2,
// "Referenced only while mounted"), for every control that joins a Field. The server HTML keeps
// every reference (the Field cannot know what is rendered after the control); hydration matches
// it and drops the ones without a part.
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { flushMicrotasks } from "../__tests__/helpers.js";
import { Checkbox } from "../checkbox/index.js";
import { CheckboxGroup } from "../checkbox-group/index.js";
import { Combobox } from "../combobox/index.js";
import { Form } from "../form/index.js";
import type { FormErrors } from "../form/index.js";
import { MultiSelect } from "../multi-select/index.js";
import { NumberField } from "../number-field/index.js";
import { OTPField } from "../otp-field/index.js";
import { RadioGroup } from "../radio-group/index.js";
import { Select } from "../select/index.js";
import { Slider } from "../slider/index.js";
import { Switch } from "../switch/index.js";
import { TextField } from "../text-field/index.js";
import { Field } from "./index.js";

// `aria-controls` is left out: a combobox's points at its List, which is not rendered while the
// popup is closed (combobox.md 1, multi-select.md 1: the attribute ARIA 1.2 requires on the role).
const IDREF_ATTRIBUTES = ["aria-labelledby", "aria-describedby", "aria-errormessage"] as const;

/** Every idref token under `root` that names no element of the document. */
function danglingRefs(root: ParentNode): string[] {
  const out: string[] = [];
  for (const attribute of IDREF_ATTRIBUTES) {
    for (const element of root.querySelectorAll(`[${attribute}]`)) {
      for (const token of (element.getAttribute(attribute) ?? "").split(/\s+/)) {
        if (token !== "" && element.ownerDocument.getElementById(token) === null) {
          out.push(`${attribute}="${token}" on <${element.tagName.toLowerCase()}>`);
        }
      }
    }
  }
  return out;
}

function tokens(element: Element, attribute: string): string[] {
  return (element.getAttribute(attribute) ?? "").split(/\s+/).filter((t) => t !== "");
}

/** The Field's ids, derived from the control's (`${id}-control`), the shape field-root.tsx uses. */
function fieldIdsOf(controlId: string) {
  const base = controlId.replace(/-control$/, "");
  return { label: `${base}-label`, description: `${base}-description`, error: `${base}-error` };
}

interface ControlCase {
  readonly name: string;
  /** The control, named by an `aria-label` of its own so it is named without a `Field.Label`. */
  readonly control: ReactNode;
  /** The element whose `aria-describedby` lists the description and error ids. */
  readonly described: (root: HTMLElement) => Element;
  /**
   * The elements whose `aria-labelledby` lists the Field label's id while it is mounted. A
   * `keepMounted` List is rendered on the client only, so it is missing from the server HTML.
   */
  readonly labelledBy: (root: HTMLElement) => Element[];
  /** How many of them the client renders (the late-mount row checks it, so none is skipped). */
  readonly referrers: number;
  /** An element that carries a Field id, for `fieldIdsOf`. */
  readonly controlId: (root: HTMLElement) => string;
}

const byTestId = (root: HTMLElement, id: string): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const own = (root: HTMLElement) => byTestId(root, "c");
const ownId = (root: HTMLElement) => own(root).id;
const thumbInput = (root: HTMLElement) => own(root).querySelector("input")!;
/** A group control's Field id: its `name` defaults to the Field's, so read a member's id instead. */
const groupId = (root: HTMLElement) =>
  // `aria-describedby` survives every state of these tests (the description is always rendered
  // when this is read); its first Field token ends in `-description`.
  tokens(own(root), "aria-describedby")
    .find((t) => t.endsWith("-description"))!
    .replace(/-description$/, "-control");

const CASES: readonly ControlCase[] = [
  {
    name: "Field.Control",
    control: <Field.Control data-testid="c" aria-label="F" />,
    described: own,
    labelledBy: () => [],
    referrers: 0,
    controlId: ownId,
  },
  {
    name: "TextField",
    control: <TextField data-testid="c" aria-label="F" />,
    described: own,
    labelledBy: () => [],
    referrers: 0,
    controlId: ownId,
  },
  {
    name: "Checkbox",
    control: <Checkbox data-testid="c" aria-label="F" />,
    described: own,
    labelledBy: () => [],
    referrers: 0,
    controlId: ownId,
  },
  {
    name: "Switch",
    control: <Switch data-testid="c" aria-label="F" />,
    described: own,
    labelledBy: () => [],
    referrers: 0,
    controlId: ownId,
  },
  {
    name: "Select",
    control: (
      <Select.Root data-testid="c" aria-label="F" defaultValue="a">
        <Select.Option value="a">A</Select.Option>
      </Select.Root>
    ),
    described: own,
    labelledBy: () => [],
    referrers: 0,
    controlId: ownId,
  },
  {
    name: "RadioGroup (a group: aria-labelledby on the fieldset)",
    control: (
      <RadioGroup.Root data-testid="c" aria-label="F">
        <RadioGroup.Item value="a" aria-label="A" />
      </RadioGroup.Root>
    ),
    described: own,
    labelledBy: (root) => [own(root)],
    referrers: 1,
    controlId: groupId,
  },
  {
    name: "CheckboxGroup (a group: aria-labelledby on the fieldset)",
    control: (
      <CheckboxGroup.Root data-testid="c" aria-label="F">
        <CheckboxGroup.Item value="a" aria-label="A" />
      </CheckboxGroup.Root>
    ),
    described: own,
    labelledBy: (root) => [own(root)],
    referrers: 1,
    controlId: groupId,
  },
  {
    name: "Slider, one thumb",
    control: (
      <Slider.Root defaultValue={40}>
        <Slider.Track>
          <Slider.Thumb data-testid="c" aria-label="F" />
        </Slider.Track>
      </Slider.Root>
    ),
    described: thumbInput,
    labelledBy: () => [],
    referrers: 0,
    controlId: (root) => thumbInput(root).id,
  },
  {
    name: "Slider, two thumbs (a group: aria-labelledby on the Root)",
    control: (
      <Slider.Root defaultValue={[20, 60]} data-testid="c" aria-label="F">
        <Slider.Track>
          <Slider.Thumb index={0} aria-label="Min" />
          <Slider.Thumb index={1} aria-label="Max" />
        </Slider.Track>
      </Slider.Root>
    ),
    described: own,
    labelledBy: (root) => [own(root)],
    referrers: 1,
    controlId: groupId,
  },
  {
    name: "NumberField (the step buttons append the label)",
    control: (
      <NumberField.Root locale="en-US">
        <NumberField.Decrement data-testid="dec" />
        <NumberField.Input data-testid="c" aria-label="F" />
        <NumberField.Increment data-testid="inc" />
      </NumberField.Root>
    ),
    described: own,
    labelledBy: (root) => [byTestId(root, "dec"), byTestId(root, "inc")],
    referrers: 2,
    controlId: ownId,
  },
  {
    name: "OTPField",
    control: (
      <OTPField.Root length={2}>
        <OTPField.Input data-testid="c" aria-label="F" />
        <OTPField.Slot index={0} />
        <OTPField.Slot index={1} />
      </OTPField.Root>
    ),
    described: own,
    labelledBy: () => [],
    referrers: 0,
    controlId: ownId,
  },
  {
    name: "Combobox (the List is named by the Field label)",
    control: (
      <Combobox.Root>
        <Combobox.Input data-testid="c" aria-label="F" />
        <Combobox.Popup keepMounted>
          <Combobox.List data-testid="list" aria-label="Options">
            <Combobox.Option value="a">A</Combobox.Option>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Root>
    ),
    described: own,
    labelledBy: (root) => [byTestId(root, "list")].filter((e) => e !== null),
    referrers: 1,
    controlId: ownId,
  },
  {
    name: "MultiSelect (the List is named by the Field label)",
    control: (
      <MultiSelect.Root>
        <MultiSelect.Trigger data-testid="c" aria-label="F">
          <MultiSelect.Value />
        </MultiSelect.Trigger>
        <MultiSelect.Popup keepMounted>
          <MultiSelect.List data-testid="list" aria-label="Options">
            <MultiSelect.Option value="a">A</MultiSelect.Option>
          </MultiSelect.List>
        </MultiSelect.Popup>
      </MultiSelect.Root>
    ),
    described: own,
    labelledBy: (root) => [byTestId(root, "list")].filter((e) => e !== null),
    referrers: 1,
    controlId: ownId,
  },
];

const ERRORS: FormErrors = { f: "Taken." };

interface PartsProps {
  readonly control: ReactNode;
  readonly label?: boolean;
  readonly description?: boolean;
  readonly error?: boolean;
  /** A server error for the field: the Field is invalid from the start, so the error id may be listed. */
  readonly invalid?: boolean;
}

function Parts({ control, label, description, error, invalid = false }: PartsProps) {
  return (
    <Form.Root errors={invalid ? ERRORS : undefined}>
      <Field.Root name="f" data-testid="field">
        {label === true && <Field.Label>Field</Field.Label>}
        {control}
        {description === true && <Field.Description>Help</Field.Description>}
        {error === true && <Field.Error />}
      </Field.Root>
    </Form.Root>
  );
}

/** The groups need a description to find their Field id; read it from a render with all parts. */
function idsOf(c: ControlCase, root: HTMLElement) {
  return fieldIdsOf(c.controlId(root));
}

describe.each(CASES)("$name inside a Field.Root (#217)", (c) => {
  it("references no Label, Description or Error that is not mounted, valid or invalid", async () => {
    const { rerender, container } = render(<Parts control={c.control} />);
    await flushMicrotasks();
    expect(danglingRefs(document.body)).toEqual([]);
    for (const el of c.labelledBy(container))
      expect(el.getAttribute("aria-labelledby") ?? "").not.toMatch(/-label\b/);
    expect(c.described(container)).not.toHaveAttribute("aria-describedby");

    rerender(<Parts control={c.control} invalid />);
    await flushMicrotasks();
    expect(screen.getByTestId("field")).toHaveAttribute("data-invalid");
    expect(danglingRefs(document.body)).toEqual([]);
    expect(c.described(container)).not.toHaveAttribute("aria-describedby");
  });

  it("lists a part mounted later, and drops it again when it unmounts", async () => {
    function App() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button type="button" data-testid="toggle" onClick={() => setShown((s) => !s)} />
          <Parts control={c.control} label={shown} description={shown} error={shown} invalid />
        </>
      );
    }
    const { container } = render(<App />);
    await flushMicrotasks();
    expect(danglingRefs(document.body)).toEqual([]);

    await act(async () => screen.getByTestId("toggle").click());
    const ids = idsOf(c, container);
    expect(document.getElementById(ids.label)).not.toBeNull();
    expect(c.labelledBy(container)).toHaveLength(c.referrers);
    for (const el of c.labelledBy(container)) {
      expect(tokens(el, "aria-labelledby")).toContain(ids.label);
    }
    expect(tokens(c.described(container), "aria-describedby")).toEqual([
      ids.description,
      ids.error,
    ]);
    expect(danglingRefs(document.body)).toEqual([]);

    await act(async () => screen.getByTestId("toggle").click());
    for (const el of c.labelledBy(container)) {
      expect(tokens(el, "aria-labelledby")).not.toContain(ids.label);
    }
    expect(c.described(container)).not.toHaveAttribute("aria-describedby");
    expect(danglingRefs(document.body)).toEqual([]);
  });

  async function hydrate(ui: ReactNode) {
    const container = document.createElement("div");
    container.innerHTML = renderToString(ui);
    document.body.append(container);
    const server = container.cloneNode(true) as HTMLElement;
    const error = vi.spyOn(console, "error");
    const recoverable: unknown[] = [];
    const root = await act(async () =>
      hydrateRoot(container, ui, { onRecoverableError: (e) => recoverable.push(e) }),
    );
    onTestFinished(() => act(() => root.unmount()));
    await flushMicrotasks();
    expect(recoverable).toEqual([]);
    expect(error).not.toHaveBeenCalled();
    return { container, server };
  }

  it("server HTML with every part references them; hydration keeps them without a warning", async () => {
    const { container, server } = await hydrate(
      <Parts control={c.control} label description error invalid />,
    );
    const ids = idsOf(c, server);
    for (const root of [server, container]) {
      for (const el of c.labelledBy(root)) {
        expect(tokens(el, "aria-labelledby")).toContain(ids.label);
      }
      expect(tokens(c.described(root), "aria-describedby")).toEqual([ids.description, ids.error]);
    }
    expect(danglingRefs(container)).toEqual([]);
  });

  it("server HTML without the parts keeps the references; hydration drops them without a warning", async () => {
    // The trade-off of design 4.2: before the first commit every part counts as mounted, so the
    // server HTML of a Field without them references ids no element has, until hydration.
    const { container, server } = await hydrate(<Parts control={c.control} invalid />);
    const ids = idsOf(c, server);
    expect(tokens(c.described(server), "aria-describedby")).toEqual([ids.description, ids.error]);
    for (const el of c.labelledBy(server)) {
      expect(tokens(el, "aria-labelledby")).toContain(ids.label);
    }
    expect(c.described(container)).not.toHaveAttribute("aria-describedby");
    for (const el of c.labelledBy(container)) {
      expect(tokens(el, "aria-labelledby")).not.toContain(ids.label);
    }
    expect(danglingRefs(container)).toEqual([]);
  });
});
