// No "use client" directive: a DOM write called from event callbacks only.

/**
 * Brings react-dom's value tracker of a controlled `<input>` / `<textarea>` up to its DOM value
 * (conventions 3.8 rule 6). react-dom keeps the last value it saw in a tracker it installs on the
 * element's `value` setter and drops an `input` event whose value equals it. The form reset
 * algorithm restores the value without that setter, and react-dom writes nothing on the next
 * render when the DOM already holds the value it renders, so the tracker keeps the pre-reset text:
 * the first edit back to that text would be dropped. A script write of the same value goes
 * through the setter; the caret does not move (the value did not change). Call it after the reset
 * algorithm (`useFormReset`'s `onReset`).
 */
export function syncValueTracker(element: HTMLInputElement | HTMLTextAreaElement | null): void {
  if (element === null) return;
  const { value } = element;
  element.value = value;
}
