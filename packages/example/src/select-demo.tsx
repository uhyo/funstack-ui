import { Component, Suspense, startTransition, use, useState } from "react";
import type { ReactNode } from "react";
import { Select } from "@funstack/ui/select";
import "./select-demo.css";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Fake backend: resolves after 800 ms; rejects when asked to. */
async function fakeSave(label: string, value: unknown, { fail = false } = {}): Promise<void> {
  console.log(`[${label}] saving ${JSON.stringify(value)}`);
  await sleep(800);
  if (fail) throw new Error(`[${label}] the server rejected ${JSON.stringify(value)}`);
  console.log(`[${label}] saved ${JSON.stringify(value)}`);
}

class DemoErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="sl-error-box">
          <p>Error Boundary caught: {this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** A decorative swatch: an SVG with no text, so the option still reads as plain text. */
function Swatch({ color }: { color: string }) {
  return (
    <svg className="sl-swatch" viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="5" fill={color} />
    </svg>
  );
}

function FruitPicker() {
  const [saved, setSaved] = useState("");
  return (
    <section>
      <h3>Fruit picker, async save</h3>
      <p>
        Icons, a group with a rich <code>GroupLabel</code>, a separator and a disabled option. The
        pick shows at once; the select, its button and the option carry <code>data-pending</code>{" "}
        for 800 ms. In Firefox the same markup renders the native select (the button and its spinner
        are not rendered; <code>select[data-pending]</code> still styles the select).
      </p>
      <Select.Root
        className="sl-select"
        name="fruit"
        defaultValue=""
        required
        valueChangeAction={async (next) => {
          await fakeSave("fruit", next);
          startTransition(() => setSaved(next));
        }}
      >
        <Select.Trigger className="sl-trigger">
          {({ pending }) => (
            <>
              <Select.Value />
              {pending && <span className="sl-spinner" aria-hidden />}
            </>
          )}
        </Select.Trigger>
        <Select.Option value="" disabled>
          Choose a fruit
        </Select.Option>
        <Select.Group label="Citrus">
          <Select.GroupLabel>
            Citrus <em>fruits</em>
          </Select.GroupLabel>
          <Select.Option value="orange">
            <Swatch color="orange" /> Orange
          </Select.Option>
          <Select.Option value="lemon">
            <Swatch color="gold" /> Lemon
          </Select.Option>
        </Select.Group>
        <Select.Separator />
        <Select.Option value="apple" disabled>
          <Swatch color="crimson" /> Apple (out of season)
        </Select.Option>
        <Select.Option value="banana">
          <Swatch color="khaki" /> Banana
        </Select.Option>
      </Select.Root>
      <p>
        Saved: <output>{saved || "(nothing yet)"}</output>
      </p>
    </section>
  );
}

function RejectingDemo() {
  return (
    <section>
      <h3>Rejected save</h3>
      <p>
        Picking <em>Large</em> fails after 800 ms: the error reaches the boundary and the select
        rolls back.
      </p>
      <DemoErrorBoundary>
        <Select.Root
          className="sl-select"
          defaultValue="m"
          valueChangeAction={(next) => fakeSave("size", next, { fail: next === "l" })}
        >
          <Select.Trigger className="sl-trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Option value="s">Small</Select.Option>
          <Select.Option value="m">Medium</Select.Option>
          <Select.Option value="l">Large (fails)</Select.Option>
        </Select.Root>
      </DemoErrorBoundary>
    </section>
  );
}

const countriesPromise = sleep(1500).then(() => [
  { code: "jp", name: "Japan" },
  { code: "fr", name: "France" },
  { code: "br", name: "Brazil" },
]);

function CountryOptions() {
  return use(countriesPromise).map((c) => (
    <Select.Option key={c.code} value={c.code}>
      {c.name}
    </Select.Option>
  ));
}

function LateOptionsDemo() {
  const [country, setCountry] = useState("br");
  return (
    <section>
      <h3>Options load late</h3>
      <p>
        The options are behind a Suspense boundary inside the select (1.5 s). Until they arrive the
        disabled fallback shows nothing selected; on reveal the library selects <code>br</code>,
        which React alone would not do.
      </p>
      <Select.Root
        className="sl-select"
        value={country}
        valueChangeAction={(next) => {
          setCountry(next);
        }}
      >
        <Select.Trigger className="sl-trigger">
          <Select.Value />
        </Select.Trigger>
        <Suspense
          fallback={
            <Select.Option value="" disabled>
              Loading countries…
            </Select.Option>
          }
        >
          <CountryOptions />
        </Suspense>
      </Select.Root>
      <p>
        Value: <output>{country}</output>
      </p>
    </section>
  );
}

function ShippingDemo() {
  return (
    <section>
      <h3>Label changes while pending</h3>
      <p>
        The option's content is a function of its state: it reads <em>(saving…)</em> while its save
        is in flight. The button follows: <code>Select.Value</code> re-clones the selected option
        whenever its content changes.
      </p>
      <Select.Root
        className="sl-select"
        defaultValue="standard"
        valueChangeAction={(next) => fakeSave("shipping", next)}
      >
        <Select.Trigger className="sl-trigger">
          <Select.Value />
        </Select.Trigger>
        {["standard", "express"].map((v) => (
          <Select.Option key={v} value={v}>
            {({ pending }) => (
              <>
                {v === "standard" ? "Standard" : "Express"}
                {pending && " (saving…)"}
              </>
            )}
          </Select.Option>
        ))}
      </Select.Root>
    </section>
  );
}

export function SelectDemo() {
  return (
    <section>
      <h2>Select</h2>
      <p>
        A real <code>&lt;select&gt;</code>. The styled picker is opt-in CSS:{" "}
        <code>appearance: base-select</code> on the select and its <code>::picker(select)</code>{" "}
        (Chromium 135+, Safari 27). Firefox renders the native select from the same markup.
      </p>
      <FruitPicker />
      <RejectingDemo />
      <LateOptionsDemo />
      <ShippingDemo />
    </section>
  );
}
