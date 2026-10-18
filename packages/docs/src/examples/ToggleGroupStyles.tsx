"use client";
import { useState } from "react";
import { ToggleGroup } from "@funstack/ui/toggle-group";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave } from "./fake-api.js";

// Multiple mode, uncontrolled, with an async save. Each Item flips at once and shows a spinner
// (data-pending) until its save settles. With "fail" on, the save rejects: the Item flips back
// and the error reaches the boundary.
export function ToggleGroupStyles() {
  const [fail, setFail] = useState(false);
  return (
    <div className="demo-stack">
      <label>
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make
        the save fail
      </label>
      <DemoErrorBoundary>
        <ToggleGroup.Root
          aria-label="Text style"
          className="demo-toggle-group"
          defaultValue={["bold"]}
          valueChangeAction={(next, { added, removed }) =>
            fakeSave(`styles (added ${added}, removed ${removed}) → ${next}`, { fail })
          }
        >
          {["Bold", "Italic", "Underline"].map((label) => (
            <ToggleGroup.Item key={label} value={label.toLowerCase()} className="demo-toggle-item">
              {({ pending }) => (
                <>
                  {pending && <span className="demo-spinner" aria-hidden />}
                  {label}
                </>
              )}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </DemoErrorBoundary>
    </div>
  );
}
