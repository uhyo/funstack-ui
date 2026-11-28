import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { MenubarApp } from "../examples/MenubarApp.js";
import { functionProps, renderProp } from "./shared-props.js";

export function MenubarPage() {
  return (
    <DocPage
      title="Menubar"
      description="The application menu of a desktop-style app: a row of ordinary Menu.Roots with one Tab stop, arrow keys between the menus and hover switching while a menu is open."
    >
      <p className="page-intro">
        The WAI-ARIA menubar: "File Edit View" in a row, each opening a menu, with the arrow keys
        moving between the menus. <code>Menubar</code> is one element,{" "}
        <code>{'<div role="menubar">'}</code>, around ordinary <a href="/components/menu">Menu</a>{" "}
        parts: every <code>Menu.Trigger</code> inside becomes an item of the bar, and every menu
        keeps its own open state, items, actions and pending state. A menubar is not site
        navigation; links in a header are a navigation menu.
      </p>

      <Example file="MenubarApp.tsx" css="menubar.css">
        <MenubarApp />
      </Example>
      <p>
        Tab enters the bar on File (or on the menu used last). Left / Right move between the menus;
        ArrowDown, Enter or a click opens one. Inside a menu, Right moves on to the next menu and
        Left back to the previous one, first item focused (on "Open recent", Right opens the submenu
        instead). Once a menu is open, moving the pointer across the bar switches menus. Help is
        disabled: it is reached and announced, but never opens.
      </p>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Menu } from "@funstack/ui/menu";
import { Menubar } from "@funstack/ui/menubar";

<Menubar aria-label="Application">                      {/* div[role=menubar] */}
  <Menu.Root>
    <Menu.Trigger>File</Menu.Trigger>                   {/* button[role=menuitem][popovertarget] */}
    <Menu.Popup>                                        {/* div[popover=auto][role=menu] */}
      <Menu.Item action={newFile}>New</Menu.Item>
      <Menu.Root>                                       {/* a submenu, as in any menu */}
        <Menu.SubmenuTrigger>Open recent</Menu.SubmenuTrigger>
        <Menu.Popup><RecentFiles /></Menu.Popup>
      </Menu.Root>
    </Menu.Popup>
  </Menu.Root>
  <Menu.Root>
    <Menu.Trigger>View</Menu.Trigger>
    <Menu.Popup>…</Menu.Popup>
  </Menu.Root>
</Menubar>`}</CodeBlock>
      <Table
        head={["Part", "Element", "Role"]}
        rows={[
          [
            "`Menubar`",
            '`<div role="menubar" aria-orientation="horizontal">`',
            "One Tab stop and the arrow keys between its Triggers; switches menus. Holds no open state.",
          ],
          [
            "`Menu.Trigger` in a bar",
            '`<button role="menuitem" popovertarget aria-haspopup="menu">`',
            "An item of the bar. `tabindex` is written by the bar.",
          ],
          ["every other `Menu` part", "", "Unchanged: see [Menu](/components/menu)."],
        ]}
      />
      <p>
        There is no <code>Menubar.Menu</code> or <code>Menubar.Trigger</code>: a top-level{" "}
        <code>Menu.Root</code> rendered inside a <code>Menubar</code> is a menu of the bar, and a
        menu moves into or out of a bar without renaming a part. A submenu is not a menu of the bar
        (the bar ends at each <code>Menu.Popup</code>). A vertical rule between menus is the
        standalone <a href="/components/separator">Separator</a> with{" "}
        <code>orientation="vertical"</code>, which is not focusable.
      </p>

      <h3 id="how-it-works">How it works</h3>
      <h4>Switching menus</h4>
      <p>
        Every move from one menu of the bar to another runs the same three steps: the target Trigger
        is focused (with the focus ring from the keyboard, quietly from the pointer); every other
        menu of the bar closes at once; the target's open is requested. So:
      </p>
      <ul>
        <li>
          The menu you leave is <strong>dismissed</strong>, a fact:{" "}
          <code>onOpenChange(false, {'{ reason: "dismiss" }'})</code> on its Root. A menu whose open
          was still pending is superseded instead:{" "}
          <code>openChangeAction(false, {'{ reason: "dismiss" }'})</code>, and it never appears.
        </li>
        <li>
          The menu you go to is <strong>requested</strong>:{" "}
          <code>openChangeAction(true, {'{ reason: "activate" }'})</code> in a transition, with{" "}
          <code>data-open</code> and <code>data-pending</code> on its Trigger until its items have
          rendered.
        </li>
        <li>
          Because the Trigger is focused before its menu shows, Escape or an item's activation in
          the new menu returns focus to the new Trigger.
        </li>
      </ul>

      <h3 id="props">Props</h3>
      <h4>Menubar</h4>
      <PropsTable
        rows={[
          {
            name: "loop",
            type: "boolean",
            default: "true",
            description:
              "The arrow keys wrap from the last menu to the first and back: on the bar, and from inside its menus.",
          },
          ...functionProps("MenubarState", "The menus of the bar, or a function of the state."),
          renderProp("div", "MenubarState"),
        ]}
      />
      <PartFacts
        state={
          '`MenubarState` is `{ orientation }`, always `"horizontal"`: the bar holds no open state. Each menu\'s is on its `Menu.Root`.'
        }
        owned={
          '`role` (`"menubar"`), `aria-orientation` and `data-orientation` (both `"horizontal"`), `onKeyDown`, `onFocus`, `onBlur`, `onPointerDown`, and the `tabindex` of its Triggers.'
        }
        note={
          "Name the bar with `aria-label` or `aria-labelledby`. `aria-orientation` is rendered although horizontal is the role's default, so a stylesheet has the same `[data-orientation]` hook as on a Toolbar or a tab list. There is no `disabled`: disable a menu on its `Menu.Trigger`."
        }
      />

      <h4>Menu.Trigger, Menu.Root and Menu.Popup in a bar</h4>
      <p>No new props. Inside a bar:</p>
      <ul>
        <li>
          <code>Menu.Trigger</code> renders <code>role="menuitem"</code> and no{" "}
          <code>tabindex</code> (the bar writes it; do not pass <code>tabIndex</code>).{" "}
          <code>disabled</code> renders <code>aria-disabled="true"</code> and{" "}
          <code>data-disabled</code> instead of the native attribute: the Trigger stays focusable
          and announced, and never opens its menu (it renders no <code>popovertarget</code>, and{" "}
          <code>aria-expanded="false"</code> instead). Owned keys add <code>role</code> and{" "}
          <code>onPointerMove</code> (the hover switch). A <code>render</code> element&apos;s own{" "}
          <code>onPointerMove</code> still runs, first.
        </li>
        <li>
          <code>Menu.Root</code> keeps <code>open</code>, <code>defaultOpen</code>,{" "}
          <code>openChangeAction</code> and <code>onOpenChange</code>. <code>delay</code> /{" "}
          <code>closeDelay</code> stay submenu-only: switching menus by hover has no delay.
        </li>
        <li>
          <code>Menu.Popup</code> keeps its defaults (<code>side="bottom"</code>,{" "}
          <code>align="start"</code>).
        </li>
      </ul>

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          [
            "`data-open`",
            "`Menu.Trigger`",
            "Its menu is open or opening (optimistic): set at once when a switch asks for it.",
          ],
          ["`data-pending`", "`Menu.Trigger`", "Its menu's open or close action is in flight."],
          ["`data-disabled`", "`Menu.Trigger`", "The `disabled` prop."],
          ["`data-orientation`", "Menubar", 'Always `"horizontal"`.'],
        ]}
      />
      <p>
        The popups and items carry Menu's own (
        <a href="/components/menu#data-attributes">Menu data attributes</a>).
      </p>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Where", "Behaviour"]}
        rows={[
          [
            "Tab / Shift+Tab",
            "outside the bar",
            "Focus enters the bar on the Trigger focused last (the first one before any was).",
          ],
          [
            "ArrowRight / ArrowLeft",
            "Trigger",
            "Next / previous Trigger (swapped under `direction: rtl`; wraps with `loop`). If this Trigger's menu is open: that menu closes and the new Trigger's opens, focus left on the Trigger.",
          ],
          ["Home / End", "Trigger", "First / last Trigger; the same rule for an open menu."],
          [
            "ArrowRight / ArrowLeft / Home / End",
            "a disabled Trigger a switch landed on",
            "The bar stays in menu mode there: the Trigger reached opens its menu, with the first item focused if you came from inside a menu.",
          ],
          ["Escape", "that disabled Trigger", "Ends menu mode; focus stays."],
          [
            "ArrowDown / Enter / Space",
            "Trigger",
            "Opens its menu with the first item focused (as in Menu).",
          ],
          ["ArrowUp", "Trigger", "Opens its menu with the last item focused."],
          [
            "Any of these with Alt, Ctrl or Meta, or already default-prevented",
            "anywhere",
            "Not handled: the key is the browser's.",
          ],
          [
            "ArrowRight",
            "an item that opens no submenu, at any depth",
            "The next menu of the bar opens, first item focused. On a SubmenuTrigger it opens the submenu.",
          ],
          [
            "ArrowLeft",
            "an item of a top-level menu",
            "The previous menu of the bar opens, first item focused. In a submenu it closes the submenu.",
          ],
          ["Escape", "item", "Closes the innermost menu; focus returns to its Trigger."],
          [
            "Tab / Shift+Tab",
            "item",
            "Closes the menus; Tab moves past the bar, Shift+Tab lands on the menu's Trigger.",
          ],
          [
            "Tab / Shift+Tab",
            "Trigger",
            "Leaves the bar; a menu still shown (after a hover switch) is hidden.",
          ],
        ]}
      />
      <p>
        There is no typeahead between the Triggers. With every menu closed, the arrow keys only move
        focus, and hovering a Trigger does nothing: a click or the keyboard opens the first menu.
        Once one is open, moving the pointer onto another Trigger (mouse or pen, not touch) switches
        to it, with no delay; a click on the Trigger of the open menu closes it.
      </p>
      <Table
        head={["Element", "Attributes"]}
        rows={[
          ["`Menubar`", '`role="menubar"`; your `aria-label` / `aria-labelledby`'],
          [
            "`Menu.Trigger` in a bar",
            '`role="menuitem"`, `aria-haspopup="menu"`, `popovertarget`, `tabindex` (written by the bar), `aria-disabled="true"` when disabled. No `aria-expanded`: the browser exposes the expanded state from `popovertarget`. A disabled Trigger is the exception: no `popovertarget` (it must not open), and `aria-expanded="false"` instead.',
          ],
          ["Popups and items", "As [Menu](/components/menu#keyboard-and-aria)."],
        ]}
      />
      <p>
        The popups are DOM children of the <code>menubar</code> element, each right after its
        Trigger, as in the APG example; Chromium and Firefox expose each open menu as a child of the
        bar named by its Trigger, and axe reports no violation for this structure.
      </p>

      <Callout title="Label the bar">
        <p>
          A menubar needs a name: pass <code>aria-label</code> or <code>aria-labelledby</code>.
        </p>
      </Callout>

      <BehaviourSection
        id="transition-types"
        summary={
          "None of its own. Each menu's opens and closes are Menu's: `fsui-menu` plus `fsui-menu-open` or `fsui-menu-close`."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "The bar holds no state. A switch sets the new Trigger's `data-open` at once (optimistic) and `data-pending` while its menu's `openChangeAction` runs or its items load; the menu that was left closes at once, with nothing pending."
        }
      >
        <p>
          An item's action that is still running when you switch away keeps running in its own
          transition; its menu has already closed, so the close it would run when it settles does
          nothing. React entangles the new menu's open with that pending action, so the new menu
          opens when the action settles; its Trigger shows <code>data-open</code> and{" "}
          <code>data-pending</code> meanwhile.
        </p>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "As Menu, per menu: items that suspend hold the open. During a switch no menu is shown and focus stays on the new Trigger (`data-pending`) until the items are ready; then the menu shows with its first item focused."
        }
      >
        <p>Switching again before that supersedes the pending open: that menu never appears.</p>
      </BehaviourSection>

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'Each menu is its own `popover="auto"`: the browser shows one at a time, and handles Escape and light dismiss. A switch closes the old menu with `hidePopover()`, a dismissal reported to its `onOpenChange`. A controlled `Menu.Root` in a bar needs `onOpenChange`, as every controlled menu does; one that keeps `open={true}` after the switch is shown again, which hides the menu the switch opened.'
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'The bar writes `tabindex` from an effect, so the server HTML has none: before hydration every Trigger is a Tab stop, and a click opens its (still empty) menu natively, one at a time. Hydration fills a menu found open (`reason: "platform"`) and leaves one Tab stop. There is no JS-free mode.'
        }
      />

      <h3 id="styling">Styling</h3>
      <CodeBlock language="css">{`.menubar { display: flex; gap: 2px; }
.menubar > [role="menuitem"] { padding: 4px 10px; border: 0; background: none; }
.menubar > [role="menuitem"]:focus-visible,
.menubar > [role="menuitem"][data-open] { background: var(--accent-weak); outline: none; }
.menubar > [role="menuitem"][data-pending] { cursor: progress; }
.menubar > [role="menuitem"][aria-disabled="true"] { opacity: .4; }`}</CodeBlock>
      <p>
        Style the popups as any menu (<a href="/components/menu#styling">Menu styling</a>).{" "}
        <code>transition</code> on a <code>Menu.Popup</code> works as outside a bar, but for a bar
        the usual choice is no view transition between menus: a view transition blocks pointer input
        while it runs, and a user sweeping across the bar switches several times a second. The menu
        a switch closes leaves by its CSS exit.
      </p>

      <h3 id="not-included">Not included</h3>
      <ul>
        <li>
          A vertical menubar (<code>orientation</code>).
        </li>
        <li>
          <code>experimental_focusGroup</code> (<code>focusgroup="menubar"</code>).
        </li>
        <li>Typeahead between the Triggers.</li>
        <li>Items directly in the bar (a command or a link with no menu).</li>
        <li>Press, drag and release from a Trigger onto an item.</li>
        <li>A bar-level value naming the open menu: control each Root instead.</li>
        <li>Opening on hover while every menu is closed.</li>
      </ul>
    </DocPage>
  );
}
