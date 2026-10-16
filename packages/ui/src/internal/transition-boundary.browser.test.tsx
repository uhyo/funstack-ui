// Conventions 5.1 / 10.1 and issue #35, in real engines: without `transition` a part renders no
// `<ViewTransition>`, so a tab switch, an accordion expand or a (nested) dialog open starts no
// document view transition and the next transition commit is not held back by the browser's
// 250 ms root cross-fade. With `transition="none"` the boundary exists and react-dom 19.3 starts a
// view transition on its mount or reveal (docs/research/view-transition-mount-cost.md); those rows
// assert the current React behaviour so a React fix is noticed.
//
// Interactions here are in-page `element.click()` calls, measured with `performance.now()` against
// a MutationObserver, outside `act`: `act` would flush React's queue itself and hide exactly the
// scheduling delay under test. IS_REACT_ACT_ENVIRONMENT is switched off for that reason.
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode, ViewTransitionClass } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "vitest/browser";
import { Accordion } from "../accordion/index.js";
import { Dialog } from "../dialog/index.js";
import { Tabs } from "../tabs/index.js";

type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

let calls = 0;
let actEnvironment: boolean | undefined;

beforeEach(() => {
  calls = 0;
  const original = document.startViewTransition.bind(document);
  vi.spyOn(document, "startViewTransition").mockImplementation(((
    arg?: StartViewTransitionOptions | ViewTransitionUpdateCallback,
  ) => {
    calls++;
    return original(arg);
  }) as typeof document.startViewTransition);
  actEnvironment = (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = false;
});

afterEach(async () => {
  (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = actEnvironment;
  for (const dialog of document.querySelectorAll("dialog")) if (dialog.open) dialog.close();
  // Let a still-running view transition finish so it cannot hold the next test's commits.
  await (
    document as Document & { __reactViewTransition?: ViewTransition | null }
  ).__reactViewTransition?.finished.catch(() => {});
  vi.restoreAllMocks();
});

/** Resolves with `performance.now()` at the first DOM mutation (or check) where `cond` holds. */
function when(cond: () => boolean, timeout = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    if (cond()) return resolve(performance.now());
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error("condition not met"));
    }, timeout);
    const observer = new MutationObserver(() => {
      if (!cond()) return;
      clearTimeout(timer);
      observer.disconnect();
      resolve(performance.now());
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
  });
}

const visible = (text: string) => () => screen.queryByText(text)?.checkVisibility() === true;

/**
 * Runs `first`, waits for it to commit, then immediately runs `second` and returns how long the
 * second transition commit took to land.
 */
async function secondCommitDelay(
  first: () => void,
  firstDone: () => boolean,
  second: () => void,
  secondDone: () => boolean,
): Promise<number> {
  first();
  await when(firstDone);
  const start = performance.now();
  second();
  const end = await when(secondDone);
  return end - start;
}

function log(label: string, delay: number) {
  // Recorded for memo/developer/view-transition-boundary.md.
  console.info(`[${server.browser}] ${label}: second commit after ${Math.round(delay)} ms`);
}

/** Generous for CI noise, far below the ~250 ms cross-fade it guards against. */
const NOT_DELAYED_MS = 50;

/**
 * Mounts a fresh tree and measures, up to three times, keeping the best run. A held commit waits
 * for the 250 ms cross-fade on every attempt; machine noise (a parallel test run) does not repeat.
 * Every attempt counts towards `calls`.
 */
async function bestOf(mount: () => void, run: () => Promise<number>): Promise<number> {
  let best = Infinity;
  for (let attempt = 0; attempt < 3 && best >= NOT_DELAYED_MS; attempt++) {
    mount();
    best = Math.min(best, await run());
    cleanup();
  }
  return best;
}

describe("Tabs switch", () => {
  const tree = (keepMounted: boolean, transition: ViewTransitionClass | undefined) => (
    <Tabs.Root defaultValue="a">
      <Tabs.List aria-label="x">
        <Tabs.Tab value="a">A</Tabs.Tab>
        <Tabs.Tab value="b">B</Tabs.Tab>
        <Tabs.Tab value="c">C</Tabs.Tab>
      </Tabs.List>
      {(["a", "b", "c"] as const).map((v) => (
        <Tabs.Panel key={v} value={v} keepMounted={keepMounted} transition={transition}>
          {`panel ${v}`}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
  const run = () =>
    secondCommitDelay(
      () => screen.getByRole("tab", { name: "B" }).click(),
      visible("panel b"),
      () => screen.getByRole("tab", { name: "C" }).click(),
      visible("panel c"),
    );

  it.each([false, true])(
    "keepMounted={%s} without transition: no startViewTransition, next commit not delayed",
    async (keepMounted) => {
      const delay = await bestOf(() => render(tree(keepMounted, undefined)), run);
      log(`Tabs keepMounted=${keepMounted} no transition`, delay);
      expect(calls).toBe(0);
      expect(delay).toBeLessThan(NOT_DELAYED_MS);
    },
  );

  it.each([false, true])(
    'keepMounted={%s} with transition="none": one startViewTransition per switch (react-dom 19.3)',
    async (keepMounted) => {
      render(tree(keepMounted, "none"));
      const delay = await run();
      log(`Tabs keepMounted=${keepMounted} transition="none"`, delay);
      expect(calls).toBe(2);
    },
  );
});

describe("Accordion expand", () => {
  const tree = (transition: ViewTransitionClass | undefined) => (
    <Accordion.Root defaultValue={[]}>
      {(["a", "b"] as const).map((v) => (
        <Accordion.Item key={v} value={v} transition={transition}>
          <Accordion.Trigger transition={transition}>{`trigger ${v}`}</Accordion.Trigger>
          <Accordion.Panel transition={transition}>{`panel ${v}`}</Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
  const run = () =>
    secondCommitDelay(
      () => screen.getByText("trigger a").click(),
      visible("panel a"),
      () => screen.getByText("trigger b").click(),
      visible("panel b"),
    );

  it("without transition: no startViewTransition, next commit not delayed", async () => {
    const delay = await bestOf(() => render(tree(undefined)), run);
    log("Accordion no transition", delay);
    expect(calls).toBe(0);
    expect(delay).toBeLessThan(NOT_DELAYED_MS);
  });

  it('with transition="none": expanding only updates always-mounted boundaries, none started', async () => {
    render(tree("none"));
    const delay = await run();
    log('Accordion transition="none"', delay);
    expect(calls).toBe(0);
  });
});

describe("Dialog open", () => {
  // The issue's case: the outer open mounts a nested Dialog whose Popup is the top of the inserted
  // subtree; opening the inner dialog right after is the second transition commit.
  function Nested({ transition }: { transition: ViewTransitionClass | undefined }): ReactNode {
    return (
      <Dialog.Root defaultOpen={false}>
        <Dialog.Trigger data-testid="outer-trigger">Outer</Dialog.Trigger>
        <Dialog.Popup data-testid="outer" aria-label="outer" transition={transition}>
          <Dialog.Root defaultOpen={false}>
            <Dialog.Trigger data-testid="inner-trigger">Inner</Dialog.Trigger>
            <Dialog.Popup data-testid="inner" aria-label="inner" transition={transition}>
              inner content
            </Dialog.Popup>
          </Dialog.Root>
        </Dialog.Popup>
      </Dialog.Root>
    );
  }
  const dialog = (id: string) => screen.queryByTestId(id) as HTMLDialogElement | null;
  const run = () =>
    secondCommitDelay(
      () => screen.getByTestId("outer-trigger").click(),
      () => dialog("outer")?.open === true && screen.queryByTestId("inner-trigger") !== null,
      () => screen.getByTestId("inner-trigger").click(),
      () => dialog("inner")?.open === true,
    );

  it("without transition: no startViewTransition, the inner open is not delayed", async () => {
    const delay = await bestOf(() => render(<Nested transition={undefined} />), run);
    log("Dialog nested no transition", delay);
    expect(calls).toBe(0);
    expect(delay).toBeLessThan(NOT_DELAYED_MS);
  });

  it('with transition="none": the nested Popup mount starts one (react-dom 19.3)', async () => {
    render(<Nested transition="none" />);
    const delay = await run();
    log('Dialog nested transition="none"', delay);
    expect(calls).toBeGreaterThanOrEqual(1);
  });
});
