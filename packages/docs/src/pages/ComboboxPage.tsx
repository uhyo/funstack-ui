import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { ComboboxCountry } from "../examples/ComboboxCountry.js";
import comboboxCountrySource from "../examples/ComboboxCountry.tsx?raw";
import { ComboboxDrink } from "../examples/ComboboxDrink.js";
import comboboxDrinkSource from "../examples/ComboboxDrink.tsx?raw";
import comboboxCss from "../examples/combobox.css?raw";
import { functionProps, renderProp } from "./shared-props.js";

export function ComboboxPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Combobox"
        description="An editable combobox with list autocomplete: urgent typing, results from a deferred query inside Suspense, aria-activedescendant, an async valueChangeAction with the option pending, free text, forms and ariaNotify."
      />
      <h2>Combobox</h2>
      <p className="page-intro">
        A text input with a listbox of suggestions (the WAI-ARIA "editable combobox with list
        autocomplete"). Focus stays in the input; the active option moves with{" "}
        <code>aria-activedescendant</code>. The listbox is a <code>popover="auto"</code> anchored to
        the input with CSS, so the platform provides the top layer, light dismiss, Escape and
        nesting inside dialogs. The library filters nothing: you render the options for a query,
        synchronously or with <code>use()</code> under your own <code>&lt;Suspense&gt;</code>.
      </p>

      <Example
        source={comboboxCountrySource}
        fileName="ComboboxCountry.tsx"
        css={comboboxCss}
        cssFileName="combobox.css"
      >
        <ComboboxCountry />
      </Example>

      <h3>Typing is urgent; everything it causes is not</h3>
      <p>
        "Everything is a transition" has one exception, and this is it: React requires a controlled
        text input to update urgently, in the same event as the keystroke. So the text is the
        library's first <strong>urgent state</strong>. It keeps the usual triple,{" "}
        <code>inputValue</code> / <code>defaultInputValue</code> /{" "}
        <code>inputValueChangeAction</code>, but the action's type is{" "}
        <code>UrgentChangeAction</code>: it is called synchronously, outside any transition, and
        never awaited. A controlled parent simply sets its state in the body:
      </p>
      <CodeBlock>{`const [text, setText] = useState("");
<Combobox.Root inputValue={text} inputValueChangeAction={(next) => setText(next)}>`}</CodeBlock>
      <p>Everything downstream of the text leaves the urgent lane at once:</p>
      <ul>
        <li>
          <strong>The results</strong> render from <code>query</code>, which is{" "}
          <code>useDeferredValue(inputValue)</code>. A slow search never blocks a keystroke; the
          previous results stay on screen (no fallback flash) with <code>data-stale</code> and{" "}
          <code>aria-busy="true"</code> until the new ones are ready; and only the latest query is
          ever rendered, so a slow response for "ja" cannot overwrite the results for "jap".
        </li>
        <li>
          <strong>Opening</strong> is a transition (<code>openChangeAction</code>).
        </li>
        <li>
          <strong>Choosing</strong> an option is a transition (<code>valueChangeAction</code>) with
          an optimistic selection, exactly as every other value in the library.
        </li>
      </ul>
      <Callout title="Do not fetch in inputValueChangeAction">
        <p>
          <code>{"inputValueChangeAction={async (q) => setResults(await search(q))}"}</code> brings
          back every problem the deferred query solves: responses land in completion order, nothing
          marks the results stale, and the urgent action is not awaited anyway (development warns
          when it returns a promise). Read a query-keyed cache with <code>use()</code> inside the
          List instead.
        </p>
      </Callout>
      <p>
        While any async action is pending in the app (this combobox's own slow save included), React
        holds every transition. Typing is unaffected (urgent), and so are the results: a deferred
        render is not held by a pending action (verified in Chromium and Firefox). Opening the
        listbox while a save is pending is a transition, so it waits for the save: the input shows{" "}
        <code>aria-expanded="true"</code> and <code>data-pending</code> meanwhile.
      </p>

      <h3>Anatomy</h3>
      <CodeBlock>{`import { Combobox } from "@funstack/ui/combobox";

<Combobox.Root name="country" valueChangeAction={saveCountry}>   {/* no DOM; a hidden input with name */}
  <Combobox.Label>Country</Combobox.Label>                          {/* label[for] */}
  <Combobox.Input placeholder="Type to search" required />          {/* input[role=combobox] */}
  <Combobox.Clear aria-label="Clear" />                             {/* button, optional */}
  <Combobox.Trigger aria-label="Show all countries" />              {/* button, optional */}
  <Combobox.Popup className="listbox">                              {/* div[popover=auto] */}
    <Combobox.List>                                                 {/* div[role=listbox] */}
      {({ query }) => (
        <Suspense fallback={<Combobox.Status>Searching…</Combobox.Status>}>
          <CountryOptions query={query} />                          {/* Combobox.Option… */}
        </Suspense>
      )}
    </Combobox.List>
    <Combobox.Empty>No country matches.</Combobox.Empty>            {/* only when settled and empty */}
  </Combobox.Popup>
</Combobox.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>Two states.</strong> <code>value</code> (<code>string | null</code>) is what is
          chosen; <code>inputValue</code> is what is typed. The library writes the text itself only
          at defined moments: typing, an accepted option (its <code>label</code>, else its text), a
          revert, Clear, a form reset, and text typed before hydration. It never derives the text
          from <code>value</code>, so a preselected value needs its text too:{" "}
          <code>
            {"<Combobox.Root defaultValue={user.country} defaultInputValue={user.countryName}>"}
          </code>{" "}
          (development warns otherwise).
        </li>
        <li>
          <strong>Popup and List are separate</strong> because a listbox may contain only options
          and groups: <code>Empty</code> and a hint <code>Status</code> go in the Popup, outside the
          List. A <code>Status</code> inside the List (the Suspense fallback above) marks the
          results as loading: it renders with <code>role="none"</code> (no live region inside the
          listbox), the List gets <code>aria-busy="true"</code>, <code>Empty</code> stays hidden and
          nothing is announced until the results arrive.
        </li>
        <li>
          <strong>No portal, no positioner.</strong> The Popup is shown with{" "}
          <code>{"showPopover({ source: input })"}</code>: the input is its implicit anchor and
          clicks on the input never light-dismiss it. Render the Popup next to the Input.
        </li>
        <li>
          The Trigger has no <code>commandfor</code>: the listbox is always anchored to the input
          and opened by the library. Before hydration the input is a plain text field; text typed
          then is kept and adopted at mount, and nothing opens until the next keystroke.
        </li>
      </ul>

      <h3>Accepting an option</h3>
      <p>
        Enter on the active option, or a click: the input text becomes the option's label at once,
        the option gets <code>data-selected</code> and <code>data-pending</code>, and{" "}
        <code>valueChangeAction</code> runs in the Root's transition while the listbox stays open.
        When it settles the listbox closes in the same commit. A rejection rolls the text and the
        selection back, leaves the listbox open and reaches the nearest Error Boundary. Re-choosing
        the selected option dispatches nothing and closes. If you type a new search while the save
        runs, the listbox stays open when it settles.
      </p>
      <p>
        A controlled "update on success" parent (
        <code>{"startTransition(() => setValue(next))"}</code> after its <code>await</code>) works
        as everywhere. A parent that refuses a value gets the text and the selection reverted; the
        listbox closes anyway, because the close is part of the action's commit.
      </p>

      <h3>Free text</h3>
      <Example
        source={comboboxDrinkSource}
        fileName="ComboboxDrink.tsx"
        css={comboboxCss}
        cssFileName="combobox.css"
      >
        <ComboboxDrink />
      </Example>
      <p>
        With <code>allowCustomValue</code> the typed text is a value: Enter with no active option,
        or focus leaving, dispatches it with <code>details.custom: true</code> (an emptied text
        dispatches <code>null</code>). Enter on a closed listbox is not prevented, so a form still
        submits, and the hidden input already holds the new text. Without{" "}
        <code>allowCustomValue</code>, text that is not the selection's label reverts when focus
        leaves (<code>reason: "dismiss"</code>), so the field never shows a value it does not have.
      </p>

      <h3>Props</h3>
      <h4>
        <code>Combobox.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string | null",
            description:
              "Controlled selection. `null`: nothing selected. `undefined` means uncontrolled.",
          },
          {
            name: "defaultValue",
            type: "string | null",
            default: "null",
            description: "Initial selection when uncontrolled; what a form reset returns to.",
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<string | null, ComboboxValueChangeDetails>",
            description:
              "Runs in the Root's transition when the user accepts an option, commits free text, presses Clear, or the form resets. Awaited; the listbox closes in the commit that ends it; a rejection rolls the text and the selection back and leaves the listbox open. May be a Server Function. A `setState` after your own `await` needs `startTransition`.",
          },
          {
            name: "inputValue",
            type: "string",
            description: "Controlled text. `undefined` means uncontrolled.",
          },
          {
            name: "defaultInputValue",
            type: "string",
            default: '""',
            description:
              "Initial text when uncontrolled, and the visible input's form-reset target. Pass the selected option's label together with `defaultValue`.",
          },
          {
            name: "inputValueChangeAction",
            type: "UrgentChangeAction<string, ComboboxInputValueChangeDetails>",
            description:
              "The urgent lane: called synchronously, outside any transition, on every change of the text (typing, and the library's own writes). Not awaited, never pending. Set your state in the body.",
          },
          {
            name: "open",
            type: "boolean",
            description: "Controlled open state. `undefined` means uncontrolled.",
          },
          {
            name: "defaultOpen",
            type: "boolean",
            default: "false",
            description: "Initial open state; opens after hydration.",
          },
          {
            name: "openChangeAction",
            type: "ChangeAction<boolean, ComboboxOpenChangeDetails>",
            description:
              "Awaited for opens and for the closes the library performs (an accepted option, the Trigger); a notification for dismissals (Escape, a click outside, focus leaving).",
          },
          {
            name: "allowCustomValue",
            type: "boolean",
            default: "false",
            description:
              "Free text is a value (Enter with no active option, focus leaving), dispatched with `details.custom: true`. Otherwise unmatched text reverts when focus leaves.",
          },
          {
            name: "autoHighlight",
            type: "boolean",
            default: "false",
            description:
              "Make the first enabled option active when the results for an open or an edit settle (APG automatic selection): typing then Enter picks the first match. Stale results are never highlighted, so an Enter before they settle commits the typed text (`allowCustomValue`) or does nothing.",
          },
          {
            name: "openOnClick",
            type: "boolean",
            default: "false",
            description: "Open on a click in the input (never on focus alone).",
          },
          {
            name: "loop",
            type: "boolean",
            default: "false",
            description: "ArrowDown / ArrowUp wrap from the last option to the first and back.",
          },
          {
            name: "announce",
            type: "(count: number, state: ComboboxRootState) => string | null",
            default: '"No results" / "1 result" / "N results"',
            description:
              "The message `ariaNotify()` announces on the List when the results settle. Override for localisation; return `null` to announce nothing. Ignored where `ariaNotify` is missing.",
          },
          {
            name: "name",
            type: "string",
            description:
              'Renders `<input type="hidden" name>` holding the optimistic value (`""` for `null`), the Root\'s only element.',
          },
          {
            name: "form",
            type: "string",
            description: "The hidden input's `form` attribute.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "Disables the Input, Trigger and Clear; nothing dispatches for user interaction. The hidden input stays enabled, so the selection still posts (wrap in `<fieldset disabled>` to drop it).",
          },
          {
            name: "children",
            type: "ReactNode | ((state: ComboboxRootState) => ReactNode)",
            description: "The parts, or a function of the Root's state.",
          },
        ]}
      />
      <p>
        <code>ComboboxRootState</code>:{" "}
        <code>{"{ value, inputValue, query, stale, activeValue, open, pending, disabled }"}</code>.{" "}
        <code>value</code> and <code>open</code> are optimistic; <code>stale</code> is{" "}
        <code>inputValue !== query</code>; <code>pending</code> covers the value and the open
        transitions. No <code>ref</code>, <code>className</code> or <code>style</code>: the Root has
        no element. <code>multiple</code> is not part of this version.
      </p>
      <p>
        <code>ComboboxValueChangeDetails</code>: <code>{"{ reason, custom, event }"}</code>.{" "}
        <code>reason</code> is <code>"activate"</code> (an accepted option: the <code>keydown</code>{" "}
        or <code>click</code>; free text: the <code>keydown</code> or <code>focusout</code>; Clear:
        the <code>click</code>) or <code>"platform"</code> (a form reset: the <code>reset</code>{" "}
        event). <code>ComboboxInputValueChangeDetails</code>: <code>{"{ reason, event }"}</code>,
        with <code>"activate"</code> for typing (the <code>input</code> event), an accepted label
        and Clear, <code>"dismiss"</code> for a revert, <code>"platform"</code> for a reset or text
        found at mount (no event). <code>ComboboxOpenChangeDetails</code>:{" "}
        <code>{"{ reason, event }"}</code>, as Popover's.
      </p>

      <h4>
        <code>Combobox.Input</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "required",
            type: "boolean",
            description: "Native: an empty text is `valueMissing`, with the browser's message.",
          },
          {
            name: "className",
            type: "string | ((state: ComboboxInputState) => string | undefined)",
            description: "A class name, or a function of the input's state.",
          },
          {
            name: "style",
            type: "CSSProperties | ((state: ComboboxInputState) => CSSProperties | undefined)",
            description: "Inline style, or a function of the input's state.",
          },
          renderProp("input", "ComboboxInputState"),
        ]}
      />
      <p>
        <code>ComboboxInputState</code>:{" "}
        <code>{"{ value, inputValue, open, pending, stale, disabled }"}</code>. Owns <code>id</code>
        , <code>type</code> (<code>"text"</code>, or <code>"search"</code> when a{" "}
        <code>render</code> element says so), <code>role</code>, <code>value</code>,{" "}
        <code>autoComplete="off"</code>, the <code>aria-autocomplete</code> /{" "}
        <code>aria-expanded</code> / <code>aria-controls</code> / <code>aria-activedescendant</code>{" "}
        wiring, <code>disabled</code> and its <code>onChange</code>, <code>onKeyDown</code>,{" "}
        <code>onBlur</code>, <code>onClick</code>. <code>placeholder</code>, <code>name</code> (a
        second field with the raw text), <code>aria-describedby</code> and other input props pass
        through. A <code>render</code> element must stay an <code>&lt;input&gt;</code> of type text
        or search.
      </p>

      <h4>
        <code>Combobox.Trigger</code>, <code>Combobox.Clear</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Native `disabled`; the Root\'s `disabled` applies too. With a link or component `render`, `aria-disabled="true"` instead.',
          },
          ...functionProps(
            "ComboboxTriggerState | ComboboxClearState",
            "Content, usually an icon; give the button an `aria-label` (development warns without a name).",
          ),
          renderProp("button", "ComboboxTriggerState | ComboboxClearState"),
        ]}
      />
      <p>
        Both are <code>&lt;button type="button" tabindex="-1"&gt;</code> (the input is the one Tab
        stop), keep focus in the input when pressed and focus it when clicked.{" "}
        <code>ComboboxTriggerState</code>: <code>{"{ open, pending, disabled }"}</code>; the Trigger
        toggles the listbox and carries <code>aria-expanded</code>, <code>aria-controls</code>.{" "}
        <code>ComboboxClearState</code>: <code>{"{ value, inputValue, disabled }"}</code>; Clear
        empties the text and dispatches <code>null</code> unless nothing is selected. It is always
        rendered: hide it with CSS (<code>:has(input:placeholder-shown)</code>) or its state. A
        click on Clear while the listbox is open closes it (light dismiss: the button is outside the
        popup).
      </p>

      <h4>
        <code>Combobox.Popup</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "keepMounted",
            type: "boolean",
            default: "false",
            description:
              "`false`: the children render only while open. `true`: they stay mounted in a hidden `<Activity>`.",
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              'The `<ViewTransition default>` around the popover element. Animates library-driven opens and closes in every engine. A deferred results render activates it too, so use a map with `default: "none"` (below). Keep it static.',
          },
          ...functionProps("ComboboxPopupState"),
          renderProp("div", "ComboboxPopupState"),
        ]}
      />
      <p>
        <code>ComboboxPopupState</code>: <code>{"{ open, stale, query }"}</code> (<code>open</code>{" "}
        committed). Renders <code>&lt;div popover="auto"&gt;</code> with <code>data-stale</code> and
        no role, and owns <code>id</code>, <code>popover</code>, <code>onPointerDown</code> and{" "}
        <code>onMouseDown</code> (a press anywhere in it keeps focus in the input). Inline style{" "}
        <code>
          position-area: self-block-end span-self-inline-end; position-try-fallbacks: flip-block;
          min-width: anchor-size(width)
        </code>{" "}
        places it below the input (above when it does not fit), at least as wide; your{" "}
        <code>style</code> wins per property. A <code>render</code> element must stay a{" "}
        <code>&lt;div&gt;</code>.
      </p>

      <h4>
        <code>Combobox.List</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps(
            "ComboboxListState",
            "Usually a function of `{ query }` returning the Options for it, under your own `<Suspense>` for an async search.",
          ),
          renderProp("div", "ComboboxListState"),
        ]}
      />
      <p>
        <code>ComboboxListState</code>: <code>{"{ query, stale, empty }"}</code>. Renders{" "}
        <code>&lt;div role="listbox"&gt;</code>, named by the Label (<code>aria-labelledby</code>,
        token-merged with yours, only when a <code>Combobox.Label</code> is rendered; without a
        Label give the List an <code>aria-label</code>, development warns otherwise), with{" "}
        <code>aria-busy="true"</code> while stale (with <code>data-stale</code>) or loading (a{" "}
        <code>Status</code> fallback inside it), and <code>data-empty</code> when settled with no
        options.
      </p>

      <h4>
        <code>Combobox.Option</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description:
              "Required and unique within the Combobox; the option's id is derived from it, so it keeps its id across result sets.",
          },
          {
            name: "label",
            type: "string",
            description:
              "The text written into the input when the option is accepted. Default: the option's trimmed text at that moment. Not used for matching.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "`aria-disabled`: shown, skipped by the arrow keys, never accepted.",
          },
          ...functionProps(
            "ComboboxOptionState",
            "Content, or a function of the option's state; must not suspend.",
          ),
          renderProp("div", "ComboboxOptionState"),
        ]}
      />
      <p>
        <code>ComboboxOptionState</code>:{" "}
        <code>{"{ value, selected, active, pending, disabled }"}</code>. <code>selected</code> is
        optimistic, <code>active</code> is virtual focus, <code>pending</code> is true on the option
        being saved. Renders <code>&lt;div role="option" aria-selected&gt;</code>; never focused, no{" "}
        <code>tabindex</code>. Hovering makes it active. Owns <code>id</code>, <code>role</code>,{" "}
        <code>aria-selected</code>, <code>aria-disabled</code> and its pointer and click handlers.
      </p>

      <h4>
        <code>Combobox.Group</code>, <code>Combobox.GroupLabel</code>, <code>Combobox.Empty</code>,{" "}
        <code>Combobox.Status</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps(
            "{} (Empty: ComboboxListState)",
            "Content. Empty renders only when the List has no options, the results are not stale and none are loading.",
          ),
          {
            name: "render",
            type: "ReactElement | ((props, state) => ReactNode)",
            description: "Replace the default <div>.",
          },
        ]}
      />
      <p>
        <code>Group</code> is <code>&lt;div role="group" aria-labelledby&gt;</code> named by the{" "}
        <code>GroupLabel</code> inside it. <code>Status</code> inside the List (as a Suspense
        fallback) is <code>&lt;div role="none"&gt;</code> and marks the results as loading (the List
        is <code>aria-busy</code>); in the Popup it is a plain hint,{" "}
        <code>&lt;div role="status"&gt;</code>. <code>Empty</code> is a plain{" "}
        <code>&lt;div&gt;</code> that renders nothing unless the results are settled and empty, so
        "No results" never flashes during a search.
      </p>

      <h3>Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          ["`data-open`", "Input, Trigger", "Optimistic open state (`aria-expanded`)."],
          [
            "`data-pending`",
            "Input",
            "A selection or an open is in flight (the Root's `pending`).",
          ],
          ["`data-pending`", "Trigger", "The open (or close) is in flight."],
          ["`data-pending`", "Option", "The option the in-flight selection is choosing."],
          ["`data-selected`", "Input", "A value is selected (optimistic, not `null`)."],
          ["`data-selected`", "Option", "This option is the optimistic selection."],
          ["`data-active`", "Option", "`aria-activedescendant` points here (keyboard or hover)."],
          [
            "`data-stale`",
            "Input, Popup, List",
            "The results shown are for an older text; the List also has `aria-busy`.",
          ],
          ["`data-empty`", "List", "Settled with no options."],
          ["`data-disabled`", "Input, Trigger, Clear, Option", "Disabled."],
          ["`:popover-open`", "Popup", "The listbox is shown (browser-owned, no attribute)."],
        ]}
      />

      <h3>Keyboard</h3>
      <Table
        head={["Key", "Listbox", "Behaviour"]}
        rows={[
          [
            "Typing, Backspace, paste",
            "any",
            "Changes the text (urgent), clears the active option and opens the listbox.",
          ],
          ["ArrowDown / ArrowUp", "closed", "Opens with the first / last enabled option active."],
          [
            "ArrowDown / ArrowUp",
            "open",
            "Next / previous enabled option; stops at the ends (wraps with `loop`).",
          ],
          ["Alt+ArrowDown", "closed", "Opens with no option active."],
          ["Alt+ArrowUp", "open", "Accepts the active option, or closes."],
          [
            "Enter",
            "open",
            "Accepts the active option; with none, commits free text (`allowCustomValue`) or does nothing.",
          ],
          [
            "Enter",
            "closed",
            "Not handled (a form submits); commits changed free text first with `allowCustomValue`.",
          ],
          [
            "Escape",
            "open",
            "The platform closes the listbox; focus and text stay. A second Escape reaches an enclosing Dialog or Popover.",
          ],
          [
            "Tab / Shift+Tab",
            "any",
            "Focus moves on and the listbox closes; the text reverts or, with `allowCustomValue`, commits. Tab never accepts the active option.",
          ],
          [
            "Home / End, Left / Right",
            "any",
            "The input's caret; the active option is cleared (focus is back on the text).",
          ],
        ]}
      />
      <p>
        Disabled options are skipped. Keys during an IME composition belong to the composition. Ctrl
        and Meta combinations are left alone.
      </p>

      <h3>Accessibility and announcements</h3>
      <ul>
        <li>
          The Input is <code>role="combobox"</code> with <code>aria-autocomplete="list"</code>,{" "}
          <code>aria-expanded</code>, <code>aria-controls</code> (the List) and{" "}
          <code>aria-activedescendant</code> (the active option, never a stale id; removed while you
          edit the text). Name it with <code>Combobox.Label</code>, which names the listbox too.
        </li>
        <li>
          When results settle, the library announces their count with <code>ariaNotify()</code> on
          the List: by default the English <code>"No results"</code>, <code>"1 result"</code>,{" "}
          <code>"N results"</code>. Nothing is announced while results are stale or loading (a{" "}
          <code>Status</code> fallback showing in the List), or for an unchanged result set.
          Localise with one function:
        </li>
      </ul>
      <CodeBlock>{`<Combobox.Root announce={(n) => (n === 0 ? "該当なし" : \`\${n}件\`)}>`}</CodeBlock>

      <h3>Styling and ViewTransition</h3>
      <CodeBlock language="css">{`.listbox { margin: 0; inset: auto; max-block-size: 20rem; overflow: auto; }
.listbox [role="listbox"][data-stale] { opacity: .6; }          /* old results while searching */
.listbox [role="option"][data-active] { background: var(--accent-weak); }
.listbox [role="option"][data-selected]::after { content: "✓"; }
.listbox [role="option"][data-pending] { cursor: progress; }
.combobox-input:user-invalid { border-color: var(--danger); }

/* Enter / exit for dismissals too (Escape, a click outside). */
.listbox { opacity: 0; transition: opacity 120ms, display 120ms allow-discrete, overlay 120ms allow-discrete; }
.listbox:popover-open { opacity: 1; }
@starting-style { .listbox:popover-open { opacity: 0; } }`}</CodeBlock>
      <p>
        <code>transition</code> on the Popup animates the library's own opens and closes with a view
        transition in every engine (including the close after an accepted option, which shows the
        pending option until it fades). A results change is a deferred render, and React runs a view
        transition for it too, during which the page takes no pointer input. Unless every results
        change should cross-fade, give it a type map:
      </p>
      <CodeBlock>{`<Combobox.Popup
  transition={{ "fsui-combobox-open": "pop", "fsui-combobox-close": "pop", default: "none" }}
>`}</CodeBlock>
      <p>
        Types: every value dispatch adds <code>fsui-combobox</code> and{" "}
        <code>fsui-combobox-select</code>; opens and closes add <code>fsui-combobox-open</code> /{" "}
        <code>fsui-combobox-close</code>.
      </p>

      <h3>Forms</h3>
      <ul>
        <li>
          <code>name</code> on the Root posts the value through a hidden input (<code>""</code> for{" "}
          <code>null</code>); a <code>name</code> on the Input posts the raw text as well.{" "}
          <code>required</code> on the Input is native.
        </li>
        <li>
          A form reset (the Reset button, <code>form.reset()</code>, or React's automatic reset
          after a form action) dispatches <code>valueChangeAction</code> with{" "}
          <code>reason: "platform"</code> and writes the text: uncontrolled, back to the latest{" "}
          <code>defaultValue</code> / <code>defaultInputValue</code>; controlled, to the mount-time
          values.
        </li>
        <li>
          Text typed before hydration (and Firefox's form restoration) is kept and reported once
          through <code>inputValueChangeAction</code> with <code>reason: "platform"</code>.
        </li>
      </ul>

      <h3>Placement, nesting and browser notes</h3>
      <ul>
        <li>
          <strong>Right-to-left:</strong> the listbox lines up with the input's inline-start edge
          (the right edge in RTL) under a <code>dir="rtl"</code> page or container. The{" "}
          <code>self-*</code> <code>position-area</code> keywords follow the popup's own inherited
          direction, with no JavaScript; plain logical keywords would follow the root's only,
          because the listbox is in the top layer. Firefox misplaces a popover inside a container
          whose direction differs from the page's (Mozilla bug 2019601,{" "}
          <a href="https://github.com/uhyo/funstack-ui/issues/89">#89</a>); page-level RTL is fine.
          The Popup emits no <code>data-side</code>.
        </li>
        <li>
          Inside a Dialog or a Popover the listbox nests in the top layer: the first Escape closes
          the listbox, the next the outer overlay; an outside click closes the stack. Inside a{" "}
          <code>Menu.Popup</code> a combobox is not supported (the menu's typeahead and focus
          handling compete with the input).
        </li>
        <li>
          Safari: a WebKit bug (302008) can hang a page that opens a popover with position fallbacks
          inside another popover. If a Combobox inside a Popover or Dialog misbehaves in Safari,
          turn the flip off: <code>{'style={{ positionTryFallbacks: "none" }}'}</code> on{" "}
          <code>Combobox.Popup</code>.
        </li>
        <li>
          Want the listbox as wide as an input-plus-buttons group? Give the group an{" "}
          <code>anchor-name</code> and pass <code>positionAnchor</code> and{" "}
          <code>minWidth: "anchor-size(--group width)"</code> through <code>style</code>.
        </li>
      </ul>
    </div>
  );
}
