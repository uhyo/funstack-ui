// Ships the platform attribute typings (`command`, `commandfor`) with this subpath
// (conventions 7.4). Type-only: the built JS has no import of it.
import "../internal/platform-attributes.js";
import { DrawerClose } from "./drawer-close.js";
import { DrawerDescription } from "./drawer-description.js";
import { DrawerForm } from "./drawer-form.js";
import { DrawerPopup } from "./drawer-popup.js";
import { DrawerRoot } from "./drawer-root.js";
import { DrawerTitle } from "./drawer-title.js";
import { DrawerTrigger } from "./drawer-trigger.js";

/**
 * A Dialog attached to an edge of the viewport that the user can swipe back to it: `Root` (no
 * DOM) > `Trigger` + `Popup` (`dialog[data-side]`) > `Title`, `Description`, `Close`, `Form`.
 * Every part runs the code of the matching Dialog part (JS-free mode included). The Popup adds
 * `side` (default `"bottom"`, rendered as `data-side`; your CSS places it) and `swipeDismiss`
 * (default on): a drag toward the edge writes `data-swiping` and `--drawer-swipe-x` / `-y` /
 * `-progress`, and a release past a quarter or a flick slides the drawer out and closes it, a
 * dismissal reported to `onOpenChange`. `lightDismiss` defaults to the Root's `modal`.
 * Transition types: `fsui-drawer`, `fsui-drawer-open`, `fsui-drawer-close`.
 *
 * @see https://ui.funstack.work/components/drawer
 */
export const Drawer = {
  Root: DrawerRoot,
  Trigger: DrawerTrigger,
  Popup: DrawerPopup,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Close: DrawerClose,
  Form: DrawerForm,
} as const;

export type { DrawerRootProps, DrawerRootState, DrawerOpenChangeDetails } from "./drawer-root.js";
export type { DrawerTriggerProps, DrawerTriggerState } from "./drawer-trigger.js";
export type { DrawerPopupProps, DrawerPopupState, DrawerSide } from "./drawer-popup.js";
export type { DrawerTitleProps, DrawerTitleState } from "./drawer-title.js";
export type { DrawerDescriptionProps, DrawerDescriptionState } from "./drawer-description.js";
export type {
  DrawerCloseProps,
  DrawerCloseState,
  DrawerCloseActionDetails,
} from "./drawer-close.js";
export type { DrawerFormProps, DrawerFormState } from "./drawer-form.js";
