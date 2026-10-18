"use client";
import { startTransition, useState } from "react";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import { Slider } from "@funstack/ui/slider";
import { fakeSave } from "./fake-api.js";

// A two-thumb Slider as a Field's control. Field.Label names the group, both thumbs post under
// the Field's name, and `validate` reads them with `getAll`. The rule is checked at each release
// (a drag fires no native `input` / `change`; the Slider tells the Field itself), and a blocked
// Save focuses the first thumb.
export function SliderField() {
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <Form.Root
      className="demo-form"
      autoReset={false}
      action={async (formData) => {
        await fakeSave("the price range");
        startTransition(() => setSaved(formData.getAll("price").join(" – ")));
      }}
    >
      <Field.Root
        name="price"
        className="demo-fieldset"
        validate={(_value, formData) => {
          const [lo = 0, hi = 0] = formData.getAll("price").map(Number);
          return hi - lo > 200 ? "Narrow the range to $200 or less." : null;
        }}
      >
        <Field.Label className="demo-label">Price</Field.Label>
        <Slider.Root className="demo-slider" defaultValue={[100, 400]} max={500} step={10}>
          <Slider.Value>{({ values: [lo, hi] }) => `$${lo} – $${hi}`}</Slider.Value>
          <Slider.Track className="demo-slider-track">
            <Slider.Indicator className="demo-slider-fill" />
            <Slider.Thumb index={0} aria-label="Minimum price" className="demo-slider-thumb" />
            <Slider.Thumb index={1} aria-label="Maximum price" className="demo-slider-thumb" />
          </Slider.Track>
        </Slider.Root>
        <Field.Description className="demo-description">At most $200 apart.</Field.Description>
        <Field.Error className="demo-field-error" />
      </Field.Root>
      <div className="demo-row">
        <Form.Submit className="demo-button demo-primary demo-submit">
          {({ pending }) => (
            <>
              {pending && <span className="demo-spinner" aria-hidden />}
              Save
            </>
          )}
        </Form.Submit>
      </div>
      {saved !== null && <output className="demo-readout">Saved ${saved}.</output>}
    </Form.Root>
  );
}
