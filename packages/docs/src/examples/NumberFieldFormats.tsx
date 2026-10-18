"use client";
import { useState } from "react";
import { NumberField } from "@funstack/ui/number-field";

const locales = ["en-US", "de-DE", "fr-FR", "ar-EG"] as const;
type Locale = (typeof locales)[number];

// The buttons' built-in names are English; pass your own next to the locale.
const labels: Record<Locale, { increase: string; decrease: string }> = {
  "en-US": { increase: "Increase", decrease: "Decrease" },
  "de-DE": { increase: "Erhöhen", decrease: "Verringern" },
  "fr-FR": { increase: "Augmenter", decrease: "Diminuer" },
  "ar-EG": { increase: "زيادة", decrease: "إنقاص" },
};

// A price in euros and a percentage, formatted and parsed in the chosen locale. The text is the
// locale's (`12,50 €`, `€12.50`, `١٢٫٥٠ €`); the value and the posted form value are plain numbers.
// Try `1,5` in English (not a number: it reverts) and in German (1.5).
export function NumberFieldFormats() {
  const [locale, setLocale] = useState<Locale>("de-DE");
  const [price, setPrice] = useState<number | null>(12.5);
  const { increase, decrease } = labels[locale];
  return (
    <div className="demo-stack">
      <label className="demo-field">
        Locale
        <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
          {locales.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <NumberField.Root
        className="demo-number-field"
        locale={locale}
        format={{ style: "currency", currency: "EUR" }}
        value={price}
        min={0}
        step={0.5}
        valueChangeAction={(next) => {
          setPrice(next);
        }}
      >
        <NumberField.Label className="demo-number-label">Price</NumberField.Label>
        <div className="demo-number-group">
          <NumberField.Decrement className="demo-number-step" aria-label={decrease}>
            −
          </NumberField.Decrement>
          <NumberField.Input className="demo-number-input" />
          <NumberField.Increment className="demo-number-step" aria-label={increase}>
            +
          </NumberField.Increment>
        </div>
      </NumberField.Root>
      <output className="demo-readout">value: {String(price)}</output>
      <NumberField.Root
        className="demo-number-field"
        locale={locale}
        format={{ style: "percent" }}
        defaultValue={0.25}
        min={0}
        max={1}
        stepOnWheel
      >
        <NumberField.Label className="demo-number-label">Discount (wheel on)</NumberField.Label>
        <div className="demo-number-group">
          <NumberField.Decrement className="demo-number-step" aria-label={decrease}>
            −
          </NumberField.Decrement>
          <NumberField.Input className="demo-number-input" />
          <NumberField.Increment className="demo-number-step" aria-label={increase}>
            +
          </NumberField.Increment>
        </div>
      </NumberField.Root>
    </div>
  );
}
