"use client";
import { startTransition, useState } from "react";
import { Button } from "@funstack/ui/button";
import { Menu } from "@funstack/ui/menu";
import { ToggleGroup } from "@funstack/ui/toggle-group";
import { Toolbar } from "@funstack/ui/toolbar";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave } from "./fake-api.js";

// An editor toolbar: one Tab stop over two ToggleGroups, separators, a menu button, three
// Buttons (Copy is disabled but stays focusable) and a text input placed last. Left /
// Right walk every control; ArrowDown on Insert opens the menu.
export function ToolbarEditor() {
  const [styles, setStyles] = useState<string[]>(["bold"]);
  const [align, setAlign] = useState<string | null>("left");
  const [log, setLog] = useState("Nothing yet.");
  const note = (line: string) => startTransition(() => setLog(line));

  return (
    <DemoErrorBoundary>
      <div className="demo-stack">
        <Toolbar.Root aria-label="Formatting" className="demo-toolbar">
          <ToggleGroup.Root
            aria-label="Text style"
            className="demo-toggle-group"
            value={styles}
            valueChangeAction={async (_next, { added, removed }) => {
              await fakeSave("styles");
              // Functional update: overlapping saves that settle out of order lose nothing.
              startTransition(() =>
                setStyles((prev) => [
                  ...prev.filter((v) => !removed.includes(v)),
                  ...added.filter((v) => !prev.includes(v)),
                ]),
              );
            }}
          >
            <ToggleGroup.Item value="bold" className="demo-toggle-item" aria-label="Bold">
              <b aria-hidden>B</b>
            </ToggleGroup.Item>
            <ToggleGroup.Item value="italic" className="demo-toggle-item" aria-label="Italic">
              <i aria-hidden>I</i>
            </ToggleGroup.Item>
          </ToggleGroup.Root>
          <Toolbar.Separator className="demo-toolbar-separator" />
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
          </ToggleGroup.Root>
          <Toolbar.Separator className="demo-toolbar-separator" />
          <Menu.Root>
            <Menu.Trigger className="demo-toolbar-button">Insert</Menu.Trigger>
            <Menu.Popup className="demo-menu">
              <Menu.Item action={() => note("Inserted an image.")}>Image</Menu.Item>
              <Menu.Item action={() => note("Inserted a table.")}>Table</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
          <Button
            className="demo-toolbar-button"
            action={async () => {
              await fakeSave("cut");
              note("Cut.");
            }}
          >
            {({ pending }) => (
              <>
                {pending && <span className="demo-spinner" aria-hidden />}
                Cut
              </>
            )}
          </Button>
          <Button className="demo-toolbar-button" disabled>
            Copy
          </Button>
          <Button className="demo-toolbar-button" action={() => note("Pasted.")}>
            Paste
          </Button>
          {/* A text-entry control owns its arrow keys: at most one, and last (APG). */}
          <input
            type="text"
            aria-label="Font size"
            inputMode="numeric"
            defaultValue="16"
            size={3}
            className="demo-toolbar-input"
          />
        </Toolbar.Root>
        <p>
          Styles: <output>{styles.join(", ") || "none"}</output>. Alignment:{" "}
          <output>{align ?? "none"}</output>. Last command: <output>{log}</output>
        </p>
      </div>
    </DemoErrorBoundary>
  );
}
