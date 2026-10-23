import { CodeBlock } from "../components/CodeBlock.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { PageHead } from "../components/PageHead.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { MeterStorage } from "../examples/MeterStorage.js";
import meterStorageSource from "../examples/MeterStorage.tsx?raw";
import { MeterStrength } from "../examples/MeterStrength.js";
import meterStrengthSource from "../examples/MeterStrength.tsx?raw";
import meterCss from "../examples/meter.css?raw";
import { functionProps, renderProp } from "./shared-props.js";

export function MeterPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Meter"
        description="A gauge on div[role=meter] with the platform's low / high / optimum regions, localised aria-valuetext, and a Root that is itself a Server Component."
      />
      <h2>Meter</h2>
      <p className="page-intro">
        A scalar measurement within a known range (WAI-ARIA <code>meter</code>): storage used, a
        password's strength, a battery. Output-only and directive-free like{" "}
        <a href="/components/progress">Progress</a>, which documents the shared parts, the
        formatting and the Server Component story. What Meter adds is the platform's{" "}
        <strong>regions</strong>: <code>low</code>, <code>high</code> and <code>optimum</code>{" "}
        decide whether the value is good, not so good, or bad.
      </p>

      <Example
        source={meterStorageSource}
        fileName="MeterStorage.tsx"
        css={meterCss}
        cssFileName="meter.css"
      >
        <MeterStorage />
      </Example>
      <p>
        This example is a Server Component (no <code>"use client"</code>), and so is{" "}
        <code>Meter.Root</code>: the region, the text and the <code>getAriaValueText</code> function
        all ran on the server.
      </p>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Meter } from "@funstack/ui/meter";

<Meter.Root value={used} max={quota} low={quota * 0.7} high={quota * 0.9} optimum={0}
            format={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }}>
  <Meter.Label>Storage</Meter.Label>
  <Meter.Value>{({ formattedValue, max }) => \`\${formattedValue} of \${max} GB\`}</Meter.Value>
  <Meter.Track>
    <Meter.Indicator />
  </Meter.Track>
</Meter.Root>`}</CodeBlock>
      <p>
        <code>value</code> is <strong>required</strong>: a meter is never indeterminate. A
        non-finite value warns in development and renders as <code>min</code>. The parts are the
        same as Progress's (<code>div</code> rail, <code>span</code> fill, <code>span[id]</code>{" "}
        label, <code>span[aria-hidden]</code> value), with <code>data-region</code> instead of{" "}
        <code>data-indeterminate</code> / <code>data-complete</code>. From a Server Component, pass
        functions to the Root only: the parts are client components, so format a part's content in
        the Root's <code>children(state)</code>, as the storage example does (see{" "}
        <a href="/components/progress">Progress, Server Components</a>).
      </p>

      <h3 id="how-it-works">How it works</h3>
      <h4>Regions</h4>
      <p>
        HTML's defaults and clamping, in order: <code>low</code> (default <code>min</code>) is
        clamped to <code>[min, max]</code>, <code>high</code> (default <code>max</code>) to{" "}
        <code>[low, max]</code>, <code>optimum</code> (default the midpoint) to{" "}
        <code>[min, max]</code>. With the defaults every value is <code>optimum</code>.
      </p>
      <Table
        head={["Where optimum is", "value", "data-region"]}
        rows={[
          ["`optimum < low` (lower is better)", "`value <= low`", "`optimum`"],
          ["", "`low < value <= high`", "`suboptimum`"],
          ["", "`high < value`", "`even-less-good`"],
          ["`high < optimum` (higher is better)", "`high <= value`", "`optimum`"],
          ["", "`low <= value < high`", "`suboptimum`"],
          ["", "`value < low`", "`even-less-good`"],
          ["`low <= optimum <= high` (the middle is best)", "`low <= value <= high`", "`optimum`"],
          ["", "otherwise", "`suboptimum` (never `even-less-good`)"],
        ]}
      />
      <p>
        The names and the boundaries are Chromium's (<code>::-webkit-meter-optimum-value</code> and
        friends). Firefox's native <code>&lt;meter&gt;</code> differs on two boundaries: a value
        exactly at <code>low</code> when lower is better, or exactly at <code>high</code> when
        higher is better, is <code>suboptimum</code> there. The words are yours: nothing in the
        default <code>aria-valuetext</code> names the region, so add them with{" "}
        <code>getAriaValueText</code> as the storage example does ("4.6 GB, almost full").
      </p>

      <h3 id="props">Props</h3>
      <h4>
        <code>Meter.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "number",
            description: "Required. Clamped to `[min, max]`.",
          },
          { name: "min", type: "number", default: "0", description: "The start of the range." },
          {
            name: "max",
            type: "number",
            default: "100",
            description:
              "The end of the range (the platform's default is 1). `max <= min` warns in development and renders 0%.",
          },
          {
            name: "low",
            type: "number",
            default: "min",
            description:
              "Upper bound of the low part of the range. A non-finite number counts as absent (the default applies).",
          },
          {
            name: "high",
            type: "number",
            default: "max",
            description:
              "Lower bound of the high part of the range. A non-finite number counts as absent (the default applies).",
          },
          {
            name: "optimum",
            type: "number",
            default: "(min + max) / 2",
            description:
              "The best value; decides which part of the range is `optimum`. A non-finite number counts as absent (the default applies).",
          },
          {
            name: "format",
            type: "Intl.NumberFormatOptions",
            default: '{ style: "percent" }',
            description:
              "As on [Progress](/components/progress): the percent style formats the fraction, any other style the value.",
          },
          {
            name: "locale",
            type: "string",
            default: "the runtime's",
            description: "BCP 47 tag for `Intl.NumberFormat`.",
          },
          {
            name: "getAriaValueText",
            type: "(value: number, state: MeterState) => string | null | undefined",
            description:
              "The `aria-valuetext` to render instead of `formattedValue`; `null` or `undefined` renders none.",
          },
          ...functionProps("MeterState"),
          renderProp("div", "MeterState"),
        ]}
      />
      <PartFacts
        state={"`MeterState`, shared by every part; its fields are listed under State below."}
        owned={
          "`role`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` (always), `aria-valuetext` (unless `getAriaValueText` returns `null` or `undefined`), `aria-labelledby` (your tokens, then the Label's id, always), `data-region`, and the `--meter-*` custom properties in `style` (your entries win)."
        }
      />
      <h4>
        <code>Meter.Track</code>, <code>Meter.Indicator</code>, <code>Meter.Label</code>,{" "}
        <code>Meter.Value</code>
      </h4>
      <p>
        As on Progress, with <code>MeterState</code>. <code>Meter.Value</code> shows{" "}
        <code>formattedValue</code> by default and is <code>aria-hidden</code> unless you pass{" "}
        <code>aria-hidden={"{false}"}</code>.
      </p>
      <PropsTable rows={[...functionProps("MeterState"), renderProp("div | span", "MeterState")]} />
      <PartFacts
        state={"`MeterState`."}
        owned={
          '`data-region` on each; the Label also `id` (the Root always references it). `aria-hidden="true"` on the Value is a default, not owned.'
        }
      />

      <h4>State</h4>
      <Table
        head={["Field", "Type", "Meaning"]}
        rows={[
          ["`value`", "`number`", "Clamped to `[min, max]`."],
          ["`min`, `max`", "`number`", "The range."],
          ["`low`, `high`, `optimum`", "`number`", "After the defaults and clamping."],
          ["`percentage`", "`number`", "0 to 100."],
          ["`formattedValue`", "`string`", "The `Intl.NumberFormat` text."],
          ["`valueText`", "`string | null`", "What `aria-valuetext` carries."],
          ["`region`", '`"optimum" | "suboptimum" | "even-less-good"`', "See Regions."],
        ]}
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Name", "On", "Meaning"]}
        rows={[
          ["`data-region`", "every part", "`optimum`, `suboptimum` or `even-less-good`."],
          ["`--meter-value`", "Root (inherited)", "The percentage."],
          [
            "`--meter-low`, `--meter-high`, `--meter-optimum`",
            "Root (inherited)",
            "The clamped boundaries as percentages, for drawing the zones.",
          ],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <p>
        Screen-reader support for the <code>meter</code> role is older and less even than for{" "}
        <code>progressbar</code>, so the Root always renders <code>aria-valuenow</code> and{" "}
        <code>aria-valuetext</code>, and a meter must always have a name (a <code>Meter.Label</code>{" "}
        or <code>aria-label</code>). Updates are not announced.
      </p>

      <BehaviourSection
        id="transition-types"
        summary={"None: values change in your own lane, and no part takes a `transition` prop."}
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={"None: a Meter displays a value; it has no optimistic or pending state."}
      />

      <BehaviourSection
        id="suspense"
        summary={"Nothing specific: the Meter renders no content region."}
      />

      <BehaviourSection id="browser-owned-state" summary={"None."} />

      <BehaviourSection
        id="before-hydration"
        summary={
          "Everything: there is no behaviour. The HTML carries the role, the values, `aria-valuetext`, the data attributes and the custom property, and your CSS draws the bar from the first paint. The Root is itself a Server Component."
        }
      />

      <h3 id="recipes">Recipes</h3>
      <h4>Next to a Field's control</h4>
      <p>
        A Meter is not a form control and does not register with a Field. Put it next to the control
        with its own <code>Meter.Label</code>, and describe the control with the meter's text by
        giving <code>Meter.Value</code> an <code>id</code> and adding it to the control's{" "}
        <code>aria-describedby</code>. A <code>Field.Root</code> whose only content is a Meter is
        not supported: use a plain element with the Meter's own label.
      </p>
      <Example
        source={meterStrengthSource}
        fileName="MeterStrength.tsx"
        css={meterCss}
        cssFileName="meter.css"
      >
        <MeterStrength />
      </Example>
    </div>
  );
}
