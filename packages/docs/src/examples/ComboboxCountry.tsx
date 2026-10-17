"use client";
import { Suspense, startTransition, use, useState } from "react";
import { Combobox } from "@funstack/ui/combobox";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave, sleep } from "./fake-api.js";

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
  { code: "jm", name: "Jamaica" },
  { code: "jp", name: "Japan" },
  { code: "je", name: "Jersey" },
  { code: "ke", name: "Kenya" },
  { code: "mx", name: "Mexico" },
  { code: "nz", name: "New Zealand" },
  { code: "no", name: "Norway" },
  { code: "es", name: "Spain" },
  { code: "gb", name: "United Kingdom" },
];

// A pretend search API with a cache keyed by query: one promise per query, read with `use()`.
// Results arrive in random order; React only ever renders the latest query's.
const cache = new Map<string, Promise<readonly Country[]>>();
function searchCountries(query: string): Promise<readonly Country[]> {
  const key = query.trim().toLowerCase();
  let promise = cache.get(key);
  if (promise === undefined) {
    promise = sleep(300 + Math.random() * 500).then(() =>
      COUNTRIES.filter((c) => c.name.toLowerCase().includes(key)),
    );
    cache.set(key, promise);
  }
  return promise;
}

function CountryOptions({ query }: { query: string }) {
  const countries = use(searchCountries(query));
  return countries.map((c) => (
    <Combobox.Option key={c.code} value={c.code} label={c.name}>
      {({ pending }) => (
        <>
          {c.name}
          {pending && <span className="demo-spinner" aria-hidden />}
        </>
      )}
    </Combobox.Option>
  ));
}

export function ComboboxCountry() {
  const [country, setCountry] = useState<string | null>(null);
  const [fail, setFail] = useState(false);
  return (
    <div className="demo-stack">
      <DemoErrorBoundary>
        <Combobox.Root
          valueChangeAction={async (next) => {
            await fakeSave(`country ${next}`, { fail });
            startTransition(() => setCountry(next));
          }}
        >
          <Combobox.Label>Country</Combobox.Label>
          <div className="demo-combobox-field">
            <Combobox.Input className="demo-combobox-input" placeholder="Type to search" />
            <Combobox.Clear className="demo-combobox-icon demo-combobox-clear" aria-label="Clear">
              ×
            </Combobox.Clear>
            <Combobox.Trigger className="demo-combobox-icon" aria-label="Show countries">
              ▾
            </Combobox.Trigger>
            <Combobox.Popup
              className="demo-combobox-popup"
              transition={{
                "fsui-combobox-open": "demo-combobox-pop",
                "fsui-combobox-close": "demo-combobox-pop",
                default: "none",
              }}
            >
              <Combobox.List>
                {({ query }) => (
                  <Suspense
                    fallback={
                      <Combobox.Status className="demo-combobox-status">Searching…</Combobox.Status>
                    }
                  >
                    <CountryOptions query={query} />
                  </Suspense>
                )}
              </Combobox.List>
              <Combobox.Empty className="demo-combobox-status">No country matches.</Combobox.Empty>
            </Combobox.Popup>
          </div>
        </Combobox.Root>
      </DemoErrorBoundary>
      <label>
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make
        the save fail
      </label>
      <output className="demo-readout">
        saved: <code>{JSON.stringify(country)}</code>
      </output>
    </div>
  );
}
