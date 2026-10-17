import { ToastAction } from "./toast-action.js";
import { ToastClose } from "./toast-close.js";
import { ToastDescription } from "./toast-description.js";
import { ToastRoot } from "./toast-root.js";
import { ToastTitle } from "./toast-title.js";
import { ToastViewport } from "./toast-viewport.js";

/**
 * Toast notifications. The queue's input is the `toast()` function (urgent: a toast shows at
 * once, even while the action it reports on is pending); its output is `Toast.Viewport`
 * (`section[popover=manual]`, rendered once) mapping `state.toasts` to `Toast.Root`
 * (`div[role=dialog]`) > `Title`, `Description`, `Action` (an action prop, e.g. Undo), `Close`.
 */
export const Toast = {
  Viewport: ToastViewport,
  Root: ToastRoot,
  Title: ToastTitle,
  Description: ToastDescription,
  Action: ToastAction,
  Close: ToastClose,
} as const;

export { toast, createToastManager } from "./toast.js";
export type {
  ToastOptions,
  ToastItem,
  ToastPriority,
  ToastActionOptions,
  ToastActionDetails,
  ToastCloseDetails,
  ToastPromiseOptions,
  ToastManager,
} from "./toast.js";
export type { ToastViewportProps, ToastViewportState } from "./toast-viewport.js";
export type { ToastRootProps, ToastRootState } from "./toast-root.js";
export type { ToastTitleProps } from "./toast-title.js";
export type { ToastDescriptionProps } from "./toast-description.js";
export type { ToastActionProps, ToastActionState } from "./toast-action.js";
export type { ToastCloseProps, ToastCloseState } from "./toast-close.js";
