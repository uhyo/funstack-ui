import { startTransition, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@funstack/ui/button";
import { Menu } from "@funstack/ui/menu";
import { ToggleGroup } from "@funstack/ui/toggle-group";
import { Toolbar } from "@funstack/ui/toolbar";
import { Tooltip } from "@funstack/ui/tooltip";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary";
import { sleep } from "./shared/fake-backend";
import { Demo } from "./shared/Demo";
import "./toolbar-demo.css";

const supportsFocusgroup =
  typeof HTMLElement !== "undefined" && "focusGroup" in HTMLElement.prototype;

/** A fake backend that fails when the "fail" switch is on. */
async function save(label: string, value: unknown, fail: boolean): Promise<void> {
  console.log(`[toolbar] saving ${label}`, value);
  await sleep(800);
  if (fail) throw new Error(`Saving ${label} failed`);
  console.log(`[toolbar] saved ${label}`, value);
}

function BoldIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
      <path
        d="M4 2h5a3 3 0 0 1 2.1 5.1A3.3 3.3 0 0 1 9.5 14H4V2Zm2 2v3h3a1.5 1.5 0 0 0 0-3H6Zm0 5v3h3.5a1.5 1.5 0 0 0 0-3H6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
      <path d="M6 2h7v2h-2.6l-2.3 8H10v2H3v-2h2.6l2.3-8H6V2Z" fill="currentColor" />
    </svg>
  );
}

function UnderlineIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
      <path
        d="M4 2h2v6a2 2 0 0 0 4 0V2h2v6a4 4 0 0 1-8 0V2Zm-1 11h10v2H3v-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** An icon Item named by its tooltip (`provides="name"`), as in the Tooltip demo. */
function IconItem({ value, label, icon }: { value: string; label: string; icon: ReactNode }) {
  return (
    <Tooltip.Root provides="name">
      <Tooltip.Trigger render={<ToggleGroup.Item value={value} className="tb-item" />}>
        {icon}
      </Tooltip.Trigger>
      <Tooltip.Popup className="tip">{label}</Tooltip.Popup>
    </Tooltip.Root>
  );
}

function EditorToolbar({ focusgroup, fail }: { focusgroup: boolean; fail: boolean }) {
  const [styles, setStyles] = useState<string[]>(["bold"]);
  const [align, setAlign] = useState<string | null>("left");
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) =>
    startTransition(() => setLog((prev) => [line, ...prev].slice(0, 5)));

  return (
    <section>
      <h3>Editor toolbar</h3>
      <p>
        One Tab stop. Left / Right walk every control: both groups, the menu button, the commands
        and the input. ArrowDown on Insert opens its menu. Copy is <code>aria-disabled</code>: still
        focusable. In the font-size input, the arrows move the caret and Tab moves on.
      </p>
      <Toolbar.Root aria-label="Formatting" className="tb" experimental_focusgroup={focusgroup}>
        <ToggleGroup.Root
          aria-label="Text style"
          className="tb-group"
          value={styles}
          valueChangeAction={async (_next, { added, removed }) => {
            await save("styles", { added, removed }, fail);
            startTransition(() =>
              setStyles((prev) => [
                ...prev.filter((v) => !removed.includes(v)),
                ...added.filter((v) => !prev.includes(v)),
              ]),
            );
          }}
        >
          <IconItem value="bold" label="Bold" icon={<BoldIcon />} />
          <IconItem value="italic" label="Italic" icon={<ItalicIcon />} />
          <IconItem value="underline" label="Underline" icon={<UnderlineIcon />} />
        </ToggleGroup.Root>
        <Toolbar.Separator className="tb-sep" />
        <ToggleGroup.Root
          exclusive
          aria-label="Text alignment"
          className="tb-group"
          value={align}
          valueChangeAction={async (next) => {
            await save("alignment", next, fail);
            startTransition(() => setAlign(next));
          }}
        >
          <ToggleGroup.Item value="left" className="tb-item">
            Left
          </ToggleGroup.Item>
          <ToggleGroup.Item value="center" className="tb-item">
            Center
          </ToggleGroup.Item>
          <ToggleGroup.Item value="right" className="tb-item">
            Right
          </ToggleGroup.Item>
        </ToggleGroup.Root>
        <Toolbar.Separator className="tb-sep" />
        <Menu.Root>
          <Menu.Trigger className="tb-item">Insert</Menu.Trigger>
          <Menu.Popup className="menu">
            <Menu.Item action={() => note("Inserted an image")}>Image</Menu.Item>
            <Menu.Item action={() => note("Inserted a table")}>Table</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
        <Button
          className="tb-item"
          action={async () => {
            await save("cut", null, fail);
            note("Cut");
          }}
        >
          {({ pending }) => (pending ? "Cutting…" : "Cut")}
        </Button>
        <Button className="tb-item" disabled>
          Copy
        </Button>
        <Button className="tb-item" action={() => note("Pasted")}>
          Paste
        </Button>
        <input type="text" aria-label="Font size" inputMode="numeric" defaultValue="16" size={3} />
      </Toolbar.Root>
      <p>
        Styles: <output>{styles.join(", ") || "none"}</output>; alignment:{" "}
        <output>{align ?? "none"}</output>
      </p>
      <ul className="tb-log">
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function VerticalToolbar({ focusgroup }: { focusgroup: boolean }) {
  const [tool, setTool] = useState<string | null>("select");
  return (
    <section>
      <h3>Vertical toolbar</h3>
      <p>
        Up / Down walk the tools. On Shapes, ArrowRight opens the menu (ArrowDown moves on). The
        tool switcher is an exclusive group with <code>deselectable=&#123;false&#125;</code>.
      </p>
      <Toolbar.Root
        aria-label="Tools"
        orientation="vertical"
        className="tb"
        experimental_focusgroup={focusgroup}
      >
        <ToggleGroup.Root
          exclusive
          deselectable={false}
          aria-label="Tool"
          className="tb-group"
          value={tool}
          valueChangeAction={(next) => setTool(next)}
        >
          <ToggleGroup.Item value="select" className="tb-item">
            Select
          </ToggleGroup.Item>
          <ToggleGroup.Item value="draw" className="tb-item">
            Draw
          </ToggleGroup.Item>
        </ToggleGroup.Root>
        <Toolbar.Separator className="tb-sep" />
        <Menu.Root>
          <Menu.Trigger className="tb-item">Shapes</Menu.Trigger>
          <Menu.Popup className="menu" side="right">
            <Menu.Item action={() => setTool("rectangle")}>Rectangle</Menu.Item>
            <Menu.Item action={() => setTool("ellipse")}>Ellipse</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </Toolbar.Root>
      <p>
        Tool: <output>{tool}</output>
      </p>
    </section>
  );
}

function StandaloneGroup() {
  return (
    <section>
      <h3>Standalone group</h3>
      <p>Its own Tab stop: Tab enters on the pressed Item. Arrows move focus and never press.</p>
      <ToggleGroup.Root
        exclusive
        aria-label="View"
        className="tb tb-group"
        defaultValue="list"
        valueChangeAction={(next) => save("view", next, false)}
      >
        <ToggleGroup.Item value="grid" className="tb-item">
          Grid
        </ToggleGroup.Item>
        <ToggleGroup.Item value="list" className="tb-item">
          List
        </ToggleGroup.Item>
        <ToggleGroup.Item value="board" className="tb-item">
          Board
        </ToggleGroup.Item>
      </ToggleGroup.Root>
    </section>
  );
}

export function ToolbarDemo() {
  const [focusgroup, setFocusgroup] = useState(false);
  const [fail, setFail] = useState(false);
  return (
    <Demo title="Toolbar and ToggleGroup">
      <fieldset>
        <legend>Options</legend>
        <label>
          <input
            type="checkbox"
            checked={focusgroup}
            onChange={(e) => setFocusgroup(e.target.checked)}
          />{" "}
          <code>experimental_focusgroup</code> on both Toolbars
        </label>{" "}
        <label>
          <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make
          saves fail
        </label>
        <p>
          This browser {supportsFocusgroup ? "supports" : "does not support"}{" "}
          <code>focusgroup</code>
          {supportsFocusgroup
            ? ": with the flag on, the browser moves focus and the library writes no tabindex."
            : ": the attribute is inert and the JS engine runs."}
        </p>
      </fieldset>
      <DemoErrorBoundary>
        <EditorToolbar focusgroup={focusgroup} fail={fail} />
      </DemoErrorBoundary>
      <VerticalToolbar focusgroup={focusgroup} />
      <StandaloneGroup />
    </Demo>
  );
}
