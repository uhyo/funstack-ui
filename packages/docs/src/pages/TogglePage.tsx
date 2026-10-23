import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { PageHead } from "../components/PageHead.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { ToggleErrors } from "../examples/ToggleErrors.js";
import toggleErrorsSource from "../examples/ToggleErrors.tsx?raw";
import { ToggleFavorite } from "../examples/ToggleFavorite.js";
import toggleFavoriteSource from "../examples/ToggleFavorite.tsx?raw";
import toggleCss from "../examples/toggle.css?raw";
import { functionProps, renderProp } from "./shared-props.js";

export function TogglePage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Toggle"
        description="A two-state button with an async pressedChangeAction, optimistic aria-pressed and data-pending."
      />
      <h2>Toggle</h2>
      <p className="page-intro">
        A two-state button (WAI-ARIA Button pattern, toggle variant). The pressed state flips
        optimistically and the button carries <code>data-pending</code> while{" "}
        <code>pressedChangeAction</code> runs.
      </p>

      <Example
        source={toggleFavoriteSource}
        fileName="ToggleFavorite.tsx"
        css={toggleCss}
        cssFileName="toggle.css"
      >
        <ToggleFavorite />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Toggle } from "@funstack/ui/toggle";

<Toggle pressedChangeAction={setFavorite}>Favorite</Toggle>`}</CodeBlock>
      <p>
        One plain component, no parts. It renders{" "}
        <code>&lt;button type="button" aria-pressed&gt;</code>.
      </p>

      <h3 id="props">Props</h3>
      <PropsTable
        rows={[
          {
            name: "pressed",
            type: "boolean",
            description: "Controlled pressed state. undefined means uncontrolled.",
          },
          {
            name: "defaultPressed",
            type: "boolean",
            default: "false",
            description: "Initial pressed state in uncontrolled mode.",
          },
          {
            name: "pressedChangeAction",
            type: "ChangeAction<boolean, TogglePressedChangeDetails>",
            description: (
              <>
                Called with the next pressed state on every user-initiated change. Runs inside the
                Toggle's transition; may be sync or async. Rejections reach the nearest Error
                Boundary. <code>details</code> carries only <code>event</code> (the native click
                event; keyboard activation also arrives as a click).
              </>
            ),
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Never dispatches. Native `disabled` on a `<button>`; with a link or component `render`, `aria-disabled="true"` instead (the element stays focusable).',
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description: (
              <>
                Forwarded to the Toggle's <code>&lt;ViewTransition default&gt;</code>. Animates the
                commit that ends an action (and rollbacks), not the optimistic flip.
              </>
            ),
          },
          ...functionProps("ToggleState", "Rendered from optimistic state; must not suspend."),
          renderProp("button", "ToggleState"),
        ]}
      />
      <PartFacts
        state={"`ToggleState` is `{ pressed, pending, disabled }`; `pressed` is optimistic."}
        owned={
          "`type`, `aria-pressed`, `disabled`, `aria-disabled` (link or component `render`), `onClick`, `data-pressed`, `data-pending`, `data-disabled`."
        }
        note={"Every other `<button>` prop passes through."}
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "Meaning"]}
        rows={[
          ["`data-pressed`", "Optimistically pressed."],
          ["`aria-pressed`", '`"true"` or `"false"`, optimistic.'],
          ["`data-pending`", "`pressedChangeAction` is in flight."],
          ["`data-disabled`", "The `disabled` prop (also matches `:disabled`)."],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Interaction", "Behaviour"]}
        rows={[
          ["Space, Enter, click", "Toggles (native button activation)."],
          ["Tab", "Focusable unless disabled."],
        ]}
      />
      <ul>
        <li>
          <code>aria-pressed</code> is always <code>"true"</code> or <code>"false"</code>, never{" "}
          <code>"mixed"</code>, and follows the optimistic state.
        </li>
        <li>
          Keep the accessible name stable: the label should not change with the pressed state (swap
          an icon, not the text).
        </li>
        <li>
          The button is not disabled while pending. A second click while pending reverses the first,
          and the latest click wins.
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={"`fsui-toggle` plus `fsui-toggle-press` or `fsui-toggle-release`."}
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "`aria-pressed` and `data-pressed` follow the optimistic state; `data-pending` is on the Toggle while `pressedChangeAction` is in flight. The `transition` prop animates the commit that ends the action (for example a spinner turning back into an icon), not the pressed flip: animate that with a CSS transition on `[data-pressed]`."
        }
      >
        <h4>Walkthrough</h4>
        <ol>
          <li>
            Click: <code>aria-pressed</code> and <code>data-pressed</code> flip at once,{" "}
            <code>data-pending</code> appears, <code>pressedChangeAction(true, details)</code> runs.
          </li>
          <li>
            Resolve: in uncontrolled mode the value is committed; <code>data-pending</code> goes. In
            controlled mode the parent's <code>pressed</code> decides.
          </li>
          <li>
            Reject: the pressed state rolls back and the error reaches the nearest Error Boundary.
          </li>
          <li>
            Click again while pending: the next value is the opposite of the <em>optimistic</em>{" "}
            value, so the second click undoes the first. Only the latest dispatch commits.
          </li>
        </ol>
        <Example source={toggleErrorsSource} fileName="ToggleErrors.tsx">
          <ToggleErrors />
        </Example>
        <p>The left Toggle catches its errors inline; the right one lets them reach a boundary.</p>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "No content region. The `children` function renders optimistic state and must not suspend."
        }
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={"None: the pressed state is library-owned."}
      />

      <BehaviourSection
        id="before-hydration"
        summary={"Markup and ARIA. Pressing needs JavaScript."}
      />

      <h3 id="recipes">Recipes</h3>
      <p>
        Several toggles that share one value (text styles, an alignment choice) are a{" "}
        <a href="/components/toggle-group">ToggleGroup</a>: one Tab stop, arrow keys between the
        items, and a set value with <code>added</code> / <code>removed</code> in the action's
        details.
      </p>
      <h4>Controlled, local state</h4>
      <CodeBlock>{`const [muted, setMuted] = useState(false);

<Toggle pressed={muted} pressedChangeAction={(next) => { setMuted(next); }}>
  Mute
</Toggle>`}</CodeBlock>
      <h4>A Server Function, from a Server Component</h4>
      <CodeBlock>{`<Toggle defaultPressed={post.favorited} pressedChangeAction={setFavorite.bind(null, post.id)}>
  Favorite
</Toggle>`}</CodeBlock>
      <Callout title="Disabling while pending">
        <p>
          The library does not do it (native <code>disabled</code> would drop keyboard focus). Use{" "}
          <code>.toggle[data-pending] {"{ pointer-events: none }"}</code>, or add{" "}
          <code>aria-busy</code> yourself.
        </p>
      </Callout>
    </div>
  );
}
