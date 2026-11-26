// The swipe tracker (design/components/drawer.md 4.1, 9): Pointer Events bookkeeping for a drag
// of an element toward one of its edges, for mouse, pen and touch alike. It knows nothing of
// dialogs: the caller says which presses are candidates, which way the edge is and how far it
// is, and gets `start`, `move(offset)` and `end` callbacks. Drawer uses it; Toast's reserved
// swipe (toast.md 9.2) is meant to. No directive: DOM listeners only (conventions 7.1).
import { capturePointer } from "./pointer-capture.js";
import {
  classifyPress,
  releaseOutcome,
  releaseVelocity,
  swipeOffset,
  swipeProgress,
  towardEdge,
} from "./swipe-arithmetic.js";
import type { SwipeDirection, SwipeSample } from "./swipe-arithmetic.js";

/** How a gesture that started ended. */
export interface SwipeEnd {
  /**
   * `"dismiss"`: released past the threshold or with a flick toward the edge. `"return"`:
   * released short of it, or moving back. `"cancel"`: the browser took the pointer
   * (`pointercancel`), the capture was lost, or another primary press came.
   */
  readonly outcome: "dismiss" | "return" | "cancel";
  /** The `pointerup`, the `pointercancel` or `lostpointercapture`, or the new press. */
  readonly event: Event;
  /** The offset reached, px. */
  readonly offset: number;
  /** The extent measured at the start, px. */
  readonly extent: number;
}

export interface SwipeTrackerOptions {
  /**
   * Whether a primary-button press can become a swipe, at the `pointerdown` (capture phase on
   * the element). Return the direction of the edge, or `null` for a press that is not a
   * candidate.
   */
  readonly press: (event: PointerEvent) => SwipeDirection | null;
  /**
   * The distance (px) that takes the element fully off its edge, measured once when the drag
   * starts, before the first `move`.
   */
  readonly extent: () => number;
  /** The drag started (the pointer is captured); `move` follows at once with the first offset. */
  readonly start: (event: PointerEvent) => void;
  /** The offset toward the edge (px, never below 0) and its fraction of the extent. */
  readonly move: (offset: number, progress: number, event: PointerEvent) => void;
  /** The drag ended. Not called for `cancel()` or `dispose()`. */
  readonly end: (end: SwipeEnd) => void;
}

export interface SwipeTracker {
  /** Whether a drag is in progress (between `start` and `end`). */
  readonly dragging: () => boolean;
  /** Drop the press or the drag without calling `end` (the caller ends it its own way). */
  readonly cancel: () => void;
  /** Remove every listener. */
  readonly dispose: () => void;
}

interface Press {
  readonly event: PointerEvent;
  readonly direction: SwipeDirection;
  readonly selection: SelectionSnapshot | null;
  /** Another element took the pointer's capture after the press (a slider thumb, a map). */
  capturedElsewhere: boolean;
  dragging: boolean;
  extent: number;
  offset: number;
  samples: SwipeSample[];
}

interface SelectionSnapshot {
  readonly anchorNode: Node | null;
  readonly anchorOffset: number;
  readonly focusNode: Node | null;
  readonly focusOffset: number;
}

/** The document's selection when it is not collapsed, else `null`. */
function selectionOf(doc: Document): SelectionSnapshot | null {
  const selection = doc.getSelection();
  if (selection === null || selection.isCollapsed) return null;
  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
  return { anchorNode, anchorOffset, focusNode, focusOffset };
}

/** Whether the press made a text selection: one exists now and it is not the one it found. */
function selectedSincePress(doc: Document, before: SelectionSnapshot | null): boolean {
  const now = selectionOf(doc);
  if (now === null) return false;
  return (
    before === null ||
    now.anchorNode !== before.anchorNode ||
    now.anchorOffset !== before.anchorOffset ||
    now.focusNode !== before.focusNode ||
    now.focusOffset !== before.focusOffset
  );
}

/**
 * Tracks swipes on `element`. A primary press the caller accepts is only recorded: no capture,
 * no `preventDefault()`, so a tap, a click and a text selection are untouched. When it has
 * moved `SWIPE_SLOP` px, more along the axis than across and toward the edge, it becomes a drag
 * (the pointer is captured on `element`) unless the press's `pointerdown` was
 * `defaultPrevented` (read then, so a handler that ran after the capture-phase listener
 * counts), another element took the pointer's capture, or a mouse press made a text selection.
 * A first move in another direction drops the press.
 */
export function trackSwipe(element: HTMLElement, options: SwipeTrackerOptions): SwipeTracker {
  const doc = element.ownerDocument;
  let press: Press | null = null;

  const detachPress = (): void => {
    doc.removeEventListener("pointermove", onMove, true);
    doc.removeEventListener("pointerup", onUp, true);
    doc.removeEventListener("pointercancel", onCancel, true);
    doc.removeEventListener("gotpointercapture", onGotCapture, true);
    element.removeEventListener("lostpointercapture", onLostCapture);
  };

  /** Forget the press; release the capture of a drag that did not end with the button. */
  const clear = (): void => {
    const current = press;
    press = null;
    detachPress();
    if (current?.dragging) {
      const id = current.event.pointerId;
      try {
        if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
      } catch {
        // Not an active pointer any more.
      }
    }
  };

  const finish = (outcome: SwipeEnd["outcome"], event: Event): void => {
    const current = press;
    if (current === null || !current.dragging) {
      clear();
      return;
    }
    const { offset, extent } = current;
    clear();
    options.end({ outcome, event, offset, extent });
  };

  const onDown = (event: PointerEvent): void => {
    if (press !== null) {
      // A second primary press (another pointer type) ends what the first one did.
      if (event.isPrimary && event.pointerId !== press.event.pointerId) finish("cancel", event);
      else return;
    }
    if (!event.isPrimary || event.button !== 0) return;
    const direction = options.press(event);
    if (direction === null) return;
    press = {
      event,
      direction,
      selection: event.pointerType === "mouse" ? selectionOf(doc) : null,
      capturedElsewhere: false,
      dragging: false,
      extent: 0,
      offset: 0,
      // The motion starts at the press: an engine may coalesce a flick's moves into the one
      // `pointermove` that starts the drag, and the velocity must still see the whole flick.
      samples: [{ time: event.timeStamp, toward: 0 }],
    };
    doc.addEventListener("pointermove", onMove, true);
    doc.addEventListener("pointerup", onUp, true);
    doc.addEventListener("pointercancel", onCancel, true);
    doc.addEventListener("gotpointercapture", onGotCapture, true);
  };

  const onGotCapture = (event: Event): void => {
    const current = press;
    if (current === null || current.dragging) return;
    if ((event as PointerEvent).pointerId !== current.event.pointerId) return;
    const target = event.target;
    if (target === element) return;
    // Touch and pen capture the pointer to the pressed element implicitly (Pointer Events 3).
    if (current.event.pointerType !== "mouse" && target === current.event.target) return;
    current.capturedElsewhere = true;
  };

  /** The press becomes a drag, or is dropped (`false`). */
  const tryStart = (current: Press, event: PointerEvent): boolean => {
    if (current.event.defaultPrevented || current.capturedElsewhere) return false;
    if (current.event.pointerType === "mouse" && selectedSincePress(doc, current.selection)) {
      return false;
    }
    if (!capturePointer(element, current.event.pointerId)) return false;
    current.dragging = true;
    current.extent = options.extent();
    element.addEventListener("lostpointercapture", onLostCapture);
    options.start(event);
    return true;
  };

  const follow = (current: Press, event: PointerEvent): void => {
    const toward = towardEdge(
      event.clientX - current.event.clientX,
      event.clientY - current.event.clientY,
      current.direction,
    );
    current.samples.push({ time: event.timeStamp, toward });
    current.offset = swipeOffset(toward);
    // Firefox keeps extending the text selection of the press under pointer capture: a drag
    // moves, it does not select (Chromium selects nothing once captured).
    if (current.event.pointerType === "mouse" && selectedSincePress(doc, current.selection)) {
      doc.getSelection()?.removeAllRanges();
    }
    options.move(current.offset, swipeProgress(current.offset, current.extent), event);
  };

  const onMove = (event: PointerEvent): void => {
    const current = press;
    if (current === null || event.pointerId !== current.event.pointerId) return;
    if (!current.dragging) {
      const verdict = classifyPress(
        event.clientX - current.event.clientX,
        event.clientY - current.event.clientY,
        current.direction,
      );
      if (verdict === "wait") return;
      if (verdict === "drop" || !tryStart(current, event)) {
        clear();
        return;
      }
    }
    follow(current, event);
  };

  const onUp = (event: PointerEvent): void => {
    const current = press;
    if (current === null || event.pointerId !== current.event.pointerId) return;
    if (!current.dragging) {
      clear();
      return;
    }
    // The release position is the gesture's last (an engine may coalesce the final move into
    // the `pointerup`).
    follow(current, event);
    const velocity = releaseVelocity(current.samples);
    finish(releaseOutcome(current.offset, current.extent, velocity), event);
  };

  const onCancel = (event: PointerEvent): void => {
    if (press === null || event.pointerId !== press.event.pointerId) return;
    finish("cancel", event);
  };

  const onLostCapture = (event: PointerEvent): void => {
    if (press === null || event.pointerId !== press.event.pointerId) return;
    // The `pointerup` comes first (it releases the capture after its dispatch), so this is a
    // capture taken away mid-drag.
    finish("cancel", event);
  };

  element.addEventListener("pointerdown", onDown, true);

  return {
    dragging: () => press?.dragging ?? false,
    cancel: clear,
    dispose: () => {
      clear();
      element.removeEventListener("pointerdown", onDown, true);
    },
  };
}
