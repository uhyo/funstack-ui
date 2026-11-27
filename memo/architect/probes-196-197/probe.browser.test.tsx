// Temporary probe for #196 / #197 (architect). Not for master.
import { render } from "@testing-library/react";
import { useRef, useState } from "react";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { browserName } from "../__tests__/engine.js";

const log: Record<string, unknown> = { engine: browserName };

const tick = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

function watch(element: HTMLElement, into: string[]) {
  for (const type of ["keydown", "keypress", "beforeinput", "input", "change", "search", "keyup"]) {
    element.addEventListener(type, (event) => {
      const e = event as KeyboardEvent & InputEvent;
      const extra =
        type === "input" || type === "beforeinput"
          ? `:${e.inputType}`
          : type.startsWith("key")
            ? `:${e.key}${e.ctrlKey ? "+ctrl" : ""}${e.metaKey ? "+meta" : ""}`
            : "";
      queueMicrotask(() => {
        // read defaultPrevented after the listeners
      });
      into.push(`${type}${extra}`);
    });
  }
  // After the default action: was the keydown prevented / default-handled?
  element.addEventListener("keydown", (event) => {
    setTimeout(() => into.push(`keydown.defaultPrevented=${event.defaultPrevented}`), 0);
  });
}

it("probe A: modifier+Enter in a bare textarea", async () => {
  const out: Record<string, unknown> = {};
  for (const combo of ["Control", "Meta", "Alt", "Shift"]) {
    const textarea = document.createElement("textarea");
    textarea.value = "ab";
    document.body.append(textarea);
    textarea.focus();
    textarea.setSelectionRange(2, 2);
    const events: string[] = [];
    watch(textarea, events);
    await userEvent.keyboard(`{${combo}>}{Enter}{/${combo}}`);
    await tick();
    out[combo] = {
      value: JSON.stringify(textarea.value),
      events: events.filter((e) => !e.includes(combo)),
    };
    textarea.remove();
  }
  log.A = out;
});

it("probe A2: modifier+Enter in a bare input inside a form with a submit button", async () => {
  const out: Record<string, unknown> = {};
  for (const combo of ["Control", "Meta"]) {
    const form = document.createElement("form");
    form.innerHTML = `<input name="a" value="ab"><textarea name="t">x</textarea><button>go</button>`;
    let submits = 0;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submits++;
    });
    document.body.append(form);
    form.querySelector("input")!.focus();
    await userEvent.keyboard(`{${combo}>}{Enter}{/${combo}}`);
    await tick();
    const fromInput = submits;
    form.querySelector("textarea")!.focus();
    await userEvent.keyboard(`{${combo}>}{Enter}{/${combo}}`);
    await tick();
    out[combo] = { submitsFromInput: fromInput, submitsFromTextarea: submits - fromInput };
    form.remove();
  }
  log.A2 = out;
});

async function nativeSearch(kind: "dialog" | "popover" | "none", initial: string) {
  const host = kind === "dialog" ? document.createElement("dialog") : document.createElement("div");
  if (kind === "popover") host.setAttribute("popover", "auto");
  const input = document.createElement("input");
  input.type = "search";
  input.value = initial;
  host.append(input);
  document.body.append(host);
  if (kind === "dialog") (host as HTMLDialogElement).showModal();
  if (kind === "popover") host.showPopover();
  const isOpen = () =>
    kind === "dialog"
      ? (host as HTMLDialogElement).open
      : kind === "popover"
        ? host.matches(":popover-open")
        : true;
  input.focus();
  const events: string[] = [];
  watch(input, events);
  const steps: unknown[] = [];
  for (let i = 0; i < 3; i++) {
    if (!isOpen()) break;
    events.length = 0;
    await userEvent.keyboard("{Escape}");
    await tick();
    steps.push({ value: input.value, open: isOpen(), events: [...events] });
  }
  host.remove();
  return steps;
}

it("probe B: Escape in a native search field, untouched", async () => {
  log.B = {
    plain: await nativeSearch("none", "Saved"),
    modalDialog: await nativeSearch("dialog", "Saved"),
    autoPopover: await nativeSearch("popover", "Saved"),
    modalDialogEmpty: await nativeSearch("dialog", ""),
  };
});

it("probe B2: Escape in a native text field in a modal dialog (control)", async () => {
  const dialog = document.createElement("dialog");
  dialog.innerHTML = `<input type="text" value="Saved">`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector("input")!.focus();
  await userEvent.keyboard("{Escape}");
  await tick();
  log.B2 = { open: dialog.open };
  dialog.remove();
});

// The "switch the native clear off" candidate: a controlled React search input whose onChange
// ignores the text change that an unprevented Escape keydown's default action makes.
function Ignoring({ report }: { report: (line: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const escaping = useRef(false);
  return (
    <input
      type="search"
      data-testid="ignoring"
      value={draft ?? "Saved"}
      onChange={(event) => {
        report(
          `onChange:${JSON.stringify(event.currentTarget.value)}:escaping=${escaping.current}`,
        );
        if (escaping.current) return;
        setDraft(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (draft !== null && draft !== "Saved") {
          setDraft(null);
          event.preventDefault();
          return;
        }
        escaping.current = true;
        setTimeout(() => {
          escaping.current = false;
        }, 0);
      }}
    />
  );
}

it("probe C: ignoring the native clear's text change in a controlled input", async () => {
  const out: Record<string, unknown> = {};
  for (const kind of ["none", "dialog"] as const) {
    const lines: string[] = [];
    const host =
      kind === "dialog" ? document.createElement("dialog") : document.createElement("div");
    document.body.append(host);
    const view = render(<Ignoring report={(line) => lines.push(line)} />, { container: host });
    if (kind === "dialog") (host as HTMLDialogElement).showModal();
    const input = host.querySelector("input")!;
    input.focus();
    const native: string[] = [];
    watch(input, native);
    await userEvent.keyboard("{Escape}");
    await tick();
    const first = {
      value: input.value,
      open: kind === "dialog" ? (host as HTMLDialogElement).open : true,
      react: [...lines],
      native: [...native],
      selection: [input.selectionStart, input.selectionEnd],
    };
    // then type: does a later edit still register?
    lines.length = 0;
    if (kind === "dialog" && !(host as HTMLDialogElement).open)
      (host as HTMLDialogElement).showModal();
    input.focus();
    await userEvent.keyboard("x");
    await tick();
    const typed = { value: input.value, react: [...lines] };
    lines.length = 0;
    await userEvent.keyboard("{Escape}");
    await tick();
    const reverted = {
      value: input.value,
      open: kind === "dialog" ? (host as HTMLDialogElement).open : true,
      react: [...lines],
    };
    out[kind] = { first, typed, reverted };
    view.unmount();
    host.remove();
  }
  log.C = out;
});

it("probe Z: print", () => {
  expect.fail(`PROBE-OUTPUT ${JSON.stringify(log, null, 1)}`);
});
