// The Viewport's per-toast timers (design/components/toast.md 6). No "use client" directive: pure
// (conventions 7.1); the Viewport keeps the map in a ref.
import type { Entry } from "./toast-queue.js";

export interface ToastTimer {
  /** The duration the timer was started with; a different effective duration restarts it. */
  readonly duration: number;
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

export interface TimerSync {
  /** A viewport-wide pause holds, or the Viewport is not mounted: no timer runs. */
  readonly halted: boolean;
  /** Toasts whose content suspends: their timer waits. */
  readonly suspended: ReadonlySet<string>;
  /** The Viewport's `duration`. */
  readonly defaultDuration: number | null;
  /** A timer ran out. */
  readonly expire: (id: string) => void;
}

/** A toast's own `duration`, else none with an action (it waits for the user), else the default. */
function effectiveDuration(entry: Entry, defaultDuration: number | null): number | null {
  const own = entry.options.duration;
  if (own !== undefined) return own;
  return entry.options.action !== undefined ? null : defaultDuration;
}

/**
 * Matches the timers to the rendered entries: starts or resumes the timer of each open, timed
 * toast that is not pending, suspended or halted, pauses the others keeping their remaining
 * time, and drops the timers of toasts no longer rendered (or no longer timed).
 */
export function syncToastTimers(
  map: Map<string, ToastTimer>,
  visible: readonly Entry[],
  sync: TimerSync,
): void {
  const now = Date.now();
  const live = new Set<string>();
  for (const entry of visible) {
    if (entry.ending) continue;
    const id = entry.options.id;
    const ms = effectiveDuration(entry, sync.defaultDuration);
    if (ms === null) continue;
    live.add(id);
    let timer = map.get(id);
    if (timer === undefined || timer.duration !== ms) {
      if (timer?.handle != null) clearTimeout(timer.handle);
      timer = { duration: ms, remaining: ms, startedAt: 0, handle: null };
      map.set(id, timer);
    }
    const run = !sync.halted && !entry.item.pending && !sync.suspended.has(id);
    if (run && timer.handle === null) {
      const current = timer;
      current.startedAt = now;
      current.handle = setTimeout(
        () => {
          current.handle = null;
          current.remaining = 0;
          sync.expire(id);
        },
        Math.max(0, current.remaining),
      );
    } else if (!run && timer.handle !== null) {
      clearTimeout(timer.handle);
      timer.handle = null;
      timer.remaining -= now - timer.startedAt;
    }
  }
  for (const [id, timer] of map) {
    if (live.has(id)) continue;
    if (timer.handle !== null) clearTimeout(timer.handle);
    map.delete(id);
  }
}

/** Stops and forgets the timer of `id`, or every timer. */
export function clearToastTimers(map: Map<string, ToastTimer>, id?: string): void {
  for (const [key, timer] of map) {
    if (id !== undefined && key !== id) continue;
    if (timer.handle !== null) clearTimeout(timer.handle);
    map.delete(key);
  }
}
