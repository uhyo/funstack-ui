"use client";
import { startTransition, useState } from "react";
import { Select } from "@funstack/ui/select";
import { fakeSave } from "./fake-api.js";

/** A decorative swatch: an SVG with no text, so the option still reads as plain text. */
function Swatch({ color }: { color: string }) {
  return (
    <svg className="demo-select-swatch" viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="5" fill={color} />
    </svg>
  );
}

// Uncontrolled with an async save. The pick shows at once (the <select> renders the optimistic
// value); the select, its button and the picked option carry data-pending for the 800 ms the save
// takes, and the Trigger's function children add a spinner. With `appearance: base-select`
// (Chromium, Safari 27) the button and the picker are styled; Firefox renders the native select
// from the same markup.
export function SelectFruit() {
  const [saved, setSaved] = useState("");
  return (
    <div className="demo-stack">
      <label className="demo-field" htmlFor="fruit">
        Favourite fruit
      </label>
      <Select.Root
        id="fruit"
        className="demo-select"
        defaultValue=""
        valueChangeAction={async (next) => {
          await fakeSave(`fruit=${next}`);
          startTransition(() => setSaved(next));
        }}
      >
        <Select.Trigger className="demo-select-button">
          {({ pending }) => (
            <>
              <Select.Value />
              {pending && <span className="demo-spinner" aria-hidden />}
            </>
          )}
        </Select.Trigger>
        <Select.Option value="" disabled>
          Choose a fruit
        </Select.Option>
        <Select.Group label="Citrus">
          <Select.GroupLabel>Citrus</Select.GroupLabel>
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
      <output className="demo-readout">
        saved: <code>{JSON.stringify(saved)}</code>
      </output>
    </div>
  );
}
