import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { TextFieldNotes } from "../examples/TextFieldNotes.js";
import { TextFieldRename } from "../examples/TextFieldRename.js";
import { renderProp, stylingProps } from "./shared-props.js";

export function TextFieldPage() {
  return (
    <DocPage
      title="TextField"
      description="A text field that saves itself: one input (or textarea) whose typed text is a draft, committed on blur, Enter (an input) or Ctrl+Enter / Cmd+Enter (a textarea) through valueCommitAction with data-pending, rolled back when the save is refused, and put back by Escape."
    >
      <p className="page-intro">
        A text field that <strong>saves itself</strong>. The user types freely; when they are done
        (they leave the field, or press Enter; Ctrl+Enter or Cmd+Enter in a textarea) the field asks
        for the new text through <code>valueCommitAction</code>, shows <code>data-pending</code>{" "}
        while the save runs, and goes back to the saved text if the save is refused. Escape puts the
        saved text back. It is one <code>&lt;input&gt;</code>, or a <code>&lt;textarea&gt;</code>{" "}
        through <code>render</code>.
      </p>
      <p>
        It is not the library's text input: a text control with no save of its own is the native
        element, or <a href="/components/field">Field.Control</a> inside a Field.
      </p>

      <Example file="TextFieldRename.tsx" css="text-field.css">
        <TextFieldRename />
      </Example>

      <Callout kind="note" title="A refused save rolls the text back">
        <p>
          When <code>valueCommitAction</code> rejects, or a controlled parent does not adopt the
          text, the field shows the saved text again. For a title that costs a few characters; for a
          paragraph it costs the paragraph. Choose in the action: do not adopt and say why (roll
          back, above), or adopt and say it is not saved (keep the text,{" "}
          <a href="#keep-the-text">below</a>).
        </p>
      </Callout>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { TextField } from "@funstack/ui/text-field";

// A document title: saved on blur or Enter, back to the saved title if the save throws.
<TextField aria-label="Title" defaultValue={doc.title} valueCommitAction={renameDocument} />

// Notes, several lines: saved when the user leaves the field, or presses Ctrl+Enter / Cmd+Enter.
<TextField render={<textarea rows={4} />} aria-label="Notes" defaultValue={notes} valueCommitAction={saveNotes} />

// In a Field: the label, the description and validation are the Field's.
<Field.Root name="displayName" required>
  <Field.Label>Display name</Field.Label>
  <TextField defaultValue={user.displayName} valueCommitAction={saveDisplayName} maxLength={40} />
  <Field.Error />
</Field.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>One element.</strong> No Root, no Label, no read view: the input is always there,
          styled to read as text until it is used (<a href="#styling">Styling</a>). Name it with a{" "}
          <code>&lt;label for&gt;</code>, <code>Field.Label</code> or <code>aria-label</code>.
        </li>
        <li>
          <strong>Supported elements</strong>: an <code>&lt;input&gt;</code> of type{" "}
          <code>text</code> (the default), <code>tel</code>, <code>url</code>, <code>email</code> or{" "}
          <code>password</code>, or a <code>&lt;textarea&gt;</code>. Any other type, as a prop or on
          the <code>render</code> element, logs a development warning and is rendered as given.
        </li>
      </ul>
      <Callout kind="warning" title='type="search" is not supported'>
        <p>
          In a search field Escape is the browser's own key: it empties the field, and that clear
          already keeps an enclosing dialog or popover open. It cannot be turned off while leaving
          Escape to the dialog, so a search field would give Escape two meanings ("empty the field"
          and "back to the saved text"). TextField keeps one Escape rule instead. For a search box
          that saves itself, use <code>type="text"</code> with <code>role="searchbox"</code> (the
          role <code>type="search"</code> gives) and <code>enterKeyHint="search"</code> for the
          on-screen keyboard:
        </p>
        <CodeBlock>{`<TextField type="text" role="searchbox" enterKeyHint="search" aria-label="Saved search" … />`}</CodeBlock>
        <p>
          The browser's clear button is not carried over: render a button next to the field if you
          want one. A search box with no save of its own that wants the browser's Escape is a native{" "}
          <code>&lt;input type="search"&gt;</code> or <code>Field.Control</code>.
        </p>
      </Callout>

      <h3 id="how-it-works">How it works</h3>
      <h4>Draft and commit</h4>
      <Table
        head={["", "What happens"]}
        rows={[
          [
            "Typing",
            "Each `input` event (typing, paste, autofill, an IME) writes the draft. Shown at once; nothing is dispatched. The caret, selection and undo are the browser's.",
          ],
          [
            "Blur, the commit key",
            "The commit: the draft is cleared and `valueCommitAction(next, { reason: \"activate\" })` runs in the field's transition, with `data-pending`. The commit key is Enter in an `<input>`: not prevented, so a form's implicit submission follows with the same text. In a `<textarea>` it is Ctrl+Enter or Cmd+Enter (either, on every platform): always prevented, so no line is added, and it submits no form. Enter alone or with Shift is a new line there; Alt+Enter is not the field's key (the browser decides). An Enter that confirms an IME composition commits nothing.",
          ],
          [
            "No change",
            "A draft equal to the shown value (typed and deleted again) commits nothing. `disabled` and `readOnly` clear the draft and commit nothing.",
          ],
          [
            "Escape",
            "With an edited draft: the saved (or pending) text shows again, nothing is dispatched, and the key is consumed, so an enclosing Dialog or Popover stays open. The next Escape is not the field's.",
          ],
        ]}
      />
      <ul>
        <li>
          The commit does not look at validity: text that fails <code>required</code> or{" "}
          <code>pattern</code> is committed like any other. An action that must not save such text
          checks it.
        </li>
        <li>
          A controlled <code>value</code> that changes from outside shows at once when no draft is
          open; while one is open the draft wins, and Escape then shows the new value.
        </li>
        <li>Nothing commits at unmount: an open draft is dropped.</li>
        <li>
          The text is committed as typed: no trimming. A parent that normalises adopts the
          normalised text.
        </li>
      </ul>

      <h4>A save that fails</h4>
      <ul>
        <li>
          Uncontrolled, the value is written when the action resolves. A rejection reaches the Error
          Boundary above the field, and the text goes back. An action that catches its own failure
          resolves, so the new text stays: that is how to keep it without a parent.
        </li>
        <li>
          Controlled, a parent that does not adopt gets the saved text back once the action has
          settled. After an <code>await</code>, wrap the update in <code>startTransition</code>.
        </li>
        <li>
          A draft the user opened while the save ran stays on screen; it commits at their next blur
          or commit key.
        </li>
        <li>
          A second commit while the first runs replaces it (latest wins); <code>data-pending</code>{" "}
          stays until both settled. An action that must not be overtaken on the wire aborts or
          sequences itself. Return without awaiting (<code>{"(next) => { void save(next); }"}</code>
          ) for a save nothing should wait for.
        </li>
      </ul>

      <h3 id="props">Props</h3>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description: "The saved text, controlled. `undefined` is uncontrolled.",
          },
          {
            name: "defaultValue",
            type: "string",
            default: '""',
            description: "Initial saved text in uncontrolled mode; also the form-reset target.",
          },
          {
            name: "valueCommitAction",
            type: "ChangeAction<string, TextFieldValueChangeDetails>",
            description:
              "Once per edit (blur, Enter in an input, Ctrl+Enter or Cmd+Enter in a textarea), and for a form reset or text adopted at mount. Runs in the field's transition and is awaited, with `data-pending`. Uncontrolled state is committed when it resolves. May be a Server Function.",
          },
          {
            name: "name",
            type: "string",
            description: "Native `name`: the form posts the text shown. Or the Field's.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Native `disabled`; also when the enclosing Field is disabled.",
          },
          {
            name: "readOnly",
            type: "boolean",
            default: "false",
            description: "Native `readonly`: no editing, nothing commits.",
          },
          {
            name: "required",
            type: "boolean",
            default: "false",
            description: "Native `required`; also when the enclosing Field is required.",
          },
          {
            name: "type",
            type: "string",
            default: '"text" on the default element',
            description:
              '`text`, `tel`, `url`, `email` or `password`. Others warn in development (`search` is not supported: use `type="text"` with `role="searchbox"` and `enterKeyHint="search"`). The library sets `type="text"` only on its default `<input>`: a `render` element keeps its own `type` (a `<textarea>` gets none, an `<input>` without one is a text input).',
          },
          {
            name: "placeholder, maxLength, minLength, pattern, autoComplete, inputMode, enterKeyHint, spellCheck, form, id, aria-*",
            type: "native attributes",
            description:
              'Passed through, with no library default (no `autocomplete="off"`: a name or an address may be offered by autofill). Inside a Field the `id` is the Field\'s.',
          },
          ...stylingProps("TextFieldState"),
          renderProp("input", "TextFieldState"),
        ]}
      />
      <PartFacts
        state={
          "`TextFieldState` is `{ value, text, pending, disabled, readOnly, required }`: `value` is the shown value (optimistic), `text` the shown text (the draft while the user is editing, else `value`), `pending` a `valueCommitAction` in flight."
        }
        owned={
          "`value` (the shown text), `onChange`, `onKeyDown`, `onBlur` (not in the props type; `onInput`, `onFocus`, `onKeyUp` and the rest pass through), `data-pending`, `data-disabled`; inside a Field also `id`, `name`, `disabled`, `required`, `aria-invalid`, `aria-describedby` (token-merged) and `data-invalid`."
        }
        note={
          '`TextFieldValueChangeDetails` is `{ reason, event }`: `"activate"` for a commit (`event` is the `focusout` or the `keydown` of the commit key), `"platform"` for a form reset (the `reset` event) and text adopted at mount (`undefined`). Serialisable: a Server Function receives `{ reason }`.'
        }
      />

      <h3 id="styling">Data attributes and styling</h3>
      <Table
        head={["Hook", "Meaning"]}
        rows={[
          ["`data-pending`", "A commit is in flight (including the Suspense wait of its render)."],
          ["`data-disabled`", "The `disabled` prop, or the Field's."],
          ["`data-invalid`", "Inside a Field that shows an error; never outside one."],
          [
            "`:focus`, `:read-only`, `:placeholder-shown`, `:user-invalid`",
            "The platform's own states: being edited, read-only, empty, invalid after an edit.",
          ],
        ]}
      />
      <CodeBlock language="css">{`/* Reads as text until it is used; as wide as its content. */
.title { field-sizing: content; min-inline-size: 4ch; border: 1px solid transparent; font: inherit; }
.title:hover, .title:focus-visible { border-color: var(--border); }
.title:not(:focus) { text-overflow: ellipsis; }
.title[data-pending] { color: var(--muted); }
/* A spinner next to it: an input has no pseudo-elements, so the wrapper draws it. */
.cell:has(.title[data-pending])::after { content: ""; /* spinner */ }`}</CodeBlock>
      <p>
        Keep a visible affordance when you remove the border: a hover and focus style at least. A
        field that looks exactly like text is not discoverable.
      </p>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Input", "Effect"]}
        rows={[
          ["Tab", "Reaches the field; leaving it commits."],
          [
            "Enter (an input)",
            "Commits. Not prevented: inside a form the implicit submission follows.",
          ],
          [
            "Ctrl+Enter, Cmd+Enter (a textarea)",
            "Commits, as a blur does. Always prevented, even when there is nothing to commit, so no line is added; focus and the caret stay. Submits no form.",
          ],
          ["Enter, Shift+Enter (a textarea)", "A new line. Nothing is committed."],
          [
            "Alt+Enter (a textarea)",
            "Not the field's key: the browser decides (it inserts nothing in current engines). Nothing is committed.",
          ],
          [
            "Escape",
            "With an edited draft: reverts it and is consumed. Otherwise not handled (an enclosing dialog closes).",
          ],
          ["Everything else", "Native text editing."],
        ]}
      />
      <ul>
        <li>
          Nothing on a textarea says that Ctrl+Enter saves, and the library adds no text. Blur saves
          as well, so the key is a shortcut; a page that relies on it says so in visible text the
          field's <code>aria-describedby</code> names.
        </li>
        <li>
          A native <code>textbox</code> with its label and value, always present and always in the
          Tab order. There is no read view that turns into an input, so focus never moves and there
          is no built-in string.
        </li>
        <li>
          Pending is visual only (<code>data-pending</code>): no <code>aria-busy</code>, no native{" "}
          <code>disabled</code>, no announcement. The field stays editable while a save runs.
        </li>
        <li>
          A revert or a rollback writes the input, so the browser's undo history for the field is
          gone after it (all three engines).
        </li>
      </ul>
      <h4 id="telling-the-user">Telling the user about a save</h4>
      <p>The library says nothing by itself; what the user is told is your element.</p>
      <ul>
        <li>
          <strong>Saved.</strong> If the page shows a "Saved" mark, make it a status message (
          <code>role="status"</code>) or a toast. If nothing is shown, nothing is announced.
        </li>
        <li>
          <strong>Failed, rolled back.</strong> The text changes while the user is somewhere else,
          so a message is required: a toast, or text in an element the field's{" "}
          <code>aria-describedby</code> names, with <code>role="alert"</code> (the first example).
        </li>
        <li>
          <strong>Failed, text kept.</strong> A "Not saved" text with <code>role="status"</code>,
          named by the field's <code>aria-describedby</code> so it is read again when the user
          returns (the example below).
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "Each commit adds `fsui-text-field` and `fsui-text-field-commit`; a rollback carries none. No `transition` prop and no built-in `<ViewTransition>`: key your own boundary around content the saved text drives (a heading)."
        }
      >
        <CodeBlock language="css">{`::view-transition-old(.doc-title):active-view-transition-type(fsui-text-field-commit) { animation: fade-out .15s; }`}</CodeBlock>
      </BehaviourSection>

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "The draft is urgent library state written from the `input` event. At the commit the shown value becomes the new text optimistically, so the characters on screen do not change and the caret stays. `data-pending` until the save (and the render it caused) settles; the field is never disabled meanwhile."
        }
      />

      <BehaviourSection
        id="suspense"
        summary={
          "Content the saved value drives re-renders in the commit's transition; if it suspends, what is shown stays and the field keeps `data-pending` until it is ready. The field's own function props must not suspend."
        }
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          "Focus, selection, composition and validity are the browser's. A form reset (a reset button, `form.reset()`, React's reset after a form action, `Form.Root`'s `autoReset`) clears an open draft and offers the reset target through `valueCommitAction` with `reason: \"platform\"` and the `reset` event, unless it is what the field already shows. An action that saves checks `details.reason` if a reset must not be saved."
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          "The server HTML is the input with its value. Text typed before hydration is adopted at mount: still focused, it becomes the draft and the user's blur or commit key commits it; otherwise it is one `\"platform\"` commit with no event (a browser's form-state restoration after a reload takes the same path). **Nothing is saved without JavaScript.** The JS-free way to save one text is a form, which Enter submits natively."
        }
      >
        <CodeBlock>{`<form action={rename}><input name="title" defaultValue={title} /></form>`}</CodeBlock>
      </BehaviourSection>

      <h3 id="forms">Forms and Field</h3>
      <ul>
        <li>
          One element: it carries <code>name</code>, the constraints and the text the form posts,
          which is the draft while one is open. A form submitted by a button while the field is
          focused posts what the user sees.
        </li>
        <li>
          Enter inside a form dispatches the commit first, then the implicit submission runs the
          form's action with the same text. The two are independent channels:{" "}
          <code>data-pending</code> on the field for its save, on <code>Form.Submit</code> and the
          Field parts for the submission.
        </li>
        <li>
          Inside a <code>Field.Root</code> the field is the Field's control, as{" "}
          <code>Field.Control</code> is: <code>Field.Label</code>'s <code>for</code> names it, the
          description and error describe it, <code>validate</code> sees the text per keystroke, and
          a server error is dismissed by the first keystroke. An Escape revert and a rollback re-run{" "}
          <code>validate</code>.
        </li>
        <li>
          A textarea submits nothing, with any key: its Ctrl+Enter / Cmd+Enter only commits (
          <a href="#submit-from-a-textarea">below</a>).
        </li>
        <li>
          "Submit when the user is done with this field" is{" "}
          <code>{"valueCommitAction={() => formRef.current?.requestSubmit()}"}</code>.
        </li>
      </ul>
      <h4 id="submit-from-a-textarea">Submit a form from a textarea</h4>
      <p>
        A form that wants Ctrl+Enter / Cmd+Enter to submit says so once, on the form, for every
        textarea in it (a TextField or not). The handler runs after the field's, as the event
        bubbles, so a TextField has dispatched its commit first, the order an input's Enter has. Do
        not skip a prevented event: the field prevents its key. An <code>&lt;input&gt;</code> needs
        nothing, it has the native submission.
      </p>
      <CodeBlock>{`<Form.Root
  action={post}
  onKeyDown={(event) => {
    const { isComposing, keyCode } = event.nativeEvent;
    if (!(event.target instanceof HTMLTextAreaElement) || isComposing || keyCode === 229) return;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) event.currentTarget.requestSubmit();
  }}
>`}</CodeBlock>

      <h3 id="recipes">Recipes</h3>
      <h4 id="roll-back">Roll back and say why</h4>
      <CodeBlock>{`<TextField
  value={title}
  aria-describedby="title-error"
  valueCommitAction={async (next) => {
    const result = await rename(id, next);
    if (result.ok) startTransition(() => setTitle(next));   // after an await: re-wrap
    else startTransition(() => setError(result.message));   // not adopted: the old title returns
  }}
/>
<p id="title-error" role="alert">{error}</p>`}</CodeBlock>
      <h4 id="keep-the-text">Keep the text and say it is not saved</h4>
      <Example file="TextFieldNotes.tsx" css="text-field.css">
        <TextFieldNotes />
      </Example>
      <CodeBlock>{`<TextField
  value={notes}
  render={<textarea rows={4} />}
  aria-describedby="notes-status"
  valueCommitAction={async (next) => {
    const result = await saveNotes(id, next);
    startTransition(() => { setNotes(next); setUnsaved(!result.ok); });
  }}
/>
<p id="notes-status" role="status">{unsaved ? "Not saved." : ""}</p>
{unsaved && <Button action={() => retry(notes)}>Try again</Button>}`}</CodeBlock>
    </DocPage>
  );
}
