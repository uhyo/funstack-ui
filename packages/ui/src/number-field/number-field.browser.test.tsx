// NumberField rows that need a real engine (design/components/number-field.md 14.2): real keys
// and the caret, real typing with a locale, the browser's own report on the visible input, a real
// submit inside a Field, Enter's implicit submission, a real wheel and the page scroll, a real
// press-and-hold, the announcements, the accessibility tree (Chromium, CDP), text typed before
// hydration, and no document view transition. Runs in Chromium, Firefox and WebKit.
import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { cdp, userEvent } from "vitest/browser";
import { user } from "../__tests__/browser-user.js";
import { browserName, supportsAriaNotify } from "../__tests__/engine.js";
import { Field } from "../field/index.js";
import { Form } from "../form/index.js";
import { NumberField } from "./index.js";
import type { NumberFieldRootProps, NumberFieldValueChangeDetails } from "./index.js";

type Fn = (next: number | null, details: NumberFieldValueChangeDetails) => unknown;

const flush = () => act(async () => {});

function Fixture(props: Partial<NumberFieldRootProps>) {
  return (
    <NumberField.Root data-testid="root" locale="en-US" {...props}>
      <NumberField.Label>Quantity</NumberField.Label>
      <NumberField.Decrement data-testid="dec">−</NumberField.Decrement>
      <NumberField.Input data-testid="input" />
      <NumberField.Increment data-testid="inc" style={{ inlineSize: 40, blockSize: 30 }}>
        +
      </NumberField.Increment>
    </NumberField.Root>
  );
}

const input = () => screen.getByTestId("input") as HTMLInputElement;
const hidden = () => input().nextElementSibling as HTMLInputElement;
const inc = () => screen.getByTestId("inc");

async function focusInput(): Promise<void> {
  await act(async () => input().focus());
}

describe("NumberField (browser)", () => {
  describe("real keys and typing", () => {
    it("Arrow, Page, Home and End step; one commit per press", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture defaultValue={50} min={0} max={100} valueCommitAction={onCommit} />);
      await focusInput();
      const expected: [string, string][] = [
        ["{ArrowUp}", "51"],
        ["{ArrowDown}", "50"],
        ["{PageUp}", "60"],
        ["{PageDown}", "50"],
        ["{Shift>}{ArrowUp}{/Shift}", "60"],
        ["{Home}", "0"],
        ["{End}", "100"],
      ];
      for (const [key, value] of expected) {
        await user.keyboard(key);
        await flush();
        expect(input().value, key).toBe(value);
        expect(hidden().value, key).toBe(value);
      }
      expect(onCommit).toHaveBeenCalledTimes(expected.length);
      expect(onCommit.mock.calls.every(([, d]) => d.source === "keyboard")).toBe(true);
    });

    it("Home / End without bounds move the caret", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Fixture defaultValue={1234} valueCommitAction={onCommit} />);
      await focusInput();
      await user.keyboard("{End}");
      expect(input().selectionStart).toBe(input().value.length);
      await user.keyboard("{Home}");
      expect(input().selectionStart).toBe(0);
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("1,5 under de-DE commits 1.5; under en-US it reverts", async () => {
      const onCommit = vi.fn<Fn>();
      const { unmount } = render(
        <>
          <Fixture locale="de-DE" defaultValue={1} valueCommitAction={onCommit} />
          <button type="button">next</button>
        </>,
      );
      await user.clear(input());
      await user.type(input(), "1,5");
      await user.tab();
      await flush();
      expect(hidden().value).toBe("1.5");
      expect(input().value).toBe("1,5");
      expect(onCommit.mock.calls[0]![0]).toBe(1.5);
      unmount();
      onCommit.mockClear();
      render(
        <>
          <Fixture locale="en-US" defaultValue={1} valueCommitAction={onCommit} />
          <button type="button">next</button>
        </>,
      );
      await user.clear(input());
      await user.type(input(), "1,5");
      await user.tab();
      await flush();
      expect(input().value).toBe("1");
      expect(hidden().value).toBe("1");
      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  it("bare in a form: the browser reports on the visible input, never the hidden one", async () => {
    const submitted = vi.fn();
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitted();
        }}
      >
        <Fixture name="quantity" defaultValue={1} min={1} />
        <button type="submit">Save</button>{" "}
      </form>,
    );
    let hiddenFocused = false;
    hidden().addEventListener("focus", () => {
      hiddenFocused = true;
    });
    await user.clear(input());
    await user.type(input(), "0");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await flush();
    expect(submitted).not.toHaveBeenCalled();
    expect(hidden().validity.rangeUnderflow).toBe(true);
    expect(input().validationMessage).not.toBe("");
    expect(input().validationMessage).toBe(hidden().validationMessage);
    expect(document.activeElement).toBe(input());
    expect(input().matches(":user-invalid")).toBe(true);
    expect(hiddenFocused).toBe(false);
    // Dismiss the platform bubble: Firefox keeps it over the page and it swallows the next
    // test's clicks. Typing alone does not hide it here (the visible input stays invalid until
    // the draft commits), so commit a valid value.
    await user.clear(input());
    await user.type(input(), "5");
    await user.tab();
  });

  it("inside a Field: a step mismatch blocks the submit on the visible input; a real + fixes it", async () => {
    const action = vi.fn<(formData: FormData) => void>();
    render(
      <Form.Root action={action}>
        <Field.Root name="quantity">
          <Field.Label>Quantity</Field.Label>
          <NumberField.Root locale="en-US" min={6} max={120} step={6} defaultValue={6}>
            <NumberField.Decrement>−</NumberField.Decrement>
            <NumberField.Input data-testid="input" />
            <NumberField.Increment data-testid="inc">+</NumberField.Increment>
          </NumberField.Root>
          <Field.Error data-testid="error">
            {({ validity, messages }) =>
              validity.stepMismatch ? "Enter a multiple of six." : messages.join(" ")
            }
          </Field.Error>
        </Field.Root>
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    await flush();
    const invalid: Event[] = [];
    input().addEventListener("invalid", (e) => invalid.push(e));
    let hiddenFocused = false;
    hidden().addEventListener("focus", () => {
      hiddenFocused = true;
    });
    await user.clear(input());
    await user.type(input(), "7");
    // Changed, then blurred: `:user-invalid` on the visible input shows the error at once. (Tab
    // first: a click on Save would blur too, and the error appearing between its mousedown and
    // mouseup would move the button away from the pointer in this unstyled layout.)
    await user.tab();
    await flush();
    expect(input().matches(":user-invalid")).toBe(true);
    expect(screen.getByTestId("error")).toHaveTextContent("Enter a multiple of six.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await flush();
    expect(action).not.toHaveBeenCalled();
    expect(invalid).toHaveLength(1);
    expect(invalid[0]!.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input());
    expect(input().matches(":user-invalid")).toBe(true);
    expect(hiddenFocused).toBe(false);
    expect(screen.getByTestId("error")).toHaveTextContent("Enter a multiple of six.");

    await user.click(inc());
    await flush();
    expect(input().value).toBe("12");
    expect(screen.queryByTestId("error")).toBeNull();
    expect(input().matches(":user-invalid")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Save" }));
    await flush();
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]![0].get("quantity")).toBe("12");
  });

  it("Enter submits with the new value", async () => {
    const action = vi.fn<(formData: FormData) => void>();
    render(
      <Form.Root action={action}>
        <Fixture name="quantity" defaultValue={1} />
        <Form.Submit>Save</Form.Submit>
      </Form.Root>,
    );
    await user.clear(input());
    await user.type(input(), "12");
    await user.keyboard("{Enter}");
    await flush();
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]![0].get("quantity")).toBe("12");
  });

  describe("wheel", () => {
    function Tall(props: Partial<NumberFieldRootProps>) {
      return (
        <div>
          <Fixture {...props} />
          <div style={{ blockSize: 4000 }} />
        </div>
      );
    }

    it("focused: steps and the page does not scroll; unfocused: the page scrolls", async () => {
      const onCommit = vi.fn<Fn>();
      render(<Tall defaultValue={5} stepOnWheel valueCommitAction={onCommit} />);
      window.scrollTo(0, 0);
      await focusInput();
      await act(async () => {
        await userEvent.wheel(input(), { delta: { y: -100 } });
      });
      await flush();
      expect(input().value).toBe("6");
      expect(window.scrollY).toBe(0);
      await act(async () => input().blur());
      window.scrollTo(0, 0);
      await act(async () => {
        await userEvent.wheel(input(), { delta: { y: 100 } });
      });
      await vi.waitFor(() => expect(window.scrollY).toBeGreaterThan(0));
      expect(input().value).toBe("6");
      expect(onCommit).toHaveBeenCalledTimes(1);
      window.scrollTo(0, 0);
    });

    it("without the prop the page scrolls either way", async () => {
      render(<Tall defaultValue={5} />);
      window.scrollTo(0, 0);
      await focusInput();
      await act(async () => {
        await userEvent.wheel(input(), { delta: { y: 100 } });
      });
      await vi.waitFor(() => expect(window.scrollY).toBeGreaterThan(0));
      expect(input().value).toBe("5");
      window.scrollTo(0, 0);
    });
  });

  it("a real hold: repeats while held, one commit, focus stays in the input", async () => {
    const onChange = vi.fn<Fn>();
    const onCommit = vi.fn<Fn>();
    render(<Fixture defaultValue={0} valueChangeAction={onChange} valueCommitAction={onCommit} />);
    await focusInput();
    let focusLeft = false;
    input().addEventListener("blur", () => {
      focusLeft = true;
    });
    await user.click(inc(), { delay: 700 });
    await flush();
    const value = Number(input().value);
    // 1 + ceil((700 - 400) / 60) = 6, give or take a tick of scheduling.
    expect(value).toBeGreaterThanOrEqual(5);
    expect(value).toBeLessThanOrEqual(8);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0]).toBe(value);
    expect(onCommit.mock.calls[0]![1].event?.type).toBe("pointerup");
    expect(onChange).toHaveBeenCalledTimes(value);
    expect(focusLeft).toBe(false);
    expect(document.activeElement).toBe(input());
    expect(inc().matches(":focus-visible")).toBe(false);
    expect(window.getSelection()?.toString() ?? "").toBe("");
  });

  it("announces once per key press and once per hold release", async () => {
    if (supportsAriaNotify) {
      const notify = vi.spyOn(
        Element.prototype as unknown as { ariaNotify: (m: string) => void },
        "ariaNotify",
      );
      notify.mockImplementation(() => {});
      render(<Fixture defaultValue={1000} />);
      await focusInput();
      await user.keyboard("{ArrowUp}");
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenLastCalledWith("1,001");
      await user.click(inc(), { delay: 500 });
      await flush();
      expect(notify).toHaveBeenCalledTimes(2);
      expect(notify).toHaveBeenLastCalledWith(input().value);
      notify.mockRestore();
    } else {
      render(<Fixture defaultValue={1000} />);
      await focusInput();
      await user.keyboard("{ArrowUp}");
      expect(document.querySelector('[role="status"][data-fsui-announcer]')).toHaveTextContent(
        "1,001",
      );
    }
  });

  it.runIf(browserName === "chromium")(
    "accessibility tree: a textbox with no value range, a group, two named buttons, no hidden input",
    async () => {
      render(<Fixture defaultValue={3} />);
      type AXValue = { value?: unknown };
      type AXNode = {
        role?: AXValue;
        name?: AXValue;
        properties?: { name: string; value: AXValue }[];
        ignored?: boolean;
      };
      const session = cdp();
      type FrameTree = { frame: { id: string; url: string }; childFrames?: FrameTree[] };
      const { frameTree } = (await session.send("Page.getFrameTree")) as { frameTree: FrameTree };
      const frames: FrameTree[] = [];
      const walk = (t: FrameTree) => {
        frames.push(t);
        t.childFrames?.forEach(walk);
      };
      walk(frameTree);
      const frameId = frames.find((f) => f.frame.url === location.href)?.frame.id;
      const { nodes } = (await session.send("Accessibility.getFullAXTree", { frameId })) as {
        nodes: AXNode[];
      };
      const live = nodes.filter((n) => !n.ignored);
      const textbox = live.find((n) => n.role?.value === "textbox");
      expect(textbox?.name?.value).toBe("Quantity");
      expect(textbox?.properties?.some((p) => p.name === "valuenow")).toBe(false);
      expect(live.find((n) => n.role?.value === "group")?.name?.value).toBe("Quantity");
      const buttons = live.filter((n) => n.role?.value === "button").map((n) => n.name?.value);
      expect(buttons).toEqual(["Decrease", "Increase"]);
      expect(live.some((n) => n.role?.value === "spinbutton")).toBe(false);
    },
  );

  it("text typed before hydration is adopted once with platform", async () => {
    const onCommit = vi.fn<Fn>();
    function App() {
      return (
        <NumberField.Root locale="en-US" defaultValue={1} valueCommitAction={onCommit}>
          <NumberField.Label>Quantity</NumberField.Label>
          <NumberField.Input />
        </NumberField.Root>
      );
    }
    const html = renderToString(<App />);
    const iframe = document.createElement("iframe");
    iframe.srcdoc = `<!doctype html><div id="root">${html}</div><button id="away">away</button>`;
    const loaded = new Promise((resolve) => (iframe.onload = resolve));
    document.body.append(iframe);
    await loaded;
    try {
      const container = iframe.contentDocument!.getElementById("root")!;
      const field = container.querySelector('input[type="text"]') as HTMLInputElement;
      field.focus();
      field.select();
      await userEvent.keyboard("3");
      if (field.value !== "3") {
        // WebKit may not route the real keyboard into the frame (Combobox L4 rule).
        console.warn(`[${browserName}] keyboard did not reach the iframe; typing by script`);
        field.value = "3";
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
      field.blur();
      const recoverable: unknown[] = [];
      await act(async () => {
        hydrateRoot(container, <App />, { onRecoverableError: (e) => recoverable.push(e) });
      });
      await flush();
      expect(recoverable).toEqual([]);
      expect(field.value).toBe("3");
      expect((field.nextElementSibling as HTMLInputElement).value).toBe("3");
      expect(onCommit.mock.calls.map(([v, d]) => [v, d.reason, d.source, d.event])).toEqual([
        [3, "platform", null, undefined],
      ]);
    } finally {
      iframe.remove();
      window.focus();
      document.body.focus();
    }
  });

  it("never starts a document view transition", async () => {
    const start = vi.fn();
    if (typeof document.startViewTransition === "function") {
      const original = document.startViewTransition.bind(document);
      vi.spyOn(document, "startViewTransition").mockImplementation(((
        arg: Parameters<typeof document.startViewTransition>[0],
      ) => {
        start();
        return original(arg);
      }) as typeof document.startViewTransition);
    }
    render(<Fixture defaultValue={1} valueCommitAction={() => undefined} />);
    await focusInput();
    await user.keyboard("{ArrowUp}");
    await user.click(inc());
    await user.clear(input());
    await user.type(input(), "9");
    await user.tab();
    await flush();
    expect(input().value).toBe("9");
    expect(start).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
