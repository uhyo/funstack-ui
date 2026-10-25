// Directive-free: the `focus({ focusVisible })` probe behind a pointer open's quiet initial focus
// (design/components/popover.md 6.1, menu.md 6.1).

/**
 * An initial focus target opened by a pointer: where the engine reads `focus({ focusVisible })`,
 * the library focuses it with `focusVisible: false` right after `showPopover()` instead of
 * writing `autofocus` (WebKit shows the ring for an `autofocus` target after a click).
 * Elsewhere it is an ordinary target.
 */
export interface QuietFocusTarget {
  readonly element: HTMLElement;
  readonly focusVisible: false;
}

let focusVisibleOption: boolean | undefined;

/**
 * The engine reads the `focusVisible` member of `focus()`'s options (Chromium 145, Firefox 104,
 * Safari 18.4). Detected once through a getter: the bindings convert the dictionary before the
 * method runs, so a detached element is enough and nothing is focused.
 */
export function supportsFocusVisibleOption(doc: Document): boolean {
  if (focusVisibleOption === undefined) {
    let read = false;
    try {
      doc.createElement("div").focus({
        get focusVisible() {
          read = true;
          return false;
        },
      } as FocusOptions);
    } catch {
      read = false;
    }
    focusVisibleOption = read;
  }
  return focusVisibleOption;
}

/** Tests only: forget the detection, so the next pointer open detects the option again. */
export function resetFocusVisibleOption(): void {
  focusVisibleOption = undefined;
}
