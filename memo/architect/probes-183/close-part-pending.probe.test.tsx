// Probe for #183 (architect). Not part of the test suite: copy into packages/ui/src/dialog/ and run
// `pnpm --filter @funstack/ui exec vitest run --project jsdom src/dialog/<file>`.
import { act, render, screen, fireEvent } from "@testing-library/react";
import { useOptimistic, useState, useTransition } from "react";
import { expect, it } from "vitest";
import { Menu } from "../menu/index.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function Probe({ work, rootAction }: { work: () => Promise<void>; rootAction?: () => Promise<void> }) {
  const [open, setOpen] = useState(true);
  const [optimistic, setOptimistic] = useOptimistic(open);
  const [rootPending, startRoot] = useTransition();
  const [cancelPending, startCancel] = useTransition();
  const [actionPending, startAction] = useTransition();
  const dispatch = (next: boolean) =>
    startRoot(async () => {
      setOptimistic(next);
      await rootAction?.();
      startRoot(() => setOpen(next));
    });
  return (
    <div data-testid="state" data-open={String(open)} data-optimistic={String(optimistic)} data-root={String(rootPending)}>
      <button data-testid="cancel" data-pending={String(cancelPending)} onClick={() => startCancel(async () => { dispatch(false); })}>c</button>
      <button data-testid="action" data-pending={String(actionPending)} onClick={() => startAction(async () => { await work(); dispatch(false); })}>a</button>
    </div>
  );
}

it("cancel inside its own transition pends while a pending action holds its close", async () => {
  const d = deferred();
  render(<Probe work={() => d.promise} />);
  await act(async () => { fireEvent.click(screen.getByTestId("action")); });
  expect(screen.getByTestId("action").dataset.pending).toBe("true");
  expect(screen.getByTestId("cancel").dataset.pending).toBe("false");
  await act(async () => { fireEvent.click(screen.getByTestId("cancel")); });
  console.log("after cancel click", screen.getByTestId("cancel").dataset.pending, screen.getByTestId("state").dataset);
  expect(screen.getByTestId("cancel").dataset.pending).toBe("true");
  expect(screen.getByTestId("state").dataset.open).toBe("true");
  await act(async () => { d.resolve(); await d.promise; await null; });
  console.log("after settle", screen.getByTestId("cancel").dataset.pending, screen.getByTestId("state").dataset);
  expect(screen.getByTestId("cancel").dataset.pending).toBe("false");
  expect(screen.getByTestId("state").dataset.open).toBe("false");
});

it("cancel pends while the root's own close action is awaited", async () => {
  const d = deferred();
  render(<Probe work={async () => {}} rootAction={() => d.promise} />);
  await act(async () => { fireEvent.click(screen.getByTestId("cancel")); });
  expect(screen.getByTestId("cancel").dataset.pending).toBe("true");
  expect(screen.getByTestId("state").dataset.root).toBe("true");
  await act(async () => { d.resolve(); await d.promise; await null; });
  expect(screen.getByTestId("cancel").dataset.pending).toBe("false");
  expect(screen.getByTestId("state").dataset.open).toBe("false");
});

it("Menu.Item without action: pending while the Root's close is awaited (today)", async () => {
  const d = deferred();
  render(
    <Menu.Root defaultOpen openChangeAction={async (next) => { if (!next) await d.promise; }}>
      <Menu.Trigger>t</Menu.Trigger>
      <Menu.Popup><Menu.Item>plain</Menu.Item></Menu.Popup>
    </Menu.Root>,
  );
  const item = await screen.findByText("plain");
  await act(async () => { fireEvent.click(item); });
  expect([item.hasAttribute("data-pending"), item.getAttribute("aria-disabled"), item.isConnected]).toEqual([true, "true", true]);
  await act(async () => { d.resolve(); await d.promise; await null; });
});
