// A registry of per-test teardown steps, environment-neutral (no DOM), so that vitest.setup.ts can
// run it in every project (jsdom, node, browser). Browser files register through
// browser-helpers.ts (`addStyle`, `leaveActEnvironment`, `onCleanup`, which it re-exports).

const cleanups: (() => void)[] = [];

/** Registers `cleanup` to run after the current test (vitest.setup.ts, after the unmount). */
export function onCleanup(cleanup: () => void): void {
  cleanups.push(cleanup);
}

/** Runs the registered cleanups in order and forgets them (vitest.setup.ts, after the unmount). */
export function runCleanups(): void {
  for (const cleanup of cleanups.splice(0)) cleanup();
}
