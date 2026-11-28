// #203 cross-engine probes P1-P8 (design/CHANGELOG.md, "2026-11-28, #203, #204"), against a
// minimal prototype made of plain React elements. Temporary: the rows move to the components.
import { act, render, screen } from "@testing-library/react";
import { useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { user } from "./browser-user.js";
import { supportsBaseSelect } from "./engine.js";

function recordFormEvents(form: HTMLFormElement): string[] {
  const events: string[] = [];
  for (const type of ["input", "change"]) {
    form.addEventListener(type, (e) => events.push(`${type}:${(e.target as HTMLElement).id}`));
  }
  return events;
}

const cancel = (e: ChangeEvent<HTMLInputElement>) => {
  e.preventDefault();
};

describe("P1 checkbox", () => {
  it.each([["checkbox"], ["switch"]])(
    "%s: click, Space and label click change nothing",
    async (role) => {
      render(
        <form data-testid="form">
          <input
            id="box"
            type="checkbox"
            role={role === "switch" ? "switch" : undefined}
            checked={false}
            onChange={cancel}
          />
          <label htmlFor="box">Box</label>
        </form>,
      );
      const form = screen.getByTestId("form") as HTMLFormElement;
      const events = recordFormEvents(form);
      const box = form.querySelector("input")!;
      await user.click(box);
      expect(box.checked).toBe(false);
      box.focus();
      await user.keyboard(" ");
      expect(box.checked).toBe(false);
      await user.click(form.querySelector("label")!);
      expect(box.checked).toBe(false);
      await act(async () => {});
      expect(box.checked).toBe(false);
      expect(events).toEqual([]);
      // Still focusable and submitted when checked.
    },
  );

  it("a checked read-only box stays checked and is submitted", async () => {
    render(
      <form data-testid="form">
        <input id="box" name="b" value="on" type="checkbox" checked onChange={cancel} />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    const events = recordFormEvents(form);
    const box = form.querySelector("input")!;
    await user.click(box);
    expect(box.checked).toBe(true);
    expect(events).toEqual([]);
    expect(new FormData(form).get("b")).toBe("on");
  });
});

function Radios({ readOnly }: { readOnly: boolean }) {
  return (
    <form data-testid="form">
      <button type="button" id="before">
        before
      </button>
      {["a", "b", "c"].map((v) => (
        <label key={v}>
          <input
            id={`r-${v}`}
            type="radio"
            name="g"
            value={v}
            checked={v === "b"}
            onChange={readOnly ? cancel : () => {}}
          />
          {v}
        </label>
      ))}
      <button type="button" id="after">
        after
      </button>
    </form>
  );
}

describe("P2 / P3 radio", () => {
  const radio = (v: string) => document.getElementById(`r-${v}`) as HTMLInputElement;

  it.each([["a"], ["c"]])("baseline: Tab from a focused unchecked radio %s", async (v) => {
    render(
      <form>
        {["a", "b", "c"].map((x) => (
          <input key={x} id={`r-${x}`} type="radio" name="g" defaultChecked={x === "b"} />
        ))}
        <button type="button" id="after">
          after
        </button>
      </form>,
    );
    radio(v).focus();
    await user.tab();
    console.log(`[baseline] Tab from ${v} -> ${document.activeElement?.id}`);
  });

  it("P2: a click on an unchecked radio leaves the checked one checked; no input / change", async () => {
    render(<Radios readOnly />);
    const events = recordFormEvents(screen.getByTestId("form") as HTMLFormElement);
    await user.click(radio("a"));
    expect(radio("a").checked).toBe(false);
    expect(radio("b").checked).toBe(true);
    await user.click(radio("c").parentElement!);
    expect(radio("c").checked).toBe(false);
    expect(radio("b").checked).toBe(true);
    await act(async () => {});
    expect(radio("b").checked).toBe(true);
    expect(events).toEqual([]);
  });

  it.each([["{ArrowDown}"], ["{ArrowRight}"], ["{ArrowUp}"], ["{ArrowLeft}"]])(
    "P3: %s moves focus and checks nothing; the checked radio stays the Tab stop",
    async (key) => {
      render(<Radios readOnly />);
      const events = recordFormEvents(screen.getByTestId("form") as HTMLFormElement);
      radio("b").focus();
      await user.keyboard(key);
      await act(async () => {});
      const forward = key === "{ArrowDown}" || key === "{ArrowRight}";
      expect(document.activeElement).toBe(radio(forward ? "c" : "a"));
      expect(radio("a").checked).toBe(false);
      expect(radio("b").checked).toBe(true);
      expect(radio("c").checked).toBe(false);
      expect(events).toEqual([]);
      // Tab out and back. From an unchecked radio before the checked one, Tab first lands on the
      // checked radio in Chromium and Firefox (platform behaviour, the baseline row above shows
      // it without any handler); the unchecked radios are never stops.
      const visited: string[] = [];
      for (let i = 0; i < 3 && document.activeElement?.id !== "after"; i++) {
        await user.tab();
        visited.push(document.activeElement!.id);
      }
      expect(visited.filter((id) => id !== "r-b" && id !== "after")).toEqual([]);
      expect(document.activeElement?.id).toBe("after");
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(radio("b"));
    },
  );

  it("P3: at the end of the group the focus does what it does without the handler", async () => {
    // Reference: where does ArrowDown from the last radio go, with nothing cancelled?
    const { unmount } = render(<Radios readOnly={false} />);
    radio("c").focus();
    await user.keyboard("{ArrowDown}");
    const reference = document.activeElement?.id;
    unmount();
    render(<Radios readOnly />);
    const events = recordFormEvents(screen.getByTestId("form") as HTMLFormElement);
    radio("c").focus();
    await user.keyboard("{ArrowDown}");
    await act(async () => {});
    expect(document.activeElement?.id).toBe(reference);
    expect(radio("b").checked).toBe(true);
    expect(events).toEqual([]);
  });
});

function ReadOnlySelect() {
  const [value, setValue] = useState("b");
  const ref = useRef<HTMLSelectElement>(null);
  useLayoutEffect(() => {
    // The reset target: option "a" has the `selected` attribute.
    ref.current!.querySelector<HTMLOptionElement>('option[value="a"]')!.defaultSelected = true;
    ref.current!.value = value;
  }, []);
  return (
    <form
      data-testid="form"
      onReset={(e) => {
        const select = e.currentTarget.querySelector("select")!;
        setTimeout(() => setValue(select.value));
      }}
    >
      <select
        ref={ref}
        id="sel"
        name="fruit"
        aria-label="Fruit"
        aria-readonly="true"
        value={value}
        onChange={() => {}}
      >
        {["a", "b", "c", "d"].map((v) => (
          <option key={v} value={v} disabled={v !== value}>
            {v.toUpperCase()}pple
          </option>
        ))}
      </select>
      <button type="button" id="after">
        after
      </button>
    </form>
  );
}

describe("P4 select", () => {
  const sel = () => document.getElementById("sel") as HTMLSelectElement;

  it("closed select: arrows, Home / End and typeahead change nothing; Tab order; FormData; reset", async () => {
    render(<ReadOnlySelect />);
    const form = screen.getByTestId("form") as HTMLFormElement;
    const events = recordFormEvents(form);
    await user.tab();
    expect(document.activeElement).toBe(sel());
    for (const key of ["{ArrowDown}", "{ArrowUp}", "{Home}", "{End}", "c", "d", "a"]) {
      await user.keyboard(key);
      // A key may open a picker in some engines; close it without committing.
      if (sel().matches(":open")) await user.keyboard("{Escape}");
      expect(sel().value).toBe("b");
    }
    await act(async () => {});
    expect(events).toEqual([]);
    expect(new FormData(form).get("fruit")).toBe("b");
    await act(async () => {
      form.reset();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(sel().value).toBe("a");
    expect(sel().querySelector<HTMLOptionElement>('option[value="a"]')!.disabled).toBe(false);
    expect(sel().querySelector<HTMLOptionElement>('option[value="b"]')!.disabled).toBe(true);
    expect(new FormData(form).get("fruit")).toBe("a");
  });

  describe.runIf(supportsBaseSelect)("customizable select picker", () => {
    let style: HTMLStyleElement;
    beforeAll(() => {
      style = document.createElement("style");
      style.textContent = `select { appearance: base-select; } select::picker(select) { appearance: base-select; }`;
      document.head.append(style);
    });
    afterAll(() => style.remove());

    it("a click on a disabled option in the open picker changes nothing", async () => {
      render(<ReadOnlySelect />);
      const form = screen.getByTestId("form") as HTMLFormElement;
      const events = recordFormEvents(form);
      await user.click(sel());
      await expect.poll(() => sel().matches(":open")).toBe(true);
      const c = sel().querySelector<HTMLOptionElement>('option[value="c"]')!;
      await act(async () => {
        await userEvent.click(c, { force: true });
      });
      await act(async () => {});
      expect(sel().value).toBe("b");
      for (const key of ["{ArrowDown}", "{Enter}"]) {
        if (!sel().matches(":open")) break;
        await user.keyboard(key);
      }
      expect(sel().value).toBe("b");
      if (sel().matches(":open")) await user.keyboard("{Escape}");
      sel().blur();
      // Keys on the closed customizable select.
      sel().focus();
      for (const key of ["{ArrowDown}", "{ArrowUp}", "{Home}", "{End}", "c"]) {
        await user.keyboard(key);
        if (sel().matches(":open")) await user.keyboard("{Escape}");
        expect(sel().value).toBe("b");
      }
      expect(events).toEqual([]);
    });
  });
});

describe("P5 / P6 range", () => {
  const KEYS = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
    "PageUp",
    "PageDown",
  ];

  it("P5: keydown preventDefault on the moving keys leaves the value; no input", async () => {
    render(
      <form data-testid="form">
        <input
          id="range"
          type="range"
          aria-label="Volume"
          value={50}
          onChange={() => {}}
          onKeyDown={(e) => {
            if (KEYS.includes(e.key)) e.preventDefault();
          }}
        />
      </form>,
    );
    const events = recordFormEvents(screen.getByTestId("form") as HTMLFormElement);
    const range = document.getElementById("range") as HTMLInputElement;
    range.focus();
    for (const key of KEYS) {
      await user.keyboard(`{${key}}`);
      expect(range.value).toBe("50");
    }
    await act(async () => {});
    expect(range.value).toBe("50");
    expect(events).toEqual([]);
  });

  it("P6: a native input on a controlled range whose onChange updates nothing is written back", async () => {
    let seen: string | null = null;
    render(
      <input
        id="range"
        type="range"
        aria-label="Volume"
        value={50}
        onChange={(e) => (seen = e.target.value)}
      />,
    );
    const range = document.getElementById("range") as HTMLInputElement;
    // The prototype setter: React's value tracker would hide the change from onChange.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(range, "70");
    act(() => {
      range.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(seen).toBe("70");
    expect(range.value).toBe("50");
    await act(async () => {});
    expect(range.value).toBe("50");
  });
});

describe("P7 before hydration", () => {
  it("a read-only checkbox and range changed before hydration are back after mount, no dispatch; select and text could not change", async () => {
    const dispatched: string[] = [];
    function App() {
      const box = useRef<HTMLInputElement>(null);
      const range = useRef<HTMLInputElement>(null);
      useLayoutEffect(() => {
        // Rule 10 prototype: restore what the server rendered, dispatch nothing.
        if (box.current!.checked !== false) box.current!.checked = false;
        if (range.current!.value !== "50") range.current!.value = "50";
      }, []);
      return (
        <form id="f">
          <input
            ref={box}
            id="box"
            type="checkbox"
            aria-readonly="true"
            checked={false}
            onChange={(e) => {
              e.preventDefault();
              dispatched.push("box");
            }}
          />
          <input
            ref={range}
            id="range"
            type="range"
            aria-readonly="true"
            value={50}
            onChange={() => dispatched.push("range")}
          />
          <select id="sel" aria-label="Fruit" value="b" onChange={() => dispatched.push("sel")}>
            <option value="a" disabled>
              A
            </option>
            <option value="b">B</option>
            <option value="c" disabled>
              C
            </option>
          </select>
          <input
            id="text"
            aria-label="Text"
            readOnly
            value="fixed"
            onChange={() => dispatched.push("text")}
          />
        </form>
      );
    }
    const container = document.createElement("div");
    container.innerHTML = renderToString(<App />);
    document.body.append(container);
    const box = container.querySelector<HTMLInputElement>("#box")!;
    const range = container.querySelector<HTMLInputElement>("#range")!;
    const sel = container.querySelector<HTMLSelectElement>("#sel")!;
    const text = container.querySelector<HTMLInputElement>("#text")!;
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await userEvent.click(box);
      expect(box.checked).toBe(true);
      range.focus();
      await userEvent.keyboard("{End}");
      expect(range.value).toBe("100");
      sel.focus();
      await userEvent.keyboard("{ArrowDown}");
      if (sel.matches(":open")) await userEvent.keyboard("{Escape}");
      expect(sel.value).toBe("b");
      await userEvent.click(text);
      await userEvent.keyboard("abc");
      expect(text.value).toBe("fixed");
      const events = recordFormEvents(container.querySelector("form")!);
      const recoverable: unknown[] = [];
      await act(async () => {
        root = hydrateRoot(container, <App />, { onRecoverableError: (e) => recoverable.push(e) });
      });
      await act(async () => {});
      expect(recoverable).toEqual([]);
      expect(box.checked).toBe(false);
      expect(range.value).toBe("50");
      expect(sel.value).toBe("b");
      expect(text.value).toBe("fixed");
      expect(dispatched).toEqual([]);
      expect(events).toEqual([]);
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});

describe("P8 validation", () => {
  it("a control without its native required, and a readonly required empty text input, do not block requestSubmit", async () => {
    let submitted = 0;
    render(
      <form
        data-testid="form"
        onSubmit={(e) => {
          e.preventDefault();
          submitted++;
        }}
      >
        {/* read-only: the library withholds `required` */}
        <input
          type="checkbox"
          name="agree"
          aria-readonly="true"
          aria-required="true"
          checked={false}
          onChange={cancel}
        />
        <input name="text" aria-label="Text" required readOnly value="" />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    const text = form.querySelector<HTMLInputElement>('input[name="text"]')!;
    expect(text.willValidate).toBe(false);
    expect(form.checkValidity()).toBe(true);
    act(() => form.requestSubmit());
    expect(submitted).toBe(1);
  });
});
