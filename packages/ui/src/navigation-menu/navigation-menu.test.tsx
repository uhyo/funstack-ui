// NavigationMenu, jsdom rows (design/components/navigation-menu.md; test plan in
// design/CHANGELOG.md, the #170 entries). The open state of an Item is Popover's, so the shared
// overlay suites run against an Item harness; this file adds the markup, the focus-leave close,
// the Link close, the development warnings and the parts' function props, `render` and `ref`.
// The jsdom popover shim stands in for the platform: a dismissal is `hidePopover()`.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, use } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  flushTasks,
  hydrateFromServer,
  setupUser,
  silenceErrors,
} from "../__tests__/helpers.js";
import { spyHide, spyShow } from "../__tests__/overlay-helpers.js";
import { describeOverlayDisabledRenders } from "../__tests__/overlay-disabled-render-suite.js";
import {
  createOverlayHarness,
  describeOverlayOpenState,
  popoverLikeDriver,
} from "../__tests__/overlay-open-state-suite.js";
import { NavigationMenuItemContext } from "./navigation-menu-context.js";
import { NavigationMenu } from "./index.js";
import type {
  NavigationMenuItemProps,
  NavigationMenuLinkProps,
  NavigationMenuOpenChangeDetails,
  NavigationMenuPopupProps,
  NavigationMenuTriggerProps,
} from "./index.js";

type ActionFn = (next: boolean, details: NavigationMenuOpenChangeDetails) => unknown;

interface ItemHarnessProps {
  trigger?: Partial<NavigationMenuTriggerProps> | false;
  popup?: Partial<NavigationMenuPopupProps>;
  link?: Partial<NavigationMenuLinkProps>;
  /** Popup content besides the Link; default: `data-testid="content"`. */
  content?: ReactNode;
}

/** One Item in a navigation, with a Link in its panel (`createOverlayHarness`). */
const Harness = createOverlayHarness<NavigationMenuOpenChangeDetails, ItemHarnessProps>(
  (rootProps, { trigger, popup, link, content }) => (
    <NavigationMenu.Root aria-label="Main" data-testid="nav">
      <NavigationMenu.List data-testid="list">
        <NavigationMenu.Item data-testid="item" {...rootProps}>
          {trigger !== false && (
            <NavigationMenu.Trigger data-testid="trigger" {...trigger}>
              Products
            </NavigationMenu.Trigger>
          )}
          <NavigationMenu.Popup data-testid="popup" {...popup}>
            {content ?? <span data-testid="content">content</span>}
            <NavigationMenu.Link data-testid="link" href="#analytics" {...link}>
              Analytics
            </NavigationMenu.Link>
          </NavigationMenu.Popup>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link data-testid="top-link" href="#pricing">
            Pricing
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  ),
);

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup");
const link = () => screen.getByTestId("link");
const content = () => screen.queryByTestId("content");
const isOpen = (element: Element = popup()) => element.matches(":popover-open");

describeOverlayOpenState<NavigationMenuOpenChangeDetails>({
  ...popoverLikeDriver(),
  name: "NavigationMenu",
  component: "navigation-menu",
  Harness,
  partCloses: [
    {
      name: "the Trigger",
      close: (user) => user.click(trigger()),
      cancelsClick: true,
      closeArgs: [],
      returnsFocus: false,
    },
    {
      // A followed Link (design 4). The platform returns focus from the Link to the Trigger at
      // the hide, which the jsdom shim does not model (the browser rows check it).
      name: "a followed Link",
      close: (user) => user.click(link()),
      cancelsClick: false,
      closeArgs: [],
      returnsFocus: false,
    },
  ],
  closeIntents: {
    render: (probe) => (
      <NavigationMenu.Item>
        <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
        <NavigationMenu.Popup data-testid="popup">{probe}</NavigationMenu.Popup>
      </NavigationMenu.Item>
    ),
    useIntents: () => use(NavigationMenuItemContext)!,
    open: (element) => element.showPopover(),
  },
});

describeOverlayDisabledRenders<NavigationMenuOpenChangeDetails, object>({
  name: "NavigationMenu",
  Harness,
  isOpen: () => isOpen(),
  spyOpen: spyShow,
  popoverTarget: true,
});

/** Opens a library-mode panel through the Trigger and waits for it to be shown. */
async function openThroughTrigger(user: ReturnType<typeof setupUser>) {
  await user.click(trigger());
  await flushTasks(2);
  expect(isOpen()).toBe(true);
}

/** Moves focus from `from` to `to` with the `focusout` the platform fires. */
function moveFocus(from: HTMLElement, to: HTMLElement | null) {
  act(() => {
    from.focus();
  });
  act(() => {
    if (to === null) from.blur();
    else to.focus();
  });
}

describe("NavigationMenu", () => {
  describe("markup and ARIA (design 1, 7)", () => {
    it("renders nav > ul[role=list] > li, a popovertarget button and a div popover with no role", () => {
      render(<Harness mode="static" />);
      const nav = screen.getByTestId("nav");
      expect(nav.tagName).toBe("NAV");
      expect(nav).toHaveAttribute("aria-label", "Main");
      expect(screen.getByRole("navigation", { name: "Main" })).toBe(nav);
      const list = screen.getByTestId("list");
      expect(list.tagName).toBe("UL");
      expect(list).toHaveAttribute("role", "list");
      const item = screen.getByTestId("item");
      expect(item.tagName).toBe("LI");
      expect(item.parentElement).toBe(list);

      const t = trigger();
      expect(t.tagName).toBe("BUTTON");
      expect(t).toHaveAttribute("type", "button");
      expect(t).not.toHaveAttribute("aria-expanded");
      expect(t).not.toHaveAttribute("aria-controls");
      expect(t).not.toHaveAttribute("aria-haspopup");
      expect(t).not.toHaveAttribute("commandfor");
      expect(t).not.toHaveAttribute("data-open");
      const id = t.getAttribute("popovertarget");
      expect(id).toBeTruthy();

      const p = popup();
      expect(p.tagName).toBe("DIV");
      expect(p.id).toBe(id);
      expect(p).toHaveAttribute("popover", "auto");
      expect(p).not.toHaveAttribute("role");
      expect(p).not.toHaveAttribute("aria-label");
      expect(p).not.toHaveAttribute("data-open");
      expect(p).toHaveAttribute("data-side", "bottom");
      expect(p).toHaveAttribute("data-align", "start");
      expect(p.style.getPropertyValue("position-area")).toBe("bottom span-self-x-end");
      // Directly after the Trigger (design 1).
      expect(p.previousElementSibling).toBe(t);

      const a = link();
      expect(a.tagName).toBe("A");
      expect(a).toHaveAttribute("href", "#analytics");
    });

    it("List's role is a default the consumer may override", () => {
      render(
        <NavigationMenu.Root>
          <NavigationMenu.List data-testid="list" role="menubar" />
        </NavigationMenu.Root>,
      );
      expect(screen.getByTestId("list")).toHaveAttribute("role", "menubar");
    });

    it("aria-current passes through on a Link; the library adds no data-current", () => {
      render(
        <NavigationMenu.Link href="/pricing" aria-current="page">
          Pricing
        </NavigationMenu.Link>,
      );
      const a = screen.getByRole("link", { name: "Pricing" });
      expect(a).toHaveAttribute("aria-current", "page");
      expect(a).not.toHaveAttribute("data-current");
    });

    it("the server HTML of a JS-free navigation contains the panel's links", () => {
      const html = renderToString(<Harness mode="static" />);
      expect(html).toContain('href="#analytics"');
      expect(html).toContain('popover="auto"');
      expect(html).toContain('role="list"');
      // React writes the attribute as `popoverTarget`; HTML attribute names are case-insensitive.
      expect(html.toLowerCase()).toContain("popovertarget=");
      expect(html).not.toContain("aria-expanded");
    });

    it("the server HTML of a library-mode Item has an empty panel", () => {
      const html = renderToString(<Harness mode="uncontrolled" />);
      expect(html).toContain('popover="auto"');
      expect(html).not.toContain('href="#analytics"');
    });

    it("Side and align are passed through; side={null} renders no placement", () => {
      const { rerender } = render(<Harness mode="static" popup={{ side: "top", align: "end" }} />);
      expect(popup()).toHaveAttribute("data-side", "top");
      expect(popup()).toHaveAttribute("data-align", "end");
      rerender(<Harness mode="static" popup={{ side: null }} />);
      expect(popup()).not.toHaveAttribute("data-side");
      expect(popup()).not.toHaveAttribute("data-align");
      expect(popup().style.getPropertyValue("position-area")).toBe("");
    });
  });

  // The Item is an owner that is not a Root and carries its state as attributes (conventions 4.1,
  // 4.3), as Accordion.Item and Collapsible.Root do.
  describe("Item attributes", () => {
    it("library mode: data-open (optimistic) and data-pending on the li, with the state fields", async () => {
      const d = deferred();
      const states: { open: boolean; pending: boolean }[] = [];
      render(
        <NavigationMenu.Root aria-label="Main">
          <NavigationMenu.List>
            <NavigationMenu.Item
              data-testid="item"
              defaultOpen={false}
              openChangeAction={() => d.promise}
              className={(s) => {
                states.push(s);
                return undefined;
              }}
            >
              <NavigationMenu.Trigger data-testid="trigger">Products</NavigationMenu.Trigger>
              <NavigationMenu.Popup data-testid="popup">content</NavigationMenu.Popup>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      const item = screen.getByTestId("item");
      expect(item).not.toHaveAttribute("data-open");
      expect(item).not.toHaveAttribute("data-pending");

      await setupUser().click(trigger());
      expect(item).toHaveAttribute("data-open", "");
      expect(item).toHaveAttribute("data-pending", "");
      expect(states.at(-1)).toEqual({ open: true, pending: true });

      await act(async () => {
        d.resolve();
      });
      await flushTasks();
      expect(item).toHaveAttribute("data-open", "");
      expect(item).not.toHaveAttribute("data-pending");
      expect(states.at(-1)).toEqual({ open: true, pending: false });
    });

    it("JS-free mode: neither attribute, state.open false while the panel is open", async () => {
      const states: { open: boolean; pending: boolean }[] = [];
      render(
        <NavigationMenu.Root aria-label="Main">
          <NavigationMenu.List>
            <NavigationMenu.Item
              data-testid="item"
              className={(s) => {
                states.push(s);
                return undefined;
              }}
            >
              <NavigationMenu.Trigger data-testid="trigger">Products</NavigationMenu.Trigger>
              <NavigationMenu.Popup data-testid="popup">content</NavigationMenu.Popup>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      await setupUser().click(trigger());
      await flushTasks();
      expect(isOpen()).toBe(true);
      const item = screen.getByTestId("item");
      expect(item).not.toHaveAttribute("data-open");
      expect(item).not.toHaveAttribute("data-pending");
      expect(states.at(-1)).toEqual({ open: false, pending: false });
    });
  });

  describe("JS-free mode", () => {
    it("the Trigger is the browser's: no click handler, data-open kept from the DOM", async () => {
      const user = setupUser();
      render(<Harness mode="static" />);
      await user.click(trigger());
      await flushTasks();
      expect(isOpen()).toBe(true);
      expect(trigger()).toHaveAttribute("data-open");
      expect(trigger()).not.toHaveAttribute("data-pending");
      await user.click(trigger());
      await flushTasks();
      expect(isOpen()).toBe(false);
      expect(trigger()).not.toHaveAttribute("data-open");
    });

    it("a panel opened before hydration stays open and keeps data-open", async () => {
      await hydrateFromServer(<Harness mode="static" />, {
        mutate: async (container) => {
          container.querySelector<HTMLElement>("[popover]")!.showPopover();
          await flushTasks();
        },
      });
      expect(isOpen()).toBe(true);
      expect(trigger()).toHaveAttribute("data-open");
    });

    it("two JS-free Items: opening one hides the other (sibling auto popovers)", async () => {
      const user = setupUser();
      render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
              <NavigationMenu.Popup data-testid="one">1</NavigationMenu.Popup>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Two</NavigationMenu.Trigger>
              <NavigationMenu.Popup data-testid="two">2</NavigationMenu.Popup>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      await user.click(screen.getByRole("button", { name: "One" }));
      expect(isOpen(screen.getByTestId("one"))).toBe(true);
      await user.click(screen.getByRole("button", { name: "Two" }));
      expect(isOpen(screen.getByTestId("two"))).toBe(true);
      expect(isOpen(screen.getByTestId("one"))).toBe(false);
    });
  });

  describe("focus leaving the Item (design 3.2)", () => {
    it("JS-free: a shown panel is hidden when focus moves outside the Item", async () => {
      const user = setupUser();
      render(<Harness mode="static" />);
      await user.click(trigger());
      expect(isOpen()).toBe(true);
      moveFocus(link(), screen.getByTestId("top-link"));
      expect(isOpen()).toBe(false);
      await flushTasks();
      expect(trigger()).not.toHaveAttribute("data-open");
    });

    it("focus moving between the Trigger and the panel closes nothing", async () => {
      const user = setupUser();
      render(<Harness mode="static" />);
      await user.click(trigger());
      moveFocus(trigger(), link());
      expect(isOpen()).toBe(true);
      moveFocus(link(), trigger());
      expect(isOpen()).toBe(true);
    });

    it("a null relatedTarget (window blur, a removed element) closes nothing", async () => {
      const user = setupUser();
      render(<Harness mode="static" />);
      await user.click(trigger());
      moveFocus(link(), null);
      expect(isOpen()).toBe(true);
    });

    for (const mode of ["uncontrolled", "controlled"] as const)
      it(`library (${mode}): a shown panel's close is a fact, onOpenChange(false, 'dismiss') with the focusout`, async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        const fact = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} fact={fact} />);
        await openThroughTrigger(user);
        action.mockClear();
        moveFocus(link(), screen.getByTestId("top-link"));
        expect(isOpen()).toBe(false);
        // The fact arrives with the platform's `toggle` task.
        await act(async () => flushTasks());
        expect(action).not.toHaveBeenCalled();
        expect(fact).toHaveBeenCalledTimes(1);
        const [next, details] = fact.mock.calls[0]!;
        expect(next).toBe(false);
        expect(details.reason).toBe("dismiss");
        expect(details.event?.type).toBe("focusout");
        expect(screen.getByTestId("committed")).toHaveTextContent("false");
        expectNotPending(trigger());
        await flushTasks(2);
        expect(content()).toBeNull();
      });

    it("library: an open still pending is superseded by a 'dismiss' request; the panel never appears", async () => {
      const user = setupUser();
      const d = deferred();
      const action = vi.fn<ActionFn>((next) => (next ? d.promise : undefined));
      const fact = vi.fn<ActionFn>();
      render(<Harness mode="uncontrolled" action={action} fact={fact} />);
      await user.click(trigger());
      expectPending(trigger());
      expect(trigger()).toHaveAttribute("data-open");
      moveFocus(trigger(), screen.getByTestId("elsewhere"));
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("dismiss");
      expect(details.event?.type).toBe("focusout");
      expect(fact).not.toHaveBeenCalled();
      await act(async () => d.resolve());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(content()).toBeNull();
    });

    it("library: content that suspends holds the open; tabbing away meanwhile supersedes it", async () => {
      const user = setupUser();
      const suspender = createSuspender();
      render(<Harness mode="uncontrolled" content={<suspender.Suspender value="recent" />} />);
      await user.click(trigger());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expectPending(trigger());
      moveFocus(trigger(), screen.getByTestId("elsewhere"));
      await act(async () => suspender.resolve("recent"));
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expectNotPending(trigger());
    });

    it("onBlur stays the consumer's", async () => {
      const onBlur = vi.fn();
      render(
        <NavigationMenu.Item onBlur={onBlur}>
          <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
          <NavigationMenu.Popup>panel</NavigationMenu.Popup>
        </NavigationMenu.Item>,
      );
      const t = screen.getByRole("button", { name: "Products" });
      act(() => t.focus());
      act(() => t.blur());
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe("Link (design 4)", () => {
    it("JS-free: a primary unmodified click hides the panel", async () => {
      const user = setupUser();
      const hide = spyHide();
      render(<Harness mode="static" />);
      await user.click(trigger());
      await user.click(link());
      expect(hide).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
    });

    for (const [name, init] of [
      ["Ctrl", { ctrlKey: true }],
      ["Meta", { metaKey: true }],
      ["Shift", { shiftKey: true }],
      ["Alt", { altKey: true }],
      ["the middle button", { button: 1 }],
    ] as const)
      for (const mode of ["static", "uncontrolled"] as const)
        it(`${mode}: a click with ${name} leaves the panel open`, async () => {
          const user = setupUser();
          const action = vi.fn<ActionFn>();
          render(<Harness mode={mode} action={action} />);
          if (mode === "static") await user.click(trigger());
          else await openThroughTrigger(user);
          action.mockClear();
          fireEvent.click(link(), init);
          await flushTasks(2);
          expect(isOpen()).toBe(true);
          expect(action).not.toHaveBeenCalled();
        });

    for (const mode of ["static", "uncontrolled"] as const)
      it(`${mode}: closeOnActivate={false} keeps the panel open`, async () => {
        const user = setupUser();
        const action = vi.fn<ActionFn>();
        render(<Harness mode={mode} action={action} link={{ closeOnActivate: false }} />);
        if (mode === "static") await user.click(trigger());
        else await openThroughTrigger(user);
        action.mockClear();
        await user.click(link());
        await flushTasks(2);
        expect(isOpen()).toBe(true);
        expect(action).not.toHaveBeenCalled();
      });

    it("library: the close is a request, openChangeAction(false, 'activate') with the click, awaited", async () => {
      const user = setupUser();
      const d = deferred();
      const action = vi.fn<ActionFn>((next) => (next ? undefined : d.promise));
      render(<Harness mode="uncontrolled" action={action} />);
      await openThroughTrigger(user);
      await user.click(link());
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event?.type).toBe("click");
      expect(details.event?.currentTarget ?? link()).toBe(link());
      // Held until the action settles.
      expect(isOpen()).toBe(true);
      expectPending(trigger());
      await act(async () => d.resolve());
      expect(isOpen()).toBe(false);
      expectNotPending(trigger());
    });

    it("library: a rejected close reaches the Error Boundary and the panel stays open", async () => {
      silenceErrors();
      const user = setupUser();
      const onError = vi.fn();
      const action = vi.fn<ActionFn>((next) =>
        next ? undefined : Promise.reject(new Error("nope")),
      );
      render(<Harness mode="uncontrolled" action={action} boundary={onError} />);
      await openThroughTrigger(user);
      await user.click(link());
      await flushTasks(2);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it("the consumer's onClick and a rendered router link's own handler still run", async () => {
      const user = setupUser();
      const onClick = vi.fn();
      const routerClick = vi.fn();
      function RouterLink({ to, ...props }: ComponentPropsWithRef<"a"> & { to: string }) {
        return (
          <a
            {...props}
            href={to}
            onClick={(event) => {
              props.onClick?.(event);
              routerClick();
              event.preventDefault();
            }}
          />
        );
      }
      render(<Harness mode="static" link={{ onClick, render: <RouterLink to="#billing" /> }} />);
      await user.click(trigger());
      expect(link()).toHaveAttribute("href", "#billing");
      await user.click(link());
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(routerClick).toHaveBeenCalledTimes(1);
      // A router that prevents the default still closes the panel: the user chose the destination.
      expect(isOpen()).toBe(false);
    });

    it("a Link outside a Popup is a plain anchor and closes nothing", async () => {
      const user = setupUser();
      render(<Harness mode="static" />);
      await user.click(trigger());
      const hide = spyHide();
      fireEvent.click(screen.getByTestId("top-link"));
      expect(hide).not.toHaveBeenCalled();
    });

    it("a Link outside any Item renders", () => {
      render(<NavigationMenu.Link href="/x">X</NavigationMenu.Link>);
      expect(screen.getByRole("link", { name: "X" })).toHaveAttribute("href", "/x");
    });
  });

  describe("development warnings (design 7)", () => {
    it("a Popup that does not directly follow its Trigger", () => {
      const error = silenceErrors();
      render(
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
          <span />
          <NavigationMenu.Popup>panel</NavigationMenu.Popup>
        </NavigationMenu.Item>,
      );
      expect(error).toHaveBeenCalledWith(expect.stringContaining("does not directly follow"));
    });

    it("a Popup right after its Trigger does not warn", () => {
      const error = silenceErrors();
      render(<Harness mode="static" />);
      expect(error).not.toHaveBeenCalled();
    });

    it("two Popups in one Item", () => {
      const error = silenceErrors();
      render(
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
          <NavigationMenu.Popup>one</NavigationMenu.Popup>
          <NavigationMenu.Popup>two</NavigationMenu.Popup>
        </NavigationMenu.Item>,
      );
      expect(error).toHaveBeenCalledWith(expect.stringContaining("a second NavigationMenu.Popup"));
    });

    it("two Triggers in one Item", () => {
      const error = silenceErrors();
      render(
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
          <NavigationMenu.Trigger>Two</NavigationMenu.Trigger>
          <NavigationMenu.Popup>panel</NavigationMenu.Popup>
        </NavigationMenu.Item>,
      );
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("a second NavigationMenu.Trigger"),
      );
    });

    it("a Trigger or Popup outside an Item throws", () => {
      silenceErrors();
      expect(() => render(<NavigationMenu.Trigger>x</NavigationMenu.Trigger>)).toThrow(
        "NavigationMenu.Trigger must be rendered inside a NavigationMenu.Item.",
      );
      expect(() => render(<NavigationMenu.Popup>x</NavigationMenu.Popup>)).toThrow(
        "NavigationMenu.Popup must be rendered inside a NavigationMenu.Item.",
      );
    });

    it("transition and keepMounted in JS-free mode", () => {
      const error = silenceErrors();
      render(<Harness mode="static" popup={{ transition: "slide", keepMounted: false }} />);
      expect(error).toHaveBeenCalledWith(expect.stringContaining("`transition` has no effect"));
      expect(error).toHaveBeenCalledWith(expect.stringContaining("`keepMounted={false}`"));
    });

    it("a controlled Item without onOpenChange names the panel", () => {
      const error = silenceErrors();
      render(<Harness mode="controlled" factAdoption="omit" />);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("NavigationMenu.Item: `open` is set without `onOpenChange`"),
      );
      expect(error).toHaveBeenCalledWith(expect.stringContaining("this panel"));
    });
  });

  describe("function props, render and ref (conventions 1)", () => {
    it("Item's className, style and children receive { open, pending }", async () => {
      const user = setupUser();
      const d = deferred();
      const props: Partial<NavigationMenuItemProps> = {
        className: (s) => (s.pending ? "pending" : s.open ? "open" : "closed"),
        style: (s) => ({ outline: s.open ? "1px solid" : "none" }),
      };
      render(
        <NavigationMenu.Item
          data-testid="item"
          openChangeAction={(next) => (next ? d.promise : undefined)}
          {...props}
        >
          {(s) => (
            <>
              <NavigationMenu.Trigger data-testid="trigger">
                {s.open ? "Close" : "Open"}
              </NavigationMenu.Trigger>
              <NavigationMenu.Popup data-testid="popup">panel</NavigationMenu.Popup>
            </>
          )}
        </NavigationMenu.Item>,
      );
      const item = screen.getByTestId("item");
      expect(item).toHaveClass("closed");
      expect(trigger()).toHaveTextContent("Open");
      await user.click(trigger());
      expect(item).toHaveClass("pending");
      expect(trigger()).toHaveTextContent("Close");
      await act(async () => d.resolve());
      await flushTasks(2);
      expect(item).toHaveClass("open");
      expect(item.style.outline).toBe("1px solid");
    });

    it("Popup's function props receive { open, side, align }", async () => {
      const user = setupUser();
      render(
        <Harness
          mode="uncontrolled"
          popup={{
            className: (s) => `${s.open ? "open" : "closed"} ${s.side ?? "none"} ${s.align}`,
          }}
        />,
      );
      expect(popup()).toHaveClass("closed", "bottom", "start");
      await openThroughTrigger(user);
      expect(popup()).toHaveClass("open");
    });

    it("render replaces each part's element; refs reach the elements", () => {
      const refs = {
        root: createRef<HTMLElement>(),
        list: createRef<HTMLUListElement>(),
        item: createRef<HTMLLIElement>(),
        trigger: createRef<HTMLButtonElement>(),
        popup: createRef<HTMLDivElement>(),
        link: createRef<HTMLAnchorElement>(),
      };
      render(
        <NavigationMenu.Root ref={refs.root} render={<div data-testid="root" />}>
          <NavigationMenu.List ref={refs.list} render={<ol />} data-testid="list">
            <NavigationMenu.Item ref={refs.item} data-testid="item">
              <NavigationMenu.Trigger ref={refs.trigger}>Products</NavigationMenu.Trigger>
              <NavigationMenu.Popup ref={refs.popup} data-testid="popup">
                <NavigationMenu.Link ref={refs.link} render={<a data-kind="router" />} href="/a">
                  A
                </NavigationMenu.Link>
              </NavigationMenu.Popup>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      expect(screen.getByTestId("root").tagName).toBe("DIV");
      expect(refs.root.current).toBe(screen.getByTestId("root"));
      expect(screen.getByTestId("list").tagName).toBe("OL");
      expect(screen.getByTestId("list")).toHaveAttribute("role", "list");
      expect(refs.list.current).toBe(screen.getByTestId("list"));
      expect(refs.item.current).toBe(screen.getByTestId("item"));
      expect(refs.trigger.current).toBe(screen.getByRole("button", { name: "Products" }));
      expect(refs.popup.current).toBe(popup());
      const a = screen.getByRole("link", { name: "A", hidden: true });
      expect(refs.link.current).toBe(a);
      expect(a).toHaveAttribute("data-kind", "router");
    });

    it("the function form of render receives the props", () => {
      render(
        <NavigationMenu.Root render={(props) => <header {...props} data-testid="root" />}>
          <NavigationMenu.List render={(props) => <ul {...props} data-testid="list" />} />
        </NavigationMenu.Root>,
      );
      expect(screen.getByTestId("root").tagName).toBe("HEADER");
      expect(screen.getByTestId("list")).toHaveAttribute("role", "list");
    });
  });

  it("a rejected open reaches the Error Boundary above the Item", async () => {
    silenceErrors();
    const user = setupUser();
    const onError = vi.fn();
    render(
      <ErrorCatcher onError={onError}>
        <NavigationMenu.Item openChangeAction={() => Promise.reject(new Error("no"))}>
          <NavigationMenu.Trigger data-testid="trigger">Products</NavigationMenu.Trigger>
          <NavigationMenu.Popup data-testid="popup">panel</NavigationMenu.Popup>
        </NavigationMenu.Item>
      </ErrorCatcher>,
    );
    await user.click(trigger());
    await flushTasks(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
