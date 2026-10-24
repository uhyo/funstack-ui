import { CodeBlock } from "../components/CodeBlock.js";
import { DocPage } from "../components/DocPage.js";
import { Table } from "../components/Tables.js";

export function ExperimentalPage() {
  return (
    <DocPage
      title="Experimental features"
      description="Platform features that are not in every engine yet are opt-in through experimental_* props on the part that uses them."
    >
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
      <p>
        The flags today. What each one does is documented in the props table of the part that takes
        it; this is the index.
      </p>
      <Table
        head={["Prop", "Platform feature", "Native path today", "Documented on"]}
        rows={[
          [
            "`experimental_focusgroup`",
            "`focusgroup`",
            "Chromium 150+",
            "[Tabs.List](/components/tabs#props), [Toolbar.Root](/components/toolbar#props), [ToggleGroup.Root](/components/toggle-group#props), [Menu.Popup](/components/menu#props)",
          ],
          [
            "`experimental_interpolateSize`",
            "`interpolate-size`",
            "Chromium",
            "[Accordion.Root](/components/accordion#props)",
          ],
          [
            "`experimental_interestFor`",
            "`interestfor`",
            "Chromium",
            "[Tooltip.Trigger](/components/tooltip#props), [Tooltip skip-delay](/components/tooltip#skip-delay)",
          ],
          [
            "`experimental_hint`",
            '`popover="hint"`',
            "Chromium, Firefox (Safari 27.0 treats it as `manual`)",
            "[Tooltip.Popup](/components/tooltip#props)",
          ],
          [
            "`experimental_closedBy`",
            "`closedby`",
            "Chromium, Firefox",
            "[Dialog.Popup](/components/dialog#props)",
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
    </DocPage>
  );
}
