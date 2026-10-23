import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { PageHead } from "../components/PageHead.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { SliderField } from "../examples/SliderField.js";
import sliderFieldSource from "../examples/SliderField.tsx?raw";
import { SliderPrice } from "../examples/SliderPrice.js";
import sliderPriceSource from "../examples/SliderPrice.tsx?raw";
import { SliderVolume } from "../examples/SliderVolume.js";
import sliderVolumeSource from "../examples/SliderVolume.tsx?raw";
import sliderCss from "../examples/slider.css?raw";
import { functionProps, renderProp } from "./shared-props.js";

export function SliderPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Slider"
        description="A slider on a visually hidden native <input type=range> per thumb: every step a transition, each gesture saved once with rollback, multi-thumb, vertical and RTL."
      />
      <h2>Slider</h2>
      <p className="page-intro">
        A slider (WAI-ARIA Slider and Slider (Multi-Thumb) patterns) and the library's first
        continuous control. Each thumb is a styleable element containing a visually hidden native{" "}
        <code>&lt;input type="range"&gt;</code>, so the role, the value and bounds, every key (RTL
        mirroring included), labels, forms and <code>disabled</code> are the platform's. The library
        adds the styleable thumb and track, pointer dragging, several thumbs that cannot cross, and
        the asynchronous half: a drag produces many <strong>steps</strong> and one{" "}
        <strong>commit</strong>.
      </p>

      <Example
        source={sliderVolumeSource}
        fileName="SliderVolume.tsx"
        css={sliderCss}
        cssFileName="slider.css"
      >
        <SliderVolume />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Slider } from "@funstack/ui/slider";

<Slider.Root name="volume" defaultValue={40} valueCommitAction={saveVolume}>  {/* div */}
  <Slider.Label>Volume</Slider.Label>      {/* label: for= the input (one thumb), id (several) */}
  <Slider.Value />                         {/* span: the shown value */}
  <Slider.Track>                           {/* div: owns the pointer */}
    <Slider.Indicator />                   {/* span: the fill */}
    <Slider.Thumb />                       {/* span + visually hidden input type=range */}
  </Slider.Track>
</Slider.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>One Thumb per value</strong>, chosen by an explicit <code>index</code> (default{" "}
          <code>0</code>). <code>value</code> / <code>defaultValue</code> is a number for one thumb
          or an array (ascending) for several; the shape is fixed at mount.
        </li>
        <li>
          <strong>Thumb renders two elements</strong>: the styled <code>span</code> (
          <code>ref</code>, <code>className</code>, <code>render</code>) and, inside it, the native
          input (<code>inputRef</code>), which is the focusable element with role{" "}
          <code>slider</code>. <code>aria-label</code>, <code>aria-labelledby</code>,{" "}
          <code>aria-describedby</code>, <code>name</code>, <code>form</code> and{" "}
          <code>autoFocus</code> are forwarded to the input.
        </li>
        <li>
          <strong>Several thumbs</strong> make the Root a <code>role="group"</code> named by the
          Label; each thumb needs its own name (<code>aria-label="Minimum price"</code>). A thumb's
          native <code>min</code> / <code>max</code> are its neighbours' values (plus{" "}
          <code>minStepsBetweenThumbs × step</code>), so thumbs cannot cross with the pointer, the
          keys or Home / End.
        </li>
        <li>
          <strong>Nothing is positioned by the library.</strong> It publishes{" "}
          <code>--slider-value</code> on each Thumb and <code>--slider-start</code>,{" "}
          <code>--slider-end</code>, <code>--slider-value-&lt;i&gt;</code> on the Root (inherited);
          your CSS places the fill and the thumbs (see <code>slider.css</code> above).
        </li>
        <li>
          The default value is the platform's: the midpoint, snapped to <code>step</code> (Base UI
          and Radix default to <code>min</code>).
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <h4>Two actions: steps and commits</h4>
      <p>
        A <strong>step</strong> is one value change; a <strong>commit</strong> here is the gesture's
        save through <code>valueCommitAction</code>, not React's{" "}
        <a href="/concepts/transitions#commit">render commit</a>.
      </p>
      <Table
        head={["", "valueChangeAction", "valueCommitAction"]}
        rows={[
          [
            "Called",
            'On every step: the press, each pointer move and the release position, each key press, a form reset, a value found at hydration, and the revert after a failed save (`reason: "dismiss"`, uncontrolled).',
            "Once per gesture: pointer release, each key press, a form reset, a value found at hydration.",
          ],
          [
            "Lane",
            "A transition of its own: a controlled parent's `setValue(next)` in the synchronous prefix renders interruptibly.",
            "The Root's commit transition, with `useOptimistic`.",
          ],
          [
            "Pending",
            "`data-pending` while a step is in flight (including the Suspense wait of what it renders). Without a `valueChangeAction` a step starts no transition and is never pending.",
            "`data-pending` on the Root and the moved thumb until the save settles.",
          ],
          [
            "Uncontrolled state",
            "Not written.",
            "Written when it resolves; reverts to the value before the gesture if it rejects.",
          ],
          [
            "Meant for",
            "Adopting the value in a controlled parent, a live preview, cheap synchronous work.",
            "Saving: a Server Function, a fetch, `requestSubmit()`.",
          ],
        ]}
      />
      <Callout title="The save goes in valueCommitAction">
        <p>
          A drag is dozens of steps, and an awaited action holds every transition in the app (
          <a href="/concepts/action-props#await-only">Action props</a>). Keep{" "}
          <code>valueChangeAction</code> cheap and put the network call in{" "}
          <code>valueCommitAction</code>, which runs once per gesture.
        </p>
      </Callout>
      <p>
        The thumb under the pointer is <strong>urgent</strong>: it moves in the same event, while a
        controlled parent's update and the save run in transitions. What the thumbs show is the
        value the gesture reached while a pointer is captured or anything is in flight, and the
        optimistic value otherwise, so the thumb never snaps back between two moves, and slides back
        only when a save fails or a controlled parent does not adopt the value.
      </p>

      <h3 id="props">Props</h3>
      <h4>
        <code>Slider.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "number | readonly number[]",
            description:
              "Controlled value: one number, or one per thumb in ascending order. undefined means uncontrolled.",
          },
          {
            name: "defaultValue",
            type: "number | readonly number[]",
            default: "midpoint",
            description:
              "Initial value in uncontrolled mode; also the form-reset target (the latest value). Default `min + (max - min) / 2`, snapped to `step`.",
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<T, SliderValueChangeDetails>",
            description:
              "Runs in the Root's step transition on every step. Awaited; `data-pending` meanwhile. Adopt the value here in a controlled parent. Not the place for a save.",
          },
          {
            name: "valueCommitAction",
            type: "ChangeAction<T, SliderValueCommitDetails>",
            description:
              "Runs in the Root's commit transition once per gesture. Awaited; the thumb keeps the gesture's value with `data-pending` until it settles. Uncontrolled, the value is committed when it resolves and reverts when it rejects. May be a Server Function.",
          },
          { name: "min", type: "number", default: "0", description: "Lower bound." },
          {
            name: "max",
            type: "number",
            default: "100",
            description:
              "Upper bound. A `max` off the step grid is unreachable, as on a native range (development warning).",
          },
          {
            name: "step",
            type: "number",
            default: "1",
            description: "Positive. Values snap to `min + n × step`.",
          },
          {
            name: "minStepsBetweenThumbs",
            type: "number",
            default: "0",
            description: "Minimum number of steps between two adjacent thumbs.",
          },
          {
            name: "orientation",
            type: '"horizontal" | "vertical"',
            default: '"horizontal"',
            description:
              "Vertical sliders have `min` at the bottom (the hidden inputs get `writing-mode: vertical-lr; direction: rtl`).",
          },
          {
            name: "getAriaValueText",
            type: "(value: number, index: number) => string",
            description:
              "`aria-valuetext` for each thumb, from the value it shows. For values whose number alone is not meaningful.",
          },
          {
            name: "name",
            type: "string",
            description:
              "Form field name for every thumb's input (a Thumb's own `name` wins). Several thumbs post several entries: read them with `FormData.getAll()`.",
          },
          {
            name: "form",
            type: "string",
            description: "The `form` attribute for every thumb's input.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Disables every input (not submitted) and the pointer.",
          },
          ...functionProps(
            "SliderRootState<T>",
            "The parts. The function form receives the shown value; must not suspend.",
          ),
          renderProp("div", "SliderRootState<T>"),
        ]}
      />
      <PartFacts
        state={
          "`SliderRootState<T>` is `{ value, values, pending, dragging, orientation, disabled, min, max, step }`; `T` is `number` or `readonly number[]`, inferred from `value` / `defaultValue`; `value` is the shown value and `values` the same as an array."
        }
        owned={
          '`role` (`"group"` with several thumbs), `aria-labelledby` (the Label\'s id while a Label is mounted and there are several thumbs; merged with yours), `data-pending`, `data-dragging`, `data-orientation`, `data-disabled`, and the `--slider-*` custom properties in `style` (your entries win).'
        }
        note={
          'Details are `{ reason, thumb, event }`: `reason` is `"activate"`, `"platform"` (a form reset, a value found at hydration) or `"dismiss"` (the revert after a failed save, steps only), and `thumb` the index that moved (`null` on platform paths and the revert). There is no `transition` prop on any part.'
        }
      />

      <h4>
        <code>Slider.Thumb</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "index",
            type: "number",
            default: "0",
            description: "Which value this thumb edits.",
          },
          {
            name: "name",
            type: "string",
            default: "the Root's",
            description: "This thumb input's form field name.",
          },
          {
            name: "form",
            type: "string",
            default: "the Root's",
            description: "This thumb input's `form` attribute.",
          },
          {
            name: "aria-label, aria-labelledby, aria-describedby",
            type: "string",
            description:
              "Forwarded to the input. Every thumb of a multi-thumb slider needs a name (development warning).",
          },
          {
            name: "inputRef",
            type: "Ref<HTMLInputElement>",
            description: 'The native `<input type="range">` inside the thumb.',
          },
          {
            name: "autoFocus",
            type: "boolean",
            description: "Forwarded to the input.",
          },
          ...functionProps(
            "SliderThumbState",
            "Rendered inside the styled element, next to the input (an icon, a value bubble).",
          ),
          renderProp("span", "SliderThumbState"),
        ]}
      />
      <PartFacts
        state={
          "`SliderThumbState` is `{ index, value, pending, dragging, orientation, disabled }`."
        }
        owned={
          "on the styled element: `onPointerDown`, `data-index`, `data-orientation`, `data-dragging`, `data-pending`, `data-disabled`, and `--slider-value` / `touch-action` in `style` (your entries win). On the input: every attribute (`type`, `min`, `max`, `step`, `value`, `aria-valuetext`, …) except `aria-label`, `aria-labelledby`, `aria-describedby`, `name`, `form` and `autoFocus`, which are yours."
        }
        note={"A `render` element never touches the input."}
      />

      <h4>
        <code>Slider.Track</code>, <code>Slider.Indicator</code>
      </h4>
      <PropsTable
        rows={[...functionProps("SliderTrackState"), renderProp("div / span", "SliderTrackState")]}
      />
      <PartFacts
        state={
          "`SliderTrackState` and `SliderIndicatorState` are `{ orientation, dragging, disabled }`."
        }
        owned={
          "Track: `onPointerDown`, `data-orientation`, `data-disabled`, and `touch-action` in `style` (your entry wins); Indicator: `data-orientation`, `data-disabled`."
        }
        note={
          "A press on the Track moves the nearest thumb, focuses its input and starts dragging it; its box is the reference for the pointer maths. When two thumbs share a value (stacked), the one that can move toward the pointer moves, whichever of them was pressed; a press exactly on the value lets the first move decide. The commit uses the release position. The Indicator renders no position: place it from `--slider-start` / `--slider-end`."
        }
      />

      <h4>
        <code>Slider.Label</code>
      </h4>
      <PropsTable
        rows={[...functionProps("SliderRootState"), renderProp("label", "SliderRootState")]}
      />
      <PartFacts
        state={"`SliderRootState`."}
        owned={"`id`, `htmlFor`."}
        note={
          "The Label must stay a `<label>` with one thumb (it names the input through `for`); with several thumbs the Root is named by the Label's id. Its state is not tied to the Root's value type: `value` is typed `number | readonly number[]`; narrow it with `<Slider.Label<number>>` or read `values`."
        }
      />

      <h4>
        <code>Slider.Value</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "index",
            type: "number",
            description:
              "Show one thumb's value. Without it a single-thumb slider shows its value; several thumbs need `children`.",
          },
          ...functionProps("SliderValueState"),
          renderProp("span", "SliderValueState"),
        ]}
      />
      <PartFacts
        state={"`SliderValueState` is the Root's state plus `index`."}
        owned={"none."}
        note={
          "The Value is a plain `span`, not `<output>`: a live region that updates on every step would chatter, and the slider already exposes its value. Narrow `value` with `<Slider.Value<number>>` or read `values`."
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          [
            "`data-pending`",
            "Root",
            "A step (with a `valueChangeAction`) or commit is in flight. Even a synchronous step action makes each pointer move a short pending render; for a spinner use `[data-pending]:not([data-dragging])`.",
          ],
          ["`data-pending`", "Thumb", "The Root is pending and this is the thumb that moved."],
          ["`data-dragging`", "Root, Thumb", "A pointer is captured (on this thumb)."],
          ["`data-orientation`", "every part", "`horizontal` or `vertical`."],
          ["`data-disabled`", "every part", "The Root's `disabled`."],
          ["`data-index`", "Thumb", "`0`, `1`, …"],
          ["`:focus-visible`", "the input", "Style the thumb with `.thumb:has(:focus-visible)`."],
        ]}
      />
      <CodeBlock language="css">{`.thumb { inset-inline-start: var(--slider-value); translate: -50% -50%; }
.thumb:has(:focus-visible) { outline: 2px solid var(--focus); }
/* Animate keyboard steps and rollbacks, never the pointer: */
@property --slider-value { syntax: "<percentage>"; inherits: false; initial-value: 0%; }
.thumb { transition: --slider-value 120ms ease-out; }
[data-dragging] .thumb { transition: none; }`}</CodeBlock>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <p>
        Every key is the browser's, except ArrowLeft / ArrowRight on vertical and on RTL sliders,
        which the library normalises.
      </p>
      <Table
        head={["Key", "Horizontal", "Vertical"]}
        rows={[
          [
            "ArrowRight / ArrowUp",
            "+ step (Right is − step under RTL: by the library)",
            "+ step (Right: by the library)",
          ],
          [
            "ArrowLeft / ArrowDown",
            "− step (Left is + step under RTL: by the library)",
            "− step (Left: by the library)",
          ],
          ["PageUp / PageDown", "± 10 % of the range", "same"],
          ["Home / End", "the thumb's min / max (its neighbour with several thumbs)", "same"],
          ["Tab / Shift+Tab", "between thumbs", "same"],
        ]}
      />
      <ul>
        <li>
          Each key press is one step and one commit. Firefox decreases a vertical range on
          ArrowRight; the library handles ArrowLeft / ArrowRight on vertical sliders so every engine
          follows the APG (Right increases). Under RTL (the input's computed <code>direction</code>)
          the track is mirrored, so ArrowLeft increases; Chromium and Firefox mirror a native range,
          Safari does not, so the library handles these two keys there as well. Left-to-right
          horizontal keys stay native.
        </li>
        <li>
          No <code>aria-valuemin</code>, <code>aria-valuemax</code>, <code>aria-valuenow</code> or{" "}
          <code>aria-orientation</code>: the native <code>min</code>, <code>max</code>, value and
          writing mode provide them (Chromium even lets the ARIA ones override the real values).
        </li>
        <li>
          A pointer press focuses the input without a focus ring, as on a native range; the page
          still scrolls along the other axis (<code>touch-action</code>).
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "A step: `fsui-slider` plus `fsui-slider-change`. A gesture's save (`valueCommitAction`): `fsui-slider` plus `fsui-slider-commit`. No part takes a `transition` prop; use the types in your own boundaries."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "The thumb under the pointer is urgent. The thumbs show the value the gesture reached while a pointer is captured or anything is in flight, and the optimistic value otherwise. `data-pending` is on the Root while a step (with a `valueChangeAction`) or commit is in flight, and on the thumb that moved."
        }
      />

      <BehaviourSection
        id="suspense"
        summary={"A step's pending state includes the Suspense wait of what it renders."}
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'Native range inputs: keyboard changes and a form reset are the browser\'s; a reset is dispatched as one step and one commit with `reason: "platform"`.'
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'The inputs are focusable and the keys change them; the visible thumb catches up at hydration, with one `"platform"` step and commit. The pointer does nothing yet. For a slider that needs no JavaScript, see [Plain HTML](#plain-html).'
        }
      >
        <h4 id="plain-html">Plain HTML</h4>
        <p>
          A native range input is the JS-free slider. A Server Component can render it with no
          library code, and it works before hydration and without it, pointer included:
        </p>
        <CodeBlock>{`// A Server Component: no import from @funstack/ui.
<label>
  Volume
  <input type="range" name="volume" min={0} max={100} step={1} defaultValue={settings.volume} />
</label>`}</CodeBlock>
        <p>
          Compared with <code>Slider</code>, it has one thumb and no Track, Range, Thumb or Value
          parts: its track and thumb are styled only through engine-specific pseudo-elements (
          <code>::-webkit-slider-thumb</code>, <code>::-moz-range-thumb</code>, ...), and only
          Firefox has one for the filled range (<code>::-moz-range-progress</code>). It also has no{" "}
          <code>valueChangeAction</code> / <code>valueCommitAction</code> (no transition per step,
          no single save per gesture with rollback, no <code>data-pending</code>), no{" "}
          <code>data-dragging</code>, other data attributes or <code>--slider-value</code>, no
          library handling of vertical and RTL arrow keys, and no{" "}
          <a href="#inside-a-field">Field</a> integration.
        </p>
      </BehaviourSection>

      <h3 id="forms">Forms</h3>
      <ul>
        <li>
          Each thumb posts its value: <code>volume=73</code>, or{" "}
          <code>price=100&amp;price=300</code> with one Root <code>name</code>. A range has no
          native constraint and nothing is <code>required</code>; a Field's <code>validate</code>{" "}
          can make it invalid (<a href="#inside-a-field">Inside a Field</a>).
        </li>
        <li>
          <strong>Form reset</strong> works although react-dom keeps a controlled input's{" "}
          <code>value</code> attribute equal to its current value: the library writes the reset
          target into each input's <code>defaultValue</code> during the <code>reset</code> event,
          then dispatches one step and one commit with <code>reason: "platform"</code>.
          Uncontrolled, the target is the latest <code>defaultValue</code>; controlled, the
          mount-time value is offered to the parent.
        </li>
        <li>
          <strong>Before hydration</strong> the inputs are focusable and the keys change them (the
          visible thumb catches up at hydration, with one <code>"platform"</code> step and commit);
          the pointer does nothing yet. For a slider that needs no JavaScript at all, see{" "}
          <a href="#plain-html">Plain HTML</a>.
        </li>
        <li>
          Pointer gestures fire no native <code>input</code> / <code>change</code> events, so a{" "}
          <code>&lt;form onChange&gt;</code> listener sees keyboard changes only, and not ArrowLeft
          / ArrowRight on vertical or RTL sliders (handled from the <code>keydown</code>).
        </li>
      </ul>
      <CodeBlock>{`// Submit on release:
<Slider.Root name="brightness" valueCommitAction={() => formRef.current?.requestSubmit()}>…</Slider.Root>

// A Server Function as the save, straight from a Server Component:
<Slider.Root defaultValue={settings.volume} valueCommitAction={saveVolume}>…</Slider.Root>`}</CodeBlock>

      <h3 id="recipes">Recipes</h3>
      <h4>A live filter</h4>
      <Example
        source={sliderPriceSource}
        fileName="SliderPrice.tsx"
        css={sliderCss}
        cssFileName="slider.css"
      >
        <SliderPrice />
      </Example>

      <h4 id="inside-a-field">Inside a Field</h4>
      <Example
        source={sliderFieldSource}
        fileName="SliderField.tsx"
        css={sliderCss}
        cssFileName="slider.css"
      >
        <SliderField />
      </Example>
      <ul>
        <li>
          A Slider inside a <code>Field.Root</code> is the Field's control with no new prop.{" "}
          <strong>One thumb</strong>: its input takes the Field's control id, so{" "}
          <code>Field.Label</code>'s <code>for</code> names it, and the Field's description and
          error describe it. <strong>Several thumbs</strong>: the Root (<code>role="group"</code>)
          is named by <code>Field.Label</code> through <code>aria-labelledby</code> and described by
          the Field; each thumb still needs its own <code>aria-label</code>.
        </li>
        <li>
          <code>name</code> and <code>disabled</code> default from the Field. <code>validate</code>
          's <code>value</code> is the first thumb's; read every thumb with{" "}
          <code>formData.getAll(name)</code>. <code>Field.Root required</code> has no effect (a
          range is never empty) and logs a development warning.
        </li>
        <li>
          An error sets <code>aria-invalid="true"</code> on every thumb's input (never on the group)
          and <code>data-invalid</code> on the Root and every Thumb. The message lives in the first
          thumb's custom validity, so a blocked submission focuses the first thumb.
        </li>
        <li>
          A drag and the library-handled keys fire no native events, so the Slider tells the Field
          at each <strong>commit</strong> (the release, or the key press): <code>validate</code>{" "}
          re-runs and a shown server error is dismissed, as typing would. A rolled-back save or a
          form reset re-runs <code>validate</code> but does not dismiss a server error.
        </li>
        <li>
          The <a href="/concepts/action-props#form-channel">two channels</a> stay separate: the
          Slider's own save is its <code>data-pending</code>, the form's submission is the Field's.
        </li>
      </ul>
    </div>
  );
}
