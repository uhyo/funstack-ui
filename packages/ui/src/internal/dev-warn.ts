// No "use client": usable during the render of a directive-free part that may run as a Server
// Component, where an effect (`useDevWarning`) never runs (design/components/progress.md 8.1,
// implementation note 14.3).

const isDev = process.env.NODE_ENV !== "production";

const seen = new Set<string>();

/**
 * Logs `message` through `console.error` once per `key` in development. Called during render,
 * so a discarded render may warn; keys name the part and the condition (a Server Component has
 * no element identity to key on).
 */
export function warnOnce(key: string, message: string): void {
  if (!isDev || seen.has(key)) return;
  seen.add(key);
  console.error(message);
}

/** Tests only: forget every key, so the next `warnOnce` warns again. */
export function resetWarnOnce(): void {
  seen.clear();
}
