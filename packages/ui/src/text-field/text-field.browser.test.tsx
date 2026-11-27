// TextField rows that need a real engine (design/components/text-field.md 14, browser): Escape
// with an edited draft in a modal Dialog and an `auto` Popover (the close watcher sees a cancelled
// key), and the same Escape rows for NumberField's Input (testing.md 10.1 "Draft revert"); real
// Ctrl+Enter / Cmd+Enter in a textarea (no line, no form submission); blurs by a real Tab, a
// real click on a button and focus moving into another frame, a real reset click with a draft
// open and a save pending (#185), the IME rows (Chromium through CDP), and no document view
// transition. The real-key rows inside a Field (#193) are in field/field-edit.browser.test.tsx.
// The window itself losing focus (another application) cannot be driven in any engine; focus
// moving into an iframe is the nearest the harness gets. Runs in Chromium, Firefox and WebKit.
import { act, render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { cdp, userEvent } from "vitest/browser";
import {
  leaveActEnvironment,
  quietPeriod,
  settle,
  spyViewTransitions,
} from "../__tests__/browser-helpers.js";
import { user } from "../__tests__/browser-user.js";
import { browserName, pressFocusesButtons } from "../__tests__/engine.js";
import { deferred, ErrorCatcher, flushMicrotasks, silenceErrors } from "../__tests__/helpers.js";
import { Dialog } from "../dialog/index.js";
import { NumberField } from "../number-field/index.js";
import { Popover } from "../popover/index.js";
import { TextField } from "./index.js";
import type { TextFieldValueChangeDetails } from "./index.js";

type Fn = (next: string, details: TextFieldValueChangeDetails) => unknown;

const field = () => screen.getByTestId("field") as HTMLInputElement;

/** Selects the field's text and types `text` with real keys. */
async function retype(text: string): Promise<void> {
  await user.click(field());
  await user.keyboard(`{ControlOrMeta>}a{/ControlOrMeta}${text}`);
}

describe("TextField (browser)", () => {
  describe("Escape with an edited draft keeps the enclosing layer open", () => {
    const controls = {
      TextField: () => <TextField data-testid="field" aria-label="Title" defaultValue="Draft" />,
      "NumberField.Input": () => (
        <NumberField.Root locale="en-US" defaultValue={1}>
          <NumberField.Input data-testid="field" aria-label="Quantity" />
        </NumberField.Root>
      ),
    } as const;
    const saved = { TextField: "Draft", "NumberField.Input": "1" } as const;

    for (const name of ["TextField", "NumberField.Input"] as const) {
      const Control = controls[name];

      it(`${name} in a modal Dialog: the first Escape reverts, the second closes`, async () => {
        render(
          <Dialog.Root defaultOpen>
            <Dialog.Popup data-testid="popup" aria-label="Rename">
              <Control />
            </Dialog.Popup>
          </Dialog.Root>,
        );
        const dialog = screen.getByTestId("popup") as HTMLDialogElement;
        await settle(() => expect(dialog.open).toBe(true));
        await retype("57");
        expect(field().value).toBe("57");
        await user.keyboard("{Escape}");
        await quietPeriod(100, "the revert's Escape must not close the modal dialog");
        expect(field().value).toBe(saved[name]);
        expect(dialog.open).toBe(true);
        await user.keyboard("{Escape}");
        await settle(() => expect(dialog.open).toBe(false));
      });

      it(`${name} in an auto Popover: the first Escape reverts, the second closes`, async () => {
        render(
          <Popover.Root defaultOpen>
            <Popover.Trigger>Edit</Popover.Trigger>
            <Popover.Popup data-testid="popup" aria-label="Edit">
              <Control />
            </Popover.Popup>
          </Popover.Root>,
        );
        const popup = screen.getByTestId("popup");
        await settle(() => expect(popup.matches(":popover-open")).toBe(true));
        await retype("57");
        await user.keyboard("{Escape}");
        await quietPeriod(100, "the revert's Escape must not close the popover");
        expect(field().value).toBe(saved[name]);
        expect(popup.matches(":popover-open")).toBe(true);
        await user.keyboard("{Escape}");
        await settle(() => expect(popup.matches(":popover-open")).toBe(false));
      });
    }
  });

  describe("blur commits", () => {
    it("a real Tab commits once with the focusout", async () => {
      const action = vi.fn<Fn>();
      render(
        <>
          <TextField
            data-testid="field"
            aria-label="Title"
            defaultValue="Draft"
            valueCommitAction={action}
          />
          <button type="button">Next</button>
        </>,
      );
      await retype("Report");
      expect(action).not.toHaveBeenCalled();
      await user.tab();
      await settle(() => expect(action).toHaveBeenCalledTimes(1));
      expect(action.mock.calls[0]![0]).toBe("Report");
      expect(action.mock.calls[0]![1].event?.type).toBe("focusout");
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next" }));
    });

    it("a click on a button: the commit is dispatched before the button's click", async () => {
      const order: string[] = [];
      render(
        <>
          <TextField
            data-testid="field"
            aria-label="Title"
            defaultValue="Draft"
            valueCommitAction={(next) => {
              order.push(`commit ${next}`);
            }}
          />
          <button type="button" onClick={() => order.push("click")}>
            Save
          </button>
        </>,
      );
      await retype("Report");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await settle(() => expect(order).toEqual(["commit Report", "click"]));
    });

    it("focus moving into another frame commits", async () => {
      const action = vi.fn<Fn>();
      render(
        <TextField
          data-testid="field"
          aria-label="Title"
          defaultValue="Draft"
          valueCommitAction={action}
        />,
      );
      const iframe = document.createElement("iframe");
      iframe.srcdoc = '<!doctype html><button id="away">away</button>';
      const loaded = new Promise((resolve) => (iframe.onload = resolve));
      document.body.append(iframe);
      await loaded;
      try {
        await retype("Report");
        await act(async () => {
          iframe.focus();
          iframe.contentDocument!.getElementById("away")!.focus();
        });
        await settle(() => expect(action).toHaveBeenCalledTimes(1));
        expect(action.mock.calls[0]![0]).toBe("Report");
      } finally {
        iframe.remove();
        window.focus();
        document.body.focus();
      }
    });
  });

  describe("the textarea's commit key", () => {
    function Notes({ action, inForm = false }: { action: Fn; inForm?: boolean }) {
      const area = (
        <TextField
          data-testid="field"
          aria-label="Notes"
          name="notes"
          defaultValue="a"
          render={<textarea rows={3} />}
          valueCommitAction={action}
        />
      );
      return inForm ? (
        <form data-testid="form">
          {area}
          <button type="submit">Post</button>
        </form>
      ) : (
        area
      );
    }

    /** Puts the caret at the end of the textarea and types a second line with real keys. */
    async function secondLine(): Promise<void> {
      await user.click(field());
      field().setSelectionRange(1, 1);
      await user.keyboard("{Enter}b");
    }

    for (const modifier of ["Control", "Meta"] as const) {
      it(`a real ${modifier}+Enter commits once, adds no line, keeps focus and the caret`, async () => {
        const action = vi.fn<Fn>();
        render(<Notes action={action} />);
        await secondLine();
        expect(field().value).toBe("a\nb");
        expect(action).not.toHaveBeenCalled();
        await user.keyboard(`{${modifier}>}{Enter}{/${modifier}}`);
        await settle(() => expect(action).toHaveBeenCalledTimes(1));
        expect(action.mock.calls[0]![0]).toBe("a\nb");
        const event = action.mock.calls[0]![1].event as KeyboardEvent;
        expect(event.type).toBe("keydown");
        expect(event.defaultPrevented).toBe(true);
        await quietPeriod(100, "the key must add no line after the commit");
        expect(field().value).toBe("a\nb");
        expect(document.activeElement).toBe(field());
        expect([field().selectionStart, field().selectionEnd]).toEqual([3, 3]);
        expect(action).toHaveBeenCalledTimes(1);
      });

      it(`a real ${modifier}+Enter in a form with a submit button submits nothing`, async () => {
        const action = vi.fn<Fn>();
        const submit = vi.fn((event: SubmitEvent) => event.preventDefault());
        render(<Notes action={action} inForm />);
        const form = screen.getByTestId("form") as HTMLFormElement;
        form.addEventListener("submit", submit);
        await secondLine();
        await user.keyboard(`{${modifier}>}{Enter}{/${modifier}}`);
        await settle(() => expect(action).toHaveBeenCalledTimes(1));
        await quietPeriod(100, "the textarea's commit key must not submit the form");
        expect(submit).not.toHaveBeenCalled();
        form.removeEventListener("submit", submit);
      });
    }

    it("a real Enter adds a line and commits nothing", async () => {
      const action = vi.fn<Fn>();
      render(<Notes action={action} />);
      await secondLine();
      await user.keyboard("{Enter}");
      await quietPeriod(100, "Enter alone must not commit a textarea");
      expect(field().value).toBe("a\nb\n");
      expect(action).not.toHaveBeenCalled();
    });
  });

  it("a real reset click with a draft open and a save pending: the reset value shows, one platform commit, the draft is gone", async () => {
    const d = deferred();
    const action = vi.fn<Fn>((_next, details) =>
      details.reason === "activate" ? d.promise : undefined,
    );
    render(
      <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
        <TextField
          data-testid="field"
          aria-label="Title"
          name="title"
          defaultValue="Draft"
          valueCommitAction={action}
        />
        {/* Keeps focus (and the open draft) in the field through the click, as a toolbar does. */}
        <button type="reset" data-testid="reset" onMouseDown={(e) => e.preventDefault()}>
          Reset
        </button>
      </form>,
    );
    await retype("Report");
    await user.keyboard("{Enter}");
    await settle(() => expect(field()).toHaveAttribute("data-pending"));
    await user.click(field());
    await user.keyboard(" 2");
    expect(field().value).toBe("Report 2");
    const restore = leaveActEnvironment();
    try {
      // `user.click` would wrap the click in act; the #185 order needs it outside.
      await userEvent.click(screen.getByTestId("reset"));
    } finally {
      restore();
    }
    await settle(() => expect(field().value).toBe("Draft"));
    expect(document.activeElement).toBe(field());
    await settle(() =>
      expect(
        action.mock.calls.map(([n, details]) => [n, details.reason, details.event?.type]),
      ).toEqual([
        ["Report", "activate", "keydown"],
        ["Draft", "platform", "reset"],
      ]),
    );
    await act(async () => d.resolve());
    await flushMicrotasks();
    expect(field().value).toBe("Draft");
    // The draft was cleared by the reset: leaving the field commits nothing more.
    await user.tab();
    await flushMicrotasks();
    expect(action).toHaveBeenCalledTimes(2);
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("title")).toBe("Draft");
  });

  // The sibling row with an ordinary reset button: the press moves focus to it, so the blur
  // commits the open draft first and the reset follows (where a press does not focus a button,
  // macOS WebKit, the draft is still open at the reset, as in the row above).
  it("a real reset click on a focusable button: the blur commits the draft, then the reset", async () => {
    const focuses = await pressFocusesButtons();
    const d = deferred();
    const action = vi.fn<Fn>((_next, details) =>
      details.reason === "activate" ? d.promise : undefined,
    );
    render(
      <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
        <TextField
          data-testid="field"
          aria-label="Title"
          name="title"
          defaultValue="Draft"
          valueCommitAction={action}
        />
        <button type="reset" data-testid="reset">
          Reset
        </button>
      </form>,
    );
    await retype("Report");
    await user.keyboard("{Enter}");
    await settle(() => expect(field()).toHaveAttribute("data-pending"));
    await user.keyboard(" 2");
    expect(field().value).toBe("Report 2");
    const restore = leaveActEnvironment();
    try {
      await userEvent.click(screen.getByTestId("reset"));
    } finally {
      restore();
    }
    await settle(() => expect(field().value).toBe("Draft"));
    await settle(() =>
      expect(
        action.mock.calls.map(([n, details]) => [n, details.reason, details.event?.type]),
      ).toEqual([
        ["Report", "activate", "keydown"],
        ...(focuses ? [["Report 2", "activate", "focusout"]] : []),
        ["Draft", "platform", "reset"],
      ]),
    );
    await act(async () => d.resolve());
    await flushMicrotasks();
    expect(field().value).toBe("Draft");
  });

  describe("IME (Chromium, CDP)", () => {
    it("an Enter that confirms a composition commits nothing", async () => {
      if (browserName !== "chromium") return;
      const action = vi.fn<Fn>();
      render(
        <TextField
          data-testid="field"
          aria-label="Title"
          defaultValue=""
          valueCommitAction={action}
        />,
      );
      await act(async () => field().focus());
      const session = cdp();
      await act(async () => {
        await session.send("Input.imeSetComposition", {
          text: "に",
          selectionStart: 1,
          selectionEnd: 1,
        });
        // The IME takes the Enter (keyCode 229) and confirms the composition.
        for (const type of ["rawKeyDown", "keyUp"] as const) {
          await session.send("Input.dispatchKeyEvent", {
            type,
            key: "Enter",
            code: "Enter",
            windowsVirtualKeyCode: 229,
          });
        }
        await session.send("Input.insertText", { text: "に" });
      });
      await quietPeriod(50, "the IME's Enter must not commit");
      expect(field().value).toBe("に");
      expect(action).not.toHaveBeenCalled();
      // The user's own Enter afterwards commits the composed text.
      await user.keyboard("{Enter}");
      await settle(() => expect(action).toHaveBeenCalledExactlyOnceWith("に", expect.anything()));
    });

    it("a blur during a composition commits the composed text and leaves no draft", async () => {
      if (browserName !== "chromium") return;
      const action = vi.fn<Fn>();
      const seen: string[] = [];
      render(
        <>
          <TextField
            data-testid="field"
            aria-label="Title"
            defaultValue="Saved"
            valueCommitAction={action}
            className={(state) => {
              seen.push(state.text === state.value ? "no draft" : "draft");
              return undefined;
            }}
          />
          <button type="button">Elsewhere</button>
        </>,
      );
      await act(async () => {
        field().focus();
        field().setSelectionRange(5, 5);
      });
      const session = cdp();
      await act(async () => {
        await session.send("Input.imeSetComposition", {
          text: "に",
          selectionStart: 1,
          selectionEnd: 1,
        });
      });
      await user.click(screen.getByRole("button", { name: "Elsewhere" }));
      await settle(() => expect(action).toHaveBeenCalledTimes(1));
      expect(action.mock.calls[0]![0]).toBe("Savedに");
      await quietPeriod(50, "no draft may reopen after the commit");
      expect(document.activeElement).not.toBe(field());
      expect(field().value).toBe("Savedに");
      expect(seen.at(-1)).toBe("no draft");
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  describe("no document view transition", () => {
    it("for a commit", async () => {
      const vt = spyViewTransitions(undefined, { allowMissing: true });
      function Parent() {
        const [title, setTitle] = useState("Draft");
        return (
          <TextField
            data-testid="field"
            aria-label="Title"
            value={title}
            valueCommitAction={(next) => startTransition(() => setTitle(next))}
          />
        );
      }
      render(<Parent />);
      await retype("Report");
      await user.keyboard("{Enter}");
      await flushMicrotasks();
      expect(field().value).toBe("Report");
      expect(vt.calls()).toBe(0);
    });

    it("for a rollback (rejected commit, caught by the boundary)", async () => {
      const vt = spyViewTransitions(undefined, { allowMissing: true });
      silenceErrors();
      const caught = vi.fn();
      const d = deferred();
      render(
        <ErrorCatcher onError={caught}>
          <TextField
            data-testid="field"
            aria-label="Title"
            defaultValue="Draft"
            valueCommitAction={() => d.promise}
          />
        </ErrorCatcher>,
      );
      await retype("Report");
      await user.keyboard("{Enter}");
      await settle(() => expect(field()).toHaveAttribute("data-pending"));
      await act(async () => d.reject(new Error("save failed")));
      await vi.waitFor(() => expect(caught).toHaveBeenCalledTimes(1));
      expect(vt.calls()).toBe(0);
    });
  });
});
