// The Viewport's queue model (design/components/toast.md 8, 12): entries, their public items, and
// which of them render. No "use client" directive: pure (conventions 7.1).
import type { ToastCommand, ToastItem, ToastOptions } from "./toast.js";

/** One queue entry: the toast's options and the flags its `ToastItem` is built from. */
export interface Entry {
  readonly options: ToastOptions & { readonly id: string };
  readonly promisePending: boolean;
  readonly actionPending: boolean;
  readonly ending: boolean;
  /** The public item, rebuilt whenever any of the above changes (stable identity otherwise). */
  readonly item: ToastItem;
}

export function makeEntry(
  options: ToastOptions & { readonly id: string },
  flags: { promisePending: boolean; actionPending: boolean; ending: boolean },
): Entry {
  return {
    options,
    ...flags,
    item: {
      ...options,
      id: options.id,
      pending: flags.promisePending || flags.actionPending,
      ending: flags.ending,
    },
  };
}

export function withFlags(
  entry: Entry,
  flags: Partial<{ promisePending: boolean; actionPending: boolean; ending: boolean }>,
): Entry {
  return makeEntry(entry.options, {
    promisePending: flags.promisePending ?? entry.promisePending,
    actionPending: flags.actionPending ?? entry.actionPending,
    ending: flags.ending ?? entry.ending,
  });
}

/** Rendered entries (the first `limit` open ones plus every ending one) and the queued count. */
export function partition(
  entries: readonly Entry[],
  limit: number,
): { visible: Entry[]; queued: Entry[] } {
  const visible: Entry[] = [];
  const queued: Entry[] = [];
  let open = 0;
  for (const entry of entries) {
    if (entry.ending) visible.push(entry);
    else if (open < limit) {
      visible.push(entry);
      open++;
    } else queued.push(entry);
  }
  return { visible, queued };
}

/** Plain text of a `ReactNode` that is text (queued toasts have no DOM to read yet). */
export function plainText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  return "";
}

export interface AppliedCommands {
  readonly next: readonly Entry[];
  /** The open toasts the batch dismissed, in order (their `closeAction`s run). */
  readonly dismissed: readonly Entry[];
  /** Dismissed ids that leave the DOM: not those replaced by a later add with the id. */
  readonly leaving: ReadonlySet<string>;
  /**
   * Ids whose announcement and exit baseline start over: dismissed before they rendered, or an
   * ending toast replaced by a new one with its id (listed in `replaced` too).
   */
  readonly forgotten: readonly string[];
  /** Ending toasts replaced by a new add with their id: their timer starts over. */
  readonly replaced: readonly string[];
  /** The batch added a toast (the region re-raises). */
  readonly added: boolean;
  /** Ids of updates that found no toast (a promise settle excepted). */
  readonly missing: readonly string[];
}

/**
 * Applies a batch of manager commands to the queue. Dismissals apply in order: each closes the
 * toasts open at that point of the batch, never one added after it. A dismissed toast with a
 * rendered Root (`isRendered`) turns ending; one never rendered (queued beyond `limit`, or added
 * in this tick) leaves at once instead of mounting once as an ending Root. An add with the id of
 * an open toast updates it ("one toast per key"); with the id of an ending one it replaces it
 * (the keyed Root may be reused): a fresh timer, a fresh announcement, no exit.
 */
export function applyCommands(
  entries: readonly Entry[],
  commands: readonly ToastCommand[],
  isRendered: (id: string) => boolean,
): AppliedCommands {
  const next = [...entries];
  const dismissed: Entry[] = [];
  const forgotten: string[] = [];
  const replaced: string[] = [];
  const missing: string[] = [];
  let added = false;
  for (const command of commands) {
    if (command.kind === "dismiss") {
      for (let i = 0; i < next.length; i++) {
        const entry = next[i]!;
        if (entry.ending) continue;
        const id = entry.options.id;
        if (command.id !== undefined && id !== command.id) continue;
        dismissed.push(entry);
        if (isRendered(id)) {
          next[i] = withFlags(entry, { ending: true });
        } else {
          next.splice(i--, 1);
          forgotten.push(id);
        }
      }
      continue;
    }
    const index = next.findIndex((e) => e.options.id === command.id);
    const existing = index === -1 ? undefined : next[index]!;
    if (command.kind === "add") {
      const options = { ...command.options, id: command.id };
      if (existing !== undefined && !existing.ending) {
        next[index] = makeEntry(
          { ...existing.options, ...options },
          {
            promisePending: command.pending || existing.promisePending,
            actionPending: existing.actionPending,
            ending: false,
          },
        );
        continue;
      }
      if (existing !== undefined) {
        next.splice(index, 1);
        replaced.push(command.id);
        forgotten.push(command.id);
      }
      next.push(
        makeEntry(options, {
          promisePending: command.pending,
          actionPending: false,
          ending: false,
        }),
      );
      added = true;
    } else {
      if (existing === undefined) {
        if (!command.settle) missing.push(command.id);
        continue;
      }
      if (existing.ending) continue;
      const options = command.settle
        ? { ...command.options, id: command.id }
        : { ...existing.options, ...command.options, id: command.id };
      next[index] = makeEntry(options, {
        promisePending: command.settle ? false : existing.promisePending,
        actionPending: existing.actionPending,
        ending: false,
      });
    }
  }
  const stays = new Set(next.filter((e) => !e.ending).map((e) => e.options.id));
  const leaving = new Set(dismissed.map((e) => e.options.id).filter((id) => !stays.has(id)));
  return { next, dismissed, leaving, forgotten, replaced, added, missing };
}
