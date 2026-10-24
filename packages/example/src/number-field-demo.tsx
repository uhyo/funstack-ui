import { startTransition, useActionState, useState } from "react";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import type { FormErrors } from "@funstack/ui/form";
import { NumberField } from "@funstack/ui/number-field";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary";
import { fakeSave, sleep } from "./shared/fake-backend";
import "./number-field-demo.css";

function Stepper({ label }: { label: string }) {
  return (
    <>
      <NumberField.Label className="nf-label">{label}</NumberField.Label>
      <div className="nf-group">
        <NumberField.Decrement className="nf-step">−</NumberField.Decrement>
        <NumberField.Input className="nf-input" />
        <NumberField.Increment className="nf-step">+</NumberField.Increment>
      </div>
    </>
  );
}

/** A cart line: an update-on-success parent, so a failed save rolls the text back. */
function CartDemo() {
  const [fail, setFail] = useState(false);
  const [quantity, setQuantity] = useState<number | null>(1);
  return (
    <section>
      <h3>Cart quantity (update on success)</h3>
      <p>
        Type, use the arrow keys, or press and hold a button. The save runs once per gesture in{" "}
        <code>valueCommitAction</code>; with failures on, the text returns to the saved quantity.
      </p>
      <label>
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make
        the save fail
      </label>
      <NumberField.Root
        className="nf-root"
        locale="en-US"
        value={quantity}
        min={1}
        max={99}
        valueCommitAction={async (next) => {
          try {
            await fakeSave("quantity", next, { fail });
            startTransition(() => setQuantity(next));
          } catch (error) {
            console.warn(error);
          }
        }}
      >
        {({ pending }) => (
          <>
            <Stepper label="Quantity" />
            <span className="nf-status">{pending ? "Saving…" : `Saved: ${String(quantity)}`}</span>
          </>
        )}
      </NumberField.Root>
    </section>
  );
}

const locales = ["en-US", "de-DE", "fr-FR", "ar-EG"] as const;
const steppers: Record<(typeof locales)[number], [string, string]> = {
  "en-US": ["Increase", "Decrease"],
  "de-DE": ["Erhöhen", "Verringern"],
  "fr-FR": ["Augmenter", "Diminuer"],
  "ar-EG": ["زيادة", "إنقاص"],
};

/** A price in euros under a chosen locale, and a percentage. */
function FormatsDemo() {
  const [locale, setLocale] = useState<(typeof locales)[number]>("de-DE");
  const [price, setPrice] = useState<number | null>(12.5);
  const [increase, decrease] = steppers[locale];
  return (
    <section>
      <h3>Locales and formats</h3>
      <p>
        The text is formatted and parsed in the field's <code>locale</code>; the form posts a plain
        number. Strict grouping: <code>1,5</code> is 1.5 in German and not a number in English.
      </p>
      <label>
        Locale{" "}
        <select value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>
          {locales.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <DemoErrorBoundary className="nf-error">
        <NumberField.Root
          className="nf-root"
          locale={locale}
          format={{ style: "currency", currency: "EUR" }}
          value={price}
          min={0}
          step={0.5}
          valueChangeAction={(next) => {
            setPrice(next);
          }}
          valueCommitAction={(next) => fakeSave("price", next)}
        >
          <NumberField.Label className="nf-label">Price</NumberField.Label>
          <div className="nf-group">
            <NumberField.Decrement className="nf-step" aria-label={decrease}>
              −
            </NumberField.Decrement>
            <NumberField.Input className="nf-input" />
            <NumberField.Increment className="nf-step" aria-label={increase}>
              +
            </NumberField.Increment>
          </div>
        </NumberField.Root>
      </DemoErrorBoundary>
      <p>Value: {String(price)}</p>
      <NumberField.Root
        className="nf-root"
        locale={locale}
        format={{ style: "percent" }}
        defaultValue={0.25}
        min={0}
        max={1}
        stepOnWheel
      >
        <Stepper label="Discount (wheel enabled)" />
      </NumberField.Root>
    </section>
  );
}

interface FormState {
  readonly errors?: FormErrors;
  readonly saved?: string;
}

/** Native constraints with the browser's messages, a custom rule and a server error. */
function FormDemo() {
  const [state, formAction] = useActionState<FormState, FormData>(async (_prev, data) => {
    await sleep(600);
    const quantity = Number(data.get("quantity"));
    if (quantity > 48) return { errors: { quantity: `Only 48 left (you asked for ${quantity}).` } };
    return { saved: `Ordered ${quantity}.` };
  }, {});
  return (
    <section>
      <h3>In a Form, with a Field</h3>
      <p>
        Packs of six between 6 and 120. Typed values are not clamped: the hidden number input's own
        constraints report them; more than 48 fails on the server.
      </p>
      <Form.Root action={formAction} errors={state.errors} className="nf-form">
        <Field.Root name="quantity" className="nf-field">
          <Field.Label className="nf-label">Packs</Field.Label>
          <NumberField.Root
            className="nf-root"
            locale="en-US"
            min={6}
            max={120}
            step={6}
            defaultValue={6}
          >
            <div className="nf-group">
              <NumberField.Decrement className="nf-step">−</NumberField.Decrement>
              <NumberField.Input className="nf-input" />
              <NumberField.Increment className="nf-step">+</NumberField.Increment>
            </div>
          </NumberField.Root>
          <Field.Description>Sold in packs of six.</Field.Description>
          <Field.Error className="nf-field-error">
            {({ validity, messages }) =>
              validity.stepMismatch ? "Enter a multiple of six." : messages.join(" ")
            }
          </Field.Error>
        </Field.Root>
        <Form.Submit>Order</Form.Submit>
        {state.saved !== undefined && <p>{state.saved}</p>}
      </Form.Root>
    </section>
  );
}

export function NumberFieldDemo() {
  return (
    <section>
      <h2>NumberField</h2>
      <CartDemo />
      <FormatsDemo />
      <FormDemo />
    </section>
  );
}
