// The playground's pretend backend. Calls log to the console so you can follow them there.

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Fake save: resolves after `ms` (800 by default); rejects when asked to. */
export async function fakeSave(
  label: string,
  value: unknown,
  { ms = 800, fail = false }: { ms?: number; fail?: boolean } = {},
): Promise<void> {
  console.log(`[${label}] saving ${JSON.stringify(value)}`);
  await sleep(ms);
  if (fail) throw new Error(`[${label}] the server rejected ${JSON.stringify(value)}`);
  console.log(`[${label}] saved ${JSON.stringify(value)}`);
}
