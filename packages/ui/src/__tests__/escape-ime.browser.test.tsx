// Escape during an IME composition, and an Escape an inner handler consumed, against the
// library's JS Escape handlers in a real engine (design/conventions.md 15, #191, #192). Chromium
// drives a real composition through CDP (`Input.imeSetComposition`, then an Escape the IME takes:
// `windowsVirtualKeyCode` 229, which Chromium delivers as `key: "Escape"`, `keyCode: 229`,
// `isComposing: true`). Firefox and WebKit have no IME driver: there the rows only **replay the
// synthetic keydowns of the jsdom rows** (the two composing shapes the rule reads, `isComposing`
// and `keyCode` 229, as untrusted events). They add no IME coverage of those engines; what they
// do check is that the engine's `KeyboardEvent` constructor honours both init fields (the
// premise asserts in `imeEscape`), which the jsdom rows take for granted. The rows of every
// handler with synthetic events are in jsdom (dialog-escape, tooltip, hover-card, toast,
// menubar, drawer tests).
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cdp, userEvent } from "vitest/browser";
import { Combobox } from "../combobox/index.js";
import { Dialog } from "../dialog/index.js";
import { HoverCard } from "../hover-card/index.js";
import { Tooltip } from "../tooltip/index.js";
import { quietPeriod, settle } from "./browser-helpers.js";
import { user } from "./browser-user.js";
import { browserName } from "./engine.js";

/**
 * An Escape that belongs to an IME composition in `input` (focused first). Returns the keydowns
 * `input` saw. In Chromium a real composition is started and the IME takes the Escape; the
 * composition is then cancelled, as a user's second Escape would leave it.
 */
async function imeEscape(input: HTMLInputElement): Promise<KeyboardEvent[]> {
  input.focus();
  const seen: KeyboardEvent[] = [];
  const record = (event: KeyboardEvent) => seen.push(event);
  input.addEventListener("keydown", record);
  try {
    if (browserName === "chromium") {
      const session = cdp();
      await act(async () => {
        await session.send("Input.imeSetComposition", {
          text: "に",
          selectionStart: 1,
          selectionEnd: 1,
        });
        for (const type of ["rawKeyDown", "keyUp"] as const) {
          await session.send("Input.dispatchKeyEvent", {
            type,
            key: "Escape",
            code: "Escape",
            windowsVirtualKeyCode: 229,
          });
        }
        await session.send("Input.imeSetComposition", {
          text: "",
          selectionStart: 0,
          selectionEnd: 0,
        });
      });
    } else {
      for (const init of [{ isComposing: true }, { keyCode: 229 }]) {
        act(() => {
          input.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Escape",
              bubbles: true,
              cancelable: true,
              composed: true,
              ...init,
            }),
          );
        });
      }
    }
  } finally {
    input.removeEventListener("keydown", record);
  }
  // The premise: composing Escapes arrived in the shape the rule reads.
  expect(seen.length).toBeGreaterThan(0);
  for (const event of seen) {
    expect(event.key).toBe("Escape");
    expect(event.isComposing || event.keyCode === 229).toBe(true);
  }
  if (browserName !== "chromium") {
    // The engine's constructor honours each init field on its own (WebKit included).
    expect(seen.map((event) => [event.isComposing, event.keyCode])).toEqual([
      [true, 0],
      [false, 229],
    ]);
  }
  return seen;
}

afterEach(async () => {
  await userEvent.unhover(document.body);
});

describe("Escape during an IME composition (#191)", () => {
  it("a non-modal Dialog stays open; the Escape after the composition closes it", async () => {
    render(
      <Dialog.Root defaultOpen modal={false}>
        <Dialog.Popup data-testid="popup" aria-label="Notes">
          <input data-testid="text" aria-label="Note" />
        </Dialog.Popup>
      </Dialog.Root>,
    );
    const dialog = screen.getByTestId("popup") as HTMLDialogElement;
    await settle(() => expect(dialog.open).toBe(true));
    const events = await imeEscape(screen.getByTestId("text") as HTMLInputElement);
    await quietPeriod(100, "the composition's Escape must not close the dialog");
    expect(dialog.open).toBe(true);
    expect(events.some((event) => event.defaultPrevented)).toBe(false);
    await user.keyboard("{Escape}");
    await settle(() => expect(dialog.open).toBe(false));
  });

  // The platform's close watchers are the engine's business (conventions 15): recorded, not
  // driven. Only Chromium can prove anything here (an IME driven through CDP, trusted key
  // events): the Escape the IME takes is no close request, for a modal dialog and an `auto`
  // popover. Elsewhere untrusted keydowns never run a close watcher, so the row checks the one
  // thing it can: the library's listeners leave both composing shapes unprevented, so a real
  // close watcher would decide alone.
  it("native close watchers: a modal Dialog and an auto popover stay open on the Escape the IME takes (Chromium)", async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Popup data-testid="popup" aria-label="Notes">
          <input data-testid="text" aria-label="Note" />
          <div popover="auto" data-testid="menu">
            <input data-testid="menu-text" aria-label="Filter" />
          </div>
        </Dialog.Popup>
      </Dialog.Root>,
    );
    const dialog = screen.getByTestId("popup") as HTMLDialogElement;
    const menu = screen.getByTestId("menu");
    await settle(() => expect(dialog.open).toBe(true));
    act(() => menu.showPopover());
    const inMenu = await imeEscape(screen.getByTestId("menu-text") as HTMLInputElement);
    if (browserName !== "chromium") {
      expect(inMenu.some((event) => event.defaultPrevented)).toBe(false);
      return;
    }
    await quietPeriod(100, "the composition's Escape must not close the auto popover");
    expect(menu.matches(":popover-open")).toBe(true);
    expect(dialog.open).toBe(true);
    act(() => menu.hidePopover());
    await imeEscape(screen.getByTestId("text") as HTMLInputElement);
    await quietPeriod(100, "the composition's Escape must not close the modal dialog");
    expect(dialog.open).toBe(true);
    await user.keyboard("{Escape}");
    await settle(() => expect(dialog.open).toBe(false));
  });

  it("a shown Tooltip stays; the Escape after the composition hides it", async () => {
    render(
      <>
        <Tooltip.Root delay={0}>
          <Tooltip.Trigger>Save</Tooltip.Trigger>
          <Tooltip.Popup data-testid="tip">Saves the note</Tooltip.Popup>
        </Tooltip.Root>
        <input data-testid="text" aria-label="Note" />
      </>,
    );
    const tip = screen.getByTestId("tip");
    await user.hover(screen.getByRole("button", { name: "Save" }));
    await settle(() => expect(tip.matches(":popover-open")).toBe(true));
    await imeEscape(screen.getByTestId("text") as HTMLInputElement);
    await quietPeriod(100, "the composition's Escape must not hide the tooltip");
    expect(tip.matches(":popover-open")).toBe(true);
    await user.keyboard("{Escape}");
    await settle(() => expect(tip.matches(":popover-open")).toBe(false));
  });

  // In Chromium this row passes on master too: the CDP keydown has `isComposing`, which
  // HoverCard's document listener already read. What is new there is only the `keyCode` 229
  // shape, which the synthetic replay covers elsewhere.
  it("a shown HoverCard stays; the Escape after the composition closes it", async () => {
    render(
      <HoverCard.Root defaultOpen>
        <HoverCard.Trigger href="/u/ada">@ada</HoverCard.Trigger>
        <HoverCard.Popup data-testid="card">
          <input data-testid="text" aria-label="Reply" />
        </HoverCard.Popup>
      </HoverCard.Root>,
    );
    const card = screen.getByTestId("card");
    await settle(() => expect(card.matches(":popover-open")).toBe(true));
    await imeEscape(screen.getByTestId("text") as HTMLInputElement);
    await quietPeriod(100, "the composition's Escape must not close the card");
    expect(card.matches(":popover-open")).toBe(true);
    await user.keyboard("{Escape}");
    await settle(() => expect(card.matches(":popover-open")).toBe(false));
  });
});

describe("an Escape an inner handler consumed (#192)", () => {
  it("a real Escape on a Combobox chip is the chip's: a shown Tooltip stays; the next hides it", async () => {
    render(
      <>
        <Tooltip.Root delay={0}>
          <Tooltip.Trigger>Save</Tooltip.Trigger>
          <Tooltip.Popup data-testid="tip">Saves the note</Tooltip.Popup>
        </Tooltip.Root>
        <Combobox.Root multiple defaultValue={["jp", "fr"]}>
          <Combobox.Label>Countries</Combobox.Label>
          <Combobox.Chips>
            {({ value }) =>
              value.map((v) => (
                <Combobox.Chip key={v} value={v} data-testid={`chip-${v}`}>
                  {v}
                </Combobox.Chip>
              ))
            }
          </Combobox.Chips>
          <Combobox.Input data-testid="input" />
          <Combobox.Popup data-testid="list">
            <Combobox.List>
              <Combobox.Option value="jp">Japan</Combobox.Option>
              <Combobox.Option value="fr">France</Combobox.Option>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>
      </>,
    );
    const tip = screen.getByTestId("tip");
    await user.hover(screen.getByRole("button", { name: "Save" }));
    await settle(() => expect(tip.matches(":popover-open")).toBe(true));
    act(() => screen.getByTestId("chip-fr").focus());
    await user.keyboard("{Escape}");
    await settle(() => expect(screen.getByTestId("input")).toHaveFocus());
    await quietPeriod(50, "the chip's Escape must not hide the tooltip");
    expect(tip.matches(":popover-open")).toBe(true);
    expect(screen.getByTestId("list").matches(":popover-open")).toBe(false);
    await user.keyboard("{Escape}");
    await settle(() => expect(tip.matches(":popover-open")).toBe(false));
  });
});
