"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefCallback } from "react";
import { flushSync } from "react-dom";
import { parsePositionArea, POSITION_TRY_FALLBACKS, positionArea } from "./anchor-position.js";
import type {
  AnchorAlign,
  AnchorSide,
  Direction,
  PhysicalSide,
  ResolvedPlacement,
} from "./anchor-position.js";
import { isPopoverOpen } from "./popover-open.js";
import { resolveStateValue } from "./render-element.js";
import type { DataAttributes } from "./render-element.js";
import type { StateValue } from "./types.js";

export interface PlacementRequest<Side extends AnchorSide> {
  /** The requested side; `null` when the stylesheet owns placement (the hook is idle). */
  readonly side: Side | null;
  readonly align: AnchorAlign;
}

export interface PlacementResult<Side extends AnchorSide> {
  /** The resolved physical side while the popup is shown, else the requested side. */
  readonly side: Side | PhysicalSide | null;
  /** The resolved alignment while shown, else the requested one. */
  readonly align: AnchorAlign;
  /** Merge into the popup element's ref. Stable. */
  readonly ref: RefCallback<HTMLElement>;
}

const toDirection = (value: string): Direction => (value === "rtl" ? "rtl" : "ltr");

/**
 * Where the browser actually placed an anchored popup (design/conventions.md 13.2): the
 * `position-try-fallbacks` option it applied, read from `getComputedStyle(popup).positionArea`
 * while the popup is shown and parsed into a physical side and an alignment. Observation, not
 * positioning: the browser keeps placing the popup; this only reports where.
 *
 * Sources: a `ResizeObserver` on the popup from mount (hidden to shown is a resize, delivered
 * after layout and before paint, so the first painted frame carries the resolved side), `toggle`
 * (and the jsdom shim's), and while shown `scroll` on the document (capture, passive: nested
 * scrollers too) and `resize` on the window, each read at once and again in the next two
 * animation frames (an engine applies the option a scroll calls for only in the layout after the
 * event). The write is urgent (`flushSync`, so the attribute lands before paint; conventions 3.5)
 * and happens only when the rendered pair would change: a popup with a physical `side` that opens
 * where it was asked costs no render (the state holds `null` then). A logical side
 * (`inline-start` / `inline-end`) costs one render on show and one on hide, because `data-side`
 * turns physical while shown. Hidden again resets to the requested values, once the popup no
 * longer renders (an exit animation keeps the resolved side to its end).
 *
 * Idle with `side: null` (a stylesheet's `@position-try` rules may set insets the parser cannot
 * interpret): no reads, the result's `side` is `null`. Runs whatever opened the popup, the
 * native `interestfor` and `commandfor` paths included.
 */
export function useResolvedPlacement<Side extends AnchorSide>(
  request: PlacementRequest<Side>,
): PlacementResult<Side> {
  const { side, align } = request;
  const [resolved, setResolved] = useState<ResolvedPlacement | null>(null);
  // What the state holds (or is about to hold), so an unchanged read schedules nothing.
  const written = useRef<ResolvedPlacement | null>(null);
  // The request the element is rendered with (kept by the layout effect below).
  const requested = useRef<PlacementRequest<Side>>(request);
  // The mounted element's read, for the layout effect below.
  const sync = useRef<((urgent: boolean) => void) | null>(null);

  const ref = useCallback((element: HTMLElement | null) => {
    if (element === null) return;
    const doc = element.ownerDocument;
    const win = doc.defaultView ?? window;

    const write = (value: ResolvedPlacement | null, urgent: boolean) => {
      // Where it was asked to be: the requested values say so already, no state needed.
      const next =
        value !== null &&
        value.side === requested.current.side &&
        value.align === requested.current.align
          ? null
          : value;
      const previous = written.current;
      if (
        previous === next ||
        (previous !== null &&
          next !== null &&
          previous.side === next.side &&
          previous.align === next.align)
      ) {
        return;
      }
      written.current = next;
      if (urgent) flushSync(() => setResolved(next));
      else setResolved(next);
    };

    let listening = false;
    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        doc.addEventListener("scroll", onMove, { capture: true, passive: true });
        win.addEventListener("resize", onMove);
      } else {
        doc.removeEventListener("scroll", onMove, { capture: true });
        win.removeEventListener("resize", onMove);
        cancelFrames();
      }
    };

    // Both engines (Chromium 156, Firefox 157) apply the scroll-dependent anchoring state, the
    // option and the scroll-compensated geometry alike, in the layout of the frame after the
    // `scroll` event: a read in the handler, or in a rAF registered from it (which runs before
    // that layout), sees the old option even after a forced layout. The timing is unspecified
    // (css-anchor-position-1 §3.3 issue), so read again in the next two frames; a scroll that
    // arrives while that is pending restarts it at the end, so the last scroll is always followed.
    // Separately, Chromium 156 keeps an overflowing option for a top-layer popover once the first
    // frames after the show have passed (a bug, §6.5; upstream item #92): then no frame reads a
    // new option, and `data-side` correctly keeps reporting the applied one. Do not drop the
    // frame reads "because Chromium does not re-choose": when it does, it lags like Firefox.
    let frame = 0;
    let again = false;
    const cancelFrames = () => {
      if (frame !== 0) win.cancelAnimationFrame(frame);
      frame = 0;
      again = false;
    };
    const readLater = () => {
      if (frame !== 0) {
        again = true;
        return;
      }
      frame = win.requestAnimationFrame(() => {
        read(true);
        // The popup was found hidden (or `side` turned null): `listen(false)` ended the pair.
        if (!listening) return;
        frame = win.requestAnimationFrame(() => {
          frame = 0;
          read(true);
          if (again && listening) {
            again = false;
            readLater();
          }
        });
      });
    };

    const read = (urgent: boolean) => {
      if (requested.current.side === null) {
        listen(false);
        write(null, urgent);
        return;
      }
      if (element.isConnected && isPopoverOpen(element)) {
        listen(true);
        const style = getComputedStyle(element);
        const placement = parsePositionArea(
          style.positionArea,
          toDirection(style.direction),
          () => toDirection(getComputedStyle(doc.documentElement).direction),
          style.writingMode || "horizontal-tb",
        );
        write(placement, urgent);
        return;
      }
      listen(false);
      // Hidden, but still rendered while an exit animation runs: keep the resolved side to the
      // end of it. The ResizeObserver sees the box go and resets then.
      // Nothing written, nothing to reset: skip the forced layout (every mount and request change
      // of a hidden popup comes through here).
      if (
        written.current !== null &&
        (!element.isConnected || element.getClientRects().length === 0)
      ) {
        write(null, urgent);
      }
    };

    function onEvent() {
      read(true);
    }
    function onMove() {
      // In every Chromium 156 / Firefox 157 probe this read still saw the old option (see the
      // frame reads above); kept as cover for WebKit, which was not probed, at the cost of one
      // style read per scroll event.
      read(true);
      if (listening) readLater();
    }

    sync.current = read;
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(onEvent) : null;
    observer?.observe(element);
    element.addEventListener("toggle", onEvent);
    return () => {
      observer?.disconnect();
      element.removeEventListener("toggle", onEvent);
      listen(false);
      if (sync.current === read) sync.current = null;
    };
  }, []);

  // A changed request while shown places the popup differently: read again (a layout effect, so
  // the corrected attribute is in the same frame). Also how `side={null}` turns the hook off.
  useLayoutEffect(() => {
    requested.current = { side, align };
    sync.current?.(false);
  }, [side, align]);

  if (side === null) return { side: null, align, ref };
  return resolved === null ? { side, align, ref } : { ...resolved, ref };
}

export interface AnchoredPlacementRequest<Side extends AnchorSide> extends PlacementRequest<Side> {
  /** `position-try-fallbacks`. Default: flip on both axes. */
  readonly fallbacks?: string;
}

export interface AnchoredPlacement<Side extends AnchorSide> extends PlacementResult<Side> {
  /** `data-side` / `data-align` (resolved); no keys when the side is `null` (not owned then). */
  readonly dataAttributes: DataAttributes;
  /**
   * The popup's `style`: the requested inline placement (the browser keeps choosing from it)
   * under the consumer's style, so the consumer wins. The consumer's style alone for `side: null`.
   */
  readonly style: <State>(
    consumer: StateValue<CSSProperties | undefined, State>,
  ) => StateValue<CSSProperties | undefined, State>;
}

/**
 * An anchored popup's placement (Popover, Tooltip and Menu Popup): `useResolvedPlacement` plus
 * the data attributes and the inline `position-area` / `position-try-fallbacks` it renders.
 */
export function useAnchoredPlacement<Side extends AnchorSide>(
  request: AnchoredPlacementRequest<Side>,
): AnchoredPlacement<Side> {
  const {
    side: requestedSide,
    align: requestedAlign,
    fallbacks = POSITION_TRY_FALLBACKS,
  } = request;
  const placement = useResolvedPlacement({ side: requestedSide, align: requestedAlign });
  const { side, align } = placement;
  const dataAttributes: DataAttributes =
    side !== null ? { "data-side": side, "data-align": align } : {};
  const style = <State>(
    consumer: StateValue<CSSProperties | undefined, State>,
  ): StateValue<CSSProperties | undefined, State> =>
    requestedSide === null
      ? consumer
      : (s: State) => ({
          positionArea: positionArea(requestedSide, requestedAlign),
          positionTryFallbacks: fallbacks,
          ...resolveStateValue(consumer, s),
        });
  return { ...placement, dataAttributes, style };
}
