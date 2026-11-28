// Not part of the test suite: copy into packages/ui/src/probe206/ and run
// `pnpm --filter @funstack/ui exec vitest run --project jsdom src/probe206/` (the browser file:
// `FUNSTACK_BROWSERS=chromium ... --project browser`). The vt probe reports through a failing
// assertion on purpose. Results: memo/architect/pending-entanglement-206.md.
// Probe for #206 (architect). Raw React 19.3.1: what a pending async action holds.
import { act, render, screen, fireEvent } from "@testing-library/react";
import {
  Suspense,
  startTransition,
  use,
  useDeferredValue,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { expect, it } from "vitest";
import { appendFileSync } from "node:fs";
const log = (...a: unknown[]) => appendFileSync(process.env.PROBE_LOG ?? "probe-206.log", a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") + "\n");

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });
const ds = (id: string) => ({ ...screen.getByTestId(id).dataset });

function Data({ p }: { p: Promise<string> }) {
  return <span data-testid="data">{use(p)}</span>;
}

interface Cfg {
  save: () => Promise<void>;
  /** data promise per version; version bumps in the app's refresh() after the save */
  data: (version: number) => Promise<string>;
  refresh: boolean;
  /** content promise read by the "popup" when open (deferred variant) */
  content?: Promise<string>;
}

function App({ cfg }: { cfg: Cfg }) {
  const [version, setVersion] = useState(0);
  const [savePending, startSave] = useTransition();
  // four ways of opening an unrelated thing
  const [openT, setOpenT] = useState(false); // standalone startTransition
  const [openOwn, setOpenOwn] = useState(false); // own useTransition
  const [ownPending, startOwn] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(openOwn);
  const [openU, setOpenU] = useState(false); // urgent
  const [intent, setIntent] = useState(false); // urgent intent + deferred content
  const shownD = useDeferredValue(intent);
  return (
    <div>
      <div
        data-testid="s"
        data-save={String(savePending)}
        data-open-t={String(openT)}
        data-open-own={String(openOwn)}
        data-own-pending={String(ownPending)}
        data-optimistic={String(optimistic)}
        data-open-u={String(openU)}
        data-intent={String(intent)}
        data-shown-d={String(shownD)}
        data-version={version}
      />
      <button
        data-testid="save"
        onClick={() =>
          startSave(async () => {
            await cfg.save();
            if (cfg.refresh) startTransition(() => setVersion((v) => v + 1));
          })
        }
      />
      <button data-testid="t" onClick={() => startTransition(() => setOpenT(true))} />
      <button
        data-testid="own"
        onClick={() =>
          startOwn(async () => {
            setOptimistic(true);
            await undefined;
            startTransition(() => setOpenOwn(true));
          })
        }
      />
      <button data-testid="u" onClick={() => setOpenU(true)} />
      <button data-testid="d" onClick={() => setIntent(true)} />
      <Suspense fallback={<span data-testid="fallback">fallback</span>}>
        <Data p={cfg.data(version)} />
        {shownD && cfg.content ? <span data-testid="content">{use(cfg.content)}</span> : null}
      </Suspense>
    </div>
  );
}

function setup(over: Partial<Cfg> = {}) {
  const save = deferred();
  const cache = new Map<number, ReturnType<typeof deferred<string>>>();
  const data = (v: number) => {
    let d = cache.get(v);
    if (!d) cache.set(v, (d = deferred<string>()));
    return d.promise;
  };
  const cfg: Cfg = { save: () => save.promise, data, refresh: false, ...over };
  return { save, cache, cfg };
}

it("1. a pending async action holds every transition, urgent and deferred updates pass", async () => {
  const { save, cache, cfg } = setup();
  render(<App cfg={cfg} />);
  await act(async () => { cache.get(0)!.resolve("v0"); });
  await flush();
  await act(async () => { fireEvent.click(screen.getByTestId("save")); });
  expect(ds("s").save).toBe("true");
  for (const id of ["t", "own", "u", "d"]) {
    await act(async () => { fireEvent.click(screen.getByTestId(id)); });
  }
  await flush();
  log("1. while save pending:", ds("s"));
  expect(ds("s")).toMatchObject({
    openT: "false", // held
    openOwn: "false", // held
    ownPending: "true",
    optimistic: "true", // optimistic passes
    openU: "true", // urgent passes
    intent: "true",
    shownD: "true", // deferred render passes
  });
  await act(async () => { save.resolve(); });
  await flush();
  log("1. after save settled:", ds("s"));
  expect(ds("s")).toMatchObject({ openT: "true", openOwn: "true", ownPending: "false" });
});

it("2. the app's refresh() after the save extends the hold until its data has loaded", async () => {
  const { save, cache, cfg } = setup({ refresh: true });
  render(<App cfg={cfg} />);
  await act(async () => { cache.get(0)!.resolve("v0"); });
  await flush();
  await act(async () => { fireEvent.click(screen.getByTestId("save")); });
  await act(async () => { fireEvent.click(screen.getByTestId("t")); });
  await act(async () => { fireEvent.click(screen.getByTestId("own")); });
  await flush();
  await act(async () => { save.resolve(); });
  await flush();
  log("2. save settled, refresh suspended:", ds("s"), "fallback:", screen.queryByTestId("fallback") !== null);
  // The save is over, yet the opens are still not committed: they share the lane of the refresh,
  // whose render suspends on the new data.
  expect(ds("s")).toMatchObject({ openT: "false", openOwn: "false", version: "0" });
  await act(async () => { cache.get(1)!.resolve("v1"); });
  await flush();
  log("2. data loaded:", ds("s"));
  expect(ds("s")).toMatchObject({ openT: "true", openOwn: "true", version: "1" });
});

it("3. a transition started after the save settled is not held by the suspended refresh", async () => {
  const { save, cache, cfg } = setup({ refresh: true });
  render(<App cfg={cfg} />);
  await act(async () => { cache.get(0)!.resolve("v0"); });
  await flush();
  await act(async () => { fireEvent.click(screen.getByTestId("save")); });
  await flush();
  await act(async () => { save.resolve(); });
  await flush();
  expect(ds("s")).toMatchObject({ version: "0", save: "true" });
  await act(async () => { fireEvent.click(screen.getByTestId("t")); });
  await flush();
  log("3. open started during the suspended refresh:", ds("s"));
  expect(ds("s").openT).toBe("true");
  await act(async () => { cache.get(1)!.resolve("v1"); });
  await flush();
});

it("4. urgent intent + useDeferredValue: suspending content keeps the old UI, with no fallback, and is not held", async () => {
  const content = deferred<string>();
  const { save, cache, cfg } = setup({ content: content.promise });
  render(<App cfg={cfg} />);
  await act(async () => { cache.get(0)!.resolve("v0"); });
  await flush();
  await act(async () => { fireEvent.click(screen.getByTestId("save")); });
  await act(async () => { fireEvent.click(screen.getByTestId("d")); });
  await flush();
  log("4. deferred open, content suspended:", ds("s"), "fallback:", screen.queryByTestId("fallback") !== null);
  expect(ds("s")).toMatchObject({ intent: "true", shownD: "false", save: "true" });
  expect(screen.queryByTestId("fallback")).toBeNull();
  expect(screen.getByTestId("data").textContent).toBe("v0");
  await act(async () => { content.resolve("loaded"); });
  await flush();
  log("4. content loaded, save still pending:", ds("s"));
  expect(ds("s")).toMatchObject({ shownD: "true", save: "true" });
  expect(screen.getByTestId("content").textContent).toBe("loaded");
  await act(async () => { save.resolve(); });
  await flush();
});
