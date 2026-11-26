import { useState } from "react";
import { Field } from "@funstack/ui/field";
import { NumberField } from "@funstack/ui/number-field";
import { Separator } from "@funstack/ui/separator";
import { Slider } from "@funstack/ui/slider";
import { Demo } from "./shared/Demo.js";
import "./separator-demo.css";

/** Separator: semantic between sections, decorative and vertical between breadcrumb links. */
function Lines() {
  return (
    <section>
      <h3>Separator</h3>
      <nav aria-label="Breadcrumb" className="sp-crumbs">
        <a href="#top">Home</a>
        <Separator orientation="vertical" decorative className="sp-line" />
        <a href="#top">Playground</a>
        <Separator orientation="vertical" decorative className="sp-line" />
        <span aria-current="page">Separator</span>
      </nav>
      <p>Above the line: a section of content.</p>
      <Separator className="sp-line" />
      <p>
        Below it: the next section. The horizontal line is an <code>&lt;hr&gt;</code> a screen
        reader announces; the breadcrumb's are <code>role="none"</code>.
      </p>
    </section>
  );
}

/**
 * A native fieldset around Fields (no Fieldset part). Disabling it disables every native control
 * inside; the Slider's Track and NumberField's buttons also ignore the pointer (#180), although
 * their `data-disabled` stays the props'.
 */
function Fieldset() {
  const [disabled, setDisabled] = useState(true);
  return (
    <section>
      <h3>Fields in a native fieldset</h3>
      <label>
        <input type="checkbox" checked={disabled} onChange={(e) => setDisabled(e.target.checked)} />{" "}
        Disable the fieldset
      </label>
      <fieldset className="sp-fieldset" disabled={disabled}>
        <legend>Delivery</legend>
        <Field.Root name="name" className="sp-field">
          <Field.Label>Recipient</Field.Label>
          <Field.Control className="sp-input" defaultValue="Ada" />
        </Field.Root>
        <Field.Root name="notes" className="sp-field">
          <Field.Label>Notes (grows with its content)</Field.Label>
          <Field.Control render={<textarea rows={1} />} className="sp-input sp-grow" />
        </Field.Root>
        <Slider.Root defaultValue={40} className="sp-slider">
          <Slider.Label>Volume (drag the track)</Slider.Label>
          <Slider.Track className="sp-track">
            <Slider.Indicator className="sp-fill" />
            <Slider.Thumb className="sp-thumb" />
          </Slider.Track>
          <Slider.Value />
        </Slider.Root>
        <NumberField.Root defaultValue={2} min={0} max={9} locale="en-US" className="sp-number">
          <NumberField.Label>Copies</NumberField.Label>
          <NumberField.Decrement>−</NumberField.Decrement>
          <NumberField.Input className="sp-input" />
          <NumberField.Increment>+</NumberField.Increment>
        </NumberField.Root>
      </fieldset>
      <p>
        A search box outside any Field: <code>Field.Control</code> renders the plain input.
      </p>
      <label htmlFor="sp-search">Search</label>{" "}
      <Field.Control id="sp-search" type="search" className="sp-input" />
    </section>
  );
}

export function SeparatorDemo() {
  return (
    <Demo title="Separator and native fieldsets">
      <Lines />
      <Fieldset />
    </Demo>
  );
}
