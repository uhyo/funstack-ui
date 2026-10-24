// Button rows that need a real engine (design/components/button.md section 13, rows 21-26): focus
// retention while pending (where native `disabled` would blur), Invoker Commands next to an
// action, a Tooltip on a pending Button (real hover and focus, `:popover-open`), implicit form
// submission, the ViewTransition cost, and Chromium's accessibility tree.
import { act, render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ViewTransitionClass } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { getAXNodes, axProperty } from "../__tests__/ax-tree.js";
import { user } from "../__tests__/browser-user.js";
import { browserName, supportsInterestFor } from "../__tests__/engine.js";
import { deferred, expectNotPending, expectPending } from "../__tests__/helpers.js";
import { Form } from "../form/index.js";
import { Tooltip } from "../tooltip/index.js";
import { Button } from "./index.js";

afterEach(async () => {
  await userEvent.unhover(document.body);
});

const button = (name: string) => screen.getByRole("button", { name });
const frames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
    step(n);
  });

describe("focus retention (row 21)", () => {
  it("the pending Button keeps focus, two frames later and after resolve", async () => {
    const d = deferred();
    const action = vi.fn(() => d.promise);
    render(<Button action={action}>Save</Button>);
    button("Save").focus();
    await user.keyboard("{Enter}");
    expect(action).toHaveBeenCalledTimes(1);
    expectPending(button("Save"));
    expect(button("Save")).toHaveAttribute("aria-disabled", "true");
    await frames(2);
    expect(document.activeElement).toBe(button("Save"));
    await act(async () => {
      d.resolve();
    });
    expectNotPending(button("Save"));
    await frames(2);
    expect(document.activeElement).toBe(button("Save"));
  });
});

describe("Invoker Command + action (row 22)", () => {
  it("the second click while pending runs neither the action nor the command", async () => {
    const d = deferred();
    const action = vi.fn(() => d.promise);
    render(
      <>
        <Button commandfor="p" command="toggle-popover" action={action}>
          Toggle
        </Button>
        <div id="p" popover="manual" data-testid="p">
          Panel
        </div>
      </>,
    );
    const isOpen = () => screen.getByTestId("p").matches(":popover-open");
    await user.click(button("Toggle"));
    expect(action).toHaveBeenCalledTimes(1);
    await expect.poll(isOpen).toBe(true);
    expectPending(button("Toggle"));

    // `force`: Playwright's actionability check refuses an `aria-disabled` element.
    await user.click(button("Toggle"), { force: true });
    expect(action).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(true);

    await act(async () => {
      d.resolve();
    });
    expectNotPending(button("Toggle"));
    await user.click(button("Toggle"));
    await expect.poll(isOpen).toBe(false);
    expect(action).toHaveBeenCalledTimes(2);
  });
});

describe("Tooltip on a pending Button (row 23)", () => {
  it.each([
    ["JS path", false],
    ["experimental_interestFor", true],
  ] as const)("%s: hover and focus open it while pending", async (_label, interestFor) => {
    const d = deferred();
    const action = vi.fn(() => d.promise);
    render(
      <div style={{ padding: 120, display: "flex", gap: 40 }}>
        <button type="button">Elsewhere</button>
        <Tooltip.Root delay={0} closeDelay={0}>
          <Tooltip.Trigger
            experimental_interestFor={interestFor}
            render={<Button action={action} aria-label="Delete" />}
          >
            X
          </Tooltip.Trigger>
          <Tooltip.Popup data-testid="popup" experimental_hint={interestFor}>
            Delete it
          </Tooltip.Popup>
        </Tooltip.Root>
      </div>,
    );
    const popup = () => screen.getByTestId("popup");
    const isOpen = () => popup().matches(":popover-open");
    await user.click(button("Delete"));
    expect(action).toHaveBeenCalledTimes(1);
    expectPending(button("Delete"));

    await user.hover(button("Elsewhere"));
    await expect.poll(isOpen, { timeout: 3000 }).toBe(false);
    await user.hover(button("Delete"));
    await expect.poll(isOpen, { timeout: 3000 }).toBe(true);
    if (interestFor && supportsInterestFor) {
      // The browser's Interest Invoker opened it.
      expect(button("Delete").matches(":interest-source")).toBe(true);
    }
    await user.hover(button("Elsewhere"));
    await expect.poll(isOpen, { timeout: 3000 }).toBe(false);

    // Keyboard focus, still pending.
    button("Elsewhere").focus();
    await user.tab();
    expect(document.activeElement).toBe(button("Delete"));
    await expect.poll(isOpen, { timeout: 3000 }).toBe(true);
    expectPending(button("Delete"));
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => {
      d.resolve();
    });
  });
});

describe("implicit submission (row 24)", () => {
  it("Enter in a field submits once; again while pending submits nothing", async () => {
    const d = deferred();
    const draft = vi.fn<(formData: FormData) => Promise<void>>(() => d.promise);
    render(
      <form>
        <input aria-label="Title" name="title" />
        <Button formAction={draft}>Draft</Button>
      </form>,
    );
    const field = screen.getByRole("textbox", { name: "Title" });
    await user.type(field, "x{Enter}");
    await expect.poll(() => draft.mock.calls.length).toBe(1);
    expectPending(button("Draft"));
    field.focus();
    await user.keyboard("{Enter}");
    // Give a second submission every chance to run.
    await frames(2);
    expect(draft).toHaveBeenCalledTimes(1);
    await act(async () => {
      d.resolve();
    });
    expectNotPending(button("Draft"));
  });

  it("with Form.Submit as the default button, Enter submits the form's action", async () => {
    const d = deferred();
    const draft = vi.fn<(formData: FormData) => Promise<void>>(() => d.promise);
    const publish = vi.fn<(formData: FormData) => void>();
    render(
      <form action={publish}>
        <input aria-label="Title" name="title" />
        <Form.Submit>Publish</Form.Submit>
        <Button formAction={draft}>Draft</Button>
      </form>,
    );
    await user.click(button("Draft"));
    expect(draft).toHaveBeenCalledTimes(1);
    expectPending(button("Draft"));
    const field = screen.getByRole("textbox", { name: "Title" });
    await user.type(field, "x{Enter}");
    await expect.poll(() => publish.mock.calls.length).toBe(1);
    expect(draft).toHaveBeenCalledTimes(1);
    await act(async () => {
      d.resolve();
    });
  });
});

describe("ViewTransition (row 25)", () => {
  type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  type VTDocument = Document & { __reactViewTransition?: ViewTransition | null };

  function countViewTransitions(): { readonly calls: () => number } {
    let calls = 0;
    const original = document.startViewTransition.bind(document);
    vi.spyOn(document, "startViewTransition").mockImplementation(((
      arg?: StartViewTransitionOptions | ViewTransitionUpdateCallback,
    ) => {
      calls++;
      return original(arg);
    }) as typeof document.startViewTransition);
    return { calls: () => calls };
  }

  /** A view transition commits in its callback, after any `act` scope (issue #49). */
  async function outsideAct(body: () => Promise<void>): Promise<void> {
    const actEnvironment = (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = false;
    try {
      await body();
      await (document as VTDocument).__reactViewTransition?.finished.catch(() => {});
    } finally {
      (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    }
  }

  async function mount(transition: ViewTransitionClass | undefined): Promise<number> {
    const counter = countViewTransitions();
    function Late() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button type="button" onClick={() => startTransition(() => setShown(true))}>
            show
          </button>
          {shown && <Button {...(transition !== undefined && { transition })}>B</Button>}
        </>
      );
    }
    const { unmount } = render(<Late />);
    await outsideAct(async () => {
      button("show").click();
      await expect.poll(() => screen.queryByRole("button", { name: "B" })).not.toBeNull();
    });
    unmount();
    vi.restoreAllMocks();
    return counter.calls();
  }

  it("a mount in a transition: none without `transition`, one with `none`", async () => {
    expect(await mount(undefined)).toBe(0);
    expect(await mount("none")).toBe(1);
  });

  // react-dom 19.3 starts no view transition for an update of a `"none"` boundary (only for a
  // mount or reveal, transition-boundary.tsx); a real class animates the settle once. The design
  // row expected one call under "none" (memo/developer/button.md).
  it.each([
    ["none", 0],
    ["auto", 1],
  ] as const)(
    'a settle that swaps children(state) under transition="%s": %i call(s)',
    async (transition, n) => {
      const d = deferred();
      render(
        <Button transition={transition} action={() => d.promise}>
          {(s) => (s.pending ? <span>Saving</span> : <span>Save</span>)}
        </Button>,
      );
      const counter = countViewTransitions();
      await outsideAct(async () => {
        button("Save").click();
        await expect.poll(() => button("Saving").dataset["pending"]).toBe("");
        d.resolve();
        await expect.poll(() => screen.queryByRole("button", { name: "Save" })).not.toBeNull();
      });
      expect(counter.calls()).toBe(n);
    },
  );
});

describe.runIf(browserName === "chromium")("accessibility tree (row 26, Chromium CDP)", () => {
  it("the pending Button keeps its name and is reported disabled; after settle it is not", async () => {
    const d = deferred();
    render(<Button action={() => d.promise}>Save changes</Button>);
    const node = async () =>
      (await getAXNodes()).find(
        (n) => n.role?.value === "button" && n.name?.value === "Save changes",
      );
    expect(axProperty(await node(), "disabled")).toBeUndefined();
    await user.click(button("Save changes"));
    expectPending(button("Save changes"));
    const pendingNode = await node();
    expect(pendingNode).toBeDefined();
    // Chromium maps aria-disabled="true" to the `disabled` property (memo/developer/cross-engine.md).
    expect(axProperty(pendingNode, "disabled")).toBe(true);
    await act(async () => {
      d.resolve();
    });
    await expect.poll(async () => axProperty(await node(), "disabled")).toBeUndefined();
  });
});
