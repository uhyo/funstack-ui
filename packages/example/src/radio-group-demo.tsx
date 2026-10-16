import { Component, startTransition, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { RadioGroup } from "@funstack/ui/radio-group";
import "./radio-group-demo.css";

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
        <div role="alert" className="rg-error-box">
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

const themes = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

function Options({ options }: { options: readonly { id: string; label: string }[] }) {
  return options.map((o) => (
    <label key={o.id} className="rg-option">
      <RadioGroup.Item value={o.id} className="rg-radio" />
      {o.label}
      <span className="rg-spinner" aria-hidden />
    </label>
  ));
}

function AutosaveDemo() {
  return (
    <section>
      <h3>Uncontrolled, async save</h3>
      <p>
        The clicked radio checks at once (its DOM <code>checked</code> is the optimistic value) and
        carries <code>data-pending</code> for 800 ms; the row shows a spinner through{" "}
        <code>.option:has([data-pending])</code> and the legend through the Label&apos;s function
        children. Arrow keys are native: each press checks and saves; the latest press wins.
      </p>
      <RadioGroup.Root
        className="rg-group"
        defaultValue="system"
        valueChangeAction={(next) => fakeSave("theme", next)}
      >
        <RadioGroup.Label>
          {({ pending }) => <>Theme {pending && <small>(saving...)</small>}</>}
        </RadioGroup.Label>
        <Options options={themes} />
      </RadioGroup.Root>
    </section>
  );
}

function RejectingDemo() {
  return (
    <section>
      <h3>Rejecting action inside an Error Boundary</h3>
      <p>Every save rejects after 800 ms; the boundary around the group shows the error.</p>
      <DemoErrorBoundary>
        <RadioGroup.Root
          className="rg-group"
          defaultValue="light"
          valueChangeAction={(next) => fakeSave("rejecting", next, { fail: true })}
        >
          <RadioGroup.Label>Theme (always fails)</RadioGroup.Label>
          <Options options={themes} />
        </RadioGroup.Root>
      </DemoErrorBoundary>
    </section>
  );
}

const plans = [
  { id: "free", label: "Free" },
  { id: "pro", label: "Pro" },
  { id: "team", label: "Team" },
];

function ControlledVetoDemo() {
  const [plan, setPlan] = useState<string | null>("free");
  const [error, setError] = useState<string | null>(null);
  const saves = useRef(0);
  return (
    <section>
      <h3>Controlled, update on success (veto)</h3>
      <p>
        The parent adopts the value only when the save succeeds. Every second save fails and is
        caught inside the action: the radio the user picked is checked while pending, then the group
        rolls back to the parent&apos;s radio (focus stays where the user left it).
      </p>
      <RadioGroup.Root
        className="rg-group"
        value={plan}
        valueChangeAction={async (next) => {
          setError(null);
          const fail = ++saves.current % 2 === 0;
          try {
            await fakeSave("plan", next, { fail });
            startTransition(() => setPlan(next));
          } catch (e) {
            startTransition(() => setError(e instanceof Error ? e.message : String(e)));
          }
        }}
      >
        <RadioGroup.Label>Plan</RadioGroup.Label>
        <Options options={plans} />
      </RadioGroup.Root>
      <output className="rg-readout">
        parent state: <code>{String(plan)}</code>
        {error && <span className="rg-inline-error"> {error}</span>}
      </output>
    </section>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save"}
    </button>
  );
}

const sizes = [
  { id: "s", label: "Small" },
  { id: "m", label: "Medium" },
  { id: "l", label: "Large" },
  { id: "xl", label: "Extra large (sold out)" },
];

function FormDemo() {
  const [saved, setSaved] = useState("(nothing yet)");
  const [savedSize, setSavedSize] = useState<string | null>(null);
  return (
    <section>
      <h3>
        Native form with <code>name</code> and <code>&lt;form action&gt;</code>
      </h3>
      <p>
        No change action: the radios post <code>size=…</code> with the form, and{" "}
        <code>required</code> blocks submission until one is checked (<code>:user-invalid</code>{" "}
        after the attempt). After the action succeeds React resets the form; the saved size becomes
        the new <code>defaultValue</code>, so the reset returns to it. The reset button empties the
        group back to the latest default (nothing, before the first save).
      </p>
      <form
        className="rg-stack"
        action={async (formData) => {
          await fakeSave("form", [...formData]);
          const size = formData.get("size");
          startTransition(() => {
            setSavedSize(typeof size === "string" ? size : null);
            setSaved(JSON.stringify([...formData]));
          });
        }}
      >
        <RadioGroup.Root className="rg-group" name="size" required defaultValue={savedSize}>
          <RadioGroup.Label>T-shirt size</RadioGroup.Label>
          {sizes.map((s) => (
            <label key={s.id} className="rg-option">
              <RadioGroup.Item value={s.id} className="rg-radio" disabled={s.id === "xl"} />
              {s.label}
            </label>
          ))}
        </RadioGroup.Root>
        <div className="rg-buttons">
          <SubmitButton />
          <button type="reset">Reset</button>
        </div>
      </form>
      <output className="rg-readout">
        last submitted: <code>{saved}</code>
      </output>
    </section>
  );
}

const directions = [
  { id: "right", label: "يمين (right)" },
  { id: "center", label: "وسط (center)" },
  { id: "left", label: "يسار (left)" },
];

function RtlDemo() {
  const [value, setValue] = useState<string | null>("right");
  return (
    <section>
      <h3>Right-to-left</h3>
      <p>
        Inside <code>dir="rtl"</code> the browser mirrors <kbd>ArrowLeft</kbd> /{" "}
        <kbd>ArrowRight</kbd> natively: <kbd>ArrowLeft</kbd> moves to the next radio (visually
        leftwards). The library adds no keyboard code.
      </p>
      <div dir="rtl">
        <RadioGroup.Root
          className="rg-group rg-inline"
          value={value}
          valueChangeAction={(next) => {
            setValue(next);
          }}
        >
          <RadioGroup.Label>المحاذاة (alignment)</RadioGroup.Label>
          <Options options={directions} />
        </RadioGroup.Root>
      </div>
      <output className="rg-readout">
        value: <code>{String(value)}</code>
      </output>
    </section>
  );
}

export function RadioGroupDemo() {
  return (
    <article className="demo">
      <h2>RadioGroup</h2>
      <AutosaveDemo />
      <RejectingDemo />
      <ControlledVetoDemo />
      <FormDemo />
      <RtlDemo />
    </article>
  );
}
