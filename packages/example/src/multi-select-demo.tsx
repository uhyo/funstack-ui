import { Suspense, startTransition, use, useState } from "react";
import { Dialog } from "@funstack/ui/dialog";
import { Field } from "@funstack/ui/field";
import { MultiSelect } from "@funstack/ui/multi-select";
import type { MultiSelectOpenChangeDetails } from "@funstack/ui/multi-select";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary.js";
import { fakeSave, sleep } from "./shared/fake-backend.js";
import { Demo } from "./shared/Demo.js";
import "./multi-select-demo.css";

const TOPPINGS = [
  { id: "ham", name: "Ham" },
  { id: "mushroom", name: "Mushroom" },
  { id: "olive", name: "Olive" },
  { id: "onion", name: "Onion" },
  { id: "pepper", name: "Pepper", soldOut: true },
  { id: "pineapple", name: "Pineapple" },
  { id: "salami", name: "Salami" },
  { id: "spinach", name: "Spinach" },
] as const;
const NAMES: Record<string, string> = Object.fromEntries(TOPPINGS.map((t) => [t.id, t.name]));

/** A pretend menu API: one cached promise, read with `use()` when the listbox first opens. */
let menu: Promise<typeof TOPPINGS> | null = null;
function loadMenu(): Promise<typeof TOPPINGS> {
  menu ??= sleep(1200).then(() => TOPPINGS);
  return menu;
}

function MenuOptions() {
  return use(loadMenu()).map((t) => (
    <MultiSelect.Option key={t.id} value={t.id} disabled={"soldOut" in t} className="ms-option">
      {({ pending }) => (
        <>
          {t.name}
          {"soldOut" in t && <small> (sold out)</small>}
          {pending && <span className="ms-spinner" aria-hidden />}
        </>
      )}
    </MultiSelect.Option>
  ));
}

function summary(value: readonly string[], placeholder: string): string {
  return value.length === 0 ? placeholder : value.map((v) => NAMES[v] ?? v).join(", ");
}

/** Options that load on open, a slow save per pick, a failure switch. */
function Toppings() {
  const [saved, setSaved] = useState<string[]>(["ham"]);
  const [fail, setFail] = useState(false);
  return (
    <section>
      <h3>Toppings (options load on open, slow saves)</h3>
      <DemoErrorBoundary className="ms-error-box">
        <MultiSelect.Root
          name="toppings"
          defaultValue={["ham"]}
          valueChangeAction={async (_next, { added, removed }) => {
            await fakeSave("toppings", { added, removed }, { fail, ms: 900 });
            startTransition(() =>
              setSaved((prev) => [
                ...prev.filter((v) => !removed.includes(v)),
                ...added.filter((v) => !prev.includes(v)),
              ]),
            );
          }}
        >
          <MultiSelect.Label className="ms-label">Toppings</MultiSelect.Label>
          <MultiSelect.Trigger className="ms-trigger">
            <MultiSelect.Value>
              {({ value }) => summary(value, "Choose toppings")}
            </MultiSelect.Value>
            <span aria-hidden>▾</span>
          </MultiSelect.Trigger>
          <MultiSelect.Popup className="ms-popup">
            <MultiSelect.List>
              <Suspense
                fallback={<MultiSelect.Status className="ms-status">Loading…</MultiSelect.Status>}
              >
                <MenuOptions />
              </Suspense>
            </MultiSelect.List>
          </MultiSelect.Popup>
        </MultiSelect.Root>
      </DemoErrorBoundary>
      <p>
        <label>
          <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make
          the save fail
        </label>
      </p>
      <p>
        saved: <code>{JSON.stringify(saved)}</code>
      </p>
    </section>
  );
}

/** Controlled `open` with a slow `openChangeAction`, and `required` inside a Field. */
function Schedule() {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState("(none)");
  const [posted, setPosted] = useState<string[] | null>(null);
  return (
    <section>
      <h3>Office days (controlled open, slow openChangeAction, required in a Field)</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPosted(new FormData(e.currentTarget).getAll("days").map(String));
        }}
      >
        <Field.Root name="days" required>
          <Field.Label className="ms-label">Office days</Field.Label>
          <MultiSelect.Root
            open={open}
            onOpenChange={(next, { reason }: MultiSelectOpenChangeDetails) => {
              setLog(`onOpenChange(${next}, "${reason}")`);
              setOpen(next);
            }}
            openChangeAction={async (next, { reason }) => {
              setLog(`openChangeAction(${next}, "${reason}"): running…`);
              await sleep(700);
              startTransition(() => {
                setLog(`openChangeAction(${next}, "${reason}"): settled`);
                setOpen(next);
              });
            }}
            loop
          >
            <MultiSelect.Trigger className="ms-trigger">
              <MultiSelect.Value placeholder="Choose days" />
              <span aria-hidden>▾</span>
            </MultiSelect.Trigger>
            <MultiSelect.Popup className="ms-popup" transition="ms-pop">
              <MultiSelect.List>
                <MultiSelect.Group>
                  <MultiSelect.GroupLabel className="ms-group-label">
                    Weekdays
                  </MultiSelect.GroupLabel>
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => (
                    <MultiSelect.Option
                      key={d}
                      value={d.slice(0, 3).toLowerCase()}
                      className="ms-option"
                    >
                      {d}
                    </MultiSelect.Option>
                  ))}
                </MultiSelect.Group>
                <MultiSelect.Group>
                  <MultiSelect.GroupLabel className="ms-group-label">
                    Weekend
                  </MultiSelect.GroupLabel>
                  {["Saturday", "Sunday"].map((d) => (
                    <MultiSelect.Option
                      key={d}
                      value={d.slice(0, 3).toLowerCase()}
                      className="ms-option"
                    >
                      {d}
                    </MultiSelect.Option>
                  ))}
                </MultiSelect.Group>
              </MultiSelect.List>
            </MultiSelect.Popup>
          </MultiSelect.Root>
          <Field.Error className="ms-error" />
        </Field.Root>
        <p>
          <button type="submit">Save</button> <button type="reset">Reset</button>
        </p>
      </form>
      <p>
        open: <code>{String(open)}</code> · last: <code>{log}</code> · posted:{" "}
        <code>{posted === null ? "(nothing yet)" : JSON.stringify(posted)}</code>
      </p>
    </section>
  );
}

/** Inside a modal Dialog: Escape closes the listbox first. */
function InDialog() {
  return (
    <section>
      <h3>Inside a Dialog</h3>
      <Dialog.Root>
        <Dialog.Trigger>Edit pizza</Dialog.Trigger>
        <Dialog.Popup className="ms-dialog">
          <Dialog.Title>Edit pizza</Dialog.Title>
          <MultiSelect.Root defaultValue={["olive"]}>
            <MultiSelect.Label className="ms-label">Toppings</MultiSelect.Label>
            <MultiSelect.Trigger className="ms-trigger">
              <MultiSelect.Value>{({ value }) => summary(value, "None")}</MultiSelect.Value>
              <span aria-hidden>▾</span>
            </MultiSelect.Trigger>
            <MultiSelect.Popup className="ms-popup">
              <MultiSelect.List>
                {TOPPINGS.map((t) => (
                  <MultiSelect.Option key={t.id} value={t.id} className="ms-option">
                    {t.name}
                  </MultiSelect.Option>
                ))}
              </MultiSelect.List>
            </MultiSelect.Popup>
          </MultiSelect.Root>
          <p>
            <Dialog.Close>Done</Dialog.Close>
          </p>
        </Dialog.Popup>
      </Dialog.Root>
    </section>
  );
}

export function MultiSelectDemo() {
  return (
    <Demo title="MultiSelect" className="ms-demo">
      <p>
        A button that shows the selection and a listbox in which each pick toggles one option and
        the listbox stays open. Before hydration the button shows the default selection and nothing
        opens.
      </p>
      <Toppings />
      <Schedule />
      <InDialog />
    </Demo>
  );
}
