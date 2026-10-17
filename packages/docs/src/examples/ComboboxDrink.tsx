"use client";
import { useState } from "react";
import { Combobox } from "@funstack/ui/combobox";

const SUGGESTIONS = ["Coffee", "Tea", "Matcha", "Hot chocolate", "Lemonade"];

// Free text: `allowCustomValue` makes the typed text the value (Enter with no active
// suggestion, or leaving the field). The text is controlled with a plain setState in the urgent
// `inputValueChangeAction`. `name` puts the value in a hidden input for the form.
export function ComboboxDrink() {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  return (
    <form
      className="demo-stack"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(String(new FormData(event.currentTarget).get("drink")));
      }}
    >
      <Combobox.Root
        name="drink"
        allowCustomValue
        inputValue={text}
        inputValueChangeAction={(next) => setText(next)}
      >
        <Combobox.Label>Favourite drink</Combobox.Label>
        <div className="demo-combobox-field">
          <Combobox.Input className="demo-combobox-input" placeholder="Anything" required />
          <Combobox.Popup className="demo-combobox-popup">
            <Combobox.List>
              {({ query }) =>
                SUGGESTIONS.filter((s) => s.toLowerCase().includes(query.toLowerCase())).map(
                  (s) => (
                    <Combobox.Option key={s} value={s}>
                      {s}
                    </Combobox.Option>
                  ),
                )
              }
            </Combobox.List>
            <Combobox.Empty className="demo-combobox-status">
              Press Enter to use your own.
            </Combobox.Empty>
          </Combobox.Popup>
        </div>
      </Combobox.Root>
      <div className="demo-row">
        <button type="submit" className="demo-button demo-primary">
          Submit
        </button>
        <output className="demo-readout">
          text: <code>{JSON.stringify(text)}</code>, submitted:{" "}
          <code>{JSON.stringify(submitted)}</code>
        </output>
      </div>
    </form>
  );
}
