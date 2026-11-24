// No directive: a pure DOM read (conventions 7.1).

/**
 * Whether `element` is a showing popover (`:popover-open`). `false` for `null` and where the
 * selector is unsupported (it throws there, for example on a `render` element in an engine
 * without the Popover API).
 */
export function isPopoverOpen(element: Element | null): boolean {
  if (element === null) return false;
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
}
