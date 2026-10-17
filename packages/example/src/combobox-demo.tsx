import { Component, Suspense, startTransition, use, useState } from "react";
import type { ReactNode } from "react";
import { Combobox } from "@funstack/ui/combobox";
import { Dialog } from "@funstack/ui/dialog";
import "./combobox-demo.css";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Country {
  readonly code: string;
  readonly name: string;
}

const COUNTRIES: readonly Country[] = [
  { code: "ar", name: "Argentina" },
  { code: "au", name: "Australia" },
  { code: "br", name: "Brazil" },
  { code: "ca", name: "Canada" },
  { code: "fr", name: "France" },
  { code: "de", name: "Germany" },
  { code: "in", name: "India" },
  { code: "it", name: "Italy" },
  { code: "jm", name: "Jamaica" },
  { code: "jp", name: "Japan" },
  { code: "je", name: "Jersey" },
  { code: "ke", name: "Kenya" },
  { code: "mx", name: "Mexico" },
  { code: "nl", name: "Netherlands" },
  { code: "nz", name: "New Zealand" },
  { code: "no", name: "Norway" },
  { code: "pt", name: "Portugal" },
  { code: "es", name: "Spain" },
  { code: "se", name: "Sweden" },
  { code: "ch", name: "Switzerland" },
  { code: "gb", name: "United Kingdom" },
  { code: "us", name: "United States" },
];

function matches(name: string, query: string): boolean {
  return name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

/**
 * Fake search API with a cache keyed by query (design/components/combobox.md 6.1): every query
 * gets one promise, so `use()` can read it and an earlier, slower response is harmless.
 */
const searchCache = new Map<string, Promise<readonly Country[]>>();
function searchCountries(query: string): Promise<readonly Country[]> {
  const key = query.trim().toLocaleLowerCase();
  let promise = searchCache.get(key);
  if (promise === undefined) {
    console.log(`[search] ${JSON.stringify(key)}`);
    promise = sleep(400 + Math.random() * 400).then(() =>
      COUNTRIES.filter((c) => matches(c.name, key)),
    );
    searchCache.set(key, promise);
  }
  return promise;
}

/** Fake backend: resolves after 900 ms; rejects when asked to. */
async function fakeSave(label: string, value: unknown, { fail = false } = {}): Promise<void> {
  console.log(`[${label}] saving ${JSON.stringify(value)}`);
  await sleep(900);
  if (fail) throw new Error(`[${label}] the server rejected ${JSON.stringify(value)}`);
  console.log(`[${label}] saved ${JSON.stringify(value)}`);
}

class DemoErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="cb-error-box">
          <p>Error Boundary caught: {this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function CountryOptions({ query }: { query: string }) {
  const results = use(searchCountries(query));
  return results.map((c) => (
    <Combobox.Option key={c.code} value={c.code} label={c.name} className="cb-option">
      {({ pending }) => (
        <>
          {c.name}
          {pending && <span className="cb-spinner" aria-hidden />}
        </>
      )}
    </Combobox.Option>
  ));
}

const POPUP_TRANSITION = {
  "fsui-combobox-open": "cb-pop",
  "fsui-combobox-close": "cb-pop",
  default: "none",
} as const;

function CountryPicker() {
  const [saved, setSaved] = useState<string | null>(null);
  const [fail, setFail] = useState(false);
  return (
    <section>
      <h3>Country picker: async search through Suspense, slow save</h3>
      <p>
        Typing is urgent; the results come from the deferred <code>query</code> and a query-keyed
        cache read with <code>use()</code> under a <code>Suspense</code> boundary inside the list.
        While a search runs the old results stay, dimmed (<code>data-stale</code>,{" "}
        <code>aria-busy</code>). Picking a country writes its name at once and keeps the list open
        with the option pending until the 900 ms save settles. The result count is announced with{" "}
        <code>ariaNotify</code> (default English message).
      </p>
      <label className="cb-toggle">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make
        the save fail
      </label>
      <DemoErrorBoundary>
        <Combobox.Root
          name="country"
          valueChangeAction={async (next) => {
            await fakeSave("country", next, { fail });
            startTransition(() => setSaved(next));
          }}
        >
          <Combobox.Label className="cb-label">Country</Combobox.Label>
          <div className="cb-field">
            <Combobox.Input className="cb-input" placeholder="Type to search" />
            <Combobox.Clear className="cb-icon-button" aria-label="Clear">
              ×
            </Combobox.Clear>
            <Combobox.Trigger className="cb-icon-button" aria-label="Show countries">
              ▾
            </Combobox.Trigger>
            <Combobox.Popup className="cb-popup" transition={POPUP_TRANSITION}>
              <Combobox.List className="cb-list">
                {({ query }) => (
                  <Suspense
                    fallback={<Combobox.Status className="cb-status">Searching…</Combobox.Status>}
                  >
                    <CountryOptions query={query} />
                  </Suspense>
                )}
              </Combobox.List>
              <Combobox.Empty className="cb-status">No country matches.</Combobox.Empty>
            </Combobox.Popup>
          </div>
        </Combobox.Root>
      </DemoErrorBoundary>
      <p className="cb-note">Saved: {saved ?? "(none)"}</p>
    </section>
  );
}

function TagInput() {
  const [tag, setTag] = useState<string | null>("Tea");
  const [text, setText] = useState("Tea");
  const suggestions = ["Coffee", "Tea", "Matcha", "Hot chocolate", "Lemonade"];
  return (
    <section>
      <h3>Free text: allowCustomValue, controlled text</h3>
      <p>
        The value may be any text. Enter (with no active suggestion) or leaving the field commits it
        with <code>details.custom: true</code>. The text is controlled with a plain{" "}
        <code>setState</code> in <code>inputValueChangeAction</code>, the urgent lane.
      </p>
      <Combobox.Root
        allowCustomValue
        value={tag}
        inputValue={text}
        inputValueChangeAction={(next) => setText(next)}
        valueChangeAction={async (next, details) => {
          console.log(`[drink] ${JSON.stringify(next)} custom=${details.custom}`);
          startTransition(() => setTag(next));
        }}
      >
        <Combobox.Label className="cb-label">Favourite drink</Combobox.Label>
        <div className="cb-field">
          <Combobox.Input className="cb-input" />
          <Combobox.Popup className="cb-popup">
            <Combobox.List className="cb-list">
              {({ query }) =>
                suggestions
                  .filter((s) => matches(s, query))
                  .map((s) => (
                    <Combobox.Option key={s} value={s} className="cb-option">
                      {s}
                    </Combobox.Option>
                  ))
              }
            </Combobox.List>
            <Combobox.Empty className="cb-status">Press Enter to use your own.</Combobox.Empty>
          </Combobox.Popup>
        </div>
      </Combobox.Root>
      <p className="cb-note">
        Value: {JSON.stringify(tag)}, text: {JSON.stringify(text)}
      </p>
    </section>
  );
}

function InDialog() {
  return (
    <section>
      <h3>Inside a Dialog, autoHighlight and loop</h3>
      <p>
        The listbox is an <code>auto</code> popover nested under the dialog: the first Escape closes
        the list, the second the dialog. <code>autoHighlight</code> makes the first result active,
        so typing then Enter picks it.
      </p>
      <Dialog.Root>
        <Dialog.Trigger>Edit address</Dialog.Trigger>
        <Dialog.Popup className="cb-dialog">
          <Dialog.Title>Edit address</Dialog.Title>
          <Combobox.Root autoHighlight loop>
            <Combobox.Label className="cb-label">Country</Combobox.Label>
            <div className="cb-field">
              <Combobox.Input className="cb-input" />
              <Combobox.Popup className="cb-popup">
                <Combobox.List className="cb-list">
                  {({ query }) =>
                    COUNTRIES.filter((c) => matches(c.name, query)).map((c) => (
                      <Combobox.Option
                        key={c.code}
                        value={c.code}
                        label={c.name}
                        className="cb-option"
                      >
                        {c.name}
                      </Combobox.Option>
                    ))
                  }
                </Combobox.List>
                <Combobox.Empty className="cb-status">No country matches.</Combobox.Empty>
              </Combobox.Popup>
            </div>
          </Combobox.Root>
          <Dialog.Close>Done</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Root>
    </section>
  );
}

export function ComboboxDemo() {
  return (
    <section className="cb-demo">
      <h2>Combobox</h2>
      <p>
        Before hydration the input is a plain text field: text typed then is kept and adopted at
        mount (<code>reason: &quot;platform&quot;</code>), and nothing opens until the next
        keystroke.
      </p>
      <CountryPicker />
      <TagInput />
      <InDialog />
    </section>
  );
}
