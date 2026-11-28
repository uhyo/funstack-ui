import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { MultiSelectForm } from "../examples/MultiSelectForm.js";
import { MultiSelectToppings } from "../examples/MultiSelectToppings.js";
import { functionProps, renderProp, stylingProps } from "./shared-props.js";

export function MultiSelectPage() {
  return (
    <DocPage
      title="MultiSelect"
      description="A select-only combobox with a multi-select listbox: a button that shows the selection, options that load on open inside Suspense, a pick that toggles with an optimistic selection and the option pending, the open state as actions and facts, forms and required."
    >
      <p className="page-intro">
        A button that shows what is selected and opens a listbox in which each pick toggles one
        option (the WAI-ARIA "select-only combobox" with a multi-select listbox). The platform has
        no styleable multi-select drop-down in any stable engine yet, so this is the library's own
        listbox on a <code>popover="auto"</code>, built on the machinery of{" "}
        <a href="/components/combobox#multiple">Combobox multiple</a> without the text input. Focus
        stays on the button; the active option moves with <code>aria-activedescendant</code>.
      </p>

      <Example file="MultiSelectToppings.tsx" css="multi-select.css">
        <MultiSelectToppings />
      </Example>

      <Callout title="Select or MultiSelect">
        <p>
          <a href="/components/select">Select</a> is the browser's own control, a real{" "}
          <code>{"<select>"}</code> that works without JavaScript. MultiSelect is the library's,
          because the browser has no multi-select drop-down yet. It needs JavaScript (nothing opens
          before hydration), and in exchange it can do what a native select cannot: a controlled
          open, options that load when it opens, a view transition on the popup.{" "}
          <code>{"<Select.Root multiple>"}</code> is a type error and warns in development. For a
          short list shown in the page, use <a href="/components/checkbox-group">CheckboxGroup</a>;
          to search and show removable chips, use{" "}
          <a href="/components/combobox#multiple">Combobox multiple</a>.
        </p>
      </Callout>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { MultiSelect } from "@funstack/ui/multi-select";

<MultiSelect.Root name="toppings" defaultValue={["ham"]} required valueChangeAction={saveToppings}>
  <MultiSelect.Label>Toppings</MultiSelect.Label>                 {/* label[for] */}
  <MultiSelect.Trigger className="select">                         {/* button[role=combobox] */}
    <MultiSelect.Value placeholder="Choose toppings">              {/* span */}
      {({ value }) => value.map((v) => toppingNames[v]).join(", ")}
    </MultiSelect.Value>
  </MultiSelect.Trigger>
  <MultiSelect.Popup className="listbox">                          {/* div[popover=auto] */}
    <MultiSelect.List>                                             {/* div[role=listbox][aria-multiselectable] */}
      <Suspense fallback={<MultiSelect.Status>Loading…</MultiSelect.Status>}>
        <ToppingOptions />                                         {/* MultiSelect.Option… */}
      </Suspense>
    </MultiSelect.List>
    <MultiSelect.Empty>No toppings today.</MultiSelect.Empty>
  </MultiSelect.Popup>
</MultiSelect.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>The Trigger is the combobox.</strong> A <code>{"<button>"}</code> with{" "}
          <code>role="combobox"</code>: the one Tab stop, named by the Label (its content is its{" "}
          <em>value</em>, so it needs a Label or an <code>aria-label</code>; development warns).
          Keep its content non-interactive: a button may not contain buttons, which is why there are
          no removable chips here.
        </li>
        <li>
          <strong>Value shows what you render.</strong> The library keeps no item list and the
          options are not rendered while the listbox is closed, so for a preselected value it does
          not know a name until the option was seen once (never in the server HTML). Pass function{" "}
          <code>children</code> with your own names, as above. While the selection is empty it shows{" "}
          <code>placeholder</code> when you give one, whatever <code>children</code> is (a function
          is not called), so the function needs no empty branch: <code>children</code> describes the
          selection, <code>placeholder</code> its absence. Without children it shows the labels it
          has seen joined with <code>", "</code> (the raw value for one it has not).
        </li>
        <li>
          <strong>Popup and List are separate</strong> because a listbox may contain only options
          and groups: <code>Empty</code> and a hint <code>Status</code> go in the Popup, outside the
          List. A <code>Status</code> inside the List (the Suspense fallback) marks it as loading:{" "}
          <code>aria-busy="true"</code>, <code>Empty</code> hidden, and the first active option set
          once the options arrive.
        </li>
        <li>
          <strong>No portal, no positioner.</strong> The Popup is shown with{" "}
          <code>{"showPopover({ source: trigger })"}</code>: the Trigger is its implicit anchor, and
          after hydration it is the popup's{" "}
          <a href="/concepts/browser-owned-state#popup-triggers">invoker</a> (every click
          cancelled), so pressing it while the listbox is open closes it as a request instead of a
          light dismiss.
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <h4>A pick toggles</h4>
      <p>
        Enter or Space on the active option, or a click, toggles it: <code>aria-selected</code>,{" "}
        <code>data-selected</code>, the hidden inputs and the Value change at once (optimistic), the
        option shows <code>data-pending</code> until its change commits, and the listbox{" "}
        <strong>stays open</strong> for the next pick. There is no no-op pick: a selected option is
        removed. A rejection rolls back that one change; the listbox, the active option and focus do
        not move.
      </p>
      <p>
        The value is a set in <strong>pick order</strong>, under the set rules of CheckboxGroup:
        each dispatch is one change, with <code>details.added</code> and{" "}
        <code>details.removed</code>; picks made while an earlier save runs stack, and only the
        changes whose action resolved are kept. Persist the diff, not <code>next</code>, which can
        contain a change that fails later. A controlled "update on success" parent applies the diff
        as a functional update:
      </p>
      <CodeBlock>{`<MultiSelect.Root value={toppings} valueChangeAction={async (_next, { added, removed }) => {
  await saveToppings({ added, removed });
  startTransition(() =>
    setToppings((prev) => [...prev.filter((t) => !removed.includes(t)), ...added.filter((t) => !prev.includes(t))]),
  );
}}>`}</CodeBlock>
      <p>
        The order is the order of the picks (and of <code>value</code> / <code>defaultValue</code>),
        which is also the order of <code>formData.getAll(name)</code>. A native{" "}
        <code>{"<select multiple>"}</code> posts in list order instead; to show the list order, sort
        in Value's function, where you have your list.
      </p>

      <h4>Opening and closing</h4>
      <p>
        Opening is a request: <code>openChangeAction(true)</code>, awaited, with the Trigger{" "}
        <code>data-pending</code> while it runs. A click on the Trigger while open, and Alt+ArrowUp,
        close the same way. Escape, a click outside, focus leaving the Trigger and another popover
        opening are facts, reported to <code>onOpenChange(false)</code> with{" "}
        <code>reason: "dismiss"</code>. A pick never closes the listbox.
      </p>

      <h4 id="prior-art">Prior art</h4>
      <p>
        Headless UI makes the same split: its <code>Select</code> is a thin wrapper around the
        native element, and the custom one that takes <code>multiple</code> is <code>Listbox</code>,
        which stays open while you pick. Mantine, PrimeReact and Carbon name the component{" "}
        <code>MultiSelect</code> (Mantine's is searchable with pills, PrimeReact's shows a
        comma-separated list by default, Carbon's shows a count tag). Radix has no multi-select.
        Chips with remove buttons and a search field are{" "}
        <a href="/components/combobox#multiple">Combobox multiple</a> here.
      </p>

      <h3 id="props">Props</h3>
      <h4>
        <code>MultiSelect.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "readonly string[]",
            description:
              "Controlled selection. `[]`: nothing selected. `undefined` means uncontrolled. Duplicates are ignored.",
          },
          {
            name: "defaultValue",
            type: "readonly string[]",
            default: "[]",
            description:
              "Initial selection when uncontrolled; what a form reset returns to (the latest value).",
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<string[], MultiSelectValueChangeDetails>",
            description:
              "Runs in the Root's transition for every change of the selection (a pick, a form reset). `next` is the whole intended selection; `details.added` / `details.removed` say what this dispatch changed. Awaited; a rejection undoes that change only. May be a Server Function. A `setState` after your own `await` needs `startTransition`.",
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
            type: "ChangeAction<boolean, MultiSelectOpenChangeDetails>",
            description:
              'Requests only: awaited for opens and for the closes a part asks for (the Trigger, Alt+ArrowUp). Never called for a dismissal. `details.reason`: `"activate"` (the Trigger, the opening keys, Alt+ArrowUp, a foreign `showPopover()`) or `"platform"` (found open on mount).',
          },
          {
            name: "onOpenChange",
            type: "UrgentChangeHandler<boolean, MultiSelectOpenChangeDetails>",
            description:
              'Facts only: the listbox was closed without the library closing it on request. Always `false`. `details.reason`: `"dismiss"` (Escape, a click outside, focus leaving the Trigger, another popover opening, script) or `"activate"` (a [foreign invoker](/concepts/browser-owned-state#foreign-invoker): a `popovertarget` / `commandfor` button of yours that toggles the listbox). Called synchronously, outside any transition, and not awaited. In controlled mode set state directly here (`onOpenChange={setOpen}`). May return a promise; a rejection or a throw goes to `reportError`.',
          },
          {
            name: "loop",
            type: "boolean",
            default: "false",
            description: "ArrowDown / ArrowUp wrap from the last option to the first and back.",
          },
          {
            name: "name",
            type: "string",
            description:
              'One `<input type="hidden" name>` per value, in value order (`formData.getAll(name)`); nothing posted for an empty selection.',
          },
          {
            name: "form",
            type: "string",
            description: "The `form` attribute of the hidden inputs and of the validity element.",
          },
          {
            name: "required",
            type: "boolean",
            default: "false",
            description:
              "At least one value: a hidden validity element blocks the submit while the optimistic selection is empty, and the Trigger has `aria-required`. The browser shows no bubble: show the message with `Field.Error` ([Forms](#forms)).",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "Disables the Trigger natively; nothing opens or dispatches. A disabled MultiSelect (this prop or the Field's) is not submitted: every hidden input is `disabled` too, as a disabled native `<select>` posts nothing. A form reset still reaches it.",
          },
          {
            name: "readOnly",
            type: "boolean",
            default: "false",
            description:
              'The selection is shown, focusable and submitted, and cannot be changed, or the enclosing `Field.Root`\'s: the Trigger stays an enabled button with `aria-readonly="true"` and `data-readonly`, the popup never opens (a press, Enter, Space, the arrows and typeahead request nothing; `aria-expanded` stays `"false"`), and nothing dispatches. The hidden inputs are not disabled, and the validity element\'s `required` is not rendered: a read-only MultiSelect never blocks a submission. When it turns on, an open listbox gets a close request (a controlled `open` parent decides); Escape and Alt+ArrowUp still close a listbox a parent keeps open.',
          },
          {
            name: "children",
            type: "ReactNode | ((state: MultiSelectRootState) => ReactNode)",
            description: "The parts, or a function of the Root's state.",
          },
        ]}
      />
      <PartFacts
        state={
          "`MultiSelectRootState` is `{ value, activeValue, open, pending, disabled, readOnly, required }`; `value` (pick order) and `open` are optimistic; `pending` covers the value and the open transitions; `required` is the prop or the Field's."
        }
        owned={
          "none: the Root renders no element (no `ref`, `className` or `style`), only the hidden inputs when `name` is given."
        }
      />
      <p>
        <code>MultiSelectValueChangeDetails</code>:{" "}
        <code>{"{ reason, added, removed, valid, event }"}</code>. <code>valid</code>: the selection
        would be valid (<code>required</code>: not empty, and the Field's <code>validate</code> for
        the next set; see <a href="/components/field#details-valid">details.valid</a>).{" "}
        <code>reason</code> is <code>"activate"</code> for a pick (<code>event</code> is the{" "}
        <code>keydown</code> or <code>click</code>) and <code>"platform"</code> for a form reset (
        the <code>reset</code> event; it can add and remove at once). <code>added</code> is in the
        order the values join, <code>removed</code> in value order.
      </p>

      <h4>
        <code>MultiSelect.Label</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps("MultiSelectLabelState"),
          renderProp("label", "MultiSelectLabelState"),
        ]}
      />
      <PartFacts
        state={
          "`MultiSelectLabelState` is `{ disabled, readOnly, pending }`, the Root's; the Label renders them as `data-disabled`, `data-readonly` and `data-pending`."
        }
        owned={"`id`, `htmlFor`, `onClick`."}
        note={
          "A `<label for>` of the Trigger whose click focuses the Trigger without opening the listbox, as a label on a `<select>` does. Its id also names the List, only while a Label is mounted. Inside a `Field.Root`, `Field.Label` takes its role and does the same."
        }
      />

      <h4>
        <code>MultiSelect.Trigger</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Native `disabled`; the Root's `disabled` applies too.",
          },
          ...functionProps(
            "MultiSelectTriggerState",
            "Non-interactive content, usually a `MultiSelect.Value` and a decorative `aria-hidden` icon. Rendered from optimistic state; must not suspend.",
          ),
          renderProp("button", "MultiSelectTriggerState"),
        ]}
      />
      <PartFacts
        state={
          "`MultiSelectTriggerState` is `{ value, open, pending, disabled, readOnly, invalid, required }`; `value` and `open` are optimistic, `pending` is the Root's; `invalid` is `true` while the enclosing `Field.Root` shows an error (`data-invalid`), `false` outside a Field; `required` is the Root's or the Field's (`data-required`: a button has no `:required`)."
        }
        owned={
          '`id`, `type` (`"button"`), `role` (`"combobox"`), `disabled`, `aria-expanded` (the shown listbox), `aria-controls` (token-merged), `aria-activedescendant`, `aria-required`, `aria-readonly` (while read-only), `popovertarget` (written as an attribute after hydration), `form` (from the Root), `onClick`, `onKeyDown`, `onFocus`, `onBlur`, `data-open`, `data-pending`, `data-disabled`, `data-readonly`, `data-required`; inside a `Field.Root` also `aria-invalid`, `aria-describedby` (token-merged) and `data-invalid`. Owned and never written: `popoverTarget`, `popoverTargetAction`, `commandfor`, `command`.'
        }
        note={
          "With `required` it renders the validity element right after itself: a visually hidden one-option `<select>` with no name. A `render` element must stay a `<button>` (development warns). `ref` goes to the button."
        }
      />

      <h4>
        <code>MultiSelect.Value</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "placeholder",
            type: "ReactNode",
            description:
              "Shown while the selection is empty, instead of `children` (a function `children` is not called then). `null` counts as not given; without it, `children` renders the empty selection too.",
          },
          ...stylingProps("MultiSelectValueState"),
          {
            name: "children",
            type: "ReactNode | ((state: MultiSelectValueState) => ReactNode)",
            default: 'the labels joined with ", "',
            description:
              "The summary, usually a function of `{ value }` with your own names. Not used while the selection is empty and `placeholder` is given. `labels[i]` is the text of the option for `value[i]` as the library last saw it, `undefined` if it never saw one. Must not suspend.",
          },
          renderProp("span", "MultiSelectValueState"),
        ]}
      />
      <PartFacts
        state={
          "`MultiSelectValueState` is `{ value, labels, empty, disabled, readOnly }`; `value` is optimistic; `empty` is `value.length === 0`."
        }
        owned={
          "`data-empty` (while the selection is empty, the library's one word for it: there is no `data-placeholder`), `data-disabled`, `data-readonly`."
        }
        note={
          "Optional: any Trigger content rendered from the Trigger's state works. A function cannot come from a Server Component; render the Trigger's content from a client component, or use the default content."
        }
      />

      <h4>
        <code>MultiSelect.Popup</code>
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
              "The `<ViewTransition default>` around the popover element: animates the library's opens and closes. Keep it static.",
          },
          ...functionProps("MultiSelectPopupState"),
          renderProp("div", "MultiSelectPopupState"),
        ]}
      />
      <PartFacts
        state={"`MultiSelectPopupState` is `{ open }` (committed)."}
        owned={
          '`id`, `popover` (`"auto"`), `onPointerDown` and `onMouseDown` (a press anywhere in it keeps focus on the Trigger); no role.'
        }
        note={
          "Inline style `position-area: self-block-end span-self-inline-end; position-try-fallbacks: flip-block; min-width: anchor-size(width)` places it below the Trigger (above when it does not fit), at least as wide; your `style` wins per property. A `render` element must stay a `<div>`."
        }
      />

      <h4>
        <code>MultiSelect.List</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps(
            "MultiSelectListState",
            "The Options and Groups, under your own `<Suspense>` for options that load on open.",
          ),
          renderProp("div", "MultiSelectListState"),
        ]}
      />
      <PartFacts
        state={"`MultiSelectListState` is `{ empty }`."}
        owned={
          '`id`, `role` (`"listbox"`), `aria-multiselectable` (`"true"`), `aria-labelledby` (token-merged; the Label, else the enclosing `Field.Label`), `aria-busy` (while a `Status` is mounted inside it), `data-empty`.'
        }
        note={"Without a Label give the List an `aria-label` (development warns otherwise)."}
      />

      <h4>
        <code>MultiSelect.Option</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description:
              "Required and unique within the MultiSelect; the option's id is derived from it.",
          },
          {
            name: "label",
            type: "string",
            description:
              "The text for typeahead and for Value's labels. Default: the option's trimmed text at that moment. Renders nothing.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "`aria-disabled`: shown, skipped by the keys and typeahead, never toggled.",
          },
          ...functionProps(
            "MultiSelectOptionState",
            "Content, or a function of the option's state; must not suspend.",
          ),
          renderProp("div", "MultiSelectOptionState"),
        ]}
      />
      <PartFacts
        state={
          "`MultiSelectOptionState` is `{ value, selected, active, pending, disabled }`; `selected` is optimistic, `active` is virtual focus, `pending` is true while this option is being added or removed."
        }
        owned={
          "`id` (derived from `value`), `role`, `aria-selected` (on every option), `aria-disabled`, `onClick`, `onPointerDown`, `onMouseDown`, `onPointerMove`, `data-selected`, `data-active`, `data-pending`, `data-disabled`."
        }
        note={"Never focused, no `tabindex`; hovering makes it active."}
      />

      <h4>
        <code>MultiSelect.Group</code>, <code>MultiSelect.GroupLabel</code>,{" "}
        <code>MultiSelect.Empty</code>, <code>MultiSelect.Status</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps(
            "{} (Empty: MultiSelectListState)",
            "Content. Empty renders only when the List has no options and none are loading.",
          ),
          {
            name: "render",
            type: "ReactElement | ((props, state) => ReactNode)",
            description:
              "Replace the default <div> (element form) or take over rendering (function form).",
          },
        ]}
      />
      <PartFacts
        state={"none (Empty: `MultiSelectListState`)."}
        owned={
          'Group: `role` (`"group"`), `aria-labelledby`; GroupLabel: `id`; Status: `role` (`"none"` inside the List, `"status"` in the Popup).'
        }
        note={
          "`Group` is named by the `GroupLabel` inside it. `Status` inside the List (as a Suspense fallback) marks the List as loading; in the Popup it is a plain hint."
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          [
            "`data-open`",
            "Trigger",
            "Optimistic open state. `aria-expanded` follows the shown listbox instead.",
          ],
          [
            "`data-pending`",
            "Trigger",
            "A value or an open transition is in flight (the Root's `pending`).",
          ],
          ["`data-pending`", "Option", "This option is being added or removed."],
          ["`data-selected`", "Option", "In the optimistic selection."],
          ["`data-active`", "Option", "`aria-activedescendant` points here (keyboard or hover)."],
          ["`data-empty`", "Value", "Nothing is selected (`:not([data-empty])`: something is)."],
          ["`data-empty`", "List", "No options and not loading."],
          ["`data-disabled`", "Label, Trigger, Value, Option", "Disabled."],
          ["`data-readonly`", "Label, Trigger, Value", "The Root's `readOnly` (or the Field's)."],
          ["`data-pending`", "Label", "The Root's `pending`."],
          ["`data-required`", "Trigger", "`required` (the Root's or the Field's)."],
          ["`data-invalid`", "Trigger", "Inside a `Field.Root`, while its error is shown."],
          ["`:popover-open`", "Popup", "The listbox is shown (browser-owned, no attribute)."],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Where", "Behaviour"]}
        rows={[
          [
            "Enter / Space / ArrowDown / Alt+ArrowDown",
            "listbox closed",
            "Opens with the first selected option active, else the first enabled one.",
          ],
          [
            "ArrowUp",
            "listbox closed",
            "Opens with the first selected option active, else the last one.",
          ],
          ["Home / End", "listbox closed", "Opens with the first / last enabled option active."],
          [
            "A printable character",
            "listbox closed",
            "Opens with the first option starting with it active.",
          ],
          [
            "ArrowDown / ArrowUp",
            "listbox open",
            "Next / previous enabled option; stops at the ends (wraps with `loop`).",
          ],
          ["Home / End", "listbox open", "First / last enabled option."],
          ["PageDown / PageUp", "listbox open", "Ten options forward / back."],
          ["Enter / Space", "listbox open", "Toggles the active option; the listbox stays open."],
          [
            "A printable character",
            "listbox open",
            "Typeahead: the active option moves to the next option starting with the typed text (500 ms buffer; a repeated letter cycles). A Space while you are typing is part of the text.",
          ],
          ["Alt+ArrowUp", "listbox open", "Closes; nothing is toggled."],
          [
            "Escape",
            "listbox open",
            "The platform closes the listbox; focus stays. A second Escape reaches an enclosing Dialog or Popover.",
          ],
          [
            "Tab / Shift+Tab",
            "listbox open",
            "Focus moves on and the listbox closes. Tab never toggles the active option.",
          ],
          [
            "Every key but Tab, Escape and Alt+ArrowUp",
            "read-only",
            "Nothing: the listbox does not open. Escape and Alt+ArrowUp close one a controlled parent keeps open.",
          ],
        ]}
      />
      <p>
        Disabled options are skipped. Ctrl and Meta combinations are left alone. Shift+arrow range
        selection and Ctrl+A (the optional multi-select keys of the APG listbox) are not in v1.
      </p>
      <ul>
        <li>
          The Trigger is <code>role="combobox"</code> with <code>aria-expanded</code>,{" "}
          <code>aria-controls</code> (the List), <code>aria-activedescendant</code> and, with{" "}
          <code>required</code>, <code>aria-required</code>. Its text content is the combobox's
          value for assistive technology; give decorative icons <code>aria-hidden</code>.
        </li>
        <li>
          The List is <code>aria-multiselectable</code>, every option carries{" "}
          <code>aria-selected</code>; a toggle is heard through that state under{" "}
          <code>aria-activedescendant</code>, so nothing extra is announced.
        </li>
        <li>
          The Trigger is the popup's invoker after hydration and still renders{" "}
          <code>aria-expanded</code> from the shown listbox: the <code>combobox</code> role requires
          the state, and before hydration the button is not an invoker yet.
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "Every value dispatch: `fsui-multi-select`, plus `fsui-multi-select-select` when something is added and `fsui-multi-select-deselect` when something is removed (a reset can carry both). Opens and closes: `fsui-multi-select` plus `fsui-multi-select-open` or `fsui-multi-select-close`."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "The selection and the open state are optimistic: an option's `aria-selected` and `data-selected`, the Value and the hidden inputs change at once, and come back if the save fails. `data-pending` is on the Trigger while a value or an open transition is in flight, and on each option whose change is not committed yet (one being added and one being removed)."
        }
      />

      <BehaviourSection
        id="suspense"
        summary={
          "Put the boundary inside the List and the popup opens at once with your `MultiSelect.Status` fallback (the List is `aria-busy`); the first selected option becomes active when the options arrive. With the boundary outside the Popup, React holds the open instead and the Trigger shows `data-pending`. Option and Value content must not suspend."
        }
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'The listbox is a popover: Escape, a click outside and another popover opening are the browser\'s. Focus leaving the Trigger is closed by the library at once, which it cannot hold either. Either way it is a fact: `onOpenChange(false)` with `reason: "dismiss"`, nothing pending. A form reset is reported as a `"platform"` value change.'
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          "The server HTML has the hidden inputs of the default selection, the Trigger with its Value content and the empty popover. Before hydration nothing opens; a form submitted then posts the default selection, and `required` is already enforced by the server-rendered validity element."
        }
      />

      <h3 id="forms">Forms</h3>
      <Example file="MultiSelectForm.tsx" css="multi-select.css">
        <MultiSelectForm />
      </Example>
      <ul>
        <li>
          <code>name</code> on the Root posts one entry per value, in pick order (
          <code>formData.getAll(name)</code>), nothing for an empty selection.
        </li>
        <li>
          <code>required</code> means at least one value. Neither a button nor a hidden input can
          take part in constraint validation, so the Trigger renders a hidden one-option{" "}
          <code>{"<select>"}</code> after itself that is <code>required</code> exactly while the
          optimistic selection is empty (removing the last value marks it at once, a rollback
          un-marks it). A submit with nothing selected is blocked and focus moves to the Trigger.
        </li>
        <li>
          <strong>
            The message is <code>Field.Error</code>'s.
          </strong>{" "}
          The browser's bubble is turned off: it would point at the hidden element, and in Firefox
          it stays over the place where the listbox opens and takes the clicks meant for the first
          options. Wrap the MultiSelect in a <a href="/components/field">Field.Root</a> with a{" "}
          <code>Field.Error</code>, as above; <code>Field.Label</code> then names it and focuses it
          without opening the listbox. Outside a Field a blocked submit only moves focus.
        </li>
        <li>
          A form reset (the Reset button, <code>form.reset()</code>, React's reset after a form
          action) dispatches the reset target whole with <code>reason: "platform"</code>:
          uncontrolled, the latest <code>defaultValue</code>; controlled, the mount-time{" "}
          <code>value</code>. It works without <code>name</code> as well.
        </li>
        <li>
          Inside a <code>Field.Root</code>, <code>validate</code> gets the first value; read the
          others from <code>formData.getAll(name)</code>. <code>name</code>, <code>disabled</code>{" "}
          and <code>required</code> default from the Field.
        </li>
        <li>
          A disabled MultiSelect (its <code>disabled</code> or the Field's) is not submitted, as a
          disabled native select posts nothing: the hidden inputs are <code>disabled</code> too.
        </li>
      </ul>

      <h3 id="styling">Styling</h3>
      <CodeBlock language="css">{`.select[data-open] { outline: 2px solid Highlight; }
.select[data-pending] { cursor: progress; }
.select [data-empty] { color: GrayText; }                 /* MultiSelect.Value: nothing chosen */
.select[data-invalid] { border-color: var(--danger); }   /* inside a Field */

.listbox { margin: 0; inset: auto; max-block-size: 20rem; overflow: auto; }
.listbox [role="option"][data-active] { background: var(--accent-weak); }
.listbox [role="option"][data-selected]::before { content: "✓"; }
.listbox [role="option"][data-pending] { cursor: progress; }
.listbox [role="option"][aria-disabled="true"] { color: GrayText; }

/* Enter / exit for dismissals too (Escape, a click outside). */
.listbox { opacity: 0; transition: opacity 120ms, display 120ms allow-discrete, overlay 120ms allow-discrete; }
.listbox:popover-open { opacity: 1; }
@starting-style { .listbox:popover-open { opacity: 0; } }`}</CodeBlock>
      <p>
        <code>transition</code> on the Popup animates the library's own opens and closes with a view
        transition; dismissals are the CSS above. The library turns the popup's CSS transitions off
        for the moment of its own show and hide while a view transition runs (
        <a href="/concepts/transitions#css-exit">A popup with a CSS exit and a view transition</a>).
      </p>

      <h3 id="browser-notes">Browser notes</h3>
      <ul>
        <li>
          Inside a Dialog or a Popover the listbox nests in the top layer: the first Escape closes
          the listbox, the next the outer overlay. Inside a <code>Menu.Popup</code> it is not
          supported.
        </li>
        <li>
          Safari: a WebKit bug (302008) can hang a page that opens a popover with position fallbacks
          inside another popover. Inside a Popover or Dialog in Safari, turn the flip off:{" "}
          <code>{'style={{ positionTryFallbacks: "none" }}'}</code> on{" "}
          <code>MultiSelect.Popup</code>.
        </li>
        <li>
          WebKit does not focus a button on a mouse press; the Trigger focuses itself on click, so
          the keys work after a click in every engine.
        </li>
      </ul>
    </DocPage>
  );
}
