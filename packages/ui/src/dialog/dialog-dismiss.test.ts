import { afterEach, describe, expect, it, vi } from "vitest";
import { listenDialogDismiss } from "./dialog-dismiss.js";

function press(target: EventTarget): void {
  target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
}

function openDialog(): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.append(document.createElement("button"));
  document.body.append(dialog);
  dialog.show();
  return dialog;
}

describe("listenDialogDismiss", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });

  it("non-modal light dismiss: a press outside requests the close", () => {
    const dialog = openDialog();
    const requestClose = vi.spyOn(dialog, "requestClose");
    stops.push(listenDialogDismiss(dialog, { modal: false, lightDismiss: true }));
    press(document.body);
    expect(requestClose).toHaveBeenCalledTimes(1);
  });

  it("the cleanup of an open non-modal dialog removes its document listeners", () => {
    const dialog = openDialog();
    const requestClose = vi.spyOn(dialog, "requestClose");
    const stop = listenDialogDismiss(dialog, { modal: false, lightDismiss: true });
    stop();
    press(document.body);
    expect(requestClose).not.toHaveBeenCalled();
  });

  it("the cleanup removes the Escape listener of a non-modal dialog", () => {
    const dialog = openDialog();
    const requestClose = vi.spyOn(dialog, "requestClose");
    const stop = listenDialogDismiss(dialog, { modal: false, lightDismiss: false });
    const button = dialog.querySelector("button")!;
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(requestClose).toHaveBeenCalledTimes(1);
    stop();
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(requestClose).toHaveBeenCalledTimes(1);
  });

  it("a modal dialog gets no Escape listener (the platform's close watcher has it)", () => {
    const dialog = document.createElement("dialog");
    dialog.append(document.createElement("button"));
    document.body.append(dialog);
    dialog.showModal();
    const requestClose = vi.spyOn(dialog, "requestClose");
    stops.push(listenDialogDismiss(dialog, { modal: true, lightDismiss: false }));
    dialog
      .querySelector("button")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(requestClose).not.toHaveBeenCalled();
  });
});
