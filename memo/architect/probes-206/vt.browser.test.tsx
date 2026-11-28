// Not part of the test suite: copy into packages/ui/src/probe206/ and run
// `pnpm --filter @funstack/ui exec vitest run --project jsdom src/probe206/` (the browser file:
// `FUNSTACK_BROWSERS=chromium ... --project browser`). The vt probe reports through a failing
// assertion on purpose. Results: memo/architect/pending-entanglement-206.md.
// Probe for #206 (architect): does a useDeferredValue render run a view transition, with types,
// while an unrelated async action is pending?
import { act, render, screen } from "@testing-library/react";
import {
  addTransitionType,
  startTransition,
  useDeferredValue,
  useState,
  useTransition,
  ViewTransition,
} from "react";
import { expect, it } from "vitest";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

function IS_REACT_ACT_ENVIRONMENT_OFF() {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
}
function App({ work, withTypes }: { work: () => Promise<void>; withTypes: boolean }) {
  const [, start] = useTransition();
  const [intent, setIntent] = useState(false);
  const shown = useDeferredValue(intent);
  const [, setTick] = useState(0);
  return (
    <div>
      <button data-testid="busy" onClick={() => start(work)} />
      <button
        data-testid="open"
        onClick={() => {
          setIntent(true);
          if (withTypes) startTransition(() => { addTransitionType("fsui-probe"); setTick((t) => t + 1); });
        }}
      />
      {shown ? <ViewTransition><div data-testid="content">content</div></ViewTransition> : null}
    </div>
  );
}

for (const [withTypes, busy] of [[false, true], [true, true], [false, false], [true, false]] as const) {
  it(`deferred open, busy=${busy}, withTypes=${withTypes}`, async () => {
    const calls: unknown[] = [];
    const original = document.startViewTransition;
    document.startViewTransition = function (this: Document, arg: any) {
      calls.push(typeof arg === "function" ? "fn" : { types: arg?.types ? [...arg.types] : null });
      return original.call(this, arg);
    } as typeof document.startViewTransition;
    try {
      const d = deferred();
      render(<App work={() => d.promise} withTypes={withTypes} />);
      IS_REACT_ACT_ENVIRONMENT_OFF();
      if (busy) screen.getByTestId("busy").click();
      await new Promise((r) => setTimeout(r, 100));
      screen.getByTestId("open").click();
      await new Promise((r) => setTimeout(r, 600));
      const shownWhilePending = screen.queryByTestId("content") !== null;
      const callsWhilePending = JSON.stringify(calls);
      d.resolve();
      await new Promise((r) => setTimeout(r, 600));
      expect({ shownWhilePending, callsWhilePending, callsAfter: JSON.stringify(calls) }).toEqual("REPORT " + withTypes + busy);
    } finally {
      document.startViewTransition = original;
    }
  });
}
