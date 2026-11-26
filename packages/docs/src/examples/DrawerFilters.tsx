"use client";
import { startTransition, useState } from "react";
import { Drawer } from "@funstack/ui/drawer";
import { fakeSave } from "./fake-api.js";

const brands = [
  "Acme",
  "Borealis",
  "Cobalt",
  "Dune",
  "Ember",
  "Fjord",
  "Granite",
  "Harbor",
  "Iris",
  "Juniper",
  "Kestrel",
  "Lumen",
];

// A bottom sheet. Drag the grabber, the title or the footer down to close it (mouse, pen or
// touch): past a quarter of its height or with a flick it slides out and closes, which
// `onOpenChange` hears as a dismissal; a short drag returns. The list scrolls in its own
// `overflow-y: auto` body, where a press scrolls and never drags. "Apply" is a Close with an
// `action`: pending while the fake request runs, then the sheet closes.
export function DrawerFilters() {
  const [applied, setApplied] = useState<readonly string[]>([]);
  const [draft, setDraft] = useState<readonly string[]>([]);
  const [lastClose, setLastClose] = useState("");

  return (
    <div className="demo-row">
      <Drawer.Root
        defaultOpen={false}
        openChangeAction={(open) => {
          if (open) setDraft(applied);
        }}
        onOpenChange={(_open, { event }) =>
          setLastClose(event?.type === "pointerup" ? "swiped away" : "dismissed")
        }
      >
        <Drawer.Trigger className="demo-button">Filters ({applied.length})</Drawer.Trigger>
        <Drawer.Popup className="demo-drawer" side="bottom">
          <div className="demo-drawer-grabber" aria-hidden />
          <Drawer.Title>Brands</Drawer.Title>
          <div className="demo-drawer-body">
            {brands.map((brand) => (
              <label key={brand} className="demo-drawer-row">
                <input
                  type="checkbox"
                  checked={draft.includes(brand)}
                  onChange={(event) =>
                    setDraft((current) =>
                      event.target.checked
                        ? [...current, brand]
                        : current.filter((b) => b !== brand),
                    )
                  }
                />
                {brand}
              </label>
            ))}
          </div>
          <div className="demo-drawer-footer">
            <Drawer.Close className="demo-button">Cancel</Drawer.Close>
            <Drawer.Close
              className="demo-button demo-primary"
              action={async () => {
                await fakeSave("filters", { ms: 700 });
                // After an await: wrap the update yourself (React limitation).
                startTransition(() => {
                  setApplied(draft);
                  setLastClose("applied");
                });
              }}
            >
              {({ pending }) => (
                <>
                  {pending && <span className="demo-spinner" aria-hidden />}
                  Apply
                </>
              )}
            </Drawer.Close>
          </div>
        </Drawer.Popup>
      </Drawer.Root>
      <output className="demo-readout">
        {applied.length === 0 ? "All brands" : applied.join(", ")}
        {lastClose !== "" && ` (last close: ${lastClose})`}
      </output>
    </div>
  );
}
