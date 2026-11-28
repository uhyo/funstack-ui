"use client";
import { Suspense, startTransition, use, useState } from "react";
import { MultiSelect } from "@funstack/ui/multi-select";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave, sleep } from "./fake-api.js";

interface Topping {
  readonly id: string;
  readonly name: string;
  readonly soldOut?: boolean;
}

// The names the Trigger shows, known on the server before the listbox ever opens: the library
// keeps no item list, so a preselected value has no label until its option was rendered once.
const NAMES: Record<string, string> = {
  ham: "Ham",
  mushroom: "Mushroom",
  olive: "Olive",
  onion: "Onion",
  pepper: "Pepper",
  pineapple: "Pineapple",
};

// A pretend menu API, loaded when the listbox first opens. One cached promise, read with `use()`.
let menu: Promise<readonly Topping[]> | null = null;
function loadToppings(): Promise<readonly Topping[]> {
  menu ??= sleep(1200).then(() => [
    { id: "ham", name: "Ham" },
    { id: "mushroom", name: "Mushroom" },
    { id: "olive", name: "Olive" },
    { id: "onion", name: "Onion" },
    { id: "pepper", name: "Pepper", soldOut: true },
    { id: "pineapple", name: "Pineapple" },
  ]);
  return menu;
}

function ToppingOptions() {
  const toppings = use(loadToppings());
  return toppings.map((t) => (
    <MultiSelect.Option
      key={t.id}
      value={t.id}
      disabled={t.soldOut}
      className="demo-multi-select-option"
    >
      {({ pending }) => (
        <>
          {t.name}
          {t.soldOut && <span className="demo-multi-select-note"> (sold out)</span>}
          {pending && <span className="demo-spinner" aria-hidden />}
        </>
      )}
    </MultiSelect.Option>
  ));
}

// The options suspend the first time the listbox opens: the List shows the Status fallback and is
// `aria-busy`; when they arrive the first selected option becomes active. A pick toggles one
// option, the listbox stays open, and each pick is its own save with the option `data-pending`.
// A failed save rolls back that pick only.
export function MultiSelectToppings() {
  const [saved, setSaved] = useState<string[]>(["ham", "olive"]);
  const [fail, setFail] = useState(false);
  return (
    <div className="demo-stack">
      <DemoErrorBoundary>
        <MultiSelect.Root
          name="toppings"
          defaultValue={["ham", "olive"]}
          valueChangeAction={async (_next, { added, removed }) => {
            // Persist the diff, not `next`: an earlier pick may still fail.
            await fakeSave(`+${added.join(",")} -${removed.join(",")}`, { fail });
            startTransition(() =>
              setSaved((prev) => [
                ...prev.filter((v) => !removed.includes(v)),
                ...added.filter((v) => !prev.includes(v)),
              ]),
            );
          }}
        >
          <MultiSelect.Label className="demo-field">Toppings</MultiSelect.Label>
          <MultiSelect.Trigger className="demo-multi-select-trigger">
            <MultiSelect.Value placeholder="Choose toppings">
              {({ value }) => value.map((v) => NAMES[v] ?? v).join(", ")}
            </MultiSelect.Value>
            <span className="demo-multi-select-chevron" aria-hidden>
              ▾
            </span>
          </MultiSelect.Trigger>
          <MultiSelect.Popup className="demo-multi-select-popup">
            <MultiSelect.List>
              <Suspense
                fallback={
                  <MultiSelect.Status className="demo-multi-select-status">
                    Loading the menu…
                  </MultiSelect.Status>
                }
              >
                <ToppingOptions />
              </Suspense>
            </MultiSelect.List>
          </MultiSelect.Popup>
        </MultiSelect.Root>
      </DemoErrorBoundary>
      <label>
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make
        the save fail
      </label>
      <output className="demo-readout">
        saved: <code>{JSON.stringify(saved)}</code>
      </output>
    </div>
  );
}
