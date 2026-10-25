// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only: the
// built JS has no import of it.
import "../internal/platform-attributes.js";
import { TooltipArrow } from "./tooltip-arrow.js";
import { TooltipPopup } from "./tooltip-popup.js";
import { TooltipRoot } from "./tooltip-root.js";
import { TooltipTrigger } from "./tooltip-trigger.js";

/**
 * Tooltip (WAI-ARIA APG Tooltip pattern): `Root` (no DOM) owns the id and the interaction,
 * `Trigger` (button) is hovered or focused, `Popup` (`div[popover] role="tooltip"`) lives in the
 * top layer and is placed with CSS Anchor Positioning, `Arrow` (decorative `span`) echoes the
 * Popup's resolved side. Open state is browser-owned: no `open` prop, no action, style with
 * `:popover-open`. Render the Popup immediately after the Trigger.
 *
 * @see https://ui.funstack.work/components/tooltip
 */
export const Tooltip = {
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Popup: TooltipPopup,
  Arrow: TooltipArrow,
} as const;

export type { TooltipRootProps, TooltipRootState, TooltipProvides } from "./tooltip-root.js";
export type { TooltipTriggerProps, TooltipTriggerState } from "./tooltip-trigger.js";
export type {
  TooltipPopupProps,
  TooltipPopupState,
  TooltipSide,
  TooltipAlign,
} from "./tooltip-popup.js";
export type { TooltipArrowProps, TooltipArrowState } from "./tooltip-arrow.js";
