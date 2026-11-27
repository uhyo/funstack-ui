// No directive: pure DOM reads (conventions 7.1).
import { isPopoverOpen } from "./popover-open.js";

/**
 * Whether a layer open inside `container` takes this Escape before the container's own JS
 * listener (conventions 15, innermost first): any shown popover (an `auto` one's close watcher,
 * a `manual` HoverCard or Tooltip whose document listener runs later), an open modal dialog, or
 * an open non-modal dialog that `event` came from (it decides its Escape after the document
 * listeners, dialog.md 2.6, #177). Walks the elements and asks each, rather than one
 * `querySelector(":popover-open")`, which the jsdom shim cannot answer. HoverCard (2.6) and
 * Toast stand down on it.
 */
export function containsOpenLayer(container: Element, event: Event): boolean {
  for (const element of container.querySelectorAll("[popover]")) {
    if (isPopoverOpen(element)) return true;
  }
  const target = event.target;
  for (const dialog of container.querySelectorAll("dialog")) {
    if (!dialog.open) continue;
    if (isModal(dialog)) return true;
    if (target instanceof Node && dialog.contains(target)) return true;
  }
  return false;
}

function isModal(dialog: HTMLDialogElement): boolean {
  try {
    return dialog.matches(":modal");
  } catch {
    return false;
  }
}
