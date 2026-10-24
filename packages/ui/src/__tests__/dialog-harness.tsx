// The Dialog test harness and queries, shared by the dialog*.test.tsx files (jsdom).
import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { Dialog } from "../dialog/index.js";
import type {
  DialogOpenChangeDetails,
  DialogPopupProps,
  DialogTriggerProps,
} from "../dialog/index.js";
import { flushTasks } from "./helpers.js";
import type { setupUser } from "./helpers.js";
import { createOverlayHarness } from "./overlay-open-state-suite.js";
import type { OpenChangeFn } from "./overlay-open-state-suite.js";

export type ActionFn = OpenChangeFn<DialogOpenChangeDetails>;

interface DialogHarnessProps {
  modal?: boolean;
  trigger?: Partial<DialogTriggerProps> | false;
  popup?: Partial<DialogPopupProps>;
  /** Popup content; default: a span, a Close button with value "x". */
  content?: ReactNode;
}

/**
 * Controlled/uncontrolled parity harness (`createOverlayHarness`): a Trigger, a Popup with a Title
 * and a Description, and the content.
 */
export const Harness = createOverlayHarness<DialogOpenChangeDetails, DialogHarnessProps>(
  (rootProps, { modal, trigger, popup, content }) => (
    <Dialog.Root {...rootProps} modal={modal}>
      {trigger !== false && (
        <Dialog.Trigger data-testid="trigger" {...trigger}>
          Open
        </Dialog.Trigger>
      )}
      <Dialog.Popup data-testid="popup" {...popup}>
        <Dialog.Title data-testid="title">Edit profile</Dialog.Title>
        <Dialog.Description data-testid="description">Saved to your account.</Dialog.Description>
        {content ?? (
          <>
            <span data-testid="content">content</span>
            <Dialog.Close data-testid="close" value="x">
              Cancel
            </Dialog.Close>
          </>
        )}
      </Dialog.Popup>
    </Dialog.Root>
  ),
);

export const trigger = (): HTMLElement => screen.getByTestId("trigger");
export const popup = (): HTMLDialogElement => screen.getByTestId("popup") as HTMLDialogElement;
export const content = (): HTMLElement | null => screen.queryByTestId("content");
export const committedText = (): string | null => screen.getByTestId("committed").textContent;

export function spyShowModal() {
  return vi.spyOn(HTMLDialogElement.prototype, "showModal");
}
export function spyClose() {
  return vi.spyOn(HTMLDialogElement.prototype, "close");
}

/** Opens a library-mode dialog through the Trigger and waits for it to be shown. */
export async function openThroughTrigger(user: ReturnType<typeof setupUser>): Promise<void> {
  await user.click(trigger());
  await flushTasks(2);
}
