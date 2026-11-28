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
  /** A labelable element's `<label for>` or wrapping `<label>` counts (`element.labels`). */
  readonly labels?: boolean;
  /** A `<fieldset>`'s first-child `<legend>` counts. */
  readonly legend?: boolean;
}

/** A button is also named by its text or `title`. */
export const BUTTON_NAME: NameRules = { text: true, title: true };

/** Text content names it too (`title` does not). */
export const TEXT_NAME: NameRules = { text: true };

/**
 * A form control (`<input>`, `<select>`, `<textarea>`) is also named by a `<label for>`, a
 * wrapping `<label>` or `title` (conventions 9.5).
 */
export const CONTROL_NAME: NameRules = { labels: true, title: true };

/** A `<fieldset>` group is also named by its `<legend>` (conventions 9.5). */
export const GROUP_NAME: NameRules = { legend: true };

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
  if (rules.labels && ((element as HTMLInputElement).labels?.length ?? 0) > 0) return true;
  if (rules.legend && element.querySelector(":scope > legend") !== null) return true;
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
  const { resolveIds, text, title, labels, legend } = rules;
  const check = useCallback(
    (element: HTMLElement) => {
      if (warned.current) return () => {};
      queueMicrotask(() => {
        if (warned.current || !element.isConnected) return;
        if (hasName(element, { resolveIds, text, title, labels, legend })) return;
        warned.current = true;
        console.error(message);
      });
      return () => {};
    },
    [message, resolveIds, text, title, labels, legend],
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
    let cancelled = false;
    // A microtask later: a Title that mounted in the showing commit registers from a layout
    // effect, and React runs this effect before the re-render that adds its `aria-labelledby`
    // token (#218). That re-render is synchronous, so it has committed by the microtask.
    queueMicrotask(() => {
      if (cancelled || warned.current) return;
      const target = element !== null && "current" in element ? element.current : element;
      if (target === null || hasName(target, { resolveIds: true })) return;
      if (applies !== undefined && !applies(target)) return;
      warned.current = true;
      console.error(message);
    });
    return () => {
      cancelled = true;
    };
  }, [element, shown, message, applies]);
}

/**
 * Development check that a dialog has a description (AlertDialog,
 * design/components/alert-dialog.md 2.2): an id of its `aria-describedby` that names an element
 * in the document. Judged over the dialog's first showing rather than its first frame, so a
 * description behind a Suspense boundary still pending when the dialog opens counts once it
 * arrives: checked when the dialog opens (`toggle`), then on every change inside it, and
 * `message` is logged at its first `close` if none was found by then. Once per instance. Pass
 * `message` as `isDev && "..."`; a no-op in production.
 */
export const useShownDescriptionWarning: (
  element: RefObject<HTMLElement | null>,
  message: string | false,
) => void = isDev ? useShownDescriptionWarningDev : noop;

function hasDescription(element: Element): boolean {
  const doc = element.ownerDocument;
  return (element.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .some((id) => id !== "" && doc.getElementById(id) !== null);
}

function useShownDescriptionWarningDev(
  element: RefObject<HTMLElement | null>,
  message: string | false,
): void {
  const done = useRef(false);
  useEffect(() => {
    const target = element.current;
    if (message === false || target === null || done.current) return;
    let observer: MutationObserver | null = null;
    const stop = () => {
      observer?.disconnect();
      observer = null;
    };
    const found = (): boolean => {
      if (!hasDescription(target)) return false;
      done.current = true;
      stop();
      return true;
    };
    const onToggle = (event: Event) => {
      if (event.target !== target || done.current || observer !== null) return;
      if ((event as ToggleEvent).newState !== "open" || found()) return;
      observer = new MutationObserver(() => {
        found();
      });
      observer.observe(target, { childList: true, subtree: true });
    };
    const onClose = (event: Event) => {
      if (event.target !== target || done.current || found()) return;
      done.current = true;
      stop();
      console.error(message);
    };
    target.addEventListener("toggle", onToggle);
    target.addEventListener("close", onClose);
    return () => {
      stop();
      target.removeEventListener("toggle", onToggle);
      target.removeEventListener("close", onClose);
    };
  }, [element, message]);
}
