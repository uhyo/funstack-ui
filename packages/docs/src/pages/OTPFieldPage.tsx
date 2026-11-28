import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { OTPFieldAutoSubmit } from "../examples/OTPFieldAutoSubmit.js";
import { OTPFieldVerify } from "../examples/OTPFieldVerify.js";
import { functionProps, renderProp, stylingProps } from "./shared-props.js";

export function OTPFieldPage() {
  return (
    <DocPage
      title="OTPField"
      description="A field for a one-time code: one input with autocomplete one-time-code drawn as a row of boxes, a filter that keeps the text a code, and completeAction, the moment the code is complete as an awaited request with data-pending."
    >
      <p className="page-intro">
        A field for a short code the user received elsewhere: an SMS or email verification code, an
        authenticator's six digits, a PIN. It looks like a row of boxes and is{" "}
        <strong>one text input</strong> with <code>autocomplete="one-time-code"</code>, so typing,
        paste, the keyboard's SMS suggestion and a password manager all fill it as they fill any
        input. The library adds the boxes, a filter that keeps the text a code, and the asynchronous
        half: <strong>the moment the code is complete is a request</strong>,{" "}
        <code>completeAction</code>, run in a transition with <code>data-pending</code>.
      </p>

      <Example file="OTPFieldVerify.tsx" css="otp-field.css">
        <OTPFieldVerify />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { OTPField } from "@funstack/ui/otp-field";
import { Separator } from "@funstack/ui/separator";

<label htmlFor="code">Verification code</label>
<OTPField.Root length={6} completeAction={verifyCode}>  {/* div, position: relative */}
  <OTPField.Input id="code" />                       {/* input autocomplete=one-time-code, covers the Root */}
  <OTPField.Slot index={0} />                        {/* span aria-hidden: one character */}
  <OTPField.Slot index={1} />
  <OTPField.Slot index={2} />
  <Separator decorative orientation="vertical" />
  <OTPField.Slot index={3} />
  <OTPField.Slot index={4} />
  <OTPField.Slot index={5} />
</OTPField.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>The Input is the field.</strong> It lies over the whole Root with transparent text
          and caret (an inline style the library sets), so a click anywhere focuses it and the
          browser's own long-press, paste menu and autofill work on it. It is the only focusable
          element and the only thing assistive technology sees.
        </li>
        <li>
          <strong>The Slots are drawings.</strong> Each shows the character at its{" "}
          <code>index</code> and is <code>aria-hidden</code>. You choose the grouping with ordinary
          elements between them. A missing or repeated index is a development warning.
        </li>
        <li>
          There is no <code>Label</code> part: name the Input with a <code>&lt;label for&gt;</code>,{" "}
          <code>Field.Label</code>, or <code>aria-label</code> (an unnamed Input is a development
          warning). No hidden input either: the Input is the form control.
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <h4>The text is a fact, the completion is a request</h4>
      <Table
        head={["", "onValueChange", "completeAction"]}
        rows={[
          [
            "Called",
            'For every change of the filtered text: an edit (`"activate"`), a form reset, text found at hydration, a WebOTP fill (`"platform"`).',
            "Each time an edit (or a WebOTP fill) leaves the code complete. Before it, `onValueChange` for the same edit.",
          ],
          [
            "Lane",
            "Urgent: synchronously in the `input` event, outside any transition. A controlled parent's `setCode(next)` keeps the input in step per keystroke.",
            "The Root's transition, awaited.",
          ],
          [
            "Pending",
            "Never.",
            "`data-pending` on the Root and the Input until every run has settled. The input stays enabled and editable.",
          ],
          [
            "Errors",
            "A throw or a rejected promise goes to `reportError`; the edit stands.",
            "A rejection reaches the nearest Error Boundary. A wrong code is not an error: resolve and show the message.",
          ],
        ]}
      />
      <ul>
        <li>
          <code>completeAction</code> runs for <strong>every</strong> completed code: a second one
          while the first is pending runs too (it is a different code), and so does the same code
          pasted again (the way to retry). A character the filter drops does not re-run it. There is
          no <code>whilePending</code>: ignoring a completion would drop what the user typed. An
          action that must not act on a stale code compares it with the current text after its{" "}
          <code>await</code>, as the example does.
        </li>
        <li>
          Not run at mount, for text found at hydration (a code the browser restored on reload is
          not a fresh one), for a controlled <code>value</code> you changed, for a form reset, or
          while <code>disabled</code> / <code>readOnly</code>.
        </li>
        <li>
          Clearing after a wrong code is the controlled form: <code>setCode("")</code> in the
          action, after its <code>await</code>. That is an urgent update, which is what a text input
          needs.
        </li>
      </ul>

      <h4>The filter</h4>
      <p>
        The browser performs every edit; in each <code>input</code> event the library reads the
        result and, where the filtered text differs, writes it back with the caret. Nothing is{" "}
        <code>preventDefault()</code>ed.
      </p>
      <ul>
        <li>
          Characters outside <code>charset</code> are dropped, so a pasted <code>123 456</code> or{" "}
          <code>123-456</code> becomes <code>123456</code>. Full-width digits (from a Japanese or
          Chinese IME) are converted for <code>"numeric"</code>. Case is kept.
        </li>
        <li>
          <strong>A full code replaces everything</strong>: pasting six digits into a half-typed
          field does not append to the half.
        </li>
        <li>
          <strong>Typing over a filled box replaces it</strong> and moves on; at the end of a
          complete code a character replaces the last one. A selected range is replaced.
        </li>
        <li>
          A dropped character over a selection leaves the text and the selection as they were.
        </li>
        <li>
          No <code>maxlength</code>: it would cut <code>123 456</code> to <code>123 45</code> before
          the filter sees it. The length is the filter's, and the derived <code>pattern</code>'s
          without JavaScript.
        </li>
        <li>
          While an IME composes, the library does not write to the input (that would end the
          composition): the Slots follow the filtered text and the write-back happens at{" "}
          <code>compositionend</code>. Numeric keyboards do not compose.
        </li>
      </ul>

      <h3 id="props">Props</h3>
      <h4>
        <code>OTPField.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "length",
            type: "number",
            description:
              "Required. The number of characters in a complete code; also the `pattern`'s count. A non-positive or fractional value logs a development warning.",
          },
          {
            name: "charset",
            type: '"numeric" | "alphanumeric" | "alphabetic"',
            default: '"numeric"',
            description:
              "Which characters the filter keeps (ASCII digits, letters and digits, letters), and so the Input's `inputmode` (`numeric` / `text`) and `pattern` (`[0-9]{6}`, `[A-Za-z0-9]{6}`, `[A-Za-z]{6}`).",
          },
          {
            name: "value",
            type: "string",
            description:
              "Controlled text. It follows the input and cannot hold an edit back; a value the filter would change is rendered filtered, with a development warning.",
          },
          {
            name: "defaultValue",
            type: "string",
            default: '""',
            description:
              "Initial text in uncontrolled mode (filtered); also the form-reset target.",
          },
          {
            name: "onValueChange",
            type: "UrgentChangeHandler<string, OTPFieldValueChangeDetails>",
            description:
              "The text changed. A fact: called synchronously, outside any transition, not awaited. Called before `completeAction` for the same edit.",
          },
          {
            name: "completeAction",
            type: "Action<[value: string, details: OTPFieldCompleteDetails]>",
            description:
              "An edit left the code complete. Runs in the Root's transition and is awaited, with `data-pending`. May be a Server Function.",
          },
          {
            name: "submitOnComplete",
            type: "boolean",
            default: "false",
            description:
              "Submit the Input's form (`requestSubmit()`) when an edit leaves the code complete, right after dispatching `completeAction`; inside a Field after re-validating the filtered text; during an IME composition at `compositionend`. See [Auto-submit](#auto-submit) for the notice it needs.",
          },
          {
            name: "name, form",
            type: "string",
            description:
              "On the Input, which posts the text. `name` defaults to the Field's inside a `Field.Root`.",
          },
          {
            name: "required",
            type: "boolean",
            default: "false",
            description: "On the Input: an empty field is `valueMissing`. Or the Field's.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "Native `disabled` on the Input, or the enclosing `Field.Root`'s; never dispatches. A disabled field is not submitted.",
          },
          {
            name: "readOnly",
            type: "boolean",
            default: "false",
            description:
              "Native `readonly` on the Input, or the enclosing `Field.Root`'s: no edits and no completion; `data-readonly` on the Root and the Input. The code is focusable and submitted. Text the browser restored at hydration is put back, not adopted.",
          },
          {
            name: "dir",
            type: "string",
            default: '"ltr"',
            description:
              "The native attribute, with a library default: a code is read left to right in every locale, so the Slots, the text and the caret keys stay left to right inside an RTL page. Your value (`rtl`, `auto`) wins, on the Root or on a `render` element. See [Right-to-left pages](#right-to-left-pages).",
          },
          {
            name: "experimental_webOTP",
            type: "boolean",
            default: "false",
            description:
              "Ask the browser for the code of an origin-bound SMS while the Input is mounted ([WebOTP](#webotp)). Chromium and Safari; does nothing in Firefox.",
          },
          ...functionProps("OTPFieldState", "The parts. The function form receives the state."),
          renderProp("div", "OTPFieldState"),
        ]}
      />
      <PartFacts
        state={
          "`OTPFieldState` (aliased as `OTPFieldRootState` and `OTPFieldInputState`) is `{ value, length, complete, pending, disabled, readOnly, invalid, required }`: `value` is the filtered text, `complete` is `value.length === length`, `pending` is a `completeAction` in flight, `invalid` an error shown by an enclosing Field (`false` outside one), `required` the prop or the Field's."
        }
        owned={
          '`data-complete`, `data-pending`, `data-disabled`, `data-readonly`, `data-invalid` (inside a Field), and `position` in `style` (`relative`) unless your style sets it. `dir` defaults to `"ltr"`; yours wins.'
        }
        note={
          'Both details objects are `{ reason, event }`; `completeAction`\'s also has `valid`, `false` only when the Field\'s `validate` rejects the code (see [details.valid](/components/field#details-valid)). `onValueChange`: `"activate"` for an edit (`event` is the `input` event, or the `compositionend` that ended a composition), `"platform"` for a form reset (the `reset` event), text found at hydration and a WebOTP fill (`undefined`). `completeAction`: `"activate"` for an edit, `"platform"` for a WebOTP fill. Serialisable: a Server Function receives `{ reason }` (`{ reason, valid }` for `completeAction`).'
        }
      />

      <h4>
        <code>OTPField.Input</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "autoComplete, inputMode, autoCapitalize, autoCorrect, spellCheck",
            type: "string, string, string, string, boolean",
            default: '"one-time-code", from charset, "off", "off", false',
            description:
              'Defaults your own prop replaces. `autoComplete="off"` is the spelling for a PIN that is not a one-time code.',
          },
          ...stylingProps("OTPFieldState"),
          renderProp("input", "OTPFieldState"),
        ]}
      />
      <PartFacts
        state={"`OTPFieldState`."}
        owned={
          '`type` (`"text"`), `value`, `pattern`, `name`, `form`, `required`, `disabled`, `readOnly`, `onChange` (and native `beforeinput`, composition, selection and `click` listeners), the inline style (`position: absolute; inset: 0; …; color: transparent; caret-color: transparent; forced-color-adjust: none`; your style cannot override those keys), inside a Field `id`, `aria-describedby` (token-merged) and `aria-invalid`, and `data-complete`, `data-pending`, `data-disabled`, `data-readonly`, `data-invalid`.'
        }
        note={
          "`id`, `aria-label`, `aria-describedby`, `autoFocus`, `title` and the rest go on the Input. A `title` is appended to the browser's message for a partial code. The outline is not touched: the Input's focus ring surrounds the whole field unless you move it."
        }
      />

      <h4>
        <code>OTPField.Slot</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "index",
            type: "number",
            description: "Required. Which character position this slot shows, from 0.",
          },
          ...functionProps(
            "OTPFieldSlotState",
            "Default: the character, or nothing. A function draws a placeholder, a dot, a caret element.",
          ),
          renderProp("span", "OTPFieldSlotState"),
        ]}
      />
      <PartFacts
        state={
          "`OTPFieldSlotState` is `OTPFieldState` plus `{ index, char, filled, active }`: `char` is the character at `index` or `null`, `active` is the caret or part of the selection at this position while the input is focused."
        }
        owned={
          "`aria-hidden`, `data-index`, `data-filled`, `data-active`, and `pointer-events: none` in the inline style."
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          ["`data-complete`", "Root, Input", "The text has `length` characters."],
          ["`data-pending`", "Root, Input", "A `completeAction` is in flight."],
          ["`data-disabled`", "Root, Input", "Disabled (own prop or the Field's)."],
          ["`data-readonly`", "Root, Input", "Read-only (own prop or the Field's)."],
          ["`data-invalid`", "Root, Input", "Inside a Field that shows an error."],
          ["`data-index`", "Slot", "The slot's `index`."],
          ["`data-filled`", "Slot", "A character is at this position."],
          [
            "`data-active`",
            "Slot",
            "The input is focused and the caret (the next character goes here) or part of the selection is at this position; at the end of a complete code, the last slot.",
          ],
          [
            "`:focus-visible`, `:user-invalid`, `:disabled`",
            "Input",
            "The platform's own states (`.root:has(:focus-visible)`).",
          ],
        ]}
      />
      <CodeBlock language="css">{`.otp { display: inline-flex; gap: .5rem; }
.otp-input { border-radius: .5rem; font-size: 1rem; }          /* 16px or more: no zoom on focus in iOS */
.otp-input::selection { background: transparent; }
.otp-slot { display: grid; place-items: center; inline-size: 2.5rem; block-size: 3rem;
            border: 1px solid var(--line); border-radius: .5rem; font: 600 1.25rem / 1 var(--mono); }
.otp-slot[data-active] { border-color: var(--accent); }
.otp-slot[data-active]:not([data-filled])::after {             /* the drawn caret */
  content: ""; inline-size: 1px; block-size: 1.25em; background: currentColor;
  animation: otp-caret 1s steps(1) infinite;
}
@keyframes otp-caret { 50% { opacity: 0; } }
.otp[data-pending] .otp-slot { opacity: .6; }
.otp[data-invalid] .otp-slot { border-color: var(--danger); }
.otp-slot:not([data-filled])::before { content: "·"; color: var(--muted); }   /* placeholder */
@media (prefers-reduced-motion: reduce) { .otp-slot::after { animation: none; } }`}</CodeBlock>
      <ul>
        <li>
          Style the Slots freely: they carry an owned inline <code>pointer-events: none</code>, so a
          dimmed, positioned or animated Slot never takes the click from the Input.
        </li>
        <li>
          A design that moves the focus ring from the Input to the active Slot must keep one
          visible:
          <code>.otp:has(.otp-input:focus-visible) .otp-slot[data-active]</code>.
        </li>
        <li>
          Under forced colours the Input keeps its text transparent (
          <code>forced-color-adjust: none</code>); the Slots are ordinary text and follow the system
          colours.
        </li>
      </ul>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Behaviour"]}
        rows={[
          [
            "A character of `charset`",
            "Inserted, or typed over the character at the caret. Others are dropped.",
          ],
          [
            "Backspace / Delete",
            "Native: the character before / after the caret; the rest closes up.",
          ],
          [
            "ArrowLeft / ArrowRight / Home / End (with Shift: select)",
            "Native caret movement: one character is one slot.",
          ],
          ["Ctrl+A / Cmd+A (also C, X, V, Z)", "Native select all, copy, cut, paste and undo."],
          ["Enter", "Native implicit submission of the form."],
          ["Click", "Focuses the Input and puts the caret at the slot under the pointer."],
        ]}
      />
      <ul>
        <li>
          One field, one name, one value: a screen reader reads typed characters as in any text
          field. The library ships no built-in string; there is no per-box label to invent.
        </li>
        <li>
          Put the expected length in the visible label or description ("the 6-digit code we sent to
          …"); the <code>pattern</code> alone tells a screen-reader user nothing until it fails.
        </li>
        <li>
          Pending is visual (<code>data-pending</code>). The answer is your content: a Field error
          through <code>aria-describedby</code> and the Form's focus move, or your own{" "}
          <code>role="status"</code> message, as in the example.
        </li>
        <li>A programmatic write clears the browser's undo history for the input.</li>
      </ul>

      <h4 id="right-to-left-pages">Right-to-left pages</h4>
      <p>
        A one-time code is read left to right in Arabic and Hebrew too, so{" "}
        <code>OTPField.Root</code> renders <code>dir="ltr"</code> unless you pass <code>dir</code>.
        Inside a <code>dir="rtl"</code> page Slot 0 stays the leftmost box, ArrowLeft moves to the
        previous character, and your logical CSS (<code>margin-inline-start</code>, a separator
        between groups) inside the Root resolves as left to right. The label, the description and
        the error message are outside the Root and follow the page. The attribute is in the server
        HTML, so it holds before hydration.
      </p>
      <p>
        Without it the boxes would mirror (Slot 0 at the right) while the one input's text stays a
        left-to-right run, and the engines disagree on which way the arrow keys then move the caret.
        Pass <code>dir="rtl"</code> only for a code that really is read right to left; there is no
        value meaning "follow the page". More in{" "}
        <a href="/concepts/direction-and-locales">Direction and locales</a>.
      </p>

      <BehaviourSection
        id="transition-types"
        summary={
          "Each `completeAction` run: `fsui-otp-field` plus `fsui-otp-field-complete`. Typing is urgent and carries none. No part takes a `transition` prop; use the types in your own boundary (the next step of a sign-in)."
        }
      >
        <CodeBlock language="css">{`::view-transition-old(.step):active-view-transition-type(fsui-otp-field-complete) { animation: slide-out-left .2s; }`}</CodeBlock>
      </BehaviourSection>

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "Nothing is optimistic: the text is urgent library state written from the `input` event. `data-pending` is on the Root and the Input while a `completeAction` runs; the field is never disabled meanwhile."
        }
      />

      <BehaviourSection
        id="suspense"
        summary={"Nothing specific: the OTPField renders no content region."}
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          "The text is the input's: the browser edits it, the library filters it. A form reset is the browser's; the library adopts the reset target with `onValueChange` (`\"platform\"`) and runs no completion. The selection is the browser's too; the Slots mirror it (`data-active`)."
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'The server HTML is the input and the Slots with the default value. Before hydration the input takes typing, paste and autofill natively, but the text is transparent and the Slots are static, so **what is typed is not visible until hydration**. At hydration the text is filtered and adopted (`"platform"`), with no completion: the user submits with Enter or the button. A form submitted before hydration posts the text, checked by `pattern`.'
        }
      >
        <h4 id="without-javascript">Without JavaScript</h4>
        <p>
          The Slots never fill without script. A page that must work without it shows the plain
          input instead (the inline styles need <code>!important</code> to undo):
        </p>
        <CodeBlock language="css">{`@media (scripting: none) {
  .otp-slot { display: none; }
  .otp-input { position: static !important; color: inherit !important; caret-color: auto !important;
               border: 1px solid var(--line) !important; padding: .5rem !important; }
}`}</CodeBlock>
      </BehaviourSection>

      <h3 id="forms">Forms</h3>
      <ul>
        <li>
          The Input posts its text under <code>name</code>; a partial code posts as typed, and{" "}
          <code>pattern</code> blocks the submission (<code>patternMismatch</code>).{" "}
          <code>required</code> makes an empty one <code>valueMissing</code>.
        </li>
        <li>
          <strong>Form reset</strong> restores the reset target (the latest{" "}
          <code>defaultValue</code> uncontrolled, the mount-time value controlled) with{" "}
          <code>onValueChange</code> <code>"platform"</code>, and runs no completion.
        </li>
        <li>Enter submits the form natively.</li>
      </ul>

      <h3 id="recipes">Recipes</h3>
      <h4 id="auto-submit">Auto-submit inside a Form</h4>
      <Example file="OTPFieldAutoSubmit.tsx" css="otp-field.css">
        <OTPFieldAutoSubmit />
      </Example>
      <Callout kind="warning" title="Tell the user before the field (WCAG 3.2.2)">
        <p>
          <code>submitOnComplete</code> changes the context on input: the page submits while the
          user is still typing. Say so before or at the field ("It is submitted when complete"), and
          keep a submit button, for the path without JavaScript and for a user who wants to check
          the code first. A <code>completeAction</code> that navigates is the same change of context
          and needs the same notice.
        </p>
      </Callout>
      <ul>
        <li>
          Inside a <code>Field.Root</code> the Input is the Field's control, as{" "}
          <code>Field.Control</code> is: <code>Field.Label</code>'s <code>for</code> names it, the
          description and error describe it, its validity (<code>required</code>, the derived{" "}
          <code>pattern</code>, <code>validate</code>, server errors) is the input's own. There is
          no hidden input: the text shown is the value posted.
        </li>
        <li>
          The request is the form's here: <code>Form.Submit</code> and the Field parts show{" "}
          <code>data-pending</code>, a wrong code comes back in <code>errors</code> and is shown by{" "}
          <code>Field.Error</code> with focus on the Input, and the next keystroke dismisses it.{" "}
          <code>completeAction</code> is for a field with no form around it.
        </li>
        <li>
          The filter's write-back counts as an edit for the Field (it re-runs <code>validate</code>{" "}
          on the filtered text and dismisses a server error); a reset or a controlled change re-runs{" "}
          <code>validate</code> only.
        </li>
      </ul>

      <h4 id="webotp">WebOTP</h4>
      <p>
        <code>autocomplete="one-time-code"</code> is what iOS, Android keyboards and password
        managers key on, and it needs nothing from the library. WebOTP is the API form of the same
        thing for SMS: the page asks for the code of a message whose last line names its origin (
        <code>@example.com #123456</code>), the browser asks the user, and a promise resolves with
        the code. It is in Chromium and Safari, not in Firefox, so it is behind{" "}
        <code>experimental_webOTP</code>.
      </p>
      <ul>
        <li>
          With the flag on and <code>OTPCredential</code> present, the Input's mount requests a
          code. A resolved code of exactly <code>length</code> characters (after the filter) fills
          the field (<code>onValueChange</code> <code>"platform"</code>) and completes it (
          <code>completeAction</code> <code>"platform"</code>, <code>submitOnComplete</code>).
          Anything else, a refusal, and an abort are ignored.
        </li>
        <li>
          One request for the life of the Input. It is aborted at unmount, when the Input's form is
          submitted and when the user completes the code by hand; after a completion no new request
          starts and a late code is ignored.
        </li>
      </ul>
      <CodeBlock>{`// A Server Function as the check, straight from a Server Component:
<OTPField.Root length={6} completeAction={verifyCode} experimental_webOTP>…</OTPField.Root>`}</CodeBlock>
    </DocPage>
  );
}
