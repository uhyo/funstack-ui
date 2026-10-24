// Field rows that need a real engine (design/components/field-form.md 13.2): the platform's
// `:user-invalid` heuristic (jsdom answers `false` for it, see field.test.tsx), the cancelled
// bubble and the collector's focus against the browser's own focus move, a group's native
// message, `field-sizing`, and hydration of the server HTML. Runs on Chromium, Firefox and WebKit.
import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";
import { user } from "../__tests__/browser-user.js";
import { browserName } from "../__tests__/engine.js";
import { Form } from "../form/index.js";
import { RadioGroup } from "../radio-group/index.js";
import { Field } from "./index.js";
import { flushTasks } from "../__tests__/helpers.js";
import { settle } from "../__tests__/browser-helpers.js";

function EmailField({ name = "email" }: { name?: string }) {
  return (
    <Field.Root name={name} required data-testid={`${name}-root`}>
      <Field.Label>{name}</Field.Label>
      <Field.Control type="email" data-testid={`${name}-control`} />
      <Field.Description>We never share it.</Field.Description>
      <Field.Error data-testid={`${name}-error`} />
    </Field.Root>
  );
}

function TestForm({ children }: { children: React.ReactNode }) {
  return (
    <form action={() => {}} data-testid="form">
      {children}
      <button type="submit">Submit</button>
      <button type="button">Elsewhere</button>
    </form>
  );
}

const control = (name = "email") => screen.getByTestId(`${name}-control`) as HTMLInputElement;
const error = (name = "email") => screen.queryByTestId(`${name}-error`);
const form = () => screen.getByTestId("form") as HTMLFormElement;

describe("Field: :user-invalid timing", () => {
  it("no error while typing; shown on blur; live afterwards; hidden by a reset", async () => {
    render(
      <TestForm>
        <EmailField />
      </TestForm>,
    );
    await flushTasks();
    await user.type(control(), "a");
    await user.clear(control());
    // Still focused, never left: the platform does not flag it yet.
    expect(control().matches(":user-invalid")).toBe(false);
    expect(error()).toBeNull();
    expect(control()).toHaveAttribute("aria-invalid", "false");

    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(control().matches(":user-invalid")).toBe(true);
    expect(error()).toHaveTextContent(control().validationMessage);
    expect(control()).toHaveAttribute("aria-invalid", "true");

    // Live after the first blur: a typeMismatch while typing is shown, a valid value hides it.
    await user.type(control(), "a");
    expect(control().validity.typeMismatch).toBe(true);
    expect(error()).toHaveTextContent(control().validationMessage);
    await user.type(control(), "@b.c");
    expect(error()).toBeNull();

    await user.clear(control());
    expect(error()).not.toBeNull();
    await act(async () => form().reset());
    await flushTasks();
    expect(control().matches(":user-invalid")).toBe(false);
    expect(error()).toBeNull();
  });

  it("a submission attempt shows the error without a blur and focuses the control", async () => {
    render(
      <TestForm>
        <EmailField />
      </TestForm>,
    );
    await flushTasks();
    let invalid: Event | undefined;
    control().addEventListener("invalid", (event) => (invalid = event));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await flushTasks();
    expect(invalid?.defaultPrevented).toBe(true);
    expect(error()).toHaveTextContent(control().validationMessage);
    expect(control().validationMessage).not.toBe("");
    expect(document.activeElement).toBe(control());
  });

  it("checkValidity() shows nothing and cancels nothing; reportValidity() is not cancelled", async () => {
    render(
      <TestForm>
        <EmailField />
      </TestForm>,
    );
    await flushTasks();
    const events: Event[] = [];
    control().addEventListener("invalid", (event) => events.push(event));
    await act(async () => {
      expect(form().checkValidity()).toBe(false);
    });
    await flushTasks();
    expect(events).toHaveLength(1);
    expect(events[0]!.defaultPrevented).toBe(false);
    expect(error()).toBeNull();
    expect(document.activeElement).not.toBe(control());

    await act(async () => {
      expect(control().reportValidity()).toBe(false);
    });
    await flushTasks();
    expect(events).toHaveLength(2);
    // Not a submission attempt: the platform's UI is expected, so the Field leaves it alone.
    expect(events[1]!.defaultPrevented).toBe(false);
    expect(control().matches(":user-invalid")).toBe(false);
    expect(error()).toBeNull();
    // Dismiss the platform bubble (Firefox keeps it over the page).
    await user.type(control(), "x");
  });
});

describe("Field: bubble and focus", () => {
  it("focuses the first invalid control in document order across two Fields", async () => {
    render(
      <TestForm>
        <EmailField name="first" />
        <EmailField name="second" />
      </TestForm>,
    );
    await flushTasks();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await flushTasks();
    expect(document.activeElement).toBe(control("first"));
    expect(error("first")).not.toBeNull();
    expect(error("second")).not.toBeNull();
  });

  it("a plain <input required> before the Fields keeps the browser's own focus", async () => {
    render(
      <TestForm>
        <input required aria-label="plain" data-testid="plain" />
        <EmailField />
      </TestForm>,
    );
    await flushTasks();
    let plainInvalid: Event | undefined;
    screen.getByTestId("plain").addEventListener("invalid", (event) => (plainInvalid = event));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await flushTasks();
    expect(plainInvalid?.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(screen.getByTestId("plain"));
    // The Field still shows its own error.
    expect(error()).not.toBeNull();
    // Dismiss the platform bubble: Firefox keeps it over the page and it swallows the next
    // test's clicks.
    await user.type(screen.getByTestId("plain"), "x");
  });
});

describe("Field: group", () => {
  it("a required RadioGroup: the browser's radio message, focus on the first radio", async () => {
    render(
      <TestForm>
        <Field.Root name="plan" required>
          <Field.Label>Plan</Field.Label>
          <RadioGroup.Root data-testid="group">
            <label>
              <RadioGroup.Item value="free" /> Free
            </label>
            <label>
              <RadioGroup.Item value="pro" /> Pro
            </label>
          </RadioGroup.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
      </TestForm>,
    );
    await flushTasks();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await flushTasks();
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(screen.getByTestId("group")).toHaveAttribute("aria-invalid", "true");
    expect(radios[0]!.validationMessage).not.toBe("");
    expect(screen.getByTestId("error")).toHaveTextContent(radios[0]!.validationMessage);
    expect(document.activeElement).toBe(radios[0]);
    await user.click(radios[1]!);
    await settle(() => expect(screen.queryByTestId("error")).toBeNull());
  });
});

interface AXProperty {
  readonly name: string;
  readonly value: { readonly value?: unknown };
}
interface AXNode {
  readonly name?: { readonly value?: string };
  readonly description?: { readonly value?: string };
  readonly properties?: readonly AXProperty[];
}

/** The Chromium accessibility node named `name` (CDP; Chromium only, a test-tool limit). */
async function axNode(name: string): Promise<AXNode | undefined> {
  const session = cdp();
  // The test runs in an iframe of the runner page: read every frame's tree.
  interface FrameTree {
    readonly frame: { readonly id: string };
    readonly childFrames?: readonly FrameTree[];
  }
  const { frameTree } = (await session.send("Page.getFrameTree", {})) as { frameTree: FrameTree };
  const frameIds: string[] = [];
  const walk = (tree: FrameTree) => {
    frameIds.push(tree.frame.id);
    for (const child of tree.childFrames ?? []) walk(child);
  };
  walk(frameTree);
  const nodes: AXNode[] = [];
  for (const frameId of frameIds) {
    const result = (await session.send("Accessibility.getFullAXTree", { frameId })) as {
      nodes: AXNode[];
    };
    nodes.push(...result.nodes);
  }
  return nodes.find(
    (node) => node.name?.value === name && node.properties?.some((p) => p.name === "invalid"),
  );
}
const axInvalid = (node: AXNode | undefined) =>
  node?.properties?.find((p) => p.name === "invalid")?.value.value;

// The accessibility tree is read through the Chrome DevTools Protocol, which only Chromium
// exposes to the test runner; the attributes this relies on are asserted in every engine above.
describe.runIf(browserName === "chromium")("Field: accessibility tree (Chromium, CDP)", () => {
  it("aria-invalid overrides the native state both ways; the description includes the error", async () => {
    render(
      <TestForm>
        <Field.Root name="mail">
          <Field.Label>Mail</Field.Label>
          <Field.Control type="email" defaultValue="not-an-email" />
        </Field.Root>
        <Field.Root name="given" required>
          <Field.Label>Given</Field.Label>
          <Field.Control />
          <Field.Description>Your first name.</Field.Description>
          <Field.Error />
        </Field.Root>
      </TestForm>,
    );
    await flushTasks();
    // A typeMismatch the user has not been told about: not exposed as invalid.
    expect(axInvalid(await axNode("Mail"))).toBe("false");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await flushTasks();
    // valueMissing, which Chromium never exposes natively: exposed through aria-invalid.
    const given = await axNode("Given");
    expect(axInvalid(given)).toBe("true");
    const message = (screen.getAllByRole("textbox")[1] as HTMLInputElement).validationMessage;
    expect(given?.description?.value).toBe(`Your first name. ${message}`);
  });
});

describe("Field: field-sizing", () => {
  it("a textarea with field-sizing: content grows with its content where supported", async () => {
    render(
      <Field.Root name="body">
        <Field.Label>Body</Field.Label>
        <Field.Control
          render={<textarea rows={1} />}
          style={{ fieldSizing: "content", minHeight: "1lh" } as React.CSSProperties}
          data-testid="ta"
        />
      </Field.Root>,
    );
    await flushTasks();
    const ta = screen.getByTestId("ta") as HTMLTextAreaElement;
    const before = ta.getBoundingClientRect().height;
    await user.type(ta, "one{Enter}two{Enter}three");
    const after = ta.getBoundingClientRect().height;
    if (CSS.supports("field-sizing: content")) {
      expect(after).toBeGreaterThan(before);
    } else {
      // Documented degraded behaviour: the textarea keeps its `rows` height (and scrolls).
      expect(after).toBe(before);
    }
  });
});

describe("Field: progressive enhancement", () => {
  let root: Root | undefined;
  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    document.querySelector("[data-pe]")?.remove();
  });

  it("the server HTML carries the wiring; hydration changes nothing but a group's for", async () => {
    function App() {
      return (
        <form action="/subscribe">
          <Field.Root name="email" required>
            <Field.Label>Email</Field.Label>
            <Field.Control type="email" autoComplete="email" />
            <Field.Description>We never share it.</Field.Description>
            <Field.Error />
          </Field.Root>
          <Field.Root name="plan">
            <Field.Label>Plan</Field.Label>
            <RadioGroup.Root>
              <RadioGroup.Item value="a" aria-label="A" />
            </RadioGroup.Root>
          </Field.Root>
        </form>
      );
    }
    const html = renderToString(<App />);
    const container = document.createElement("div");
    container.dataset["pe"] = "";
    container.innerHTML = html;
    document.body.append(container);
    const [emailLabel, planLabel] = container.querySelectorAll("label");
    const input = container.querySelector("input[type=email]")!;
    const fieldset = container.querySelector("fieldset")!;
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input.getAttribute("aria-describedby")).toMatch(/-description$/);
    expect(emailLabel).toHaveAttribute("for", input.id);
    expect(input).toBeRequired();
    // A group Field's label carries `for` until hydration removes it.
    expect(planLabel).toHaveAttribute("for");
    expect(fieldset).toHaveAttribute("aria-labelledby", planLabel!.id);
    const before = input.outerHTML;

    const recoverable: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(container, <App />, {
        onRecoverableError: (e) => recoverable.push(e),
      });
    });
    await flushTasks();
    expect(recoverable).toEqual([]);
    expect(container.querySelector("input[type=email]")).toBe(input);
    expect(input.outerHTML).toBe(before);
    expect(emailLabel).toHaveAttribute("for", input.id);
    expect(planLabel).not.toHaveAttribute("for");
  });

  it("Form.Root with a Server Function and errors: the server HTML posts to it and shows the error", async () => {
    // A stand-in for a Server Function reference: react-dom's server renderer asks it for the
    // form attributes through `$$FORM_ACTION` (what a bundler's server reference provides).
    const calls: FormData[] = [];
    const subscribe = Object.assign(
      async (formData: FormData) => {
        calls.push(formData);
      },
      {
        $$FORM_ACTION: () => ({
          action: "/__sf/subscribe",
          method: "POST",
          encType: "multipart/form-data",
          name: "$ACTION_ID_subscribe",
          data: null,
        }),
      },
    );
    function App() {
      return (
        <Form.Root action={subscribe} errors={{ email: "Already registered." }}>
          <Field.Root name="email" required>
            <Field.Label>Email</Field.Label>
            <Field.Control type="email" defaultValue="a@b.c" />
            <Field.Description>We never share it.</Field.Description>
            <Field.Error data-testid="pe-error" />
          </Field.Root>
          <Form.Submit>Subscribe</Form.Submit>
        </Form.Root>
      );
    }
    const html = renderToString(<App />);
    const container = document.createElement("div");
    container.dataset["pe"] = "";
    container.innerHTML = html;
    document.body.append(container);
    const form = container.querySelector("form")!;
    const input = container.querySelector("input[type=email]")!;
    const error = container.querySelector("[data-testid=pe-error]")!;
    // Before hydration the form posts to the Server Function (progressive enhancement).
    expect(form).toHaveAttribute("action", "/__sf/subscribe");
    expect(form.method).toBe("post");
    expect(form.enctype).toBe("multipart/form-data");
    expect(container.querySelector('input[type=hidden][name="$ACTION_ID_subscribe"]')).not.toBe(
      null,
    );
    // The server error is in the server HTML, wired to the control.
    expect(error).toHaveTextContent("Already registered.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")!.split(" ")).toContain(error.id);
    expect(input).toHaveAttribute("data-invalid");
    const before = input.outerHTML;

    const recoverable: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(container, <App />, {
        onRecoverableError: (e) => recoverable.push(e),
      });
    });
    await flushTasks();
    expect(recoverable).toEqual([]);
    expect(container.querySelector("input[type=email]")).toBe(input);
    expect(input.outerHTML).toBe(before);
    expect(error.isConnected).toBe(true);
    expect(error).toHaveTextContent("Already registered.");
    // Hydrated: the server error is in the custom validity, so a resubmission is blocked.
    expect((input as HTMLInputElement).validationMessage).toBe("Already registered.");
    // The user's edit dismisses it; the Form then runs the action itself.
    await user.clear(input);
    await user.type(input, "new@b.c");
    await settle(() => expect(container.querySelector("[data-testid=pe-error]")).toBe(null));
    await user.click(container.querySelector("button")!);
    await settle(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.get("email")).toBe("new@b.c");
  });
});
