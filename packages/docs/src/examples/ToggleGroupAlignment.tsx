"use client";
import { startTransition, useState } from "react";
import { ToggleGroup } from "@funstack/ui/toggle-group";
import { fakeSave } from "./fake-api.js";

// Exclusive mode. The first group allows "nothing pressed" (press Left again to release it);
// the second is a view switcher with deselectable={false}: pressing the pressed Item does
// nothing. Controlled, "update on success": the setState after the await is a transition.
export function ToggleGroupAlignment() {
  const [align, setAlign] = useState<string | null>("left");
  const [layout, setLayout] = useState<string | null>("grid");
  return (
    <div className="demo-stack">
      <ToggleGroup.Root
        exclusive
        aria-label="Text alignment"
        className="demo-toggle-group"
        value={align}
        valueChangeAction={async (next) => {
          await fakeSave(`alignment=${next}`);
          startTransition(() => setAlign(next));
        }}
      >
        <ToggleGroup.Item value="left" className="demo-toggle-item">
          Left
        </ToggleGroup.Item>
        <ToggleGroup.Item value="center" className="demo-toggle-item">
          Center
        </ToggleGroup.Item>
        <ToggleGroup.Item value="right" className="demo-toggle-item">
          Right
        </ToggleGroup.Item>
      </ToggleGroup.Root>
      <p>
        Alignment: <output>{align ?? "none"}</output>
      </p>
      <ToggleGroup.Root
        exclusive
        deselectable={false}
        aria-label="Layout"
        className="demo-toggle-group"
        value={layout}
        valueChangeAction={(next) => {
          setLayout(next);
        }}
      >
        <ToggleGroup.Item value="grid" className="demo-toggle-item">
          Grid
        </ToggleGroup.Item>
        <ToggleGroup.Item value="list" className="demo-toggle-item">
          List
        </ToggleGroup.Item>
      </ToggleGroup.Root>
      <p>
        Layout: <output>{layout}</output>
      </p>
    </div>
  );
}
