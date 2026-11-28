// The duplicate-copy check (#219). A second copy of the library cannot be loaded in this module
// graph without loading React twice, so a token of the test's own stands in for it: a component
// that registers the token is "a part of the other copy". The real parts register this copy
// through `useRender`; the directive-free ones (`NavigationMenu.Root` and `List`, Separator) do
// not, since they may never reach the client.
import { act, render } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationMenu } from "../navigation-menu/index.js";
import { Toggle } from "../toggle/index.js";
import { currentCopy, registerMountedCopy, resetCopyCheck } from "./use-copy-check.js";

const otherCopy = {};

function OtherCopyPart({ copy = otherCopy }: { copy?: object }) {
  useEffect(() => registerMountedCopy(copy), [copy]);
  return <span>other copy</span>;
}

function copyWarnings(error: { mock: { calls: unknown[][] } }): unknown[][] {
  return error.mock.calls.filter(
    ([message]) =>
      typeof message === "string" && message.startsWith("@funstack/ui: parts from two"),
  );
}

beforeEach(resetCopyCheck);
afterEach(resetCopyCheck);

describe("duplicate-copy check", () => {
  it("does not warn for many parts of one copy, also in StrictMode", () => {
    const error = vi.spyOn(console, "error");
    render(
      <StrictMode>
        <Toggle>A</Toggle>
        <Toggle>B</Toggle>
        <NavigationMenu.Root aria-label="Main">
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#a">A</NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </StrictMode>,
    );
    expect(copyWarnings(error)).toEqual([]);
  });

  it("warns once when parts of two copies are mounted together, naming the Vite workaround", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<Toggle>A</Toggle>);
    rerender(
      <>
        <Toggle>A</Toggle>
        <OtherCopyPart />
      </>,
    );
    const warnings = copyWarnings(error);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]![0]).toContain('optimizeDeps: { exclude: ["@funstack/ui"] }');
    expect(warnings[0]![0]).toContain(
      "https://ui.funstack.work/concepts/server-components#vite-dev",
    );

    // Once per page: a third copy, or more parts, add nothing.
    rerender(
      <>
        <Toggle>A</Toggle>
        <OtherCopyPart />
        <OtherCopyPart copy={{}} />
        <Toggle>B</Toggle>
      </>,
    );
    expect(copyWarnings(error)).toHaveLength(1);
  });

  it("warns when the other copy mounts first", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<OtherCopyPart />);
    expect(copyWarnings(error)).toEqual([]);
    rerender(
      <>
        <OtherCopyPart />
        <NavigationMenu.Root aria-label="Main">
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#a">A</NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </>,
    );
    expect(copyWarnings(error)).toHaveLength(1);
  });

  it("does not warn when one copy's parts unmount before the other's mount", () => {
    const error = vi.spyOn(console, "error");
    const { rerender, unmount } = render(<Toggle>A</Toggle>);
    rerender(<span />);
    rerender(<OtherCopyPart />);
    unmount();
    render(<Toggle>B</Toggle>);
    expect(copyWarnings(error)).toEqual([]);
  });

  it("does not warn when one commit replaces a copy's parts with the other's (an HMR update)", () => {
    const error = vi.spyOn(console, "error");
    const { rerender } = render(
      <>
        <Toggle>A</Toggle>
        <Toggle>B</Toggle>
      </>,
    );
    act(() => {
      rerender(
        <>
          <OtherCopyPart />
          <OtherCopyPart />
        </>,
      );
    });
    expect(copyWarnings(error)).toEqual([]);
  });

  it("counts per part: the copy stays mounted until its last part unmounts", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <>
        <Toggle>A</Toggle>
        <Toggle>B</Toggle>
      </>,
    );
    rerender(<Toggle>A</Toggle>);
    rerender(
      <>
        <Toggle>A</Toggle>
        <OtherCopyPart />
      </>,
    );
    expect(copyWarnings(error)).toHaveLength(1);
  });

  it("does not register during a server render (no effects run)", () => {
    const error = vi.spyOn(console, "error");
    renderToString(<Toggle>A</Toggle>);
    render(<OtherCopyPart />);
    expect(copyWarnings(error)).toEqual([]);
  });

  it("shares the registry across copies through a global key", () => {
    // A copy of another version must find the same registry: the key is `Symbol.for`, not a
    // module-local symbol.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const release = registerMountedCopy(currentCopy());
    const registry = (globalThis as Record<symbol, unknown>)[
      Symbol.for("@funstack/ui/mounted-copies")
    ] as { mounted: Map<object, number> };
    expect(registry.mounted.get(currentCopy())).toBe(1);
    release();
    expect(registry.mounted.has(currentCopy())).toBe(false);
    expect(copyWarnings(error)).toEqual([]);
  });
});
