import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { NumberFieldField } from "../examples/NumberFieldField.js";
import numberFieldFieldSource from "../examples/NumberFieldField.tsx?raw";
import { NumberFieldFormats } from "../examples/NumberFieldFormats.js";
import numberFieldFormatsSource from "../examples/NumberFieldFormats.tsx?raw";
import { NumberFieldQuantity } from "../examples/NumberFieldQuantity.js";
import numberFieldQuantitySource from "../examples/NumberFieldQuantity.tsx?raw";
import numberFieldCss from "../examples/number-field.css?raw";
import { functionProps, renderProp } from "./shared-props.js";

export function NumberFieldPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="NumberField"
        description="A text field that holds a number: typed in the user's locale, stepped with keys and press-and-hold buttons, posted as a plain number through a hidden native number input, saved once per gesture with rollback."
      />
      <h2>NumberField</h2>
      <p className="page-intro">
        A number field: the user types in their locale's notation, steps with the keys or two
        buttons, and the form posts a machine number. The platform's{" "}
        <code>&lt;input type="number"&gt;</code> cannot be the visible control (it cannot format, it
        localises by the browser's language rather than the page's, and it is a text field to
        VoiceOver anyway), so <code>NumberField.Input</code> renders <strong>two inputs</strong>: a
        visible <code>type="text"</code> input the user edits, and right after it a visually hidden
        native <code>type="number"</code> input that carries <code>name</code>, <code>min</code> /{" "}
        <code>max</code> / <code>step</code> / <code>required</code>, the posted value, the form
        reset and the browser's own constraint messages. The library adds the Async React half: the
        typed text is urgent, a <strong>step</strong> is a transition, and each{" "}
        <strong>gesture</strong> is one commit with <code>data-pending</code> and a rollback if the
        save fails.
      </p>

      <Example
        source={numberFieldQuantitySource}
        fileName="NumberFieldQuantity.tsx"
        css={numberFieldCss}
        cssFileName="number-field.css"
      >
        <NumberFieldQuantity />
      </Example>

      <h3>Two actions: steps and commits</h3>
      <Table
        head={["", "valueChangeAction", "valueCommitAction"]}
        rows={[
          [
            "Called",
            'On every step: the parsed text at its commit, each key press, each tick of a held button, each wheel event, a form reset, text found at hydration, and the revert after a failed save (`reason: "dismiss"`, uncontrolled).',
            "Once per gesture: a typed text's blur or Enter, a held button's release, each key press, each wheel event, a form reset, text found at hydration.",
          ],
          [
            "Lane",
            "A transition of its own: a controlled parent's `setValue(next)` in the synchronous prefix renders interruptibly.",
            "The Root's commit transition, with `useOptimistic`.",
          ],
          [
            "Pending",
            "`data-pending` while a step is in flight. Without a `valueChangeAction` a step starts no transition.",
            "`data-pending` on the Root, the Input and the pressed button until the save settles.",
          ],
          [
            "Uncontrolled state",
            "Not written.",
            "Written when it resolves; reverts to the value before the gesture if it rejects.",
          ],
          [
            "Meant for",
            "Adopting the value in a controlled parent, a live total, cheap synchronous work.",
            "Saving: a Server Function, a fetch, `requestSubmit()`.",
          ],
        ]}
      />
      <Callout title="The save goes in valueCommitAction">
        <p>
          A held button steps every 60 ms, and every pending async action entangles every transition
          in the app. Keep <code>valueChangeAction</code> cheap and put the network call in{" "}
          <code>valueCommitAction</code>, which runs once per gesture. A typed value and a key press
          fire both, with the same value; only a held button separates them.
        </p>
      </Callout>
      <ul>
        <li>
          <strong>Typed text is committed on blur and on Enter, never per keystroke.</strong>{" "}
          <code>-</code>, <code>1,</code> and <code>12</code> on the way to <code>123</code> are not
          the number the user means. The draft is internal, urgent state: typing never waits for a
          transition. A step (a key, a button) parses an open draft first.
        </li>
        <li>
          Text that does not parse (<code>abc</code>, <code>1,5</code> in English) reverts to the
          committed value's text with no dispatch. An empty field commits <code>null</code>.
        </li>
        <li>
          The input shows the value the gesture reached while a button is held, a step waits for its
          commit, or anything is in flight, so it never snaps back between ticks. A controlled value
          that changes from outside shows at once, unless the user has a draft open: the draft wins
          until it is committed.
        </li>
        <li>
          A rejected save reaches the nearest Error Boundary above the Root. For a visible rollback,
          catch inside the action and adopt the value only on success, as the example does: the text
          and the hidden input return to the parent's value.
        </li>
      </ul>

      <h3>Locales and formats</h3>
      <Example
        source={numberFieldFormatsSource}
        fileName="NumberFieldFormats.tsx"
        css={numberFieldCss}
        cssFileName="number-field.css"
      >
        <NumberFieldFormats />
      </Example>
      <ul>
        <li>
          <code>format</code> is <code>Intl.NumberFormatOptions</code>: <code>style</code>{" "}
          <code>"decimal"</code> (default), <code>"percent"</code> (the value is a fraction,{" "}
          <code>0.25</code> shows <code>25%</code>; default <code>step</code> <code>0.01</code>),{" "}
          <code>"currency"</code> and <code>"unit"</code>, plus fraction digits, grouping, sign
          display and numbering system.
        </li>
        <li>
          <strong>
            Pass <code>locale</code>
          </strong>
          . The default is the runtime's locale (on the server and in the browser alike); a
          development warning fires when the page's <code>lang</code> disagrees and no{" "}
          <code>locale</code> was given.
        </li>
        <li>
          The parser accepts what the formatter produces: the locale's decimal and group separators
          and digits (Arabic-Indic, Devanagari, full-width), the currency or unit in any spelling (
          <code>€</code>, <code>EUR</code>, <code>euros</code>), a leading or trailing minus, U+2212
          and accounting parentheses. <strong>Grouping is strict</strong>: a group separator must
          sit before the decimal separator and be followed by a whole group, so <code>1,5</code> in
          English is not 15 and <code>1.5</code> in German is not 15; the text reverts instead of
          silently becoming ten times larger.
        </li>
        <li>
          The committed value is <strong>rounded to what the text shows</strong> (the format's
          maximum fraction digits): <code>1.999</code> in a euro field commits <code>2</code> and
          shows <code>2,00 €</code>, so what the user sees is what the form posts. Stepped values
          are rounded the same way (a <code>step</code> finer than the format cannot post a digit
          the text hides). Set <code>maximumFractionDigits</code> higher for more precision.{" "}
          <code>notation: "compact"</code> cannot be parsed back and logs a development warning.
        </li>
      </ul>

      <h3>Constraints: not clamped, reported</h3>
      <p>
        Like a native number input, a <strong>typed</strong> value is neither clamped to{" "}
        <code>min</code> / <code>max</code> nor snapped to <code>step</code>: it stays as typed, the
        hidden input reports <code>rangeUnderflow</code>, <code>rangeOverflow</code> or{" "}
        <code>stepMismatch</code>, the browser's localised message is mirrored onto the visible
        input, and the form does not submit until it is fixed. <strong>Stepping</strong> does clamp
        and snap, with the HTML <code>stepUp()</code> rules: an off-grid value snaps in the
        direction of the step, the step base is <code>min</code> (else <code>0</code>; give{" "}
        <code>min</code> when the grid matters), and a button is <code>disabled</code> when its next
        step would change nothing (judged from the draft while one is open; an unreachable{" "}
        <code>max</code> stays unreachable: <code>0</code>–<code>5</code> by <code>2</code> stops at{" "}
        <code>4</code>). To clamp typed values, do it in a controlled parent's{" "}
        <code>valueChangeAction</code>.
      </p>

      <h3>Anatomy</h3>
      <CodeBlock>{`import { NumberField } from "@funstack/ui/number-field";

<NumberField.Root name="quantity" defaultValue={1} min={1} max={99} locale="en-US"
  valueCommitAction={saveQuantity}>             {/* div role=group, named by the Label */}
  <NumberField.Label>Quantity</NumberField.Label> {/* label for= the visible input */}
  <NumberField.Decrement>−</NumberField.Decrement> {/* button tabindex=-1 aria-label="Decrease" */}
  <NumberField.Input />                         {/* input type=text + hidden input type=number */}
  <NumberField.Increment>+</NumberField.Increment> {/* button tabindex=-1 aria-label="Increase" */}
</NumberField.Root>`}</CodeBlock>

      <h3>Props</h3>
      <h4>
        <code>NumberField.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "number | null",
            description:
              "Controlled value; `null` is empty, `undefined` uncontrolled. `NaN` / `Infinity` are treated as empty (development warning).",
          },
          {
            name: "defaultValue",
            type: "number | null",
            default: "null",
            description:
              "Initial value in uncontrolled mode; also the form-reset target (the latest value).",
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<number | null, NumberFieldValueChangeDetails>",
            description:
              "Runs in the Root's step transition on every step. Awaited; `data-pending` meanwhile. Adopt the value here in a controlled parent. Not the place for a save.",
          },
          {
            name: "valueCommitAction",
            type: "ChangeAction<number | null, NumberFieldValueChangeDetails>",
            description:
              "Runs in the Root's commit transition once per gesture. Awaited; the field keeps the gesture's value with `data-pending` until it settles. Uncontrolled, the value is committed when it resolves and reverts when it rejects. May be a Server Function.",
          },
          {
            name: "min / max",
            type: "number",
            description:
              "Native constraints on the hidden input, and the bounds of stepping. Home / End go to them when set.",
          },
          {
            name: "step",
            type: "number",
            default: '1 (0.01 for style "percent")',
            description: "Native `step` and the stepping grid from `min` (else 0).",
          },
          {
            name: "largeStep",
            type: "number",
            default: "10 × step",
            description: "PageUp / PageDown and Shift+Arrow.",
          },
          {
            name: "format",
            type: "Intl.NumberFormatOptions",
            description:
              "How the text is formatted and parsed: `decimal`, `percent`, `currency`, `unit`, fraction digits, grouping, sign display, numbering system.",
          },
          {
            name: "locale",
            type: "string | readonly string[]",
            default: "runtime locale",
            description:
              "BCP 47 tag(s) for formatting and parsing. Pass the page's `lang` (development warning when it disagrees and this is absent).",
          },
          {
            name: "stepOnWheel",
            type: "boolean",
            default: "false",
            description:
              "Step with the mouse wheel while the input is focused (a native non-passive listener; the page does not scroll then).",
          },
          {
            name: "name / form",
            type: "string",
            description:
              'On the hidden number input, which posts `String(value)` (`""` when empty). `name` defaults to the Field\'s.',
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Disables both inputs (not submitted) and the buttons.",
          },
          {
            name: "readOnly",
            type: "boolean",
            default: "false",
            description: "Native `readonly` on both inputs; no stepping, buttons disabled.",
          },
          {
            name: "required",
            type: "boolean",
            default: "false",
            description: "On the hidden input: an empty field is `valueMissing`. Or the Field's.",
          },
          {
            name: "announce",
            type: "(value: number | null, state: NumberFieldState) => string | null",
            default: "state.text",
            description:
              "What is announced after a key press, a wheel event, a click activation and a hold's release (not per tick, not for typed text). `null` announces nothing.",
          },
          ...functionProps("NumberFieldState", "The parts. The function form receives the state."),
          renderProp("div", "NumberFieldState"),
        ]}
      />
      <p>
        <code>NumberFieldState</code> (every part but the buttons):{" "}
        <code>{"{ value, text, pending, disabled, readOnly, required }"}</code>, where{" "}
        <code>value</code> is the shown value (the gesture's while one is open or in flight) and{" "}
        <code>text</code> the shown text (the draft while editing). Details:{" "}
        <code>{"{ reason, source, event }"}</code>, <code>reason</code> being{" "}
        <code>"activate"</code>, <code>"platform"</code> (a form reset, text found at hydration) or{" "}
        <code>"dismiss"</code> (the revert after a failed save, steps only), and <code>source</code>{" "}
        one of <code>"input"</code>, <code>"increment"</code>, <code>"decrement"</code>,{" "}
        <code>"keyboard"</code>, <code>"wheel"</code>, or <code>null</code> on platform paths and
        the revert. <code>event</code> is the DOM event, and <code>undefined</code> for the repeats
        of a held button, a hold that ended at its bound, hydration and the revert. The Root owns{" "}
        <code>role="group"</code> and <code>aria-labelledby</code> (your tokens, then the Label's
        id, then a Field label's). There is no <code>transition</code> prop on any part; the
        dispatches carry the types <code>fsui-number-field</code> plus{" "}
        <code>fsui-number-field-change</code> (step) or <code>fsui-number-field-commit</code>{" "}
        (gesture) for your own boundaries.
      </p>

      <h4>
        <code>NumberField.Input</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "hiddenInputRef",
            type: "Ref<HTMLInputElement>",
            description:
              'The hidden native `<input type="number">` rendered after the visible input (`ref` is the visible one).',
          },
          {
            name: "inputMode / autoComplete / autoCorrect / spellCheck",
            type: "string / boolean",
            default: '"numeric" or "decimal", "off", "off", false',
            description:
              '`inputMode` is `"decimal"` when fractions are allowed, else `"numeric"`. Defaults your own prop replaces.',
          },
          ...functionProps("NumberFieldState").filter((row) => row.name !== "children"),
          renderProp("input", "NumberFieldState"),
        ]}
      />
      <p>
        The visible input owns <code>id</code>, <code>type</code> (<code>text</code>, or{" "}
        <code>search</code> / <code>tel</code> from a <code>render</code> element; a{" "}
        <code>number</code> element logs a warning), <code>value</code>, <code>disabled</code>,{" "}
        <code>readOnly</code> and its handlers. <code>name</code>, <code>min</code>,{" "}
        <code>max</code>, <code>step</code>, <code>required</code> and <code>pattern</code> are not
        props: constraints live on the hidden input, and a constraint on the visible one would make
        it invalid for a reason nobody reports. <code>placeholder</code>, <code>aria-*</code>,{" "}
        <code>onFocus</code>, <code>onPaste</code>, <code>onCompositionStart</code> /{" "}
        <code>onCompositionEnd</code> and the rest pass through.
      </p>

      <h4>
        <code>NumberField.Increment</code>, <code>NumberField.Decrement</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Also disabled by the Root\'s `disabled` / `readOnly`, and when the next step would change nothing. Native `disabled` on a `<button>`; with a link or component `render`, `aria-disabled="true"` instead, in all three cases.',
          },
          {
            name: "aria-label",
            type: "string",
            default: '"Increase" / "Decrease"',
            description:
              "The built-in English names. Your `aria-label` (or `aria-labelledby`) replaces them; pass the same text as `aria-label` to let a text label name the button.",
          },
          ...functionProps("NumberFieldButtonState"),
          renderProp("button", "NumberFieldButtonState"),
        ]}
      />
      <p>
        <code>NumberFieldButtonState</code>: <code>{"{ pending, disabled }"}</code>, where{" "}
        <code>pending</code> is true while the latest step or commit came from this button and is in
        flight. The buttons own <code>type="button"</code> (on a <code>&lt;button&gt;</code> only),{" "}
        <code>tabIndex={"{-1}"}</code>, <code>aria-controls</code>, <code>disabled</code> and{" "}
        <code>aria-disabled</code> (link or component <code>render</code>).
      </p>

      <h4>
        <code>NumberField.Label</code>
      </h4>
      <PropsTable
        rows={[...functionProps("NumberFieldState"), renderProp("label", "NumberFieldState")]}
      />
      <p>
        Must stay a <code>&lt;label&gt;</code>: it names the visible input through <code>for</code>{" "}
        and, through its id, the Root group.
      </p>

      <h3>Keyboard, buttons and wheel</h3>
      <Table
        head={["Input", "Effect"]}
        rows={[
          [
            "ArrowUp / ArrowDown",
            "± step from the parsed draft or the shown value (empty counts as 0), snapped and clamped.",
          ],
          ["Shift+Arrow, PageUp / PageDown", "± largeStep."],
          [
            "Home / End",
            "`min` / the largest step at or below `max`, only when that bound is set; otherwise the caret moves. Shift+Home / Shift+End always select text.",
          ],
          [
            "Enter",
            "Commits the draft. Not prevented: inside a form with a submit button the implicit submission follows and posts the committed value.",
          ],
          ["Everything else", "Text editing. Tab leaves the field and the blur commits."],
          [
            "A button press",
            "One step at once, then a repeat after 400 ms and every 60 ms while held; one commit at the release.",
          ],
          [
            "The wheel (`stepOnWheel`)",
            "One step per wheel event while the input is focused; unfocused, the page scrolls.",
          ],
        ]}
      />
      <ul>
        <li>
          Each key press, wheel event and click activation is its own gesture: a step and a commit.
          With a slow <code>valueCommitAction</code> a wheel flick is several commits; the latest
          wins.
        </li>
        <li>
          A press on a button is <code>preventDefault()</code>ed: focus stays where it was (the
          library never moves it), a touch opens no keyboard, and no text is selected. The buttons
          are not Tab stops (<code>tabindex="-1"</code>, as the APG asks); a click with no pointer
          (assistive technology) steps once.
        </li>
        <li>
          The iPhone's numeric keypads have no minus key; pass <code>inputMode="text"</code> when
          negatives must be typed there.
        </li>
      </ul>

      <h3>Accessibility</h3>
      <ul>
        <li>
          <strong>
            No <code>role="spinbutton"</code>.
          </strong>{" "}
          On a text input VoiceOver announces the wrong value for a spinbutton and its gestures
          rewrite the text, so the visible input is a plain textbox (as in React Aria and Base UI).
          The formatted text is its value, the group tells the user what the buttons change, and
          each step is <strong>announced</strong>.
        </li>
        <li>
          <strong>Announcements</strong> go through <code>ariaNotify()</code> on the input, with a
          visually hidden <code>role="status"</code> region in <code>document.body</code> as the
          fallback where it is missing. The default is the formatted text (<code>"2"</code>,{" "}
          <code>"1,50 €"</code>, <code>"50%"</code>); override with <code>announce</code>.
        </li>
        <li>
          <strong>
            No <code>aria-roledescription</code>
          </strong>
          : it would replace "edit text", the cue that the field takes typing. Pass one through{" "}
          <code>NumberField.Input</code> if you want it.
        </li>
        <li>
          The hidden number input is <code>aria-hidden</code> and unfocusable; its{" "}
          <code>invalid</code> event is always cancelled, so the browser reports on (and focuses)
          the visible input, which mirrors its <code>validationMessage</code>.
        </li>
      </ul>

      <h3>Data attributes and CSS</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          [
            "`data-pending`",
            "Root, Label, Input",
            "A step (with a `valueChangeAction`) or commit is in flight.",
          ],
          [
            "`data-pending`",
            "Increment / Decrement",
            "The latest step or commit came from this button and is in flight.",
          ],
          [
            "`data-disabled`",
            "every part",
            "Disabled (the buttons also at their bound and when read-only).",
          ],
          ["`data-invalid`", "Root, Input", "Inside a Field that shows an error."],
          [
            "`:user-invalid`, `:read-only`, `:disabled`, `:placeholder-shown`",
            "the visible input",
            "The platform's own states.",
          ],
          ["`:active`", "a held button", "No `data-holding`: the platform has it."],
        ]}
      />
      <CodeBlock language="css">{`.number-field { display: inline-grid; grid-template-columns: auto 1fr auto; }
.number-field .input { min-width: 6ch; text-align: end; font-variant-numeric: tabular-nums; }
.number-field .step { inline-size: 2.25rem; }
.number-field .step:disabled { opacity: .4; }
.number-field .input[data-pending] { background-image: var(--spinner); background-repeat: no-repeat; }
.number-field .step[data-pending] { cursor: progress; }
.number-field .input:user-invalid { border-color: var(--danger); }
.number-field[data-invalid] .step { border-color: var(--danger); }
.number-field:has(.input:focus-visible) { outline: 2px solid var(--accent); }`}</CodeBlock>
      <p>
        The buttons' order is your markup's: an RTL page places <code>Decrement</code> first in
        source if it wants it at the inline start.
      </p>

      <h3>Forms and hydration</h3>
      <ul>
        <li>
          The hidden input posts <code>String(value)</code> (<code>quantity=12</code>,{" "}
          <code>price=12.5</code>), <code>""</code> when empty, nothing when disabled; the text is
          never posted.
        </li>
        <li>
          <strong>Form reset</strong> is the platform's for the hidden input (its{" "}
          <code>defaultValue</code> is the reset target: the latest <code>defaultValue</code>{" "}
          uncontrolled, the mount-time value controlled); the library then dispatches one step and
          one commit with <code>reason: "platform"</code> and clears an open draft.
        </li>
        <li>
          <strong>Before hydration</strong> the text can be typed; at hydration a parsable change is
          adopted with one <code>"platform"</code> step and commit (or kept as the draft while the
          input is still focused). A form submitted before hydration posts the default value; the
          buttons do nothing yet. A plain <code>&lt;input type="number"&gt;</code> from a Server
          Component remains the JS-free number field.
        </li>
        <li>
          A step writes the hidden input by script, so a <code>&lt;form onChange&gt;</code> listener
          hears typed edits only.
        </li>
      </ul>

      <h3 id="inside-a-field">Inside a Field</h3>
      <Example
        source={numberFieldFieldSource}
        fileName="NumberFieldField.tsx"
        css={numberFieldCss}
        cssFileName="number-field.css"
      >
        <NumberFieldField />
      </Example>
      <ul>
        <li>
          The visible input is the Field's control: it takes the Field's id (so{" "}
          <code>Field.Label</code>'s <code>for</code> names it), its description and error, and the
          focus of a blocked submission. The Root's group is named by <code>Field.Label</code> too.
        </li>
        <li>
          The validity is the <strong>hidden input's</strong>: <code>Field.Error</code>'s function{" "}
          <code>children</code> sees <code>validity.stepMismatch</code>, <code>rangeUnderflow</code>
          , <code>rangeOverflow</code> and <code>valueMissing</code>, and the Field writes{" "}
          <code>validate</code>'s message and server errors there, mirrored onto the visible input.
        </li>
        <li>
          <code>name</code> and <code>required</code> go to the hidden input, <code>disabled</code>{" "}
          to both inputs and the buttons. <code>validate</code> receives <code>String(number)</code>{" "}
          (the committed value, not the draft), so <code>Number(value)</code> is safe.
        </li>
        <li>
          A step or a typed commit counts as an edit (it re-runs <code>validate</code> and dismisses
          a server error); a rollback or a form reset re-runs <code>validate</code> only.
        </li>
        <li>
          The two channels stay separate: the field's own save is its <code>data-pending</code>, the
          form's submission is the Field's.
        </li>
      </ul>
      <CodeBlock>{`// A Server Function as the save, straight from a Server Component:
<NumberField.Root defaultValue={line.quantity} min={1} locale="en-US" valueCommitAction={saveQuantity}>…</NumberField.Root>`}</CodeBlock>
    </div>
  );
}
