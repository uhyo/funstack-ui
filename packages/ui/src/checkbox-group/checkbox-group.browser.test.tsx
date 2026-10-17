// CheckboxGroup rows that need a real engine (design/components/checkbox-group.md section 13):
// the Parent's `:indeterminate` (14), group `required` as the user sees it (`:user-invalid`,
// `validationMessage`, blocked submission, before hydration too; 17), no view transition from a
// mounted Item without `transition` (30), the accessibility tree (34, Chromium through CDP; the
// other engines assert the DOM-level equivalent), and Tab / Space / a real label click as the
// engine does them (35). Runs in Chromium, Firefox and WebKit.
/// <reference types="@vitest/browser-playwright" />
import { act, render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ReactNode, ViewTransitionClass } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp } from "vitest/browser";
import { user } from "../__tests__/browser-user.js";
import { browserName } from "../__tests__/engine.js";
import { deferred } from "../__tests__/helpers.js";
import { CheckboxGroup } from "./index.js";
import type { CheckboxGroupValueChangeDetails } from "./index.js";

type ActionFn = (next: string[], details: CheckboxGroupValueChangeDetails) => unknown;

const flush = () => act(async () => {});
const box = (v: string) => screen.getByRole("checkbox", { name: v }) as HTMLInputElement;
const items = () =>
  (screen.getAllByRole("checkbox") as HTMLInputElement[]).filter((b) => b.name !== "");
const checkedValues = () =>
  items()
    .filter((b) => b.matches(":checked"))
    .map((b) => b.value);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CheckboxGroup (browser)", () => {
  describe("Parent :indeterminate", () => {
    it("matches after mount, flips with an Item click at once, and matches again after a rollback", async () => {
      const d = deferred();
      render(
        <CheckboxGroup.Root aria-label="T" value={["a"]} valueChangeAction={() => d.promise}>
          <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
      );
      const parent = box("all");
      expect(parent.matches(":indeterminate")).toBe(true);
      expect(parent.matches(":checked")).toBe(false);

      await user.click(box("b"));
      // Derived from the optimistic set: no longer mixed while the action is pending.
      expect(box("b")).toHaveAttribute("data-pending", "");
      expect(parent.matches(":indeterminate")).toBe(false);
      expect(parent.matches(":checked")).toBe(true);

      // The controlled parent never adopts the change: a veto, as after a caught rejection.
      await act(async () => {
        d.resolve();
      });
      expect(parent.matches(":indeterminate")).toBe(true);
      expect(parent.matches(":checked")).toBe(false);
      expect(parent).toHaveAttribute("data-indeterminate", "");
    });

    it("a Parent click from mixed checks every Item; a rollback returns it to mixed", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      render(
        <CheckboxGroup.Root aria-label="T" value={["a"]} valueChangeAction={action}>
          <label>
            <CheckboxGroup.Parent values={["a", "b", "c"]} /> all
          </label>
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
          <CheckboxGroup.Item value="c" aria-label="c" />
        </CheckboxGroup.Root>,
      );
      // A real click on the label text.
      await user.click(screen.getByText("all"));
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[1].added).toEqual(["b", "c"]);
      expect(checkedValues()).toEqual(["a", "b", "c"]);
      expect(box("all").matches(":checked")).toBe(true);
      expect(box("all").matches(":indeterminate")).toBe(false);
      await act(async () => {
        d.resolve();
      });
      expect(checkedValues()).toEqual(["a"]);
      expect(box("all").matches(":indeterminate")).toBe(true);
      expect(box("all").matches(":checked")).toBe(false);
    });
  });

  describe("group required", () => {
    function RequiredForm({ onSubmit }: { onSubmit: () => void }) {
      return (
        <form
          data-testid="form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <CheckboxGroup.Root aria-label="Toppings" name="t" required>
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" />
          </CheckboxGroup.Root>
          <button type="submit">Save</button>
        </form>
      );
    }

    it("blocks submission while empty, every Item matches :user-invalid after the attempt; one check clears it", async () => {
      const onSubmit = vi.fn();
      render(<RequiredForm onSubmit={onSubmit} />);
      const form = screen.getByTestId("form") as HTMLFormElement;
      expect(box("a").matches(":user-invalid")).toBe(false);
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(onSubmit).not.toHaveBeenCalled();
      for (const v of ["a", "b"]) {
        expect(box(v).matches(":user-invalid")).toBe(true);
        expect(box(v).validationMessage).not.toBe("");
      }
      await user.click(box("b"));
      for (const v of ["a", "b"]) {
        expect(box(v).matches(":user-invalid")).toBe(false);
        expect(box(v).required).toBe(false);
      }
      await act(async () => {
        form.requestSubmit();
      });
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("before hydration the attribute is static: one box checked by the user, still blocked by another", async () => {
      const container = document.createElement("div");
      document.body.append(container);
      container.innerHTML = renderToString(<RequiredForm onSubmit={() => {}} />);
      const form = container.querySelector("form")!;
      const a = container.querySelector<HTMLInputElement>('input[value="a"]')!;
      const b = container.querySelector<HTMLInputElement>('input[value="b"]')!;
      expect(a.required && b.required).toBe(true);
      await user.click(a);
      expect(a.checked).toBe(true);
      // Over-blocking until hydration, never under-blocking (design section 7).
      expect(form.checkValidity()).toBe(false);
      expect(b.matches(":invalid")).toBe(true);
      container.remove();
    });
  });

  describe("keyboard and pointer", () => {
    it("Tab visits every enabled box, Space toggles and dispatches once", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <>
          <button type="button">before</button>
          <CheckboxGroup.Root aria-label="T" defaultValue={["b"]} valueChangeAction={action}>
            <CheckboxGroup.Parent values={["a", "b", "c"]} aria-label="all" />
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" />
            <CheckboxGroup.Item value="c" aria-label="c" disabled />
          </CheckboxGroup.Root>
          <button type="button">after</button>
        </>,
      );
      screen.getByRole("button", { name: "before" }).focus();
      await user.keyboard("{Tab}");
      expect(box("all")).toHaveFocus();
      await user.keyboard("{Tab}");
      expect(box("a")).toHaveFocus();
      await user.keyboard("{Tab}");
      expect(box("b")).toHaveFocus();
      await user.keyboard("{Tab}");
      expect(screen.getByRole("button", { name: "after" })).toHaveFocus();

      box("a").focus();
      await user.keyboard(" ");
      await flush();
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toEqual(["a", "b"]);
      expect(action.mock.calls[0]?.[1].event?.type).toBe("click");
      expect(checkedValues()).toEqual(["a", "b"]);

      // Arrows do nothing (no roving, no focusgroup).
      await user.keyboard("{ArrowDown}");
      await flush();
      expect(box("a")).toHaveFocus();
      expect(action).toHaveBeenCalledTimes(1);

      // Over the enabled Items {a, b} the Parent is checked: Space unchecks them and leaves the
      // disabled "c" alone (design 6.2).
      expect(box("all").checked).toBe(true);
      box("all").focus();
      await user.keyboard(" ");
      await flush();
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]?.[0]).toEqual([]);
      expect(action.mock.calls[1]?.[1].removed).toEqual(["a", "b"]);
      expect(box("c").checked).toBe(false);
    });

    it("a click cancelled by a pass-through onClick does not dispatch and the DOM reverts", async () => {
      const action = vi.fn<ActionFn>();
      render(
        <CheckboxGroup.Root aria-label="T" defaultValue={["a"]} valueChangeAction={action}>
          <CheckboxGroup.Parent
            values={["a", "b"]}
            aria-label="all"
            onClick={(e) => e.preventDefault()}
          />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" onClick={(e) => e.preventDefault()} />
        </CheckboxGroup.Root>,
      );
      await user.click(box("b"));
      await user.click(box("all"));
      await flush();
      expect(action).not.toHaveBeenCalled();
      expect(checkedValues()).toEqual(["a"]);
      expect(box("all").matches(":indeterminate")).toBe(true);
    });

    it("a real click before hydration on the Parent is reconciled as check all", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const action = vi.fn<ActionFn>();
      const ui: ReactNode = (
        <CheckboxGroup.Root aria-label="T" defaultValue={["a"]} valueChangeAction={action}>
          <CheckboxGroup.Parent values={["a", "b", "c"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
          <CheckboxGroup.Item value="c" aria-label="c" />
        </CheckboxGroup.Root>
      );
      const container = document.createElement("div");
      document.body.append(container);
      container.innerHTML = renderToString(ui);
      const serverParent = container.querySelector<HTMLInputElement>("input:not([name])")!;
      await user.click(serverParent);
      expect(serverParent.checked).toBe(true);

      render(ui, { container, hydrate: true });
      await flush();
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toEqual(["a", "b", "c"]);
      expect(action.mock.calls[0]?.[1].reason).toBe("platform");
      expect(action.mock.calls[0]?.[1].added).toEqual(["b", "c"]);
      expect(checkedValues()).toEqual(["a", "b", "c"]);
      expect(box("all").matches(":checked")).toBe(true);
      expect(consoleError).not.toHaveBeenCalled();
      container.remove();
    });

    it("follows React's automatic reset after a successful form action", async () => {
      const d = deferred();
      const submitted: [string, FormDataEntryValue][][] = [];
      const action = vi.fn<ActionFn>();
      render(
        <form
          action={async (formData) => {
            submitted.push([...formData]);
            await d.promise;
          }}
        >
          <CheckboxGroup.Root
            aria-label="T"
            name="t"
            defaultValue={["a"]}
            valueChangeAction={action}
          >
            <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
            <CheckboxGroup.Item value="a" aria-label="a" />
            <CheckboxGroup.Item value="b" aria-label="b" />
          </CheckboxGroup.Root>
          <button type="submit">Save</button>
        </form>,
      );
      await user.click(box("b"));
      expect(box("all").matches(":checked")).toBe(true);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await act(async () => {
        d.resolve();
      });
      await flush();
      expect(submitted).toEqual([
        [
          ["t", "a"],
          ["t", "b"],
        ],
      ]);
      expect(action.mock.calls.map(([n, det]) => [n, det.reason, det.event?.type])).toEqual([
        [["a", "b"], "activate", "click"],
        [["a"], "platform", "reset"],
      ]);
      expect(checkedValues()).toEqual(["a"]);
      expect(box("all").matches(":indeterminate")).toBe(true);
    });
  });

  describe("view transitions", () => {
    async function mountItem(transition: ViewTransitionClass | undefined): Promise<number> {
      let calls = 0;
      const original = document.startViewTransition.bind(document);
      const spy = vi.spyOn(document, "startViewTransition").mockImplementation(((
        arg?: StartViewTransitionOptions | ViewTransitionUpdateCallback,
      ) => {
        calls++;
        return original(arg);
      }) as typeof document.startViewTransition);
      function Late() {
        const [shown, setShown] = useState(false);
        return (
          <>
            <button type="button" onClick={() => startTransition(() => setShown(true))}>
              show
            </button>
            <CheckboxGroup.Root aria-label="T">
              <CheckboxGroup.Item value="a" aria-label="a" />
              {shown && (
                <CheckboxGroup.Item
                  value="b"
                  aria-label="b"
                  {...(transition !== undefined && { transition })}
                />
              )}
            </CheckboxGroup.Root>
          </>
        );
      }
      const { unmount } = render(<Late />);
      await act(async () => {
        screen.getByRole("button", { name: "show" }).click();
      });
      await expect.poll(() => screen.queryByRole("checkbox", { name: "b" })).not.toBeNull();
      // Let a started view transition finish so it cannot hold the next test's commits.
      await (
        document as Document & { __reactViewTransition?: ViewTransition | null }
      ).__reactViewTransition?.finished.catch(() => {});
      unmount();
      spy.mockRestore();
      return calls;
    }

    it("an Item mounted in a transition without `transition` starts no view transition", async () => {
      expect(await mountItem(undefined)).toBe(0);
      // Control: with a boundary, the mount does start one (react-dom 19.3, issue #35).
      expect(await mountItem("none")).toBeGreaterThan(0);
    });
  });

  describe("accessibility tree", () => {
    it("the fieldset is a group named by the legend; the Parent is mixed; required follows the set", async () => {
      render(
        <CheckboxGroup.Root required>
          <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
          <CheckboxGroup.Parent values={["a", "b"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>,
      );
      expect(screen.getByRole("group", { name: "Toppings" })).toBeInTheDocument();

      if (browserName !== "chromium") {
        // No CDP: the DOM-level equivalent of what the engines map (HTML-AAM).
        expect(box("a").required).toBe(true);
        await user.click(box("a"));
        expect(box("all").indeterminate).toBe(true);
        expect(box("b").required).toBe(false);
        return;
      }

      type AXValue = { value?: unknown };
      type AXNode = {
        role?: AXValue;
        name?: AXValue;
        properties?: { name: string; value: AXValue }[];
      };
      const session = cdp();
      // The test runs in an iframe of the runner page: read that frame's tree.
      type FrameTree = { frame: { id: string; url: string }; childFrames?: FrameTree[] };
      const { frameTree } = (await session.send("Page.getFrameTree")) as { frameTree: FrameTree };
      const frames: FrameTree[] = [];
      const walk = (t: FrameTree) => {
        frames.push(t);
        t.childFrames?.forEach(walk);
      };
      walk(frameTree);
      const frameId = frames.find((f) => f.frame.url === location.href)?.frame.id;
      async function node(name: string, role: string): Promise<AXNode> {
        const { nodes } = (await session.send("Accessibility.getFullAXTree", { frameId })) as {
          nodes: AXNode[];
        };
        const found = nodes.find((n) => n.name?.value === name && n.role?.value === role);
        if (!found) throw new Error(`no ${role} named ${name} in the AX tree`);
        return found;
      }
      const prop = (n: AXNode, p: string) => n.properties?.find((x) => x.name === p)?.value.value;

      expect((await node("Toppings", "group")).role?.value).toBe("group");
      // Chromium's AX tree has no `required` property for a checkbox (not even with
      // `aria-required`); an unchecked required box is exposed as `invalid` (design section 9).
      // Other engines expose the native constraint differently, and what a screen reader then
      // announces is not asserted here.
      expect(prop(await node("a", "checkbox"), "invalid")).toBe("true");
      expect(prop(await node("all", "checkbox"), "checked")).toBe("false");

      await user.click(box("a"));
      expect(prop(await node("all", "checkbox"), "checked")).toBe("mixed");
      // One box checked: nothing is required, so "b" is no longer invalid.
      expect(prop(await node("b", "checkbox"), "invalid") ?? "false").toBe("false");
    });
  });
});
