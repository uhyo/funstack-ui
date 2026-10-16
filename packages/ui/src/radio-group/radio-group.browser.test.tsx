// RadioGroup rows that need a real engine (design/components/radio-group.md section 12): the
// native keyboard (arrows with wrap, RTL mirroring and disabled skipping, Space, Tab / Shift+Tab,
// Home/End doing nothing), a real label click, a real click before hydration, React's automatic
// reset after a real form action, and the pseudo-classes (`:checked`, `:indeterminate`,
// `:user-invalid`). Runs in Chromium, Firefox and WebKit.
//
// Not automated: the accessibility tree (radiogroup named by the legend) beyond what
// `toHaveAccessibleName` computes, and Safari's "press Tab to highlight each item" setting.
import { act, render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { deferred } from "../__tests__/helpers.js";
import { RadioGroup } from "./index.js";
import type { RadioGroupValueChangeDetails } from "./index.js";

type ActionFn = (next: string | null, details: RadioGroupValueChangeDetails) => unknown;

const flush = () => act(async () => {});
const radio = (v: string) => screen.getByRole("radio", { name: v }) as HTMLInputElement;
const group = () => screen.getByRole("radiogroup");
const checkedValues = () =>
  (screen.getAllByRole("radio") as HTMLInputElement[])
    .filter((r) => r.matches(":checked"))
    .map((r) => r.value);

function Fruits({
  action,
  defaultValue = "a",
  disabled = [],
  dir,
}: {
  action?: ActionFn;
  defaultValue?: string | null;
  disabled?: readonly string[];
  dir?: "rtl";
}) {
  return (
    <div dir={dir}>
      <button type="button">before</button>
      <RadioGroup.Root aria-label="Fruit" defaultValue={defaultValue} valueChangeAction={action}>
        {["a", "b", "c", "d"].map((v) => (
          <label key={v} style={{ display: "inline-block", marginInline: "1em" }}>
            <RadioGroup.Item value={v} disabled={disabled.includes(v)} /> {v}
          </label>
        ))}
      </RadioGroup.Root>
      <button type="button">after</button>
    </div>
  );
}

describe("RadioGroup (browser)", () => {
  describe("native keyboard", () => {
    it("arrows check the next / previous radio, wrap, and dispatch once per press", async () => {
      const action = vi.fn<ActionFn>();
      render(<Fruits action={action} />);
      radio("a").focus();

      await user.keyboard("{ArrowDown}");
      await flush();
      expect(radio("b")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flush();
      expect(radio("c")).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{ArrowDown}");
      await flush();
      // Wrapped from d to a.
      expect(radio("a")).toHaveFocus();
      await user.keyboard("{ArrowUp}");
      await flush();
      expect(radio("d")).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      await flush();
      expect(radio("c")).toHaveFocus();

      expect(action.mock.calls.map(([n]) => n)).toEqual(["b", "c", "d", "a", "d", "c"]);
      expect(action.mock.calls.every(([, d]) => d.event?.type === "click")).toBe(true);
      expect(action.mock.calls.every(([, d]) => d.reason === "activate")).toBe(true);
      expect(checkedValues()).toEqual(["c"]);
      expect(radio("c")).toHaveAttribute("data-checked", "");
    });

    it("mirrors ArrowLeft / ArrowRight under dir=rtl", async () => {
      const action = vi.fn<ActionFn>();
      render(<Fruits action={action} dir="rtl" defaultValue="b" />);
      radio("b").focus();
      await user.keyboard("{ArrowRight}");
      await flush();
      expect(radio("a")).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      await user.keyboard("{ArrowLeft}");
      await flush();
      expect(radio("c")).toHaveFocus();
      // Up / Down are not mirrored.
      await user.keyboard("{ArrowDown}");
      await flush();
      expect(radio("d")).toHaveFocus();
      expect(action.mock.calls.map(([n]) => n)).toEqual(["a", "b", "c", "d"]);
      expect(checkedValues()).toEqual(["d"]);
    });

    it("skips disabled radios, and a disabled group takes no focus", async () => {
      const action = vi.fn<ActionFn>();
      const { unmount } = render(<Fruits action={action} disabled={["b", "c"]} />);
      radio("a").focus();
      await user.keyboard("{ArrowDown}");
      await flush();
      expect(radio("d")).toHaveFocus();
      expect(action.mock.calls.map(([n]) => n)).toEqual(["d"]);
      unmount();

      render(
        <>
          <button type="button">before</button>
          <RadioGroup.Root aria-label="Off" disabled defaultValue="x" valueChangeAction={action}>
            <RadioGroup.Item value="x" aria-label="x" />
          </RadioGroup.Root>
          <button type="button">after</button>
        </>,
      );
      screen.getByRole("button", { name: "before" }).focus();
      await user.keyboard("{Tab}");
      expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("Tab enters on the checked radio, Shift+Tab leaves; Space checks; Home/End do nothing", async () => {
      const action = vi.fn<ActionFn>();
      render(<Fruits action={action} defaultValue="c" />);
      screen.getByRole("button", { name: "before" }).focus();
      await user.keyboard("{Tab}");
      expect(radio("c")).toHaveFocus();
      await user.keyboard("{Tab}");
      expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
      await user.keyboard("{Shift>}{Tab}{/Shift}");
      expect(radio("c")).toHaveFocus();

      await user.keyboard("{Home}");
      await user.keyboard("{End}");
      await flush();
      expect(radio("c")).toHaveFocus();
      expect(action).not.toHaveBeenCalled();

      // Space on the checked radio does nothing; on another radio it checks it.
      await user.keyboard(" ");
      await flush();
      expect(action).not.toHaveBeenCalled();
      radio("a").focus();
      await user.keyboard(" ");
      await flush();
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("a");
      expect(action.mock.calls[0]?.[1].event?.type).toBe("click");
      expect(checkedValues()).toEqual(["a"]);
    });
  });

  it("a real label click dispatches once; :checked follows the optimistic value", async () => {
    const d = deferred();
    const action = vi.fn<ActionFn>(() => d.promise);
    render(<Fruits action={action} />);
    await user.click(screen.getByText("b"));
    expect(action).toHaveBeenCalledTimes(1);
    expect(checkedValues()).toEqual(["b"]);
    expect(radio("b")).toHaveAttribute("data-pending", "");
    expect(group()).toHaveAttribute("data-pending", "");
    await act(async () => {
      d.resolve();
    });
    expect(checkedValues()).toEqual(["b"]);
    expect(group()).not.toHaveAttribute("data-pending");
  });

  it("a controlled veto rolls :checked back to the previous radio after settle", async () => {
    const d = deferred();
    render(
      <RadioGroup.Root aria-label="Fruit" value="a" valueChangeAction={() => d.promise}>
        <RadioGroup.Item value="a" aria-label="a" />
        <RadioGroup.Item value="b" aria-label="b" />
      </RadioGroup.Root>,
    );
    await user.click(radio("b"));
    expect(checkedValues()).toEqual(["b"]);
    await act(async () => {
      d.resolve();
    });
    expect(checkedValues()).toEqual(["a"]);
    expect(radio("b")).not.toHaveAttribute("data-checked");
  });

  it("a click cancelled by a pass-through onClick does not dispatch and the DOM reverts", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const action = vi.fn<ActionFn>();
    render(
      <RadioGroup.Root aria-label="Fruit" defaultValue="a" valueChangeAction={action}>
        <RadioGroup.Item value="a" aria-label="a" />
        <RadioGroup.Item value="b" aria-label="b" onClick={(e) => e.preventDefault()} />
      </RadioGroup.Root>,
    );
    await user.click(radio("b"));
    await flush();
    expect(action).not.toHaveBeenCalled();
    expect(checkedValues()).toEqual(["a"]);
    expect(radio("a")).toHaveAttribute("data-checked", "");
    const libraryWarnings = consoleError.mock.calls.filter(([m]) =>
      String(m).startsWith("RadioGroup"),
    );
    expect(libraryWarnings).toHaveLength(0);
    consoleError.mockRestore();
  });

  it("an empty group matches :indeterminate; required radios match :user-invalid after a submit attempt", async () => {
    render(
      <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
        <RadioGroup.Root aria-label="Plan" name="plan" required>
          <RadioGroup.Item value="free" aria-label="free" />
          <RadioGroup.Item value="pro" aria-label="pro" />
        </RadioGroup.Root>
        <button type="submit">Save</button>
      </form>,
    );
    expect(radio("free").matches(":indeterminate")).toBe(true);
    expect(radio("free").matches(":user-invalid")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(radio("free").matches(":user-invalid")).toBe(true);
    expect(radio("pro").matches(":user-invalid")).toBe(true);
    await user.click(radio("pro"));
    expect(radio("free").matches(":indeterminate")).toBe(false);
    expect(radio("free").matches(":user-invalid")).toBe(false);
  });

  it("a real click before hydration is reconciled with one platform dispatch", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const action = vi.fn<ActionFn>();
    const ui: ReactNode = (
      <RadioGroup.Root aria-label="Fruit" defaultValue="a" valueChangeAction={action}>
        <RadioGroup.Item value="a" aria-label="a" />
        <RadioGroup.Item value="b" aria-label="b" />
        <RadioGroup.Item value="c" aria-label="c" />
      </RadioGroup.Root>
    );
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(ui);
    const serverC = container.querySelector<HTMLInputElement>('input[value="c"]')!;
    await user.click(serverC);
    expect(serverC.checked).toBe(true);

    render(ui, { container, hydrate: true });
    await flush();
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]?.[0]).toBe("c");
    expect(action.mock.calls[0]?.[1].reason).toBe("platform");
    expect(action.mock.calls[0]?.[1].event).toBeUndefined();
    expect(radio("c")).toBe(serverC);
    expect(checkedValues()).toEqual(["c"]);
    expect(radio("c")).toHaveAttribute("data-checked", "");
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    container.remove();
  });

  it.each([
    ["a value", "free"],
    ["null", null],
  ] as const)(
    "follows React's automatic reset after a successful form action, to %s",
    async (_label, initial) => {
      const d = deferred();
      const submitted: [string, FormDataEntryValue][][] = [];
      const action = vi.fn<ActionFn>();
      function PlanForm() {
        return (
          <form
            action={async (formData) => {
              submitted.push([...formData]);
              await d.promise;
            }}
          >
            <RadioGroup.Root
              aria-label="Plan"
              name="plan"
              defaultValue={initial}
              valueChangeAction={action}
            >
              <RadioGroup.Item value="free" aria-label="free" />
              <RadioGroup.Item value="pro" aria-label="pro" />
            </RadioGroup.Root>
            <button type="submit">Save</button>
          </form>
        );
      }
      render(<PlanForm />);
      await user.click(radio("pro"));
      expect(checkedValues()).toEqual(["pro"]);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await act(async () => {
        d.resolve();
      });
      await flush();
      expect(submitted).toEqual([[["plan", "pro"]]]);
      expect(action.mock.calls.map(([n, det]) => [n, det.reason, det.event?.type])).toEqual([
        ["pro", "activate", "click"],
        [initial, "platform", "reset"],
      ]);
      const expected = initial === null ? [] : [initial];
      expect(checkedValues()).toEqual(expected);
      expect(
        screen
          .getAllByRole("radio")
          .filter((r) => r.hasAttribute("data-checked"))
          .map((r) => (r as HTMLInputElement).value),
      ).toEqual(expected);
      // Still in sync: the next click checks again.
      await user.click(radio("pro"));
      expect(checkedValues()).toEqual(["pro"]);
    },
  );

  it("follows a real <button type=reset> click in controlled mode", async () => {
    const actions: [string | null, string, string | undefined][] = [];
    function Settings() {
      const [value, setValue] = useState<string | null>("a");
      return (
        <form>
          <RadioGroup.Root
            aria-label="Fruit"
            value={value}
            valueChangeAction={(next, details) => {
              actions.push([next, details.reason, details.event?.type]);
              startTransition(() => setValue(next));
            }}
          >
            <RadioGroup.Item value="a" aria-label="a" />
            <RadioGroup.Item value="b" aria-label="b" />
          </RadioGroup.Root>
          <button type="reset">Reset</button>
        </form>
      );
    }
    render(<Settings />);
    await user.click(radio("b"));
    expect(checkedValues()).toEqual(["b"]);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await flush();
    expect(actions).toEqual([
      ["b", "activate", "click"],
      ["a", "platform", "reset"],
    ]);
    expect(checkedValues()).toEqual(["a"]);
  });
});
