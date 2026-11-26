// OTPField rows that need a real engine (the #171 test plan in design/CHANGELOG.md and the
// desktop device probes of memo/architect/avatar-scrollarea-otp-notes.md): real typing, overtype
// and Backspace with the real caret, a write-back's caret restore (probe 4), `selectionchange`
// driving `data-active`, a real clipboard paste, a real click on a Slot, form reset and Enter's
// implicit submission, completion and `submitOnComplete` through a real submit, the server HTML
// before and after hydration, transparent text under forced colours (probe 6, Chromium CDP),
// IME composition (Chromium CDP; other engines get a scripted composition) and the accessibility
// tree (Chromium CDP). Runs in Chromium, Firefox and WebKit.
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { cdp, userEvent } from "vitest/browser";
import { getAXNodes } from "../__tests__/ax-tree.js";
import { addStyle, onCleanup } from "../__tests__/browser-helpers.js";
import { centre, mouse } from "../__tests__/browser-commands.js";
import { user } from "../__tests__/browser-user.js";
import { browserName } from "../__tests__/engine.js";
import { deferred, flushMicrotasks } from "../__tests__/helpers.js";
import { OTPField } from "./index.js";
import type {
  OTPFieldCompleteDetails,
  OTPFieldRootProps,
  OTPFieldValueChangeDetails,
} from "./index.js";

type Complete = (value: string, details: OTPFieldCompleteDetails) => unknown;
type Change = (value: string, details: OTPFieldValueChangeDetails) => void;

const CSS = `
  .otp { display: inline-flex; gap: 8px; font: 16px/1 monospace; }
  .otp-slot { display: grid; place-items: center; inline-size: 32px; block-size: 40px;
              border: 1px solid #888; }
`;

function Code({ length = 6, ...props }: Partial<OTPFieldRootProps>) {
  return (
    <OTPField.Root className="otp" data-testid="root" length={length} {...props}>
      <OTPField.Input aria-label="Verification code" data-testid="input" />
      {Array.from({ length }, (_, i) => (
        <OTPField.Slot key={i} index={i} className="otp-slot" data-testid={`slot-${i}`} />
      ))}
    </OTPField.Root>
  );
}

const input = () => screen.getByTestId("input") as HTMLInputElement;
const root = () => screen.getByTestId("root");
const slot = (i: number) => screen.getByTestId(`slot-${i}`);
const slotTexts = (length = 6) =>
  Array.from({ length }, (_, i) => slot(i).textContent ?? "").join("|");
const active = (length = 6) =>
  Array.from({ length }, (_, i) => (slot(i).hasAttribute("data-active") ? i : -1)).filter(
    (i) => i >= 0,
  );

function styled(): void {
  onCleanup(addStyle(CSS));
}

async function focusInput(): Promise<void> {
  await act(async () => input().focus());
}

/** Waits until `check` passes (selectionchange is dispatched as a task). */
async function eventually(check: () => void, tries = 20): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      check();
      return;
    } catch (error) {
      if (i >= tries) throw error;
      await act(async () => new Promise((r) => setTimeout(r, 10)));
    }
  }
}

describe("OTPField (browser)", () => {
  describe("typing and the caret", () => {
    it("digits fill the Slots; a letter is dropped and the caret stays", async () => {
      styled();
      const onValueChange = vi.fn<Change>();
      render(<Code onValueChange={onValueChange} />);
      await focusInput();
      await user.keyboard("12");
      await user.keyboard("a");
      expect(input().value).toBe("12");
      expect(input().selectionStart).toBe(2);
      await user.keyboard("3");
      expect(input().value).toBe("123");
      expect(slotTexts()).toBe("1|2|3|||");
      expect(onValueChange.mock.calls.map(([v]) => v)).toEqual(["1", "12", "123"]);
    });

    it("overtype: ArrowLeft then a digit replaces it and the caret moves on (write-back caret)", async () => {
      styled();
      render(<Code defaultValue="1234" />);
      await focusInput();
      await user.keyboard("{End}{ArrowLeft}{ArrowLeft}9");
      expect(input().value).toBe("1294");
      expect(input().selectionStart).toBe(3);
      await user.keyboard("8");
      expect(input().value).toBe("1298");
      expect(input().selectionStart).toBe(4);
    });

    it("at the end of a complete code a digit replaces the last one", async () => {
      styled();
      render(<Code defaultValue="123456" />);
      await focusInput();
      await user.keyboard("{End}7");
      expect(input().value).toBe("123457");
      expect(input().selectionStart).toBe(6);
    });

    it("Backspace and Delete are native: the rest closes up", async () => {
      styled();
      render(<Code defaultValue="1234" />);
      await focusInput();
      await user.keyboard("{Home}{ArrowRight}{Delete}");
      expect(input().value).toBe("134");
      await user.keyboard("{End}{Backspace}");
      expect(input().value).toBe("13");
      expect(slotTexts()).toBe("1|3||||");
    });

    it("select all and type replaces the code", async () => {
      styled();
      render(<Code defaultValue="123456" />);
      await focusInput();
      await user.keyboard("{ControlOrMeta>}a{/ControlOrMeta}5");
      expect(input().value).toBe("5");
    });
  });

  describe("selection and data-active", () => {
    it("selectionchange drives data-active: the caret's slot, a Shift range, none when blurred", async () => {
      styled();
      render(
        <>
          <Code defaultValue="1234" />
          <button type="button">after</button>
        </>,
      );
      expect(active()).toEqual([]);
      await focusInput();
      await user.keyboard("{Home}");
      await eventually(() => expect(active()).toEqual([0]));
      await user.keyboard("{ArrowRight}{ArrowRight}");
      await eventually(() => expect(active()).toEqual([2]));
      await user.keyboard("{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}");
      await eventually(() => expect(active()).toEqual([0, 1]));
      await user.keyboard("{End}");
      await eventually(() => expect(active()).toEqual([4]));
      await user.tab();
      await eventually(() => expect(active()).toEqual([]));
    });

    it("a click on a Slot puts the caret there, clamped to the text", async () => {
      styled();
      render(<Code defaultValue="123" />);
      const at = centre(slot(1));
      await mouse.click(at.x, at.y);
      await eventually(() => expect(input().selectionStart).toBe(1));
      expect(document.activeElement).toBe(input());
      await eventually(() => expect(active()).toEqual([1]));
      await user.keyboard("9");
      expect(input().value).toBe("193");
      const far = centre(slot(5));
      await mouse.click(far.x, far.y);
      await eventually(() => expect(input().selectionStart).toBe(3));
    });

    it("the Input covers the Root: the pointer's target over a Slot is the input", () => {
      styled();
      render(<Code />);
      const at = centre(slot(3));
      expect(document.elementFromPoint(at.x, at.y)).toBe(input());
      const box = root().getBoundingClientRect();
      const field = input().getBoundingClientRect();
      expect([field.width, field.height]).toEqual([box.width, box.height]);
    });
  });

  describe("paste", () => {
    it("a real clipboard paste of a formatted code replaces a half-typed one", async () => {
      styled();
      const completeAction = vi.fn<Complete>();
      render(
        <>
          <input data-testid="source" defaultValue="123 456" aria-label="source" />
          <Code completeAction={completeAction} />
        </>,
      );
      const source = screen.getByTestId("source") as HTMLInputElement;
      await act(async () => {
        source.focus();
        source.select();
        await userEvent.copy();
      });
      await focusInput();
      await user.keyboard("98");
      const pasted = new Promise<string>((resolve) =>
        input().addEventListener("input", (e) => resolve((e as InputEvent).inputType), {
          once: true,
        }),
      );
      await act(async () => {
        await userEvent.paste();
      });
      expect(await pasted).toBe("insertFromPaste");
      await flushMicrotasks();
      expect(input().value).toBe("123456");
      expect(input().selectionStart).toBe(6);
      expect(completeAction).toHaveBeenCalledTimes(1);
      expect(completeAction.mock.calls[0]![0]).toBe("123456");
    });
  });

  describe("forms", () => {
    it("FormData, Enter's implicit submission, form reset (reason platform, no completion)", async () => {
      styled();
      const onValueChange = vi.fn<Change>();
      const completeAction = vi.fn<Complete>();
      const submitted: (string | null)[] = [];
      render(
        <form
          data-testid="form"
          onSubmit={(e) => {
            e.preventDefault();
            submitted.push(new FormData(e.currentTarget).get("code") as string | null);
          }}
        >
          <Code
            length={3}
            name="code"
            defaultValue="1"
            onValueChange={onValueChange}
            completeAction={completeAction}
          />
          <button type="reset" data-testid="reset">
            Reset
          </button>
          <button type="submit">Verify</button>
        </form>,
      );
      await focusInput();
      await user.keyboard("{End}23");
      expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("code")).toBe("123");
      expect(completeAction).toHaveBeenCalledTimes(1);
      await user.keyboard("{Enter}");
      expect(submitted).toEqual(["123"]);
      onValueChange.mockClear();
      await user.click(screen.getByTestId("reset"));
      await flushMicrotasks();
      expect(input().value).toBe("1");
      expect(slotTexts(3)).toBe("1||");
      expect(onValueChange.mock.calls.map(([v, d]) => [v, d.reason, d.event?.type])).toEqual([
        ["1", "platform", "reset"],
      ]);
      expect(completeAction).toHaveBeenCalledTimes(1);
    });

    it("a partial code fails pattern on submit; required blocks an empty one", async () => {
      styled();
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      render(
        <form onSubmit={onSubmit}>
          <Code length={4} required name="code" />
          <button type="submit" data-testid="submit">
            Verify
          </button>
        </form>,
      );
      expect(input().validity.valueMissing).toBe(true);
      await focusInput();
      await user.keyboard("12");
      expect(input().validity.patternMismatch).toBe(true);
      await user.click(screen.getByTestId("submit"));
      expect(onSubmit).not.toHaveBeenCalled();
      await focusInput();
      await user.keyboard("{End}34");
      expect(input().validity.valid).toBe(true);
      await user.click(screen.getByTestId("submit"));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("completion", () => {
    it("completeAction pends on Root and Input; the field stays editable; submitOnComplete submits", async () => {
      styled();
      const d = deferred();
      const submitted: (string | null)[] = [];
      render(
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitted.push(new FormData(e.currentTarget).get("code") as string | null);
          }}
        >
          <Code length={4} name="code" submitOnComplete completeAction={() => d.promise} />
        </form>,
      );
      await focusInput();
      await user.keyboard("1234");
      expect(submitted).toEqual(["1234"]);
      expect(root()).toHaveAttribute("data-pending", "");
      expect(input()).toHaveAttribute("data-pending", "");
      expect(input()).not.toBeDisabled();
      expect(document.activeElement).toBe(input());
      await user.keyboard("{Backspace}");
      expect(input().value).toBe("123");
      await act(async () => d.resolve());
      expect(root()).not.toHaveAttribute("data-pending");
    });

    it("a controlled parent clears the code after a wrong answer; typing starts over", async () => {
      styled();
      function Verify() {
        const [code, setCode] = useState("");
        const [message, setMessage] = useState("");
        return (
          <>
            <Code
              length={4}
              value={code}
              onValueChange={(next) => {
                setCode(next);
                setMessage("");
              }}
              completeAction={async () => {
                await new Promise((r) => setTimeout(r, 10));
                setMessage("Wrong code");
                setCode("");
              }}
            />
            <p data-testid="message">{message}</p>
          </>
        );
      }
      render(<Verify />);
      await focusInput();
      await user.keyboard("1234");
      await eventually(() => expect(screen.getByTestId("message")).toHaveTextContent("Wrong code"));
      expect(input().value).toBe("");
      expect(input().selectionStart).toBe(0);
      await user.keyboard("5");
      expect(input().value).toBe("5");
      expect(screen.getByTestId("message")).toHaveTextContent("");
    });
  });

  describe("server HTML and hydration", () => {
    it("the server input takes typing before hydration; the text is adopted at hydration, no completion", async () => {
      const onValueChange = vi.fn<Change>();
      const completeAction = vi.fn<Complete>();
      const app = <Code length={4} onValueChange={onValueChange} completeAction={completeAction} />;
      const container = document.createElement("div");
      container.innerHTML = renderToString(app);
      document.body.append(container);
      let hydrated: Root | null = null;
      onCleanup(() => {
        act(() => hydrated?.unmount());
        container.remove();
      });
      const field = container.querySelector("input")!;
      // Before hydration the text is transparent (decision 11): the server style is inline.
      expect(getComputedStyle(field).color).toBe("rgba(0, 0, 0, 0)");
      await userEvent.type(field, "12 34");
      expect(field.value).toBe("12 34");
      const recoverable: unknown[] = [];
      await act(async () => {
        hydrated = hydrateRoot(container, app, {
          onRecoverableError: (e) => recoverable.push(e),
        });
      });
      await flushMicrotasks();
      expect(recoverable).toEqual([]);
      expect(field.value).toBe("1234");
      expect([...container.querySelectorAll("span")].map((s) => s.textContent).join("|")).toBe(
        "1|2|3|4",
      );
      expect(onValueChange.mock.calls.map(([v, d]) => [v, d.reason, d.event])).toEqual([
        ["1234", "platform", undefined],
      ]);
      expect(completeAction).not.toHaveBeenCalled();
    });
  });

  describe("probes", () => {
    it("transparent text and caret; forced colours keep it transparent (Chromium CDP)", async () => {
      styled();
      render(
        <>
          <Code defaultValue="12" />
          <input data-testid="control" defaultValue="12" aria-label="control" />
        </>,
      );
      const style = getComputedStyle(input());
      expect(style.color).toBe("rgba(0, 0, 0, 0)");
      expect(style.caretColor).toBe("rgba(0, 0, 0, 0)");
      if (browserName !== "chromium") return;
      const session = cdp();
      await session.send("Emulation.setEmulatedMedia", {
        features: [{ name: "forced-colors", value: "active" }],
      });
      onCleanup(() => {
        void session.send("Emulation.setEmulatedMedia", { features: [] });
      });
      await act(async () => new Promise((r) => requestAnimationFrame(() => r(undefined))));
      expect(matchMedia("(forced-colors: active)").matches).toBe(true);
      // Positive control: an ordinary input's text is forced to a system colour.
      const control = getComputedStyle(screen.getByTestId("control"));
      expect(control.color).not.toBe("rgba(0, 0, 0, 0)");
      expect(getComputedStyle(input()).color).toBe("rgba(0, 0, 0, 0)");
    });

    it("IME composition (alphanumeric): composed text stays in the input until it ends", async () => {
      styled();
      const onValueChange = vi.fn<Change>();
      render(<Code length={4} charset="alphanumeric" onValueChange={onValueChange} />);
      await focusInput();
      if (browserName === "chromium") {
        const session = cdp();
        await act(async () => {
          const updated = new Promise((r) =>
            input().addEventListener("compositionupdate", r, { once: true }),
          );
          await session.send("Input.imeSetComposition", {
            text: "aか",
            selectionStart: 2,
            selectionEnd: 2,
          });
          await updated;
        });
        await flushMicrotasks();
        // Not written while composing (writing would end the composition).
        expect(input().value).toBe("aか");
        expect(slotTexts(4)).toBe("a|||");
        await act(async () => {
          const ended = new Promise((r) =>
            input().addEventListener("compositionend", r, { once: true }),
          );
          await session.send("Input.insertText", { text: "aか" });
          await ended;
        });
        await flushMicrotasks();
        expect(input().value).toBe("a");
        expect(slotTexts(4)).toBe("a|||");
        await user.keyboard("b");
        expect(input().value).toBe("ab");
      } else {
        // No IME driver: the event sequence an IME produces, scripted.
        const el = input();
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        await act(async () => {
          el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
          setValue.call(el, "aか");
          el.dispatchEvent(
            new InputEvent("input", {
              bubbles: true,
              isComposing: true,
              inputType: "insertCompositionText",
              data: "aか",
            }),
          );
        });
        expect(el.value).toBe("aか");
        expect(slotTexts(4)).toBe("a|||");
        await act(async () => {
          el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "aか" }));
        });
        expect(el.value).toBe("a");
      }
      expect(onValueChange.mock.calls.every(([v]) => /^[A-Za-z0-9]*$/.test(v))).toBe(true);
    });

    it.runIf(browserName === "chromium")(
      "the accessibility tree: one named textbox, the Slots hidden (Chromium CDP)",
      async () => {
        render(<Code defaultValue="12" />);
        const nodes = (await getAXNodes()).filter((n) => !n.ignored);
        const textboxes = nodes.filter((n) => n.role?.value === "textbox");
        expect(textboxes).toHaveLength(1);
        expect(textboxes[0]?.name?.value).toBe("Verification code");
        expect(nodes.some((n) => n.role?.value === "StaticText" && n.name?.value === "1")).toBe(
          false,
        );
      },
    );
  });
});
