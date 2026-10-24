"use client";
// The pieces Dialog.Popup shares with usePopoverPopup (Popover, Menu, Combobox). The two stay
// separate: Dialog has showModal / show, `close` / `cancel` / `submit` and light dismiss.
import { Activity, useRef, useState } from "react";
import type { ReactNode, RefObject, ViewTransitionClass } from "react";
import { ToolbarContext } from "./toolbar-context.js";
import { useDevWarning } from "./use-dev-warning.js";
import { useExitAnimation } from "./use-exit-animation.js";
import type { ExitAnimation } from "./use-exit-animation.js";

const isDev = process.env.NODE_ENV !== "production";

export interface OverlayContentOptions {
  readonly isLibrary: boolean;
  readonly keepMounted: boolean | undefined;
  /** Committed open, or held while the exit animates (design/components/popover.md 4.4). */
  readonly visible: boolean;
  readonly wrapContent: (children: ReactNode) => ReactNode;
}

/**
 * The children of a popup (Popover, Dialog, Menu, Combobox). JS-free mode: always rendered.
 * Library mode: rendered while `visible`, or with `keepMounted` inside an `<Activity>` whose mode
 * changes with committed state, inside the Root's transition (conventions 5.5). The content is
 * not part of an enclosing Toolbar's sequence (the engine excludes `[popover]` and `dialog`), so
 * parts inside it see no Toolbar. `children` is called only when rendered.
 */
export function renderOverlayContent(
  { isLibrary, keepMounted, visible, wrapContent }: OverlayContentOptions,
  children: () => ReactNode,
): ReactNode {
  let node: ReactNode;
  if (!isLibrary) {
    node = children();
  } else if (keepMounted === true) {
    node = <Activity mode={visible ? "visible" : "hidden"}>{wrapContent(children())}</Activity>;
  } else {
    node = visible ? wrapContent(children()) : null;
  }
  return <ToolbarContext value={null}>{node}</ToolbarContext>;
}

export interface CloseHold extends ExitAnimation {
  /**
   * The close's native event (`toggle` / `close`) arrived: hold the content until the exit
   * animations settle, or release a hold now when nothing animates (Firefox, or no CSS exit: the
   * popup is already `display: none`, the commit is invisible). Call before the notification, so
   * its commit keeps the children. Nothing for the library's own close (`echo`) with
   * `transition`: the close commit's view transition carried the content out.
   */
  readonly afterClose: (popup: Element, echo: boolean) => void;
  /**
   * The apply effect's release rule: a hold the close commit set (or a dismissal's notification
   * commit) that no exit animation is going to release, the popup being hidden and its close
   * event handled.
   */
  readonly releaseIfIdle: (committed: boolean, awaitingClose: boolean, shown: boolean) => void;
}

/**
 * `held` for a popup (design/components/popover.md 4.4): the children stay mounted while the
 * close animates. A library-driven close commits `false` first and hides in the layout effect,
 * so without `transition` the children are held through the close commit ("previous value in
 * state"). With `transition` the close commit unmounts them inside the view transition, whose old
 * snapshot carries the content out.
 */
export function useCloseHold(
  committed: boolean,
  isLibrary: boolean,
  transition: ViewTransitionClass | undefined,
): CloseHold {
  const exit = useExitAnimation();
  const [prevCommitted, setPrevCommitted] = useState(committed);
  if (prevCommitted !== committed) {
    setPrevCommitted(committed);
    if (isLibrary && prevCommitted && transition === undefined) exit.holdDuringRender();
  }
  return {
    ...exit,
    afterClose: (popup, echo) => {
      if (echo && transition !== undefined) return;
      const animations = exit.exitAnimations(popup);
      if (animations.length > 0) exit.holdUntil(animations);
      else exit.release();
    },
    releaseIfIdle: (isCommitted, awaitingClose, shown) => {
      if (exit.held && !isCommitted && !exit.waiting() && !awaitingClose && !shown) {
        exit.release();
      }
    },
  };
}

/** The lower-cased `command` of a `command` event. */
export function commandOf(event: Event): string {
  return String((event as Event & { command?: string }).command ?? "").toLowerCase();
}

/** Resolves `initialFocus` against the popup (a ref, or a selector inside the popup). */
export function resolveInitialFocus(
  popup: HTMLElement,
  initialFocus: RefObject<HTMLElement | null> | string,
): HTMLElement | null {
  if (typeof initialFocus === "string") return popup.querySelector<HTMLElement>(initialFocus);
  return initialFocus.current;
}

export type InitialFocusTarget = (
  popup: HTMLElement,
  initialFocus: RefObject<HTMLElement | null> | string | undefined,
) => HTMLElement | null;

/**
 * `initialFocus` resolved right before a library open (design 6.1): the target, or `null` (the
 * platform picks) without one, or when it resolves to nothing or outside the popup; those two
 * warn once per instance in development. `noun` names the popup in the warning.
 */
export function useInitialFocusTarget(part: string, noun: string): InitialFocusTarget {
  const warned = useRef(false);
  return (popup, initialFocus) => {
    if (initialFocus === undefined) return null;
    const target = resolveInitialFocus(popup, initialFocus);
    if (target !== null && popup.contains(target)) return target;
    if (isDev && !warned.current) {
      warned.current = true;
      console.error(
        target === null
          ? `${part}: \`initialFocus\` resolved to no element; the platform picks the focus target.`
          : `${part}: \`initialFocus\` is outside the ${noun}; the platform picks the focus target.`,
      );
    }
    return null;
  };
}

/**
 * Design 6.2 rule 2, after a close that began with focus inside (or whose commit unmounted the
 * focused content): when focus is now on `<body>` or still inside the hidden popup, focus the
 * Trigger (connected, and `canFocus` when given), else blur what holds focus.
 */
export function returnFocusToTrigger(
  popup: HTMLElement,
  trigger: HTMLElement | null,
  canFocus?: (trigger: HTMLElement) => boolean,
): void {
  const doc = popup.ownerDocument;
  const active = doc.activeElement;
  if (active !== null && active !== doc.body && !popup.contains(active)) return;
  if (trigger !== null && trigger.isConnected && (canFocus === undefined || canFocus(trigger))) {
    trigger.focus();
  } else if (active instanceof HTMLElement && active !== doc.body) {
    active.blur();
  }
}

/** The development warnings for a Popup's library-only props in JS-free mode. */
export function useJsFreePropWarnings(
  part: string,
  noun: string,
  isLibrary: boolean,
  transition: ViewTransitionClass | undefined,
  keepMounted: boolean | undefined,
): void {
  useDevWarning(
    !isLibrary && transition !== undefined,
    isDev &&
      `${part}: \`transition\` has no effect in JS-free mode; the browser opens and closes the ` +
        `${noun} outside any React transition. Animate it with CSS (\`@starting-style\`).`,
  );
  useDevWarning(
    !isLibrary && keepMounted === false,
    isDev &&
      `${part}: \`keepMounted={false}\` cannot be honoured in JS-free mode; the content is ` +
        "always mounted so that the server HTML is complete.",
  );
}
