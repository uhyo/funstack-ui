// Progress browser tests (design/components/progress.md 12.2): what jsdom cannot observe. The
// accessibility tree is read through CDP in Chromium; the other engines assert the attributes.
import { act, render, screen } from "@testing-library/react";
import { startTransition, useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axProperty, getAXNodes } from "../__tests__/ax-tree.js";
import type { AXNode } from "../__tests__/ax-tree.js";
import { withReducedMotion } from "../__tests__/browser-commands.js";
import { browserName } from "../__tests__/engine.js";
import { Progress } from "./index.js";

// The docs recipe (design 7.3), with a slow linear transition so a mid-transition box is
// measurable.
const css = `
@property --progress-value { syntax: "<percentage>"; inherits: true; initial-value: 0%; }
.p { transition: --progress-value 1s linear; }
.track { position: relative; inline-size: 200px; block-size: 8px; overflow: hidden; }
.fill { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: var(--progress-value, 0%); }
.fill[data-indeterminate] { inset-inline-start: auto; inline-size: 30%; animation: slide 1.2s ease-in-out infinite; }
@keyframes slide { from { translate: -100% 0; } to { translate: 400% 0; } }
.vertical { writing-mode: vertical-lr; inline-size: 100px; block-size: 8px; }
@media (prefers-reduced-motion: reduce) {
  .p { transition: none; }
  .fill[data-indeterminate] { animation: none; inset-inline-start: 0; inline-size: 100%; opacity: .5; }
}
`;

function useStyles() {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  return () => style.remove();
}

let removeStyles: (() => void) | undefined;
afterEach(() => {
  removeStyles?.();
  removeStyles = undefined;
  vi.restoreAllMocks();
});

function Bar({ value, className = "p" }: { value: number | null; className?: string }) {
  return (
    <Progress.Root value={value} aria-label="Upload" className={className}>
      <Progress.Track className="track" data-testid="track">
        <Progress.Indicator className="fill" data-testid="fill" />
      </Progress.Track>
    </Progress.Root>
  );
}

describe("accessibility", () => {
  it("exposes role, values and names", async () => {
    render(
      <>
        <h2 id="ext">External</h2>
        <Progress.Root value={40} locale="en" format={{ style: "unit", unit: "megabyte" }}>
          <Progress.Label>Uploading report</Progress.Label>
        </Progress.Root>
        <Progress.Root aria-label="Loading messages" />
        <Progress.Root value={10} aria-labelledby="ext">
          <Progress.Label>file.pdf</Progress.Label>
        </Progress.Root>
      </>,
    );
    const [named, spinner] = screen.getAllByRole("progressbar");
    expect(named).toHaveAttribute("aria-valuetext", "40 MB");
    expect(spinner).not.toHaveAttribute("aria-valuenow");
    expect(spinner!.getAttribute("aria-labelledby")).toMatch(/-label$/);
    if (browserName !== "chromium") return;

    const nodes = await getAXNodes();
    const byName = (name: string): AXNode | undefined =>
      nodes.find((n) => n.role?.value === "progressbar" && n.name?.value === name);
    const upload = byName("Uploading report");
    expect(upload).toBeDefined();
    expect(axProperty(upload, "valuemin")).toBe(0);
    expect(axProperty(upload, "valuemax")).toBe(100);
    // CDP reports `valuetext` as "" for every role's `aria-valuetext` (an `input type=range`
    // reports its own value), so the text is asserted on the attribute above.
    expect(axProperty(upload, "value")).toBe(40);
    // The dangling `-label` token is skipped: the aria-label names the bar (design 6.1).
    const loading = byName("Loading messages");
    expect(loading).toBeDefined();
    expect(axProperty(loading, "value")).toBeUndefined();
    // The consumer's token, then the Label.
    expect(byName("External file.pdf")).toBeDefined();
  });
});

describe("fill transition", () => {
  it("the registered --progress-value transitions and the Indicator's box follows", async () => {
    removeStyles = useStyles();
    const { rerender } = render(<Bar value={0} />);
    const root = screen.getByRole("progressbar");
    const starts: string[] = [];
    root.addEventListener("transitionstart", (event) => {
      if (event.target === root) starts.push(event.propertyName);
    });
    rerender(<Bar value={100} />);
    await vi.waitFor(() => expect(starts).toEqual(["--progress-value"]));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const width = screen.getByTestId("fill").getBoundingClientRect().width;
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThan(200);
    expect(starts).toEqual(["--progress-value"]);
  });

  it("no transition with prefers-reduced-motion: reduce", async () => {
    removeStyles = useStyles();
    await withReducedMotion(async () => {
      const { rerender } = render(<Bar value={0} />);
      const root = screen.getByRole("progressbar");
      const starts: string[] = [];
      root.addEventListener("transitionstart", (event) => starts.push(event.propertyName));
      rerender(<Bar value={100} />);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(starts).toEqual([]);
      expect(screen.getByTestId("fill").getBoundingClientRect().width).toBe(200);
    });
  });
});

describe("indeterminate animation", () => {
  it("runs while indeterminate and stops with a value", () => {
    removeStyles = useStyles();
    const { rerender } = render(<Bar value={null} />);
    const fill = screen.getByTestId("fill");
    expect(fill.getAnimations().length).toBeGreaterThan(0);
    rerender(<Bar value={30} />);
    expect(fill.getAnimations()).toHaveLength(0);
  });

  it("none under prefers-reduced-motion", async () => {
    removeStyles = useStyles();
    await withReducedMotion(async () => {
      render(<Bar value={null} />);
      expect(screen.getByTestId("fill").getAnimations()).toHaveLength(0);
    });
  });
});

describe("ViewTransition", () => {
  it("never calls startViewTransition (no boundary exists)", async () => {
    const spy =
      typeof document.startViewTransition === "function"
        ? vi.spyOn(document, "startViewTransition")
        : undefined;
    const controls = {} as {
      setPending: (pending: boolean) => void;
      setValue: (value: number) => void;
    };
    function App() {
      const [pending, setP] = useState(false);
      const [value, setV] = useState(0);
      useEffect(() => {
        controls.setPending = setP;
        controls.setValue = setV;
      }, []);
      return pending ? <Bar value={value} /> : null;
    }
    render(<App />);
    await act(async () => startTransition(() => controls.setPending(true)));
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    await act(async () => startTransition(() => controls.setValue(60)));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    await act(async () => startTransition(() => controls.setPending(false)));
    expect(screen.queryByRole("progressbar")).toBeNull();
    if (spy) expect(spy).not.toHaveBeenCalled();
  });
});

describe("RTL and vertical", () => {
  it("under dir=rtl the fill starts at the inline end", () => {
    removeStyles = useStyles();
    render(
      <div dir="rtl">
        <Bar value={25} className="" />
      </div>,
    );
    const track = screen.getByTestId("track").getBoundingClientRect();
    const fill = screen.getByTestId("fill").getBoundingClientRect();
    expect(fill.width).toBeCloseTo(50, 0);
    expect(fill.right).toBeCloseTo(track.right, 0);
  });

  it("with writing-mode: vertical-lr on the Track the fill grows along the block axis of the page", () => {
    removeStyles = useStyles();
    render(
      <Progress.Root value={25} aria-label="v">
        <Progress.Track className="track vertical" data-testid="track">
          <Progress.Indicator className="fill" data-testid="fill" />
        </Progress.Track>
      </Progress.Root>,
    );
    const track = screen.getByTestId("track").getBoundingClientRect();
    const fill = screen.getByTestId("fill").getBoundingClientRect();
    expect(track.height).toBeCloseTo(100, 0);
    expect(fill.height).toBeCloseTo(25, 0);
    expect(fill.top).toBeCloseTo(track.top, 0);
    expect(fill.width).toBeCloseTo(track.width, 0);
  });
});
