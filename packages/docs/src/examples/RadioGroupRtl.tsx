"use client";
import { useState } from "react";
import { RadioGroup } from "@funstack/ui/radio-group";

const alignments = [
  { value: "right", label: "يمين (right)" },
  { value: "center", label: "وسط (center)" },
  { value: "left", label: "يسار (left)" },
];

// Inside dir="rtl" the browser mirrors the arrow keys: ArrowLeft moves to the next radio, which
// is visually to the left (Safari does not mirror). The library has no keyboard code of its own.
// Controlled with local state: the setState runs in the action's synchronous part, so it is a
// transition update.
export function RadioGroupRtl() {
  const [value, setValue] = useState<string | null>("right");
  return (
    <>
      <div dir="rtl">
        <RadioGroup.Root
          className="demo-radio-group demo-radio-inline"
          value={value}
          valueChangeAction={(next) => {
            setValue(next);
          }}
        >
          <RadioGroup.Label>المحاذاة (alignment)</RadioGroup.Label>
          {alignments.map((option) => (
            <label key={option.value} className="demo-field">
              <RadioGroup.Item value={option.value} className="demo-radio" />
              {option.label}
            </label>
          ))}
        </RadioGroup.Root>
      </div>
      <output className="demo-readout">
        value: <code>{JSON.stringify(value)}</code>
      </output>
    </>
  );
}
