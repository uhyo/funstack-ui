import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { MenuRowActions } from "../examples/MenuRowActions.js";
import menuRowActionsSource from "../examples/MenuRowActions.tsx?raw";
import { MenuViewOptions } from "../examples/MenuViewOptions.js";
import menuViewOptionsSource from "../examples/MenuViewOptions.tsx?raw";
import menuCss from "../examples/menu.css?raw";
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
    <div className="learn-content">
      <PageHead
        title="Menu"
        description="A menu button on the Popover API: items whose actions run in their own transition with pending state, optimistic checkbox and radio items, the APG keyboard model with typeahead, and submenus with hover intent."
      />
      <h2>Menu</h2>
      <p className="page-intro">
        The WAI-ARIA menu button. There is no native menu element, so the platform gives the popover
        half (<code>popover="auto"</code>: the top layer, light dismiss, Escape, nesting for
        submenus, placement next to the trigger, focus return) and the library gives the menu half:
        the current item, arrow keys, Home and End, typeahead, submenu keys and closing the menu
        when focus leaves it. And the Async React half: an item's <code>action</code> runs in a
        transition with <code>data-pending</code> on the item, and the menu closes in the commit
        that ends it, so a slow Server Function behind "Archive" shows its progress where the user
        clicked and the menu leaves with a view transition in every engine.
      </p>

      <Example
        source={menuRowActionsSource}
        fileName="MenuRowActions.tsx"
        css={menuCss}
        cssFileName="menu.css"
      >
        <MenuRowActions />
      </Example>

      <h3>Anatomy</h3>
      <CodeBlock>{`import { Menu } from "@funstack/ui/menu";

<Menu.Root>                                                {/* no DOM: ids, open state */}
  <Menu.Trigger>Actions</Menu.Trigger>                     {/* button[commandfor][aria-haspopup=menu] */}
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
          <strong>Always library mode.</strong> A menu cannot follow the APG without JavaScript, so
          there is no JS-free mode. The Trigger still renders <code>commandfor</code> +{" "}
          <code>command="toggle-popover"</code>: a click before hydration opens the (still empty)
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

      <h3>Items, actions and closing</h3>
      <p>
        Click, Enter or Space on an <code>Item</code> runs its <code>action</code> in the item's own
        transition. The menu <strong>stays open while the action runs</strong>, with{" "}
        <code>data-pending</code> on the item, and closes once it settles, through the top-level
        Root (<code>openChangeAction(false, {'{ reason: "activate" }'})</code>, then{" "}
        <code>hidePopover()</code> in the commit, with a view transition if the Popup has{" "}
        <code>transition</code>). A synchronous action closes in the same tick. A rejection leaves
        the menu open and reaches the nearest Error Boundary above the item. A second click re-runs
        the action; the first close wins. For "close now, work in the background" do not return the
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
          meanwhile the Trigger shows <code>aria-expanded="true"</code> and{" "}
          <code>data-pending</code> without a menu. A slow Server Function behind an item makes this
          visible (Popover's <code>Close</code> behaves the same).
        </li>
        <li>
          Keyboard activation goes through the item's <code>click()</code>, so{" "}
          <code>details.event</code> is a <code>click</code> event for pointer and keyboard alike,
          and an item composed with another trigger (
          <code>{"<Dialog.Trigger render={<Menu.Item closeOnActivate={false} />}>"}</code>) runs its
          command.
        </li>
      </ul>

      <h3>Checkbox and radio items</h3>
      <Example
        source={menuViewOptionsSource}
        fileName="MenuViewOptions.tsx"
        css={menuCss}
        cssFileName="menu.css"
      >
        <MenuViewOptions />
      </Example>
      <p>
        <code>CheckboxItem</code> and <code>RadioGroup</code> are state owners like{" "}
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

      <h3>Props</h3>
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
                ArrowLeft in a submenu). A notification for dismissals (Escape, a click outside,
                Tab, the pointer leaving a hover-opened submenu, the parent menu closing). Runs in
                the Root's transition; may be a Server Function. <code>details.reason</code>:{" "}
                <code>"activate"</code>, <code>"dismiss"</code> or <code>"platform"</code> (found
                open on hydration; <code>event</code> is <code>undefined</code>).
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
      <p>
        <code>MenuRootState</code>: <code>{"{ open, pending, submenu }"}</code>. <code>open</code>{" "}
        is optimistic; <code>submenu</code> is true for a Root rendered inside a{" "}
        <code>Menu.Popup</code>.
      </p>

      <h4>
        <code>Menu.Trigger</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Native `disabled`. Owned, so a `render` element cannot re-enable it.",
          },
          ...functionProps("MenuTriggerState", "Rendered from optimistic state; must not suspend."),
          renderProp("button", "MenuTriggerState"),
        ]}
      />
      <p>
        <code>MenuTriggerState</code>: <code>{"{ open, pending, disabled }"}</code>. Emits{" "}
        <code>aria-expanded</code> and <code>data-open</code> (optimistic),{" "}
        <code>data-pending</code> (an open or close of the Root in flight) and{" "}
        <code>data-disabled</code>. Owns <code>type</code>, <code>id</code>, <code>disabled</code>,{" "}
        <code>commandfor</code>, <code>command</code>, <code>aria-haspopup</code>,{" "}
        <code>aria-expanded</code>, <code>onClick</code> and <code>onKeyDown</code>. Use it in a
        top-level Root only.
      </p>

      <h4>
        <code>Menu.Popup</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "side",
            type: '"top" | "bottom" | "left" | "right" | null',
            default: '"bottom" ("right" in a submenu)',
            description:
              "Placement through inline `position-area`, with `position-try-fallbacks` flipping it (a submenu flips inline only). `null` emits no inline placement and no `data-side` / `data-align`.",
          },
          {
            name: "align",
            type: '"start" | "center" | "end"',
            default: '"start"',
            description: "Alignment along the side.",
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
      <p>
        <code>MenuPopupState</code>: <code>{"{ open, side, align, submenu }"}</code> (committed{" "}
        <code>open</code>). Owns <code>id</code>, <code>popover</code>, <code>role="menu"</code>,{" "}
        <code>aria-labelledby</code> (merged), <code>tabIndex={"{-1}"}</code>,{" "}
        <code>focusgroup</code> (with the flag), <code>onKeyDown</code>, <code>onBlur</code>,{" "}
        <code>onMouseDown</code> (a press outside the items keeps focus on the current item),{" "}
        <code>onPointerEnter</code>, <code>onPointerLeave</code>, and <code>data-side</code> /{" "}
        <code>data-align</code>. Style it with <code>:popover-open</code>; it emits no{" "}
        <code>data-open</code>. Render a <code>&lt;div&gt;</code>, not a <code>&lt;dialog&gt;</code>
        .
      </p>

      <h4>
        <code>Menu.Item</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "action",
            type: "Action<[details: MenuItemDetails]>",
            description:
              "Runs in the item's own transition (`data-pending` on the item); the menu closes when it settles. May be a Server Function (`details.event` is virtual). A rejection keeps the menu open and reaches the nearest Error Boundary above the item.",
          },
          ...itemRows("MenuItemState", "true", "Close the whole menu once `action` settles."),
        ]}
      />
      <p>
        <code>MenuItemState</code>: <code>{"{ pending, disabled }"}</code>. Owns <code>type</code>{" "}
        (on a button), <code>role</code>, <code>tabIndex</code>, <code>disabled</code> (always
        absent), <code>aria-disabled</code>, <code>onClick</code>, <code>onKeyDown</code>,{" "}
        <code>onPointerMove</code>, <code>data-pending</code>, <code>data-disabled</code> and{" "}
        <code>data-typeahead</code>.
      </p>

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
      <p>
        <code>MenuCheckboxItemState</code>: <code>{"{ checked, pending, disabled }"}</code>. Emits{" "}
        <code>role="menuitemcheckbox"</code>, <code>aria-checked</code> and{" "}
        <code>data-checked</code> (optimistic). Transition types <code>fsui-menu</code> with{" "}
        <code>fsui-menu-check</code> or <code>fsui-menu-uncheck</code>.
      </p>

      <h4>
        <code>Menu.RadioGroup</code> and <code>Menu.RadioItem</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string | null",
            description:
              "RadioGroup. Controlled value; null selects nothing, undefined means uncontrolled.",
          },
          {
            name: "defaultValue",
            type: "string | null",
            default: "null",
            description: "RadioGroup. Initial value when uncontrolled.",
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<string>",
            description:
              "RadioGroup. Receives the chosen item's value, awaited in the group's transition. May be a Server Function.",
          },
          {
            name: "value",
            type: "string",
            description: "RadioItem (required). The value this item selects.",
          },
          ...itemRows(
            "MenuRadioItemState",
            "false",
            "RadioItem. Close the whole menu once the change settles (also when the item was already selected).",
          ),
        ]}
      />
      <p>
        <code>MenuRadioGroupState</code>: <code>{"{ value, pending }"}</code>; the group renders{" "}
        <code>{'<div role="group">'}</code> named by a <code>GroupLabel</code> inside it, with{" "}
        <code>data-pending</code>. <code>MenuRadioItemState</code>:{" "}
        <code>{"{ checked, pending, disabled }"}</code>; <code>pending</code> is true on the item
        being selected. A <code>RadioItem</code> outside a <code>RadioGroup</code> throws.
        Transition types <code>fsui-menu</code>, <code>fsui-menu-select</code>.
      </p>

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
      <p>
        <code>MenuSubmenuTriggerState</code>: <code>{"{ open, pending, disabled }"}</code>, as the
        Trigger. Both an item of the parent menu (<code>role="menuitem"</code>, roving{" "}
        <code>tabindex</code>, typeahead) and the trigger of its Root (<code>commandfor</code>,{" "}
        <code>aria-haspopup="menu"</code>, <code>aria-expanded</code>, <code>data-open</code>,{" "}
        <code>data-pending</code> while items that suspend load). Use it in a submenu Root only.
      </p>

      <h3>Keyboard, focus and ARIA</h3>
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
          Under <code>direction: rtl</code> ArrowLeft opens and ArrowRight closes a submenu.
        </li>
        <li>
          <strong>Focus is real DOM focus</strong> on items (no <code>aria-activedescendant</code>).
          Every open focuses the first item, pointer opens included (no focus ring then, through{" "}
          <code>{"focus({ focusVisible: false })"}</code>; Safari may still show a ring on the first
          item after a click); a submenu opened by hover keeps focus on its trigger.{" "}
          <strong>Moving the pointer over an item focuses it</strong>, so keyboard and pointer
          always agree on the current item: style <code>:focus</code> as the hover state. A press on
          the menu's own space (padding, a <code>Separator</code>, a <code>GroupLabel</code>) keeps
          focus on the current item, so the arrow keys keep working.
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
          <strong>ARIA:</strong> the Trigger has <code>aria-haspopup="menu"</code> and{" "}
          <code>aria-expanded</code>; the Popup <code>role="menu"</code> and{" "}
          <code>aria-labelledby</code> pointing at its trigger; items their roles and{" "}
          <code>aria-checked</code> / <code>aria-disabled</code>.
        </li>
      </ul>

      <h4>Inside a Toolbar</h4>
      <p>
        A <code>Menu.Trigger</code> inside a <a href="/components/toolbar">Toolbar</a> opens on the
        arrow key perpendicular to the toolbar's, leaving the toolbar's own arrows to it. Enter and
        Space open it in every case. In a vertical toolbar, put the popup beside it on the
        inline-end side: <code>side="right"</code>, or <code>side="left"</code> under{" "}
        <code>direction: rtl</code>.
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

      <h3>Styling and animation</h3>
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

      <h3>Suspense</h3>
      <p>
        The items render from committed state, so items that suspend (a submenu of recent files read
        with <code>use()</code>) hold the open: the menu (or submenu) stays closed with{" "}
        <code>data-pending</code> on its trigger, then opens once, complete, with the first item
        focused.
      </p>
      <CodeBlock>{`<Menu.Root>
  <Menu.SubmenuTrigger>Open recent</Menu.SubmenuTrigger>
  <Menu.Popup>
    <RecentFiles />   {/* use(recentFiles): the submenu opens when ready */}
  </Menu.Popup>
</Menu.Root>`}</CodeBlock>

      <h3>Browser notes</h3>
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
        <li>Context menus and menubars are not part of Menu.</li>
      </ul>
    </div>
  );
}
