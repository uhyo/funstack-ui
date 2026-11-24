"use client";
import { useState } from "react";
import { useDevWarning } from "./use-dev-warning.js";

/**
 * A prop the component reads once, at mount: returns the first render's `value` for the life of
 * the instance, and logs `message` once (`useDevWarning`) the first time a later render's `value`
 * differs (`!==`). For the mode switches the library does not support: JS-free versus library
 * mode (the overlay Roots, Accordion), exclusive versus multiple (ToggleGroup, Accordion).
 *
 * Pass the message as `isDev && "..."` with the calling module's own `isDev` constant
 * (`use-dev-warning.ts`).
 */
export function useMountFixed<T>(value: T, message: string | false): T {
  const [mounted] = useState(value);
  useDevWarning(mounted !== value, message);
  return mounted;
}
