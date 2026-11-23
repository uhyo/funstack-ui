"use client";
import { startTransition, useState } from "react";
import { Button } from "@funstack/ui/button";
import { fakeSave } from "./fake-api.js";

// A "+1" Button with the default whilePending="run": every click runs the action, also while an
// earlier one is still pending. The Button shows data-pending until the last run has settled and
// is never aria-disabled meanwhile. Each run awaits a 1 s fake request, then counts.
export function ButtonCounter() {
  const [count, setCount] = useState(0);

  return (
    <div className="demo-row">
      <Button
        className="demo-btn"
        action={async () => {
          await fakeSave("the increment", { ms: 1000 });
          startTransition(() => setCount((c) => c + 1));
        }}
      >
        +1
      </Button>
      <output className="demo-readout">Count: {count}</output>
    </div>
  );
}
