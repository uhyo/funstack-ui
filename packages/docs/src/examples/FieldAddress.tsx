"use client";
import { useState } from "react";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import { NumberField } from "@funstack/ui/number-field";
import { fakeSave } from "./fake-api.js";

// A native <fieldset> captions a set of Fields and disables all of them: every FUNSTACK control
// has a native element, so `disabled` on the fieldset reaches each one (and the NumberField's
// buttons ignore the pointer too). The library's `data-disabled` does not see an inherited
// `disabled`, so the CSS selects `:disabled` instead. The fieldset is never disabled because a
// submission is pending: that would drop focus. The notes are a textarea that grows with its
// content (`field-sizing: content`).
export function FieldAddress() {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <Form.Root
      className="demo-form"
      autoReset={false}
      action={async (formData) => {
        await fakeSave("the address");
        setSaved(`${String(formData.get("street"))}, ${String(formData.get("city"))}`);
        setEditing(false);
      }}
    >
      <label className="demo-field">
        <input type="checkbox" checked={editing} onChange={(e) => setEditing(e.target.checked)} />{" "}
        Edit the address
      </label>
      <fieldset className="demo-address" disabled={!editing} aria-describedby="address-hint">
        <legend className="demo-label">Shipping address</legend>
        <p id="address-hint" className="demo-description">
          Used for this order only.
        </p>
        <Field.Root name="street" required className="demo-fieldset">
          <Field.Label className="demo-label">Street</Field.Label>
          <Field.Control
            className="demo-input"
            autoComplete="address-line1"
            defaultValue="1 Main St"
          />
          <Field.Error className="demo-field-error" />
        </Field.Root>
        <Field.Root name="city" required className="demo-fieldset">
          <Field.Label className="demo-label">City</Field.Label>
          <Field.Control
            className="demo-input"
            autoComplete="address-level2"
            defaultValue="Springfield"
          />
          <Field.Error className="demo-field-error" />
        </Field.Root>
        <Field.Root name="floor" className="demo-fieldset">
          <Field.Label className="demo-label">Floor</Field.Label>
          <NumberField.Root
            defaultValue={1}
            min={0}
            max={99}
            locale="en-US"
            className="demo-number-field"
          >
            <div className="demo-number-group">
              <NumberField.Decrement className="demo-number-step">−</NumberField.Decrement>
              <NumberField.Input className="demo-number-input" />
              <NumberField.Increment className="demo-number-step">+</NumberField.Increment>
            </div>
          </NumberField.Root>
        </Field.Root>
        <Field.Root name="notes" className="demo-fieldset">
          <Field.Label className="demo-label">Delivery notes</Field.Label>
          <Field.Control
            render={<textarea rows={1} maxLength={500} />}
            className="demo-input demo-grow"
          />
          <Field.Description className="demo-description">
            Grows as you type (<code>field-sizing: content</code>).
          </Field.Description>
        </Field.Root>
        <div className="demo-row">
          <Form.Submit className="demo-button demo-primary demo-submit">Save address</Form.Submit>
        </div>
      </fieldset>
      {saved !== null && <output className="demo-readout">Saved {saved}.</output>}
    </Form.Root>
  );
}
