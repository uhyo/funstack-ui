// A per-file registry of teardown steps, environment-neutral (no DOM), so that vitest.setup.ts can
// run it in every project (jsdom, node, browser). Browser files register through
// browser-helpers.ts (`addStyle`, `onCleanup`), which re-exports these.

const cleanups: (() => void)[] = [];

/** Registers `cleanup` to run at `runCleanups()` (the file's `afterEach`, or the setup file's). */
export function onCleanup(cleanup: () => void): void {
  cleanups.push(cleanup);
}

/**
 * Runs the registered cleanups in order and forgets them. Files call it in their `afterEach`
 * where the order against their other teardown matters; vitest.setup.ts calls it after the
 * unmount for everything left.
 */
export function runCleanups(): void {
  for (const cleanup of cleanups.splice(0)) cleanup();
}
