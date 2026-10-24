import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { PageHead } from "../components/PageHead.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { TooltipArrow } from "../examples/TooltipArrow.js";
import { TooltipToolbar } from "../examples/TooltipToolbar.js";
import { functionProps, renderProp } from "./shared-props.js";

export function TooltipPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Tooltip"
        description="A tooltip built on the Popover API and CSS Anchor Positioning, with a native interestfor path in Chromium. Open state belongs to the browser."
      />
      <h2>Tooltip</h2>
      <p className="page-intro">
        The WAI-ARIA Tooltip pattern on the platform: the popup lives in the top layer (Popover
        API), is placed with CSS Anchor Positioning and animates with <code>@starting-style</code>.
        The library's JavaScript is a thin shim for hover and focus that steps aside where the
        browser can do the job.
      </p>

      <Example file="TooltipToolbar.tsx" css="tooltip.css">
        <TooltipToolbar />
      </Example>
      <p>
        Hover a button, or move focus to it with the keyboard. Escape, or any click, closes the
        tooltip. This example is a Server Component.
      </p>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Tooltip } from "@funstack/ui/tooltip";

<Tooltip.Root>                              {/* no DOM: id, options, interaction */}
  <Tooltip.Trigger>Save</Tooltip.Trigger>   {/* button */}
  <Tooltip.Popup>                           {/* div[popover][role=tooltip] */}
    Saves the document (Ctrl+S)
    <Tooltip.Arrow />                       {/* optional: span[aria-hidden] */}
  </Tooltip.Popup>
</Tooltip.Root>`}</CodeBlock>
      <CodeBlock language="html">{`<button type="button" aria-describedby="_r_1_">Save</button>
<div id="_r_1_" popover="manual" role="tooltip" data-side="top" data-align="center"
     style="position-area: top; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline">
  Saves the document (Ctrl+S)
  <span aria-hidden="true" data-side="top" data-align="center"></span>
</div>`}</CodeBlock>
      <ul>
        <li>
          <code>Root</code> renders no DOM, so the trigger stays a direct child of your toolbar or
          flex row. There is no Portal and no Positioner: the top layer and anchor positioning do
          those jobs.
        </li>
        <li>
          Render the Popup <strong>immediately after</strong> the Trigger. The HTML spec recommends
          that reading order for popovers, and some screen readers attach an adjacent tooltip to the
          wrong control otherwise.
        </li>
        <li>One trigger per Root.</li>
        <li>
          <code>Arrow</code> is optional and draws nothing itself: it carries the Popup's{" "}
          <code>data-side</code> / <code>data-align</code>, which are where the browser placed the
          popup (see <a href="#arrow">Arrow</a>).
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <h4 id="skip-delay">Skip-delay</h4>
      <p>
        Once one tooltip is showing, the next one appears at once, as on every desktop platform:
        moving the pointer along a toolbar, or arrowing through it, shows each tooltip without
        waiting. The rule is global to the page, and there is nothing to set up:
      </p>
      <p>
        <strong>
          A tooltip opens with no delay while any <code>[role="tooltip"]:popover-open</code> exists
          in the document, and the tooltip that was showing is hidden at once.
        </strong>
      </p>
      <ul>
        <li>
          <strong>No provider, no prop.</strong> The condition is read from the page when a hover or
          focus starts, so it works across React roots, in Server Components with nothing around
          them, and with tooltips that are not FUNSTACK's (any popover with{" "}
          <code>role="tooltip"</code> counts). There is no opt-out.
        </li>
        <li>
          <strong>The window is "while the previous tooltip is still showing"</strong>, its{" "}
          <code>closeDelay</code> included (150 ms by default), which covers moving between adjacent
          controls. After both have closed, the next tooltip waits its <code>delay</code> again;
          there is no longer cooldown.
        </li>
        <li>
          <strong>On the native path</strong> (<code>experimental_interestFor</code> in Chromium)
          the browser reads the delay from the trigger's computed style, so the Trigger renders{" "}
          <code>interest-delay-start: calc(250ms * (1 - var(--fsui-tooltip-warm, 0)))</code> and a
          small stylesheet that sets <code>--fsui-tooltip-warm</code> to 1 on marked triggers while
          a tooltip is showing. React hoists it into <code>&lt;head&gt;</code> (during server
          rendering too); it works before hydration. Nothing visual: it times the interaction only.
          Under a strict <code>style-src</code> it needs its hash or a nonce (
          <a href="/concepts/content-security-policy">Content Security Policy</a>). Without it
          (blocked, or React dropped it), the <code>var()</code> falls back to <code>0</code>: each
          tooltip opens after its own <code>delay</code>, and only skip-delay is lost.
        </li>
        <li>
          <strong>Skip the entry animation of an open like that</strong> with{" "}
          <code>data-instant</code>: the Popup carries it while it is shown by an open that began
          while another <code>[role="tooltip"]:popover-open</code> existed, so{" "}
          <code>.tip[data-instant] {"{ transition: none; }"}</code> (or <code>animation: none</code>{" "}
          for a keyframe entry) makes browsing a toolbar instant while the first tooltip still fades
          in. The library writes it from the popup's <code>beforetoggle</code> event, on both paths,
          before the open's first frame, so no transition starts; it is removed when the tooltip
          closes, so every exit animates as usual. It is a DOM attribute only (no <code>state</code>{" "}
          field), and like the skip itself it counts any <code>role="tooltip"</code> popover. Before
          hydration, on the native path, a warm open still opens at once but has no{" "}
          <code>data-instant</code>, so its animation plays. CSS alone cannot express it: by the
          time the new tooltip is <code>:popover-open</code> the previous one is already hidden, and
          a <code>:has(:popover-open)</code> condition matches the opening tooltip itself.
        </li>
      </ul>
      <CodeBlock language="css">{`/* The library's rule (rendered by a Trigger with experimental_interestFor): */
@property --fsui-tooltip-warm { syntax: "<number>"; inherits: false; initial-value: 0; }
:root:has([role="tooltip"]:popover-open) [data-fsui-tooltip-trigger] { --fsui-tooltip-warm: 1; }`}</CodeBlock>

      <h4>Two mechanisms</h4>
      <Table
        head={["Flags", "Chromium", "Firefox", "Safari"]}
        rows={[
          ["none", "`manual` popover + JS", "same", "same"],
          [
            "`experimental_hint`",
            "`hint` popover: native light dismiss, JS still attached",
            "same as Chromium",
            "`hint` unknown: behaves as `manual` + JS",
          ],
          [
            "`experimental_interestFor`",
            "native trigger, no JS interaction listeners",
            "attribute ignored, JS path",
            "attribute ignored, JS path",
          ],
          ["both", "fully native, works before hydration", "as `experimental_hint`", "as no flags"],
        ]}
      />
      <CodeBlock>{`<Tooltip.Root provides="name">
  <Tooltip.Trigger experimental_interestFor className="icon-button">
    <SaveIcon />
  </Tooltip.Trigger>
  <Tooltip.Popup experimental_hint className="tip">Save</Tooltip.Popup>
</Tooltip.Root>`}</CodeBlock>
      <p>
        The baseline popover type is <code>manual</code>, not <code>auto</code>, so that opening a
        tooltip never closes an open menu or listbox.
      </p>

      <h3 id="props">Props</h3>
      <h4>
        <code>Tooltip.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "delay",
            type: "number",
            default: "250",
            description:
              "Milliseconds from hover or keyboard focus to open (Chromium's interest-delay-start). Hover and focus share it. Skipped while another tooltip is showing (see Skip-delay).",
          },
          {
            name: "closeDelay",
            type: "number",
            default: "150",
            description:
              "Milliseconds from leaving (trigger and popup) or blur to close (Chromium's interest-delay-end).",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "The tooltip never opens. The ARIA relation stays in place.",
          },
          {
            name: "provides",
            type: '"description" | "name"',
            default: '"description"',
            description: (
              <>
                Which relation the tooltip provides for the trigger. <code>"description"</code>:{" "}
                <code>aria-describedby</code>, for triggers with their own name. <code>"name"</code>
                : <code>aria-labelledby</code>, for icon-only triggers; do not also set{" "}
                <code>aria-label</code>.
              </>
            ),
          },
          {
            name: "children",
            type: "ReactNode | ((state: TooltipRootState) => ReactNode)",
            description: "The Trigger and the Popup.",
          },
        ]}
      />
      <PartFacts
        state={"`TooltipRootState` is `{ disabled }`."}
        owned={
          "nothing rendered: the Root has no element (no `ref`, `className` or `style`), and no `open`, `defaultOpen` or action (see [Browser-owned state](#browser-owned-state))."
        }
      />

      <h4>
        <code>Tooltip.Trigger</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "experimental_interestFor",
            type: "boolean",
            default: "false",
            description: (
              <>
                Renders <code>interestfor</code> and <code>interest-delay-start/end</code> so the
                browser owns hover, focus, Escape and long-press. Where the element implements{" "}
                <code>interestForElement</code> (Chromium), the library attaches no interaction
                listeners (only a passive <code>beforetoggle</code> that writes{" "}
                <code>data-instant</code>); elsewhere the attribute is ignored and the JS path runs.
                Pair with <code>Popup experimental_hint</code>. Also renders the{" "}
                <code>data-fsui-tooltip-trigger</code> marker and the skip-delay stylesheet (see
                Skip-delay).
              </>
            ),
          },
          ...functionProps("TooltipTriggerState"),
          renderProp("button", "TooltipTriggerState"),
        ]}
      />
      <PartFacts
        state={"`TooltipTriggerState` is `{ disabled }`."}
        owned={
          '`aria-describedby` (with `provides="description"`) or `aria-labelledby` (with `provides="name"`), both token-merged with your ids; `data-disabled`; and `interestfor`, the `interest-delay-*` style and `data-fsui-tooltip-trigger` with `experimental_interestFor`.'
        }
        note={
          'Every `<button>` prop passes through, including `onClick` and `type` (default `"button"`): the library attaches its listeners with `addEventListener`.'
        }
      />

      <h4>
        <code>Tooltip.Popup</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "side",
            type: '"top" | "bottom" | "left" | "right" | "inline-start" | "inline-end" | null',
            default: '"top"',
            description: (
              <>
                Placement through inline <code>position-area</code>, with{" "}
                <code>position-try-fallbacks</code> flipping it when it does not fit.{" "}
                <code>"inline-start"</code> / <code>"inline-end"</code> follow the popup's direction
                (<code>inline-end</code> is the right in LTR, the left in RTL); the other four are
                physical. <code>null</code> emits no inline positioning and no{" "}
                <code>data-side</code> / <code>data-align</code>, so your stylesheet owns placement.
              </>
            ),
          },
          {
            name: "align",
            type: '"start" | "center" | "end"',
            default: '"center"',
            description: (
              <>
                Alignment along the side. On a top / bottom side, <code>start</code> /{" "}
                <code>end</code> are inline-relative (<code>start</code> lines up the inline-start
                edges: the left in LTR, the right in RTL); on the other sides they are the top /
                bottom edges. Ignored when <code>side</code> is <code>null</code>.
              </>
            ),
          },
          {
            name: "experimental_hint",
            type: "boolean",
            default: "false",
            description: (
              <>
                Renders <code>popover="hint"</code> instead of <code>"manual"</code>: native light
                dismiss, and the tooltip can open over an open menu without closing it. Engines that
                do not know <code>hint</code> treat it as <code>manual</code>, and the JS Escape and
                click handling stays.
              </>
            ),
          },
          ...functionProps(
            "TooltipPopupState",
            "Rendered at mount (hidden), not at open time. Keep it static and non-interactive.",
          ),
          renderProp("div", "TooltipPopupState"),
        ]}
      />
      <PartFacts
        state={
          "`TooltipPopupState` is `{ disabled, side, align }`; while the tooltip is shown, `side` and `align` are where the browser placed it (a physical side, after any fallback flip); otherwise they are your props (`side` is `null` with `side={null}`)."
        }
        owned={
          '`id`, `popover`, `role` (`"tooltip"`), `data-disabled`, and `data-side` / `data-align` unless `side` is `null`.'
        }
        note={
          'Your `style` wins over the inline placement, so `style={{ positionArea: "bottom span-right" }}` works for a one-off; `data-side` then reports where that put it. `data-instant` is not a prop: the Root writes it on the DOM for a warm open (see Skip-delay).'
        }
      />

      <h4>
        <code>Tooltip.Arrow</code>
      </h4>
      <PropsTable
        rows={[...functionProps("TooltipArrowState"), renderProp("span", "TooltipArrowState")]}
      />
      <PartFacts
        state={
          "`TooltipArrowState` is `{ side, align }`, the Popup's values (resolved while shown)."
        }
        owned={"`aria-hidden`, and `data-side` / `data-align` unless the Popup's `side` is `null`."}
        note={"Render it inside `Tooltip.Popup`."}
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Hook", "On", "Meaning"]}
        rows={[
          ["`:popover-open`", "Popup", "The tooltip is showing."],
          [
            "`data-side`",
            "Popup, Arrow",
            "While shown: the side the browser placed the popup on (`top` / `bottom` / `left` / `right`, after any flip). Otherwise the requested side. Absent with `side={null}`.",
          ],
          [
            "`data-align`",
            "Popup, Arrow",
            "While shown: the resolved alignment. Otherwise the requested one. Absent with `side={null}`.",
          ],
          [
            "`data-instant`",
            "Popup",
            "While shown by an open that began while another tooltip was showing (a skip-delay open; see Skip-delay). Written by the library from the popup's `beforetoggle`, before the open's first frame; removed when it closes. No `state` counterpart.",
          ],
          ["`data-disabled`", "Trigger, Popup", "The Root's `disabled` prop."],
          [
            "`data-fsui-tooltip-trigger`",
            "Trigger",
            "With `experimental_interestFor` only: what the skip-delay stylesheet matches. Not a styling hook.",
          ],
        ]}
      />
      <p>
        <code>data-side</code> is where the popup <strong>is</strong>: the library reads which{" "}
        <code>position-try-fallbacks</code> option the browser applied from the popup's computed{" "}
        <code>position-area</code> when it opens, on scroll and on resize. The browser still does
        the placing. With a physical <code>side</code>, a tooltip that opens where you asked costs
        no React render; a logical one (<code>inline-start</code> / <code>inline-end</code>) costs
        one render on show and one on hide, since <code>data-side</code> turns physical while shown.
        The inline <code>position-area</code> stays your request. Two caveats: an entry animation
        keyed on <code>data-side</code> with <code>@starting-style</code> starts from the requested
        side on a flipped open (key it on opacity or a fixed offset, as below), and a gap written as
        a one-sided margin on <code>[data-side]</code> lands on the wrong edge after a flip, because
        the flip swaps the popup's margins too. Either put a static margin on the requested edge
        (not keyed on <code>data-side</code>; the flip moves it to the other edge), or key a margin
        on both sides of the axis on <code>data-side</code>, including the closed{" "}
        <code>inline-start</code> / <code>inline-end</code> values so the first layout has it.
      </p>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Interaction", "Behaviour"]}
        rows={[
          [
            "Hover the trigger",
            "Opens after `delay`, or at once while another tooltip is showing (which then closes). Stays open while the pointer is over the trigger or the popup.",
          ],
          ["Pointer leaves both", "Closes after `closeDelay`."],
          [
            "Keyboard focus on the trigger",
            "Opens after `delay`, or at once while another tooltip is showing (focus from a click does not open).",
          ],
          ["Blur", "Closes after `closeDelay`."],
          ["Escape", "Closes; focus stays on the trigger."],
          [
            "Any pointerdown",
            "Closes (outside, on the trigger, on the popup). It reopens only after the pointer leaves and re-enters, or focus leaves and returns.",
          ],
          [
            "Touch",
            "Never opens on the JS path (no hover). Chromium's native path offers long-press.",
          ],
        ]}
      />
      <ul>
        <li>
          The popup has <code>role="tooltip"</code>; the trigger gets <code>aria-describedby</code>{" "}
          or <code>aria-labelledby</code> per <code>provides</code>, and no{" "}
          <code>aria-expanded</code>. The relation works while the popup is hidden, so screen
          readers announce the text on focus in every engine.
        </li>
        <li>
          The trigger must be focusable. A natively <code>disabled</code> button never shows a
          tooltip; use <code>aria-disabled="true"</code> on a control that needs one.
        </li>
        <li>Tooltips must not contain interactive content. Use a dialog or popover for that.</li>
        <li>
          Do not put the only copy of important information in a tooltip: touch users may never see
          it.
        </li>
      </ul>
      <p>
        In development, the library warns when <code>provides="name"</code> is combined with an{" "}
        <code>aria-label</code>, when the trigger is not focusable, and when the popup contains
        focusable content.
      </p>

      <BehaviourSection
        id="transition-types"
        summary={
          "None: Tooltip makes no transitions and has no `transition` prop. Animate the popup in CSS on `:popover-open`."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={"None: no optimistic state and no `data-pending`."}
      />

      <BehaviourSection
        id="suspense"
        summary={
          "The popup's content renders when the tooltip mounts, not when it opens. If it must suspend, put the `<Suspense>` boundary inside `Tooltip.Popup`."
        }
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          "All of it: a tooltip's visibility is not application state, so the browser owns it."
        }
      >
        <p>
          There is no <code>open</code> prop, no <code>openChangeAction</code> and no{" "}
          <code>data-open</code>. The popup is a popover in the top layer, opened and closed by the
          browser (or by the library's listeners calling <code>showPopover</code> /{" "}
          <code>hidePopover</code>), never through React state. Style it with{" "}
          <code>:popover-open</code>, and the trigger of an open tooltip with{" "}
          <code>:has(+ :popover-open)</code>. Tooltip is therefore the one component with no
          transitions, no <code>data-pending</code> and no <code>transition</code> prop; animate it
          in CSS:
        </p>
        <CodeBlock language="css">{`.tip {
  opacity: 0;
  translate: 0 4px;
  transition: opacity 120ms, translate 120ms, display 120ms allow-discrete, overlay 120ms allow-discrete;
}
.tip:popover-open {
  opacity: 1;
  translate: 0 0;
  @starting-style { opacity: 0; translate: 0 4px; }
}
.tip[data-instant] {
  transition: none; /* a warm open (another tooltip was showing): no entry animation */
}
@media (prefers-reduced-motion: reduce) {
  .tip { transition: none; }
}`}</CodeBlock>
        <p>
          To observe opens (for analytics), listen to the popup's native <code>toggle</code> event
          through a <code>ref</code>.
        </p>
      </BehaviourSection>

      <BehaviourSection
        id="before-hydration"
        summary={
          "With `experimental_interestFor` and `experimental_hint` in Chromium, the whole tooltip (it is plain HTML). Elsewhere the JS path attaches at hydration. The ARIA relation is in the HTML either way."
        }
      />

      <h3 id="recipes">Recipes</h3>
      <h4 id="arrow">Arrow</h4>
      <Example file="TooltipArrow.tsx" css="tooltip.css">
        <TooltipArrow />
      </Example>
      <p>
        Scroll the page until the first button is near the top of the window and hover it: the
        browser flips the tooltip below, and the arrow, keyed on <code>[data-side]</code>, moves to
        the edge that faces the button. With no <code>Arrow</code> element, the same CSS works on
        the Popup itself as a pseudo-element:
      </p>
      <CodeBlock language="css">{`.tip::after { content: ""; position: absolute; width: 8px; height: 8px; background: inherit; rotate: 45deg; }
.tip[data-side="top"]::after { bottom: -4px; inset-inline-start: calc(50% - 4px); }
.tip[data-side="bottom"]::after { top: -4px; inset-inline-start: calc(50% - 4px); }`}</CodeBlock>

      <h4>A link trigger</h4>
      <CodeBlock>{`<Tooltip.Root>
  <Tooltip.Trigger render={<a href="/pricing" />}>Pricing</Tooltip.Trigger>
  <Tooltip.Popup className="tip">Opens the pricing page</Tooltip.Popup>
</Tooltip.Root>`}</CodeBlock>
      <p>
        The native <code>interestfor</code> path only applies to buttons and links; any other
        element (a focusable <code>&lt;span tabIndex={"{0}"}&gt;</code>) always uses the JS path.
      </p>
      <h4>Placement entirely in CSS</h4>
      <CodeBlock>{`<Tooltip.Popup side={null} className="tip tip-beside">...</Tooltip.Popup>`}</CodeBlock>
      <CodeBlock language="css">{`.tip-beside {
  /* self-* keywords follow the popup's direction; plain logical ones (inline-end) would follow
     the root's only, because the popup is in the top layer. */
  position-area: self-x-end;
  position-try-fallbacks: flip-inline;
  margin-inline: 6px;
}`}</CodeBlock>
      <p>
        With <code>side={"{null}"}</code> the library emits no <code>data-side</code>; it cannot
        read placement your own <code>@position-try</code> rules produce.
      </p>
      <Callout title="Async content">
        <p>
          The popup's content renders when the tooltip mounts, not when it opens. If it must
          suspend, put the <code>&lt;Suspense&gt;</code> boundary inside <code>Tooltip.Popup</code>;
          a boundary above the Root would hide the trigger too.
        </p>
      </Callout>

      <h3 id="browser-notes">Browser notes</h3>
      <h4>Right-to-left</h4>
      <p>
        Nothing reads <code>direction</code> in JavaScript. <code>side="inline-start"</code> /{" "}
        <code>"inline-end"</code> and <code>align="start"</code> / <code>"end"</code> on a top or
        bottom side use the <code>self-*</code> <code>position-area</code> keywords, which follow
        the popup's own direction, inherited from where you render it: an RTL page and an RTL
        container (<code>dir="rtl"</code> on any ancestor) both mirror them, before hydration too.{" "}
        <code>top</code> / <code>bottom</code> / <code>left</code> / <code>right</code> stay
        physical. While shown, <code>data-side</code> is physical (<code>inline-end</code> reads{" "}
        <code>left</code> in RTL).
      </p>
      <Callout title="Firefox and RTL containers">
        <p>
          Firefox misplaces any anchored popover along the inline axis when its parent box has a
          different direction from the page (an RTL island in an LTR page, or the reverse), with
          physical keywords too (Mozilla bug 2019601, tracked in{" "}
          <a href="https://github.com/uhyo/funstack-ui/issues/89">#89</a>). Page-level RTL is fine.
          The library ships no workaround.
        </p>
      </Callout>
    </div>
  );
}
