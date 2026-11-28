// `documentOf` and the parts that read a native event's document (#215). Under
// `hydrateRoot(document, ...)` (FUNSTACK Static) React's root container is the document itself, so
// the `currentTarget` of every `event.nativeEvent` is a document, whose `ownerDocument` is `null`.
// The rows hydrate a whole page on a separate document (`createHTMLDocument`: same realm, no
// window), so the native `currentTarget` of each event is that document, as on such a page.
import { act } from "@testing-library/react";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import type { MockInstance } from "vitest";
import { Combobox } from "../combobox/index.js";
import { MultiSelect } from "../multi-select/index.js";
import { documentOf } from "./event-document.js";

describe("documentOf", () => {
  it("is the document itself, a node's owner document, or null", () => {
    const el = document.createElement("div");
    expect(documentOf(document)).toBe(document);
    expect(documentOf(el)).toBe(document);
    expect(documentOf(document.createTextNode("x"))).toBe(document);
    expect(documentOf(window)).toBeNull();
    expect(documentOf(null)).toBeNull();
  });

  it("reads a node of another document", () => {
    const other = document.implementation.createHTMLDocument("other");
    expect(documentOf(other)).toBe(other);
    expect(documentOf(other.body)).toBe(other);
  });
});

function Page({ children }: { children: ReactNode }) {
  return (
    <html>
      <head>
        <title>Page</title>
      </head>
      <body>{children}</body>
    </html>
  );
}

/**
 * Hydrates `app` (an `<html>` page) on a fresh document and returns it, with the window errors
 * and the `console.error` calls collected in `errors` (hydration mismatches, development
 * warnings), and a spy on the document's `addEventListener`. jsdom drops an exception thrown by a
 * listener of a windowless document, so the #215 `TypeError` itself is not seen here: the rows
 * assert its effect instead, the press listeners never added.
 */
async function hydrateOnDocument(app: ReactNode) {
  const doc = document.implementation.createHTMLDocument("page");
  doc.documentElement.innerHTML = renderToString(app).replace(/^<html>|<\/html>$/g, "");
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    errors.push(event.error);
    event.preventDefault();
  };
  window.addEventListener("error", onError);
  onTestFinished(() => window.removeEventListener("error", onError));
  const logged = vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args);
  });
  onTestFinished(() => logged.mockRestore());
  const added = vi.spyOn(doc, "addEventListener");
  const root = await act(async () => hydrateRoot(doc, app));
  onTestFinished(() => act(() => root.unmount()));
  added.mockClear();
  return { doc, errors, added };
}

/** A `focusin` on `target` (Testing Library's `fireEvent` needs the node's window). */
function focusIn(target: Element): void {
  act(() => {
    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  });
}

/** The press listeners the deferred focus-leave check (combobox.md 5.4) put on `doc`. */
function pressListeners(added: MockInstance<Document["addEventListener"]>): string[] {
  return added.mock.calls.map(([type]) => type).filter((type) => type === "pointerdown");
}

describe("a React root on the document (#215)", () => {
  it("Combobox.Input: focus watches the presses of the page's document", async () => {
    const { doc, errors, added } = await hydrateOnDocument(
      <Page>
        <Combobox.Root>
          <Combobox.Label>Country</Combobox.Label>
          <Combobox.Input data-testid="input" />
          <Combobox.Popup>
            <Combobox.List>
              {() => <Combobox.Option value="jp">Japan</Combobox.Option>}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>
      </Page>,
    );
    const input = doc.querySelector<HTMLInputElement>('[data-testid="input"]')!;
    focusIn(input);
    expect(errors).toEqual([]);
    expect(pressListeners(added)).toHaveLength(1);
  });

  it("Combobox.Chips: focus on a chip reads the page's document", async () => {
    const { doc, errors, added } = await hydrateOnDocument(
      <Page>
        <Combobox.Root multiple defaultValue={["jp"]}>
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
          <Combobox.Input />
          <Combobox.Popup>
            <Combobox.List>
              {() => <Combobox.Option value="jp">Japan</Combobox.Option>}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>
      </Page>,
    );
    focusIn(doc.querySelector('[data-testid="chip-jp"]')!);
    expect(errors).toEqual([]);
    expect(pressListeners(added)).toHaveLength(1);
  });

  it("MultiSelect.Trigger: focus watches the presses of the page's document", async () => {
    const { doc, errors, added } = await hydrateOnDocument(
      <Page>
        <MultiSelect.Root>
          <MultiSelect.Label>Toppings</MultiSelect.Label>
          <MultiSelect.Trigger data-testid="trigger">
            <MultiSelect.Value />
          </MultiSelect.Trigger>
          <MultiSelect.Popup>
            <MultiSelect.List>
              <MultiSelect.Option value="cheese">Cheese</MultiSelect.Option>
            </MultiSelect.List>
          </MultiSelect.Popup>
        </MultiSelect.Root>
      </Page>,
    );
    focusIn(doc.querySelector('[data-testid="trigger"]')!);
    expect(errors).toEqual([]);
    expect(pressListeners(added)).toHaveLength(1);
  });
});
