// View Transition types of an AlertDialog dispatch (design/components/alert-dialog.md 8,
// conventions 5.3): Dialog's own, `fsui-dialog` plus `-open` / `-close`, so one stylesheet
// styles both. A dismissal (Escape) is a fact and carries none. See
// __tests__/transition-type-spy.ts.
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushTasks, setupUser } from "../__tests__/helpers.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "../__tests__/transition-type-spy.js";
import { AlertDialog } from "./index.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

beforeEach(() => {
  addTransitionTypeSpy.mockClear();
});

function Confirm() {
  return (
    <AlertDialog.Root defaultOpen={false}>
      <AlertDialog.Trigger>Delete</AlertDialog.Trigger>
      <AlertDialog.Popup data-testid="popup">
        <AlertDialog.Title>Delete?</AlertDialog.Title>
        <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
        <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        <AlertDialog.Action action={async () => {}}>Confirm</AlertDialog.Action>
      </AlertDialog.Popup>
    </AlertDialog.Root>
  );
}

const popup = () => screen.getByTestId("popup") as HTMLDialogElement;

describe("AlertDialog transition types", () => {
  it("open adds fsui-dialog and fsui-dialog-open; the Cancel's close adds fsui-dialog-close", async () => {
    const user = setupUser();
    render(<Confirm />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await flushTasks(2);
    expect(popup().open).toBe(true);
    expect(recordedTransitionTypes()).toEqual(["fsui-dialog", "fsui-dialog-open"]);
    addTransitionTypeSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await flushTasks(2);
    expect(popup().open).toBe(false);
    expect(recordedTransitionTypes()).toEqual(["fsui-dialog", "fsui-dialog-close"]);
  });

  it("the Action's close adds fsui-dialog-close", async () => {
    const user = setupUser();
    render(<Confirm />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await flushTasks(2);
    addTransitionTypeSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await flushTasks(2);
    expect(popup().open).toBe(false);
    expect(recordedTransitionTypes()).toEqual(["fsui-dialog", "fsui-dialog-close"]);
  });

  it("Escape is a fact and adds no type", async () => {
    const user = setupUser();
    render(<Confirm />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await flushTasks(2);
    addTransitionTypeSpy.mockClear();
    await act(async () => popup().requestClose());
    await flushTasks(2);
    expect(popup().open).toBe(false);
    expect(recordedTransitionTypes()).toEqual([]);
  });
});
