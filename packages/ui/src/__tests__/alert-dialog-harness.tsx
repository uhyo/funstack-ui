// The AlertDialog test harness, shared by alert-dialog*.test.tsx (jsdom): the Dialog harness's
// shape with AlertDialog parts, so the shared overlay suites run against it.
import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { AlertDialog } from "../alert-dialog/index.js";
import type {
  AlertDialogOpenChangeDetails,
  AlertDialogPopupProps,
  AlertDialogTriggerProps,
} from "../alert-dialog/index.js";
import { createOverlayHarness } from "./overlay-open-state-suite.js";
import type { OpenChangeFn } from "./overlay-open-state-suite.js";

export type AlertActionFn = OpenChangeFn<AlertDialogOpenChangeDetails>;

interface AlertDialogHarnessProps {
  trigger?: Partial<AlertDialogTriggerProps> | false;
  popup?: Partial<AlertDialogPopupProps>;
  /** Popup content; default: a span, a Cancel and an Action without `action`, both with value "x". */
  content?: ReactNode;
}

/**
 * Controlled/uncontrolled parity harness (`createOverlayHarness`): a Trigger, a Popup with a
 * Title and a Description, and the content.
 */
export const AlertHarness = createOverlayHarness<
  AlertDialogOpenChangeDetails,
  AlertDialogHarnessProps
>((rootProps, { trigger, popup, content }) => (
  <AlertDialog.Root {...rootProps}>
    {trigger !== false && (
      <AlertDialog.Trigger data-testid="trigger" {...trigger}>
        Delete project
      </AlertDialog.Trigger>
    )}
    <AlertDialog.Popup data-testid="popup" {...popup}>
      <AlertDialog.Title data-testid="title">Delete "Atlas"?</AlertDialog.Title>
      <AlertDialog.Description data-testid="description">
        This cannot be undone.
      </AlertDialog.Description>
      {content ?? (
        <>
          <span data-testid="content">content</span>
          <AlertDialog.Cancel data-testid="close" value="x">
            Cancel
          </AlertDialog.Cancel>
          <AlertDialog.Action data-testid="confirm" value="x">
            Delete
          </AlertDialog.Action>
        </>
      )}
    </AlertDialog.Popup>
  </AlertDialog.Root>
));

export const alertPopup = (): HTMLDialogElement => screen.getByTestId("popup") as HTMLDialogElement;
