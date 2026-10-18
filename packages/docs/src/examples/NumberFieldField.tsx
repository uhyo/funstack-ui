"use client";
import { startTransition, useState } from "react";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import { NumberField } from "@funstack/ui/number-field";
import { fakeSave } from "./fake-api.js";

// A NumberField as a Field's control. `min`, `max` and `step` are native constraints on the hidden
// number input: a typed 7 is kept as typed and reported (`validity.stepMismatch`), not snapped.
// The browser's message is mirrored onto the visible input, so `:user-invalid`, the blocked
// submission and the focus move all land there. A + press snaps to the grid and clears it.
export function NumberFieldField() {
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <Form.Root
      className="demo-form"
      autoReset={false}
      action={async (formData) => {
        await fakeSave("the order");
        startTransition(() => setSaved(String(formData.get("quantity"))));
      }}
    >
      <Field.Root name="quantity" className="demo-fieldset">
        <Field.Label className="demo-label">Quantity</Field.Label>
        <NumberField.Root
          className="demo-number-field"
          locale="en-US"
          min={6}
          max={120}
          step={6}
          defaultValue={6}
        >
          <div className="demo-number-group">
            <NumberField.Decrement className="demo-number-step">−</NumberField.Decrement>
            <NumberField.Input className="demo-number-input" />
            <NumberField.Increment className="demo-number-step">+</NumberField.Increment>
          </div>
        </NumberField.Root>
        <Field.Description className="demo-description">
          Sold in packs of six, up to 120.
        </Field.Description>
        <Field.Error className="demo-field-error">
          {({ validity, messages }) =>
            validity.stepMismatch ? "Enter a multiple of six." : messages.join(" ")
          }
        </Field.Error>
      </Field.Root>
      <div className="demo-row">
        <Form.Submit className="demo-button demo-primary demo-submit">
          {({ pending }) => (
            <>
              {pending && <span className="demo-spinner" aria-hidden />}
              Order
            </>
          )}
        </Form.Submit>
      </div>
      {saved !== null && <output className="demo-readout">Ordered {saved}.</output>}
    </Form.Root>
  );
}
