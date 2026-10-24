// Test-only pointer capture for jsdom, which has no `setPointerCapture` / `releasePointerCapture` /
// `hasPointerCapture`. Installed once for every file (the Slider, NumberField and Menu suites used
// to install their own, and under the shared `jsdom` project, #107, whichever file ran first won).
// Installed only where the API is missing, so the browser project keeps the real implementation.
//
// It tracks the capturing element per pointer id and nothing else: no implicit release on
// `pointerup`, no `gotpointercapture` / `lostpointercapture` events. vitest.setup.ts forgets every
// capture after each test.

/** The element holding each pointer id's capture. */
export const capturedPointers = new Map<number, Element>();

if (typeof Element !== "undefined" && typeof Element.prototype.setPointerCapture !== "function") {
  Object.assign(Element.prototype, {
    setPointerCapture(this: Element, pointerId: number) {
      capturedPointers.set(pointerId, this);
    },
    releasePointerCapture(this: Element, pointerId: number) {
      if (capturedPointers.get(pointerId) === this) capturedPointers.delete(pointerId);
    },
    hasPointerCapture(this: Element, pointerId: number) {
      return capturedPointers.get(pointerId) === this;
    },
  });
}
