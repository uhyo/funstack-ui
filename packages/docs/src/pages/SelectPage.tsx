import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { SelectCountry } from "../examples/SelectCountry.js";
import { SelectForm } from "../examples/SelectForm.js";
import { SelectFruit } from "../examples/SelectFruit.js";
import { functionProps, renderProp, stylingProps } from "./shared-props.js";

export function SelectPage() {
  return (
    <DocPage
      title="Select"
      description="A real <select>, progressively enhanced with customizable select (appearance: base-select): native forms, keyboard and pickers, an async valueChangeAction, optimistic selection and data-pending."
    >
      <p className="page-intro">
        A real <code>&lt;select&gt;</code>. The platform gives it form participation,{" "}
        <code>required</code>, autofill, typeahead, option groups, the native combobox semantics,
        mobile pickers, and interaction before hydration. Opt into a styled picker with one CSS
        declaration, <code>appearance: base-select</code>; the library ships the markup for it and
        no JavaScript for the picker. What the library adds is the same as for RadioGroup: the
        selection changes through <code>valueChangeAction</code> in a transition, with optimistic
        feedback and <code>data-pending</code>, plus fixes for three things React gets wrong with a{" "}
        <code>&lt;select&gt;</code>.
      </p>

      <Example file="SelectFruit.tsx" css="select.css">
        <SelectFruit />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Select } from "@funstack/ui/select";

<Select.Root name="fruit" defaultValue="" required valueChangeAction={saveFruit}> {/* select */}
  <Select.Trigger>                                  {/* button: optional, first child */}
    <Select.Value />                                {/* selectedcontent: the browser fills it */}
  </Select.Trigger>
  <Select.Option value="">Choose a fruit</Select.Option>     {/* option: the placeholder */}
  <Select.Group label="Citrus">                     {/* optgroup */}
    <Select.GroupLabel>Citrus <em>fruits</em></Select.GroupLabel>  {/* legend: optional */}
    <Select.Option value="orange"><Icon aria-hidden /> Orange</Select.Option>
  </Select.Group>
  <Select.Separator />                              {/* hr */}
  <Select.Option value="banana">Banana</Select.Option>
</Select.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>
            Root is the <code>&lt;select&gt;</code> itself
          </strong>
          : value, form, validation, picker, keyboard and accessibility mapping all live on that
          element. A <code>render</code> element must stay a <code>&lt;select&gt;</code>. There is
          no open state: the picker is the browser's <code>::picker(select)</code>, opened and
          closed with no events. Style it with <code>:open</code>.
        </li>
        <li>
          <strong>Trigger and Value are optional.</strong> Without them, browsers with customizable
          select draw their own button with the selected option's text. Add them for rich button
          content: <code>Select.Value</code> is a <code>&lt;selectedcontent&gt;</code> into which
          the browser copies the selected option's content. It has no <code>children</code>. The
          Trigger must be the select's first child.
        </li>
        <li>
          <strong>Option content must read as plain text.</strong> Firefox (default settings) shows
          the native select, which displays only the text. Give icons <code>aria-hidden</code> and
          no text (an SVG, or <code>alt=""</code>), and avoid the <code>label</code> attribute:
          Chromium names the option from it but shows the content.
        </li>
        <li>
          <strong>
            Group needs <code>label</code>
          </strong>
          : native pickers and assistive technology read the attribute. <code>GroupLabel</code> (a{" "}
          <code>&lt;legend&gt;</code>, first child of its Group) is the rich label drawn by
          customizable select; keep its text equal to <code>label</code>.
        </li>
        <li>
          No Popup, Positioner, Icon or Indicator parts: the picker, the arrow (
          <code>::picker-icon</code>) and the check mark (<code>::checkmark</code>) are
          pseudo-elements.
        </li>
      </ul>

      <h3 id="props">Props</h3>
      <h4>
        <code>Select.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description:
              'Controlled value. undefined means uncontrolled. `""` selects the placeholder option.',
          },
          {
            name: "defaultValue",
            type: "string",
            default: "the browser's choice",
            description:
              'Initial value in uncontrolled mode, and what a form reset returns to (the latest value is mirrored into the options\' `defaultSelected`). Without it (and without `value`) the Select follows the browser: an option with `value=""`, else the first enabled option, is adopted at mount without calling the action, and a reset returns to that adopted option (a disabled `""` placeholder included). Until a pick sets the value, options that load later behind a fallback are adopted again; after one, the pick is kept.',
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<string, SelectValueChangeDetails>",
            description: (
              <>
                Runs in the Root's transition whenever the selected option changes; sync, async or a
                Server Function. Rejections reach the nearest Error Boundary and roll the selection
                back. In engines whose closed select changes the value on every arrow press
                (Firefox, Safari's native select) every press dispatches; the latest wins.
              </>
            ),
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "Native `disabled`. Never set by the library while pending (a disabled select would also drop out of the form data).",
          },
          {
            name: "name, required, form, autoComplete",
            type: "native",
            description:
              'Plain `<select>` props. With `required`, the placeholder (`value=""`) fails validation.',
          },
          ...functionProps(
            "SelectRootState",
            "The options and the Trigger. The function form receives the optimistic value; must not suspend.",
          ),
          renderProp("select", "SelectRootState"),
        ]}
      />
      <PartFacts
        state={"`SelectRootState` is `{ value, pending, disabled }`; `value` is optimistic."}
        owned={
          "`value`, `disabled`, `onChange`, `data-pending`, `data-disabled`. Inside a `Field.Root` also `id`, `name`, `required`, `aria-invalid`, `aria-describedby` and `data-invalid`."
        }
        note={
          "`multiple` and `size` are not accepted: multi-select is not part of this version. `id`, `aria-*`, `onFocus` and other select props pass through."
        }
      />
      <p>
        <code>SelectValueChangeDetails</code>: <code>{"{ reason, event }"}</code>.{" "}
        <code>reason</code> is <code>"activate"</code> for a pick (pointer, keyboard, typeahead or
        autofill; <code>event</code> is the native <code>change</code>) and <code>"platform"</code>{" "}
        for a form reset (<code>event</code> is the <code>reset</code> event) or a pick made before
        hydration (no event).
      </p>

      <h4>
        <code>Select.Trigger</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps(
            "SelectRootState",
            "Non-interactive content, usually `<Select.Value />`; a function of the Root's state for a pending indicator.",
          ),
          renderProp("button", "SelectRootState"),
        ]}
      />
      <PartFacts
        state={"`SelectRootState`."}
        owned={'`type` (always `"button"`), `data-pending`, `data-disabled`.'}
        note={
          "Must be the select's first child. Engines without customizable select do not render it, so a spinner inside it also needs a `select[data-pending]` style."
        }
      />

      <h4>
        <code>Select.Value</code>
      </h4>
      <PropsTable
        rows={[
          ...stylingProps("SelectRootState"),
          renderProp("selectedcontent", "SelectRootState"),
        ]}
      />
      <PartFacts
        state={"`SelectRootState`."}
        owned={
          "`children` (none: the browser fills the element), and the hydration-related props of that content."
        }
        note={
          "The browser copies the selected option's content in on every selection change, and the parser does so before hydration (the element is rendered so that hydration accepts that content). The library keeps the copy fresh: when the selected option's content changes through React (a translated label, a count, the option's own function children, a Suspense boundary resolving inside it) or a form reset changes the selection, it asks the browser to copy again. The copy is a snapshot: style it as `selectedcontent .icon`, not `option:checked .icon`."
        }
      />

      <h4>
        <code>Select.Option</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description:
              "Required (React cannot infer a value from rich content). Submitted as the form value.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Native `disabled`: not pickable, skipped by keyboard navigation.",
          },
          ...functionProps("SelectOptionState", "Content, or a function of the option's state."),
          renderProp("option", "SelectOptionState"),
        ]}
      />
      <PartFacts
        state={
          "`SelectOptionState` is `{ value, selected, pending, disabled }`; `selected` is optimistic, `pending` is true on the option the user is waiting on, `disabled` includes a disabled `Select.Group` and `Root disabled`."
        }
        owned={
          "`value`, `selected` (never rendered), `disabled`, `data-selected`, `data-pending`, `data-disabled`."
        }
      />

      <h4>
        <code>Select.Group</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "label",
            type: "string",
            description:
              "Required. The `<optgroup label>`, shown by native pickers and read by assistive technology.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Native: disables every option in the group.",
          },
          ...functionProps("SelectRootState", "The GroupLabel and the group's Options."),
          {
            name: "render",
            type: "ReactElement | ((props, state: SelectRootState) => ReactNode)",
            description: "Replace the default <optgroup>; it must stay an <optgroup>.",
          },
        ]}
      />
      <PartFacts state={"`SelectRootState`."} owned={"`label`."} />

      <h4>
        <code>Select.GroupLabel</code>, <code>Select.Separator</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps(
            "SelectRootState",
            "GroupLabel: the rich label. Separator takes no children.",
          ),
          {
            name: "render",
            type: "ReactElement | ((props, state: SelectRootState) => ReactNode)",
            description: "Replace the default <legend> (GroupLabel) or <hr> (Separator).",
          },
        ]}
      />
      <PartFacts state={"`SelectRootState`."} owned={"none."} />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "On", "Pseudo-class", "Meaning"]}
        rows={[
          ["`data-pending`", "Root, Trigger", "–", "`valueChangeAction` is in flight."],
          ["`data-pending`", "Option", "–", "The option the in-flight dispatch is selecting."],
          [
            "`data-selected`",
            "Option",
            "`:checked`",
            "Optimistic selection. Identical, because the select renders the optimistic value.",
          ],
          [
            "`data-disabled`",
            "Root, Trigger, Option",
            "`:disabled`",
            "Disabled by prop; on an Option, by its own prop, a disabled Group or `Root disabled`.",
          ],
          [
            "–",
            "Root",
            "`:open`, `:focus-within`",
            "The picker is open. Browser-owned, no attribute. In Chromium focus moves to the option while open, so `select:focus-within` is the robust focus selector.",
          ],
          ["–", "Root", "`:required`, `:user-invalid`, `:valid`", "Platform only."],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <p>
        Everything is the browser's; the library installs no key handler. The engines differ, and
        the Select's contract does not depend on them: one <code>valueChangeAction</code> per
        committed change, with the optimistic value in the DOM.
      </p>
      <Table
        head={["Key", "Chromium (customizable select)", "Firefox, Safari (native)", "Dispatches"]}
        rows={[
          [
            "Tab / Shift+Tab",
            "Focuses the select; while open, closes without committing and focus returns to the select.",
            "Focuses the select.",
            "no",
          ],
          [
            "Enter, Space, ArrowDown (closed)",
            "Opens the picker; focus moves to the selected option.",
            "Space / Alt+Down open the native popup; arrows change the value at once.",
            "Chromium: no. Native: once per arrow press",
          ],
          [
            "Arrows, Home, End (open)",
            "Move focus between enabled options.",
            "Inside the native popup.",
            "no",
          ],
          ["Enter, Space, click (open)", "Commits the focused option and closes.", "Pick.", "once"],
          ["Escape (open)", "Closes without committing.", "Closes the native popup.", "no"],
          [
            "Typeahead",
            "Closed: selects the match at once. Open: moves focus to it.",
            "Selects the match.",
            "once per match while closed",
          ],
        ]}
      />
      <ul>
        <li>
          The select is exposed as a <code>combobox</code> with a popup; options are named from
          their content (<code>aria-hidden</code> icons excluded), groups are <code>group</code>{" "}
          and, in Chromium's customizable select, the separator is a <code>separator</code>. Name
          the select with a <code>&lt;label for&gt;</code> or <code>aria-label</code>.
        </li>
        <li>
          The library never moves focus, not even on rollback. A rollback is silent; add an{" "}
          <code>aria-live</code> region if a slow action may fail.
        </li>
        <li>
          In Firefox and Safari's native select every arrow press is a committed change. For a
          preference that needs no wait, do not return the promise (
          <code>{"(next) => { void save(next); }"}</code>), or leave the value to the form submit.
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "`fsui-select`. No part takes a `transition` prop: the picker and the button's copy are drawn by the browser."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "The `<select>` renders the optimistic value (a correctness requirement), so `option:checked` and `data-selected` agree. `data-pending` is on the Root and Trigger while `valueChangeAction` is in flight, and on the Option being selected."
        }
      >
        <h4>Walkthrough</h4>
        <ol>
          <li>
            Pick Banana: the browser selects it, copies it into the button and fires{" "}
            <code>change</code>. The Root dispatches{" "}
            <code>valueChangeAction("banana", {'{ reason: "activate" }'})</code> in its transition.
            The Root, the Trigger and the Banana option get <code>data-pending</code>.
          </li>
          <li>Resolve: the value is committed (uncontrolled) and the attributes go.</li>
          <li>
            Reject: the optimistic value reverts, React selects the old option again (the button
            follows), and the error reaches the nearest Error Boundary.
          </li>
          <li>
            A controlled parent vetoes by not adopting the value: the button shows Banana for the
            action's duration, then the old option again.
          </li>
        </ol>
        <p>
          The select shows the optimistic value because react-dom restores a controlled select's
          options after every event (
          <a href="/concepts/browser-owned-state#native-inputs">Native inputs</a>); a select driven
          by committed state would snap back, button included, for the whole pending time.
        </p>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "Options revealed later by a Suspense boundary or `use()` inside the Select get the value re-applied when they arrive, without a dispatch. There is no load-on-open."
        }
      >
        <h4 id="options-that-load-later">Options that load later</h4>
        <Example file="SelectCountry.tsx" css="select.css">
          <SelectCountry />
        </Example>
        <p>
          React selects options only in the select's own commit, so options revealed later by a
          Suspense boundary or <code>use()</code> inside the select would leave the browser's first
          option selected. The library re-applies the value when they arrive, without a dispatch.
          Until then nothing (or the fallback) is selected and the button is empty. Use a disabled
          fallback option, or put the whole Select inside the boundary for a skeleton. There is no
          "load on open": a native select has no open event (use a{" "}
          <a href="/components/combobox">Combobox</a> for that).
        </p>
      </BehaviourSection>

      <BehaviourSection
        id="browser-owned-state"
        summary={
          "The picker's open state (`:open`) is the browser's, with no attribute and no action. The browser selects an option before any JavaScript runs; a form reset and picks before hydration are dispatched with `reason: \"platform\"`."
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'A native select: picking, the keyboard, typeahead, `required` and form submission work, and with `appearance: base-select` the browser copies the selected option into `Select.Value`. On hydration a changed value is reconciled with one `valueChangeAction` call (`reason: "platform"`).'
        }
      >
        <h4>Plain HTML</h4>
        <p>
          If a select only posts with its form, a Server Component can render the native element
          itself, with no library code for it:
        </p>
        <CodeBlock>{`// A Server Component: no import from @funstack/ui.
<label>
  Size
  <select name="size" defaultValue={order.size ?? ""} required>
    <option value="">Choose a size</option>
    <option value="s">Small</option>
    <option value="m">Medium</option>
  </select>
</label>`}</CodeBlock>
        <p>
          Picking, the keyboard, typeahead, <code>required</code> and submission are the browser's.
          The <code>appearance: base-select</code> recipes above apply to it too: a styled picker in
          Chromium 135+ and Safari 27, the native select in Firefox. Keep the options' content plain
          text there. Rich button content needs a <code>&lt;selectedcontent&gt;</code>, which the
          parser fills before hydration, so a plain one in a hydrated React tree causes a hydration
          mismatch (and <code>@types/react</code> does not type it); <code>Select.Value</code> is
          the part that handles this.
        </p>
        <p>
          Compared with <code>Select</code>, it has no <code>valueChangeAction</code>, so no
          transition, <code>data-pending</code> or rollback on rejection; no data attributes (use{" "}
          <code>:checked</code> on options, <code>:open</code>, <code>:disabled</code>); no React
          state that tracks it, and none of the library's fixes for React's form reset and
          re-applying the selection; no options that load later behind Suspense; and no{" "}
          <a href="/components/field">Field</a> integration.
        </p>
      </BehaviourSection>

      <h3 id="forms">Forms</h3>
      <Example file="SelectForm.tsx" css="select.css">
        <SelectForm />
      </Example>
      <ul>
        <li>
          <strong>The value is always a string.</strong> "Nothing chosen" is the HTML placeholder: a
          first <code>{'<Select.Option value="">'}</code>, which <code>required</code> rejects with
          the browser's own message and <code>:user-invalid</code>. It may be <code>disabled</code>{" "}
          so that it cannot be picked again.
        </li>
        <li>
          <strong>Form reset</strong> (the Reset button, <code>form.reset()</code>, or React's
          automatic reset after the action succeeds) is one dispatch with{" "}
          <code>reason: "platform"</code> and the <code>reset</code> event. Uncontrolled, the target
          is the latest <code>defaultValue</code> (without one, the option adopted at mount);
          controlled, the Root's mount-time value, offered to the parent. A disabled Select is reset
          too.
        </li>
        <li>
          <strong>Picks before hydration</strong> (and Firefox restoring form state on reload) work
          natively; on hydration the Root finds the DOM differs from its state and dispatches once,
          with no event. That includes options that hydrate later inside a Suspense boundary.
        </li>
      </ul>

      <h4>Server Functions and forms</h4>
      <CodeBlock>{`// Autosave: an action with data-pending, passed directly from a Server Component.
<Select.Root defaultValue={user.country} valueChangeAction={setCountry}>...</Select.Root>

// Native submission: no action on the Select; pending is the form's.
<form action={placeOrder}>
  <Select.Root name="size" defaultValue="" required>...</Select.Root>
  <SubmitButton />
</form>`}</CodeBlock>
      <p>
        The <a href="/concepts/action-props#form-channel">two channels</a> are independent and may
        be combined. Every dispatch adds the view transition type <code>fsui-select</code>; no part
        takes a <code>transition</code> prop, since the picker and the button's copy are drawn by
        the browser. An action-less Select is a working native select before hydration, including
        the copy into the button.
      </p>

      <h3 id="styling">Styling</h3>
      <p>
        The library ships no CSS. These recipes cover the opt-in, the button, the picker, its
        options and an open/close animation. Engines without customizable select ignore all of it
        except the plain properties on the select.
      </p>
      <CodeBlock language="css">{`/* 1. Opt in to the customizable picker. Two rules: an engine that does not know
      ::picker(select) drops any rule naming it. */
.select { appearance: base-select; }
.select::picker(select) { appearance: base-select; }

/* 2. The button, its content, the arrow. */
.select { border: 1px solid GrayText; border-radius: 6px; padding: 0.4em 0.6em; }
.select::picker-icon { content: "▾"; transition: rotate 120ms; }
.select:open::picker-icon { rotate: 180deg; }
.select[data-pending] { cursor: progress; }
.select[data-pending] selectedcontent { opacity: 0.6; }
.select:user-invalid { border-color: var(--danger); }
selectedcontent .icon { inline-size: 1em; }          /* the copy, not the option */

/* 3. The picker and its options. */
.select::picker(select) { border: 1px solid GrayText; border-radius: 8px; padding: 4px; }
.select option { padding: 0.4em 0.6em; border-radius: 4px; }
.select option:hover, .select option:focus-visible { background: Highlight; color: HighlightText; }
.select option:checked { font-weight: 600; }          /* optimistic: flips on pick, reverts on rejection */
.select option::checkmark { content: "✓"; order: 1; margin-inline-start: auto; }
.select option[data-pending]::after { content: "…"; }
.select option:disabled { opacity: 0.4; }
.select optgroup legend { font-size: 0.85em; color: GrayText; }

/* 4. Open/close animation (Chromium; Safari 27.0 does not animate the picker yet). */
.select::picker(select) {
  opacity: 0;
  transition: opacity 120ms, overlay 120ms allow-discrete, display 120ms allow-discrete;
}
.select:open::picker(select) { opacity: 1; @starting-style { opacity: 0; } }

/* 5. Placement: the browser anchors the picker to the select; override its position. The self-*
   keywords follow the select's own direction (an RTL container too); plain logical ones would
   follow the root's, since the picker is in the top layer. */
.select::picker(select) { position-area: self-block-end span-self-inline-end; position-try-fallbacks: flip-block; }

@media (prefers-reduced-motion: reduce) {
  .select::picker(select), .select::picker-icon { transition: none; }
}`}</CodeBlock>
      <p>
        Tailwind: <code>data-pending:cursor-progress open:ring-2</code> on the Root,{" "}
        <code>checked:font-semibold data-pending:animate-pulse</code> on an Option.
      </p>
      <Callout title="Safari: a Select inside a Popover or Menu">
        <p>
          The browser positions the picker with anchor positioning and fallbacks. A WebKit bug
          (302008) can hang a page that opens a popover with position fallbacks inside another
          popover. If a Select inside a Popover or Menu misbehaves in Safari, turn the fallbacks
          off: <code>{".select::picker(select) { position-try-fallbacks: none; }"}</code>.
        </p>
      </Callout>

      <h3 id="browser-notes">Browser notes</h3>
      <Table
        head={["", "Chromium 135+", "Safari 27", "Firefox (default settings)"]}
        rows={[
          ["`appearance: base-select`", "styled picker", "styled picker", "ignored: native select"],
          ["Trigger (`<button>`)", "replaces the UA button", "same", "parsed, not rendered"],
          ["Value (`<selectedcontent>`)", "filled by the browser", "same", "stays empty"],
          [
            "Rich option content, GroupLabel",
            "rendered",
            "rendered",
            "the option text; the group's `label`",
          ],
          [
            "Value, forms, `required`, reset, actions, pending",
            "identical",
            "identical",
            "identical",
          ],
        ]}
      />
      <p>
        No experimental flag: the markup works everywhere and the opt-in is your CSS. Whether Safari
        on iOS draws the styled picker in the page or the system wheel is not verified yet; the
        value contract is the same either way (wrap the opt-in in{" "}
        <code>@media (pointer: fine)</code> if you need the wheel). Search, free text and async
        loading on open are <a href="/components/combobox">Combobox</a>'s job.
      </p>
    </DocPage>
  );
}
