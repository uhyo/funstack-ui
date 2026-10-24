// The Viewport's queue model (design/components/toast.md 8, 12): entries, their public items, and
// which of them render. No "use client" directive: pure (conventions 7.1).
import type { ToastItem, ToastOptions } from "./toast.js";

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
