"use client";
import { useDialogDescription } from "../dialog/dialog-description.js";
import type {
  DialogDescriptionProps,
  DialogDescriptionState,
} from "../dialog/dialog-description.js";

/** State of `Drawer.Description`: Dialog's (the Popup's `open` and `modal`). */
export type DrawerDescriptionState = DialogDescriptionState;

/**
 * Props of `Drawer.Description`: `Dialog.Description`'s.
 *
 * @see https://ui.funstack.work/components/drawer
 */
export type DrawerDescriptionProps = DialogDescriptionProps;

/**
 * Describes the drawer: a `<p>` whose id the Popup references with `aria-describedby`.
 *
 * Owned key (conventions 1.2): `id`.
 *
 * @see https://ui.funstack.work/components/drawer
 */
export function DrawerDescription(props: DrawerDescriptionProps) {
  return useDialogDescription(props, "Drawer");
}

DrawerDescription.displayName = "DrawerDescription";
