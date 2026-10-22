import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { ContextMenuCanvas } from "../examples/ContextMenuCanvas.js";
import contextMenuCanvasSource from "../examples/ContextMenuCanvas.tsx?raw";
import { ContextMenuFiles } from "../examples/ContextMenuFiles.js";
import contextMenuFilesSource from "../examples/ContextMenuFiles.tsx?raw";
import contextMenuCss from "../examples/context-menu.css?raw";
import { functionProps, renderProp } from "./shared-props.js";

export function ContextMenuPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Context menu"
        description="Menu.ContextTrigger: a region whose right-click, Shift+F10 or touch long-press opens a Menu at the pointer, with the menu's pending items, optimistic checkbox and radio items and submenus unchanged."
      />
      <h2>Context menu</h2>
      <p className="page-intro">
        A context menu is a <a href="/components/menu">Menu</a> opened from a different trigger.{" "}
        <code>Menu.ContextTrigger</code> is a region (any element) whose <code>contextmenu</code>{" "}
        event (right-click, Ctrl+click on macOS, Shift+F10 or the ContextMenu key) or touch
        long-press opens the Root's <code>Menu.Popup</code> at the pointer. Everything inside the
        popup is Menu's: items whose <code>action</code> runs with <code>data-pending</code>,
        checkbox and radio items, submenus, typeahead, Escape and Tab. The library fills the three
        gaps the platform leaves: touch on iOS (which never fires <code>contextmenu</code>), placing
        a popover at a point, and the light dismiss that would close a just-opened menu in Firefox
        and Safari.
      </p>

      <Callout kind="warning" title="Three rules for an accessible context menu">
        <ol>
          <li>
            <strong>A context menu is a shortcut, never the only path to an action.</strong> iOS
            (with or without VoiceOver) may never open it, nothing announces it, and users do not
            discover it. Every item must also be reachable through a visible control: a{" "}
            <code>Menu.Trigger</code> in the same Root (the first example), a toolbar (the second),
            or a keyboard shortcut.
          </li>
          <li>
            <strong>Targets must be focusable</strong> for keyboard and screen-reader users: the
            browser fires <code>contextmenu</code> at the focused element, so a region with no
            focusable content cannot be opened from the keyboard. Windows screen readers pass the
            Applications key and Shift+F10 through to the page.
          </li>
          <li>
            <strong>Name the menu</strong> with <code>aria-label</code> on the Popup when the Root
            has no <code>Menu.Trigger</code> (the Popup's <code>aria-labelledby</code> points at the
            Trigger's id).
          </li>
        </ol>
      </Callout>

      <Example
        source={contextMenuFilesSource}
        fileName="ContextMenuFiles.tsx"
        css={contextMenuCss}
        cssFileName="context-menu.css"
      >
        <ContextMenuFiles />
      </Example>

      <Example
        source={contextMenuCanvasSource}
        fileName="ContextMenuCanvas.tsx"
        css={contextMenuCss}
        cssFileName="context-menu.css"
      >
        <ContextMenuCanvas />
      </Example>

      <h3>Anatomy</h3>
      <CodeBlock>{`import { Menu } from "@funstack/ui/menu";

<Menu.Root>                                                  {/* no DOM; as Menu */}
  <Menu.ContextTrigger render={<div className="card" />}>   {/* the region: any element, no ARIA */}
    <h3>{file.name}</h3>
    <Menu.Trigger aria-label={\`Actions for \${file.name}\`}>⋯</Menu.Trigger>  {/* optional: the same menu as a button */}
  </Menu.ContextTrigger>
  <Menu.Popup aria-label="File actions">                     {/* a sibling of the region */}
    <Menu.Item action={rename}>Rename</Menu.Item>
    <Menu.Item action={archive}>Archive</Menu.Item>
    <Menu.Root>
      <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
      <Menu.Popup>…</Menu.Popup>
    </Menu.Root>
  </Menu.Popup>
</Menu.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>One new part</strong> in the Menu namespace. There is no <code>ContextMenu</code>{" "}
          namespace: Root, Popup, items and submenus are Menu's.
        </li>
        <li>
          <strong>The region is a plain element</strong>: no role (a <code>tr</code>,{" "}
          <code>li</code> or <code>canvas</code> through <code>render</code> keeps its own), no{" "}
          <code>aria-haspopup</code> (not allowed on generic elements) and no{" "}
          <code>aria-expanded</code>. ARIA has no way to say "this has a context menu".{" "}
          <code>tabIndex</code> is yours (rule 2).
        </li>
        <li>
          <strong>Render the Popup next to the region</strong>, so the reading order is natural. In
          a table row (<code>{"render={<tr />}"}</code>) put it inside a cell instead: a{" "}
          <code>&lt;div&gt;</code> cannot be a sibling of a <code>&lt;tr&gt;</code>. Right-clicks
          and long-presses inside a menu (this one, or any other <code>Menu.Popup</code> inside the
          region) are never the region's. Other events inside the menu do bubble to the row, in the
          DOM and in React: a row <code>onClick</code> (selection) also sees item clicks, and
          selectors such as <code>.row:hover *</code> reach the menu. Check{" "}
          <code>event.target</code> in row handlers.
        </li>
        <li>
          A right-click inside a popup that is not a menu (a <code>Popover.Popup</code>, a Select
          picker) rendered inside the region is the region's: its menu opens and the other popup
          closes, as any <code>popover="auto"</code> would. Keep such popups outside the region, or
          give them <code>{"onContextMenu={(e) => e.preventDefault()}"}</code>, which keeps the
          region quiet there.
        </li>
        <li>
          A <code>Menu.ContextTrigger</code> belongs to a top-level Root; inside a{" "}
          <code>Menu.Popup</code> a Root is a submenu (development warning).
        </li>
      </ul>

      <h3>Opening</h3>
      <Table
        head={["Input", "Where", "What opens"]}
        rows={[
          [
            "Right-click; Ctrl+click on macOS",
            "the region",
            "The menu at the pointer, first item focused without a focus ring",
          ],
          [
            "Shift+F10, the ContextMenu key; Ctrl+Return on macOS; VO+Shift+M",
            "a focused element in the region",
            "The menu inside the focused element (the browser puts the event there), first item focused with the ring",
          ],
          [
            "Long-press (touch, pen)",
            "the region",
            "After `longPressDelay` (500 ms) held within 10 px: the menu 16 px above the touch point (so the finger does not cover it), first item focused quietly",
          ],
        ]}
      />
      <ul>
        <li>
          The open is Menu's: <code>openChangeAction(true, {'{ reason: "activate" }'})</code> with{" "}
          <code>details.event</code> the <code>contextmenu</code> event (the{" "}
          <code>pointerdown</code> of a long-press), in the Root's transition. Items that suspend
          hold the open with <code>data-pending</code> on the region (and on a Trigger in the same
          Root); a rejection rolls <code>data-open</code> back.
        </li>
        <li>
          The long-press runs on every platform for touch and pen pointers, because iOS fires no{" "}
          <code>contextmenu</code>. Where the platform fires its own (Android, Windows pen),
          whichever comes first opens once. The page stays scrollable: a pan cancels the press. The
          one click a release may synthesise is swallowed. Keep the finger down to slide onto an
          item (see Press-drag-release).
        </li>
        <li>
          <strong>Before hydration</strong> the browser's own menu shows. Nothing is half-open and
          nothing is replayed after hydration; the custom menu works from then on.
        </li>
      </ul>

      <h3>Placement</h3>
      <p>
        A mouse or keyboard open puts the menu's top-left corner at the point; a touch or pen open
        puts the menu <strong>above</strong> the point with a 16 px gap, so the finger does not
        cover it. Either flips when it does not fit: upward (touch: downward, below the finger) at
        the edge, leftward at the right edge, both in the corner. CSS anchor positioning anchors to
        elements, not points, so the Popup renders the point inline (<code>--menu-point-x</code>,{" "}
        <code>--menu-point-y</code>, and the gap as <code>--menu-point-gap</code>: <code>0px</code>{" "}
        for a mouse, <code>16px</code> for touch), puts the insets there and names three{" "}
        <code>@position-try</code> options that mirror it. A right-to-left menu mirrors all of it
        (see below). The menu lives in the top layer, so a transformed or filtered ancestor of the
        region does not move it.
      </p>
      <p>
        Those options are shipped CSS: a <code>&lt;style&gt;</code> React hoists into{" "}
        <code>&lt;head&gt;</code> once per page on the first context open (
        <code>data-href="@funstack/ui/menu-point"</code>). It is functional only: eight named
        at-rules (a menu names the three that apply to its direction and pointer kind), no
        selectors, nothing visual.
      </p>
      <CodeBlock language="css">{`@position-try --fsui-menu-up    { top: auto; bottom: calc(100% - var(--menu-point-y) + var(--menu-point-gap)); }
@position-try --fsui-menu-down  { bottom: auto; top: calc(var(--menu-point-y) + var(--menu-point-gap)); }
@position-try --fsui-menu-left  { left: auto; right: calc(100% - var(--menu-point-x)); }
@position-try --fsui-menu-right { right: auto; left: var(--menu-point-x); }
/* and the four corners: --fsui-menu-up-left, -up-right, -down-left, -down-right */`}</CodeBlock>
      <Table
        head={["Open", "Inline placement", "Fallbacks (LTR; RTL mirrors left and right)"]}
        rows={[
          [
            "Mouse, keyboard",
            "`top: calc(var(--menu-point-y) + var(--menu-point-gap))`, `left: var(--menu-point-x)`; gap `0px`",
            "`--fsui-menu-up`, `--fsui-menu-left`, `--fsui-menu-up-left`",
          ],
          [
            "Touch, pen",
            "`bottom: calc(100% - var(--menu-point-y) + var(--menu-point-gap))`, `left: var(--menu-point-x)`; gap `16px`",
            "`--fsui-menu-left`, `--fsui-menu-down`, `--fsui-menu-down-left`",
          ],
        ]}
      />
      <ul>
        <li>
          <strong>Adjust</strong> with the Popup's <code>style</code>, which wins over the inline
          placement (your own <code>position-try-fallbacks</code>, a <code>margin</code>, a
          different touch gap: <code>{'style={{ "--menu-point-gap": "24px" }}'}</code>).
        </li>
        <li>
          <strong>Opt out</strong> with <code>side={"{null}"}</code> on the Popup: no inline
          placement and no <code>&lt;style&gt;</code> on either path; a context open still sets{" "}
          <code>--menu-point-x</code> / <code>--menu-point-y</code> / <code>--menu-point-gap</code>{" "}
          and <code>data-context</code> for your stylesheet.
        </li>
        <li>
          <strong>Content Security Policy:</strong> under a strict <code>style-src</code> the
          stylesheet needs its hash or a nonce (see{" "}
          <a href="#content-security-policy">Content Security Policy</a> below). Blocked, the menu
          still opens at the point but never flips.
        </li>
        <li>
          <strong>Right-to-left:</strong> when the popup's computed <code>direction</code> is{" "}
          <code>rtl</code> (an RTL page, or a <code>dir="rtl"</code> ancestor of the Popup), the
          menu's <strong>right</strong> edge sits at the point (
          <code>right: calc(100% - var(--menu-point-x))</code>) and it flips rightward at the left
          edge, as native menus do under a right-to-left UI. The library reads the direction once
          per open or move; nothing is read on the server. The point placement uses insets, so the
          Firefox RTL-container bug of the anchored popups (Mozilla 2019601) does not apply.
        </li>
      </ul>
      <CodeBlock>{`<Menu.Popup side={null} className="menu">…</Menu.Popup>`}</CodeBlock>
      <CodeBlock language="css">{`.menu[data-context] {
  inset: auto;
  left: var(--menu-point-x);
  top: var(--menu-point-y);
  position-try-fallbacks: --mine;
}
@position-try --mine { top: auto; bottom: calc(100% - var(--menu-point-y)); }
/* A touch open: bottom: calc(100% - var(--menu-point-y) + var(--menu-point-gap)). */
/* self-*: follows the menu's direction (a plain logical keyword would follow the root's only). */
.menu:not([data-context]) { position-area: bottom span-self-x-end; }
/* An RTL menu at a point: right: calc(100% - var(--menu-point-x)) instead of left. */`}</CodeBlock>

      <h3>Moving and closing</h3>
      <Table
        head={["Input", "What happens", "reason"]}
        rows={[
          [
            "Right-click elsewhere in the region while open",
            "The menu moves to the new point: no `openChangeAction`, items keep their state, a pending item action keeps running, the first item is focused again",
            "–",
          ],
          [
            "Right-click or middle-click outside the menu",
            "Closes at once, for every menu (a Menu opened from its button too): the browser's own light dismiss ignores those buttons in Chromium, and native menus close on any click",
            '`"dismiss"`',
          ],
          [
            "Right-click inside the menu",
            "Nothing: the browser's menu is suppressed, the menu stays where it is",
            "–",
          ],
          [
            "Release of the held button or finger over an item, after sliding onto it",
            "The item is activated, as a click would (see Press-drag-release)",
            '`"activate"`',
          ],
          [
            "Release of the held button outside the menu, after moving, at least 500 ms after the open",
            "Closes at once",
            '`"dismiss"`',
          ],
          [
            "A scroll of the page, or of a scroller around the region",
            "Closes at once (a menu at a point only; see Scrolling)",
            '`"dismiss"`',
          ],
          [
            "An item's activation, Escape, Tab, a left click outside",
            "As Menu",
            '`"activate"` / `"dismiss"`',
          ],
        ]}
      />
      <p>
        Focus after a close is the platform's: the element focused when the menu opened. A
        right-click on a region that cannot take focus leaves focus on <code>&lt;body&gt;</code>{" "}
        (the right-button press already moved it there, as with native menus); with a{" "}
        <code>Menu.Trigger</code> in the same Root, focus goes to that button instead.
      </p>

      <h3>Press-drag-release</h3>
      <p>
        On Linux and macOS the browser fires <code>contextmenu</code> on the button press, and
        native menus let you keep the button down, slide onto an item and release to choose it. The
        library does the same: the popup holds the pointer it captured at the open, and while the
        button is down the item under the pointer gets focus (quietly, as with hover).
      </p>
      <Table
        head={["Release", "What happens"]}
        rows={[
          [
            "Over an enabled item, more than 4 px from where the menu opened",
            "The item is activated through its `click()`: its `action`, `closeOnActivate`, checkbox and radio toggling behave exactly as a click",
          ],
          [
            "Outside the menu (and its submenus), after moving more than 4 px, at least 500 ms after the open",
            'The menu closes (`"dismiss"`)',
          ],
          [
            "Anything else: in place, quick, over a disabled item, a separator or a submenu trigger",
            "Nothing: the menu stays open and works with clicks and keys",
          ],
        ]}
      />
      <ul>
        <li>
          Time alone never chooses anything: the menu's corner is under the pointer, so a long,
          still press must not activate the first item, and a menu that flipped away from the
          pointer stays open after a still release. A submenu trigger opens its submenu while the
          pointer rests on it, as with hover.
        </li>
        <li>
          Windows fires <code>contextmenu</code> after the release and the keyboard holds no
          pointer, so neither runs the gesture.
        </li>
        <li>
          <strong>Touch</strong>: after a long-press, keep the finger down and slide onto an item;
          lift to choose it (10 px slop). While that finger is down the page does not pan, and the
          lift synthesises no click. A plain lift never closes the menu, which sits above the
          finger. This is{" "}
          <strong>
            verified under Chromium's touch emulation; iOS and Android pending (
            <a href="https://github.com/uhyo/funstack-ui/issues/90">#90</a>)
          </strong>
          .
        </li>
        <li>
          During the drag the items do not match <code>:hover</code> (the popup holds the pointer):
          style the current item with <code>:focus</code>, as for the keyboard.
        </li>
      </ul>

      <h3>Scrolling</h3>
      <ul>
        <li>
          <strong>A menu at a point closes when the page scrolls</strong> (<code>"dismiss"</code>):
          a scroll of the document or of a scroller that contains the region. The point means
          nothing once the content under it has moved. Scrolls of other scrollers (a log elsewhere)
          and inside the menu are ignored. A menu opened from its <code>Menu.Trigger</code> stays
          open and follows its button.
        </li>
        <li>
          <strong>A wheel over any menu never scrolls the page</strong> (a menu opened from its
          button too): the library prevents it unless the menu under the pointer can scroll that way
          itself.
        </li>
        <li>
          There is no scroll lock, which would fight your app's own and cannot stop a scrollbar
          drag. To block page scrolling while a context menu is open, as native menus do, add:
        </li>
      </ul>
      <CodeBlock language="css">{`html:has([role="menu"][data-context]:popover-open) {
  overflow: hidden;
  scrollbar-gutter: stable;
}`}</CodeBlock>

      <h3>Nested regions and editable targets</h3>
      <ul>
        <li>
          <strong>The innermost region wins.</strong> A region opens only when the{" "}
          <code>contextmenu</code> event reaches it not yet <code>defaultPrevented</code>, and
          opening prevents it, so an outer region stays quiet. A <code>disabled</code> region lets
          the event through to an outer one. The library never calls <code>stopPropagation()</code>,
          so your document-level listeners still see the event.
        </li>
        <li>
          Your own handler on an element inside the region decides for that element:{" "}
          <code>preventDefault()</code> keeps both the browser's menu and the region quiet (a canvas
          that draws its own); <code>stopPropagation()</code> gives the browser's menu (and leaves
          an open menu of the region open under it).
        </li>
        <li>
          <strong>Text fields keep the browser's menu</strong> (copy, paste, spell-check): a
          right-click or long-press on a text-taking <code>&lt;input&gt;</code>, a{" "}
          <code>&lt;textarea&gt;</code> or editable content opens nothing custom. An editor whose
          menu has its own clipboard items sets <code>editableTargets="menu"</code>.
        </li>
      </ul>
      <CodeBlock>{`<Menu.ContextTrigger editableTargets="menu" render={<div contentEditable />} />`}</CodeBlock>

      <h3>Sharing items with a Menu button</h3>
      <p>
        One Root may hold a <code>Menu.Trigger</code> and a <code>Menu.ContextTrigger</code>: the
        button opens the menu anchored below it (<code>side</code> / <code>align</code>), a
        right-click opens the same menu at the pointer. It is one menu: while it is open from a
        right-click the button shows <code>aria-expanded="true"</code> and <code>data-open</code>,
        and a click on it closes the menu. That is the recommended way to satisfy rule 1, and it
        gives keyboard users a focusable target inside the region. Use one Root per target (a row, a
        card); several ContextTriggers in one Root are allowed but all show <code>data-open</code>{" "}
        together.
      </p>

      <h3>Props</h3>
      <h4>
        <code>Menu.ContextTrigger</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "The region does nothing: the browser's menu shows, or an outer region opens. `data-disabled`.",
          },
          {
            name: "editableTargets",
            type: '"native" | "menu"',
            default: '"native"',
            description:
              "What a right-click or long-press on a text-taking `<input>`, a `<textarea>` or editable content inside the region opens: the browser's menu, or this one.",
          },
          {
            name: "longPressDelay",
            type: "number",
            default: "500",
            description:
              "Milliseconds a touch or pen pointer must stay down (within 10 px) to open. A development warning when negative.",
          },
          ...functionProps("MenuContextTriggerState"),
          renderProp("div", "MenuContextTriggerState"),
        ]}
      />
      <p>
        <code>MenuContextTriggerState</code>: <code>{"{ open, pending, disabled }"}</code> (
        <code>open</code> optimistic, the Root's). Emits <code>data-open</code>,{" "}
        <code>data-pending</code>, <code>data-disabled</code> and inline{" "}
        <code>-webkit-touch-callout: none</code> (your <code>style</code> wins). Owns{" "}
        <code>onContextMenu</code>, <code>onPointerDown</code>, <code>onPointerMove</code>,{" "}
        <code>onPointerUp</code> and <code>onPointerCancel</code>; <code>onKeyDown</code> and{" "}
        <code>onClick</code> pass through. No <code>id</code>, <code>tabIndex</code> or ARIA. Every
        prop is serialisable, so a Server Component can render the region.
      </p>

      <h4>
        Additions to <code>Menu.Popup</code> and <code>Menu.Root</code>
      </h4>
      <Table
        head={["Where", "What", "Meaning"]}
        rows={[
          [
            "`Menu.Popup`",
            "`data-context`, `state.context`",
            "The current open came from a ContextTrigger and is placed at a point (committed). `data-side` / `data-align` are absent then, and `state.side` is `null`.",
          ],
          [
            "`Menu.Popup`",
            "`--menu-point-x`, `--menu-point-y`",
            "The point, inline, in viewport pixels (also with `side={null}`).",
          ],
          [
            "`Menu.Popup`",
            "`--menu-point-gap`",
            "The vertical gap between the point and the menu: `0px` for a mouse or keyboard open, `16px` for a touch or pen open, which is placed above the point. Inline; your `style` wins (also with `side={null}`).",
          ],
          [
            "`Menu.Popup`",
            "`side`, `align`",
            "Apply to opens from a `Menu.Trigger`; ignored for a context open. `side={null}` opts out of the inline placement on both paths.",
          ],
          [
            "`Menu.Popup`",
            "`onContextMenu` (owned)",
            "Prevents the browser's menu over the custom one.",
          ],
          [
            "`Menu.Root`",
            "`state.context`",
            "The current open (optimistic) came from a ContextTrigger.",
          ],
        ]}
      />

      <h3>Styling</h3>
      <CodeBlock language="css">{`.row[data-open] { background: var(--accent-weak); }   /* the region of the open menu */
.row[data-pending] { cursor: progress; }
.row { -webkit-user-select: none; user-select: none; } /* touch: optional, see below */
.menu[data-context] { margin: 0; }                    /* point-placed: no anchored gap */`}</CodeBlock>
      <ul>
        <li>
          The Menu styles apply as they are (<code>margin: 0; inset: auto</code> on the popup is
          what a point-placed menu wants too). Enter and exit CSS and <code>transition</code> as
          Menu: the open and library-driven closes animate with <code>transition</code>; dismissals
          and the outside right-click with CSS; a move is instant.
        </li>
        <li>
          On iOS a long-press over text starts a selection and the loupe. Only a{" "}
          <code>user-select: none</code> that applies before the touch starts prevents it, and then
          the text cannot be selected by touch, so it is your choice, not a library default. The
          region already suppresses the link and image callout inline.
        </li>
      </ul>

      <h3 id="content-security-policy">Content Security Policy</h3>
      <p>
        The point rules are a <code>&lt;style&gt;</code> element inserted by script, which a{" "}
        <code>style-src</code> with nonces or hashes blocks (unlike the inline <code>style</code>{" "}
        attributes the library sets from the client, which it allows). Either allow its hash,{" "}
        <code>STYLE_SHA256["@funstack/ui/menu-point"]</code> from <code>@funstack/ui/csp</code>, or
        wrap the app in <code>{"<CSPProvider nonce>"}</code>, which puts your nonce on the element.
        Details and the hash values:{" "}
        <a href="/concepts/content-security-policy">Content Security Policy</a>.
      </p>

      <h3>Browser notes</h3>
      <ul>
        <li>
          <strong>iOS Safari</strong> never fires <code>contextmenu</code> for touch; the library's
          long-press opens the menu there. VoiceOver on iOS cannot open it (rule 1). On iPadOS with
          a trackpad, Safari shows its own menu over the custom one (WebKit bug 260722).
        </li>
        <li>
          <strong>Firefox</strong>: Shift+right-click forces the browser's menu and fires no event,
          a built-in escape hatch.
        </li>
        <li>
          <strong>Windows</strong> fires <code>contextmenu</code> after the button is released;
          Linux and macOS on the press. The library captures the pointer on the popup in the latter
          case, so the release does not light-dismiss the new menu in Firefox and Safari.
        </li>
        <li>
          <strong>Safari</strong> does not fire a keyboard <code>contextmenu</code> on a target with{" "}
          <code>border-radius</code> (WebKit bug 317496): keep a square focus target, or offer the
          Menu button.
        </li>
      </ul>
    </div>
  );
}
