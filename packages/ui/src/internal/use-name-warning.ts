"use client";
import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { ElementCheck } from "./use-element-check.js";

const isDev = process.env.NODE_ENV !== "production";

/** What counts as a name besides `aria-label` and `aria-labelledby`. */
export interface NameRules {
  /** `aria-labelledby` counts only when one of its ids is in the document (a mounted Title). */
  readonly resolveIds?: boolean;
  /** Text content counts (a button with a visible label). */
  readonly text?: boolean;
  /** `title` counts. */
  readonly title?: boolean;
}

/** A button is also named by its text or `title`. */
export const BUTTON_NAME: NameRules = { text: true, title: true };

/** Text content names it too (`title` does not). */
export const TEXT_NAME: NameRules = { text: true };

/** Whether `element` has an accessible name by `rules` (development checks only). */
function hasName(element: Element, rules: NameRules): boolean {
  if (element.hasAttribute("aria-label")) return true;
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy !== null) {
    if (!rules.resolveIds) return true;
    const doc = element.ownerDocument;
    if (labelledBy.split(/\s+/).some((id) => id !== "" && doc.getElementById(id) !== null)) {
      return true;
    }
  }
  if (rules.text && (element.textContent ?? "").trim() !== "") return true;
  return rules.title === true && element.hasAttribute("title");
}

/**
 * Development check that a part the consumer must name (an icon-only button, a listbox) has an
 * accessible name: a microtask after the element attaches (the text may come from children
 * rendered in the same commit, and a Label's registration re-render is flushed by then), once
 * per instance. The result is a callback ref, or a function to call from the part's own ref.
 *
 * Pass `message` as `isDev && "..."` with the calling module's own `isDev` constant, so the text
 * folds away in a production build; there the hook is a no-op that returns `undefined`.
 */
export const useNameWarning: (
  message: string | false,
  rules?: NameRules,
) => ElementCheck<HTMLElement> | undefined = isDev ? useNameWarningDev : noop;

function noop(): undefined {
  return undefined;
}

function useNameWarningDev(
  message: string | false,
  rules: NameRules = {},
): ElementCheck<HTMLElement> | undefined {
  const warned = useRef(false);
  const { resolveIds, text, title } = rules;
  const check = useCallback(
    (element: HTMLElement) => {
      if (warned.current) return () => {};
      queueMicrotask(() => {
        if (warned.current || !element.isConnected) return;
        if (hasName(element, { resolveIds, text, title })) return;
        warned.current = true;
        console.error(message);
      });
      return () => {};
    },
    [message, resolveIds, text, title],
  );
  return message === false ? undefined : check;
}

/**
 * Development check that a popup has an accessible name once it is (or can be) shown: in an
 * effect while `shown`, once per instance. `applies` limits it to the elements that need a name
 * (a role). Pass `message` as `isDev && "..."`, as for `useNameWarning`; a no-op in production.
 */
export const useShownNameWarning: (
  element: RefObject<Element | null> | Element | null,
  shown: boolean,
  message: string | false,
  applies?: (element: Element) => boolean,
) => void = isDev ? useShownNameWarningDev : noop;

function useShownNameWarningDev(
  element: RefObject<Element | null> | Element | null,
  shown: boolean,
  message: string | false,
  applies?: (element: Element) => boolean,
): void {
  const warned = useRef(false);
  useEffect(() => {
    if (message === false || !shown || warned.current) return;
    const target = element !== null && "current" in element ? element.current : element;
    if (target === null || hasName(target, { resolveIds: true })) return;
    if (applies !== undefined && !applies(target)) return;
    warned.current = true;
    console.error(message);
  }, [element, shown, message, applies]);
}
