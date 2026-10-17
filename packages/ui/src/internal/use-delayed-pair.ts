"use client";
import { useEffect, useState } from "react";

/**
 * An open timer and a close timer that exclude each other: scheduling one cancels the other, so a
 * hover that leaves before the open delay elapses never opens, and coming back before the close
 * delay elapses never closes. Shared by Tooltip's JS path and Menu's submenu hover intent
 * (design/components/menu.md 7).
 */
export interface DelayedPair {
  /** Run `callback` after `delay` ms, replacing any pending open or close. */
  readonly open: (delay: number, callback: () => void) => void;
  /** Run `callback` after `delay` ms, replacing any pending open or close. */
  readonly close: (delay: number, callback: () => void) => void;
  /** Cancel a pending close only (a pending open keeps running). */
  readonly cancelClose: () => void;
  /** Cancel whatever is pending. */
  readonly cancel: () => void;
}

/** Plain factory, for code that owns its timers inside an effect (Tooltip). */
export function createDelayedPair(): DelayedPair {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let kind: "open" | "close" | undefined;

  const cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    kind = undefined;
  };
  const schedule = (next: "open" | "close", delay: number, callback: () => void): void => {
    cancel();
    kind = next;
    timer = setTimeout(() => {
      timer = undefined;
      kind = undefined;
      callback();
    }, delay);
  };

  return {
    open: (delay, callback) => schedule("open", delay, callback),
    close: (delay, callback) => schedule("close", delay, callback),
    cancelClose: () => {
      if (kind === "close") cancel();
    },
    cancel,
  };
}

/** One `DelayedPair` per component instance, cancelled on unmount. */
export function useDelayedPair(): DelayedPair {
  const [pair] = useState(createDelayedPair);
  useEffect(() => pair.cancel, [pair]);
  return pair;
}
