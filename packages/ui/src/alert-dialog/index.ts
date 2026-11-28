// Ships the platform attribute typings (`command`, `commandfor`) with this subpath
// (conventions 7.4). Type-only: the built JS has no import of it.
import "../internal/platform-attributes.js";
import { AlertDialogAction } from "./alert-dialog-action.js";
import { AlertDialogCancel } from "./alert-dialog-cancel.js";
import { AlertDialogDescription } from "./alert-dialog-description.js";
import { AlertDialogForm } from "./alert-dialog-form.js";
import { AlertDialogPopup } from "./alert-dialog-popup.js";
import { AlertDialogRoot } from "./alert-dialog-root.js";
import { AlertDialogTitle } from "./alert-dialog-title.js";
import { AlertDialogTrigger } from "./alert-dialog-trigger.js";

/**
 * A Dialog with alert defaults: `Root` (no DOM) > `Trigger` + `Popup`
 * (`dialog[role=alertdialog]`, always modal, no light dismiss) > `Title`, `Description`,
 * `Cancel` (focused on open), `Action` (runs its `action`, pending, then closes; stays open on
 * rejection), `Form` (the confirm that works without JavaScript). Escape closes it, as a
 * dismissal reported to `onOpenChange`. Every part runs the code of the matching Dialog part,
 * so the styling surface and the transition types (`fsui-dialog*`) are Dialog's.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export const AlertDialog = {
  Root: AlertDialogRoot,
  Trigger: AlertDialogTrigger,
  Popup: AlertDialogPopup,
  Title: AlertDialogTitle,
  Description: AlertDialogDescription,
  Cancel: AlertDialogCancel,
  Action: AlertDialogAction,
  Form: AlertDialogForm,
} as const;

export type {
  AlertDialogRootProps,
  AlertDialogRootState,
  AlertDialogOpenChangeDetails,
} from "./alert-dialog-root.js";
export type { AlertDialogTriggerProps, AlertDialogTriggerState } from "./alert-dialog-trigger.js";
export type { AlertDialogPopupProps, AlertDialogPopupState } from "./alert-dialog-popup.js";
export type { AlertDialogTitleProps, AlertDialogTitleState } from "./alert-dialog-title.js";
export type {
  AlertDialogDescriptionProps,
  AlertDialogDescriptionState,
} from "./alert-dialog-description.js";
export type {
  AlertDialogCancelProps,
  AlertDialogCancelState,
  AlertDialogCancelActionDetails,
} from "./alert-dialog-cancel.js";
export type {
  AlertDialogActionProps,
  AlertDialogActionState,
  AlertDialogActionDetails,
} from "./alert-dialog-action.js";
export type { AlertDialogFormProps, AlertDialogFormState } from "./alert-dialog-form.js";
