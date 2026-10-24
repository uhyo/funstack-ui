// Menu tests (jsdom), mapped to design/components/menu.md section 13.1. jsdom has no Popover API
// and no Invoker Commands; `src/__tests__/popover-shim.ts` and `invoker-shim.ts` provide them,
// including the hide of nested `auto` popovers when an ancestor hides (design 14).
//
// Not testable here, covered by `menu.browser.test.tsx`: Escape and light dismiss (driven with
// `hidePopover()` here), the platform's focusing steps (the `autofocus` write is asserted at the
// `showPopover()` call instead), anchoring, native `focusgroup`, exit animations and
// ViewTransition (smoke only).
//
// N/A rows: Overlap and Superseded rejection for `Menu.Item` (the re-entry guard means an Item
// never has two of its own runs in flight, #79, #81); the Item re-entry rows M1-M4
// (design/components/button.md 16.4) replace them. `CheckboxItem` / `RadioItem` are state owners
// and keep both rows.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { StrictMode, Suspense, startTransition, use, useState } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchCommand } from "../__tests__/invoker-shim.js";
import { stubComputedPlacement } from "../__tests__/placement-stub.js";
import { popoverSource } from "../__tests__/popover-shim.js";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
  PlainButton,
  flushTasks,
  hydrateFromServer,
  silenceErrors,
} from "../__tests__/helpers.js";
import { Menu } from "./index.js";
import type {
  MenuCheckboxItemState,
  MenuItemDetails,
  MenuItemState,
  MenuOpenChangeDetails,
  MenuPopupProps,
  MenuPopupState,
  MenuRadioGroupState,
  MenuRadioItemState,
  MenuRootProps,
  MenuRootState,
  MenuTriggerProps,
  MenuTriggerState,
} from "./index.js";
import { recordClicks, spyHide, spyShow, watchShow } from "../__tests__/overlay-helpers.js";
import { describeOverlayDisabledRenders } from "../__tests__/overlay-disabled-render-suite.js";
import {
  createOverlayHarness,
  describeOverlayOpenState,
  popoverLikeDriver,
} from "../__tests__/overlay-open-state-suite.js";
import { MenuContext } from "./menu-context.js";

type OpenAction = (next: boolean, details: MenuOpenChangeDetails) => unknown;

interface HarnessProps {
  /** Root props (`openChangeAction`, `loop`, ...). */
  root?: Partial<MenuRootProps>;
  popup?: Partial<MenuPopupProps>;
  /** Popup content; default: four plain items, the second disabled. */
  content?: ReactNode;
  /** Wrap the Root in an `ErrorCatcher` that reports to this callback. */
  boundary?: (error: unknown) => void;
}

function Harness({ root, popup, content, boundary }: HarnessProps) {
  let menu: ReactNode = (
    <Menu.Root {...root}>
      <Menu.Trigger data-testid="trigger">Actions</Menu.Trigger>
      <Menu.Popup data-testid="popup" {...popup}>
        {content ?? (
          <>
            <Menu.Item data-testid="rename">Rename</Menu.Item>
            <Menu.Item data-testid="archive" disabled>
              Archive
            </Menu.Item>
            <Menu.Item data-testid="duplicate">Duplicate</Menu.Item>
            <Menu.Item data-testid="delete">Delete</Menu.Item>
          </>
        )}
      </Menu.Popup>
    </Menu.Root>
  );
  if (boundary) menu = <ErrorCatcher onError={boundary}>{menu}</ErrorCatcher>;
  return (
    <>
      <button type="button" data-testid="elsewhere">
        Elsewhere
      </button>
      {menu}
    </>
  );
}

/** A menu with a submenu ("Move to" > Inbox / Later) between two items. */
function SubmenuContent({
  sub,
  subPopup,
  onItem,
}: {
  sub?: Partial<MenuRootProps>;
  subPopup?: Partial<MenuPopupProps>;
  onItem?: (details: MenuItemDetails) => unknown;
}) {
  return (
    <>
      <Menu.Item data-testid="rename">Rename</Menu.Item>
      <Menu.Root {...sub}>
        <Menu.SubmenuTrigger data-testid="move">Move to</Menu.SubmenuTrigger>
        <Menu.Popup data-testid="subpopup" {...subPopup}>
          <Menu.Item data-testid="inbox" action={onItem}>
            Inbox
          </Menu.Item>
          <Menu.Item data-testid="later">Later</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
      <Menu.Item data-testid="delete">Delete</Menu.Item>
    </>
  );
}

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup");
const item = (id: string) => screen.getByTestId(id);
const isOpen = (element: Element = popup()) => element.matches(":popover-open");

async function openMenu(user: ReturnType<typeof setupUser>) {
  await user.click(trigger());
  await flushTasks(2);
  expect(isOpen()).toBe(true);
}

afterEach(() => {
  vi.useRealTimers();
  // Restored here as well as in the setup file (which runs after this hook): the loop below
  // must reach the real `hidePopover`, not a test's spy.
  vi.restoreAllMocks();
  for (const element of document.querySelectorAll("[popover]")) {
    if (element.matches(":popover-open")) (element as HTMLElement).hidePopover();
  }
  document.body.innerHTML = "";
});

interface OpenStateHarnessProps {
  trigger?: Partial<MenuTriggerProps> | false;
  popup?: Partial<MenuPopupProps>;
  /** Popup content; default: two items, `content` and the action-less `close`. */
  content?: ReactNode;
}

/** The parity harness of the shared open-state suite (`createOverlayHarness`). */
const OpenStateHarness = createOverlayHarness<MenuOpenChangeDetails, OpenStateHarnessProps>(
  (rootProps, { trigger, popup, content }) => (
    <Menu.Root {...rootProps}>
      {trigger !== false && (
        <Menu.Trigger data-testid="trigger" {...trigger}>
          Actions
        </Menu.Trigger>
      )}
      <Menu.Popup data-testid="popup" {...popup}>
        {content ?? (
          <>
            <Menu.Item data-testid="content">Rename</Menu.Item>
            <Menu.Item data-testid="close">Close</Menu.Item>
          </>
        )}
      </Menu.Popup>
    </Menu.Root>
  ),
);

// Menu's open state is the same useOverlayRoot contract as Popover's. The part-initiated close is an
// item's activation; a Trigger click while open is a library-owned close as for Popover (the
// Trigger's press moves no focus out of the popup, design/components/menu.md 2.2, #110). A
// dismissal is a `hidePopover()` (Escape, light dismiss). Item actions, submenus and hover intent have their own
// rows below.
describeOverlayOpenState<MenuOpenChangeDetails>({
  ...popoverLikeDriver(),
  name: "Menu",
  Harness: OpenStateHarness,
  partClose: (user) => user.click(screen.getByTestId("close")),
  partCloseCancelsClick: false,
  partCloseArgs: [],
  partCloseReturnsFocus: true,
  closeIntents: {
    // Library mode (Menu has no JS-free mode): `defaultOpen`; the popup's content is mounted only
    // while open, so the probe is a child of the Root.
    render: (probe) => (
      <Menu.Root defaultOpen>
        {probe}
        <Menu.Popup data-testid="popup" aria-label="Probe" />
      </Menu.Root>
    ),
    useIntents: () => use(MenuContext)!.popover,
  },
});

// Menu has no Close part and no JS-free mode: the Trigger rows only.
describeOverlayDisabledRenders<MenuOpenChangeDetails, object>({
  name: "Menu",
  Harness: OpenStateHarness,
  isOpen: () => isOpen(),
  spyOpen: spyShow,
  popoverTarget: true,
});

describe("Menu", () => {
  describe("roles and ARIA", () => {
    it("renders the documented closed markup", () => {
      render(<Harness />);
      const t = trigger();
      const p = popup();
      expect(t.tagName).toBe("BUTTON");
      expect(t).toHaveAttribute("type", "button");
      expect(t).toHaveAttribute("aria-haspopup", "menu");
      // A `popovertarget` invoker: the browser exposes the menu's state (#121).
      expect(t).not.toHaveAttribute("aria-expanded");
      expect(t).toHaveAttribute("popovertarget", p.id);
      expect(t).not.toHaveAttribute("commandfor");
      expect(t).not.toHaveAttribute("command");
      expect(t.id).toBe(`${p.id}-trigger`);
      expect(p.tagName).toBe("DIV");
      expect(p).toHaveAttribute("popover", "auto");
      expect(p).toHaveAttribute("role", "menu");
      expect(p).toHaveAttribute("aria-labelledby", t.id);
      expect(p).toHaveAttribute("tabindex", "-1");
      expect(p).toHaveAttribute("data-side", "bottom");
      expect(p).toHaveAttribute("data-align", "start");
      expect(p.style.getPropertyValue("position-area")).toBe("bottom span-self-x-end");
      expect(p.style.getPropertyValue("position-try-fallbacks")).toBe(
        "flip-block, flip-inline, flip-block flip-inline",
      );
      expect(p).not.toHaveAttribute("focusgroup");
      // Items render on open (conventions 3.7).
      expect(p.children).toHaveLength(0);
    });

    it("renders items, checkable items, groups and separators with their roles", async () => {
      const user = setupUser();
      render(
        <Harness
          content={
            <>
              <Menu.Item data-testid="rename">Rename</Menu.Item>
              <Menu.Item data-testid="archive" disabled>
                Archive
              </Menu.Item>
              <Menu.Separator data-testid="sep" />
              <Menu.Group data-testid="group">
                <Menu.GroupLabel data-testid="label">View</Menu.GroupLabel>
                <Menu.CheckboxItem data-testid="done" defaultChecked>
                  Show completed
                </Menu.CheckboxItem>
                <Menu.RadioGroup data-testid="radios" defaultValue="name">
                  <Menu.GroupLabel data-testid="radio-label">Sort</Menu.GroupLabel>
                  <Menu.RadioItem data-testid="by-name" value="name">
                    By name
                  </Menu.RadioItem>
                  <Menu.RadioItem data-testid="by-date" value="date">
                    By date
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Group>
            </>
          }
        />,
      );
      await openMenu(user);
      const rename = item("rename");
      expect(rename).toHaveAttribute("role", "menuitem");
      expect(rename).toHaveAttribute("type", "button");
      expect(rename).toHaveAttribute("tabindex", "-1");
      expect(rename).not.toHaveAttribute("aria-disabled");
      const archive = item("archive");
      expect(archive).toHaveAttribute("aria-disabled", "true");
      expect(archive).toHaveAttribute("data-disabled", "");
      expect(archive).not.toHaveAttribute("disabled");
      expect(item("sep").tagName).toBe("HR");
      expect(item("group")).toHaveAttribute("role", "group");
      expect(item("group")).toHaveAttribute("aria-labelledby", item("label").id);
      expect(item("label").id).not.toBe("");
      expect(item("done")).toHaveAttribute("role", "menuitemcheckbox");
      expect(item("done")).toHaveAttribute("aria-checked", "true");
      expect(item("done")).toHaveAttribute("data-checked", "");
      expect(item("radios")).toHaveAttribute("role", "group");
      expect(item("radios")).toHaveAttribute("aria-labelledby", item("radio-label").id);
      expect(item("by-name")).toHaveAttribute("role", "menuitemradio");
      expect(item("by-name")).toHaveAttribute("aria-checked", "true");
      expect(item("by-date")).toHaveAttribute("aria-checked", "false");
      expect(item("by-date")).not.toHaveAttribute("data-checked");
      expect(item("by-date")).not.toHaveAttribute("value");
      expect(trigger()).not.toHaveAttribute("aria-expanded");
      expect(trigger()).toHaveAttribute("popovertarget", popup().id);
      expect(trigger()).toHaveAttribute("data-open", "");
    });

    it("experimental_focusgroup renders focusgroup; items keep tabindex=-1 without focusGroup", async () => {
      const user = setupUser();
      const { unmount } = render(<Harness popup={{ experimental_focusgroup: true }} />);
      await openMenu(user);
      expect(popup()).toHaveAttribute("focusgroup", "menu wrap");
      expect(item("rename")).toHaveAttribute("tabindex", "-1");
      unmount();
      render(<Harness root={{ loop: false }} popup={{ experimental_focusgroup: true }} />);
      expect(popup()).toHaveAttribute("focusgroup", "menu nowrap");
    });

    it("SubmenuTrigger is an item and a trigger", async () => {
      const user = setupUser();
      render(<Harness content={<SubmenuContent />} />);
      await openMenu(user);
      const move = item("move");
      const sub = screen.getByTestId("subpopup");
      expect(move).toHaveAttribute("role", "menuitem");
      expect(move).toHaveAttribute("tabindex", "-1");
      expect(move).toHaveAttribute("aria-haspopup", "menu");
      // A `popovertarget` invoker, `menuitem` included: no `aria-expanded` (#121).
      expect(move).not.toHaveAttribute("aria-expanded");
      expect(move).toHaveAttribute("popovertarget", sub.id);
      expect(move).not.toHaveAttribute("commandfor");
      expect(move).not.toHaveAttribute("command");
      expect(move.id).toBe(`${sub.id}-trigger`);
      expect(sub).toHaveAttribute("aria-labelledby", move.id);
      // Wave 11 (#53): the inline-end side, the right in LTR and the left in RTL.
      expect(sub).toHaveAttribute("data-side", "inline-end");
      expect(sub).toHaveAttribute("data-align", "start");
      expect(sub.style.getPropertyValue("position-area")).toBe("self-x-end span-bottom");
      expect(sub.style.getPropertyValue("position-try-fallbacks")).toBe("flip-inline");
    });

    it("a disabled SubmenuTrigger is aria-disabled, never natively disabled, and does not open", async () => {
      const user = setupUser();
      render(
        <Harness
          content={
            <Menu.Root>
              <Menu.SubmenuTrigger data-testid="move" disabled>
                Move to
              </Menu.SubmenuTrigger>
              <Menu.Popup data-testid="subpopup">
                <Menu.Item>Inbox</Menu.Item>
              </Menu.Popup>
            </Menu.Root>
          }
        />,
      );
      await openMenu(user);
      expect(item("move")).toHaveAttribute("aria-disabled", "true");
      expect(item("move")).toHaveAttribute("data-disabled", "");
      expect(item("move")).not.toHaveAttribute("disabled");
      await user.click(item("move"));
      await flushTasks(2);
      expect(isOpen(screen.getByTestId("subpopup"))).toBe(false);
    });
  });

  describe("keyboard: opening", () => {
    it("ArrowDown on the Trigger opens with the first enabled item autofocused at showPopover", async () => {
      const user = setupUser();
      const { calls } = watchShow();
      render(
        <Harness
          content={
            <>
              <Menu.Item data-testid="a" disabled>
                A
              </Menu.Item>
              <Menu.Item data-testid="b">B</Menu.Item>
              <Menu.Item data-testid="c">C</Menu.Item>
            </>
          }
        />,
      );
      trigger().focus();
      await user.keyboard("{ArrowDown}");
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.autofocus).toBe(item("b"));
      expect(calls[0]!.source).toBe(trigger());
      // The attribute is removed again right after the call.
      expect(item("b")).not.toHaveAttribute("autofocus");
    });

    it("ArrowUp opens with the last enabled item", async () => {
      const user = setupUser();
      const { calls } = watchShow();
      render(<Harness />);
      trigger().focus();
      await user.keyboard("{ArrowUp}");
      await flushTasks(2);
      expect(calls[0]!.autofocus).toBe(item("delete"));
    });

    it.each(["{Enter}", " "])("%s on the Trigger opens with the first item", async (key) => {
      const user = setupUser();
      const { calls } = watchShow();
      render(<Harness />);
      trigger().focus();
      await user.keyboard(key);
      await flushTasks(2);
      expect(calls[0]!.autofocus).toBe(item("rename"));
    });

    it("a click opens with the first item; a second click closes ('activate')", async () => {
      const user = setupUser();
      const action = vi.fn<OpenAction>();
      const { calls } = watchShow();
      render(<Harness root={{ openChangeAction: action }} />);
      await openMenu(user);
      expect(calls[0]!.autofocus).toBe(item("rename"));
      await user.click(trigger());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([
        [true, "activate"],
        [false, "activate"],
      ]);
    });

    it("a menu with no items autofocuses the popup itself", async () => {
      const user = setupUser();
      const { calls } = watchShow();
      render(<Harness content={<span>Nothing here</span>} />);
      await openMenu(user);
      expect(calls[0]!.autofocus).toBe(popup());
    });

    it("server HTML: a disabled Trigger with a component render is an enabled button with no popovertarget", () => {
      const container = document.createElement("div");
      container.innerHTML = renderToString(
        <Menu.Root>
          <Menu.Trigger disabled render={<PlainButton />}>
            Actions
          </Menu.Trigger>
          <Menu.Popup>
            <Menu.Item>A</Menu.Item>
          </Menu.Popup>
        </Menu.Root>,
      );
      const button = container.querySelector("button")!;
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).not.toHaveAttribute("popovertarget");
      expect(button).not.toHaveAttribute("commandfor");
      expect(button).not.toHaveAttribute("command");
      // No invoker: the Trigger exposes the (closed) state itself (#121).
      expect(button).toHaveAttribute("aria-expanded", "false");
      // Enabled again: the invoker attribute is back.
      container.innerHTML = renderToString(
        <Menu.Root>
          <Menu.Trigger render={<PlainButton />}>Actions</Menu.Trigger>
          <Menu.Popup>
            <Menu.Item>A</Menu.Item>
          </Menu.Popup>
        </Menu.Root>,
      );
      const enabled = container.querySelector("button")!;
      expect(enabled).toHaveAttribute("popovertarget", container.querySelector("[popover]")!.id);
      expect(enabled).not.toHaveAttribute("aria-expanded");
    });

    it("a disabled Trigger with a host <button> render stays natively disabled", () => {
      render(
        <Menu.Root>
          <Menu.Trigger data-testid="trigger" disabled render={<button type="button" />}>
            Actions
          </Menu.Trigger>
          <Menu.Popup data-testid="popup">
            <Menu.Item>A</Menu.Item>
          </Menu.Popup>
        </Menu.Root>,
      );
      expect(trigger()).toBeDisabled();
      expect(trigger()).not.toHaveAttribute("aria-disabled");
    });
  });

  describe("keyboard: in the menu", () => {
    async function openAndFocus(user: ReturnType<typeof setupUser>, id = "rename") {
      await openMenu(user);
      item(id).focus();
    }

    it("ArrowDown / ArrowUp move focus, disabled items included, and wrap", async () => {
      const user = setupUser();
      render(<Harness />);
      await openAndFocus(user);
      await user.keyboard("{ArrowDown}");
      expect(item("archive")).toHaveFocus();
      await user.keyboard("{ArrowDown}{ArrowDown}");
      expect(item("delete")).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(item("rename")).toHaveFocus();
      await user.keyboard("{ArrowUp}");
      expect(item("delete")).toHaveFocus();
    });

    it("Home / End go to the first / last item", async () => {
      const user = setupUser();
      render(<Harness />);
      await openAndFocus(user, "duplicate");
      await user.keyboard("{Home}");
      expect(item("rename")).toHaveFocus();
      await user.keyboard("{End}");
      expect(item("delete")).toHaveFocus();
    });

    it("loop={false} stops at the ends", async () => {
      const user = setupUser();
      render(<Harness root={{ loop: false }} />);
      await openAndFocus(user, "delete");
      await user.keyboard("{ArrowDown}");
      expect(item("delete")).toHaveFocus();
      await user.keyboard("{Home}{ArrowUp}");
      expect(item("rename")).toHaveFocus();
    });

    it("handled keys are prevented; modified keys are ignored", async () => {
      const user = setupUser();
      render(<Harness />);
      await openAndFocus(user);
      expect(fireEvent.keyDown(item("rename"), { key: "ArrowDown" })).toBe(false);
      expect(item("archive")).toHaveFocus();
      expect(fireEvent.keyDown(item("archive"), { key: "ArrowDown", ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(item("archive"), { key: "ArrowDown", altKey: true })).toBe(true);
      expect(fireEvent.keyDown(item("archive"), { key: "ArrowDown", metaKey: true })).toBe(true);
      expect(item("archive")).toHaveFocus();
    });

    it("a press on non-item space keeps focus on the current item", async () => {
      const user = setupUser();
      render(
        <Harness
          content={
            <>
              <Menu.Group data-testid="group">
                <Menu.GroupLabel data-testid="label">File</Menu.GroupLabel>
                <Menu.Item data-testid="rename">Rename</Menu.Item>
              </Menu.Group>
              <Menu.Separator data-testid="sep" />
              <Menu.Item data-testid="delete">Delete</Menu.Item>
            </>
          }
        />,
      );
      await openMenu(user);
      expect(item("rename")).toHaveFocus();
      for (const id of ["sep", "label", "popup"]) {
        expect(fireEvent.mouseDown(item(id))).toBe(false);
      }
      await user.click(item("sep"));
      await user.click(item("label"));
      await user.pointer({ keys: "[MouseLeft]", target: popup() });
      expect(item("rename")).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(item("delete")).toHaveFocus();
      // A press on an item is not prevented (the item takes focus as usual).
      expect(fireEvent.mouseDown(item("rename"))).toBe(true);
    });

    it("a consumer's control in the popup still takes focus", async () => {
      const user = setupUser();
      render(
        <Harness
          content={
            <>
              <input data-testid="field" aria-label="Filter" />
              <Menu.Item data-testid="rename">Rename</Menu.Item>
            </>
          }
        />,
      );
      await openMenu(user);
      expect(fireEvent.mouseDown(item("field"))).toBe(true);
      await user.click(item("field"));
      expect(item("field")).toHaveFocus();
    });

    it("with focus on the popup itself, ArrowDown / Home go to the first item, ArrowUp / End to the last", async () => {
      const user = setupUser();
      render(<Harness root={{ loop: false }} />);
      await openMenu(user);
      for (const [key, id] of [
        ["{ArrowDown}", "rename"],
        ["{Home}", "rename"],
        ["{ArrowUp}", "delete"],
        ["{End}", "delete"],
      ] as const) {
        popup().focus();
        expect(popup()).toHaveFocus();
        await user.keyboard(key);
        expect(item(id)).toHaveFocus();
      }
      popup().focus();
      expect(fireEvent.keyDown(popup(), { key: "ArrowDown" })).toBe(false);
    });

    it("ArrowRight / ArrowLeft on plain items of the top-level menu do nothing", async () => {
      const user = setupUser();
      render(<Harness />);
      await openAndFocus(user);
      expect(fireEvent.keyDown(item("rename"), { key: "ArrowRight" })).toBe(true);
      expect(fireEvent.keyDown(item("rename"), { key: "ArrowLeft" })).toBe(true);
      expect(isOpen()).toBe(true);
      expect(item("rename")).toHaveFocus();
    });
  });

  describe("typeahead", () => {
    let now = 1_000_000;
    beforeEach(() => {
      now = 1_000_000;
      vi.spyOn(Date, "now").mockImplementation(() => now);
    });
    const type = (key: string) => {
      fireEvent.keyDown(document.activeElement!, { key });
    };

    function Fruits() {
      return (
        <>
          <Menu.Item data-testid="apple">Apple</Menu.Item>
          <Menu.Item data-testid="banana">Banana</Menu.Item>
          <Menu.Item data-testid="apricot">Apricot</Menu.Item>
          <Menu.Item data-testid="avocado" disabled>
            Avocado
          </Menu.Item>
          <Menu.Item data-testid="icon" label="Cherry">
            🍒
          </Menu.Item>
          <Menu.Root>
            <Menu.SubmenuTrigger data-testid="more">More</Menu.SubmenuTrigger>
            <Menu.Popup>
              <Menu.Item data-testid="zucchini">Zucchini</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        </>
      );
    }

    it("a character moves to the next item starting with it, from the focused one, wrapping", async () => {
      const user = setupUser();
      render(<Harness content={<Fruits />} />);
      await openMenu(user);
      item("banana").focus();
      type("a");
      expect(item("apricot")).toHaveFocus();
      now += 600;
      type("a");
      // Disabled items are focusable and searched.
      expect(item("avocado")).toHaveFocus();
      now += 600;
      type("A");
      expect(item("apple")).toHaveFocus();
    });

    it("repeating the same character cycles; a longer buffer matches a prefix", async () => {
      const user = setupUser();
      render(<Harness content={<Fruits />} />);
      await openMenu(user);
      item("banana").focus();
      type("a");
      now += 100;
      type("a");
      expect(item("avocado")).toHaveFocus();
      now += 600;
      item("banana").focus();
      type("a");
      now += 100;
      type("p");
      now += 100;
      type("r");
      expect(item("apricot")).toHaveFocus();
      now += 100;
      type("x");
      // No match: focus stays.
      expect(item("apricot")).toHaveFocus();
    });

    it("the buffer resets 500 ms after the last keystroke", async () => {
      const user = setupUser();
      render(<Harness content={<Fruits />} />);
      await openMenu(user);
      item("apple").focus();
      type("b");
      expect(item("banana")).toHaveFocus();
      now += 501;
      type("a");
      expect(item("apricot")).toHaveFocus();
    });

    it("label overrides the text; submenu items are not matched from the parent", async () => {
      const user = setupUser();
      render(<Harness content={<Fruits />} />);
      await openMenu(user);
      item("apple").focus();
      type("c");
      expect(item("icon")).toHaveFocus();
      expect(item("icon")).toHaveAttribute("data-typeahead", "Cherry");
      now += 600;
      type("z");
      expect(item("icon")).toHaveFocus();
      now += 600;
      type("m");
      expect(item("more")).toHaveFocus();
    });

    it("Space activates normally but is a character while a buffer is active", async () => {
      const action = vi.fn();
      const user = setupUser();
      render(
        <Harness
          content={
            <>
              <Menu.Item data-testid="new-tab" action={action} closeOnActivate={false}>
                New tab
              </Menu.Item>
              <Menu.Item data-testid="new-window">New window</Menu.Item>
            </>
          }
        />,
      );
      await openMenu(user);
      item("new-tab").focus();
      type("n");
      now += 50;
      type("e");
      now += 50;
      type("w");
      now += 50;
      type(" ");
      now += 50;
      type("w");
      expect(item("new-window")).toHaveFocus();
      expect(action).not.toHaveBeenCalled();
      now += 600;
      item("new-tab").focus();
      await act(async () => {
        fireEvent.keyDown(item("new-tab"), { key: " " });
      });
      expect(action).toHaveBeenCalledTimes(1);
    });
  });
});
describe("Menu.Item actions", () => {
  it("click: action receives (details) with the click; the menu closes ('activate')", async () => {
    const user = setupUser();
    const action = vi.fn<(details: MenuItemDetails) => void>();
    const openChange = vi.fn<OpenAction>();
    const hide = spyHide();
    render(
      <Harness
        root={{ openChangeAction: openChange }}
        content={
          <Menu.Item data-testid="rename" action={action}>
            Rename
          </Menu.Item>
        }
      />,
    );
    await openMenu(user);
    await user.click(item("rename"));
    await flushTasks(2);
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]).toHaveLength(1);
    const details = action.mock.calls[0]![0];
    expect(details.event!.type).toBe("click");
    // `event` is virtual: a Server Function never receives it.
    expect(Object.keys(details)).toEqual([]);
    expect(openChange.mock.calls.at(-1)![0]).toBe(false);
    expect(openChange.mock.calls.at(-1)![1].reason).toBe("activate");
    expect(hide).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);
  });

  it("Enter and Space activate once each, through a click on the item (keydown prevented)", async () => {
    const user = setupUser();
    const action = vi.fn<(details: MenuItemDetails) => void>();
    render(
      <Harness
        content={
          <Menu.Item data-testid="rename" action={action} closeOnActivate={false}>
            Rename
          </Menu.Item>
        }
      />,
    );
    await openMenu(user);
    item("rename").focus();
    const clicks = vi.fn();
    item("rename").addEventListener("click", clicks);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[0]![0].event!.type).toBe("click");
    expect(clicks).toHaveBeenCalledTimes(2);
    expect(fireEvent.keyDown(item("rename"), { key: "Enter" })).toBe(false);
  });

  it("an action-less item only closes", async () => {
    const user = setupUser();
    render(<Harness />);
    await openMenu(user);
    await user.click(item("rename"));
    await flushTasks(2);
    expect(isOpen()).toBe(false);
  });

  it("a disabled item never activates", async () => {
    const user = setupUser();
    const action = vi.fn();
    render(
      <Harness
        content={
          <Menu.Item data-testid="rename" action={action} disabled>
            Rename
          </Menu.Item>
        }
      />,
    );
    await openMenu(user);
    await user.click(item("rename"));
    item("rename").focus();
    await user.keyboard("{Enter} ");
    await flushTasks(2);
    expect(action).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
  });

  it("closeOnActivate={false} keeps the menu open", async () => {
    const user = setupUser();
    const action = vi.fn();
    const hide = spyHide();
    render(
      <Harness
        content={
          <Menu.Item data-testid="refresh" action={action} closeOnActivate={false}>
            Refresh
          </Menu.Item>
        }
      />,
    );
    await openMenu(user);
    await user.click(item("refresh"));
    await flushTasks(2);
    expect(action).toHaveBeenCalledTimes(1);
    expect(hide).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
  });

  renderBoth("async item action", (mode) => {
    function Archive({ action }: { action: () => unknown }) {
      const [open, setOpen] = useState(false);
      const root: Partial<MenuRootProps> =
        mode === "controlled"
          ? {
              open,
              openChangeAction: async (next) => {
                startTransition(() => setOpen(next));
              },
            }
          : {};
      return (
        <Harness
          root={root}
          content={
            <>
              <Menu.Item data-testid="archive" action={action}>
                {({ pending }: MenuItemState) => (pending ? "Archiving…" : "Archive")}
              </Menu.Item>
              <Menu.Item data-testid="other">Other</Menu.Item>
            </>
          }
        />
      );
    }

    it("data-pending on the item while it runs; the menu stays open; closes on resolve", async () => {
      const user = setupUser();
      const work = deferred();
      const hide = spyHide();
      render(<Archive action={() => work.promise} />);
      await openMenu(user);
      await user.click(item("archive"));
      expectPending(item("archive"));
      expect(item("archive")).toHaveTextContent("Archiving…");
      expectNotPending(item("other"));
      expectNotPending(trigger());
      expect(isOpen()).toBe(true);
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(hide).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
    });

    it("a rejection reaches the boundary inside the popup; the menu stays open", async () => {
      const user = setupUser();
      silenceErrors();
      const caught = vi.fn();
      const hide = spyHide();
      render(
        <Harness
          content={
            <ErrorCatcher onError={caught}>
              <Menu.Item
                data-testid="archive"
                action={async () => {
                  throw new Error("archive failed");
                }}
              >
                Archive
              </Menu.Item>
            </ErrorCatcher>
          }
        />,
      );
      await openMenu(user);
      await user.click(item("archive"));
      await flushTasks(2);
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "archive failed" }));
      expect(hide).not.toHaveBeenCalled();
      expect(isOpen()).toBe(true);
    });
  });

  describe("re-entry (#81, design/components/button.md 16.4)", () => {
    it("a second Enter, Space and click while pending are ignored and cancelled; one close", async () => {
      const user = setupUser();
      const work = deferred();
      const action = vi.fn(() => work.promise);
      const openChange = vi.fn<OpenAction>();
      const hide = spyHide();
      render(
        <Harness
          root={{ openChangeAction: openChange }}
          content={
            <Menu.Item data-testid="archive" action={action}>
              Archive
            </Menu.Item>
          }
        />,
      );
      await openMenu(user);
      const archive = item("archive");
      expect(archive).not.toHaveAttribute("aria-disabled");
      const clicks = recordClicks();
      try {
        await user.click(archive);
        archive.focus();
        await user.keyboard("{Enter}");
        await user.keyboard(" ");
        await user.click(archive);
      } finally {
        clicks.stop();
      }
      expect(action).toHaveBeenCalledTimes(1);
      // The first click was not cancelled; Enter and Space reach the item through its click.
      expect(clicks.seen).toEqual([false, true, true, true]);
      expect(archive).toHaveAttribute("aria-disabled", "true");
      expectPending(archive);
      expect(archive).not.toHaveAttribute("data-disabled");
      expect(archive).toHaveFocus();
      expect(isOpen()).toBe(true);
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(openChange.mock.calls.filter(([next]) => !next)).toHaveLength(1);
      expect(hide).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
      expect(archive).not.toHaveAttribute("aria-disabled");
    });

    it("two activations in one task call the action once", async () => {
      const user = setupUser();
      const work = deferred();
      const action = vi.fn(() => work.promise);
      render(
        <Harness
          content={
            <Menu.Item data-testid="archive" action={action}>
              Archive
            </Menu.Item>
          }
        />,
      );
      await openMenu(user);
      let second = true;
      act(() => {
        fireEvent.click(item("archive"));
        second = fireEvent.click(item("archive"));
      });
      expect(action).toHaveBeenCalledTimes(1);
      expect(second).toBe(false); // cancelled
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
    });

    it("closeOnActivate={false}, the second activation is ignored; after settle the next one runs", async () => {
      const user = setupUser();
      const runs = [deferred(), deferred()];
      let call = 0;
      const action = vi.fn(() => runs[call++]!.promise);
      render(
        <Harness
          content={
            <Menu.Item data-testid="refresh" action={action} closeOnActivate={false}>
              Refresh
            </Menu.Item>
          }
        />,
      );
      await openMenu(user);
      const refresh = item("refresh");
      refresh.focus();
      await user.keyboard("{Enter}");
      await user.keyboard("{Enter}");
      expect(action).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveAttribute("aria-disabled", "true");
      expectPending(refresh);
      await act(async () => runs[0]!.resolve());
      await flushTasks(2);
      expect(refresh).not.toHaveAttribute("aria-disabled");
      expectNotPending(refresh);
      expect(isOpen()).toBe(true);
      await user.keyboard("{Enter}");
      expect(action).toHaveBeenCalledTimes(2);
      await act(async () => runs[1]!.resolve());
    });

    it("a pending item is still an enabled item for the arrows, Home / End and typeahead", async () => {
      const user = setupUser();
      const work = deferred();
      render(
        <Harness
          content={
            <>
              <Menu.Item data-testid="refresh" action={() => work.promise} closeOnActivate={false}>
                Refresh
              </Menu.Item>
              <Menu.Item data-testid="rename">Rename</Menu.Item>
              <Menu.Item data-testid="delete">Delete</Menu.Item>
            </>
          }
        />,
      );
      await openMenu(user);
      await user.click(item("refresh"));
      expect(item("refresh")).toHaveAttribute("aria-disabled", "true");
      item("refresh").focus();
      await user.keyboard("{ArrowDown}");
      expect(item("rename")).toHaveFocus();
      await user.keyboard("{ArrowUp}");
      expect(item("refresh")).toHaveFocus();
      await user.keyboard("{End}");
      expect(item("delete")).toHaveFocus();
      await user.keyboard("{Home}");
      expect(item("refresh")).toHaveFocus();
      item("delete").focus();
      await user.keyboard("r");
      expect(item("refresh")).toHaveFocus();
      expectPending(item("refresh"));
      await act(async () => work.resolve());
    });

    it("a rejection reaches the boundary above the item; the menu stays open; after a reset it runs again", async () => {
      const user = setupUser();
      silenceErrors();
      const caught = vi.fn();
      const runs = [deferred(), deferred()];
      let call = 0;
      function Resettable() {
        const [key, setKey] = useState(0);
        return (
          <>
            <Menu.Item
              data-testid="reset"
              closeOnActivate={false}
              action={() => setKey((k) => k + 1)}
            >
              Reset
            </Menu.Item>
            <ErrorCatcher key={key} onError={caught}>
              <Menu.Item
                data-testid="archive"
                closeOnActivate={false}
                action={() => runs[call++]!.promise}
              >
                Archive
              </Menu.Item>
            </ErrorCatcher>
          </>
        );
      }
      render(<Harness content={<Resettable />} />);
      await openMenu(user);
      await user.click(item("archive"));
      await act(async () => runs[0]!.reject(new Error("first failed")));
      await flushTasks(2);
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "first failed" }));
      expect(screen.getByTestId("error-catcher")).toBeInTheDocument();
      expect(isOpen()).toBe(true);
      await user.click(item("reset"));
      await user.click(item("archive"));
      expect(call).toBe(2);
      await act(async () => runs[1]!.resolve());
    });
  });

  it("render={<a href />}: Enter clicks the link (activation through onClick)", async () => {
    const user = setupUser();
    const action = vi.fn<(details: MenuItemDetails) => void>();
    render(
      <Harness
        content={
          <Menu.Item data-testid="link" render={<a href="#new" />} action={action}>
            New
          </Menu.Item>
        }
      />,
    );
    await openMenu(user);
    const link = item("link");
    expect(link.tagName).toBe("A");
    expect(link).not.toHaveAttribute("type");
    expect(link).toHaveAttribute("role", "menuitem");
    link.focus();
    await user.keyboard("{Enter}");
    await flushTasks(2);
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]![0].event!.type).toBe("click");
    expect(isOpen()).toBe(false);
  });

  it("an action that settles after the menu was dismissed and re-opened does not close it", async () => {
    const user = setupUser();
    const work = deferred();
    render(
      <Harness
        popup={{ keepMounted: true }}
        content={
          <>
            <Menu.Item data-testid="archive" action={() => work.promise}>
              Archive
            </Menu.Item>
            <Menu.CheckboxItem data-testid="box" closeOnActivate>
              Compact
            </Menu.CheckboxItem>
          </>
        }
      />,
    );
    await openMenu(user);
    await user.click(item("archive"));
    // Escape (the platform's hide), then a new open while the action still runs.
    await act(async () => popup().hidePopover());
    await flushTasks(2);
    // React holds the re-open's commit until the item's async action settles (entangled
    // transitions); the item's close, which belongs to the first opening, is then dropped.
    await user.click(trigger());
    await act(async () => work.resolve());
    await flushTasks(2);
    expect(isOpen()).toBe(true);
  });

  it("pointermove focuses the item (no-op when already focused)", async () => {
    const user = setupUser();
    render(<Harness />);
    await openMenu(user);
    expect(item("rename")).toHaveFocus();
    fireEvent.pointerMove(item("duplicate"), { pointerType: "mouse" });
    expect(item("duplicate")).toHaveFocus();
    const focus = vi.spyOn(item("duplicate"), "focus");
    fireEvent.pointerMove(item("duplicate"), { pointerType: "mouse" });
    expect(focus).not.toHaveBeenCalled();
    fireEvent.pointerMove(item("archive"), { pointerType: "mouse" });
    expect(item("archive")).toHaveFocus();
  });
});

describe("Menu.CheckboxItem", () => {
  renderBoth("toggle", (mode) => {
    function Box({
      action,
      closeOnActivate,
    }: {
      action?: (next: boolean) => unknown;
      closeOnActivate?: boolean;
    }) {
      const [checked, setChecked] = useState(false);
      const props =
        mode === "controlled"
          ? {
              checked,
              checkedChangeAction: async (next: boolean) => {
                await action?.(next);
                startTransition(() => setChecked(next));
              },
            }
          : { defaultChecked: false, checkedChangeAction: action };
      return (
        <Harness
          content={
            <Menu.CheckboxItem data-testid="box" closeOnActivate={closeOnActivate} {...props}>
              {({ checked: c, pending }: MenuCheckboxItemState) =>
                `Compact ${c ? "on" : "off"}${pending ? "…" : ""}`
              }
            </Menu.CheckboxItem>
          }
        />
      );
    }

    it("flips aria-checked at once, data-pending while pending, commits; stays open", async () => {
      const user = setupUser();
      const work = deferred();
      const action = vi.fn((_next: boolean) => work.promise);
      const hide = spyHide();
      render(<Box action={action} />);
      await openMenu(user);
      await user.click(item("box"));
      expect(item("box")).toHaveAttribute("aria-checked", "true");
      expect(item("box")).toHaveAttribute("data-checked", "");
      expectPending(item("box"));
      expect(item("box")).toHaveTextContent("Compact on…");
      expect(action.mock.calls[0]![0]).toBe(true);
      await act(async () => work.resolve());
      await flushTasks(2);
      expectNotPending(item("box"));
      expect(item("box")).toHaveAttribute("aria-checked", "true");
      expect(hide).not.toHaveBeenCalled();
      expect(isOpen()).toBe(true);
      // Space toggles back.
      item("box").focus();
      await user.keyboard(" ");
      await flushTasks(2);
      expect(item("box")).toHaveAttribute("aria-checked", "false");
    });

    it("closeOnActivate closes the menu after the change settles", async () => {
      const user = setupUser();
      const work = deferred();
      render(<Box action={() => work.promise} closeOnActivate />);
      await openMenu(user);
      await user.click(item("box"));
      expect(isOpen()).toBe(true);
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
    });

    it("closeOnActivate: dismissed and re-opened while the change runs, the menu stays open", async () => {
      const user = setupUser();
      const work = deferred();
      const action = vi.fn((_next: boolean) => work.promise);
      render(<Box action={action} closeOnActivate />);
      await openMenu(user);
      await user.click(item("box"));
      expect(action).toHaveBeenCalledTimes(1);
      // Escape (the platform's hide), then a new open while the change still runs. React holds
      // the re-open's commit until the change settles (entangled transitions); the stack close,
      // which belongs to the first opening, is then dropped.
      await act(async () => popup().hidePopover());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      await user.click(trigger());
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
    });

    it("a rejection reaches the boundary", async () => {
      const user = setupUser();
      silenceErrors();
      const caught = vi.fn();
      render(
        <ErrorCatcher onError={caught}>
          <Box
            action={async () => {
              throw new Error("save failed");
            }}
          />
        </ErrorCatcher>,
      );
      await openMenu(user);
      await user.click(item("box"));
      await flushTasks(2);
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "save failed" }));
    });
  });

  it("a rejection with the boundary above Root: optimistic until then, the menu unmounts", async () => {
    const user = setupUser();
    silenceErrors();
    const failing = deferred();
    render(
      <Harness
        content={
          <Menu.CheckboxItem data-testid="box" checkedChangeAction={() => failing.promise}>
            Compact
          </Menu.CheckboxItem>
        }
        boundary={() => {}}
      />,
    );
    await openMenu(user);
    await user.click(item("box"));
    expect(item("box")).toHaveAttribute("aria-checked", "true");
    await act(async () => failing.reject(new Error("save failed")));
    await flushTasks(2);
    expect(screen.getByTestId("error-catcher")).toHaveTextContent("save failed");
  });

  it("a controlled parent that catches the error itself: aria-checked rolls back, menu open", async () => {
    const user = setupUser();
    function Caught() {
      const [checked, setChecked] = useState(false);
      return (
        <Harness
          content={
            <Menu.CheckboxItem
              data-testid="box"
              checked={checked}
              checkedChangeAction={async (next) => {
                try {
                  await Promise.reject(new Error("save failed"));
                  startTransition(() => setChecked(next));
                } catch {
                  // Shown elsewhere; the state is not adopted.
                }
              }}
            >
              Compact
            </Menu.CheckboxItem>
          }
        />
      );
    }
    render(<Caught />);
    await openMenu(user);
    await user.click(item("box"));
    await flushTasks(2);
    expect(item("box")).toHaveAttribute("aria-checked", "false");
    expect(isOpen()).toBe(true);
  });

  it("an older toggle rejecting while a newer one is pending reaches the boundary", async () => {
    const user = setupUser();
    silenceErrors();
    const caught = vi.fn();
    const runs = [deferred(), deferred()];
    let call = 0;
    render(
      <Harness
        content={
          <ErrorCatcher onError={caught}>
            <Menu.CheckboxItem data-testid="box" checkedChangeAction={() => runs[call++]!.promise}>
              Compact
            </Menu.CheckboxItem>
          </ErrorCatcher>
        }
      />,
    );
    await openMenu(user);
    await user.click(item("box"));
    await user.click(item("box"));
    expect(item("box")).toHaveAttribute("aria-checked", "false");
    await act(async () => runs[0]!.reject(new Error("older failed")));
    await flushTasks(2);
    expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "older failed" }));
  });
});

describe("Menu.RadioGroup", () => {
  renderBoth("select", (mode) => {
    function Radios({
      action,
      closeOnActivate,
    }: {
      action?: (next: string) => unknown;
      closeOnActivate?: boolean;
    }) {
      const [value, setValue] = useState<string | null>("name");
      const props =
        mode === "controlled"
          ? {
              value,
              valueChangeAction: async (next: string) => {
                await action?.(next);
                startTransition(() => setValue(next));
              },
            }
          : { defaultValue: "name", valueChangeAction: action };
      return (
        <Harness
          // Kept mounted: uncontrolled item state would otherwise reset on every open (walkthrough 4).
          popup={{ keepMounted: true }}
          content={
            <Menu.RadioGroup data-testid="group" {...props}>
              {({ value: v, pending }: MenuRadioGroupState) => (
                <>
                  <output data-testid="state">{`${v}${pending ? "…" : ""}`}</output>
                  <Menu.RadioItem data-testid="name" value="name" closeOnActivate={closeOnActivate}>
                    {({ checked }: MenuRadioItemState) => `Name${checked ? " ✓" : ""}`}
                  </Menu.RadioItem>
                  <Menu.RadioItem data-testid="date" value="date" closeOnActivate={closeOnActivate}>
                    Date
                  </Menu.RadioItem>
                  <Menu.RadioItem data-testid="size" value="size" disabled>
                    Size
                  </Menu.RadioItem>
                </>
              )}
            </Menu.RadioGroup>
          }
        />
      );
    }

    it("RadioItem state carries the item's value (#113 API2)", () => {
      const className = vi.fn((s: MenuRadioItemState) => `radio-${s.value}`);
      render(
        <Harness
          popup={{ keepMounted: true }}
          content={
            <Menu.RadioGroup defaultValue="date">
              <Menu.RadioItem data-testid="name" value="name" className={className}>
                Name
              </Menu.RadioItem>
              <Menu.RadioItem data-testid="date" value="date" className={className}>
                Date
              </Menu.RadioItem>
            </Menu.RadioGroup>
          }
        />,
      );
      expect(item("name")).toHaveClass("radio-name");
      expect(item("date")).toHaveClass("radio-date");
      expect(className).toHaveBeenCalledWith({
        value: "date",
        checked: true,
        pending: false,
        disabled: false,
      });
    });

    it("pending on the group and the chosen item; previous item unchecked at once", async () => {
      const user = setupUser();
      const work = deferred();
      const action = vi.fn((_next: string) => work.promise);
      render(<Radios action={action} />);
      await openMenu(user);
      expect(item("name")).toHaveTextContent("Name ✓");
      await user.click(item("date"));
      expect(action.mock.calls[0]![0]).toBe("date");
      expect(item("date")).toHaveAttribute("aria-checked", "true");
      expect(item("name")).toHaveAttribute("aria-checked", "false");
      expectPending(item("group"));
      expectPending(item("date"));
      expectNotPending(item("name"));
      expect(item("state")).toHaveTextContent("date…");
      await act(async () => work.resolve());
      await flushTasks(2);
      expectNotPending(item("group"));
      expect(item("date")).toHaveAttribute("aria-checked", "true");
      expect(isOpen()).toBe(true);
    });

    it("the selected item and disabled items never dispatch", async () => {
      const user = setupUser();
      const action = vi.fn();
      render(<Radios action={action} />);
      await openMenu(user);
      await user.click(item("name"));
      await user.click(item("size"));
      await flushTasks(2);
      expect(action).not.toHaveBeenCalled();
      expect(isOpen()).toBe(true);
    });

    it("overlapping dispatches: optimistic follows the latest", async () => {
      const user = setupUser();
      const runs = [deferred(), deferred(), deferred()];
      let call = 0;
      render(<Radios action={() => runs[call++]!.promise} />);
      await openMenu(user);
      await user.click(item("date"));
      await user.click(item("name"));
      expect(item("name")).toHaveAttribute("aria-checked", "true");
      expectPending(item("name"));
      expectNotPending(item("date"));
      await act(async () => runs[1]!.resolve());
      await act(async () => runs[0]!.resolve());
      await flushTasks(2);
      expectNotPending(item("group"));
      if (mode === "uncontrolled") {
        expect(item("name")).toHaveAttribute("aria-checked", "true");
      }
    });

    it("a rejection reaches the boundary", async () => {
      const user = setupUser();
      silenceErrors();
      const caught = vi.fn();
      render(
        <ErrorCatcher onError={caught}>
          <Radios
            action={async () => {
              throw new Error("sort failed");
            }}
          />
        </ErrorCatcher>,
      );
      await openMenu(user);
      await user.click(item("date"));
      await flushTasks(2);
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "sort failed" }));
    });

    it("closeOnActivate: dismissed and re-opened while the change runs, the menu stays open", async () => {
      const user = setupUser();
      const work = deferred();
      const action = vi.fn((_next: string) => work.promise);
      render(<Radios action={action} closeOnActivate />);
      await openMenu(user);
      await user.click(item("date"));
      expect(action).toHaveBeenCalledTimes(1);
      await act(async () => popup().hidePopover());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      await user.click(trigger());
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(isOpen()).toBe(true);
      expect(item("date")).toHaveAttribute("aria-checked", "true");
    });

    it("closeOnActivate closes after the change; re-activating the selected item closes too", async () => {
      const user = setupUser();
      const action = vi.fn();
      render(<Radios action={action} closeOnActivate />);
      await openMenu(user);
      await user.click(item("date"));
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      await openMenu(user);
      await user.click(item("date"));
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
    });
  });

  it("a rejection caught inside the popup rolls the selection back", async () => {
    const user = setupUser();
    silenceErrors();
    const caught = vi.fn();
    render(
      <Harness
        content={
          <ErrorCatcher onError={caught}>
            <Menu.RadioGroup
              defaultValue="a"
              valueChangeAction={async () => {
                throw new Error("failed");
              }}
            >
              <Menu.RadioItem data-testid="a" value="a">
                A
              </Menu.RadioItem>
              <Menu.RadioItem data-testid="b" value="b">
                B
              </Menu.RadioItem>
            </Menu.RadioGroup>
          </ErrorCatcher>
        }
      />,
    );
    await openMenu(user);
    await user.click(item("b"));
    await flushTasks(2);
    expect(caught).toHaveBeenCalled();
    expect(isOpen()).toBe(true);
  });

  it("a superseded rejection reaches the boundary", async () => {
    const user = setupUser();
    silenceErrors();
    const caught = vi.fn();
    const runs = [deferred(), deferred()];
    let call = 0;
    render(
      <Harness
        content={
          <ErrorCatcher onError={caught}>
            <Menu.RadioGroup defaultValue="a" valueChangeAction={() => runs[call++]!.promise}>
              <Menu.RadioItem data-testid="a" value="a">
                A
              </Menu.RadioItem>
              <Menu.RadioItem data-testid="b" value="b">
                B
              </Menu.RadioItem>
            </Menu.RadioGroup>
          </ErrorCatcher>
        }
      />,
    );
    await openMenu(user);
    await user.click(item("b"));
    await user.click(item("a"));
    await act(async () => runs[1]!.resolve());
    await act(async () => runs[0]!.reject(new Error("older failed")));
    await flushTasks(2);
    expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "older failed" }));
  });

  it("a RadioItem outside a RadioGroup throws", () => {
    silenceErrors();
    expect(() =>
      render(
        <Menu.Root defaultOpen>
          <Menu.Popup>
            <Menu.RadioItem value="x">X</Menu.RadioItem>
          </Menu.Popup>
        </Menu.Root>,
      ),
    ).toThrow(/Menu.RadioGroup/);
  });
});
describe("Menu.Root", () => {
  it("children(state) and Trigger / Popup state", async () => {
    const user = setupUser();
    const work = deferred();
    const seen: { root?: MenuRootState; trigger?: MenuTriggerState; popup?: MenuPopupState } = {};
    render(
      <Menu.Root openChangeAction={() => work.promise}>
        {(root: MenuRootState) => {
          seen.root = root;
          return (
            <>
              <Menu.Trigger
                data-testid="trigger"
                className={(s: MenuTriggerState) => {
                  seen.trigger = s;
                  return s.open ? "open" : "closed";
                }}
              >
                Actions
              </Menu.Trigger>
              <Menu.Popup
                data-testid="popup"
                className={(s: MenuPopupState) => {
                  seen.popup = s;
                  return "menu";
                }}
              >
                <Menu.Item>A</Menu.Item>
              </Menu.Popup>
            </>
          );
        }}
      </Menu.Root>,
    );
    expect(seen.root).toEqual({ open: false, pending: false, submenu: false, context: false });
    expect(seen.popup).toEqual({
      open: false,
      side: "bottom",
      align: "start",
      submenu: false,
      context: false,
    });
    await user.click(trigger());
    expect(seen.root).toEqual({ open: true, pending: true, submenu: false, context: false });
    expect(seen.trigger).toEqual({ open: true, pending: true, disabled: false });
    expectPending(trigger());
    expect(trigger()).toHaveClass("open");
    expect(isOpen()).toBe(false);
    await act(async () => work.resolve());
    await flushTasks(2);
    expect(isOpen()).toBe(true);
    expect(seen.popup!.open).toBe(true);
    expectNotPending(trigger());
  });

  it("items that suspend hold the open: Trigger pending, no showPopover; then first item", async () => {
    const user = setupUser();
    const { Suspender, resolve } = createSuspender();
    const { calls } = watchShow();
    render(
      <Suspense fallback={<span data-testid="fallback" />}>
        <Harness
          content={
            <>
              <Suspender value="recent" />
              <Menu.Item data-testid="first">First</Menu.Item>
            </>
          }
        />
      </Suspense>,
    );
    await user.click(trigger());
    await flushTasks(2);
    expectPending(trigger());
    // Optimistically open, but nothing is shown yet: the browser exposes the shown state on the
    // invoker, so the Trigger renders no `aria-expanded` (#121; the link-render mirror's phases
    // are in the shared suite).
    expect(trigger()).toHaveAttribute("data-open", "");
    expect(trigger()).toHaveAttribute("popovertarget", popup().id);
    expect(trigger()).not.toHaveAttribute("aria-expanded");
    expect(calls).toHaveLength(0);
    expect(screen.queryByTestId("fallback")).toBeNull();
    await act(async () => resolve("recent"));
    await flushTasks(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.autofocus).toBe(item("first"));
    expect(trigger()).not.toHaveAttribute("aria-expanded");
    expectNotPending(trigger());
  });

  it("a controlled open flip shows and hides with no dispatch", async () => {
    const action = vi.fn<OpenAction>();
    function Outside() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" data-testid="flip" onClick={() => setOpen((o) => !o)} />
          <Harness root={{ open, openChangeAction: action }} />
        </>
      );
    }
    const { calls } = watchShow();
    render(<Outside />);
    fireEvent.click(screen.getByTestId("flip"));
    await flushTasks(2);
    expect(isOpen()).toBe(true);
    expect(calls[0]!.autofocus).toBe(item("rename"));
    fireEvent.click(screen.getByTestId("flip"));
    await flushTasks(2);
    expect(isOpen()).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it("a foreign show-popover invoker is cancelled and routed through the Root", async () => {
    const action = vi.fn<OpenAction>();
    render(<Harness root={{ openChangeAction: action }} />);
    const event = dispatchCommand(popup(), "show-popover");
    expect(event.defaultPrevented).toBe(false);
    act(() => popup().showPopover());
    await flushTasks(2);
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]![1].reason).toBe("activate");
    expect(isOpen()).toBe(true);
  });

  it("a foreign popovertarget invoker's close is 'activate' with the ToggleEvent (#125)", async () => {
    const action = vi.fn<OpenAction>();
    render(<Harness root={{ openChangeAction: action }} />);
    fireEvent.click(trigger());
    await flushTasks(2);
    expect(isOpen()).toBe(true);
    const foreign = screen.getByTestId("elsewhere");
    foreign.setAttribute("popovertarget", popup().id);
    // A click that moves no focus (a press that moves it out of the tree closes the menu at the
    // focusout first, design 2.2).
    act(() => foreign.click());
    await flushTasks(2);
    expect(isOpen()).toBe(false);
    expect(action).toHaveBeenCalledTimes(2);
    const [next, details] = action.mock.calls[1]!;
    expect(next).toBe(false);
    expect(details.reason).toBe("activate");
    expect(details.event!.type).toBe("beforetoggle");
    expect((details.event as ToggleEvent & { source?: unknown }).source).toBe(foreign);
    // Escape and light dismiss in jsdom: `hidePopover()`, no source.
    fireEvent.click(trigger());
    await flushTasks(2);
    act(() => popup().hidePopover());
    await flushTasks(2);
    expect(action).toHaveBeenCalledTimes(4);
    expect(action.mock.calls[3]![1].reason).toBe("dismiss");
    expect(action.mock.calls[3]![1].event!.type).toBe("toggle");
  });

  it("mount with the popup already open (pre-hydration click): one 'platform' dispatch", async () => {
    const action = vi.fn<OpenAction>();
    const ui = (
      <StrictMode>
        <Harness root={{ openChangeAction: action }} />
      </StrictMode>
    );
    await hydrateFromServer(ui, {
      mutate: async (container) => {
        // A click before hydration ran the `popovertarget` toggle natively; its `toggle` task ran
        // too.
        container.querySelector<HTMLElement>("[popover]")!.showPopover();
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
      inAct: true,
      flush: () => flushTasks(2),
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]![0]).toBe(true);
    expect(action.mock.calls[0]![1].reason).toBe("platform");
    expect(action.mock.calls[0]![1].event).toBeUndefined();
    expect(isOpen()).toBe(true);
    expect(item("rename")).toBeInTheDocument();
    // Walkthrough 10: focus is still on the Trigger; ArrowDown enters the open menu, no dispatch.
    trigger().focus();
    await act(async () => {
      fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    });
    expect(item("rename")).toHaveFocus();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("warns for delay / closeDelay on a top-level Root and a Trigger in a submenu", () => {
    const error = silenceErrors();
    render(
      <Menu.Root delay={50} defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Popup>
          <Menu.Root>
            <Menu.Trigger>Wrong</Menu.Trigger>
            <Menu.Popup>
              <Menu.Item>X</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        </Menu.Popup>
      </Menu.Root>,
    );
    const messages = error.mock.calls.map((call) => String(call[0]));
    expect(messages.some((m) => m.includes("`delay` and `closeDelay` only apply"))).toBe(true);
    expect(messages.some((m) => m.includes("Menu.Trigger: rendered in a submenu"))).toBe(true);
  });

  it("warns for a SubmenuTrigger in a top-level Root and an item outside a Popup", () => {
    const error = silenceErrors();
    render(
      <Menu.Root>
        <Menu.SubmenuTrigger>Wrong</Menu.SubmenuTrigger>
        <Menu.Item>Loose</Menu.Item>
      </Menu.Root>,
    );
    const messages = error.mock.calls.map((call) => String(call[0]));
    expect(messages.some((m) => m.includes("Menu.SubmenuTrigger: rendered in a top-level"))).toBe(
      true,
    );
    expect(messages.some((m) => m.includes("Menu.Item: rendered outside a Menu.Popup"))).toBe(true);
  });

  it("warns for a Popup rendered as a <dialog>", () => {
    const error = silenceErrors();
    render(
      <Menu.Root>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Popup render={<dialog />} />
      </Menu.Root>,
    );
    expect(error.mock.calls.some((call) => String(call[0]).includes("rendered a <dialog>"))).toBe(
      true,
    );
  });

  it("warns for a non-button Trigger: its close while open is a light dismiss (#115)", () => {
    const error = silenceErrors();
    render(
      <Menu.Root>
        <Menu.Trigger render={<span tabIndex={0} />}>Actions</Menu.Trigger>
        <Menu.Popup>
          <Menu.Item>Edit</Menu.Item>
        </Menu.Popup>
      </Menu.Root>,
    );
    const warning = error.mock.calls
      .map((call) => String(call[0]))
      .find((m) => m.includes("Menu.Trigger: rendered a <span>"));
    expect(warning).toContain("closes it through light dismiss before the click");
  });

  it("warns for a non-button SubmenuTrigger: a press while open dismisses the submenu (#115)", async () => {
    const user = setupUser();
    const error = silenceErrors();
    render(
      <Menu.Root>
        <Menu.Trigger data-testid="trigger">Actions</Menu.Trigger>
        <Menu.Popup>
          <Menu.Root>
            <Menu.SubmenuTrigger render={<div />}>Move to</Menu.SubmenuTrigger>
            <Menu.Popup aria-label="Folders">
              <Menu.Item>Inbox</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        </Menu.Popup>
      </Menu.Root>,
    );
    // The popup's content mounts on the first open.
    await user.click(screen.getByTestId("trigger"));
    await flushTasks(2);
    const warning = error.mock.calls
      .map((call) => String(call[0]))
      .find((m) => m.includes("Menu.SubmenuTrigger: rendered a <div>"));
    expect(warning).toContain("dismisses the popup through light dismiss instead of moving focus");
    expect(warning).not.toContain("not awaited");
  });
});

describe("submenus", () => {
  async function openSub(user: ReturnType<typeof setupUser>) {
    await openMenu(user);
    item("move").focus();
    await user.keyboard("{ArrowRight}");
    await flushTasks(2);
    expect(isOpen(screen.getByTestId("subpopup"))).toBe(true);
  }
  const sub = () => screen.getByTestId("subpopup");

  describe("resolved placement (wave 11)", () => {
    // Conventions 13.2: `getComputedStyle` stubbed for one popup (jsdom has no layout); the
    // shim's `toggle` drives the hook.
    it("the top-level popup: requested while closed, the stubbed pair while shown, requested after", async () => {
      const user = setupUser();
      stubComputedPlacement(() => screen.queryByTestId("popup"), {
        positionArea: "span-self-x-end top",
        direction: "ltr",
      });
      const states: MenuPopupState[] = [];
      render(
        <Harness
          popup={{
            className: (s) => {
              states.push(s);
              return undefined;
            },
          }}
        />,
      );
      expect(popup().style.getPropertyValue("position-area")).toBe("bottom span-self-x-end");
      expect(popup()).toHaveAttribute("data-side", "bottom");
      await openMenu(user);
      expect(popup()).toHaveAttribute("data-side", "top");
      expect(popup()).toHaveAttribute("data-align", "start");
      expect(states.at(-1)).toMatchObject({ side: "top", align: "start" });
      await act(async () => popup().hidePopover());
      await flushTasks(2);
      expect(popup()).toHaveAttribute("data-side", "bottom");
      expect(states.at(-1)).toMatchObject({ side: "bottom", align: "start" });
    });

    it("a submenu in RTL: self-x-end span-bottom reads as left / start, inline-end once closed", async () => {
      const user = setupUser();
      stubComputedPlacement(() => screen.queryByTestId("subpopup"), {
        positionArea: "self-x-end span-bottom",
        direction: "rtl",
      });
      render(<Harness content={<SubmenuContent />} />);
      await openSub(user);
      expect(sub()).toHaveAttribute("data-side", "left");
      expect(sub()).toHaveAttribute("data-align", "start");
      expect(sub().style.getPropertyValue("position-area")).toBe("self-x-end span-bottom");
      await act(async () => sub().hidePopover());
      await flushTasks(2);
      expect(sub()).toHaveAttribute("data-side", "inline-end");
    });
  });

  it("a nested Root is a submenu; ArrowRight opens it beside its trigger, first item focused", async () => {
    const user = setupUser();
    const states: MenuRootState[] = [];
    const { calls } = watchShow();
    render(
      <Harness
        content={
          <Menu.Root>
            {(s: MenuRootState) => {
              states.push(s);
              return (
                <>
                  <Menu.SubmenuTrigger data-testid="move">Move to</Menu.SubmenuTrigger>
                  <Menu.Popup data-testid="subpopup">
                    <Menu.Item data-testid="inbox">Inbox</Menu.Item>
                  </Menu.Popup>
                </>
              );
            }}
          </Menu.Root>
        }
      />,
    );
    await openSub(user);
    expect(states.at(-1)!.submenu).toBe(true);
    const last = calls.at(-1)!;
    expect(last.popup).toBe(sub());
    expect(last.source).toBe(item("move"));
    expect(popoverSource(sub())).toBe(item("move"));
    expect(last.autofocus).toBe(item("inbox"));
    expect(item("move")).toHaveAttribute("popovertarget", sub().id);
    expect(item("move")).not.toHaveAttribute("aria-expanded");
    expect(item("move")).toHaveAttribute("data-open", "");
  });

  it.each(["{Enter}", " "])("%s on the SubmenuTrigger opens with the first item", async (key) => {
    const user = setupUser();
    const { calls } = watchShow();
    render(<Harness content={<SubmenuContent />} />);
    await openMenu(user);
    item("move").focus();
    await user.keyboard(key);
    await flushTasks(2);
    expect(isOpen(sub())).toBe(true);
    expect(calls.at(-1)!.autofocus).toBe(item("inbox"));
  });

  it("a click opens it; a second click keeps it open and focuses its first item", async () => {
    const user = setupUser();
    const subAction = vi.fn<OpenAction>();
    render(<Harness content={<SubmenuContent sub={{ openChangeAction: subAction }} />} />);
    await openMenu(user);
    await user.click(item("move"));
    await flushTasks(2);
    expect(isOpen(sub())).toBe(true);
    item("move").focus();
    await user.click(item("move"));
    await flushTasks(2);
    expect(isOpen(sub())).toBe(true);
    expect(item("inbox")).toHaveFocus();
    expect(subAction).toHaveBeenCalledTimes(1);
  });

  it("ArrowRight on an open submenu's trigger focuses its first item without a dispatch", async () => {
    const user = setupUser();
    const subAction = vi.fn<OpenAction>();
    render(<Harness content={<SubmenuContent sub={{ openChangeAction: subAction }} />} />);
    await openSub(user);
    item("move").focus();
    await user.keyboard("{ArrowRight}");
    expect(item("inbox")).toHaveFocus();
    expect(subAction).toHaveBeenCalledTimes(1);
  });

  it("ArrowLeft closes the submenu ('activate') and focus returns to its trigger", async () => {
    const user = setupUser();
    const subAction = vi.fn<OpenAction>();
    const rootAction = vi.fn<OpenAction>();
    render(
      <Harness
        root={{ openChangeAction: rootAction }}
        content={<SubmenuContent sub={{ openChangeAction: subAction }} />}
      />,
    );
    await openSub(user);
    item("inbox").focus();
    await user.keyboard("{ArrowLeft}");
    await flushTasks(2);
    expect(isOpen(sub())).toBe(false);
    expect(isOpen()).toBe(true);
    expect(subAction.mock.calls.at(-1)![0]).toBe(false);
    expect(subAction.mock.calls.at(-1)![1].reason).toBe("activate");
    expect(item("move")).toHaveFocus();
    expect(rootAction).toHaveBeenCalledTimes(1);
  });

  it("RTL: ArrowLeft opens and ArrowRight closes", async () => {
    const user = setupUser();
    const real = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
      const style = real.call(window, element, pseudo);
      return new Proxy(style, {
        get: (target, key) => (key === "direction" ? "rtl" : Reflect.get(target, key)),
      });
    });
    render(<Harness content={<SubmenuContent />} />);
    await openMenu(user);
    item("move").focus();
    await user.keyboard("{ArrowRight}");
    await flushTasks(2);
    expect(isOpen(sub())).toBe(false);
    await user.keyboard("{ArrowLeft}");
    await flushTasks(2);
    expect(isOpen(sub())).toBe(true);
    item("inbox").focus();
    await user.keyboard("{ArrowLeft}");
    await flushTasks(2);
    expect(isOpen(sub())).toBe(true);
    await user.keyboard("{ArrowRight}");
    await flushTasks(2);
    expect(isOpen(sub())).toBe(false);
  });

  it("submenu items are navigated on their own; the parent's arrow keys ignore them", async () => {
    const user = setupUser();
    render(<Harness content={<SubmenuContent />} />);
    await openSub(user);
    item("inbox").focus();
    await user.keyboard("{ArrowDown}");
    expect(item("later")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item("inbox")).toHaveFocus();
    await user.keyboard("{End}");
    expect(item("later")).toHaveFocus();
  });

  it("items that suspend in a submenu hold its open with data-pending on the SubmenuTrigger", async () => {
    const user = setupUser();
    const { Suspender, resolve } = createSuspender();
    render(
      <Harness
        content={
          <Menu.Root>
            <Menu.SubmenuTrigger data-testid="move">Open recent</Menu.SubmenuTrigger>
            <Menu.Popup data-testid="subpopup">
              <Suspender value="files" />
              <Menu.Item data-testid="file">File</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        }
      />,
    );
    await openMenu(user);
    await user.click(item("move"));
    await flushTasks(2);
    expectPending(item("move"));
    expect(isOpen(sub())).toBe(false);
    await act(async () => resolve("files"));
    await flushTasks(2);
    expect(isOpen(sub())).toBe(true);
    expectNotPending(item("move"));
  });

  describe("hover intent", () => {
    async function setup(props?: Partial<MenuRootProps>) {
      const user = setupUser();
      const subAction = vi.fn<OpenAction>();
      const { calls } = watchShow();
      render(
        <Harness content={<SubmenuContent sub={{ openChangeAction: subAction, ...props }} />} />,
      );
      await openMenu(user);
      vi.useFakeTimers();
      return { subAction, calls };
    }
    const advance = (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });

    it("opens after `delay` (100 ms) with no focus move", async () => {
      const { subAction, calls } = await setup();
      item("move").focus();
      fireEvent.pointerEnter(item("move"), { pointerType: "mouse" });
      await advance(99);
      expect(subAction).not.toHaveBeenCalled();
      await advance(1);
      await advance(10);
      expect(subAction).toHaveBeenCalledTimes(1);
      expect(isOpen(sub())).toBe(true);
      expect(calls.at(-1)!.autofocus).toBeNull();
      expect(item("move")).toHaveFocus();
    });

    it("leaving before the delay cancels; touch never opens; a custom delay applies", async () => {
      const { subAction } = await setup({ delay: 300 });
      fireEvent.pointerEnter(item("move"), { pointerType: "mouse" });
      await advance(200);
      fireEvent.pointerLeave(item("move"), { pointerType: "mouse" });
      await advance(500);
      fireEvent.pointerEnter(item("move"), { pointerType: "touch" });
      await advance(500);
      expect(subAction).not.toHaveBeenCalled();
      fireEvent.pointerEnter(item("move"), { pointerType: "mouse" });
      await advance(310);
      expect(subAction).toHaveBeenCalledTimes(1);
    });

    it("leaving closes after `closeDelay` (150 ms) with 'dismiss'; entering the submenu cancels", async () => {
      const { subAction } = await setup();
      fireEvent.pointerEnter(item("move"), { pointerType: "mouse" });
      await advance(110);
      expect(isOpen(sub())).toBe(true);
      fireEvent.pointerLeave(item("move"), { pointerType: "mouse" });
      await advance(100);
      fireEvent.pointerEnter(sub(), { pointerType: "mouse" });
      await advance(500);
      expect(isOpen(sub())).toBe(true);
      fireEvent.pointerLeave(sub(), { pointerType: "mouse" });
      await advance(149);
      expect(isOpen(sub())).toBe(true);
      await advance(1);
      await advance(10);
      expect(isOpen(sub())).toBe(false);
      expect(subAction.mock.calls.at(-1)![0]).toBe(false);
      expect(subAction.mock.calls.at(-1)![1].reason).toBe("dismiss");
    });

    it("keyboard focus inside the submenu blocks the hover close", async () => {
      await setup();
      fireEvent.pointerEnter(item("move"), { pointerType: "mouse" });
      await advance(110);
      item("inbox").focus();
      fireEvent.pointerLeave(item("move"), { pointerType: "mouse" });
      await advance(500);
      expect(isOpen(sub())).toBe(true);
    });

    it("a keyboard open cancels a pending hover open (one dispatch)", async () => {
      const { subAction } = await setup();
      fireEvent.pointerEnter(item("move"), { pointerType: "mouse" });
      await advance(50);
      item("move").focus();
      await act(async () => {
        fireEvent.keyDown(item("move"), { key: "ArrowRight" });
      });
      await advance(500);
      expect(subAction).toHaveBeenCalledTimes(1);
      expect(isOpen(sub())).toBe(true);
    });
  });

  it("item activation in a submenu closes the stack: root 'activate', submenu 'dismiss'", async () => {
    const user = setupUser();
    const rootAction = vi.fn<OpenAction>();
    const subAction = vi.fn<OpenAction>();
    const onItem = vi.fn();
    render(
      <Harness
        root={{ openChangeAction: rootAction }}
        content={<SubmenuContent sub={{ openChangeAction: subAction }} onItem={onItem} />}
      />,
    );
    await openSub(user);
    item("inbox").focus();
    await user.keyboard("{Enter}");
    await flushTasks(2);
    expect(onItem).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);
    expect(rootAction.mock.calls.at(-1)![0]).toBe(false);
    expect(rootAction.mock.calls.at(-1)![1].reason).toBe("activate");
    expect(subAction.mock.calls.at(-1)![0]).toBe(false);
    expect(subAction.mock.calls.at(-1)![1].reason).toBe("dismiss");
  });

  it("focus leaving the tree hides the root popup at once; every Root gets 'dismiss'", async () => {
    const user = setupUser();
    const rootAction = vi.fn<OpenAction>();
    const subAction = vi.fn<OpenAction>();
    const work = deferred();
    render(
      <Harness
        root={{
          openChangeAction: (next, details) => {
            rootAction(next, details);
            return next ? undefined : work.promise;
          },
        }}
        content={<SubmenuContent sub={{ openChangeAction: subAction }} />}
      />,
    );
    await openSub(user);
    item("inbox").focus();
    const hide = spyHide();
    act(() => {
      fireEvent.blur(item("inbox"), { relatedTarget: screen.getByTestId("elsewhere") });
    });
    // Immediate, not awaited: the root popup is hidden before any action settles.
    expect(hide).toHaveBeenCalled();
    expect(isOpen()).toBe(false);
    await flushTasks(2);
    expect(rootAction.mock.calls.at(-1)![1].reason).toBe("dismiss");
    expect(subAction.mock.calls.at(-1)![1].reason).toBe("dismiss");
  });

  it("focusout with no relatedTarget or into a submenu closes nothing", async () => {
    const user = setupUser();
    render(<Harness content={<SubmenuContent />} />);
    await openSub(user);
    act(() => {
      fireEvent.blur(item("move"), { relatedTarget: null });
      fireEvent.blur(item("move"), { relatedTarget: item("inbox") });
      fireEvent.blur(item("inbox"), { relatedTarget: item("rename") });
    });
    await flushTasks(2);
    expect(isOpen()).toBe(true);
    expect(isOpen(sub())).toBe(true);
  });

  it("a primary press on the Trigger is prevented only while open: focus stays on the item", async () => {
    const user = setupUser();
    render(<Harness />);
    // Closed: the press focuses the Trigger as usual (the element the popover returns focus to).
    expect(fireEvent.mouseDown(trigger(), { button: 0 })).toBe(true);
    await openMenu(user);
    expect(item("rename")).toHaveFocus();
    // Secondary buttons are not the Trigger's.
    expect(fireEvent.mouseDown(trigger(), { button: 2 })).toBe(true);
    expect(fireEvent.mouseDown(trigger(), { button: 0 })).toBe(false);
    expect(item("rename")).toHaveFocus();
    expect(isOpen()).toBe(true);
  });

  describe("a Trigger click while open closes through the action (#110)", () => {
    async function setup(boundary?: (error: unknown) => void) {
      const user = setupUser();
      const work = deferred();
      const action = vi.fn<OpenAction>((next) => (next ? undefined : work.promise));
      render(<Harness root={{ openChangeAction: action }} boundary={boundary} />);
      await openMenu(user);
      expect(item("rename")).toHaveFocus();
      const hide = spyHide();
      await user.click(trigger());
      // The click is the only close: shown, item focused, optimistic feedback on the Trigger;
      // the browser exposes the shown menu on the invoker, no `aria-expanded` (#121).
      expect(isOpen()).toBe(true);
      expect(item("rename")).toHaveFocus();
      expect(trigger()).not.toHaveAttribute("data-open");
      expect(trigger()).toHaveAttribute("popovertarget", popup().id);
      expect(trigger()).not.toHaveAttribute("aria-expanded");
      expect(trigger()).toHaveAttribute("data-pending", "");
      expect(hide).not.toHaveBeenCalled();
      expect(action).toHaveBeenCalledTimes(2);
      const [next, details] = action.mock.calls[1]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event!.type).toBe("click");
      return { work, action, hide };
    }

    it("resolved: hides in the commit, once, with no further dispatch", async () => {
      const { work, action, hide } = await setup();
      await act(async () => work.resolve());
      await flushTasks(2);
      expect(isOpen()).toBe(false);
      expect(hide).toHaveBeenCalledTimes(1);
      expect(trigger()).not.toHaveAttribute("aria-expanded");
      expect(trigger()).not.toHaveAttribute("data-pending");
      expect(action).toHaveBeenCalledTimes(2);
    });

    it("rejected: the boundary gets it; the library never hid the menu", async () => {
      silenceErrors();
      const caught = vi.fn();
      const { work, hide } = await setup(caught);
      await act(async () => work.reject(new Error("save failed")));
      await flushTasks(2);
      expect(caught).toHaveBeenCalledWith(expect.objectContaining({ message: "save failed" }));
      expect(hide).not.toHaveBeenCalled();
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("save failed");
    });
  });

  it("focusout to the Trigger (Shift+Tab) closes the menu", async () => {
    const user = setupUser();
    render(<Harness />);
    await openMenu(user);
    act(() => {
      fireEvent.blur(item("rename"), { relatedTarget: trigger() });
    });
    expect(isOpen()).toBe(false);
  });
});

describe("right- and middle-click (context-menu.md 5, every menu)", () => {
  const contextMenuEvent = () =>
    new PointerEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, buttons: 2 });

  it("onContextMenu is owned on the Popup: the library's preventDefault runs", async () => {
    const user = setupUser();
    const consumer = vi.fn();
    // @ts-expect-error -- owned key, omitted from MenuPopupProps
    const props: MenuPopupProps = { onContextMenu: consumer };
    render(<Harness popup={props} />);
    await openMenu(user);
    const event = contextMenuEvent();
    act(() => {
      item("rename").dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(isOpen()).toBe(true);
  });

  it("a Trigger-opened menu closes at once on a right-click outside ('dismiss')", async () => {
    const user = setupUser();
    const action = vi.fn<OpenAction>();
    render(<Harness root={{ openChangeAction: action }} />);
    await openMenu(user);
    const hide = spyHide();
    act(() => {
      screen.getByTestId("elsewhere").dispatchEvent(contextMenuEvent());
    });
    expect(hide).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);
    await flushTasks(2);
    expect(action.mock.calls.at(-1)).toEqual([
      false,
      expect.objectContaining({ reason: "dismiss" }),
    ]);
  });

  it("a Trigger-opened menu closes on a middle-button pointerdown outside", async () => {
    const user = setupUser();
    render(<Harness />);
    await openMenu(user);
    act(() => {
      screen
        .getByTestId("elsewhere")
        .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 1, buttons: 4 }));
    });
    expect(isOpen()).toBe(false);
  });
});

describe("transition (smoke)", () => {
  it("with transition the items are gone in the close commit after an activation", async () => {
    const user = setupUser();
    render(<Harness popup={{ transition: "menu" }} />);
    await openMenu(user);
    let seenItems = -1;
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(function (this: HTMLElement) {
      seenItems = this.querySelectorAll('[role="menuitem"]').length;
    });
    await user.click(item("duplicate"));
    await flushTasks(2);
    expect(seenItems).toBe(0);
  });

  it("without transition the items are held through the close commit", async () => {
    const user = setupUser();
    render(<Harness />);
    await openMenu(user);
    let seenItems = -1;
    const original = HTMLElement.prototype.hidePopover;
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(function (this: HTMLElement) {
      seenItems = this.querySelectorAll('[role="menuitem"]').length;
      original.call(this);
    });
    await user.click(item("duplicate"));
    await flushTasks(2);
    expect(seenItems).toBe(4);
    expect(popup().children).toHaveLength(0);
  });
});
