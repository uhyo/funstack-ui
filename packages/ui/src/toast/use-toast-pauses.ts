"use client";
import { useCallback, useRef, useState } from "react";
import { useLatest } from "../internal/use-latest.js";

/** The viewport-wide pause sources (design/components/toast.md 6). */
export interface PauseSources {
  hover: boolean;
  focus: boolean;
  hidden: boolean;
  blurred: boolean;
}

function anyPause(sources: PauseSources): boolean {
  return sources.hover || sources.focus || sources.hidden || sources.blurred;
}

export interface ToastPauses {
  /** A pause holds, as of the last write (state, for `data-paused` and the Viewport's state). */
  readonly paused: boolean;
  /** Whether `source` holds now. Handlers and effects only. */
  readonly holding: (source: keyof PauseSources) => boolean;
  /** Whether any source holds now (the timers are halted). Handlers and effects only. */
  readonly anyHeld: () => boolean;
  /**
   * Sets a source. A change re-syncs the timers synchronously, in the event, before any timer
   * callback can run (design 14 item 9), then publishes `paused`.
   */
  readonly setPause: (source: keyof PauseSources, value: boolean) => void;
  /**
   * Reads the document's visibility, listens to it and to the window's own focus and blur, and
   * publishes `paused`. Returns the cleanup. For the Viewport's mount effect; stable.
   */
  readonly watch: (doc: Document) => () => void;
}

/**
 * The pause sources of `Toast.Viewport` (design/components/toast.md 6): the pointer over the
 * region, focus inside it, a hidden document, a blurred window. `syncTimers` re-syncs the timers
 * after a change.
 */
export function useToastPauses(syncTimers: () => void): ToastPauses {
  const sources = useRef<PauseSources>({
    hover: false,
    focus: false,
    hidden: false,
    blurred: false,
  });
  const [paused, setPaused] = useState(false);

  const setPause = (source: keyof PauseSources, value: boolean): void => {
    if (sources.current[source] === value) return;
    sources.current[source] = value;
    // Applied synchronously in the event, before any timer callback can run (design 14 item 9).
    syncTimers();
    setPaused(anyPause(sources.current));
  };
  const setPauseRef = useLatest(setPause);

  // Stable, so the Viewport's mount effect does not re-run for it.
  const watch = useCallback(
    (doc: Document): (() => void) => {
      const view = doc.defaultView ?? window;
      sources.current.hidden = doc.visibilityState === "hidden";
      const onVisibility = (): void =>
        setPauseRef.current("hidden", doc.visibilityState === "hidden");
      // The window's own focus and blur; an element's (which do not bubble) never reach here.
      const onWindowBlur = (event: Event): void => {
        if (!(event.target instanceof Node)) setPauseRef.current("blurred", true);
      };
      const onWindowFocus = (event: Event): void => {
        if (!(event.target instanceof Node)) setPauseRef.current("blurred", false);
      };
      doc.addEventListener("visibilitychange", onVisibility);
      view.addEventListener("blur", onWindowBlur);
      view.addEventListener("focus", onWindowFocus);
      setPaused(anyPause(sources.current));
      return () => {
        doc.removeEventListener("visibilitychange", onVisibility);
        view.removeEventListener("blur", onWindowBlur);
        view.removeEventListener("focus", onWindowFocus);
      };
    },
    [setPauseRef],
  );

  return {
    paused,
    holding: (source) => sources.current[source],
    anyHeld: () => anyPause(sources.current),
    setPause,
    watch,
  };
}
