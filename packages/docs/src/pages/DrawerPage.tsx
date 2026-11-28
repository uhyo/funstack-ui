import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { DrawerFilters } from "../examples/DrawerFilters.js";
import { DrawerNavigation } from "../examples/DrawerNavigation.js";
import { functionProps, renderProp } from "./shared-props.js";

export function DrawerPage() {
  return (
    <DocPage
      title="Drawer"
      description="A dialog attached to an edge of the viewport that the user can swipe back to it, with mouse, pen or touch. A Dialog underneath: top layer, focus, Escape, the JS-free mode; the swipe is a dismissal reported to onOpenChange, and your CSS moves the drawer through three custom properties."
    >
      <p className="page-intro">
        A drawer (a sheet) is a <code>{"<dialog>"}</code> on an edge of the screen: a bottom sheet
        of filters on a phone, a navigation panel from the side. It is a{" "}
        <a href="/components/dialog">Dialog</a>, with one prop that says which edge and one gesture:
        drag it toward that edge and let go past a quarter of its size, or flick it, and it slides
        out and closes. The library tracks the pointer and writes where it is; your stylesheet
        places the drawer and moves it.
      </p>

      <Example file="DrawerFilters.tsx" css="drawer.css">
        <DrawerFilters />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Drawer } from "@funstack/ui/drawer";

<Drawer.Root>                                    {/* no DOM: ids, mode, state */}
  <Drawer.Trigger>Filters</Drawer.Trigger>
  <Drawer.Popup side="bottom">                   {/* dialog[data-side=bottom] */}
    <div className="grabber" aria-hidden />      {/* decoration, yours */}
    <Drawer.Title>Filters</Drawer.Title>
    <div className="drawer-body">…</div>         {/* scrolls; a press here never drags */}
    <Drawer.Close>Done</Drawer.Close>
  </Drawer.Popup>
</Drawer.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>Every part is a Dialog part.</strong> Root, Trigger, Popup, Title, Description,
          Close and Form run the code of the Dialog parts of the same name. Everything the{" "}
          <a href="/components/dialog">Dialog</a> page says applies unless this page says otherwise:
          the two modes, focus and focus return, Escape, <code>keepMounted</code>,{" "}
          <code>initialFocus</code>, <code>transition</code>, <code>render</code>, the Form. A{" "}
          <code>Dialog.Close</code> inside a <code>Drawer.Popup</code> closes the drawer, and an{" "}
          <a href="/components/alert-dialog">AlertDialog</a> nested in a drawer is its confirm.
        </li>
        <li>
          <strong>What it adds.</strong> <code>side</code> (the edge, rendered as{" "}
          <code>data-side</code>), <code>swipeDismiss</code> (on by default), and{" "}
          <code>lightDismiss</code> on by default for a modal drawer.
        </li>
        <li>
          <strong>What it does not.</strong> No handle, backdrop, portal or viewport part (a grabber
          is a <code>{"<div aria-hidden>"}</code>: the whole drawer is the grab area; the backdrop
          is <code>::backdrop</code>), no snap points, no swipe from the screen edge to open, no
          scaling of the page behind it. The library ships no CSS and writes no inset, size or
          transform.
        </li>
        <li>
          <strong>Always render a Close.</strong> It is the way to close the drawer before hydration
          on a phone, and the alternative to the swipe that WCAG 2.5.1 asks for. Development warns
          when a drawer with the swipe has shown without one.
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <Table
        head={["", "Drawer"]}
        rows={[
          [
            "Edge",
            '`side`: `"top"`, `"bottom"` (default), `"left"`, `"right"`, `"inline-start"`, `"inline-end"`; rendered as `data-side` in every mode and in the server HTML. Your CSS places the drawer from it',
          ],
          [
            "Swipe",
            "Mouse, pen or touch, one pointer, after hydration. A drag toward the edge sets `data-swiping` and the inline `--drawer-swipe-x`, `--drawer-swipe-y`, `--drawer-swipe-progress`; your `translate` follows them",
          ],
          [
            "Release",
            "Past 25% of the drawer's extent, or faster than 0.5 px/ms toward the edge: the library writes the full extent, waits for your transition to carry the drawer off, then calls `requestClose()`. Moving back at the release, or short of the threshold: the properties are removed and your transition brings it back",
          ],
          [
            "The close",
            'A dismissal, a fact: `onOpenChange(false, { reason: "dismiss", event: <the pointerup>, returnValue: "" })`. Never `openChangeAction`, never pending, never a view transition',
          ],
          [
            "Scroll",
            "A press inside a scroll container along the drawer's axis scrolls it and never drags. The Popup renders an inline `touch-action` that leaves that axis to the gesture",
          ],
          [
            "Backdrop press",
            "Closes a modal drawer (`lightDismiss` defaults to the Root's `modal`), a dismissal; a non-modal drawer stays open",
          ],
          ["Escape, Close, Form", "Dialog's"],
          [
            "Modes",
            "Dialog's: JS-free without open-state props on the Root, library mode with any. The swipe works in both after hydration",
          ],
        ]}
      />

      <h3 id="swipe">The swipe</h3>
      <p>
        A press is only recorded: no capture, no <code>preventDefault()</code>, so a tap, a click
        and a text field are untouched. The press becomes a drag when the pointer has moved 6 px,
        more along the drawer's axis than across it and toward the edge; a first move in another
        direction drops it for good. From then on the pointer is captured on the dialog, and the
        offset (never below 0) is written on every move, with no React render. The numbers are
        fixed: 25% of the extent (the distance that takes the drawer fully off its edge, measured
        when the drag starts), 0.5 px/ms measured over the last 100 ms, and a return when the
        pointer was moving back faster than 0.1 px/ms.
      </p>
      <Table
        head={["A press that never drags", "Why"]}
        rows={[
          ["On the `::backdrop`", "It is a press outside (light dismiss)"],
          ["Inside a nested `<dialog>` or an open popover", "The press is that layer's"],
          [
            "On an `input`, `textarea`, `select` or `[contenteditable]`",
            "Text entry and range controls keep their pointer",
          ],
          [
            "Inside a scroll container along the drawer's axis",
            "By computed `overflow` (`auto` or `scroll`), whether or not it overflows now: the scroller's (see below)",
          ],
          [
            "Its `pointerdown` was `preventDefault()`-ed",
            "Your opt-out, read when the drag would start, so a React handler counts. It also stops a mouse press from focusing or selecting there: use it on non-focusable regions",
          ],
          ["Another element captured the pointer", "A slider thumb, a map, a canvas"],
          ["While the drawer slides out after a release", "One gesture at a time"],
        ]}
      />
      <p>
        A mouse drag moves the drawer and does not select text: a selection the press made is
        removed while it drags. The <code>click</code> that follows a mouse drag lands on the
        dialog, so the button the drag started on is not activated. <code>pointercancel</code>, a
        lost capture, a second pointer's press, or the dialog closing for another reason (Escape, a
        Form settling) ends the drag: the drawer returns, or closes with that other cause.
      </p>
      <Callout title="The drag needs a CSS transition on translate">
        The release is your <code>transition</code> on <code>translate</code>: it carries the drawer
        off its edge (the library waits for it, in Firefox too, which has no CSS exit for a{" "}
        <code>{"<dialog>"}</code>) and brings a cancelled drag back. A drawer with only a{" "}
        <code>transition</code> prop (a view transition) and no CSS transition jumps at the release:
        a swipe never starts a view transition. Both may be set.
      </Callout>

      <h3 id="scrolling">Scroll inside the drawer</h3>
      <p>
        A press inside a scroll container along the drawer's axis is that container's, for every
        pointer type: the body scrolls; the header, the grabber, the footer and the padding drag.
        The Popup renders <code>touch-action: pan-x pinch-zoom</code> (top and bottom) or{" "}
        <code>pan-y pinch-zoom</code> (the side drawers), so a touch drag on the drawer's axis
        reaches the gesture instead of panning the page; a <code>style</code> of yours overrides it.
      </p>
      <ul>
        <li>
          <strong>A top or bottom drawer scrolls in a child.</strong> Give the body{" "}
          <code>overflow-y: auto</code> and the dialog <code>overflow: hidden</code>. The dialog
          itself cannot be scrolled by touch while the swipe owns the vertical axis; development
          warns when a top or bottom drawer is its own scroller and its content overflows.
        </li>
        <li>
          <strong>A side drawer scrolls in the Popup.</strong> Its content scrolls vertically,
          natively; a horizontal drag is the swipe. Note that <code>overflow-y: auto</code> on a
          child also makes it a horizontal scroll container (CSS computes the other axis to{" "}
          <code>auto</code>), so a press in a scrolling child of a side drawer does not drag. To
          drag from such a list, give it <code>overflow-x: hidden</code> and{" "}
          <code>touch-action: pan-y pinch-zoom</code> (as in the starter stylesheet). Development
          warns once when a press in a side drawer is refused by such a list.
        </li>
        <li>
          Add <code>overscroll-behavior: contain</code> on the scrolling body so a scroll that
          reaches its end does not move the page, and lock the page's scroll with the CSS recipe in
          the example (<code>{"html:has(.drawer:modal) { overflow: hidden }"}</code>).
        </li>
        <li>
          Pulling a list that is scrolled to its top to drag the sheet down (the phone idiom) is not
          in this version.
        </li>
      </ul>

      <h3 id="props">Props</h3>
      <h4>
        <code>Drawer.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "open",
            type: "boolean",
            description:
              "Controlled open state. undefined means uncontrolled. Selects library mode. Pass `onOpenChange` too: Escape, a backdrop press and a swipe close the drawer without asking (development warns).",
          },
          {
            name: "defaultOpen",
            type: "boolean",
            description:
              "Initial open state in uncontrolled library mode. `defaultOpen={false}` selects library mode without an action.",
          },
          {
            name: "openChangeAction",
            type: "ChangeAction<boolean, DrawerOpenChangeDetails>",
            description:
              "Requests only: the Trigger (`true`), a Close, a Form submit or settle, a foreign close command (`false`, with `details.returnValue` the part's `value`). Awaited; the drawer opens or closes when it resolves; a controlled parent that keeps `open` vetoes a close. Never called for a swipe, Escape or a backdrop press. Runs in the Root's transition; may be a Server Function; rejections reach the nearest Error Boundary above the Root. Selects library mode.",
          },
          {
            name: "onOpenChange",
            type: "UrgentChangeHandler<boolean, DrawerOpenChangeDetails>",
            description:
              'Facts only: a swipe released past the threshold, Escape, a backdrop press, Android back, a script `close()` / `requestClose()`. Always `false`, with `reason: "dismiss"` and `returnValue` as the browser left it (`""`). A swipe\'s `details.event` is its `pointerup`: tell it from Escape with `details.event?.type`. Called synchronously in the `close` event, outside any transition. In controlled mode set state directly here (`onOpenChange={setOpen}`); a parent that keeps `open={true}` gets the drawer shown again at once, and your CSS enter slides it back in. Selects library mode.',
          },
          {
            name: "modal",
            type: "boolean",
            default: "true",
            description:
              "`showModal()` (top layer, backdrop, inert page, Escape) or `show()`: a non-modal drawer is a side panel next to a page that stays usable. A non-modal drawer needs JavaScript to open (there is no `show` command).",
          },
          {
            name: "children",
            type: "ReactNode | ((state: DrawerRootState) => ReactNode)",
            description:
              "The parts. The function form receives the optimistic state and must not suspend.",
          },
        ]}
      />
      <PartFacts
        state={"`DrawerRootState` is `{ open, pending, modal }` (Dialog's)."}
        owned={"none: the Root renders no element (no `ref`, `className` or `style`)."}
      />

      <h4>
        <code>Drawer.Trigger</code>
      </h4>
      <p>
        <code>Dialog.Trigger</code>, unchanged: <code>{'<button command="show-modal">'}</code> in
        JS-free mode, a request through the Root with <code>data-open</code> and{" "}
        <code>data-pending</code> in library mode. Props: <code>disabled</code>,{" "}
        <code>className</code>, <code>style</code>, <code>children</code> (functions of{" "}
        <code>DrawerTriggerState</code>, <code>{"{ open, pending, disabled }"}</code>),{" "}
        <code>render</code>. In JS-free mode <code>data-open</code> follows the dialog; inside a
        <code>Toolbar.Root</code> a disabled Trigger is <code>aria-disabled</code> and stays
        focusable. See <a href="/components/dialog#props">Dialog.Trigger</a>.
      </p>

      <h4>
        <code>Drawer.Popup</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "side",
            type: '"top" | "bottom" | "left" | "right" | "inline-start" | "inline-end"',
            default: '"bottom"',
            description:
              "The edge the drawer is attached to. Rendered as `data-side` (a prop echo, also in the server HTML) and `state.side`; the swipe goes toward it. `inline-start` / `inline-end` follow the drawer's own `direction` (read at the press). The library places nothing: style `[data-side]`.",
          },
          {
            name: "swipeDismiss",
            type: "boolean",
            default: "true",
            description:
              "Let the user drag the drawer toward its edge to close it (mouse, pen, touch; after hydration). The close is a dismissal: `onOpenChange`, never `openChangeAction`. While dragging the drawer has `data-swiping` and the `--drawer-swipe-*` properties. Also renders the inline `touch-action`. `false`: a drawer only its buttons, Escape and the backdrop close.",
          },
          {
            name: "lightDismiss",
            type: "boolean",
            default: "the Root's `modal`",
            description:
              'Close on a press outside the drawer (the `::backdrop` of a modal one): Dialog\'s JS `pointerdown` and `click` baseline, or native `closedby="any"` with `experimental_closedBy`. On for a modal drawer, off for a non-modal one (a side panel must survive clicks on the page). Before hydration, without the flag, a backdrop press does nothing.',
          },
          {
            name: "experimental_closedBy",
            type: "boolean",
            default: "false",
            description:
              'As on `Dialog.Popup`: renders `closedby` (`"any"` with `lightDismiss`, else `"closerequest"`) and skips the JS dismiss listeners where the browser implements it. See [Experimental features](/concepts/experimental).',
          },
          {
            name: "initialFocus",
            type: "RefObject<HTMLElement | null> | string",
            description: "As on `Dialog.Popup`: the element to focus on open.",
          },
          {
            name: "keepMounted",
            type: "boolean",
            default: "false",
            description:
              'Library mode: keep the children in `<Activity mode="hidden">` while closed instead of unmounting them. Ignored in JS-free mode (always mounted).',
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Library mode only. Forwarded to the `<ViewTransition>` around the dialog: animates the open and every library-driven close (Close, Form, a controlled close). A swipe, Escape and a backdrop press animate with CSS only. Types `fsui-drawer`, `fsui-drawer-open`, `fsui-drawer-close`.",
          },
          ...functionProps("DrawerPopupState"),
          renderProp("dialog", "DrawerPopupState"),
        ]}
      />
      <PartFacts
        state={
          "`DrawerPopupState` is `{ open, modal, side }`; `open` is committed (`false` in JS-free mode; `:open` is the DOM truth). A drag is not in the state: it is `data-swiping` and the custom properties."
        }
        owned={
          "Dialog.Popup's (`id`, `open`, `closedby`, `data-modal`, `suppressHydrationWarning`; `aria-labelledby` and `aria-describedby` merged with yours), `data-side`, `data-swiping`. The inline `touch-action` is merged under your `style`. The `--drawer-swipe-*` properties are written through the DOM and are not part of the rendered `style`: do not set them yourself."
        }
        note={"`role`, `onCancel` and the other `<dialog>` props pass through."}
      />

      <h4>
        <code>Drawer.Close</code>
      </h4>
      <p>
        <code>Dialog.Close</code>, unchanged: <code>{'<button command="request-close">'}</code> in
        JS-free mode, a close request through the Root in library mode; with an <code>action</code>,
        the action runs first in the button's own transition (<code>data-pending</code>) and a
        rejection leaves the drawer open. With or without <code>action</code>, the button has{" "}
        <code>data-pending</code> until the close it asked for has committed. Props:{" "}
        <code>action</code> (details: <code>DrawerCloseActionDetails</code>),{" "}
        <code>whilePending</code>, <code>value</code>, <code>disabled</code>, <code>className</code>
        , <code>style</code>, <code>children</code> (functions of <code>DrawerCloseState</code>,{" "}
        <code>{"{ pending, disabled }"}</code>), <code>render</code>. See{" "}
        <a href="/components/dialog#props">Dialog.Close</a>.
      </p>

      <h4>
        <code>Drawer.Form</code>, <code>Drawer.Title</code>, <code>Drawer.Description</code>
      </h4>
      <p>
        <code>Dialog.Form</code>, <code>Dialog.Title</code> and <code>Dialog.Description</code>,
        unchanged: the same props, state types (<code>DrawerFormState</code> is{" "}
        <code>{"{ pending }"}</code>; Title and Description get the Popup's{" "}
        <code>{"{ open, modal }"}</code>) and owned keys. See{" "}
        <a href="/components/dialog#props">the Dialog props</a>.
      </p>

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          ["`:open`, `:modal`, `::backdrop`", "Popup", "As on a Dialog."],
          [
            "`data-side`",
            "Popup",
            "The `side` prop, in every mode and in the server HTML. Never flipped.",
          ],
          ["`data-modal`", "Popup", "The Root's `modal` is `true`."],
          [
            "`data-swiping`",
            "Popup",
            "A pointer is dragging the drawer, from the drag's start to its release. Written by the gesture, never server-rendered, not in the state. Turn your transitions off under it.",
          ],
          [
            "`--drawer-swipe-x`, `--drawer-swipe-y`",
            "Popup (inline)",
            "The offset as a physical vector in px: `0px 120px` for a bottom drawer pulled down 120 px, `-80px 0px` for a left one. Absent when nothing has moved the drawer; set to the full extent during a release's slide; removed by the close or the return.",
          ],
          [
            "`--drawer-swipe-progress`",
            "Popup (inline)",
            "Offset / extent, from 0 to 1. `::backdrop` inherits it.",
          ],
          [
            "`data-open`",
            "Trigger",
            "As on a Dialog: optimistic in library mode; in JS-free mode whether the dialog is open, written from its `toggle` event.",
          ],
          ["`data-pending`", "Trigger", "Library mode: as on a Dialog."],
          [
            "`data-pending`",
            "Close",
            "From the click until the close it asked for has committed: its `action`, then the Root's close (library mode, also without `action`).",
          ],
          ["`data-disabled`", "Trigger, Close", "The `disabled` prop."],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <p>
        A drawer is a dialog: the role, the name (the Title), the description, the focus moves and
        the keys are <a href="/components/dialog#keyboard-and-aria">Dialog's</a>. Escape closes a
        modal drawer (and, through the library, a non-modal one). The swipe is a path-based gesture,
        so it always has an alternative: Escape, the backdrop of a modal drawer, and the Close part.
        A grabber is decoration (<code>aria-hidden</code>), not a button: no key could perform its
        action.
      </p>

      <BehaviourSection
        id="transition-types"
        summary={
          "Library mode tags an open with `fsui-drawer` plus `fsui-drawer-open`, a Close or Form close with `fsui-drawer` plus `fsui-drawer-close`. Not Dialog's types: a drawer slides where a dialog fades, so a page-level `:active-view-transition-type()` rule can tell them apart. A swipe, Escape and a backdrop press are facts and carry none."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "As a Dialog's: the Trigger is pending while an open is in flight, a Close is pending from the click until the close it asked for has committed (its `action`, then the Root's close; also without `action`). A swipe is never pending: it is a fact, reported the moment the browser closes the dialog, and it supersedes a close a part asked for. A Close action that is still running keeps running; its close is then a no-op."
        }
      >
        <h4>Walkthrough: a swipe</h4>
        <ol>
          <li>
            Press on the header and drag down: <code>data-swiping</code> appears and{" "}
            <code>--drawer-swipe-y</code> follows the pointer; your <code>translate</code> moves the
            drawer and your backdrop fades with <code>--drawer-swipe-progress</code>.
          </li>
          <li>
            Release at 40%: <code>data-swiping</code> goes, the properties jump to the full extent,
            and your transition slides the drawer off its edge.
          </li>
          <li>
            When that transition has finished (at once with <code>transition: none</code>), the
            library calls <code>requestClose()</code>. Your <code>onCancel</code> sees it:
            preventing it keeps the drawer open, and it slides back. Otherwise the dialog closes,
            focus returns to the Trigger, and{" "}
            <code>onOpenChange(false, {'{ reason: "dismiss", event }'})</code> is called with the{" "}
            <code>pointerup</code>.
          </li>
        </ol>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "As a Dialog's: content that suspends holds the open, the Trigger is pending, and the drawer slides in complete. A child that re-renders or suspends while a pointer drags changes nothing: the gesture holds no React state."
        }
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          "JS-free mode: the browser owns everything, and the swipe closes the dialog with `requestClose()` after hydration. Library mode: the Trigger, Close and Form are requests (`openChangeAction`); a swipe, Escape and a backdrop press are the browser's facts (`onOpenChange`). Pass the same setter to both props of a controlled Root."
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'JS-free mode: the Trigger (`command="show-modal"`), the Close (`command="request-close"`), Escape, the content, `data-side` and the `touch-action` are in the server HTML, and the CSS enter and exit run; it works from a Server Component. Before hydration a backdrop press does nothing (without `experimental_closedBy`) and a swipe does nothing (the drawer\'s axis does not pan the page either): the Close is what closes it on a phone. After hydration the swipe works in JS-free mode too.'
        }
      >
        <Example file="DrawerNavigation.tsx" css="drawer.css">
          <DrawerNavigation />
        </Example>
        <p>
          This navigation drawer is a Server Component, on <code>side="inline-start"</code>: on the
          left in a left-to-right page, on the right in a right-to-left one, with no script.
        </p>
      </BehaviourSection>

      <h3 id="recipes">Recipes</h3>
      <h4 id="starter-stylesheet">The starter stylesheet</h4>
      <p>
        One <code>transition</code> on <code>translate</code> is the enter, the exit, the release of
        a swipe and the return of a cancelled one. Closed positions go in <code>:where()</code> so
        that the <code>:open</code> rule wins whatever the side selector's specificity:
      </p>
      <CodeBlock language="css">{`.drawer {
  position: fixed; margin: 0; border: 0;
  max-inline-size: none; max-block-size: none;
  transition: translate 300ms cubic-bezier(.32, .72, 0, 1),
              display 300ms allow-discrete, overlay 300ms allow-discrete;
}
.drawer:where([data-side="bottom"]) {
  inset: auto 0 0 0; inline-size: 100%; max-block-size: 90dvh;
  overflow: hidden;                     /* scroll in a child */
  translate: 0 100%;                    /* closed: off its edge */
}
.drawer:where([data-side="inline-end"]) {
  inset-block: 0; inset-inline: auto 0; block-size: 100dvh; inline-size: min(24rem, 90vw);
}
.drawer:where([data-side="inline-end"]:dir(ltr)) { translate: 100% 0; }
.drawer:where([data-side="inline-end"]:dir(rtl)) { translate: -100% 0; }

/* Open: at the edge, moved by the swipe. */
.drawer:open { translate: var(--drawer-swipe-x, 0px) var(--drawer-swipe-y, 0px); }
@starting-style {
  .drawer[data-side="bottom"]:open { translate: 0 100%; }
  /* … one line per side you use */
}

/* While a pointer drags, the pointer leads. */
.drawer[data-swiping], .drawer[data-swiping]::backdrop { transition: none; }

/* A side drawer's vertical list that the swipe may start in (see Scroll inside the drawer). */
.drawer:where(:not([data-side="top"], [data-side="bottom"])) .drawer-list {
  overflow-x: hidden; overflow-y: auto; touch-action: pan-y pinch-zoom;
}`}</CodeBlock>

      <h4 id="backdrop-fade">The backdrop follows the drag</h4>
      <p>
        <code>::backdrop</code> inherits custom properties from its dialog in every engine, so the
        backdrop can fade as the drawer goes:
      </p>
      <CodeBlock language="css">{`.drawer::backdrop {
  background: rgb(0 0 0 / .45);
  opacity: 0;
  transition: opacity 300ms, display 300ms allow-discrete, overlay 300ms allow-discrete;
}
.drawer:open::backdrop { opacity: calc(1 - var(--drawer-swipe-progress, 0)); }
@starting-style { .drawer:open::backdrop { opacity: 0; } }`}</CodeBlock>

      <h4 id="swipe-variables">Using the swipe variables</h4>
      <p>
        The two physical components serve every side with one rule. Anything else can read them too,
        inside the drawer:
      </p>
      <CodeBlock language="css">{`/* Rounder corners as the sheet is pulled down. */
.drawer[data-side="bottom"] {
  border-radius: calc(12px + 12px * var(--drawer-swipe-progress, 0))
                 calc(12px + 12px * var(--drawer-swipe-progress, 0)) 0 0;
}

/* A slight resistance: the drawer moves at 80% of the pointer. */
.drawer.stiff[data-swiping] {
  translate: calc(var(--drawer-swipe-x, 0px) * .8) calc(var(--drawer-swipe-y, 0px) * .8);
}`}</CodeBlock>
      <p>
        Do not set the properties yourself: the library writes and removes them. Scale them only
        under <code>[data-swiping]</code>: the release writes the full extent, which an
        always-scaled rule would stop short of the edge. Scaling changes only how far the drawer
        moves during the drag, not where the release decides: the threshold is measured on the
        pointer.
      </p>

      <h4 id="reduced-motion">Reduced motion</h4>
      <p>
        The library makes no <code>matchMedia</code> check. The drag is direct manipulation and
        stays; turn off the slides, and the release closes the drawer at once (there is nothing to
        wait for) or puts it back in one frame:
      </p>
      <CodeBlock language="css">{`@media (prefers-reduced-motion: reduce) {
  .drawer, .drawer::backdrop { transition: none; }
}`}</CodeBlock>

      <h4 id="background-scaling">Scaling the page behind it</h4>
      <p>
        Not a feature: the element is yours, outside the component. The static effect is one rule;
        it does not follow the finger (the properties are on the dialog, not on its ancestors).
      </p>
      <CodeBlock language="css">{`.app { transition: scale 300ms, border-radius 300ms; transform-origin: top; }
html:has(.drawer:modal) .app { scale: .96; border-radius: 12px; }

/* A drawer that steps back while a nested one is open (the inner one is in the top layer). */
.drawer:has(dialog:open) { scale: .96; }`}</CodeBlock>

      <h4>Tell a swipe from Escape</h4>
      <CodeBlock>{`<Drawer.Root
  defaultOpen={false}
  onOpenChange={(_open, { event }) => {
    track(event?.type === "pointerup" ? "drawer swiped" : "drawer dismissed");
  }}
>`}</CodeBlock>
      <h4>A side panel that only its buttons close</h4>
      <CodeBlock>{`<Drawer.Root defaultOpen={false} modal={false}>
  <Drawer.Trigger>Inspector</Drawer.Trigger>
  <Drawer.Popup side="inline-end" swipeDismiss={false}>   {/* no swipe, no light dismiss */}
    <Drawer.Title>Inspector</Drawer.Title>
    …
    <Drawer.Close>Close</Drawer.Close>
  </Drawer.Popup>
</Drawer.Root>`}</CodeBlock>
      <h4>Opt a region out of the swipe</h4>
      <CodeBlock>{`{/* A map or a canvas with its own drag: prevent the press. */}
<div className="map" onPointerDown={(event) => event.preventDefault()} />`}</CodeBlock>
      <p>
        Preventing the <code>pointerdown</code> also cancels the compatibility{" "}
        <code>mousedown</code>: a mouse press in that region no longer moves focus or starts a text
        selection. Use it on regions that are not focusable and hold no text to select (a map, a
        canvas, a custom slider that handles its own focus), not on a form or a list of links.
      </p>
    </DocPage>
  );
}
