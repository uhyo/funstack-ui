"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { StateValue } from "../internal/types.js";
import { resolveStateValue } from "../internal/use-render.js";
import { TooltipContext } from "./tooltip-context.js";
import type { TooltipContextValue, TooltipProvides } from "./tooltip-context.js";
import { useTooltipInteraction } from "./use-tooltip-interaction.js";

export type { TooltipProvides } from "./tooltip-context.js";

export interface TooltipRootState {
  readonly disabled: boolean;
}

export interface TooltipRootProps {
  /**
   * Milliseconds from hover or keyboard focus to open. Default 250 (Chromium's
   * `interest-delay-start`). The same delay applies to hover and focus.
   */
  delay?: number;
  /** Milliseconds from de-hover or blur to close. Default 150 (Chromium's `interest-delay-end`). */
  closeDelay?: number;
  /** When true the tooltip never opens. The ARIA relation stays in place. */
  disabled?: boolean;
  /**
   * Which accessibility relation the tooltip provides for the trigger.
   * `"description"` (default): `aria-describedby`, for triggers that have their own name.
   * `"name"`: `aria-labelledby`, for icon-only triggers; do not also set `aria-label`.
   */
  provides?: TooltipProvides;
  children?: StateValue<ReactNode, TooltipRootState>;
}

const isDev = process.env.NODE_ENV !== "production";

const FOCUSABLE =
  "a[href],area[href],button,input,select,textarea,iframe,[tabindex],[contenteditable]";

/**
 * Owns the popup id, the options and the one interaction effect. Renders no DOM, so it has no
 * `ref`, `className` or `style`. The open state is browser-owned (the popover's top-layer state):
 * there is no `open` prop, no action, and no `data-open`; style with `:popover-open`.
 *
 * Render `Tooltip.Popup` immediately after `Tooltip.Trigger` in DOM order: the HTML spec
 * recommends that reading order for popovers, and some screen readers attach an adjacent tooltip
 * to the wrong control otherwise. This is documented, not enforced.
 */
export function TooltipRoot({
  delay = 250,
  closeDelay = 150,
  disabled = false,
  provides = "description",
  children,
}: TooltipRootProps) {
  const popupId = useId();
  const [trigger, setTriggerElement] = useState<HTMLElement | null>(null);
  const [popup, setPopupElement] = useState<HTMLElement | null>(null);
  const [interestForRequested, setInterestForRequested] = useState(false);

  useTooltipInteraction(trigger, popup, { delay, closeDelay, disabled, interestForRequested });
  useTooltipDevWarnings(trigger, popup, provides);

  const context = useMemo<TooltipContextValue>(
    () => ({
      popupId,
      disabled,
      delay,
      closeDelay,
      provides,
      setTriggerElement,
      setPopupElement,
      setInterestForRequested,
    }),
    [popupId, disabled, delay, closeDelay, provides],
  );

  const state: TooltipRootState = { disabled };
  return <TooltipContext value={context}>{resolveStateValue(children, state)}</TooltipContext>;
}

TooltipRoot.displayName = "TooltipRoot";

/**
 * The containers that move focus among their items with the arrow keys (roving tabindex, or a
 * native `focusgroup`): Menu, Tabs, Toolbar, a radio group, and the other APG composites, plus
 * `role="group"`, which a standalone `ToggleGroup.Root` renders while its roving engine writes
 * the Items' `tabindex` (#75, design/components/toggle-group.md 18).
 */
const COMPOSITE =
  '[role="menu"],[role="menubar"],[role="tablist"],[role="toolbar"],[role="group"],[role="radiogroup"],[role="listbox"],[role="grid"],[role="treegrid"],[role="tree"],[focusgroup]';

/**
 * Whether keyboard users can focus the trigger: it is in the tab order, or it is a
 * roving-tabindex item (`tabindex="-1"` set explicitly, so script can focus it) inside a
 * composite widget that moves focus to it (#57).
 */
function isKeyboardReachable(trigger: HTMLElement): boolean {
  if (trigger.tabIndex >= 0) return true;
  return trigger.hasAttribute("tabindex") && trigger.parentElement?.closest(COMPOSITE) != null;
}

/** Development-only checks that need the mounted elements (design 12.5). Each fires once. */
function useTooltipDevWarnings(
  trigger: HTMLElement | null,
  popup: HTMLElement | null,
  provides: TooltipProvides,
): void {
  const warned = useRef({ label: false, focusable: false, interactive: false });
  useEffect(() => {
    if (!isDev) return;
    const w = warned.current;
    if (trigger !== null) {
      if (provides === "name" && trigger.hasAttribute("aria-label") && !w.label) {
        w.label = true;
        console.error(
          '[Tooltip] provides="name" together with aria-label on the trigger announces the name twice. Remove aria-label.',
        );
      }
      if (!isKeyboardReachable(trigger) && !w.focusable) {
        w.focusable = true;
        console.error(
          "[Tooltip] The trigger is not focusable; keyboard users cannot open the tooltip. Render a <button> or a link, or set tabIndex={0}.",
        );
      }
    }
    if (popup !== null && popup.querySelector(FOCUSABLE) !== null && !w.interactive) {
      w.interactive = true;
      console.error(
        "[Tooltip] Tooltips must not contain interactive content. Use a non-modal dialog or a popover instead.",
      );
    }
  }, [trigger, popup, provides]);
}
