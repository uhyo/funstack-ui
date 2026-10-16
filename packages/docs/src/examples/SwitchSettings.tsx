"use client";
import { Switch } from "@funstack/ui/switch";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave } from "./fake-api.js";

// Autosave on change. Each Switch is uncontrolled with an async action: the input flips at once
// (its DOM `checked` is the optimistic value), carries data-pending for the 800 ms the save
// takes, then keeps the value. The second save always fails: the switch flips back and the
// error reaches the Error Boundary around it.
export function SwitchSettings() {
  return (
    <div className="demo-stack">
      <label className="demo-field">
        <Switch
          className="demo-switch"
          defaultChecked
          checkedChangeAction={(next) => fakeSave(`notifications=${next}`)}
        />
        Email notifications
      </label>
      <DemoErrorBoundary>
        <label className="demo-field">
          <Switch
            className="demo-switch"
            checkedChangeAction={(next) => fakeSave(`beta=${next}`, { fail: true })}
          />
          Beta features (the save always fails)
        </label>
      </DemoErrorBoundary>
    </div>
  );
}
