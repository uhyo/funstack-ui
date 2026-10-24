import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { PageHead } from "../components/PageHead.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { ProgressForm } from "../examples/ProgressForm.js";
import { ProgressJobs } from "../examples/ProgressJobs.js";
import { ProgressUpload } from "../examples/ProgressUpload.js";
import { functionProps, renderProp } from "./shared-props.js";

const partProps = (element: string) => [
  ...functionProps("ProgressState"),
  renderProp(element, "ProgressState"),
];

export function ProgressPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Progress"
        description="A progress bar on div[role=progressbar]: the display of someone else's action, correct in every lane, localised aria-valuetext, and a Root that is itself a Server Component."
      />
      <h2>Progress</h2>
      <p className="page-intro">
        A progress bar (WAI-ARIA <code>progressbar</code>) and the library's first{" "}
        <strong>output-only</strong> component: nothing is pressed or typed, so there is no action,
        no pending state and no optimistic state. A Progress is the display of{" "}
        <em>someone else's</em> action. It has no behaviour JavaScript: <code>Progress.Root</code>{" "}
        has no <code>"use client"</code>, so a Server Component renders it on the server (the small
        client parts still ship; see <a href="#server-components">Server Components</a>).
      </p>

      <Example file="ProgressUpload.tsx" css="progress.css">
        <ProgressUpload />
      </Example>

      <Callout kind="warning" title="Report progress with a plain setState, not startTransition">
        <p>
          Every other page tells you to wrap updates in <code>startTransition</code>. A value that
          reports on a <strong>pending action</strong> is the exception: React holds every
          transition update made while an async action is pending until that action settles, so a
          wrapped progress update sits at 0% and jumps to 100% when the upload ends. A{" "}
          <code>setState</code> after an <code>await</code> inside the action is urgent already, so
          the natural code is the right code:
        </p>
        <CodeBlock>{`startUpload(async () => {
  for await (const sent of upload(file)) setSent(sent);                       // renders at once
  // for await (const sent of upload(file)) startTransition(() => setSent(sent)); // held: 0% … 100%
});`}</CodeBlock>
        <p>
          A <code>setState</code> in the action's synchronous prefix (before the first{" "}
          <code>await</code>) is a transition update and is held too. Set a meaningful starting
          value (a resumed upload's offset) before calling the action, or let it land with the first
          chunk. <code>useOptimistic</code> is not a workaround: the value is not optimistic.
        </p>
      </Callout>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Progress } from "@funstack/ui/progress";

<Progress.Root value={uploaded} max={file.size} format={{ style: "unit", unit: "megabyte" }}>
  <Progress.Label>Uploading {file.name}</Progress.Label>  {/* span[id]; the Root references it */}
  <Progress.Value />                                    {/* span[aria-hidden]: "3.2 MB" */}
  <Progress.Track>                                      {/* div: the rail */}
    <Progress.Indicator />                              {/* span: the fill, sized by your CSS */}
  </Progress.Track>
</Progress.Root>

// A spinner: indeterminate (no value), named by aria-label, no parts needed.
<Progress.Root aria-label="Loading messages" className="spinner" />`}</CodeBlock>
      <ul>
        <li>
          <strong>Not the native element.</strong> <code>&lt;progress&gt;</code> renders no
          children, its fill is a vendor pseudo-element that Firefox cannot transition, and its
          indeterminate look differs per engine. The Root is a <code>div</code> with{" "}
          <code>role="progressbar"</code>, which assistive technology treats exactly like the native
          element.
        </li>
        <li>
          <strong>
            <code>value</code> is optional.
          </strong>{" "}
          Absent or <code>null</code> means indeterminate: no <code>aria-valuenow</code>, no{" "}
          <code>aria-valuetext</code>, <code>data-indeterminate</code>, and no{" "}
          <code>--progress-value</code>. Switching to a number is an ordinary re-render:{" "}
          <code>value={"{total === null ? null : done}"}</code>.
        </li>
        <li>
          <code>max</code> defaults to <strong>100</strong> (the platform's is 1). The value is
          clamped to <code>[min, max]</code> like the platform clamps it.
        </li>
        <li>
          <strong>Nothing is positioned by the library.</strong> The Root publishes{" "}
          <code>--progress-value</code> (a percentage, inherited); your CSS decides whether the fill
          is a width, a <code>scale</code>, a <code>conic-gradient</code> or an SVG stroke (see{" "}
          <code>progress.css</code> above).
        </li>
      </ul>

      <h3 id="props">Props</h3>
      <h4>
        <code>Progress.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "number | null",
            default: "null",
            description:
              "The current value, clamped to `[min, max]`. Absent or `null`: indeterminate. A non-finite number warns in development and renders as indeterminate.",
          },
          { name: "min", type: "number", default: "0", description: "The start of the range." },
          {
            name: "max",
            type: "number",
            default: "100",
            description:
              "The end of the range (the platform's default is 1). `max <= min` warns in development and renders 0%, never complete.",
          },
          {
            name: "format",
            type: "Intl.NumberFormatOptions",
            default: '{ style: "percent" }',
            description:
              'Formats `aria-valuetext` and `Progress.Value`. A `percent` style formats the **fraction** of the range; any other style formats the **value** (`{ style: "unit", unit: "megabyte" }` → "3.2 MB"). Serialisable: a Server Component may pass it.',
          },
          {
            name: "locale",
            type: "string",
            default: "the runtime's",
            description:
              "BCP 47 tag for `Intl.NumberFormat`. Pass it when a client component is server-rendered, so the server's and the browser's text agree at hydration. Under React Server Components the Root runs once and there is nothing to mismatch.",
          },
          {
            name: "getAriaValueText",
            type: "(value: number | null, state: ProgressState) => string | null | undefined",
            description:
              "The `aria-valuetext` to render instead of `formattedValue`. Called with the clamped value (`null` while indeterminate) and the state as it would be without this prop; `null` or `undefined` renders no attribute. From a Server Component it works when that Server Component renders the Root.",
          },
          ...functionProps("ProgressState"),
          renderProp("div", "ProgressState"),
        ]}
      />
      <PartFacts
        state={"`ProgressState`, shared by every part; its fields are listed under State below."}
        owned={
          "`role`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`, `aria-labelledby` (your tokens first, then the Label's id), `data-indeterminate`, `data-complete`, and `--progress-value` in `style` (your entries win)."
        }
        note={"Everything else passes through to the `div`."}
      />
      <h4>
        <code>Progress.Track</code>, <code>Progress.Indicator</code>, <code>Progress.Label</code>
      </h4>
      <p>
        A <code>div</code>, a <code>span</code> and a <code>span</code>, with the state's data
        attributes. None has a role or an inline size. The Label's <code>id</code> is owned: the
        Root always references it.
      </p>
      <PropsTable rows={partProps("div | span")} />
      <PartFacts
        state={"`ProgressState`."}
        owned={
          "`data-indeterminate` and `data-complete` on each; the Label also `id` (the Root always references it)."
        }
      />
      <h4>
        <code>Progress.Value</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps(
            "ProgressState",
            "Default: `state.formattedValue` (nothing while indeterminate), or a function of the state.",
          ),
          renderProp("span", "ProgressState"),
          {
            name: "aria-hidden",
            type: "boolean",
            default: "true",
            description:
              "Hidden by default because the same text is in the Root's `aria-valuetext`. Pass `false` when you render something the attribute does not say.",
          },
        ]}
      />
      <PartFacts
        state={"`ProgressState`."}
        owned={
          '`data-indeterminate`, `data-complete`. `aria-hidden="true"` is a default, not owned.'
        }
      />

      <h4>State</h4>
      <Table
        head={["Field", "Type", "Meaning"]}
        rows={[
          [
            "`value`",
            "`number | null`",
            "The value clamped to `[min, max]`; `null` while indeterminate.",
          ],
          ["`min`, `max`", "`number`", "The range."],
          ["`percentage`", "`number | null`", "0 to 100; `null` while indeterminate."],
          [
            "`formattedValue`",
            "`string | null`",
            "The `Intl.NumberFormat` text (what `Progress.Value` shows).",
          ],
          ["`valueText`", "`string | null`", "What `aria-valuetext` carries."],
          ["`indeterminate`", "`boolean`", "`value` is `null`."],
          ["`complete`", "`boolean`", "The clamped value reached `max`."],
        ]}
      />
      <p>Every part receives the same state object.</p>

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Name", "On", "Meaning"]}
        rows={[
          ["`data-indeterminate`", "every part", "`value` is `null`."],
          ["`data-complete`", "every part", "The clamped value reached `max`."],
          [
            "`--progress-value`",
            "Root (inherited)",
            "The percentage, `0%` to `100%`; absent while indeterminate, so a registered `@property` falls back to its `initial-value`.",
          ],
        ]}
      />
      <p>
        "In progress" is <code>:not([data-indeterminate]):not([data-complete])</code>. Register{" "}
        <code>--progress-value</code> with <code>@property</code> (<code>inherits: true</code>) and
        transition it on the Root: the variable itself animates in every engine, which the native
        fill cannot do in Firefox. The recipes in <code>progress.css</code> include a{" "}
        <code>prefers-reduced-motion</code> block with a static indeterminate rendering.
      </p>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <h4>Labelling</h4>
      <p>
        A progressbar needs an accessible name. Render a <code>Progress.Label</code>, or pass{" "}
        <code>aria-label</code> / <code>aria-labelledby</code> to the Root. The Root{" "}
        <strong>always</strong> references the Label's id; with no Label rendered the reference
        dangles, and the accessible-name computation skips it and uses your <code>aria-label</code>.
        (That is what lets the Root be a Server Component: it cannot know whether a Label is
        rendered. For the same reason it cannot warn about a missing name.) The Label is a{" "}
        <code>span</code>: the Root is not a labelable element, so a <code>&lt;label for&gt;</code>{" "}
        would associate nothing.
      </p>
      <p>
        <strong>Inside a Field</strong>, a Progress is not a form control and does not register with
        the Field: it sits next to the Field's control with its own name. See{" "}
        <a href="/components/meter">Meter</a> for the password-strength pattern.
      </p>

      <h4>What assistive technology hears</h4>
      <ul>
        <li>The upload above: "Uploading report.pdf, progress bar, 3.2 megabytes".</li>
        <li>
          Indeterminate: the name, the role and "busy" or "indeterminate" (the screen reader's own
          word for a progress bar with no value). No English default text is added; pass{" "}
          <code>getAriaValueText={'{(v) => v === null ? "Connecting" : null}'}</code> for words.
        </li>
        <li>
          Updates are <strong>not announced</strong>: a progressbar is not a live region. Report
          completion with a toast or a live-region message from the action's last line.
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "None: values change in your own lane, usually urgently, and no part takes a `transition` prop."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={"None: a Progress displays a value; it has no optimistic or pending state."}
      />

      <BehaviourSection id="suspense" summary={"A Progress works as a Suspense fallback."} />

      <BehaviourSection id="browser-owned-state" summary={"None."} />

      <BehaviourSection
        id="before-hydration"
        summary={
          "Everything: there is no behaviour. The HTML carries the role, the values, `aria-valuetext`, the data attributes and the custom property, and your CSS draws the bar from the first paint. The Root is itself a Server Component."
        }
      >
        <h4 id="server-components">Server Components</h4>
        <p>
          <code>Progress.Root</code> has no <code>"use client"</code>: it uses only{" "}
          <code>useId</code>, arithmetic and <code>Intl</code>, and renders a context provider
          created in a client module. <code>Progress.Track</code>, <code>Indicator</code>,{" "}
          <code>Label</code> and <code>Value</code> read that context and are client modules. A
          Server Component may render all of them, and may pass <code>getAriaValueText</code>,{" "}
          <code>children(state)</code> and <code>render</code> functions to the Root, but not to the
          parts (they are client components: format a part's content in the Root's{" "}
          <code>children(state)</code> instead). Rendered from a client component, the Root is an
          ordinary component; under SSR of that client tree pass <code>locale</code>.
        </p>
        <p>
          There is no behaviour to hydrate: the server HTML carries the role, the values, the text,
          the data attributes and the custom property, and your CSS draws the bar and its animation
          from the first paint. A Progress also works as a Suspense fallback.
        </p>

        <h4>From a Server Component</h4>
        <p>
          This example has no <code>"use client"</code>. <code>Progress.Root</code> has none either,
          so it ran on the server, once: the <code>getAriaValueText</code> function was passed from
          a Server Component (it never crosses to the browser), <code>Intl</code> formatted the
          numbers where the data is, and the arithmetic is not in the client bundle. The parts read
          the Root through a context, so they are small client modules; which of them reach the
          browser depends on how your bundler emits client references.
        </p>
        <Example file="ProgressJobs.tsx" css="progress.css">
          <ProgressJobs />
        </Example>
      </BehaviourSection>

      <h3 id="recipes">Recipes</h3>
      <h4>Busy while a form submits</h4>
      <p>
        An indeterminate bar from <code>Form.Root</code>'s <code>children(state)</code>. The
        progressbar never sets <code>aria-busy</code>: the region being replaced does, and points at
        the bar with <code>aria-describedby</code> (the APG's advice). Progress does not read the
        form status by itself, so a Progress inside a form is not tied to it by accident.
      </p>
      <Example file="ProgressForm.tsx" css="progress.css">
        <ProgressForm />
      </Example>

      <h3 id="browser-notes">Browser notes</h3>
      <h4>Not in this version</h4>
      <ul>
        <li>
          A <code>transition</code> prop: values change in your lane, usually urgently, and the fill
          animates with CSS. Wrap the swap of a finished bar in your own{" "}
          <code>&lt;ViewTransition&gt;</code> if you want one.
        </li>
        <li>
          Circular parts (use <code>conic-gradient</code> from the same variable, or SVG through{" "}
          <code>render</code>), a native <code>&lt;progress&gt;</code> mode, <code>data-value</code>{" "}
          attributes, and Field registration.
        </li>
      </ul>
    </div>
  );
}
