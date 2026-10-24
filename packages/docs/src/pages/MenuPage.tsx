import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { MenuRowActions } from "../examples/MenuRowActions.js";
import { MenuViewOptions } from "../examples/MenuViewOptions.js";
import { functionProps, renderProp } from "./shared-props.js";

const itemRows = (state: string, closeDefault: string, closeNote: string) => [
  {
    name: "closeOnActivate",
    type: "boolean",
    default: closeDefault,
    description: closeNote,
  },
  {
    name: "disabled",
    type: "boolean",
    default: "false",
    description:
      'Renders `aria-disabled="true"` and `data-disabled`, never the native attribute: a disabled item stays focusable (the APG) and is reached by the arrow keys and typeahead, but never activates.',
  },
  {
    name: "label",
    type: "string",
    description:
      "Text that typeahead matches when the item's text content is not representative (an icon). Rendered as `data-typeahead`.",
  },
  ...functionProps(state),
  renderProp("button", state),
];

export function MenuPage() {
  return (
    <DocPage
      title="Menu"
      description="A menu button on the Popover API: items whose actions run in their own transition with pending state, optimistic checkbox and radio items, the APG keyboard model with typeahead, and submenus with hover intent."
    >
      <p className="page-intro">
        The WAI-ARIA menu button. There is no native menu element, so the platform gives the popover
        half (<code>popover="auto"</code>: the top layer, light dismiss, Escape, nesting for
        submenus, placement next to the trigger, focus return) and the library gives the menu half:
        the current item, arrow keys, Home and End, typeahead, submenu keys and closing the menu
        when focus leaves it. And the asynchronous half: an item's <code>action</code> runs in a
        transition with <code>data-pending</code> on the item, and the menu closes in the commit
        that ends it, so a slow Server Function behind "Archive" shows its progress where the user
        clicked and the menu leaves with a view transition in every engine.
      </p>

      <Example file="MenuRowActions.tsx" css="menu.css">
        <MenuRowActions />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Menu } from "@funstack/ui/menu";

<Menu.Root>                                                {/* no DOM: ids, open state */}
  <Menu.Trigger>Actions</Menu.Trigger>                     {/* button[popovertarget][aria-haspopup=menu] */}
  <Menu.Popup>                                             {/* div[popover=auto][role=menu] */}
    <Menu.Item action={rename}>Rename</Menu.Item>          {/* button[role=menuitem] */}
    <Menu.Separator />                                     {/* hr */}
    <Menu.Group>                                           {/* div[role=group] */}
      <Menu.GroupLabel>View</Menu.GroupLabel>
      <Menu.CheckboxItem checked={dense} checkedChangeAction={saveDense}>Dense</Menu.CheckboxItem>
      <Menu.RadioGroup value={sort} valueChangeAction={saveSort}>
        <Menu.RadioItem value="name">By name</Menu.RadioItem>
        <Menu.RadioItem value="date">By date</Menu.RadioItem>
      </Menu.RadioGroup>
    </Menu.Group>
    <Menu.Root>                                            {/* a Root inside a Popup: a submenu */}
      <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>   {/* button[role=menuitem][aria-haspopup=menu] */}
      <Menu.Popup>…</Menu.Popup>                           {/* opens to the right */}
    </Menu.Root>
  </Menu.Popup>
</Menu.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>
            Always <a href="/concepts/browser-owned-state#js-free-mode">library mode</a>.
          </strong>{" "}
          A menu cannot follow the APG without JavaScript, so there is no JS-free mode. The Trigger
          still renders <code>popovertarget</code>: a click before hydration opens the (still empty)
          menu natively and the items fill in on hydration (<code>reason: "platform"</code>).
        </li>
        <li>
          <strong>Items are buttons</strong> with explicit roles, <code>tabindex="-1"</code> and{" "}
          <code>type="button"</code>. <code>render</code> can substitute a link (
          <code>{'render={<a href="/new" />}'}</code>): Enter clicks it, so it navigates and runs
          the item's action.
        </li>
        <li>
          <strong>A submenu is a nested Root</strong> whose trigger is a{" "}
          <code>Menu.SubmenuTrigger</code>, an item of the parent menu. Submenus are DOM descendants
          of their parent popup: nothing is portalled.
        </li>
        <li>
          No Portal, Positioner, Arrow or Close part. A "Cancel" item is an <code>Item</code> with
          no <code>action</code>: activating it only closes. The Trigger names the menu (
          <code>aria-labelledby</code>).
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <h4>Items, actions and closing</h4>
      <p>
        Click, Enter or Space on an <code>Item</code> runs its <code>action</code> in the item's own
        transition. The menu <strong>stays open while the action runs</strong>, with{" "}
        <code>data-pending</code> on the item, and closes once it settles, through the top-level
        Root (<code>openChangeAction(false, {'{ reason: "activate" }'})</code>, then{" "}
        <code>hidePopover()</code> in the commit, with a view transition if the Popup has{" "}
        <code>transition</code>). A synchronous action closes in the same tick. A rejection leaves
        the menu open and reaches the nearest Error Boundary above the item. A second click, Enter
        or Space while the action is pending is ignored (and cancelled), and the item is{" "}
        <code>aria-disabled="true"</code> meanwhile. A pending item is an ordinary item for
        navigation; only the open focus skips items with the <code>disabled</code> prop (
        <code>data-disabled</code>). For "close now, work in the background" do not return the
        promise: <code>{"action={() => { void archive(id); }}"}</code>.
      </p>
      <ul>
        <li>
          <code>closeOnActivate={"{false}"}</code> keeps the menu open (a "Refresh" item).
        </li>
        <li>
          A <a href="/components/button">Button</a> inside a <code>Menu.Popup</code> is not a menu
          item: no <code>role="menuitem"</code>, not in the arrow-key set, and it does not close the
          menu. Use <code>Menu.Item</code> for actions in a menu.
        </li>
        <li>
          Activating an item in a submenu closes the whole stack: the top-level Root gets{" "}
          <code>"activate"</code>, each submenu Root <code>"dismiss"</code>. The submenu disappears
          at once (it is hidden as a nested popover); the top-level menu animates.
        </li>
        <li>
          If the menu was dismissed and opened again while an action ran, that action's close is
          dropped: it belonged to the previous opening. The re-open itself does not show until that
          action settles: React holds transitions started while an async action is pending, so
          meanwhile the Trigger shows <code>data-open</code> and <code>data-pending</code> without a
          menu (it stays exposed as collapsed: no menu is shown). A slow Server Function behind an
          item makes this visible (Popover's <code>Close</code> behaves the same).
        </li>
        <li>
          Keyboard activation goes through the item's <code>click()</code>, so{" "}
          <code>details.event</code> is a <code>click</code> event for pointer and keyboard alike,
          and an item composed with another trigger (
          <code>{"<Dialog.Trigger render={<Menu.Item closeOnActivate={false} />}>"}</code>) runs its
          command.
        </li>
      </ul>

      <h4>Checkbox and radio items</h4>
      <Example file="MenuViewOptions.tsx" css="menu.css">
        <MenuViewOptions />
      </Example>
      <p>
        <code>CheckboxItem</code> and <code>RadioGroup</code> are{" "}
        <a href="/concepts/pending-and-optimistic#state-owner">state owners</a> like{" "}
        <a href="/components/checkbox">Checkbox</a> and{" "}
        <a href="/components/radio-group">RadioGroup</a>: <code>aria-checked</code> and{" "}
        <code>data-checked</code> flip at once, <code>data-pending</code> shows while the change
        action runs (on the item and on the <code>RadioGroup</code>), and a rejection rolls the
        check back. They <strong>keep the menu open</strong> by default (the APG's Space rule, and
        toggling several options is the point); <code>closeOnActivate</code> closes the menu after
        the change settles. Re-activating the selected radio item dispatches nothing; with{" "}
        <code>closeOnActivate</code> it still closes the menu.
      </p>
      <Callout kind="warning" title="Uncontrolled state lives with the items">
        <p>
          By default the items unmount when the menu closes, and uncontrolled checkbox and radio
          state goes with them. Control them (as above), or give the Popup <code>keepMounted</code>.
        </p>
      </Callout>

      <h4>Context menus</h4>
      <p>
        A <code>Menu.ContextTrigger</code> in the Root opens the same Popup at the pointer from a
        right-click, Shift+F10 or a touch long-press, next to (or instead of) the Trigger: see{" "}
        <a href="/components/context-menu">Context menu</a>. Two behaviours apply to every menu,
        context-opened or not: a right- or middle-click outside closes it at once (
        <code>"dismiss"</code>), as native menus do; Chromium's light dismiss alone would leave it
        open under the browser's own menu. And a wheel over the menu never scrolls the page under
        it: the library prevents it unless the menu itself can scroll that way (Ctrl+wheel and a
        trackpad pinch still zoom).
      </p>

      <h3 id="props">Props</h3>
      <h4>
        <code>Menu.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "open",
            type: "boolean",
            description: "Controlled open state. undefined means uncontrolled.",
          },
          {
            name: "defaultOpen",
            type: "boolean",
            description: "Initial open state when uncontrolled. Shown after hydration.",
          },
          {
            name: "openChangeAction",
            type: "ChangeAction<boolean, MenuOpenChangeDetails>",
            description: (
              <>
                Awaited for <code>true</code> (the menu opens when it resolves and the items have
                rendered) and for the closes a part asks for (the Trigger, an item's activation,
                ArrowLeft in a submenu); the menu stays shown until the action settles, with{" "}
                <code>data-pending</code> on the Trigger meanwhile. A notification for dismissals
                (Escape, a click outside, Tab, the pointer leaving a hover-opened submenu, the
                parent menu closing). Runs in the Root's transition; may be a Server Function.{" "}
                <code>details.reason</code>: <code>"activate"</code>, <code>"dismiss"</code> or{" "}
                <code>"platform"</code> (found open on hydration; <code>event</code> is{" "}
                <code>undefined</code>). A <code>popovertarget</code> or <code>commandfor</code>{" "}
                button of your own for the popup closes it as <code>"activate"</code> (a
                notification) and never moves focus out of the menu.
              </>
            ),
          },
          {
            name: "loop",
            type: "boolean",
            default: "true",
            description: "ArrowDown / ArrowUp wrap from the last item to the first and back.",
          },
          {
            name: "delay",
            type: "number",
            default: "100",
            description:
              "Submenu only: milliseconds from hovering the SubmenuTrigger to the open. A development warning on a top-level Root.",
          },
          {
            name: "closeDelay",
            type: "number",
            default: "150",
            description:
              "Submenu only: milliseconds from the pointer leaving the SubmenuTrigger and the submenu to the close.",
          },
          {
            name: "children",
            type: "ReactNode | ((state: MenuRootState) => ReactNode)",
            description:
              "The parts. The function form receives the optimistic state and must not suspend.",
          },
        ]}
      />
      <PartFacts
        state={
          "`MenuRootState` is `{ open, pending, submenu, context }`; `open` is optimistic; `submenu` is true for a Root rendered inside a `Menu.Popup`; `context` is true while the open came from a [`Menu.ContextTrigger`](/components/context-menu)."
        }
        owned={"nothing rendered: the Root has no element."}
      />

      <h4>
        <code>Menu.Trigger</code>
      </h4>
      <p>
        One per Root: only one Trigger is the menu's anchor and focus-return target, and a press on
        another while open counts as outside it. A second <code>Menu.Trigger</code> in the same Root
        is not supported (development warns); use a Root per trigger.
      </p>
      <PropsTable
        rows={[
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Native `disabled`. Owned, so a `render` element cannot re-enable it. With a link or component `render`, `aria-disabled="true"` instead (the element stays focusable); a click, Enter and the arrow keys do not open.',
          },
          ...functionProps("MenuTriggerState", "Rendered from optimistic state; must not suspend."),
          renderProp("button", "MenuTriggerState"),
        ]}
      />
      <PartFacts
        state={"`MenuTriggerState` is `{ open, pending, disabled }`."}
        owned={
          "`type` (on a `<button>` only), `id`, `disabled`, `aria-disabled` (link or component `render`), `popoverTarget` (not on a host element other than a `<button>`), `popoverTargetAction` (never written), `aria-haspopup`, `aria-expanded` (rendered only without `popoverTarget`), `onClick`, `onKeyDown`, `onMouseDown` (a primary-button press while the menu is open keeps focus on the current item), `data-open`, `data-pending`, `data-disabled`. `commandfor` and `command` are owned too (never written: an Invoker Command would take precedence over `popovertarget`) and omitted from the props type."
        }
        note={
          "Use it in a top-level Root only. A `<button>` Trigger renders no `aria-expanded`: the browser exposes the shown menu's state on a `popovertarget` invoker ([#121](https://github.com/uhyo/funstack-ui/issues/121)); a link or other non-button element (or a disabled component `render`) renders it."
        }
      />

      <h4>
        <code>Menu.Popup</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "side",
            type: '"top" | "bottom" | "left" | "right" | "inline-start" | "inline-end" | null',
            default: '"bottom" ("inline-end" in a submenu)',
            description:
              "Placement through inline `position-area`, with `position-try-fallbacks` flipping it (a submenu flips inline only). `inline-start` / `inline-end` follow the popup's direction: a submenu opens on the right of its item in LTR and on the left in RTL, the side the arrow keys point to. `left` / `right` stay physical. `null` emits no inline placement and no `data-side` / `data-align`. Ignored for an open from a [Menu.ContextTrigger](/components/context-menu), which is placed at the pointer; there `null` opts out of the inline point placement too.",
          },
          {
            name: "align",
            type: '"start" | "center" | "end"',
            default: '"start"',
            description:
              "Alignment along the side. On a top / bottom side `start` / `end` are inline-relative (`start` lines up the inline-start edges: the left in LTR, the right in RTL); on the other sides the top / bottom edges.",
          },
          {
            name: "keepMounted",
            type: "boolean",
            default: "false",
            description:
              'false: the items render only while open (items that suspend hold the open, with `data-pending` on the Trigger). true: they stay mounted in `<Activity mode="hidden">`.',
          },
          {
            name: "experimental_focusgroup",
            type: "boolean",
            default: "false",
            description:
              'Renders `focusgroup="menu wrap|nowrap"`. Where the engine implements it (Chromium 150+), the browser moves focus for ArrowUp / ArrowDown / Home / End and items render no `tabindex`; elsewhere nothing changes. Typeahead, activation, submenu keys and Tab stay in JS.',
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Forwarded to a `<ViewTransition>` around the popup element: animates the open and every library-driven close (an item's activation, the Trigger, ArrowLeft, a hover close, controlled) in every engine. Dismissals animate with CSS only.",
          },
          ...functionProps("MenuPopupState"),
          renderProp("div", "MenuPopupState"),
        ]}
      />
      <PartFacts
        state={
          "`MenuPopupState` is `{ open, side, align, submenu, context }`; `open` is committed; `context` is true and `side` is `null` for an open from a `Menu.ContextTrigger`. While the menu is shown, `side` / `align` are where the browser placed it (a physical side, after any flip: a submenu reads `right` in LTR and `left` in RTL); otherwise your props."
        }
        owned={
          '`id`, `popover`, `role` (`"menu"`), `aria-labelledby` (token-merged), `tabIndex` (`-1`), `focusgroup` (with the flag), `onKeyDown`, `onBlur`, `onMouseDown` (a press outside the items keeps focus on the current item), `onContextMenu` (no browser menu over this one), `onPointerEnter`, `onPointerLeave`, `data-side` / `data-align` (unless `side` is `null`), `data-context`, and for a context open the inline `--menu-point-x` / `--menu-point-y` / `--menu-point-gap`, the inline `top` and `left` (`right` in RTL) and the hoisted `@position-try` stylesheet.'
        }
        note={
          "A menu shown on the physical side you asked for costs no render for the placement; a logical side (every submenu, by default `inline-end`) costs one render on show and one on hide, since `data-side` turns physical while shown. Style it with `:popover-open`; it emits no `data-open`. Render a `<div>`, not a `<dialog>`."
        }
      />

      <h4>
        <code>Menu.Item</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "action",
            type: "Action<[details: MenuItemDetails]>",
            description:
              'Runs in the item\'s own transition (`data-pending` on the item); the menu closes when it settles. A second activation while it is pending is ignored, and the item is `aria-disabled="true"` meanwhile. May be a Server Function (`details.event` is virtual). A rejection keeps the menu open and reaches the nearest Error Boundary above the item.',
          },
          ...itemRows("MenuItemState", "true", "Close the whole menu once `action` settles."),
        ]}
      />
      <PartFacts
        state={"`MenuItemState` is `{ pending, disabled }`."}
        owned={
          "`type` (on a `<button>`), `role`, `tabIndex`, `disabled` (always absent), `aria-disabled` (the `disabled` prop, or while pending), `onClick`, `onKeyDown`, `onPointerMove`, `data-pending`, `data-disabled`, `data-typeahead`."
        }
      />

      <h4>
        <code>Menu.CheckboxItem</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "checked",
            type: "boolean",
            description: "Controlled checked state. undefined means uncontrolled.",
          },
          {
            name: "defaultChecked",
            type: "boolean",
            default: "false",
            description: "Initial checked state when uncontrolled.",
          },
          {
            name: "checkedChangeAction",
            type: "ChangeAction<boolean>",
            description:
              "Awaited in the item's transition; `aria-checked` flips at once and rolls back on rejection. May be a Server Function.",
          },
          ...itemRows(
            "MenuCheckboxItemState",
            "false",
            "Close the whole menu once the change settles.",
          ),
        ]}
      />
      <PartFacts
        state={
          "`MenuCheckboxItemState` is `{ checked, pending, disabled }`; `checked` is optimistic."
        }
        owned={
          'those of `Menu.Item`, plus `role` (`"menuitemcheckbox"`), `aria-checked`, `data-checked`.'
        }
        note={"Transition types `fsui-menu` with `fsui-menu-check` or `fsui-menu-uncheck`."}
      />

      <h4>
        <code>Menu.RadioGroup</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string | null",
            description: "Controlled value; null selects nothing, undefined means uncontrolled.",
          },
          {
            name: "defaultValue",
            type: "string | null",
            default: "null",
            description: "Initial value when uncontrolled.",
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<string>",
            description:
              "Receives the chosen item's value, awaited in the group's transition. May be a Server Function.",
          },
          ...functionProps("MenuRadioGroupState", "The RadioItems and a GroupLabel."),
          renderProp("div", "MenuRadioGroupState"),
        ]}
      />
      <PartFacts
        state={"`MenuRadioGroupState` is `{ value, pending }`."}
        owned={
          '`role` (`"group"`), `aria-labelledby` (token-merged: a `GroupLabel` inside it), `data-pending`.'
        }
        note={"Transition types `fsui-menu`, `fsui-menu-select`."}
      />

      <h4>
        <code>Menu.RadioItem</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description: "Required. The value this item selects.",
          },
          ...itemRows(
            "MenuRadioItemState",
            "false",
            "Close the whole menu once the change settles (also when the item was already selected).",
          ),
        ]}
      />
      <PartFacts
        state={
          "`MenuRadioItemState` is `{ value, checked, pending, disabled }`; `value` is the item's own `value` prop; `pending` is true on the item being selected."
        }
        owned={
          'those of `Menu.Item`, plus `role` (`"menuitemradio"`), `aria-checked`, `data-checked`, and `value` (not rendered: a menu item is not a form control).'
        }
        note={"A `RadioItem` outside a `RadioGroup` throws."}
      />

      <h4>
        <code>Menu.Group</code>, <code>Menu.GroupLabel</code>, <code>Menu.Separator</code>
      </h4>
      <p>
        <code>Group</code> is a <code>{'<div role="group">'}</code> labelled by its{" "}
        <code>GroupLabel</code> (a <code>&lt;div&gt;</code> with the owned <code>id</code>), which
        also names a <code>RadioGroup</code>. <code>Separator</code> is an <code>&lt;hr&gt;</code>{" "}
        (implicit <code>role="separator"</code>); give a <code>render</code> element{" "}
        <code>role="separator"</code> yourself. All take <code>className</code>, <code>style</code>,{" "}
        <code>render</code> and (except <code>Separator</code>) <code>children</code>; they have no
        state.
      </p>

      <h4>
        <code>Menu.SubmenuTrigger</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "`aria-disabled`: focusable, never opens. Not the native attribute (it is an item).",
          },
          {
            name: "label",
            type: "string",
            description: "Typeahead text, as on `Menu.Item`.",
          },
          ...functionProps(
            "MenuSubmenuTriggerState",
            "Rendered from optimistic state; must not suspend.",
          ),
          renderProp("button", "MenuSubmenuTriggerState"),
        ]}
      />
      <PartFacts
        state={"`MenuSubmenuTriggerState` is `{ open, pending, disabled }`, as the Trigger."}
        owned={
          "the Trigger's (`type`, `id`, `popoverTarget` (not on a host element other than a `<button>`), `popoverTargetAction`, `aria-haspopup`, `aria-expanded` (rendered only without `popoverTarget`), `data-open`, `data-pending`; `commandfor` and `command`, never written) and the item's (`role`, `tabIndex`, `disabled` (absent), `aria-disabled`, `data-disabled`, `data-typeahead`, `onClick`, `onKeyDown`, `onPointerMove`, `onPointerEnter`, `onPointerLeave`)."
        }
        note={
          "Both an item of the parent menu (roving `tabindex`, typeahead) and the trigger of its Root; `data-pending` while items that suspend load. Use it in a submenu Root only."
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Hook", "On", "Meaning"]}
        rows={[
          ["`data-open`", "Trigger, SubmenuTrigger", "Optimistic open state of the Root."],
          [
            "`aria-expanded`",
            "Trigger, SubmenuTrigger (a link or other non-button element, or a disabled component `render`, only)",
            "Whether the menu is shown (mirrored from its `toggle` event, not optimistic). A `<button>` has none: the browser exposes the state.",
          ],
          [
            "`data-open`",
            "ContextTrigger",
            "Optimistic open state of the Root (no `aria-expanded`: the region has no role).",
          ],
          [
            "`data-pending`",
            "Trigger, SubmenuTrigger, ContextTrigger",
            "An open or close of the Root is in flight (items that suspend hold the open).",
          ],
          [
            "`data-pending`",
            "Item, CheckboxItem, RadioItem, RadioGroup",
            "The item's `action` or change action is in flight; on the RadioGroup while a selection is.",
          ],
          [
            "`aria-disabled`",
            "Item, CheckboxItem, RadioItem, SubmenuTrigger",
            '`"true"` for the `disabled` prop (items are never natively disabled), and on an Item while its `action` is pending.',
          ],
          ["`data-disabled`", "Trigger, items, ContextTrigger", "The `disabled` prop."],
          [
            "`aria-checked`, `data-checked`",
            "CheckboxItem, RadioItem",
            "Optimistic checked state.",
          ],
          [
            "`data-typeahead`",
            "Item, CheckboxItem, RadioItem, SubmenuTrigger",
            "The `label` prop: the text typeahead matches.",
          ],
          [
            "`:popover-open`",
            "Popup",
            "The menu is shown. Browser-owned: the Popup emits no `data-open`.",
          ],
          [
            "`data-side`, `data-align`",
            "Popup",
            "While shown, where the browser placed the popup (after any flip); otherwise the requested placement. Absent for an open from a `Menu.ContextTrigger`.",
          ],
          [
            "`data-context`",
            "Popup",
            "The current open came from a `Menu.ContextTrigger` and is placed at a point (see [Context menu](/components/context-menu)).",
          ],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Where", "Behaviour"]}
        rows={[
          [
            "Enter, Space, ArrowDown",
            "Trigger",
            "Open with the first enabled item focused (ArrowDown on an open menu focuses it)",
          ],
          ["ArrowUp", "Trigger", "Open with the last enabled item focused"],
          [
            "ArrowDown / ArrowUp",
            "item",
            "Next / previous item, disabled ones included; wraps unless `loop={false}`",
          ],
          ["Home / End", "item", "First / last item"],
          [
            "A printable character",
            "item",
            "Typeahead: the next item starting with it; repeat to cycle; type a prefix within 500 ms",
          ],
          ["Enter / Space", "item", "Activate (Space is a character while typeahead is active)"],
          ["ArrowRight", "SubmenuTrigger", "Open the submenu with its first item focused"],
          ["ArrowLeft", "item in a submenu", "Close the submenu; focus returns to its trigger"],
          [
            "Escape",
            "anywhere",
            "Close the innermost menu; focus returns to its trigger (the library does it for a submenu)",
          ],
          [
            "Tab / Shift+Tab",
            "item",
            "Close the whole menu at once and move on (Shift+Tab lands on the Trigger)",
          ],
        ]}
      />
      <ul>
        <li>
          Under <code>direction: rtl</code> ArrowLeft opens and ArrowRight closes a submenu, and the
          submenu opens on the left of its item (the default <code>side="inline-end"</code>); the
          top-level menu's <code>align="start"</code> lines up the right edges. Both follow the
          popup's inherited direction through <code>self-*</code> <code>position-area</code>{" "}
          keywords, so an RTL container works as well as an RTL page. Firefox misplaces popups
          inside a direction island (<a href="https://github.com/uhyo/funstack-ui/issues/89">#89</a>
          ; see <a href="/components/tooltip#browser-notes">Tooltip</a>).
        </li>
        <li>
          <strong>Focus is real DOM focus</strong> on items (no <code>aria-activedescendant</code>).
          Every open focuses the first item, pointer opens included (no focus ring then, through{" "}
          <code>{"focus({ focusVisible: false })"}</code>; Safari may still show a ring on the first
          item after a click); a submenu opened by hover keeps focus on its trigger.{" "}
          <strong>Moving the pointer over an item focuses it</strong>, so keyboard and pointer
          always agree on the current item: style <code>:focus</code> as the hover state. A press on
          the menu's own space (padding, a <code>Separator</code>, a <code>GroupLabel</code>) keeps
          focus on the current item, so the arrow keys keep working. So does a press on a{" "}
          <code>&lt;button&gt;</code> Trigger while the menu is open: the click then closes it like
          an item's activation, on every browser (a Trigger rendered as another element is
          light-dismissed first, <a href="https://github.com/uhyo/funstack-ui/issues/115">#115</a>).
        </li>
        <li>
          <strong>Hover intent</strong> for submenus: the submenu opens <code>delay</code> ms (100)
          after the pointer enters its trigger and closes <code>closeDelay</code> ms (150) after the
          pointer leaves both, unless keyboard focus is inside it. Touch never opens on hover.
        </li>
        <li>
          <strong>Tab closes immediately</strong>, without awaiting <code>openChangeAction</code>: a
          menu must not linger once focus has moved on. It is notified as <code>"dismiss"</code>.
        </li>
        <li>
          <strong>ARIA:</strong> the Trigger has <code>aria-haspopup="menu"</code> and is a{" "}
          <code>popovertarget</code> invoker, which every engine exposes as expanded or collapsed
          from the menu itself, so it renders no <code>aria-expanded</code> (the SubmenuTrigger
          alike); the Popup <code>role="menu"</code> and <code>aria-labelledby</code> pointing at
          its trigger; items their roles and <code>aria-checked</code> / <code>aria-disabled</code>.
        </li>
      </ul>

      <h4>Inside a Toolbar</h4>
      <p>
        A <code>Menu.Trigger</code> inside a <a href="/components/toolbar">Toolbar</a> opens on the
        arrow key perpendicular to the toolbar's, leaving the toolbar's own arrows to it. Enter and
        Space open it in every case. In a vertical toolbar, put the popup beside it on the
        inline-end side: <code>side="inline-end"</code> (the right in LTR, the left under{" "}
        <code>direction: rtl</code>).
      </p>
      <Table
        head={[
          "Context",
          "Opens with the first item",
          "Opens with the last item",
          "Left to the Toolbar",
        ]}
        rows={[
          ["No toolbar", "ArrowDown", "ArrowUp", "–"],
          ["Horizontal Toolbar", "ArrowDown", "ArrowUp", "ArrowLeft / ArrowRight"],
          [
            "Vertical Toolbar",
            "ArrowRight (ArrowLeft under `direction: rtl`)",
            "–",
            "ArrowDown / ArrowUp",
          ],
        ]}
      />

      <BehaviourSection
        id="transition-types"
        summary={
          "Opens and closes: `fsui-menu` plus `fsui-menu-open` or `fsui-menu-close`. A CheckboxItem: `fsui-menu` plus `fsui-menu-check` or `fsui-menu-uncheck`. A RadioGroup: `fsui-menu` plus `fsui-menu-select`."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "The Trigger's `data-open` and CheckboxItem and RadioItem `data-checked` are optimistic; the state the browser exposes on the Trigger follows the shown menu. Items render from the committed open state. An Item is a [pure trigger](/concepts/pending-and-optimistic#pure-trigger): `data-pending` while its action runs, and a second activation is ignored."
        }
      />

      <BehaviourSection
        id="suspense"
        summary={
          "Items that suspend hold the open: the menu (or submenu) stays closed with `data-pending` on its trigger, then opens once, complete, with the first item focused."
        }
      >
        <p>
          The items render from committed state, so a submenu read with <code>use()</code>:
        </p>
        <CodeBlock>{`<Menu.Root>
  <Menu.SubmenuTrigger>Open recent</Menu.SubmenuTrigger>
  <Menu.Popup>
    <RecentFiles />   {/* use(recentFiles): the submenu opens when ready */}
  </Menu.Popup>
</Menu.Root>`}</CodeBlock>
      </BehaviourSection>

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'The popup is a `popover="auto"`: the top layer, light dismiss and Escape are the browser\'s. A dismissal closes the menu at once; `openChangeAction(false)` is a notification with `reason: "dismiss"`, and it animates with CSS only.'
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'The Trigger carries `popovertarget`: a click before hydration opens the (still empty) menu natively, and the items fill in on hydration (`reason: "platform"`).'
        }
      />

      <h3 id="styling">Styling</h3>
      <p>
        Style the popup with <code>:popover-open</code> and the items with{" "}
        <code>[role^="menuitem"]</code>, <code>:focus</code>, <code>[aria-disabled="true"]</code>,{" "}
        <code>[data-pending]</code> and <code>[data-checked]</code>. Dismissals animate with CSS (
        <code>@starting-style</code> and <code>transition-behavior: allow-discrete</code>; Firefox
        hides a popover instantly). Library-driven opens and closes animate with{" "}
        <code>transition</code> on the Popup in every engine, transition types{" "}
        <code>fsui-menu</code> plus <code>fsui-menu-open</code> or <code>fsui-menu-close</code>.
        Keep them short: the page takes no pointer events during a view transition.
      </p>
      <CodeBlock>{`<Menu.Popup transition={{ "fsui-menu-open": "menu-in", "fsui-menu-close": "menu-out", default: "none" }}>`}</CodeBlock>

      <h3 id="browser-notes">Browser notes</h3>
      <ul>
        <li>
          <code>experimental_focusgroup</code> takes the native path in Chromium only; other engines
          keep the JS arrow keys (identical behaviour).
        </li>
        <li>
          Safari: a nested popover with <code>position-try-fallbacks</code> can hang (WebKit bug
          302008). If a submenu hits it, give its Popup <code>side={"{null}"}</code> and place it in
          CSS.
        </li>
        <li>Menubars are not part of Menu.</li>
      </ul>
    </DocPage>
  );
}
