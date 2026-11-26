"use client";
import { useDialogRoot } from "../dialog/dialog-root.js";
import type {
  DialogOpenChangeDetails,
  DialogRootProps,
  DialogRootState,
} from "../dialog/dialog-root.js";

/**
 * Details passed as the second argument of `openChangeAction` and `onOpenChange`: Dialog's.
 * `reason` is `"activate"` for the Trigger, a Close or a Form; `"dismiss"` for Escape, a press
 * on the backdrop and a swipe (a swipe's `details.event` is its `pointerup`).
 */
export type DrawerOpenChangeDetails = DialogOpenChangeDetails;

/** State of `Drawer.Root`, passed to the function form of `children`: Dialog's. */
export type DrawerRootState = DialogRootState;

/**
 * Props of `Drawer.Root`: `Dialog.Root`'s. Without `open`, `defaultOpen`, `openChangeAction` and
 * `onOpenChange` it is JS-free.
 *
 * @see https://ui.funstack.work/components/drawer
 */
export type DrawerRootProps = DialogRootProps;

/**
 * `Dialog.Root` with the Drawer's transition types (`fsui-drawer`, `fsui-drawer-open`,
 * `fsui-drawer-close`). Owns the ids, the mode and the open state; renders no DOM. Opening and
 * the closes a part asks for are requests (`openChangeAction`); Escape, a press on the backdrop
 * and a swipe are the browser's facts (`onOpenChange`).
 *
 * @see https://ui.funstack.work/components/drawer
 */
export function DrawerRoot({ modal = true, ...props }: DrawerRootProps) {
  return useDialogRoot(props, { namespace: "Drawer", modal, component: "drawer" });
}

DrawerRoot.displayName = "DrawerRoot";
