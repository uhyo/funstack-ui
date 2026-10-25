// Ships the platform attribute typings (`command`, `commandfor`) with this subpath
// (conventions 7.4). Type-only: the built JS has no import of it.
import "../internal/platform-attributes.js";
import { PopoverClose } from "./popover-close.js";
import { PopoverDescription } from "./popover-description.js";
import { PopoverPopup } from "./popover-popup.js";
import { PopoverRoot } from "./popover-root.js";
import { PopoverTitle } from "./popover-title.js";
import { PopoverTrigger } from "./popover-trigger.js";

/**
 * Popover built on `popover="auto"` and Invoker Commands: `Root` (no DOM) > `Trigger`
 * (`button[popovertarget]`) + `Popup` (`dialog[popover=auto][aria-modal=false]`) >
 * `Title`, `Description`, `Close`. The platform gives the top layer, light dismiss, Escape,
 * nesting, the implicit anchor and focus return. JS-free when the Root has none of `open` /
 * `defaultOpen` / `openChangeAction`; otherwise opening and the closes a part asks for are
 * transitions (pending Trigger, content from committed state), and dismissals are notified
 * through `openChangeAction(false)`.
 *
 * @see https://ui.funstack.work/components/popover
 */
export const Popover = {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Popup: PopoverPopup,
  Close: PopoverClose,
  Title: PopoverTitle,
  Description: PopoverDescription,
} as const;

export type {
  PopoverRootProps,
  PopoverRootState,
  PopoverOpenChangeDetails,
} from "./popover-root.js";
export type { PopoverTriggerProps, PopoverTriggerState } from "./popover-trigger.js";
export type {
  PopoverPopupProps,
  PopoverPopupState,
  PopoverSide,
  PopoverAlign,
} from "./popover-popup.js";
export type { PopoverCloseProps, PopoverCloseState } from "./popover-close.js";
export type { PopoverTitleProps, PopoverTitleState } from "./popover-title.js";
export type { PopoverDescriptionProps, PopoverDescriptionState } from "./popover-description.js";
