"use client";
import { useState } from "react";
import { Field } from "@funstack/ui/field";
import { Meter } from "@funstack/ui/meter";

const words = ["Too short", "Weak", "Fair", "Good", "Strong"];

/** A toy score from 0 to 4: length, case, digits, symbols. */
function strength(password: string): number {
  if (password.length < 8) return 0;
  return [/[a-z]/.test(password) && /[A-Z]/.test(password), /\d/, /[^A-Za-z0-9]/]
    .map((test) => (typeof test === "boolean" ? test : test.test(password)))
    .reduce((score, passed) => score + (passed ? 1 : 0), 1);
}

// A password-strength meter next to the Field's control, not registered with the Field: it has
// its own Meter.Label, and the input is described by Meter.Value (an aria-hidden element
// referenced by aria-describedby still contributes its text). Higher is better: optimum = max.
export function MeterStrength() {
  const [password, setPassword] = useState("");
  const score = strength(password);
  return (
    <Field.Root name="password" className="demo-fieldset">
      <Field.Label className="demo-label">New password</Field.Label>
      <Field.Control
        type="password"
        autoComplete="new-password"
        className="demo-input"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-describedby="password-strength"
      />
      <Meter.Root
        className="demo-meter"
        value={score}
        max={4}
        low={1.5}
        high={2.5}
        optimum={4}
        getAriaValueText={(value) => words[value] ?? null}
      >
        <div className="demo-meter-head">
          <Meter.Label>Strength</Meter.Label>
          <Meter.Value id="password-strength">{({ value }) => words[value]}</Meter.Value>
        </div>
        <Meter.Track className="demo-meter-track demo-meter-plain">
          <Meter.Indicator className="demo-meter-fill" />
        </Meter.Track>
      </Meter.Root>
    </Field.Root>
  );
}
