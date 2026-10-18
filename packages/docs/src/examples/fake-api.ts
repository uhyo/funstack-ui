// A pretend backend for the live examples. Nothing leaves the browser.

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves after `ms`; rejects instead when `fail` is set. */
export async function fakeSave(what: string, { ms = 800, fail = false } = {}): Promise<void> {
  await sleep(ms);
  if (fail) throw new Error(`The server rejected ${what}.`);
}

export interface UploadProgress {
  readonly sent: number;
  readonly total: number;
}

/**
 * A pretend upload: the size is known after 600 ms, then 12 chunks arrive 180 ms apart. Yields
 * the bytes sent so far.
 */
export async function* fakeUpload(_name: string): AsyncGenerator<UploadProgress> {
  await sleep(600);
  const total = 8_400_000;
  for (let chunk = 0; chunk <= 12; chunk++) {
    yield { sent: (total * chunk) / 12, total };
    if (chunk < 12) await sleep(180);
  }
}
