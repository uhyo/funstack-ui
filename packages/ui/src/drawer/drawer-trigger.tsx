"use client";
import { useDialogTrigger } from "../dialog/dialog-trigger.js";
import type { DialogTriggerProps, DialogTriggerState } from "../dialog/dialog-trigger.js";

/** State of `Drawer.Trigger`: Dialog's. */
export type DrawerTriggerState = DialogTriggerState;

/**
 * Props of `Drawer.Trigger`: `Dialog.Trigger`'s.
 *
 * @see https://ui.funstack.work/components/drawer
 */
export type DrawerTriggerProps = DialogTriggerProps;

/**
 * The opener: exactly `Dialog.Trigger` (`<button type="button" commandfor command="show-modal">`
 * for a modal drawer). JS-free mode: the browser runs the command. Library mode: the click is a
 * request through the Root (`data-pending` until the drawer has opened).
 *
 * @see https://ui.funstack.work/components/drawer
 */
export function DrawerTrigger(props: DrawerTriggerProps) {
  return useDialogTrigger(props, "Drawer");
}

DrawerTrigger.displayName = "DrawerTrigger";
