// Ships the platform attribute typings (`command`, `commandfor`) with this subpath
// (conventions 7.4). Type-only: the built JS has no import of it.
import "../internal/platform-attributes.js";
import { DialogClose } from "./dialog-close.js";
import { DialogDescription } from "./dialog-description.js";
import { DialogForm } from "./dialog-form.js";
import { DialogPopup } from "./dialog-popup.js";
import { DialogRoot } from "./dialog-root.js";
import { DialogTitle } from "./dialog-title.js";
import { DialogTrigger } from "./dialog-trigger.js";

/**
 * Dialog built on `<dialog>` and Invoker Commands: `Root` (no DOM) > `Trigger`
 * (`button[command=show-modal]`) + `Popup` (`dialog`) > `Title`, `Description`, `Form`, `Close`.
 * JS-free when the Root has none of `open` / `defaultOpen` / `openChangeAction`; otherwise
 * opening is a transition (pending Trigger, content from committed state) and closing is the
 * browser's, notified through `openChangeAction(false)`.
 */
export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Popup: DialogPopup,
  Close: DialogClose,
  Form: DialogForm,
  Title: DialogTitle,
  Description: DialogDescription,
} as const;

export type { DialogRootProps, DialogRootState, DialogOpenChangeDetails } from "./dialog-root.js";
export type { DialogTriggerProps, DialogTriggerState } from "./dialog-trigger.js";
export type { DialogPopupProps, DialogPopupState } from "./dialog-popup.js";
export type { DialogCloseProps, DialogCloseState, DialogCloseDetails } from "./dialog-close.js";
export type { DialogFormProps, DialogFormState } from "./dialog-form.js";
export type { DialogTitleProps, DialogTitleState } from "./dialog-title.js";
export type { DialogDescriptionProps, DialogDescriptionState } from "./dialog-description.js";
