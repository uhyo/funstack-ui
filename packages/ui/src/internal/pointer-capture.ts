// No directive: a pure DOM call (conventions 7.1).

/**
 * `setPointerCapture`, which throws `NotFoundError` for a pointer the engine no longer tracks
 * (context-menu.md 2.1). A silent no-op when no button is down. `true` when the capture was
 * taken (the Menu's press-drag-release gesture runs only then, 2.6). The Combobox Input uses it
 * to keep a press on the field from light-dismissing the listbox (combobox.md 5.4, #123).
 */
export function capturePointer(element: Element | null, pointerId: number | undefined): boolean {
  if (element === null || pointerId === undefined) return false;
  try {
    element.setPointerCapture(pointerId);
    return true;
  } catch {
    // Not an active pointer (a synthetic event, a released button): nothing to capture.
    return false;
  }
}
