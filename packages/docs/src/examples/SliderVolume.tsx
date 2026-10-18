"use client";
import { useState } from "react";
import { Slider } from "@funstack/ui/slider";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave } from "./fake-api.js";

// Uncontrolled, saved on release. The thumb follows the pointer (urgent); the save runs once per
// gesture in valueCommitAction (800 ms, data-pending on the Root and the thumb). With failures on,
// the save rejects: the error reaches the boundary and the value rolls back to where the gesture
// started. The save goes in valueCommitAction, never in valueChangeAction (every step).
export function SliderVolume() {
  const [fail, setFail] = useState(false);
  return (
    <div className="demo-stack">
      <label className="demo-field">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
        Make the save fail
      </label>
      <DemoErrorBoundary>
        <Slider.Root
          className="demo-slider"
          defaultValue={40}
          valueCommitAction={(next) => fakeSave(`volume ${next}`, { fail })}
          getAriaValueText={(v) => `${v} percent`}
        >
          <div className="demo-slider-head">
            <Slider.Label className="demo-slider-label">Volume</Slider.Label>
            <Slider.Value>
              {({ value, pending }) => `${value}%${pending ? " · saving…" : ""}`}
            </Slider.Value>
          </div>
          <Slider.Track className="demo-slider-track">
            <Slider.Indicator className="demo-slider-fill" />
            <Slider.Thumb className="demo-slider-thumb" />
          </Slider.Track>
        </Slider.Root>
      </DemoErrorBoundary>
    </div>
  );
}
