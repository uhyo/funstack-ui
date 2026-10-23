import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { PageHead } from "../components/PageHead.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { PopoverActions } from "../examples/PopoverActions.js";
import popoverActionsSource from "../examples/PopoverActions.tsx?raw";
import { PopoverShare } from "../examples/PopoverShare.js";
import popoverShareSource from "../examples/PopoverShare.tsx?raw";
import popoverCss from "../examples/popover.css?raw";
import { functionProps, renderProp } from "./shared-props.js";

export function PopoverPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Popover"
        description="A non-modal popover on the Popover API and Invoker Commands: JS-free when you need no state; a transition-driven open, library-owned closes with a ViewTransition exit in every engine, and Suspense-ready content when you do."
      />
      <h2>Popover</h2>
      <p className="page-intro">
        Built on <code>popover="auto"</code>, a <code>&lt;dialog&gt;</code> element and Invoker
        Commands. The platform supplies the top layer, light dismiss, Escape, one-at-a-time stacking
        with nesting, placement next to the trigger, a declarative trigger that works before
        hydration, and focus return. The library adds the asynchronous half: opening a popover whose
        content loads is a transition, so the trigger shows <code>data-pending</code> and the
        popover opens once its content is ready; and the closes the user asks a part for run through
        the library too, so <code>&lt;ViewTransition&gt;</code> can animate the exit, in Firefox as
        well.
      </p>

      <Example
        source={popoverShareSource}
        fileName="PopoverShare.tsx"
        css={popoverCss}
        cssFileName="popover.css"
      >
        <PopoverShare />
      </Example>
      <p>
        This share popover is a Server Component in JS-free mode. The Trigger and Done are native
        invokers, so it works before hydration and with JavaScript disabled; the platform's dialog
        focusing steps put focus on the input, the first focusable element.
      </p>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Popover } from "@funstack/ui/popover";

<Popover.Root>                                       {/* no DOM: ids, mode, state */}
  <Popover.Trigger>Filters</Popover.Trigger>         {/* button[commandfor][command=toggle-popover] */}
  <Popover.Popup side="bottom" align="start">        {/* dialog[popover=auto][aria-modal=false] */}
    <Popover.Title>Filters</Popover.Title>           {/* h2, wired to aria-labelledby */}
    <Popover.Description>…</Popover.Description>     {/* p, wired to aria-describedby */}
    <FilterForm />
    <Popover.Close>Done</Popover.Close>              {/* button[commandfor][command=hide-popover] */}
  </Popover.Popup>
</Popover.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>Root renders no DOM.</strong> Trigger and Popup are linked by id through{" "}
          <code>commandfor</code>. Render the Popup <strong>right after the Trigger</strong> where
          the layout allows: Safari 27.0 does not put a far-away popover next in the Tab order after
          its trigger. A <code>&lt;button commandfor command&gt;</code> of your own that targets the
          popover is a <em>foreign invoker</em>; in library mode an open through it is routed
          through the library, while a foreign <code>hide-popover</code> closes natively and is
          reported as <code>"activate"</code>.
        </li>
        <li>
          <strong>
            Popup is the <code>&lt;dialog popover&gt;</code> itself.
          </strong>{" "}
          There is no Portal, Positioner, Arrow or Backdrop part: the top layer and CSS Anchor
          Positioning make them unnecessary, and a portalled popover would be inert inside a modal
          Dialog. A Popover nested inside a Popup is a nested popover; a Dialog opened from a Popup
          keeps it open.
        </li>
        <li>
          No <code>Form</code> part: a popover-shown <code>&lt;dialog&gt;</code> ignores{" "}
          <code>&lt;form method="dialog"&gt;</code>. "Submit, then close" is a{" "}
          <code>&lt;form action&gt;</code> plus a controlled <code>open</code> (recipe below), or a{" "}
          <code>Popover.Close action</code>.
        </li>
        <li>
          <code>render</code>: Popup renders a <code>&lt;dialog&gt;</code> (default) or a{" "}
          <code>&lt;div&gt;</code>; Trigger and Close render a <code>&lt;button&gt;</code> for the
          command path, and another element works only through the library's click handler (library
          mode, or a Close with <code>action</code>). Wrong elements are development warnings.
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <h4 id="two-modes">Two modes</h4>
      <Table
        head={["", "JS-free mode", "Library mode"]}
        rows={[
          [
            "Selected when",
            "Root has none of `open`, `defaultOpen`, `openChangeAction`",
            "Root has any of them",
          ],
          [
            "Open",
            'the browser runs `command="toggle-popover"`',
            "the click is intercepted and dispatched in the Root's transition; `showPopover({ source: trigger })` runs in the commit that mounts the content. Any other open (a foreign invoker, a script) is cancelled at `beforetoggle` and routed the same way",
          ],
          [
            "Close by a part (Trigger, Close)",
            "the browser",
            "the library: `openChangeAction(false)` is awaited, then `hidePopover()` runs in the commit",
          ],
          [
            "Close by a dismissal (Escape, click outside, another popover)",
            "the browser",
            "the browser; `openChangeAction(false)` is a notification",
          ],
          [
            "Popup content",
            "always mounted (in the server HTML)",
            "rendered from committed `open`; unmounted while closed unless `keepMounted`",
          ],
          [
            "Trigger `aria-expanded`",
            "kept current on the element from the popup's `toggle` event",
            "rendered from optimistic state",
          ],
          ["Trigger `data-open`, `data-pending`", "not emitted", "emitted"],
          [
            "Before hydration",
            "everything works",
            "the native open happens; the content arrives on hydration",
          ],
          [
            "`transition` on Popup",
            "no effect (development warning)",
            "animates opens, content swaps and every library-driven close",
          ],
        ]}
      />
      <p>
        In library mode, opening and{" "}
        <a href="/concepts/browser-owned-state#parts-close">a part's close</a> are the library's; a{" "}
        <a href="/concepts/browser-owned-state#dismissal">dismissal</a> (Escape, a click outside,
        another popover opening) is the browser's, and the Root is notified afterwards (
        <a href="/concepts/browser-owned-state#parts-vs-dismissals">Parts vs dismissals</a>). The
        mode is decided on the first render; switching later is not supported (development warning).
      </p>

      <h3 id="props">Props</h3>
      <h4>
        <code>Popover.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "open",
            type: "boolean",
            description:
              "Controlled open state. undefined means uncontrolled. Selects library mode.",
          },
          {
            name: "defaultOpen",
            type: "boolean",
            description:
              'Initial open state in uncontrolled library mode. A popover that starts open is shown after hydration (there is no attribute for an open popover in HTML); its content and the Trigger\'s open state (`aria-expanded="true"`, `data-open`) are already in the server HTML. `defaultOpen={false}` is the usual way to select library mode without an action.',
          },
          {
            name: "openChangeAction",
            type: "ChangeAction<boolean, PopoverOpenChangeDetails>",
            description: (
              <>
                Awaited for <code>true</code> (the popover opens when it resolves and the content
                has rendered) and for a <code>false</code> the user asked a part for (Trigger,
                Close: the popover hides when it resolves). A notification for a dismissal: the
                popover is already hidden when it runs. Runs in the Root's transition; may be a
                Server Function; rejections reach the nearest Error Boundary above the Root.{" "}
                <code>details.reason</code>: <code>"activate"</code> (Trigger, Close, a foreign
                invoker), <code>"dismiss"</code> (Escape, a click outside, script, another popover
                or modal dialog) or <code>"platform"</code> (found open on hydration;{" "}
                <code>event</code> is <code>undefined</code>). Selects library mode.
              </>
            ),
          },
          {
            name: "children",
            type: "ReactNode | ((state: PopoverRootState) => ReactNode)",
            description:
              "The parts. The function form receives the optimistic state and must not suspend.",
          },
        ]}
      />
      <PartFacts
        state={
          "`PopoverRootState` is `{ open, pending }`; `open` is optimistic, and both are `false` in JS-free mode."
        }
        owned={
          "nothing rendered: the Root has no element (no `ref`, `className` or `style`), and no `disabled` (the Trigger has it)."
        }
      />

      <h4>
        <code>Popover.Trigger</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Native `disabled`: a disabled button is not an invoker and never dispatches. Owned, so a `render` element cannot re-enable it. In library mode with a link or component `render`, `aria-disabled="true"` instead (the element stays focusable).',
          },
          ...functionProps(
            "PopoverTriggerState",
            "Rendered from optimistic state; must not suspend.",
          ),
          renderProp("button", "PopoverTriggerState"),
        ]}
      />
      <PartFacts
        state={
          "`PopoverTriggerState` is `{ open, pending, disabled }`; `pending` is true while the Root is pending: an open, a part's close or a dismissal notification."
        }
        owned={
          "`type` (on a `<button>` only), `disabled`, `aria-disabled` (library mode, link or component `render`), `commandfor`, `command`, `aria-expanded`, `onClick` (library mode), `data-open`, `data-pending`, `data-disabled`."
        }
        note={
          "A click while open is a part's close; a second click during a pending open cancels it (the latest intent wins). `aria-haspopup` and `aria-controls` pass through."
        }
      />

      <h4>
        <code>Popover.Popup</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "side",
            type: '"top" | "bottom" | "left" | "right" | "inline-start" | "inline-end" | null',
            default: '"bottom"',
            description:
              "Placement relative to the Trigger through inline `position-area`, with `position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline` flipping it when it does not fit. `inline-start` / `inline-end` follow the popup's direction (`inline-end` is the right in LTR, the left in RTL); the other four are physical. `null` emits no inline placement and no `data-side` / `data-align`: your stylesheet owns placement.",
          },
          {
            name: "align",
            type: '"start" | "center" | "end"',
            default: '"center"',
            description:
              "Alignment along the side. On a top / bottom side `start` / `end` are inline-relative (`start` lines up the inline-start edges: the left in LTR, the right in RTL); on the other sides the top / bottom edges. Ignored when `side` is `null`.",
          },
          {
            name: "keepMounted",
            type: "boolean",
            default: "false",
            description: (
              <>
                Library mode. <code>false</code>: children are not rendered while closed, so content
                that suspends holds the open until it is ready. <code>true</code>: children stay in{" "}
                <code>&lt;Activity mode="hidden"&gt;</code> (state kept, effects stopped,
                pre-rendered at low priority; not in the server HTML). Unmounting waits for the
                popover's CSS exit animation, or happens in the close commit when{" "}
                <code>transition</code> is set. Ignored in JS-free mode (always mounted).
              </>
            ),
          },
          {
            name: "initialFocus",
            type: "RefObject<HTMLElement | null> | string",
            description: (
              <>
                The element to focus on open: a ref, or a selector resolved inside the popup. The
                library writes <code>autofocus</code> on it right before <code>showPopover()</code>{" "}
                and lets the platform focus it. Default: the platform's choice for a{" "}
                <code>&lt;dialog&gt;</code> (the first focusable element, else the popup); with{" "}
                <code>render={"{<div />}"}</code> focus stays on the Trigger. In JS-free mode the
                attribute is written after mount; prefer it to <code>autoFocus</code>, which React
                writes only into server-rendered HTML (not when the Popup renders on the client, for
                example after a client navigation to a Server Component page).
              </>
            ),
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Library mode only. Forwarded to a `<ViewTransition>` around the popover element itself: animates the opening commit, content swaps, and every library-driven close (Trigger, Close, a controlled `open={false}`) in all engines. Dismissals are the browser's and animate with CSS. Default: no boundary. Keep it static; any value makes a Root inserted by a transition run the page cross-fade.",
          },
          ...functionProps("PopoverPopupState"),
          renderProp("dialog", "PopoverPopupState"),
        ]}
      />
      <PartFacts
        state={
          "`PopoverPopupState` is `{ open, side, align }`; `open` is committed (`false` in JS-free mode; `:popover-open` is the DOM truth); `side` / `align` are where the browser placed the popup while it is shown (a physical side, after any fallback flip, in both modes), your props otherwise."
        }
        owned={
          '`id`, `popover` (`"auto"`), `open` (never rendered), `aria-modal` (`"false"`: Chromium exposes a `<dialog popover>` as modal otherwise), `data-side` / `data-align` (unless `side` is `null`); `aria-labelledby` and `aria-describedby` are merged with yours.'
        }
        note={
          '`role="dialog"` is a default you can override (`"region"` or `"group"` for a non-interactive card). `onToggle` and `onBeforeToggle` are not accepted; use a `ref` for the platform events. Your `style` wins over the inline placement.'
        }
      />

      <h4>
        <code>Popover.Close</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "action",
            type: "Action<[details: ActionDetails]>",
            description: (
              <>
                Runs in this button's own transition (<code>data-pending</code> on it), then closes
                the popover: in library mode through the Root (<code>openChangeAction(false)</code>{" "}
                awaited, view transition if set), in JS-free mode with <code>hidePopover()</code>. A
                rejection reaches the nearest Error Boundary above the button and leaves the popover
                open. A second click while it is pending is ignored, and the button is{" "}
                <code>aria-disabled="true"</code> meanwhile. Without <code>action</code> in JS-free
                mode the button is a native <code>command="hide-popover"</code> invoker.
              </>
            ),
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Native `disabled`; owned, so a `render` element cannot re-enable it. With a link or component `render` where the Close handles the click (library mode, or with `action`), `aria-disabled="true"` instead (the element stays focusable).',
          },
          ...functionProps("PopoverCloseState"),
          renderProp("button", "PopoverCloseState"),
        ]}
      />
      <PartFacts
        state={"`PopoverCloseState` is `{ pending, disabled }`."}
        owned={
          "`type` (on a `<button>` only), `disabled`, `aria-disabled`, `commandfor`, `command`, `onClick` (library mode, or with `action`), `data-pending`, `data-disabled`; a `render` element cannot re-enable a disabled Close."
        }
        note={
          'In library mode the click is always intercepted, so every Close goes through the Root. A second click while the action is pending is ignored (and cancelled), and the button is `aria-disabled="true"` for as long as it shows `data-pending` (the action and the hide); never natively disabled, so it keeps focus. To hide at once and finish the work in the background, do not return the promise: `action={() => { void apply(); }}`. If the user dismisses the popover and opens it again while the action runs, the action\'s close is dropped: it belonged to the earlier open. Popovers have no return value.'
        }
      />

      <h4>
        <code>Popover.Title</code>, <code>Popover.Description</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps("PopoverTitleState"),
          {
            name: "render",
            type: "ReactElement | ((props, state: PopoverTitleState) => ReactNode)",
            description:
              "Replace the default <h2> (Title) or <p> (Description). `render={<h3 />}` changes the heading level.",
          },
        ]}
      />
      <PartFacts
        state={
          "the Popup's (`PopoverTitleState` and `PopoverDescriptionState` are `PopoverPopupState`)."
        }
        owned={"`id`."}
        note={
          "A dialog-role Popup with neither a Title nor an `aria-label` is a development warning once shown."
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Hook", "On", "Meaning"]}
        rows={[
          ["`:popover-open`", "Popup", "The popover is shown (DOM truth, both modes)."],
          [
            "`data-side`, `data-align`",
            "Popup",
            "While shown: where the browser placed the popup (`top` / `bottom` / `left` / `right`, after any flip; read from the computed `position-area`). Otherwise the requested placement. Absent with `side={null}`.",
          ],
          ["`aria-expanded`", "Trigger", "Open state, both modes (optimistic in library mode)."],
          ["`data-open`", "Trigger", "Optimistic open state (library mode only)."],
          [
            "`data-pending`",
            "Trigger",
            "An open, a part-initiated close or a dismissal notification is in flight (library mode only).",
          ],
          ["`data-pending`", "Close", "Its `action` is in flight."],
          [
            "`aria-disabled`",
            "Close",
            '`"true"` while `data-pending`: a second click is ignored meanwhile.',
          ],
          ["`data-disabled`", "Trigger, Close", "The `disabled` prop (both modes)."],
        ]}
      />
      <p>
        The Popup emits no <code>data-open</code>: <code>:popover-open</code> is exact. Enter and
        exit animate in CSS, in both modes:
      </p>
      <CodeBlock language="css">{`.popover {
  margin: 0;
  inset: auto; /* the popover UA stylesheet sets inset: 0 */
  opacity: 0;
  translate: 0 -4px;
  transition: opacity 120ms, translate 120ms, display 120ms allow-discrete, overlay 120ms allow-discrete;
}
.popover:popover-open { opacity: 1; translate: 0 0; }
@starting-style { .popover:popover-open { opacity: 0; translate: 0 -4px; } }
/* The gap, static on the requested edge (side="bottom"): a flip swaps the popup's margins, so
   it moves to the other edge by itself. */
.popover { margin-block-start: 6px; }
/* A class that serves any side: both sides of the axis, keyed on data-side, the closed logical
   values included so the first layout has the gap. A one-sided margin keyed on the resolved
   data-side is the wrong form: after a flip it lands on the far edge. */
.popover-any[data-side="top"], .popover-any[data-side="bottom"] { margin-block: 6px; }
.popover-any[data-side="left"], .popover-any[data-side="right"],
.popover-any[data-side="inline-start"], .popover-any[data-side="inline-end"] { margin-inline: 6px; }
@media (prefers-reduced-motion: reduce) { .popover { transition: none; } }`}</CodeBlock>
      <p>
        <code>data-side</code> is where the popup <strong>is</strong>, read from the computed{" "}
        <code>position-area</code> while it is shown; the{" "}
        <a href="/components/tooltip#data-attributes">Tooltip page</a> explains the mechanism, its
        render cost and the margin and animation caveats, which apply here as they are. Popover has
        no Arrow part; an arrow drawn with a pseudo-element on <code>[data-side]</code> follows a
        flip (see the <a href="/components/tooltip#arrow">Tooltip arrow</a>).
      </p>
      <h4>Right-to-left</h4>
      <p>
        <code>side="inline-start"</code> / <code>"inline-end"</code> and <code>align</code> on a top
        or bottom side use the <code>self-*</code> keywords, which follow the popup's inherited
        direction: an RTL page and an RTL container both mirror them, with no JavaScript. Firefox
        misplaces a popover inside a direction island (
        <a href="https://github.com/uhyo/funstack-ui/issues/89">#89</a>; see{" "}
        <a href="/components/tooltip#browser-notes">Tooltip</a>).
      </p>
      <p>
        The exit animates in Chromium and Safari; Firefox hides a popover instantly. The library
        keeps the content mounted until the exit animation ends, so a fading popover is never empty.
        On iOS, <code>position-try-fallbacks</code> together with <code>@starting-style</code> can
        hang (WebKit bug 317926).
      </p>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Behaviour", "Who"]}
        rows={[
          ["Enter / Space on the Trigger", "Toggles", "the browser (JS-free) or the Trigger"],
          [
            "Tab / Shift+Tab",
            "Moves through the popup; the popup follows the Trigger in focus order. Tab past the end leaves, and the popover stays open",
            "the browser",
          ],
          [
            "Escape",
            'Closes the innermost open popover; focus returns to its Trigger; `openChangeAction(false, { reason: "dismiss" })`',
            "the browser (and the library for a nested popover)",
          ],
          [
            "Escape in a modal Dialog opened from the popup",
            "Closes the Dialog only; a second Escape closes the popover",
            "the browser",
          ],
        ]}
      />
      <ul>
        <li>
          <strong>Initial focus.</strong> With the default <code>&lt;dialog&gt;</code>, opening runs
          the dialog focusing steps: the <code>initialFocus</code> target, else the first focusable
          element, else the popup itself (the APG non-modal dialog), in every engine. For a
          disclosure-style card that keeps focus on the Trigger, render a <code>&lt;div&gt;</code>:{" "}
          <code>render={"{<div />}"}</code> with <code>role="region"</code> and an{" "}
          <code>aria-label</code>.
        </li>
        <li>
          <strong>Focus return.</strong> The platform returns focus to the Trigger for the first
          popover in a stack. For a <strong>nested</strong> popover it returns nothing, so the
          library focuses the inner Trigger when focus was inside the popup and was left on the
          body. A click outside leaves focus where the click put it.
        </li>
        <li>
          <strong>ARIA.</strong> The Popup has <code>role="dialog"</code> and{" "}
          <code>aria-modal="false"</code> explicitly (WebKit implements no minimum role for
          popovers; Chromium would expose a <code>&lt;dialog popover&gt;</code> as modal). The
          Trigger has <code>aria-expanded</code> in both modes and no <code>aria-haspopup</code>{" "}
          (the APG disclosure shape); add <code>aria-haspopup="dialog"</code> or{" "}
          <code>aria-controls</code> yourself if you want them.
        </li>
        <li>
          No focus trap and no <code>lightDismiss</code> or <code>modal</code> prop: light dismiss
          and Escape are what <code>popover="auto"</code> is. A panel that must survive stray clicks
          is a <a href="/components/dialog">Dialog</a>.
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "Library mode: `fsui-popover` plus `fsui-popover-open` or `fsui-popover-close`; a controlled close carries none. JS-free mode starts no transitions."
        }
      >
        <h4>ViewTransition: an exit in every engine</h4>
        <p>
          With <code>transition</code>, the Popup renders <code>&lt;ViewTransition&gt;</code> around
          the popover element itself. A library-driven open shows the popover in the layout effect
          of its commit and a library-driven close hides it in the layout effect of its commit, so
          the view transition captures the popup's box as <code>::view-transition-new</code> on open
          and <code>::view-transition-old</code> (with its content) on close. That is the only way a
          popover's exit can animate in Firefox.
        </p>
        <CodeBlock>{`<Popover.Popup transition={{ "fsui-popover-open": "pop-in", "fsui-popover-close": "pop-out", default: "none" }}>`}</CodeBlock>
        <CodeBlock language="css">{`::view-transition-new(.pop-in) { animation: 160ms ease-out both pop-in; }
::view-transition-old(.pop-out) { animation: 120ms ease-in both pop-out; }
/* Keep the CSS exit above for dismissals, but not while a view transition runs. */
html:active-view-transition .popover { transition: none; }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}`}</CodeBlock>
        <ul>
          <li>
            Transition types: <code>fsui-popover</code> plus <code>fsui-popover-open</code> or{" "}
            <code>fsui-popover-close</code>. A controlled close carries none.
          </li>
          <li>
            Dismissals (Escape, a click outside) happen in the browser before React hears about
            them, so they animate with the CSS exit only: keep it. Cut it while a view transition
            runs (<code>html:active-view-transition .popover {"{ transition: none; }"}</code>):
            otherwise a popover hidden by the library stays rendered through its fade, and Chromium
            captures it in the close's new snapshot as well, a double image. The untyped selector is
            deliberate: a controlled close carries no transition types. The cost: an unrelated view
            transition of the page also cuts a fade in progress.
          </li>
          <li>
            A plain open starts no document view transition: the content mounts under the
            already-mounted popover element. A Popup with <code>transition</code> that itself mounts
            inside a transition (a Root inserted by one, a nested Popup mounting with the outer
            content) runs the page cross-fade (
            <a href="/concepts/transitions#transition-prop">the transition prop</a>, issue{" "}
            <a href="https://github.com/uhyo/funstack-ui/issues/35">#35</a>). The page receives no
            pointer events while a view transition runs: keep them short.
          </li>
        </ul>
      </BehaviourSection>

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "Library mode: the Trigger shows the optimistic open state (`aria-expanded`, `data-open`) and `data-pending` while an open, a part's close or a dismissal notification is in flight. The Popup's content renders from the committed `open`. A Close with an `action` is a [pure trigger](/concepts/pending-and-optimistic#pure-trigger)."
        }
      >
        <h4>Walkthrough (library mode)</h4>
        <Example
          source={popoverActionsSource}
          fileName="PopoverActions.tsx"
          css={popoverCss}
          cssFileName="popover.css"
        >
          <PopoverActions />
        </Example>
        <ol>
          <li>
            Click ⋯: the click is cancelled (so the native command does not run), the Trigger gets{" "}
            <code>aria-expanded="true"</code>, <code>data-open</code> and <code>data-pending</code>,
            and <code>openChangeAction(true, {'{ reason: "activate" }'})</code> runs.
          </li>
          <li>
            The commit that sets committed <code>open</code> renders the Popup's children;{" "}
            <code>RowActions</code> suspends, so React holds the commit. The popup stays hidden; the
            Trigger keeps spinning.
          </li>
          <li>
            The data arrives: the content commits and{" "}
            <code>showPopover({"{ source: trigger }"})</code> runs in the same commit, so the popup
            is anchored below the Trigger and the platform focuses fully rendered content. With{" "}
            <code>transition="pop"</code> it animates in.
          </li>
          <li>
            Click Archive: the button shows its own pending label while its action runs; then the
            Close dispatches <code>openChangeAction(false, {'{ reason: "activate" }'})</code> and
            the commit that ends it hides the popup inside a view transition: the exit animates in
            every engine.
          </li>
          <li>
            Press Escape or click outside instead: the browser hides the popover at once (CSS fade),
            and the Root receives <code>openChangeAction(false, {'{ reason: "dismiss" }'})</code>.
          </li>
        </ol>
        <Callout kind="warning" title="Refusing a close">
          <p>
            A controlled parent that keeps <code>open</code> after a <strong>part-initiated</strong>{" "}
            close vetoes it: nothing was hidden, the Trigger's <code>data-open</code> snaps back.
            After a <strong>dismissal</strong> the popover is already hidden; a parent that keeps{" "}
            <code>open</code> gets it re-opened once the action settles, which the user sees as a
            blink. Adopt <code>false</code> for dismissals.
          </p>
        </Callout>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "Content that suspends holds the open: the popup stays hidden with the Trigger pending, then shows once, complete. A `<Suspense>` inside the Popup opens at once with a skeleton instead."
        }
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'JS-free mode: the browser owns everything through Invoker Commands. Library mode: opening and a close asked for by a part are library-owned; a dismissal (Escape, a click outside, another popover opening) is the browser\'s: the popover closes at once and `openChangeAction(false)` is a notification with `reason: "dismiss"`. Dismissals animate with CSS only.'
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'JS-free mode: everything, including `autoFocus` in server-rendered markup. Library mode: the Trigger opens the popover natively, but the content is not in the HTML yet; on hydration the Popup finds it open, dispatches `openChangeAction(true)` with `reason: "platform"` and the content mounts.'
        }
      >
        <h4 id="the-platform-paths">
          The <a href="/concepts/browser-owned-state#platform-path">platform paths</a>
        </h4>
        <ul>
          <li>
            <strong>Before hydration, JS-free mode:</strong> everything works, including{" "}
            <code>autoFocus</code> in server-rendered markup. After hydration, and for content React
            renders on the client, use <code>initialFocus</code>: React does not write{" "}
            <code>autofocus</code> on client-rendered elements.
          </li>
          <li>
            <strong>Before hydration, library mode:</strong> the Trigger already carries the
            command, so a click opens the popover natively, but the content is not in the HTML yet
            (with <code>defaultOpen</code> it is, and the Trigger already says it is expanded; only
            the showing waits for hydration). On hydration the Popup finds it open and dispatches{" "}
            <code>openChangeAction(true, {'{ reason: "platform" }'})</code> with no event; the
            content mounts into the open popover. If the action rejects or a controlled parent
            refuses, the popover closes again.
          </li>
          <li>
            <strong>Foreign invokers and scripts:</strong> in library mode any open that the library
            did not start (a <code>&lt;button commandfor command="show-popover"&gt;</code>, a script{" "}
            <code>showPopover()</code>) is cancelled at <code>beforetoggle</code> and dispatched
            with that <code>ToggleEvent</code>. A foreign <code>hide-popover</code> closes it
            natively and is reported as <code>"activate"</code>.
          </li>
        </ul>
      </BehaviourSection>

      <h3 id="recipes">Recipes</h3>
      <h4>Submit, then close (controlled)</h4>
      <CodeBlock>{`const [open, setOpen] = useState(false);

<Popover.Root open={open} openChangeAction={(next) => { setOpen(next); }}>
  <Popover.Trigger>Rename</Popover.Trigger>
  <Popover.Popup initialFocus="[name=title]">
    <Popover.Title>Rename</Popover.Title>
    <form
      action={async (formData) => {
        await rename(formData);
        startTransition(() => setOpen(false)); // a library-driven close: view transition if set
      }}
    >
      <input name="title" defaultValue={title} />
      <SubmitButton>Save</SubmitButton>
      <Popover.Close>Cancel</Popover.Close>
    </form>
  </Popover.Popup>
</Popover.Root>`}</CodeBlock>
      <h4>Controlled, opened without a Trigger</h4>
      <CodeBlock>{`<Popover.Root open={open} openChangeAction={(next) => { setOpen(next); }}>
  <Popover.Popup side={null} className="popover centered">…</Popover.Popup>
</Popover.Root>`}</CodeBlock>
      <p>
        Without a Trigger there is no anchor: the popover is centred by the UA stylesheet unless you
        position it, so use <code>side={"{null}"}</code>.
      </p>
      <h4>Nested popovers</h4>
      <CodeBlock>{`<Popover.Root defaultOpen={false}>
  <Popover.Trigger>Share</Popover.Trigger>
  <Popover.Popup>
    <Popover.Title>Share</Popover.Title>
    <Popover.Root defaultOpen={false}>                {/* nested auto popover */}
      <Popover.Trigger>Permissions</Popover.Trigger>
      <Popover.Popup side="right" align="start">…</Popover.Popup>
    </Popover.Root>
  </Popover.Popup>
</Popover.Root>`}</CodeBlock>
      <p>
        Opening the inner keeps the outer open; Escape closes the inner and focus returns to
        "Permissions"; a click outside closes both. Outer parts must sit outside the inner Root.
        Leave <code>transition</code> off an inner Popup unless you want the animation (it pays the
        page cross-fade when it mounts with the outer content). In Safari, a nested popover with{" "}
        <code>position-try-fallbacks</code> can hang (WebKit bug 302008): give the inner Popup{" "}
        <code>side={"{null}"}</code> and place it in CSS if you hit it.
      </p>
    </div>
  );
}
