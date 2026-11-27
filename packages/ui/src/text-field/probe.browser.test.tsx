// TEMPORARY probe (text-field.md 14, first steps). Not committed.
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { addStyle, flushFor, sleep } from "../__tests__/browser-helpers.js";
import { browserName } from "../__tests__/engine.js";

const log: string[] = [];

function Bare({ type = "text", initial = "Saved" }: { type?: string; initial?: string }) {
  const [value, setValue] = useState(initial);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (why: string) => {
    log.push(`commit(${why}) draft=${JSON.stringify(draft)}`);
    if (draft === null) return;
    setValue(draft);
    setDraft(null);
  };
  return (
    <>
      <input
        data-testid="field"
        type={type}
        value={draft ?? value}
        onChange={(e) => {
          log.push(`react-change ${JSON.stringify(e.currentTarget.value)}`);
          setDraft(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          log.push(`keydown ${e.key} prevented=${e.defaultPrevented}`);
          if (e.key === "Escape" && draft !== null && draft !== value) {
            e.preventDefault();
            setDraft(null);
            log.push("revert");
          }
          if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) commit("enter");
        }}
        onBlur={() => commit("blur")}
      />
      <button data-testid="other">other</button>
      <output data-testid="state">{JSON.stringify({ value, draft })}</output>
    </>
  );
}

function listen(el: HTMLElement) {
  for (const type of [
    "compositionstart",
    "compositionupdate",
    "compositionend",
    "beforeinput",
    "input",
    "focusout",
    "blur",
  ]) {
    el.addEventListener(type, (e) => {
      const extra =
        e instanceof InputEvent
          ? ` data=${JSON.stringify(e.data)} isComposing=${e.isComposing} inputType=${e.inputType}`
          : e instanceof CompositionEvent
            ? ` data=${JSON.stringify(e.data)}`
            : "";
      log.push(`${type}${extra} value=${JSON.stringify((el as HTMLInputElement).value)}`);
    });
  }
}

describe("probe", () => {
  it("1. blur mid composition (Chromium CDP)", async () => {
    if (browserName !== "chromium") {
      console.log(`[probe1 ${browserName}] not driven`);
      return;
    }
    for (const how of ["script-blur", "mouse-click", "tab"] as const) {
      log.length = 0;
      const { unmount } = render(<Bare />);
      const input = screen.getByTestId("field") as HTMLInputElement;
      listen(input);
      input.focus();
      input.setSelectionRange(5, 5);
      const session = cdp();
      await act(async () => {
        await session.send("Input.imeSetComposition", {
          text: "に",
          selectionStart: 1,
          selectionEnd: 1,
        });
      });
      await flushFor(30);
      log.push("--- blur via " + how);
      if (how === "script-blur") {
        act(() => input.blur());
      } else if (how === "mouse-click") {
        const r = screen.getByTestId("other").getBoundingClientRect();
        await act(async () => {
          await userEvent.click(screen.getByTestId("other"));
        });
        void r;
      } else {
        await act(async () => {
          await session.send("Input.dispatchKeyEvent", {
            type: "rawKeyDown",
            key: "Tab",
            code: "Tab",
            windowsVirtualKeyCode: 9,
          });
          await session.send("Input.dispatchKeyEvent", {
            type: "keyUp",
            key: "Tab",
            code: "Tab",
            windowsVirtualKeyCode: 9,
          });
        });
      }
      await flushFor(50);
      log.push(
        `final active=${document.activeElement === input} dom=${JSON.stringify(input.value)} state=${screen.getByTestId("state").textContent}`,
      );
      console.log(`[probe1 ${browserName} ${how}]\n` + log.join("\n"));
      // end any composition left
      await act(async () => {
        await session.send("Input.insertText", { text: "" });
      });
      unmount();
    }
  });

  it("2. Escape on type=search", async () => {
    // (a) with edited draft
    log.length = 0;
    const { unmount } = render(<Bare type="search" />);
    let input = screen.getByTestId("field") as HTMLInputElement;
    listen(input);
    await act(async () => {
      await userEvent.type(input, "X");
    });
    log.push(`after type: ${input.value}`);
    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });
    await flushFor(30);
    log.push(`after Esc1: dom=${input.value} state=${screen.getByTestId("state").textContent}`);
    console.log(`[probe2a ${browserName}]\n` + log.join("\n"));
    unmount();
    // (b) untouched
    log.length = 0;
    const r2 = render(<Bare type="search" />);
    input = screen.getByTestId("field") as HTMLInputElement;
    listen(input);
    input.focus();
    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });
    await flushFor(30);
    log.push(`after Esc1: dom=${input.value} state=${screen.getByTestId("state").textContent}`);
    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });
    await flushFor(30);
    log.push(`after Esc2: dom=${input.value} state=${screen.getByTestId("state").textContent}`);
    console.log(`[probe2b ${browserName}]\n` + log.join("\n"));
    r2.unmount();
    expect(true).toBe(true);
  });

  it("3. undo after a controlled write", async () => {
    const mod = navigator.platform.includes("Mac") ? "Meta" : "Control";
    // Control: no controlled write; undo works?
    for (const variant of ["control", "revert"] as const) {
      log.length = 0;
      const { unmount } = render(<Bare />);
      const input = screen.getByTestId("field") as HTMLInputElement;
      await act(async () => {
        await userEvent.type(input, "abc");
      });
      log.push(`typed: ${input.value}`);
      if (variant === "revert") {
        await act(async () => {
          await userEvent.keyboard("{Escape}");
        });
        log.push(`after revert: ${input.value}`);
      }
      await act(async () => {
        await userEvent.keyboard(`{${mod}>}z{/${mod}}`);
      });
      await flushFor(30);
      log.push(`after undo: dom=${input.value} state=${screen.getByTestId("state").textContent}`);
      console.log(`[probe3 ${browserName} ${variant}]\n` + log.join("\n"));
      unmount();
    }
  });

  it("4. ellipsis with field-sizing", async () => {
    addStyle(`
      .p { field-sizing: content; max-inline-size: 80px; min-inline-size: 4ch; font: 16px monospace; border: 1px solid transparent; padding: 0; }
      .p.e:not(:focus) { text-overflow: ellipsis; }
      .p.c { text-overflow: clip; }
    `);
    render(
      <div>
        <input data-testid="e" className="p e" defaultValue="A very long text that overflows" />
        <br />
        <input data-testid="c" className="p c" defaultValue="A very long text that overflows" />
      </div>,
    );
    const e = screen.getByTestId("e") as HTMLInputElement;
    const c = screen.getByTestId("c") as HTMLInputElement;
    await sleep(50);
    const a = await page.screenshot({ element: e, base64: true, save: false });
    const b = await page.screenshot({ element: c, base64: true, save: false });
    console.log(
      `[probe4 ${browserName}] width e=${e.getBoundingClientRect().width} sw=${e.scrollWidth} cw=${e.clientWidth} ` +
        `textOverflow=${getComputedStyle(e).textOverflow} differ=${a !== b}`,
    );
    const ab = typeof a === "string" ? a : a.base64;
    const bb = typeof b === "string" ? b : b.base64;
    console.log(`[probe4 ${browserName}] screenshots differ: ${ab !== bb}`);
  });
});
