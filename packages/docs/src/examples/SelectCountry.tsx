"use client";
import { Suspense, use, useState } from "react";
import { Select } from "@funstack/ui/select";
import { sleep } from "./fake-api.js";

interface Country {
  readonly code: string;
  readonly name: string;
}

const initialCountries: readonly Country[] = [
  { code: "jp", name: "Japan" },
  { code: "fr", name: "France" },
  { code: "br", name: "Brazil" },
];

async function fetchCountries(): Promise<readonly Country[]> {
  await sleep(1500);
  return [...initialCountries, { code: "ke", name: "Kenya" }];
}

function CountryOptions({ countries }: { countries: Promise<readonly Country[]> | null }) {
  const list = countries === null ? initialCountries : use(countries);
  return list.map((c) => (
    <Select.Option key={c.code} value={c.code}>
      {c.name}
    </Select.Option>
  ));
}

// The options sit behind a Suspense boundary inside the select. "Reload" remounts the boundary
// (a new `key`), so the fallback option replaces the list for 1.5 s and the real options mount
// later. React selects options only in the select's own commit, so on its own it would leave the
// browser's first option selected; the library re-applies the value (`br`) when they arrive.
export function SelectCountry() {
  const [country, setCountry] = useState("br");
  const [countries, setCountries] = useState<Promise<readonly Country[]> | null>(null);
  const [generation, setGeneration] = useState(0);
  return (
    <div className="demo-stack">
      <div className="demo-row">
        <Select.Root
          aria-label="Country"
          className="demo-select"
          value={country}
          valueChangeAction={(next) => {
            setCountry(next);
          }}
        >
          <Select.Trigger className="demo-select-button">
            <Select.Value />
          </Select.Trigger>
          <Suspense
            key={generation}
            fallback={
              <Select.Option value="" disabled>
                Loading countries…
              </Select.Option>
            }
          >
            <CountryOptions countries={countries} />
          </Suspense>
        </Select.Root>
        <button
          type="button"
          className="demo-button"
          onClick={() => {
            setCountries(fetchCountries());
            setGeneration((g) => g + 1);
          }}
        >
          Reload
        </button>
      </div>
      <output className="demo-readout">
        value: <code>{JSON.stringify(country)}</code>
      </output>
    </div>
  );
}
