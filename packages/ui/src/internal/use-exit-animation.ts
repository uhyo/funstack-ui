"use client";
import { startTransition, useRef, useState } from "react";

/** An animation that ends: infinite ones (a spinner) would hold the content forever. */
function ends(animation: Animation): boolean {
  const end = animation.effect?.getComputedTiming().endTime;
  return typeof end === "number" && Number.isFinite(end);
}

/**
 * The running exit animations of a top-layer element that has just been hidden, read after a
 * style flush so that `transition-behavior: allow-discrete` exits exist. Empty where the engine
 * does not animate the exit (Firefox) or there is no CSS exit.
 */
export function exitAnimations(element: Element): Animation[] {
  if (!element.isConnected || typeof element.getAnimations !== "function") return [];
  void getComputedStyle(element).opacity;
  return element.getAnimations({ subtree: true }).filter(ends);
}

export interface ExitAnimation {
  /** Keep the content mounted (design/components/popover.md 4.4). */
  readonly held: boolean;
  /** Set `held` now (urgent, library-internal) and clear it when `animations` settle. */
  readonly holdUntil: (animations: readonly Animation[]) => void;
  /** Clear `held` now, in a transition, cancelling any wait in progress. */
  readonly release: () => void;
  /** Set `held` during render (the "previous value in state" pattern). */
  readonly holdDuringRender: () => void;
  /** Whether a `holdUntil` wait is still running. Handlers and effects only. */
  readonly waiting: () => boolean;
}

/**
 * The deferred unmount of a top-layer popup's content while its hide animates. The commit that
 * clears `held` carries no `fsui-*` transition types: the popup is already hidden, nothing
 * visible changes.
 */
export function useExitAnimation(): ExitAnimation {
  const [held, setHeld] = useState(false);
  // The generation of the wait in progress, or null; a newer wait supersedes an older one.
  const wait = useRef<number | null>(null);
  const generation = useRef(0);

  const holdUntil = (animations: readonly Animation[]): void => {
    const current = ++generation.current;
    wait.current = current;
    setHeld(true);
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (generation.current !== current) return;
      wait.current = null;
      startTransition(() => setHeld(false));
    });
  };

  const release = (): void => {
    generation.current++;
    wait.current = null;
    startTransition(() => setHeld(false));
  };

  return {
    held,
    holdUntil,
    release,
    holdDuringRender: () => setHeld(true),
    waiting: () => wait.current !== null,
  };
}
