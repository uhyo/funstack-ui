"use client";
import { useDialogTitle } from "../dialog/dialog-title.js";
import type { DialogTitleProps, DialogTitleState } from "../dialog/dialog-title.js";

/** State of `Drawer.Title`: Dialog's (the Popup's `open` and `modal`). */
export type DrawerTitleState = DialogTitleState;

/**
 * Props of `Drawer.Title`: `Dialog.Title`'s.
 *
 * @see https://ui.funstack.work/components/drawer
 */
export type DrawerTitleProps = DialogTitleProps;

/**
 * The drawer's name: an `<h2>` whose id the Popup references with `aria-labelledby`.
 *
 * Owned key (conventions 1.2): `id`.
 *
 * @see https://ui.funstack.work/components/drawer
 */
export function DrawerTitle(props: DrawerTitleProps) {
  return useDialogTitle(props, "Drawer");
}

DrawerTitle.displayName = "DrawerTitle";
