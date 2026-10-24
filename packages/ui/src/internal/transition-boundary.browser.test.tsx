// Conventions 5.1 / 10.1 and issue #35, in real engines: without `transition` a part renders no
// `<ViewTransition>`, so a tab switch, an accordion expand or a (nested) dialog open starts no
// document view transition and the next transition commit is not held back by the browser's
// 250 ms root cross-fade. With `transition="none"` the boundary exists and react-dom 19.3 starts a
// view transition on its mount or reveal (docs/research/view-transition-mount-cost.md); those rows
// assert the current React behaviour so a React fix is noticed.
//
// "Not held back" is asserted from the mechanism, not from wall-clock time (#71: a 50 ms bound
// failed under CPU load with no view transition anywhere). react-dom 19.3 holds a transition
// commit exactly when `document.__reactViewTransition` (the view transition it started last) is
// still set when the commit is ready, and then waits for its `finished`
// (`waitingForViewTransition` in react-dom-client). The rows sample that field, and the engine's
// `activeViewTransition` where it exists, when the second click is made and when its commit
// lands. The `transition="none"` Tabs rows check that the probe does see a running transition.
// Measured delays are still logged for memo/developer/view-transition-boundary.md.
//
// Interactions here are in-page `element.click()` calls observed with a MutationObserver, outside
// `act`: `act` would flush React's queue itself and hide exactly the scheduling under test.
// IS_REACT_ACT_ENVIRONMENT is switched off for that reason.
import { render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ReactNode, ViewTransitionClass } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { server } from "vitest/browser";
import { Accordion } from "../accordion/index.js";
import { Dialog } from "../dialog/index.js";
import { Tabs } from "../tabs/index.js";
import { silenceErrors } from "../__tests__/helpers.js";
import {
  closeOpenTopLayer,
  leaveActEnvironment,
  spyViewTransitions,
  viewTransitionFinished,
} from "../__tests__/browser-helpers.js";
import type { ViewTransitionSpy } from "../__tests__/browser-helpers.js";

let vt: ViewTransitionSpy;
let restoreAct: () => void;

beforeEach(() => {
  vt = spyViewTransitions();
  restoreAct = leaveActEnvironment();
});

afterEach(async () => {
  restoreAct();
  closeOpenTopLayer();
  // Let a still-running view transition finish so it cannot hold the next test's commits.
  await viewTransitionFinished();
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

type VTDocument = Document & {
  __reactViewTransition?: ViewTransition | null;
  activeViewTransition?: ViewTransition | null;
};

/** Whether a view transition is running that react-dom would hold a transition commit for. */
function viewTransitionRunning(): boolean {
  const doc = document as VTDocument;
  return doc.__reactViewTransition != null || doc.activeViewTransition != null;
}

interface SecondCommit {
  /** Wall-clock time from the second click to its commit; logged only, never asserted. */
  delay: number;
  /** A view transition was running when the second click was made. */
  runningAtClick: boolean;
  /** A view transition was running when the second commit was observed. */
  runningAtCommit: boolean;
}

/**
 * Runs `first`, waits for it to commit, then immediately runs `second` and reports whether a
 * view transition could hold the second commit back (and how long it took, for the log).
 */
async function secondCommit(
  first: () => void,
  firstDone: () => boolean,
  second: () => void,
  secondDone: () => boolean,
): Promise<SecondCommit> {
  first();
  await when(firstDone);
  const runningAtClick = viewTransitionRunning();
  const start = performance.now();
  second();
  let runningAtCommit = false;
  const end = await when(() => {
    if (!secondDone()) return false;
    runningAtCommit = viewTransitionRunning();
    return true;
  });
  return { delay: end - start, runningAtClick, runningAtCommit };
}

function log(label: string, { delay }: SecondCommit) {
  // Recorded for memo/developer/view-transition-boundary.md.
  console.info(`[${server.browser}] ${label}: second commit after ${Math.round(delay)} ms`);
}

/** No startViewTransition at all, and nothing running that react-dom could hold a commit for. */
function expectNotHeld(result: SecondCommit) {
  expect(vt.calls()).toBe(0);
  expect(result.runningAtClick).toBe(false);
  expect(result.runningAtCommit).toBe(false);
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
    secondCommit(
      () => screen.getByRole("tab", { name: "B" }).click(),
      visible("panel b"),
      () => screen.getByRole("tab", { name: "C" }).click(),
      visible("panel c"),
    );

  it.each([false, true])(
    "keepMounted={%s} without transition: no startViewTransition, next commit not delayed",
    async (keepMounted) => {
      render(tree(keepMounted, undefined));
      const result = await run();
      log(`Tabs keepMounted=${keepMounted} no transition`, result);
      expectNotHeld(result);
    },
  );

  it.each([false, true])(
    'keepMounted={%s} with transition="none": one startViewTransition per switch (react-dom 19.3)',
    async (keepMounted) => {
      render(tree(keepMounted, "none"));
      const result = await run();
      log(`Tabs keepMounted=${keepMounted} transition="none"`, result);
      expect(vt.calls()).toBe(2);
      // The first switch's transition is still running at the second click (its commit is
      // observed from inside the update callback, before `finished`), so the probe the "not
      // held" rows rely on does see a transition that holds the next commit.
      expect(result.runningAtClick).toBe(true);
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
    secondCommit(
      () => screen.getByText("trigger a").click(),
      visible("panel a"),
      () => screen.getByText("trigger b").click(),
      visible("panel b"),
    );

  it("without transition: no startViewTransition, next commit not delayed", async () => {
    render(tree(undefined));
    const result = await run();
    log("Accordion no transition", result);
    expectNotHeld(result);
  });

  it('with transition="none": expanding only updates always-mounted boundaries, none started', async () => {
    render(tree("none"));
    const result = await run();
    log('Accordion transition="none"', result);
    expect(vt.calls()).toBe(0);
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
    secondCommit(
      () => screen.getByTestId("outer-trigger").click(),
      () => dialog("outer")?.open === true && screen.queryByTestId("inner-trigger") !== null,
      () => screen.getByTestId("inner-trigger").click(),
      () => dialog("inner")?.open === true,
    );

  it("without transition: no startViewTransition, the inner open is not delayed", async () => {
    render(<Nested transition={undefined} />);
    const result = await run();
    log("Dialog nested no transition", result);
    expectNotHeld(result);
  });

  it('with transition="none": the nested Popup mount starts one (react-dom 19.3)', async () => {
    render(<Nested transition="none" />);
    const result = await run();
    log('Dialog nested transition="none"', result);
    expect(vt.calls()).toBeGreaterThanOrEqual(1);
  });

  // memo/reviewer/dialog.md: a plain open mounts the content under the always-mounted <dialog>,
  // which shields it, so even "none" starts nothing; "auto" names the boundary and starts one.
  it.each<[ViewTransitionClass | undefined, number]>([
    [undefined, 0],
    ["none", 0],
    ["auto", 1],
  ])("a plain open with transition=%j: %i startViewTransition call(s)", async (transition, n) => {
    render(
      <Dialog.Root defaultOpen={false}>
        <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
        <Dialog.Popup data-testid="popup" aria-label="plain" transition={transition}>
          content
        </Dialog.Popup>
      </Dialog.Root>,
    );
    screen.getByTestId("trigger").click();
    await when(() => dialog("popup")?.open === true);
    await viewTransitionFinished();
    expect(vt.calls()).toBe(n);
  });

  /** Inserts its child at the top of a subtree in a transition. */
  function Inserted({ children }: { children: ReactNode }) {
    const [show, setShow] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => startTransition(() => setShow(true))}>
          insert
        </button>
        {show && children}
      </div>
    );
  }

  it.each<[string, ViewTransitionClass | undefined, boolean, number]>([
    ["library, no transition", undefined, true, 0],
    ['library, transition="none"', "none", true, 1],
    ['JS-free, transition="none" (ignored)', "none", false, 0],
  ])("a Dialog.Root inserted by a transition (%s)", async (_label, transition, library, n) => {
    silenceErrors();
    render(
      <Inserted>
        <Dialog.Root {...(library && { defaultOpen: false })}>
          <Dialog.Popup data-testid="popup" aria-label="inserted" transition={transition}>
            content
          </Dialog.Popup>
        </Dialog.Root>
      </Inserted>,
    );
    screen.getByRole("button", { name: "insert" }).click();
    await when(() => dialog("popup") !== null);
    expect(vt.calls()).toBe(n);
  });
});
