// Probe (technical writer, #206), not part of the suite: copy into packages/ui/src/probe206tw/ and
// run `pnpm --filter @funstack/ui exec vitest run --project jsdom src/probe206tw/`. Checks the
// "Start refetches after the action" recipe on the Action props page. Result (React 19.3.1, jsdom):
// a refresh started inside the action holds the Tabs switch until its data loads; one queued with
// setTimeout, or started from an effect after the commit, lets the switch commit when the save
// settles. Output: refresh.probe.output.txt.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense, startTransition, use, useEffect, useState } from "react";
import { expect, it } from "vitest";
import { Tabs } from "../tabs/index.js";
import { Toggle } from "../toggle/index.js";

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });

function Data({ p }: { p: Promise<string> }) {
  return <span data-testid="data">{use(p)}</span>;
}

type Mode = "inside" | "timeout" | "effect";

function App({
  mode,
  save,
  data,
}: {
  mode: Mode;
  save: () => Promise<void>;
  data: (v: number) => Promise<string>;
}) {
  const [version, setVersion] = useState(0);
  const [saved, setSaved] = useState(0);
  const refresh = () => startTransition(() => setVersion((v) => v + 1));
  useEffect(() => {
    if (mode === "effect" && saved > 0) refresh();
  }, [saved]);
  return (
    <div>
      <Toggle
        data-testid="toggle"
        pressedChangeAction={async () => {
          await save();
          if (mode === "inside") refresh();
          if (mode === "timeout") setTimeout(refresh, 0);
          if (mode === "effect") startTransition(() => setSaved((s) => s + 1));
        }}
      >
        Done
      </Toggle>
      <Tabs.Root defaultValue="a">
        <Tabs.List>
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b">B</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a">panel a</Tabs.Panel>
        <Tabs.Panel value="b">panel b</Tabs.Panel>
      </Tabs.Root>
      <Suspense fallback={<span data-testid="fallback">fallback</span>}>
        <Data p={data(version)} />
      </Suspense>
    </div>
  );
}

for (const mode of ["inside", "timeout", "effect"] as const) {
  it(`refresh ${mode}`, async () => {
    const s = deferred();
    const cache = new Map<number, ReturnType<typeof deferred<string>>>();
    const data = (v: number) => {
      let d = cache.get(v);
      if (!d) cache.set(v, (d = deferred<string>()));
      return d.promise;
    };
    render(<App mode={mode} save={() => s.promise} data={data} />);
    await act(async () => cache.get(0)!.resolve("v0"));
    await flush();
    await act(async () => fireEvent.click(screen.getByTestId("toggle")));
    await act(async () => fireEvent.click(screen.getByRole("tab", { name: "B" })));
    await flush();
    const whilePending = screen.queryByText("panel b") !== null;
    await act(async () => s.resolve());
    await flush();
    const afterSave = screen.queryByText("panel b") !== null;
    const refetchStarted = cache.has(1);
    const fallback = screen.queryByTestId("fallback") !== null;
    if (cache.has(1)) await act(async () => cache.get(1)!.resolve("v1"));
    await flush();
    const end = screen.queryByText("panel b") !== null;
    const v = screen.getByTestId("data").textContent;
    require("node:fs").appendFileSync("/tmp/claude-1000/-home-uhyo-repos-funstack-ui/01b83cbb-97d7-446d-9d05-aa3c71dd9753/scratchpad/probe.log", mode + " " + JSON.stringify({ whilePending, afterSave, refetchStarted, fallback, end, v }) + "\n");
    expect(end).toBe(true);
  });
}
