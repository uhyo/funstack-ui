import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { ComboboxCountry } from "../examples/ComboboxCountry.js";
import { ComboboxDrink } from "../examples/ComboboxDrink.js";
import { ComboboxSlowOpen } from "../examples/ComboboxSlowOpen.js";
import { ComboboxTags } from "../examples/ComboboxTags.js";
import { functionProps, renderProp, stylingProps } from "./shared-props.js";

export function ComboboxPage() {
  return (
    <DocPage
      title="Combobox"
      description="An editable combobox with list autocomplete: urgent typing, results from a deferred query inside Suspense, aria-activedescendant, an async valueChangeAction with the option pending, free text, multiple selection with chips, forms and ariaNotify."
    >
      <p className="page-intro">
        A text input with a listbox of suggestions (the WAI-ARIA "editable combobox with list
        autocomplete"). Focus stays in the input; the active option moves with{" "}
        <code>aria-activedescendant</code>. The listbox is a <code>popover="auto"</code> anchored to
        the input with CSS, so the platform provides the top layer, light dismiss, Escape and
        nesting inside dialogs. The library filters nothing: you render the options for a query,
        synchronously or with <code>use()</code> under your own <code>&lt;Suspense&gt;</code>.
      </p>

      <Example file="ComboboxCountry.tsx" css="combobox.css">
        <ComboboxCountry />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
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
          <code>{"showPopover({ source: input })"}</code>: the input is its implicit anchor, and a
          press on the input keeps the listbox open (the Input captures the pointer to the Popup; in
          Firefox a drag-to-select in the field does not extend while the listbox is open). Known
          hole: in Chromium, a touch tap on the field inside a same-origin iframe (a Storybook or
          sandbox preview) still closes it (#124, upstream). Render the Popup next to the Input.
        </li>
        <li>
          The listbox is always anchored to the input and opened by the library. The server HTML
          gives the Trigger no <code>popovertarget</code>; after hydration a{" "}
          <code>{"<button>"}</code> Trigger becomes the listbox's{" "}
          <a href="/concepts/browser-owned-state#popup-triggers">invoker</a> (with every click
          cancelled), so pressing it while the listbox is open is not a light dismiss, and the
          browser exposes the listbox's state on it. The Input renders <code>aria-expanded</code>{" "}
          itself. Before hydration the input is a plain text field; text typed then is kept and
          adopted at mount, and nothing opens until the next keystroke.
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <h4>Typing is urgent; everything it causes is not</h4>
      <p>
        React requires a controlled text input to update urgently, in the same event as the
        keystroke: by the time the library hears of it, the text is already in the DOM. So the text
        is <strong>urgent state</strong>, a <a href="/concepts/action-props#fact">fact</a> rather
        than a request. It keeps the usual pair, <code>inputValue</code> /{" "}
        <code>defaultInputValue</code>, but its callback is a handler, not an action:{" "}
        <code>onInputValueChange</code> (an{" "}
        <a href="/concepts/action-props#on-handler">
          <code>on*</code> handler
        </a>
        ) is called synchronously, outside any transition, and never awaited. A controlled parent
        simply sets its state in the body:
      </p>
      <CodeBlock>{`const [text, setText] = useState("");
<Combobox.Root inputValue={text} onInputValueChange={(next) => setText(next)}>`}</CodeBlock>
      <p>Everything downstream of the text is a transition again:</p>
      <ul>
        <li>
          <strong>The results</strong> render from <code>query</code>, which is{" "}
          <code>useDeferredValue(inputValue)</code>. A slow search never blocks a keystroke; the
          previous results stay on screen (no fallback flash) with <code>data-stale</code> and{" "}
          <code>aria-busy="true"</code> until the new ones are ready; and only the latest query is
          ever rendered, so a slow response for "ja" cannot overwrite the results for "jap".
        </li>
        <li>
          <strong>Opening</strong> is a transition (<code>openChangeAction</code>). A dismissal
          (Escape, a click outside, focus leaving) is a fact, reported to <code>onOpenChange</code>.
        </li>
        <li>
          <strong>Choosing</strong> an option is a transition (<code>valueChangeAction</code>) with
          an optimistic selection, exactly as every other value in the library.
        </li>
      </ul>
      <Callout title="Do not fetch in onInputValueChange">
        <p>
          <code>{"onInputValueChange={async (q) => setResults(await search(q))}"}</code> brings back
          every problem the deferred query solves: responses land in completion order, nothing marks
          the results stale, and the urgent handler is not awaited anyway. Read a query-keyed cache
          with <code>use()</code> inside the List instead. (Returning a promise is allowed, for work
          the UI does not wait for such as logging: like every <code>on*</code> handler, its
          rejection goes to <code>reportError</code>.)
        </p>
      </Callout>
      <p>
        While any async action is pending in the app (this combobox's own slow save included), React
        holds every transition. Typing is unaffected (urgent), and so are the results: a deferred
        render is not held by a pending action (verified in Chromium and Firefox). Opening the
        listbox while a save is pending is a transition, so it waits for the save: the input shows{" "}
        <code>data-open</code> and <code>data-pending</code> meanwhile, and its{" "}
        <code>aria-expanded</code> turns <code>"true"</code> when the listbox is shown.
      </p>

      <h4>Accepting an option</h4>
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

      <h4>Free text</h4>
      <Example file="ComboboxDrink.tsx" css="combobox.css">
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

      <h4 id="multiple">Multiple selection</h4>
      <Example file="ComboboxTags.tsx" css="combobox.css">
        <ComboboxTags />
      </Example>
      <p>
        <code>multiple</code> on the Root turns the selection into a list of values (
        <code>string[]</code>, in pick order) shown as chips. The text is then only a search:
      </p>
      <ul>
        <li>
          <strong>A pick toggles</strong> the option (a selected option is removed), clears the text
          and leaves the listbox open for the next pick. The listbox is{" "}
          <code>aria-multiselectable</code> and every option keeps its <code>aria-selected</code>. A
          rejection rolls back that one change (the chip and <code>data-selected</code>), never the
          text.
        </li>
        <li>
          <strong>The value follows the set rules</strong> of CheckboxGroup: each dispatch is one
          change, with <code>details.added</code> and <code>details.removed</code>; picks made while
          an earlier save runs stack, and only the changes whose action resolved are kept. Persist
          the diff, not <code>next</code>, which may contain a change that fails later.
        </li>
        <li>
          <strong>
            <code>Combobox.Chips</code>
          </strong>{" "}
          is a list of the optimistic values (a removed chip disappears at once and comes back if
          its save fails); you map them to <code>Combobox.Chip</code>s. A chip's <code>label</code>{" "}
          state is the text of the option the library last saw for its value, so an async search
          needs no map of its own. It is the list of chips only, not the field box: put the Input
          next to it in your own element.
        </li>
        <li>
          <strong>Keys:</strong> Backspace in the empty input removes the last chip; the
          inline-start arrow (Left, Right in RTL) at the caret's start moves focus into the chips,
          where the arrows, Home and End move, Backspace or Delete remove, Escape goes back and a
          letter types into the input. The combobox keeps one Tab stop. Chips removed outside the
          listbox are announced (<code>"Japan removed"</code>, <code>announceRemoved</code> to
          localise).
        </li>
        <li>
          <strong>Forms:</strong> one hidden input per value (<code>formData.getAll(name)</code>
          ), nothing for an empty selection. <code>required</code> on the Input means "at least
          one": native <code>required</code> is rendered only while nothing is selected, and{" "}
          <code>aria-required</code> always. Unmatched text is cleared when focus leaves and by
          Enter in a closed listbox, so it never satisfies <code>required</code>. With{" "}
          <code>allowCustomValue</code>, Enter (prevented, the form does not submit) and focus
          leaving add the text as a value instead.
        </li>
      </ul>
      <CodeBlock>{`<Combobox.Root multiple name="countries" defaultValue={["jp"]} valueChangeAction={saveCountries}>
  <Combobox.Label>Countries</Combobox.Label>
  <div className="field">                                {/* your box around chips and input */}
    <Combobox.Chips>                                     {/* div[role=list] */}
      {({ value }) => value.map((code) => (
        <Combobox.Chip key={code} value={code}>          {/* div[role=listitem][tabindex=-1] */}
          {({ label }) => (
            <>
              {label ?? code}
              <Combobox.ChipRemove aria-label={\`Remove \${label ?? code}\`} />  {/* button */}
            </>
          )}
        </Combobox.Chip>
      ))}
    </Combobox.Chips>
    <Combobox.Input placeholder="Add a country" required />
  </div>
  <Combobox.Popup>…</Combobox.Popup>
</Combobox.Root>`}</CodeBlock>

      <h3 id="props">Props</h3>
      <h4>
        <code>Combobox.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "multiple",
            type: "boolean",
            default: "false",
            description:
              "`true`: the selection is a list of values shown as chips ([Multiple selection](#multiple)); `value`, `defaultValue`, `valueChangeAction`, `announce` and `children` take the multiple types below. Fixed at mount (development warns on a change).",
          },
          {
            name: "value",
            type: "string | null",
            description:
              "Controlled selection. `null`: nothing selected. `undefined` means uncontrolled. With `multiple`: `string[]`, `[]` for nothing; the order is the chip order, duplicates are ignored.",
          },
          {
            name: "defaultValue",
            type: "string | null",
            default: "null",
            description:
              "Initial selection when uncontrolled; what a form reset returns to. With `multiple`: `string[]`, default `[]`.",
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<string | null, ComboboxValueChangeDetails>",
            description:
              "Runs in the Root's transition when the user accepts an option, commits free text, presses Clear, or the form resets. Awaited; the listbox closes in the commit that ends it; a rejection rolls the text and the selection back and leaves the listbox open. May be a Server Function. A `setState` after your own `await` needs `startTransition`. With `multiple`: `ChangeAction<string[], ComboboxMultipleValueChangeDetails>`, called for every change (a pick, a removed chip, Clear, free text, a reset); the listbox does not close; a rejection undoes that change only.",
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
            name: "onInputValueChange",
            type: "UrgentChangeHandler<string, ComboboxInputValueChangeDetails>",
            description:
              "A [handler](/concepts/action-props#on-handler), not an action: called synchronously, outside any transition, on every change of the text (typing, and the library's own writes). Not awaited, never pending. Set your state in the body. May return a promise; a rejection or a throw goes to `reportError` ([the rule of every on* handler](/concepts/action-props#handlers)).",
          },
          {
            name: "open",
            type: "boolean",
            description:
              "Controlled open state. `undefined` means uncontrolled. Pass `onOpenChange` too (development warns).",
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
              'Requests only: awaited for opens and for the closes a part asks for (an accepted option, the Trigger, Alt+ArrowUp). Never called for a dismissal (`onOpenChange`). Runs in the Root\'s transition; may be a Server Function. `details.reason`: `"activate"` (typing, ArrowDown / ArrowUp / Alt+ArrowDown, the Trigger, a click on the input with `openOnClick`, an accepted option, Alt+ArrowUp, a foreign `showPopover()`) or `"platform"` (found open on mount, which only script can cause; `event` is `undefined`).',
          },
          {
            name: "onOpenChange",
            type: "UrgentChangeHandler<boolean, ComboboxOpenChangeDetails>",
            description:
              'Facts only: the listbox was closed without the library closing it on request. Always `false`. `details.reason`: `"dismiss"` (Escape, focus leaving the input, a click outside, a Clear click while open, another popover opening, script) or `"activate"` (a [foreign invoker](/concepts/browser-owned-state#foreign-invoker), whose press does not move focus out of the input, so the text is left as typed; a Trigger rendered as another element, pressed while open). Called synchronously in the browser\'s `toggle` event, outside any transition, and not awaited: nothing is pending and no view transition runs. In controlled mode set state directly here (`onOpenChange={setOpen}`), never in `startTransition` or after an `await`; a parent that keeps `open` gets the listbox shown again at once, with focus left where the dismissal put it. May return a promise (a Server Function); a rejection or a throw goes to `reportError`.',
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
            name: "announceRemoved",
            type: "(labels: readonly string[], state: ComboboxMultipleRootState) => string | null",
            default: '"Japan removed" (the labels joined with ", ")',
            description:
              "`multiple` only. The message `ariaNotify()` announces on the Input when chips are removed outside the listbox (Backspace, Delete, `ChipRemove`, Clear). A label is the Chip's `label`, else the option text the library saw, else the chip's text. Return `null` to announce nothing.",
          },
          {
            name: "name",
            type: "string",
            description:
              'Renders `<input type="hidden" name>` holding the optimistic value (`""` for `null`), the Root\'s only element. With `multiple`: one hidden input per value, in value order; none named while the selection is empty.',
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
              "Disables the Input, Trigger and Clear (and every `ChipRemove`); nothing dispatches for user interaction. The hidden input stays enabled, so the selection still posts (wrap in `<fieldset disabled>` to drop it).",
          },
          {
            name: "children",
            type: "ReactNode | ((state: ComboboxRootState) => ReactNode)",
            description:
              "The parts, or a function of the Root's state (`ComboboxMultipleRootState` with `multiple`).",
          },
        ]}
      />
      <PartFacts
        state={
          "`ComboboxRootState` is `{ value, inputValue, query, stale, activeValue, open, pending, disabled }`; `value` and `open` are optimistic; `stale` is `inputValue !== query`; `pending` covers the value and the open transitions. `ComboboxMultipleRootState` is the same with `value: readonly string[]` (pick order)."
        }
        owned={
          "nothing rendered: the Root has no element (no `ref`, `className` or `style`), only the hidden input(s) when `name` is given."
        }
        note={
          "The props type is `ComboboxRootProps = ComboboxSingleProps | ComboboxMultipleProps`, discriminated on `multiple`."
        }
      />
      <p>
        <code>ComboboxValueChangeDetails</code>: <code>{"{ reason, custom, event }"}</code>.{" "}
        <code>reason</code> is <code>"activate"</code> (an accepted option: the <code>keydown</code>{" "}
        or <code>click</code>; free text: the <code>keydown</code> or <code>focusout</code>; Clear:
        the <code>click</code>) or <code>"platform"</code> (a form reset: the <code>reset</code>{" "}
        event). <code>ComboboxInputValueChangeDetails</code>: <code>{"{ reason, event }"}</code>,
        with <code>"activate"</code> for typing (the <code>input</code> event), an accepted label
        and Clear, <code>"dismiss"</code> for a revert, <code>"platform"</code> for a reset or text
        found at mount (no event). <code>ComboboxOpenChangeDetails</code>:{" "}
        <code>{"{ reason, event }"}</code>; the reasons are listed with{" "}
        <code>openChangeAction</code> and <code>onOpenChange</code> above.
      </p>
      <p>
        <code>ComboboxMultipleValueChangeDetails</code> (with <code>multiple</code>):{" "}
        <code>{"{ reason, added, removed, custom, event }"}</code>. <code>added</code> lists the
        values this dispatch added, in the order they join; <code>removed</code> the values it
        removed, in value order; <code>custom</code> is <code>true</code> for free text.{" "}
        <code>reason</code> is <code>"activate"</code> (a toggled option: the <code>keydown</code>{" "}
        or <code>click</code>; a removed chip: the <code>keydown</code> of Backspace or Delete, the{" "}
        <code>click</code> of <code>ChipRemove</code>; Clear; free text: the <code>keydown</code> or{" "}
        <code>focusout</code>) or <code>"platform"</code> (a form reset, dispatched whole with the
        diff). With <code>multiple</code> the library writes the text on typing, a pick (
        <code>""</code>, <code>"activate"</code>), Clear, focus leaving (<code>""</code>,{" "}
        <code>"dismiss"</code>), a reset and at mount.
      </p>

      <h4>
        <code>Combobox.Label</code>
      </h4>
      <PropsTable
        rows={[...functionProps("ComboboxLabelState"), renderProp("label", "ComboboxLabelState")]}
      />
      <PartFacts
        state={"`ComboboxLabelState` is `{ disabled }`."}
        owned={"`id`, `htmlFor`."}
        note={
          "A `<label for>` of the Input; its id also names the List (`aria-labelledby`), only while a Label is mounted. Inside a `Field.Root`, `Field.Label` takes that role instead."
        }
      />

      <h4>
        <code>Combobox.Input</code>
      </h4>
      <p>
        One per Root: the Input is the listbox's anchor, so a second <code>Combobox.Input</code> in
        the same Root is not supported (development warns). Use a Root per input.
      </p>
      <PropsTable
        rows={[
          {
            name: "required",
            type: "boolean",
            description:
              "Native: an empty text is `valueMissing`, with the browser's message. With `multiple` it means at least one value: native `required` only while nothing is selected (optimistic), `aria-required` always.",
          },
          ...stylingProps("ComboboxInputState"),
          renderProp("input", "ComboboxInputState"),
        ]}
      />
      <PartFacts
        state={
          "`ComboboxInputState` is `{ value, values, inputValue, open, pending, stale, disabled }`. `values` is the optimistic selection as a list (`[value]` or `[]` in single mode); with `multiple`, `value` is always `null`."
        }
        owned={
          '`id`, `type` (`"text"`, or `"search"` when a `render` element says so), `role`, `value`, `autoComplete` (`"off"`), `aria-autocomplete`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `disabled`, `onChange`, `onKeyDown`, `onFocus`, `onBlur`, `onClick`, `onPointerDown`, `data-open`, `data-pending`, `data-selected`, `data-stale`, `data-disabled`. Inside a `Field.Root` also `required`, `aria-invalid`, `aria-describedby` (token-merged) and `data-invalid`. With `multiple` also `required` and `aria-required`.'
        }
        note={
          "`placeholder`, `name` (a second field with the raw text), `aria-describedby`, `onFocusCapture` (to react to focus) and other input props pass through. During a primary mouse or pen press while the listbox is open, the Input's `onPointerUp`, `onMouseUp` and `onDoubleClick` go to the Popup instead (the press is captured to it), and the Input gets pointer and mouse leave (then enter) events. A `render` element must stay an `<input>` of type text or search."
        }
      />

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
      <PartFacts
        state={
          "`ComboboxTriggerState` is `{ open, pending, disabled }`; `ComboboxClearState` is `{ value, values, inputValue, disabled }` (`values` as on the Input)."
        }
        owned={
          "`type` (on a `<button>`), `tabIndex` (`-1`: the input is the one Tab stop), `disabled`, `aria-disabled` (link or component `render`), `onClick`, `onPointerDown`, `onMouseDown`, `data-disabled`; the Trigger also `aria-expanded` (only when it is no invoker: a non-button `render`, or while `aria-disabled`), `aria-controls`, `popovertarget` (written as an attribute after hydration, only on a `<button>`, while enabled or natively disabled; not while `aria-disabled`), `data-open`, `data-pending`. Owned on the Trigger and never written as props: `popoverTarget`, `popoverTargetAction`, `commandfor`, `command`; these and `aria-expanded` are not in its props type."
        }
        note={
          "Both keep focus in the input when pressed and focus it when clicked. The Trigger toggles the listbox; on a `<button>` Trigger a click while it is open keeps it shown until `openChangeAction(false)` settles (a controlled parent that keeps `open` sees no flicker). A Trigger rendered as another element is light-dismissed before its click and warns in development ([Triggers of a popup](/concepts/browser-owned-state#popup-triggers)). Clear empties the text and dispatches `null` unless nothing is selected (with `multiple`: one change removing every value, announced); it is always rendered, so hide it with CSS (`:has(input:placeholder-shown)`) or its state. A click on Clear while the listbox is open closes it (light dismiss: the button is outside the popup)."
        }
      />

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
              "`false`: the children render only while open. `true`: they stay mounted in a hidden `<Activity>`; an action inside that rejects while it is hidden goes to `reportError`, not to an Error Boundary.",
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
      <PartFacts
        state={"`ComboboxPopupState` is `{ open, stale, query }`; `open` is committed."}
        owned={
          '`id`, `popover` (`"auto"`), `onPointerDown` and `onMouseDown` (a press anywhere in it keeps focus in the input), `data-stale`; no role.'
        }
        note={
          "Inline style `position-area: self-block-end span-self-inline-end; position-try-fallbacks: flip-block; min-width: anchor-size(width)` places it below the input (above when it does not fit), at least as wide; your `style` wins per property. A `render` element must stay a `<div>`."
        }
      />

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
      <PartFacts
        state={"`ComboboxListState` is `{ query, stale, empty }`."}
        owned={
          '`id`, `role` (`"listbox"`), `aria-labelledby` (token-merged with yours; only while a `Combobox.Label` is rendered), `aria-busy`, `data-stale`, `data-empty`; with `multiple`, `aria-multiselectable` (`"true"`).'
        }
        note={
          'Without a Label give the List an `aria-label` (development warns otherwise). `aria-busy="true"` is set while the results are stale or loading (a `Status` fallback inside it); `data-empty` when settled with no options.'
        }
      />

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
      <PartFacts
        state={
          "`ComboboxOptionState` is `{ value, selected, active, pending, disabled }`; `selected` is optimistic, `active` is virtual focus, `pending` is true on the option being saved (with `multiple`: being added or removed)."
        }
        owned={
          "`id` (derived from `value`), `role`, `aria-selected`, `aria-disabled`, `onClick`, `onPointerDown`, `onMouseDown`, `onPointerMove`, `data-selected`, `data-active`, `data-pending`, `data-disabled`."
        }
        note={"Never focused, no `tabindex`; hovering makes it active."}
      />

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
      <PartFacts
        state={"none (Empty: `ComboboxListState`)."}
        owned={
          'Group: `role` (`"group"`), `aria-labelledby`; GroupLabel: `id`; Status: `role` (`"none"` inside the List, `"status"` in the Popup).'
        }
        note={
          '`Group` is named by the `GroupLabel` inside it. `Status` inside the List (as a Suspense fallback) marks the results as loading (the List is `aria-busy`); in the Popup it is a plain hint. `Empty` is a plain `<div>` that renders nothing unless the results are settled and empty, so "No results" never flashes during a search.'
        }
      />

      <h4>
        <code>Combobox.Chips</code> (with <code>multiple</code>)
      </h4>
      <PropsTable
        rows={[
          ...functionProps(
            "ComboboxChipsState",
            "Usually a function of `{ value }` rendering one `Combobox.Chip` per value, keyed by the value; must not suspend.",
          ),
          renderProp("div", "ComboboxChipsState"),
        ]}
      />
      <PartFacts
        state={
          "`ComboboxChipsState` is `{ value, pending, disabled }`; `value` is the optimistic selection in pick order, `pending` the value action in flight."
        }
        owned={
          '`role` (`"list"`, absent while empty), `aria-labelledby` (the Label, token-merged; absent while empty), `onKeyDown` (the chip keys), `onPointerDown`, `onMouseDown`, `onClick` (a press keeps focus where it is; a click focuses the Input), `onFocus`, `onBlur` (a chip is inside the combobox: focus on it closes the listbox and keeps the text), `data-empty`, `data-pending`, `data-disabled`.'
        }
        note={
          "The list of chips, not the field box: render the Input next to it, in your own element. Under a Root without `multiple` it warns in development and renders empty."
        }
      />

      <h4>
        <code>Combobox.Chip</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description: "Required: a value of the selection (development warns otherwise).",
          },
          {
            name: "label",
            type: "string",
            description:
              "The chip's text for the removal announcement. Default: the state's `label`, else the chip's trimmed text.",
          },
          ...functionProps(
            "ComboboxChipState",
            "Content, or a function of the chip's state; default `label ?? value`. Must not suspend.",
          ),
          renderProp("div", "ComboboxChipState"),
        ]}
      />
      <PartFacts
        state={
          "`ComboboxChipState` is `{ value, label, pending, disabled }`. `label` is the text of the option with this value as the library last saw it (written at the pick), `undefined` if no option for it was ever rendered (a preselected value before the listbox first opens). `pending`: its addition is not committed yet."
        }
        owned={'`role` (`"listitem"`), `tabIndex` (`-1`), `data-pending`, `data-disabled`.'}
        note={
          'Focused by keys only, never a Tab stop. On a focused chip: the previous / next arrow (in the inline direction) moves, the next arrow past the last chip returns to the Input, Home / End go to the first / last chip, Backspace and Delete remove it (focus moves first to the next chip, else the previous, else the Input), Escape returns to the Input, a printable key types into the Input; Enter and Space do nothing. `aria-description` passes through for a hint such as "Press Backspace to remove".'
        }
      />

      <h4>
        <code>Combobox.ChipRemove</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps(
            "ComboboxChipRemoveState",
            "Content, usually an icon in an `aria-hidden` element (the chip's text is the announcement's fallback); give the button an `aria-label` (development warns without a name).",
          ),
          renderProp("button", "ComboboxChipRemoveState"),
        ]}
      />
      <PartFacts
        state={
          "`ComboboxChipRemoveState` is `{ value, pending, disabled }` (the Chip's value and pending)."
        }
        owned={
          "`type` (on a `<button>`), `tabIndex` (`-1`), `disabled` (the Root's), `aria-disabled` (link or component `render`), `onClick`, `onPointerDown`, `onMouseDown`, `data-pending`, `data-disabled`."
        }
        note={
          "Inside a `Combobox.Chip` (outside one it throws). A press keeps focus in the Input; the click removes the chip's value, announces it and focuses the Input. A press while the listbox is open closes it (light dismiss), as Clear's does."
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Hook", "On", "Meaning"]}
        rows={[
          [
            "`data-open`",
            "Input, Trigger",
            "Optimistic open state. The Input's `aria-expanded` follows the shown listbox instead; a `<button>` Trigger has no `aria-expanded` (the browser exposes its state).",
          ],
          [
            "`data-pending`",
            "Input",
            "A selection or an open is in flight (the Root's `pending`).",
          ],
          ["`data-pending`", "Trigger", "The open (or close) is in flight."],
          [
            "`data-pending`",
            "Option",
            "The option the in-flight selection is choosing (with `multiple`: being added or removed).",
          ],
          [
            "`data-pending`",
            "Chip, ChipRemove",
            "With `multiple`: the chip's addition is not committed yet (a removed chip is gone at once).",
          ],
          ["`data-pending`", "Chips", "With `multiple`: a value action is in flight."],
          [
            "`data-selected`",
            "Input",
            "A value is selected (optimistic, not `null`; with `multiple`, at least one).",
          ],
          ["`data-selected`", "Option", "This option is the optimistic selection."],
          ["`data-active`", "Option", "`aria-activedescendant` points here (keyboard or hover)."],
          [
            "`data-stale`",
            "Input, Popup, List",
            "The results shown are for an older text; the List also has `aria-busy`.",
          ],
          ["`data-empty`", "List", "Settled with no options."],
          ["`data-empty`", "Chips", "With `multiple`: nothing is selected."],
          [
            "`data-disabled`",
            "Input, Trigger, Clear, Option, Chips, Chip, ChipRemove",
            "Disabled.",
          ],
          ["`:popover-open`", "Popup", "The listbox is shown (browser-owned, no attribute)."],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
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
      <p>
        With <code>multiple</code>, in the Input (the chip keys are with{" "}
        <a href="#props">Combobox.Chip</a>):
      </p>
      <Table
        head={["Key", "When", "Behaviour"]}
        rows={[
          ["Enter", "open, active option", "Toggles it; the listbox stays open."],
          [
            "Enter",
            "open, no active option",
            "Adds the text as a value with `allowCustomValue`; otherwise nothing.",
          ],
          [
            "Enter",
            "closed, text typed",
            "`allowCustomValue`: adds the text (prevented, the form does not submit). Otherwise clears the text, then a form submits.",
          ],
          ["Alt+ArrowUp", "open", "Closes; the active option is not toggled."],
          [
            "Backspace",
            "empty text",
            "Removes the last chip and announces it (not on key repeat).",
          ],
          [
            "Left (Right in RTL)",
            "caret at the start",
            "Moves focus to the last chip; the listbox closes, the text stays.",
          ],
        ]}
      />
      <p>
        Screen readers hear a toggled option through its <code>aria-selected</code> under{" "}
        <code>aria-activedescendant</code>; a chip removed outside the listbox is announced with{" "}
        <code>ariaNotify()</code> on the Input (<code>"Japan removed"</code>):
      </p>
      <CodeBlock>{`<Combobox.Root multiple announceRemoved={(labels) => \`\${labels.join("、")}を削除しました\`}>`}</CodeBlock>

      <h4>Accessibility and announcements</h4>
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

      <BehaviourSection
        id="transition-types"
        summary={
          'Every value dispatch: `fsui-combobox` and `fsui-combobox-select` (with `multiple`: `-select` when something is added, `fsui-combobox-deselect` when something is removed). Opens and closes: `fsui-combobox` plus `fsui-combobox-open` or `fsui-combobox-close`. A deferred results render carries no `fsui-*` type, so give the Popup\'s `transition` a map with `default: "none"`.'
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "The selected value and the open state are optimistic (`data-selected` on the Input and the Option). `data-pending` is on the Input while a selection or an open is in flight, on the Trigger while an open or close is, and on the Option being chosen. With `multiple` the chips render from the optimistic value: a removed chip disappears at once and returns if its save fails, an added chip has `data-pending` until it is committed. The typed text is urgent, not optimistic (a [fact](/concepts/action-props#fact), reported to `onInputValueChange`)."
        }
      >
        <h4 id="slow-open-change-action">
          A slow <code>openChangeAction</code>
        </h4>
        <p>
          Here every <code>openChangeAction</code> call takes 2 seconds, like a server call, and{" "}
          <code>onOpenChange</code> logs the dismissals. The Input's <code>aria-expanded</code>, and
          the state the browser exposes on the Trigger, follow the shown listbox:
        </p>
        <Example file="ComboboxSlowOpen.tsx" css="combobox.css">
          <ComboboxSlowOpen />
        </Example>
        <ul>
          <li>
            Open (type, ArrowDown or the Trigger): the Input and the Trigger get{" "}
            <code>data-open</code> and <code>data-pending</code> at once and stay collapsed; the
            listbox is shown and both are expanded when the action settles.
          </li>
          <li>
            Accept an option, or press the Trigger again: the listbox stays shown and both stay
            expanded until the close's action settles.
          </li>
          <li>
            Escape or a click outside: a fact. The listbox hides and both are collapsed at once;
            nothing is pending and the slow action is not called; <code>onOpenChange</code> is.
          </li>
        </ul>
        <p>
          The readout under the example is plain text, not a live region, so it does not interrupt a
          screen reader.
        </p>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "Results render from a deferred copy of the text (`useDeferredValue`), so an async search is `use(search(query))` inside a boundary in the List. The first load shows your fallback; after that every keystroke keeps the previous results on screen, marked `data-stale` and `aria-busy`, until the new ones are ready. Only the latest query is ever rendered. Option content must not suspend."
        }
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'The listbox is a popover: a dismissal (Escape, a click outside, another popover opening) is the browser\'s. Focus leaving the input is closed by the library at once, which it cannot hold either. Either way it is a fact: `onOpenChange(false)` with `reason: "dismiss"`, nothing pending.'
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'A plain text field: typing works and the form posts the default selection (and the raw text, if the Input has a `name`). The listbox never opens before hydration. Text typed then is kept and reported once, with `reason: "platform"`.'
        }
      />

      <h3 id="forms">Forms</h3>
      <ul>
        <li>
          <code>name</code> on the Root posts the value through a hidden input (<code>""</code> for{" "}
          <code>null</code>); a <code>name</code> on the Input posts the raw text as well.{" "}
          <code>required</code> on the Input is native.
        </li>
        <li>
          With <code>multiple</code>: one hidden input per value, so the form posts what same-named
          checkboxes would (<code>formData.getAll(name)</code>, nothing for an empty selection).{" "}
          <code>required</code> means at least one value (see{" "}
          <a href="#multiple">Multiple selection</a>). A form reset replaces the whole selection
          with the reset target, even while saves are still running. Inside a{" "}
          <code>Field.Root</code>, <code>validate</code> gets the first value; read the others from{" "}
          <code>formData.getAll(name)</code>.
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
          through <code>onInputValueChange</code> with <code>reason: "platform"</code>.
        </li>
      </ul>

      <h3 id="styling">Styling</h3>
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
        <code>fsui-combobox-close</code>. With <code>multiple</code>, a value dispatch adds{" "}
        <code>fsui-combobox-select</code> when it adds a value and{" "}
        <code>fsui-combobox-deselect</code> when it removes one. Chips have no{" "}
        <code>transition</code> prop: to animate them, wrap each in your own{" "}
        <code>{"<ViewTransition>"}</code> and key on these types.
      </p>
      <p>
        Keep the CSS exit above next to <code>transition</code>: it animates the dismissals (focus
        leaving, Escape, a click outside). The library turns the popup&apos;s CSS transitions off
        for the moment of its own show and hide while a view transition runs, so you need no extra
        rule (
        <a href="/concepts/transitions#css-exit">A popup with a CSS exit and a view transition</a>).
      </p>

      <h3 id="browser-notes">Browser notes</h3>
      <ul>
        <li>
          <strong>Right-to-left:</strong> the listbox lines up with the input's inline-start edge
          (the right edge in RTL) under a <code>dir="rtl"</code> page or container. The{" "}
          <code>self-*</code> <code>position-area</code> keywords follow the popup's own inherited
          direction, with no JavaScript; plain logical keywords would follow the root's only,
          because the listbox is in the top layer. Firefox misplaces a popover inside a direction
          island (<a href="https://github.com/uhyo/funstack-ui/issues/89">#89</a>; see{" "}
          <a href="/components/tooltip#browser-notes">Tooltip</a>). The Popup emits no{" "}
          <code>data-side</code>.
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
    </DocPage>
  );
}
