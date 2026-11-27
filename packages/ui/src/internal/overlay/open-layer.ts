// No directive: pure DOM reads (conventions 7.1).
import { isPopoverOpen } from "./popover-open.js";

/**
 * Whether a layer open inside `container` takes this Escape before the container itself
 * (conventions 15 rule 4, the stand-down snapshot, read when the Escape is recorded): any shown
 * popover (an `auto` one's close watcher, a `manual` HoverCard or Tooltip, a global layer that
 * decides first), an open modal dialog, or an open non-modal dialog that `event` came from (on
 * the event's path: at the window the target is retargeted out of an open shadow root;
 * dialog.md 2.6). Walks the elements and asks each, rather than one
 * `querySelector(":popover-open")`, which the jsdom shim cannot answer. HoverCard (2.6) and
 * Toast stand down on it.
 */
export function containsOpenLayer(container: Element, event: Event): boolean {
  for (const element of container.querySelectorAll("[popover]")) {
    if (isPopoverOpen(element)) return true;
  }
  let path: readonly EventTarget[] | null = null;
  for (const dialog of container.querySelectorAll("dialog")) {
    if (!dialog.open) continue;
    if (isModal(dialog)) return true;
    path ??= event.composedPath();
    if (path.includes(dialog)) return true;
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
