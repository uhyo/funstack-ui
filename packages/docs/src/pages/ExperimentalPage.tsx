import { CodeBlock } from "../components/CodeBlock.js";
import { PageHead } from "../components/PageHead.js";
import { Table } from "../components/Tables.js";

export function ExperimentalPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Experimental features"
        description="Platform features that are not in every engine yet are opt-in through experimental_* props on the part that uses them."
      />
      <h2>Experimental features</h2>
      <p className="page-intro">
        FUNSTACK UI supports the latest stable Blink, WebKit and Gecko, with no fallbacks for older
        browsers. Features that have not shipped in all three yet are still used, but only when you
        ask for them.
      </p>

      <h3>
        <code>experimental_*</code> props
      </h3>
      <p>
        A feature inside an existing component is an <code>experimental_&lt;feature&gt;</code> prop
        on the part that uses it, off by default. The prefix follows React's naming for unstable
        APIs. It is greppable, it sits at the call site where you make the browser-support decision,
        and when the feature reaches every engine the prop is removed: the type error tells you
        exactly where to delete it.
      </p>
      <Table
        head={["Prop", "Platform feature", "Effect when on"]}
        rows={[
          [
            "`Tabs.List experimental_focusgroup`",
            "`focusgroup`",
            "Renders `focusgroup`; where the browser implements it, the browser moves focus with arrow keys, Home and End and the JS handler steps aside.",
          ],
          [
            "`Toolbar.Root experimental_focusgroup`",
            "`focusgroup`",
            'Renders `focusgroup="toolbar inline|block wrap|nowrap"`; where the browser implements it, the browser owns the single Tab stop (with memory), arrow keys, Home and End, and the library writes no `tabindex`.',
          ],
          [
            "`ToggleGroup.Root experimental_focusgroup`",
            "`focusgroup`",
            'Standalone groups only: renders `focusgroup="toolbar … nomemory"` and `focusgroupstart` on the first pressed Item, so Tab enters on the pressed Item. Ignored (with a development warning) on a group inside a Toolbar, where a nested focusgroup would add Tab stops.',
          ],
          [
            "`Accordion.Root experimental_interpolateSize`",
            "`interpolate-size`",
            "Sets `interpolate-size: allow-keywords` on the root, so `::details-content` can transition `height` to `auto`. Elsewhere the height jumps.",
          ],
          [
            "`Tooltip.Trigger experimental_interestFor`",
            "`interestfor`",
            "Renders `interestfor` and `interest-delay-*` (plus the skip-delay stylesheet, see [Tooltip](/components/tooltip#skip-delay)); where supported, the browser owns hover, focus, Escape and long-press and the library attaches no listeners.",
          ],
          [
            "`Tooltip.Popup experimental_hint`",
            '`popover="hint"`',
            "Native light dismiss; a tooltip can open over an open menu without closing it. Engines that do not know `hint` treat it as `manual` and the JS handling stays.",
          ],
          [
            "`Dialog.Popup experimental_closedBy`",
            "`closedby`",
            'Renders `closedby="any"` (with `lightDismiss`) or `"closerequest"`; where the browser implements it (Chromium, Firefox), the platform handles Escape and outside clicks and the JS listeners are skipped. Safari keeps the JS.',
          ],
        ]}
      />
      <CodeBlock>{`<Tabs.List experimental_focusgroup aria-label="Settings">...</Tabs.List>
<Accordion.Root experimental_interpolateSize>...</Accordion.Root>
<Tooltip.Trigger experimental_interestFor>Save</Tooltip.Trigger>
<Tooltip.Popup experimental_hint>Saves the document</Tooltip.Popup>
<Dialog.Popup lightDismiss experimental_closedBy>...</Dialog.Popup>`}</CodeBlock>

      <h3>Rules</h3>
      <ul>
        <li>
          <strong>Flags never change markup between server and client.</strong> Feature detection (
          <code>"focusGroup" in HTMLElement.prototype</code>,{" "}
          <code>"interestForElement" in element</code>) runs in an effect, and only when the flag is
          on.
        </li>
        <li>
          <strong>The baseline keeps working underneath.</strong> A flag for a feature that would
          silently do nothing elsewhere keeps the JavaScript path active in engines without it.
        </li>
        <li>
          <strong>No provider, no global switch.</strong> The browser-support decision belongs next
          to the markup, and Server Components cannot create context anyway.
        </li>
        <li>
          Two features with different graduation paths are two props, so each can be removed on its
          own.
        </li>
      </ul>

      <h3>
        <code>@funstack/ui/experimental</code>
      </h3>
      <p>
        A whole component that cannot exist without a flagged feature would ship from an{" "}
        <code>@funstack/ui/experimental</code> subpath. None does yet: every current component has a
        baseline that works in all engines.
      </p>
    </div>
  );
}
