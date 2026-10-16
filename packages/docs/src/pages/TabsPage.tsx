import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { TabsSaved } from "../examples/TabsSaved.js";
import tabsSavedSource from "../examples/TabsSaved.tsx?raw";
import { TabsSuspending } from "../examples/TabsSuspending.js";
import tabsSuspendingSource from "../examples/TabsSuspending.tsx?raw";
import tabsCss from "../examples/tabs.css?raw";
import { functionProps, renderProp } from "./shared-props.js";

export function TabsPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Tabs"
        description="Tabs with optimistic selection, committed panels that may suspend, automatic or manual activation, an anchor-positioned indicator, and find-in-page support."
      />
      <h2>Tabs</h2>
      <p className="page-intro">
        The WAI-ARIA Tabs pattern. Tabs and the indicator show the optimistic selection; panels show
        the committed one, so a panel that suspends keeps the current panel on screen while the
        selected tab shows <code>data-pending</code>.
      </p>

      <Example
        source={tabsSuspendingSource}
        fileName="TabsSuspending.tsx"
        css={tabsCss}
        cssFileName="tabs.css"
      >
        <TabsSuspending />
      </Example>

      <h3>Anatomy</h3>
      <CodeBlock>{`import { Tabs } from "@funstack/ui/tabs";

<Tabs.Root defaultValue="general">          {/* div: state, transition, ids */}
  <Tabs.List aria-label="Settings">         {/* div[role=tablist]: arrow keys */}
    <Tabs.Tab value="general">General</Tabs.Tab>   {/* button[role=tab] */}
    <Tabs.Tab value="billing">Billing</Tabs.Tab>
    <Tabs.Indicator />                      {/* span: optional marker, after the Tabs */}
  </Tabs.List>
  <Tabs.Panel value="general">...</Tabs.Panel>     {/* div[role=tabpanel] */}
  <Tabs.Panel value="billing">...</Tabs.Panel>
</Tabs.Root>`}</CodeBlock>
      <p>
        Ids and <code>aria-controls</code> / <code>aria-labelledby</code> are wired from{" "}
        <code>value</code>; Tabs and Panels do not need to be registered or kept in the same order.
        Give the List an accessible name (<code>aria-label</code> or <code>aria-labelledby</code>).
      </p>

      <h3>Props</h3>
      <h4>
        <code>Tabs.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string | null",
            description:
              "Controlled selected value. null selects nothing; undefined means uncontrolled.",
          },
          {
            name: "defaultValue",
            type: "string | null",
            default: "null",
            description:
              "Initial value in uncontrolled mode. A development warning fires when neither value nor defaultValue is passed; pass defaultValue={null} to start empty on purpose.",
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<string, TabsValueChangeDetails>",
            description: (
              <>
                Runs inside the Root's transition whenever a tab is selected. Sync or async;
                rejections reach the nearest Error Boundary and roll the selection back.{" "}
                <code>details.reason</code> is <code>"activate"</code> (click, Enter/Space, or focus
                in automatic mode) or <code>"platform"</code> (find-in-page revealed a{" "}
                <code>keepMounted="until-found"</code> panel; <code>event</code> is the{" "}
                <code>beforematch</code> event).
              </>
            ),
          },
          {
            name: "orientation",
            type: '"horizontal" | "vertical"',
            default: '"horizontal"',
            description: "Layout and arrow-key axis.",
          },
          {
            name: "activationMode",
            type: '"automatic" | "manual"',
            default: '"automatic"',
            description:
              "automatic: selection follows focus. manual: arrow keys only move focus; Enter, Space or click selects.",
          },
          {
            name: "loop",
            type: "boolean",
            default: "true",
            description: "Whether arrow keys wrap from the last tab to the first.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Disables every Tab (still focusable, never dispatches).",
          },
          ...functionProps("TabsRootState"),
          renderProp("div", "TabsRootState"),
        ]}
      />
      <p>
        <code>TabsRootState</code>: <code>{"{ value, pending, orientation, disabled }"}</code>,
        where <code>value</code> is the optimistic selection.
      </p>

      <h4>
        <code>Tabs.List</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "experimental_focusgroup",
            type: "boolean",
            default: "false",
            description: (
              <>
                Renders <code>focusgroup="tablist …"</code>; where the browser implements it, the
                browser handles arrow keys, Home and End. The JS path stays active elsewhere.
              </>
            ),
          },
          ...functionProps("TabsListState"),
          renderProp("div", "TabsListState"),
        ]}
      />
      <p>
        <code>TabsListState</code>: <code>{"{ orientation, disabled }"}</code>. The List owns{" "}
        <code>onKeyDown</code> and <code>onFocus</code>.
      </p>

      <h4>
        <code>Tabs.Tab</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description: "Required. The value this tab selects; unique within the Root.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: 'Focusable but inert: aria-disabled="true", never dispatches.',
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            default: '"none"',
            description:
              "Forwarded to the Tab's <ViewTransition default>. Fires only on the commit that settles the action, never on the optimistic selection.",
          },
          ...functionProps("TabsTabState", "Rendered from optimistic state; must not suspend."),
          renderProp("button", "TabsTabState"),
        ]}
      />
      <p>
        <code>TabsTabState</code>:{" "}
        <code>{"{ value, selected, pending, disabled, orientation }"}</code>. The Tab owns{" "}
        <code>onClick</code>, <code>onKeyDown</code>, <code>onFocus</code> and <code>id</code>. It
        sets <code>anchor-name</code> in its style for the Indicator (your <code>style</code> wins).
      </p>

      <h4>
        <code>Tabs.Panel</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description: "Required. The tab this panel belongs to.",
          },
          {
            name: "keepMounted",
            type: 'boolean | "until-found"',
            default: "false",
            description: (
              <>
                <code>false</code>: hidden panels are not rendered. <code>true</code>: rendered
                inside <code>&lt;Activity mode="hidden"&gt;</code> (DOM and state kept, effects
                stopped, not in server HTML). <code>"until-found"</code>: rendered with{" "}
                <code>hidden="until-found"</code> (in server HTML, effects live); find-in-page or a
                text fragment selects the tab.
              </>
            ),
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            default: '"none"',
            description: "Forwarded to the Panel's <ViewTransition default>; animates the swap.",
          },
          ...functionProps("TabsPanelState"),
          renderProp("div", "TabsPanelState"),
        ]}
      />
      <p>
        <code>TabsPanelState</code>: <code>{"{ value, selected, orientation }"}</code>, where{" "}
        <code>selected</code> is committed. Panels get <code>tabIndex={"{0}"}</code> by default
        (APG); pass <code>tabIndex={"{-1}"}</code> when the panel starts with focusable content.
      </p>

      <h4>
        <code>Tabs.Indicator</code>
      </h4>
      <PropsTable
        rows={[...functionProps("TabsIndicatorState"), renderProp("span", "TabsIndicatorState")]}
      />
      <p>
        <code>TabsIndicatorState</code>: <code>{"{ value, pending, orientation }"}</code>. A
        decorative <code>aria-hidden</code> span that sets <code>position-anchor</code> to the
        optimistic tab. Give it <code>position: absolute</code> and <code>anchor()</code> insets in
        CSS, and a CSS <code>transition</code> on them to slide. It must come after the Tabs inside
        the List.
      </p>

      <h3>Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          [
            "`data-pending`",
            "Root",
            "A selection is in flight (including a suspending panel's wait).",
          ],
          ["`data-pending`", "Tab", "This tab is the one the user is waiting on."],
          ["`data-pending`", "Indicator", "Mirrors the Root."],
          ["`data-selected`", "Tab, Indicator", "Optimistic selection (immediate)."],
          ["`data-selected`", "Panel", "Committed selection (relevant with `keepMounted`)."],
          ["`data-disabled`", "Root, List, Tab", "Disabled by prop or by the Root."],
          ["`data-orientation`", "Root, List, Tab", '`"horizontal"` or `"vertical"`.'],
          ["`aria-selected`", "Tab", "Optimistic selection."],
          ["`aria-disabled`", "Tab", '`"true"` when disabled (still focusable).'],
        ]}
      />
      <CodeBlock language="css">{`.tab[data-selected] { color: var(--accent); }
.tab[aria-disabled="true"] { opacity: 0.4; }
.tabs[data-pending] .panel { opacity: 0.6; transition: opacity 150ms 150ms; }
.indicator { position: absolute; left: anchor(left); width: anchor-size(width); transition: left 200ms, width 200ms; }`}</CodeBlock>

      <h3>Keyboard and ARIA</h3>
      <Table
        head={["Key", "Behaviour"]}
        rows={[
          [
            "ArrowRight / ArrowLeft",
            "Horizontal: next / previous tab (swapped under `direction: rtl`). Wraps when `loop`.",
          ],
          ["ArrowDown / ArrowUp", "Vertical: next / previous tab."],
          ["Home / End", "First / last tab."],
          [
            "Enter / Space",
            "Selects the focused tab (the only way to select by keyboard in manual mode).",
          ],
          [
            "Tab",
            "Leaves the list: the selected tab is the only tab stop (roving `tabindex`), and the panel is next.",
          ],
        ]}
      />
      <ul>
        <li>
          In automatic mode, moving focus between tabs selects. Focus entering the list from outside
          never selects.
        </li>
        <li>
          Disabled tabs are focusable with arrow keys (<code>aria-disabled</code>), but never
          selected.
        </li>
        <li>
          With no selection (<code>null</code>, or a value that matches no tab), the List itself is
          the tab stop and hands focus to the first enabled tab.
        </li>
        <li>
          <code>aria-selected</code> follows the optimistic selection. <code>aria-orientation</code>{" "}
          is always set on the List.
        </li>
        <li>Key presses with Alt, Ctrl or Meta are left to the browser.</li>
      </ul>

      <h3>Async walkthrough</h3>
      <Example
        source={tabsSavedSource}
        fileName="TabsSaved.tsx"
        css={tabsCss}
        cssFileName="tabs.css"
      >
        <TabsSaved />
      </Example>
      <ol>
        <li>
          Select Billing: the tab and indicator move immediately, the Root and the Billing tab get{" "}
          <code>data-pending</code>, the Profile panel stays.
        </li>
        <li>
          The save resolves: the Billing panel replaces Profile in one commit, sliding by the{" "}
          <code>fsui-tabs-next</code> type.
        </li>
        <li>
          The save rejects: the selection rolls back to the committed tab and the error reaches the
          Error Boundary.
        </li>
        <li>
          Selecting another tab while one is pending replaces the intent; clicking the committed tab
          again is a real dispatch that cancels the pending switch.
        </li>
      </ol>
      <Callout title="Automatic activation and slow actions">
        <p>
          With <code>activationMode="automatic"</code>, every arrow key press dispatches. Prefer{" "}
          <code>"manual"</code> when the action awaits a server round trip, or do not return the
          promise (<code>{"(next) => { void save(next); }"}</code>).
        </p>
      </Callout>

      <h3>Recipes</h3>
      <h4>Controlled by a router</h4>
      <CodeBlock>{`// \`section\` comes from the URL; navigating is the state update.
<Tabs.Root value={section} valueChangeAction={(next) => navigate(\`/settings/\${next}\`)}>
  ...
</Tabs.Root>`}</CodeBlock>
      <p>
        A controlled <code>value</code> that matches no tab is allowed (a sub-route without a tab):
        nothing is selected and a development warning explains it.
      </p>
      <h4>Tabs as links</h4>
      <CodeBlock>{`<Tabs.Tab value="docs" render={<a href="/docs" />}>Docs</Tabs.Tab>`}</CodeBlock>
      <h4>Preserved panels and find-in-page</h4>
      <CodeBlock>{`{/* The draft survives switching tabs. */}
<Tabs.Panel value="editor" keepMounted>
  <DraftEditor />
</Tabs.Panel>

{/* In the server HTML and found by Ctrl+F; finding text selects the tab. */}
<Tabs.Panel value="changelog" keepMounted="until-found">
  <Changelog />
</Tabs.Panel>`}</CodeBlock>
    </div>
  );
}
