// NavigationMenu rows that need a real engine (design/components/navigation-menu.md; test plan in
// design/CHANGELOG.md, the #170 entries): the platform's toggle, Escape, light dismiss and
// one-panel-at-a-time with no library JavaScript at all (server HTML, never hydrated); the Tab
// order through an open panel and the focus-leave close behind it; focus return after Escape and
// after a followed Link; the resolved placement; and `transition` on a library-mode Popup.
//
// Engines: every row runs on Chromium, Firefox and WebKit with the same expectations. The rows
// press with Playwright's real pointer, so where a press does not focus a button (Safari on
// macOS, `pressFocusesButtons()`) the Trigger is focused by script before the press.
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  addStyle,
  onCleanup,
  outsideAct,
  settle,
  spyViewTransitions,
} from "../__tests__/browser-helpers.js";
import { user } from "../__tests__/browser-user.js";
import { pressFocusesButtons } from "../__tests__/engine.js";
import { NavigationMenu } from "./index.js";
import type { NavigationMenuItemProps, NavigationMenuPopupProps } from "./index.js";

const css = `
.nm-list { display: flex; gap: 8px; margin: 0; padding: 0; list-style: none; }
.nm-panel { inset: auto; margin: 0; padding: 8px; border: 1px solid; background: Canvas; }
.nm-panel a { display: block; }
`;

interface NavProps {
  products?: Partial<NavigationMenuItemProps>;
  docs?: Partial<NavigationMenuItemProps>;
  popup?: Partial<NavigationMenuPopupProps>;
  before?: ReactNode;
}

/** Two flyouts and a top-level link, with a focusable control before and after the nav. */
function Nav({ products, docs, popup, before }: NavProps) {
  return (
    <>
      {before}
      <button type="button">Before</button>
      <NavigationMenu.Root aria-label="Main">
        <NavigationMenu.List className="nm-list">
          <NavigationMenu.Item {...products}>
            <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
            <NavigationMenu.Popup className="nm-panel" data-testid="products" {...popup}>
              <NavigationMenu.Link href="#analytics">Analytics</NavigationMenu.Link>
              <NavigationMenu.Link href="#billing">Billing</NavigationMenu.Link>
            </NavigationMenu.Popup>
          </NavigationMenu.Item>
          <NavigationMenu.Item {...docs}>
            <NavigationMenu.Trigger>Docs</NavigationMenu.Trigger>
            <NavigationMenu.Popup className="nm-panel" data-testid="docs">
              <NavigationMenu.Link href="#guides">Guides</NavigationMenu.Link>
            </NavigationMenu.Popup>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavigationMenu.Link href="#pricing">Pricing</NavigationMenu.Link>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
      <button type="button">After</button>
    </>
  );
}

const shown = (testId: string) => screen.getByTestId(testId).matches(":popover-open");
const button = (name: string) => screen.getByRole("button", { name });
const link = (name: string) => screen.getByRole("link", { name });

/** The server HTML, as a browser parses it with no script running. */
function serverHtml(ui: ReactNode): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToString(ui);
  document.body.append(container);
  onCleanup(() => container.remove());
  return container;
}

/** A real press on a Trigger, focusing it first where a press does not (macOS Safari). */
async function press(element: HTMLElement): Promise<void> {
  if (!(await pressFocusesButtons())) act(() => element.focus());
  await user.click(element);
}

describe("NavigationMenu (browser)", () => {
  describe("without JavaScript (server HTML, never hydrated)", () => {
    it("toggle, Escape, light dismiss and one panel at a time are the platform's", async () => {
      addStyle(css);
      await pressFocusesButtons();
      serverHtml(<Nav />);
      await press(button("Products"));
      expect(shown("products")).toBe(true);
      // Toggle.
      await press(button("Products"));
      expect(shown("products")).toBe(false);
      // Escape returns focus to the Trigger.
      await press(button("Products"));
      act(() => link("Analytics").focus());
      await user.keyboard("{Escape}");
      expect(shown("products")).toBe(false);
      expect(button("Products")).toHaveFocus();
      // One at a time.
      await press(button("Products"));
      await press(button("Docs"));
      expect(shown("docs")).toBe(true);
      expect(shown("products")).toBe(false);
      // Light dismiss.
      await user.click(document.body, { position: { x: 5, y: 300 } });
      expect(shown("docs")).toBe(false);
    });

    it("a panel's links are in the HTML and follow the Trigger in the Tab order", async () => {
      addStyle(css);
      serverHtml(<Nav />);
      act(() => button("Products").focus());
      await user.keyboard("{Enter}");
      expect(shown("products")).toBe(true);
      await user.tab();
      expect(link("Analytics")).toHaveFocus();
      await user.tab();
      expect(link("Billing")).toHaveFocus();
      await user.tab();
      expect(button("Docs")).toHaveFocus();
      // No library JavaScript: nothing closes the panel behind (design 8).
      expect(shown("products")).toBe(true);
    });
  });

  describe("after hydration", () => {
    for (const mode of ["JS-free", "library"] as const) {
      const products: Partial<NavigationMenuItemProps> =
        mode === "library" ? { defaultOpen: false } : {};

      it(`${mode}: Tab goes Trigger, the panel's links, the next entry, and the panel closes behind`, async () => {
        addStyle(css);
        render(<Nav products={products} />);
        act(() => button("Products").focus());
        await user.keyboard("{Enter}");
        await settle(() => expect(shown("products")).toBe(true));
        expect(button("Products")).toHaveFocus();
        await user.tab();
        expect(link("Analytics")).toHaveFocus();
        await user.tab();
        expect(link("Billing")).toHaveFocus();
        await user.tab();
        expect(button("Docs")).toHaveFocus();
        await settle(() => expect(shown("products")).toBe(false));
        expect(button("Products")).not.toHaveAttribute("data-open");
      });

      it(`${mode}: Escape after a mouse open returns focus to the Trigger`, async () => {
        addStyle(css);
        await pressFocusesButtons();
        render(<Nav products={products} />);
        await press(button("Products"));
        await settle(() => expect(shown("products")).toBe(true));
        act(() => link("Billing").focus());
        await user.keyboard("{Escape}");
        await settle(() => expect(shown("products")).toBe(false));
        expect(button("Products")).toHaveFocus();
      });

      it(`${mode}: a followed Link closes the panel and focus returns to the Trigger`, async () => {
        addStyle(css);
        await pressFocusesButtons();
        render(<Nav products={products} />);
        await press(button("Products"));
        await settle(() => expect(shown("products")).toBe(true));
        await user.click(link("Analytics"));
        await settle(() => expect(shown("products")).toBe(false));
        expect(button("Products")).toHaveFocus();
        expect(location.hash).toBe("#analytics");
        history.replaceState(null, "", location.pathname + location.search);
      });

      it(`${mode}: a Ctrl-click on a Link leaves the panel open`, async () => {
        addStyle(css);
        render(<Nav products={products} />);
        await press(button("Products"));
        await settle(() => expect(shown("products")).toBe(true));
        // Prevent the new tab; the library's listener still sees the modified click.
        const anchor = link("Analytics");
        const stop = (event: Event) => event.preventDefault();
        anchor.addEventListener("click", stop);
        onCleanup(() => anchor.removeEventListener("click", stop));
        await act(async () => {
          await userEvent.click(anchor, { modifiers: ["ControlOrMeta"] });
        });
        await settle(() => expect(shown("products")).toBe(true));
      });
    }

    it("library: opening another Item's panel is a dismissal of the open one", async () => {
      addStyle(css);
      const fact = vi.fn();
      const action = vi.fn();
      render(
        <Nav
          products={{ openChangeAction: action, onOpenChange: fact }}
          docs={{ defaultOpen: false }}
        />,
      );
      await press(button("Products"));
      await settle(() => expect(shown("products")).toBe(true));
      action.mockClear();
      await press(button("Docs"));
      await settle(() => expect(shown("docs")).toBe(true));
      expect(shown("products")).toBe(false);
      expect(action).not.toHaveBeenCalled();
      expect(fact).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "dismiss" }));
    });

    it("the resolved side and alignment while shown (a flip near the bottom edge)", async () => {
      addStyle(css);
      addStyle(`nav { position: fixed; inset-block-end: 0; inset-inline-start: 0; }`);
      render(<Nav />);
      const panel = screen.getByTestId("products");
      expect(panel).toHaveAttribute("data-side", "bottom");
      expect(panel).toHaveAttribute("data-align", "start");
      await press(button("Products"));
      await settle(() => expect(panel).toHaveAttribute("data-side", "top"));
      expect(panel).toHaveAttribute("data-align", "start");
      const trigger = button("Products").getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      expect(box.bottom).toBeLessThanOrEqual(trigger.top + 1);
      expect(Math.abs(box.left - trigger.left)).toBeLessThanOrEqual(1);
    });

    it("library with transition: the open and a followed Link's close each run one view transition", async () => {
      addStyle(css);
      render(<Nav products={{ defaultOpen: false }} popup={{ transition: "nm-panel" }} />);
      const spy = spyViewTransitions();
      onCleanup(() => spy.restore());
      await outsideAct(async () => {
        button("Products").click();
        await settle(() => expect(shown("products")).toBe(true));
      });
      expect(spy.calls()).toBe(1);
      await outsideAct(async () => {
        link("Analytics").click();
        await settle(() => expect(shown("products")).toBe(false));
      });
      expect(spy.calls()).toBe(2);
      history.replaceState(null, "", location.pathname + location.search);
    });
  });
});
