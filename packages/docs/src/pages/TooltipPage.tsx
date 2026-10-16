import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { TooltipToolbar } from "../examples/TooltipToolbar.js";
import tooltipToolbarSource from "../examples/TooltipToolbar.tsx?raw";
import tooltipCss from "../examples/tooltip.css?raw";
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

      <Example
        source={tooltipToolbarSource}
        fileName="TooltipToolbar.tsx"
        css={tooltipCss}
        cssFileName="tooltip.css"
      >
        <TooltipToolbar />
      </Example>
      <p>
        Hover a button, or move focus to it with the keyboard. Escape, or any click, closes the
        tooltip. This example is a Server Component.
      </p>

      <h3>Anatomy</h3>
      <CodeBlock>{`import { Tooltip } from "@funstack/ui/tooltip";

<Tooltip.Root>                              {/* no DOM: id, options, interaction */}
  <Tooltip.Trigger>Save</Tooltip.Trigger>   {/* button */}
  <Tooltip.Popup>Saves the document (Ctrl+S)</Tooltip.Popup>  {/* div[popover][role=tooltip] */}
</Tooltip.Root>`}</CodeBlock>
      <CodeBlock language="html">{`<button type="button" aria-describedby="_r_1_">Save</button>
<div id="_r_1_" popover="manual" role="tooltip" data-side="top" data-align="center"
     style="position-area: top; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline">
  Saves the document (Ctrl+S)
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
          There is no <code>Arrow</code> part in this version. Draw one on the popup with CSS if you
          need it (it cannot follow a fallback flip).
        </li>
      </ul>

      <h3>Props</h3>
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
              "Milliseconds from hover or keyboard focus to open (Chromium's interest-delay-start). Hover and focus share it.",
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
      <p>
        <code>TooltipRootState</code>: <code>{"{ disabled }"}</code>. No <code>ref</code>,{" "}
        <code>className</code> or <code>style</code> (no DOM), and no <code>open</code>,{" "}
        <code>defaultOpen</code> or action (see below).
      </p>

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
                <code>interestForElement</code> (Chromium), the library attaches no listeners;
                elsewhere the attribute is ignored and the JS path runs. Pair with{" "}
                <code>Popup experimental_hint</code>.
              </>
            ),
          },
          ...functionProps("TooltipTriggerState"),
          renderProp("button", "TooltipTriggerState"),
        ]}
      />
      <p>
        <code>TooltipTriggerState</code>: <code>{"{ disabled }"}</code>. Every{" "}
        <code>&lt;button&gt;</code> prop passes through, including <code>onClick</code> and{" "}
        <code>type</code> (default <code>"button"</code>): the library attaches its listeners with{" "}
        <code>addEventListener</code>. Your own <code>aria-describedby</code> /{" "}
        <code>aria-labelledby</code> ids are merged with the tooltip's.
      </p>

      <h4>
        <code>Tooltip.Popup</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "side",
            type: '"top" | "bottom" | "left" | "right" | null',
            default: '"top"',
            description: (
              <>
                Placement through inline <code>position-area</code>, with{" "}
                <code>position-try-fallbacks</code> flipping it when it does not fit.{" "}
                <code>null</code> emits no inline positioning and no <code>data-side</code> /{" "}
                <code>data-align</code>, so your stylesheet owns placement.
              </>
            ),
          },
          {
            name: "align",
            type: '"start" | "center" | "end"',
            default: '"center"',
            description: "Alignment along the side. Ignored when side is null.",
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
      <p>
        <code>TooltipPopupState</code>: <code>{"{ disabled, side, align }"}</code>. <code>id</code>,{" "}
        <code>popover</code> and <code>role</code> are owned by the library. Your <code>style</code>{" "}
        wins over the inline placement, so{" "}
        <code>style={'{{ positionArea: "bottom span-right" }}'}</code> works for a one-off.
      </p>

      <h3>Open state belongs to the browser</h3>
      <p>
        There is no <code>open</code> prop, no <code>openChangeAction</code> and no{" "}
        <code>data-open</code>. The popup is a popover in the top layer, opened and closed by the
        browser (or by the library's listeners calling <code>showPopover</code> /{" "}
        <code>hidePopover</code>), never through React state. Style it with{" "}
        <code>:popover-open</code>, and the trigger of an open tooltip with{" "}
        <code>:has(+ :popover-open)</code>. Tooltip is therefore the one component with no
        transitions, no <code>data-pending</code> and no <code>transition</code> prop; animate it in
        CSS:
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
@media (prefers-reduced-motion: reduce) {
  .tip { transition: none; }
}`}</CodeBlock>
      <p>
        To observe opens (for analytics), listen to the popup's native <code>toggle</code> event
        through a <code>ref</code>.
      </p>

      <h3>Data attributes</h3>
      <Table
        head={["Hook", "On", "Meaning"]}
        rows={[
          ["`:popover-open`", "Popup", "The tooltip is showing."],
          ["`data-side`", "Popup", "The requested side (absent with `side={null}`)."],
          ["`data-align`", "Popup", "The requested alignment (absent with `side={null}`)."],
          ["`data-disabled`", "Trigger, Popup", "The Root's `disabled` prop."],
        ]}
      />
      <p>
        <code>data-side</code> is the side you asked for, not the side the browser picked after a
        fallback flip; CSS exposes no signal for that yet.
      </p>

      <h3>Keyboard, pointer and ARIA</h3>
      <Table
        head={["Interaction", "Behaviour"]}
        rows={[
          [
            "Hover the trigger",
            "Opens after `delay`. Stays open while the pointer is over the trigger or the popup.",
          ],
          ["Pointer leaves both", "Closes after `closeDelay`."],
          [
            "Keyboard focus on the trigger",
            "Opens after `delay` (focus from a click does not open).",
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

      <h3>Two mechanisms</h3>
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
            "native trigger, no JS listeners",
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

      <h3>Recipes</h3>
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
      <CodeBlock>{`<Tooltip.Popup side={null} className="tip tip-inline-end">...</Tooltip.Popup>`}</CodeBlock>
      <CodeBlock language="css">{`.tip-inline-end {
  position-area: inline-end;
  position-try-fallbacks: flip-inline;
  margin-inline: 6px;
}`}</CodeBlock>
      <Callout title="Async content">
        <p>
          The popup's content renders when the tooltip mounts, not when it opens. If it must
          suspend, put the <code>&lt;Suspense&gt;</code> boundary inside <code>Tooltip.Popup</code>;
          a boundary above the Root would hide the trigger too.
        </p>
      </Callout>
    </div>
  );
}
