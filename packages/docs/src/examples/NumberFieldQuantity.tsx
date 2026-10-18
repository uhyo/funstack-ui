"use client";
import { startTransition, useState } from "react";
import { NumberField } from "@funstack/ui/number-field";
import { fakeSave } from "./fake-api.js";

// A cart line. Type a number (committed on blur or Enter), use the arrow keys, or press and hold
// a button: the save runs once per gesture in valueCommitAction (800 ms, data-pending on the Root,
// the Input and the pressed button). The parent adopts the quantity when the save succeeds; with
// failures on it keeps the old one, so the text returns to it.
export function NumberFieldQuantity() {
  const [fail, setFail] = useState(false);
  const [quantity, setQuantity] = useState<number | null>(1);
  return (
    <div className="demo-stack">
      <label className="demo-field">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
        Make the save fail
      </label>
      <NumberField.Root
        className="demo-number-field"
        locale="en-US"
        value={quantity}
        min={1}
        max={99}
        valueCommitAction={async (next) => {
          try {
            await fakeSave(`quantity ${next}`, { fail });
            startTransition(() => setQuantity(next));
          } catch {
            // The parent keeps its quantity: the field shows it again.
          }
        }}
      >
        {({ pending }) => (
          <>
            <NumberField.Label className="demo-number-label">Quantity</NumberField.Label>
            <div className="demo-number-group">
              <NumberField.Decrement className="demo-number-step">−</NumberField.Decrement>
              <NumberField.Input className="demo-number-input" />
              <NumberField.Increment className="demo-number-step">+</NumberField.Increment>
            </div>
            <span className="demo-number-status">
              {pending ? "Saving…" : `In the cart: ${String(quantity)}`}
            </span>
          </>
        )}
      </NumberField.Root>
    </div>
  );
}
