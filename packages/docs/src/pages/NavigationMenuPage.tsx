import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { NavigationMenuRecent } from "../examples/NavigationMenuRecent.js";
import { NavigationMenuSite } from "../examples/NavigationMenuSite.js";
import { functionProps, renderProp } from "./shared-props.js";

export function NavigationMenuPage() {
  return (
    <DocPage
      title="NavigationMenu"
      description="A site's main navigation: a row of links and buttons that open panels of more links, built on the Popover API. It needs no JavaScript; a panel whose content loads on open is a transition."
    >
      <p className="page-intro">
        A site header: a row of links, some of which are buttons that open a panel of more links. It
        is the <strong>disclosure</strong> pattern, not a menu: no <code>menu</code> roles, no arrow
        keys, Tab moves through everything. Each panel is a <code>{"<div popover>"}</code> next to
        its <code>{"<button popovertarget>"}</code>, so the browser gives the toggle, the expanded
        state, Escape, light dismiss and one open panel at a time with{" "}
        <strong>no JavaScript</strong>: the default NavigationMenu works before and without
        hydration, and its links are in the server HTML. After hydration the library closes a panel
        when focus leaves it and when one of its links is followed. A panel whose content is worth
        loading late opts into library mode, where opening is a transition.
      </p>

      <Example file="NavigationMenuSite.tsx" css="navigation-menu.css">
        <NavigationMenuSite />
      </Example>
      <p>
        This example is a Server Component. Open a panel and press Tab: focus enters the panel's
        links, and leaving the last one closes it. Opening the other panel closes the first one;
        Escape and a click outside close it too. The links point at sections of this page.
      </p>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { NavigationMenu } from "@funstack/ui/navigation-menu";

<NavigationMenu.Root aria-label="Main">                          {/* nav */}
  <NavigationMenu.List>                                          {/* ul[role=list] */}
    <NavigationMenu.Item>                                        {/* li; owns one panel */}
      <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>  {/* button[popovertarget] */}
      <NavigationMenu.Popup>                                     {/* div[popover=auto] */}
        <ul>
          <li><NavigationMenu.Link href="/analytics">Analytics</NavigationMenu.Link></li>
          <li><NavigationMenu.Link href="/billing">Billing</NavigationMenu.Link></li>
        </ul>
      </NavigationMenu.Popup>
    </NavigationMenu.Item>
    <NavigationMenu.Item>
      <NavigationMenu.Link href="/pricing" aria-current="page">Pricing</NavigationMenu.Link>
    </NavigationMenu.Item>
  </NavigationMenu.List>
</NavigationMenu.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>Render the Popup immediately after its Trigger</strong>, in the same Item. Every
          engine then puts the panel's links right after the Trigger in the Tab order (Safari only
          when the two are adjacent). Development warns otherwise. One Trigger and one Popup per
          Item.
        </li>
        <li>
          <strong>The Item owns the open state</strong>, with the props of a{" "}
          <a href="/components/popover">Popover.Root</a>. There is no state on the Root: the
          platform keeps the panels exclusive, because sibling <code>auto</code> popovers close each
          other.
        </li>
        <li>
          <strong>Root and List are structure</strong>: the <code>nav</code> landmark (name it when
          the page has more than one) and a list with an explicit <code>role="list"</code>, which
          keeps its list semantics in Safari under <code>list-style: none</code>. Neither has a{" "}
          <code>"use client"</code> directive; Item, Trigger, Popup and Link are client components
          with serialisable props, so the whole navigation can be written in a Server Component.
        </li>
        <li>
          An Item with only a Link in it is a plain <code>li</code>: a top-level entry.
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <p>
        An Item with none of <code>open</code>, <code>defaultOpen</code>,{" "}
        <code>openChangeAction</code> and <code>onOpenChange</code> runs in{" "}
        <strong>JS-free mode</strong>: the browser toggles the panel and the content is always
        mounted. Any of them selects <strong>library mode</strong>: the Trigger's click is a request
        awaited in the Item's transition, the content mounts on open, and the closes the browser
        performs are facts. The mode is fixed at mount, and the two can be mixed in one navigation.
      </p>
      <Table
        head={["Close", "Who", "Library mode channel", "`reason`"]}
        rows={[
          [
            "Trigger click while open",
            "the browser (JS-free); the library (library mode)",
            "`openChangeAction(false)`, awaited with the panel still shown",
            '`"activate"`',
          ],
          [
            "A followed Link inside the panel",
            "the library, after hydration",
            "`openChangeAction(false)`, awaited",
            '`"activate"`',
          ],
          [
            "Escape (focus returns to the Trigger)",
            "the browser",
            "`onOpenChange(false)`",
            '`"dismiss"`',
          ],
          ["A press outside", "the browser", "`onOpenChange(false)`", '`"dismiss"`'],
          [
            "Another panel (or any other `auto` popover) opening",
            "the browser",
            "`onOpenChange(false)`",
            '`"dismiss"`',
          ],
          [
            "Focus leaving the Item (Tab past the last link)",
            "the library, after hydration",
            "`onOpenChange(false)`; while the open is still pending, `openChangeAction(false)`",
            '`"dismiss"`',
          ],
          ["Controlled `open={false}`", "the library", "none", "–"],
        ]}
      />
      <ul>
        <li>
          <strong>Opens on a click only</strong> (Enter and Space are the native click), never on
          hover: touch has no hover, and a button that opens on hover and toggles on click closes
          the panel under a user who hovers and then clicks. A hover preview is a{" "}
          <a href="/components/hover-card">HoverCard</a>.
        </li>
        <li>
          <strong>Focus leaving the Item</strong> to an element outside it closes the panel at once
          (a null <code>relatedTarget</code>, such as a window blur, closes nothing). Without it, a
          keyboard user who tabs past a panel would leave it open over the page. It needs the
          hydrated component; before hydration a panel stays open until Escape, a click outside or
          another panel.
        </li>
        <li>
          <strong>Use JS-free mode for a site's navigation.</strong> Library mode is for a panel
          whose content is worth loading late (recently viewed pages, an account panel) or whose
          open state the app needs to know.
        </li>
      </ul>

      <h3 id="links">Links</h3>
      <CodeBlock>{`<NavigationMenu.Link href="/pricing" aria-current="page">Pricing</NavigationMenu.Link>
<NavigationMenu.Link render={<RouterLink to="/analytics" />}>Analytics</NavigationMenu.Link>`}</CodeBlock>
      <ul>
        <li>
          <strong>Following a Link inside a panel closes the panel</strong>: a click with the
          primary button and no modifier key. With a client-side router the navigation keeps the{" "}
          <code>nav</code> mounted, and a click inside a popover is not a light dismiss, so the
          panel would otherwise stay over the new page. A Ctrl-, Cmd-, Shift- or Alt-click (new tab,
          new window, download) and a middle click leave it open, so several links can be opened
          from one panel. The link's own attributes are not read: a plain click on a{" "}
          <code>target="_blank"</code> or a <code>download</code> link closes the panel too.{" "}
          <code>closeOnActivate={"{false}"}</code> opts a link out.
        </li>
        <li>
          <strong>The panel closes right away, not with the new page.</strong> In library mode the
          close is a request that settles as soon as <code>openChangeAction(false)</code> does; with
          a router that renders the next page in a transition (FUNSTACK Router, for one), the panel
          is gone before a page that loads its data commits, in a commit (and, with{" "}
          <code>transition</code>, a view transition) of its own. In JS-free mode it is a{" "}
          <code>hidePopover()</code> in the click.
        </li>
        <li>
          The close listener is attached to the element, so <code>onClick</code> stays yours and a
          router link's own click handling runs untouched (also when it prevents the default). When
          the panel closes, the browser returns focus from the link to the Trigger; where focus goes
          after the navigation is the router's business.
        </li>
        <li>
          <strong>The current page</strong> is the native <code>aria-current="page"</code>, which
          you set (the library does not know the URL) and style with{" "}
          <code>[aria-current="page"]</code>. A router link that sets it itself works through{" "}
          <code>render</code>.
        </li>
        <li>
          A Link outside a panel renders an <code>{"<a>"}</code> and nothing else.
        </li>
      </ul>

      <h3 id="props">Props</h3>
      <h4>
        <code>NavigationMenu.Root</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps("NavigationMenuRootState"),
          renderProp("nav", "NavigationMenuRootState"),
        ]}
      />
      <PartFacts
        state={"`NavigationMenuRootState` is empty."}
        owned={
          "none: every `<nav>` prop passes through. Name it with `aria-label` or `aria-labelledby`."
        }
        note={'No `"use client"`: it reads no context and calls no hook.'}
      />

      <h4>
        <code>NavigationMenu.List</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps("NavigationMenuListState"),
          renderProp("ul", "NavigationMenuListState"),
        ]}
      />
      <PartFacts
        state={"`NavigationMenuListState` is empty."}
        owned={'none. `role="list"` is a default you can override.'}
        note={'No `"use client"`.'}
      />

      <h4>
        <code>NavigationMenu.Item</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "open",
            type: "boolean",
            description:
              "Controlled open state of this Item's panel. Pass `onOpenChange` too: the browser closes the panel without asking (development warns).",
          },
          {
            name: "defaultOpen",
            type: "boolean",
            description:
              "Initial open state in uncontrolled library mode. Shown after hydration, never in the server HTML. `defaultOpen={false}` alone selects library mode.",
          },
          {
            name: "openChangeAction",
            type: "ChangeAction<boolean, NavigationMenuOpenChangeDetails>",
            description: (
              <>
                Requests only: the Trigger's toggle and a followed Link's close. Awaited in the
                Item's transition: the panel opens when it resolves and the content has rendered,
                and closes when a close resolves. May be a Server Function. A rejection reaches the
                nearest Error Boundary above the Item and the panel keeps its previous state.
              </>
            ),
          },
          {
            name: "onOpenChange",
            type: "UrgentChangeHandler<boolean, NavigationMenuOpenChangeDetails>",
            description: (
              <>
                Facts only: the panel was dismissed (Escape, a click outside, another panel opening,
                focus leaving the Item). Always <code>false</code>, with{" "}
                <code>reason: "dismiss"</code>. Called synchronously, outside any transition, not
                awaited. Controlled: set state directly here (
                <code>onOpenChange={"{setOpen}"}</code>
                ).
              </>
            ),
          },
          ...functionProps(
            "NavigationMenuItemState",
            "A Trigger and its Popup, or a Link. The function form receives the optimistic state.",
          ),
          renderProp("li", "NavigationMenuItemState"),
        ]}
      />
      <PartFacts
        state={
          '`NavigationMenuItemState` is `{ open, pending }`; `open` is optimistic, both are `false` in JS-free mode. `NavigationMenuOpenChangeDetails` is `{ reason }` plus the virtual `event`: `"activate"` for the Trigger and a followed Link, `"dismiss"` for everything else, `"platform"` for a panel found open at hydration.'
        }
        owned={
          "`data-open` (optimistic) and `data-pending` on the `<li>`, in library mode only; JS-free mode renders neither (style the open Item with `:has(:popover-open)`)."
        }
        note={
          "The focus-leave listener is attached through the `ref`, so `onBlur` stays yours. Every `li` prop passes through."
        }
      />

      <h4>
        <code>NavigationMenu.Trigger</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "Never opens. Native `disabled` on a `<button>`; with a link or component `render` in library mode, `aria-disabled` (still focusable).",
          },
          ...functionProps(
            "NavigationMenuTriggerState",
            "Rendered from optimistic state; must not suspend.",
          ),
          renderProp(
            "button",
            "NavigationMenuTriggerState",
            "It should stay a `<button>`: only a button is a `popovertarget` invoker (another element works only in library mode).",
          ),
        ]}
      />
      <PartFacts
        state={
          "`NavigationMenuTriggerState` is `{ open, pending, disabled }` (Popover.Trigger's). In JS-free mode `state.open` is `false` (React holds no value) while `data-open` follows the panel, written from its `toggle` event."
        }
        owned={
          "`type`, `disabled`, `popoverTarget`, `aria-expanded` (never rendered on a button: the browser exposes the panel's state on its invoker), `onClick` in library mode, `data-open`, `data-pending`, `data-disabled`; `commandfor`, `command` and `popoverTargetAction` are not accepted."
        }
      />

      <h4>
        <code>NavigationMenu.Popup</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "side",
            type: '"top" | "bottom" | "left" | "right" | "inline-start" | "inline-end" | null',
            default: '"bottom"',
            description:
              "Placement against the Trigger through inline `position-area`, with `position-try-fallbacks` flipping it when it does not fit. `null` renders no placement (and no `data-side` / `data-align`), for a full-width panel your stylesheet places.",
          },
          {
            name: "align",
            type: '"start" | "center" | "end"',
            default: '"start"',
            description:
              "Alignment along the side; `start` / `end` are inline-relative on a top or bottom side (mirrored in RTL).",
          },
          {
            name: "keepMounted",
            type: "boolean",
            default: "false",
            description:
              "Library mode: keep the children rendered inside a hidden `<Activity>` while the panel is closed. Ignored in JS-free mode, where they are always mounted.",
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Library mode only: a `<ViewTransition>` around the panel animates library-driven opens and closes (the Trigger, a followed Link, a controlled change). Dismissals animate with CSS. Keep it static: changing it remounts the popup. Any value, `\"none\"` included, makes a mount or `<Activity>` reveal of the Popup inside a transition run the page cross-fade; a plain open does not. While a view transition runs, the popup's CSS transitions are cut for the library's own show or hide (a `@keyframes` animation is not, and a dismissal keeps its CSS exit).",
          },
          ...functionProps(
            "NavigationMenuPopupState",
            "The panel's links. In library mode they render from committed state and may suspend.",
          ),
          renderProp("div", "NavigationMenuPopupState"),
        ]}
      />
      <PartFacts
        state={
          "`NavigationMenuPopupState` is `{ open, side, align }`; `open` is committed (`false` in JS-free mode; `:popover-open` is the DOM truth); `side` / `align` are where the browser placed the panel while it is shown, your props otherwise."
        }
        owned={'`id`, `popover` (`"auto"`), `data-side` / `data-align` (unless `side` is `null`).'}
        note={
          "No role: the disclosure pattern's panel is a plain region, and a `<div popover>` moves no focus when it opens. Pass `aria-label` and a `role` for a named region. `onToggle` and `onBeforeToggle` are not accepted; use a `ref`."
        }
      />

      <h4>
        <code>NavigationMenu.Link</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "closeOnActivate",
            type: "boolean",
            default: "true",
            description:
              "Inside a Popup: following the link (primary button, no modifier key) closes the panel. Ignored outside a Popup.",
          },
          ...functionProps("NavigationMenuLinkState"),
          renderProp(
            "a",
            "NavigationMenuLinkState",
            'A router\'s link component: `render={<Link to="/" />}`.',
          ),
        ]}
      />
      <PartFacts
        state={"`NavigationMenuLinkState` is empty."}
        owned={"none: every anchor prop passes through, `onClick` and `aria-current` included."}
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          ["`:popover-open`", "Popup", "The panel is shown (DOM truth, every mode)."],
          [
            "`data-open`",
            "Trigger",
            "Library mode: optimistic open state. JS-free mode: kept from the panel's `toggle` after hydration (use `:has(+ :popover-open)` before it).",
          ],
          ["`data-pending`", "Trigger", "Library mode: an open or a close is in flight."],
          ["`data-open`", "Item", "Library mode: optimistic open state of its panel."],
          ["`data-pending`", "Item", "Library mode: an open or a close is in flight."],
          ["`data-disabled`", "Trigger", "The `disabled` prop."],
          [
            "`data-side`, `data-align`",
            "Popup",
            "While shown: where the browser placed the panel (after any flip). Otherwise the requested placement. Absent with `side={null}`.",
          ],
          ['`[aria-current="page"]`', "Link", "Yours: the current page's link."],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Where", "Behaviour"]}
        rows={[
          [
            "Tab / Shift+Tab",
            "anywhere",
            "The document's order: a Trigger, then its open panel's links, then the next entry. Tab past the last link closes the panel behind.",
          ],
          ["Enter / Space", "Trigger", "Toggles the panel; focus stays on the Trigger."],
          ["Enter", "Link", "Follows it; the panel closes."],
          [
            "Escape",
            "Trigger or panel, panel open",
            "Closes the panel; focus returns to the Trigger.",
          ],
        ]}
      />
      <ul>
        <li>
          <strong>Opening moves no focus</strong>: the user who pressed Enter on "Products" is still
          on it, and Tab enters the panel. There is no <code>initialFocus</code>.
        </li>
        <li>
          <strong>No arrow keys</strong>, so the keyboard works the same before and after hydration.
          The Trigger has no <code>aria-expanded</code> and no <code>aria-controls</code>: every
          engine exposes the popover's expanded state on its <code>popovertarget</code> invoker.
        </li>
        <li>
          <strong>Not a menu</strong>: no <code>menu</code> / <code>menuitem</code> roles. The WAI
          ARIA Authoring Practices recommend the disclosure pattern for site navigation; an
          application menu of commands is a <a href="/components/menu">Menu</a>.
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "Library mode: `fsui-navigation-menu` plus `fsui-navigation-menu-open` or `fsui-navigation-menu-close` for the Trigger's toggle and a followed Link's close. Dismissals are facts and start no transition. JS-free mode starts none."
        }
      >
        <Callout kind="note" title="With a router's view transitions">
          <p>
            A Link's close and a router's navigation are two transitions that commit separately.
            Where the router adds its own transition type (FUNSTACK Router's <code>navigation</code>
            ) before it awaits the navigation, React may attach that type to the panel's close
            commit, the next transition to commit, and the page's commit then has none. If your page
            animation matches on that type, give the panel no <code>transition</code>. The router
            side is tracked in <a href="https://github.com/uhyo/funstack-ui/issues/189">#189</a>.
          </p>
        </Callout>
      </BehaviourSection>

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "Library mode: from the click the Trigger has `data-open` (optimistic) and `data-pending`; the panel is hidden until `openChangeAction(true)` resolves and its content has rendered. A close through the Trigger or a Link keeps the panel shown until `openChangeAction(false)` settles. Dismissals pend nothing."
        }
      >
        <Example file="NavigationMenuRecent.tsx" css="navigation-menu.css">
          <NavigationMenuRecent />
        </Example>
        <p>
          The first open of "Recent" waits 1.5 s for its pages: the Trigger shows a spinner, and the
          other panel stays open meanwhile. Tab away before it appears and the open is cancelled.
        </p>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "Library mode: the Popup's children render from committed state, so content that suspends holds the open, with `data-pending` on the Trigger, and the panel appears complete. In JS-free mode nothing suspends on open: the content is part of the page and streams with it."
        }
      >
        <CodeBlock>{`<NavigationMenu.Item openChangeAction={(open) => { if (open) preloadRecent(); }}>
  <NavigationMenu.Trigger>Recent</NavigationMenu.Trigger>
  <NavigationMenu.Popup transition="nav-panel">
    <RecentPages />  {/* use(recent): the Trigger is data-pending until it resolves */}
  </NavigationMenu.Popup>
</NavigationMenu.Item>`}</CodeBlock>
      </BehaviourSection>

      <BehaviourSection
        id="browser-owned-state"
        summary={
          "Each panel is an `auto` popover: the browser owns Escape, light dismiss and one panel at a time, and in JS-free mode the whole open state. In library mode a close the browser performs is a fact for `onOpenChange`; the focus-leave close is shaped the same way."
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          "JS-free mode works completely before hydration and without JavaScript: open, close, Escape, light dismiss, one panel at a time, the Tab order, placement and CSS animation. Missing until hydration: the focus-leave close and the Link close. A library-mode Trigger pressed before hydration opens an empty panel, which fills when the page hydrates."
        }
      />

      <h3 id="recipes">Recipes</h3>
      <h4>Animation, with and without JavaScript</h4>
      <CodeBlock language="css">{`.nav-panel { opacity: 0; translate: 0 -4px; transition: opacity .15s, translate .15s, display .15s allow-discrete, overlay .15s allow-discrete; }
.nav-panel:popover-open { opacity: 1; translate: 0; }
@starting-style { .nav-panel:popover-open { opacity: 0; translate: 0 -4px; } }
.nav-trigger[data-open] { color: var(--accent); }             /* after hydration */
.nav-trigger:has(+ :popover-open) { color: var(--accent); }   /* without JavaScript */
[aria-current="page"] { font-weight: 600; }`}</CodeBlock>
      <h4>A full-width panel</h4>
      <CodeBlock>{`<NavigationMenu.Popup side={null} className="mega-panel">…</NavigationMenu.Popup>`}</CodeBlock>
      <CodeBlock language="css">{`.mega-panel { position: fixed; inset-inline: 0; top: anchor(bottom); margin: 0; }`}</CodeBlock>
      <p>
        The implicit anchor (the Trigger) still applies. On small screens, put the same links in a
        different component, such as a <a href="/components/drawer">Drawer</a> or a{" "}
        <a href="/components/collapsible">Collapsible</a>.
      </p>
      <h4>With a router</h4>
      <CodeBlock>{`function NavLink({ to, children }) {
  const { pathname } = useLocation();
  return (
    <NavigationMenu.Link href={to} aria-current={pathname === to ? "page" : undefined}>
      {children}
    </NavigationMenu.Link>
  );
}`}</CodeBlock>

      <h3 id="not-included">Not included</h3>
      <ul>
        <li>Opening on hover; arrow keys, Home and End between the top-level entries.</li>
        <li>
          A shared viewport that resizes between panels, an indicator under the active Trigger, an
          arrow, and a Root-level <code>value</code> naming the open Item: all need a Root-level
          owner. Moving from one panel to another is a dismissal and an open on two Items, so no
          single commit morphs one into the other.
        </li>
        <li>Nested flyouts (a panel inside a panel).</li>
        <li>
          A <code>current</code> prop on Link: use <code>aria-current="page"</code>.
        </li>
      </ul>
    </DocPage>
  );
}
