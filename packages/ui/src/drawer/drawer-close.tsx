"use client";
import { useDialogClose } from "../dialog/dialog-close.js";
import type {
  DialogCloseDetails,
  DialogCloseProps,
  DialogCloseState,
} from "../dialog/dialog-close.js";

/** State of `Drawer.Close`: Dialog's. */
export type DrawerCloseState = DialogCloseState;

/** Details passed to `Drawer.Close`'s `action`: Dialog's. */
export type DrawerCloseDetails = DialogCloseDetails;

/**
 * Props of `Drawer.Close`: `Dialog.Close`'s.
 *
 * @see https://ui.funstack.work/components/drawer
 */
export type DrawerCloseProps = DialogCloseProps;

/**
 * A close button: exactly `Dialog.Close` (`<button type="button" commandfor
 * command="request-close">` in JS-free mode, a close through the Root in library mode; with
 * `action`, the action runs first). Render one in every drawer: it closes it before hydration
 * on a phone, and it is the alternative to the swipe (WCAG 2.5.1).
 *
 * @see https://ui.funstack.work/components/drawer
 */
export function DrawerClose(props: DrawerCloseProps) {
  return useDialogClose(props, { part: "Drawer.Close" });
}

DrawerClose.displayName = "DrawerClose";
