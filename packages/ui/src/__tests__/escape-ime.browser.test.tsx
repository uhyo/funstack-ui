// Escape during an IME composition, and an Escape an inner handler consumed, against the
// library's JS Escape handlers in a real engine (design/conventions.md 15, #191, #192). Chromium
// drives a real composition through CDP (`Input.imeSetComposition`, then an Escape the IME takes:
// `windowsVirtualKeyCode` 229, which Chromium delivers as `key: "Escape"`, `keyCode: 229`,
// `isComposing: true`). Firefox and WebKit have no IME driver: there the rows dispatch the two
// composing keydown shapes the rule reads (`isComposing`, `keyCode` 229) as untrusted events.
// The rows of every handler with synthetic events are in jsdom (dialog-escape, tooltip,
// hover-card, toast, menubar, drawer tests).
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
  // The premise: composing Escapes arrived, none of them prevented by the library.
  expect(seen.length).toBeGreaterThan(0);
  for (const event of seen) {
    expect(event.key).toBe("Escape");
    expect(event.isComposing || event.keyCode === 229).toBe(true);
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

  // The platform's close watchers are the engine's business (conventions 15). Recorded here for
  // Chromium, where an IME can be driven: the Escape the IME takes is no close request.
  it("Chromium: a modal Dialog's close watcher ignores the Escape the IME takes", async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Popup data-testid="popup" aria-label="Notes">
          <input data-testid="text" aria-label="Note" />
        </Dialog.Popup>
      </Dialog.Root>,
    );
    const dialog = screen.getByTestId("popup") as HTMLDialogElement;
    await settle(() => expect(dialog.open).toBe(true));
    await imeEscape(screen.getByTestId("text") as HTMLInputElement);
    // Elsewhere the untrusted keydowns run no close watcher either.
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
