"use client";
import { startTransition, useState } from "react";
import { Combobox } from "@funstack/ui/combobox";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave } from "./fake-api.js";

const LANGUAGES = [
  "C",
  "C++",
  "Elixir",
  "Go",
  "Haskell",
  "Java",
  "JavaScript",
  "Kotlin",
  "OCaml",
  "Python",
  "Ruby",
  "Rust",
  "Swift",
  "TypeScript",
];

export function ComboboxTags() {
  const [saved, setSaved] = useState<string[]>(["TypeScript"]);
  const [fail, setFail] = useState(false);
  return (
    <div className="demo-stack">
      <DemoErrorBoundary>
        <Combobox.Root
          multiple
          name="languages"
          defaultValue={["TypeScript"]}
          allowCustomValue
          // With free text, Enter on no active option adds the typed text as a tag: make the first
          // match active, so "ja" then Enter picks Java rather than adding "ja".
          autoHighlight
          valueChangeAction={async (_next, { added, removed }) => {
            // Persist the diff, not `next`: an earlier change may still fail.
            await fakeSave(`+${added.join(",")} -${removed.join(",")}`, { fail });
            startTransition(() =>
              setSaved((prev) => [
                ...prev.filter((v) => !removed.includes(v)),
                ...added.filter((v) => !prev.includes(v)),
              ]),
            );
          }}
        >
          <Combobox.Label>Languages</Combobox.Label>
          <div className="demo-combobox-field demo-combobox-tags">
            <Combobox.Chips className="demo-combobox-chips">
              {({ value }) =>
                value.map((language) => (
                  <Combobox.Chip key={language} value={language} className="demo-combobox-chip">
                    {({ label }) => (
                      <>
                        {label ?? language}
                        <Combobox.ChipRemove
                          className="demo-combobox-chip-remove"
                          aria-label={`Remove ${label ?? language}`}
                        >
                          <span aria-hidden>×</span>
                        </Combobox.ChipRemove>
                      </>
                    )}
                  </Combobox.Chip>
                ))
              }
            </Combobox.Chips>
            <Combobox.Input className="demo-combobox-input" placeholder="Add a language" />
            {/* As wide as the field box: the box is the anchor (the Root anchors to the Input). */}
            <Combobox.Popup
              className="demo-combobox-popup"
              style={{ positionAnchor: "--demo-tags", minWidth: "anchor-size(--demo-tags width)" }}
            >
              <Combobox.List>
                {({ query }) =>
                  LANGUAGES.filter((l) => l.toLowerCase().includes(query.toLowerCase())).map(
                    (l) => (
                      <Combobox.Option key={l} value={l}>
                        {({ pending }) => (
                          <>
                            {l}
                            {pending && <span className="demo-spinner" aria-hidden />}
                          </>
                        )}
                      </Combobox.Option>
                    ),
                  )
                }
              </Combobox.List>
              <Combobox.Empty className="demo-combobox-status">
                Press Enter to add it.
              </Combobox.Empty>
            </Combobox.Popup>
          </div>
        </Combobox.Root>
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
