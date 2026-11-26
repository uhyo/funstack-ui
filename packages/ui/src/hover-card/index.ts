// Ships the platform attribute typings (`interestfor`, `interest-delay-*`) with this subpath
// (conventions 7.4). Type-only: the built JS has no import of it.
import "../internal/platform-attributes.js";
import { HoverCardPopup } from "./hover-card-popup.js";
import { HoverCardRoot } from "./hover-card-root.js";
import { HoverCardTrigger } from "./hover-card-trigger.js";

/**
 * A rich preview shown while the user shows interest in a link (hover or keyboard focus, after a
 * delay): `Root` (no DOM) > `Trigger` (`a`) + `Popup` (`div[popover=manual][role=group]`, right
 * after the Trigger). Unlike a Tooltip the card may hold links and buttons and is not the
 * Trigger's description; unlike a Popover nothing is clicked to open it and opening never moves
 * focus. Opening is a request (`openChangeAction(true)`, a transition: the content mounts and may
 * suspend, the Trigger is `data-pending` meanwhile); every close the user causes is a fact
 * (`onOpenChange(false)`).
 *
 * @see https://ui.funstack.work/components/hover-card
 */
export const HoverCard = {
  Root: HoverCardRoot,
  Trigger: HoverCardTrigger,
  Popup: HoverCardPopup,
} as const;

export type {
  HoverCardRootProps,
  HoverCardRootState,
  HoverCardOpenChangeDetails,
} from "./hover-card-root.js";
export type { HoverCardTriggerProps, HoverCardTriggerState } from "./hover-card-trigger.js";
export type {
  HoverCardPopupProps,
  HoverCardPopupState,
  HoverCardSide,
  HoverCardAlign,
} from "./hover-card-popup.js";
