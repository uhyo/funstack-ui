"use client";
import { useRef, useState } from "react";

/** An animation that ends: infinite ones (a spinner) would hold the content forever. */
function ends(animation: Animation): boolean {
  const end = animation.effect?.getComputedTiming().endTime;
  return typeof end === "number" && Number.isFinite(end);
}

/**
 * The animations running in an element's subtree right before it closes (the synchronous
 * `beforetoggle` of the hide, Toast's `data-ending` write): the baseline that `exitAnimations`
 * excludes, so a finite animation already running inside (a progress bar) does not hold the exit
 * (Toast 10.2). Empty where `getAnimations` is absent (jsdom).
 */
export function animationBaseline(element: Element): ReadonlySet<Animation> {
  if (!element.isConnected || typeof element.getAnimations !== "function") return new Set();
  return new Set(element.getAnimations({ subtree: true }));
}

/**
 * The running exit animations of a top-layer element that has just been hidden, read after a
 * style flush so that `transition-behavior: allow-discrete` exits exist, minus the `baseline`
 * of animations that were already running before the close. Empty where the engine does not
 * animate the exit (Firefox) or there is no CSS exit.
 */
export function exitAnimations(element: Element, baseline?: ReadonlySet<Animation>): Animation[] {
  if (!element.isConnected || typeof element.getAnimations !== "function") return [];
  void getComputedStyle(element).opacity;
  return element
    .getAnimations({ subtree: true })
    .filter((animation) => ends(animation) && !(baseline?.has(animation) ?? false));
}

export interface ExitAnimation {
  /** Keep the content mounted (design/components/popover.md 4.4). */
  readonly held: boolean;
  /** Set `held` now (urgent, library-internal) and clear it when `animations` settle. */
  readonly holdUntil: (animations: readonly Animation[]) => void;
  /** Clear `held` now (a normal update, never a transition), cancelling any wait in progress. */
  readonly release: () => void;
  /** Set `held` during render (the "previous value in state" pattern). */
  readonly holdDuringRender: () => void;
  /** Whether a `holdUntil` wait is still running. Handlers and effects only. */
  readonly waiting: () => boolean;
  /**
   * Record the animations already running in `element`'s subtree. Call from the synchronous
   * `beforetoggle` of a close, before the hide starts the exit.
   */
  readonly recordBaseline: (element: Element) => void;
  /** `exitAnimations(element)` minus the recorded baseline, which it consumes. */
  readonly exitAnimations: (element: Element) => Animation[];
}

/**
 * The deferred unmount of a top-layer popup's content while its hide animates. `held` is cleared
 * with a normal (urgent) update, never in a transition: the popup is already hidden, nothing
 * visible changes, and only transition commits start a document view transition, so a dismissal
 * runs one (its notification commit) instead of two (design 4.4).
 */
export function useExitAnimation(): ExitAnimation {
  const [held, setHeld] = useState(false);
  // The generation of the wait in progress, or null; a newer wait supersedes an older one.
  const wait = useRef<number | null>(null);
  const generation = useRef(0);
  // The animations running right before the latest close, consumed by `exitAnimations`.
  const baseline = useRef<ReadonlySet<Animation> | null>(null);

  const holdUntil = (animations: readonly Animation[]): void => {
    const current = ++generation.current;
    wait.current = current;
    setHeld(true);
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (generation.current !== current) return;
      wait.current = null;
      setHeld(false);
    });
  };

  const release = (): void => {
    generation.current++;
    wait.current = null;
    setHeld(false);
  };

  return {
    held,
    holdUntil,
    release,
    holdDuringRender: () => setHeld(true),
    waiting: () => wait.current !== null,
    recordBaseline: (element) => {
      baseline.current = animationBaseline(element);
    },
    exitAnimations: (element) => {
      const recorded = baseline.current ?? undefined;
      baseline.current = null;
      return exitAnimations(element, recorded);
    },
  };
}
