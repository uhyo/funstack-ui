"use client";
import { RadioGroup } from "@funstack/ui/radio-group";
import { fakeSave } from "./fake-api.js";

const themes = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

// Uncontrolled with an async save. The clicked radio checks at once (its DOM `checked` is the
// optimistic value); the Root and that radio carry data-pending for the 800 ms the save takes.
// The legend reads `pending` through the Label's function children; the row spinner is CSS on
// `:has([data-pending])`. Arrow keys are native: each press checks and saves, the latest wins.
export function RadioGroupTheme() {
  return (
    <RadioGroup.Root
      className="demo-radio-group"
      defaultValue="system"
      valueChangeAction={(next) => fakeSave(`theme=${next}`)}
    >
      <RadioGroup.Label>
        {({ pending }) => (
          <>Theme {pending && <span className="demo-radio-saving">saving…</span>}</>
        )}
      </RadioGroup.Label>
      {themes.map((theme) => (
        <label key={theme.value} className="demo-field">
          <RadioGroup.Item value={theme.value} className="demo-radio" />
          {theme.label}
          <span className="demo-spinner demo-radio-spinner" aria-hidden />
        </label>
      ))}
    </RadioGroup.Root>
  );
}
