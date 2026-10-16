// A pretend backend for the live examples. Nothing leaves the browser.

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves after `ms`; rejects instead when `fail` is set. */
export async function fakeSave(what: string, { ms = 800, fail = false } = {}): Promise<void> {
  await sleep(ms);
  if (fail) throw new Error(`The server rejected ${what}.`);
}
