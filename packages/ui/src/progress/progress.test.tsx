// Progress tests (jsdom), mapped to design/components/progress.md section 12.1.
//
// Progress / Meter: no action props and no library-owned state; the sync / async / rejection /
// overlap / superseded-rejection / suspending-content / controlled-parity / post-await /
// platform-path / urgent-action rows are N/A. The design replaces them with the "Lanes
// (consumer)" and "Server render" rows below. Keyboard: none (neither role is interactive).
//
// Covered by `progress.browser.test.tsx` instead: the accessibility tree (CDP), the fill's CSS
// transition on the registered custom property, the indeterminate animation, no
// `startViewTransition`, RTL and vertical layout.
import { act, render, screen } from "@testing-library/react";
import { createRef, startTransition, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, silenceErrors } from "../__tests__/helpers.js";
import type { Deferred } from "../__tests__/helpers.js";
import { resetWarnOnce } from "../internal/dev-warn.js";
import { Progress } from "./index.js";
import type { ProgressState } from "./index.js";

function Anatomy(props: Parameters<typeof Progress.Root>[0]) {
  return (
    <Progress.Root {...props}>
      <Progress.Label>Uploading</Progress.Label>
      <Progress.Value />
      <Progress.Track data-testid="track">
        <Progress.Indicator data-testid="indicator" />
      </Progress.Track>
    </Progress.Root>
  );
}

const bar = () => screen.getByRole("progressbar");

let errorSpy: { mock: { calls: unknown[][] }; mockRestore: () => void };
beforeEach(() => {
  resetWarnOnce();
  errorSpy = silenceErrors();
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe("Progress", () => {
  describe("roles and ARIA", () => {
    it("renders the section 1 attributes", () => {
      render(<Anatomy value={40} />);
      const root = bar();
      expect(root.tagName).toBe("DIV");
      expect(root).toHaveAttribute("aria-valuemin", "0");
      expect(root).toHaveAttribute("aria-valuemax", "100");
      expect(root).toHaveAttribute("aria-valuenow", "40");
      expect(root).toHaveAttribute("aria-valuetext", "40%");
      expect(root).not.toHaveAttribute("tabindex");
      const label = screen.getByText("Uploading");
      expect(label.tagName).toBe("SPAN");
      expect(root.getAttribute("aria-labelledby")).toBe(label.id);
      expect(label.id).toMatch(/-label$/);
      expect(root).toHaveAccessibleName("Uploading");
      const value = screen.getByText("40%", { selector: "span" });
      expect(value).toHaveAttribute("aria-hidden", "true");
    });

    it("references the Label id without a Label, after the consumer's tokens", () => {
      render(
        <>
          <h2 id="heading">Heading</h2>
          <Progress.Root value={10} aria-labelledby="heading" />
          <Progress.Root value={10} aria-label="Plain" />
        </>,
      );
      const [first, second] = screen.getAllByRole("progressbar");
      const tokens = first!.getAttribute("aria-labelledby")!.split(" ");
      expect(tokens[0]).toBe("heading");
      expect(tokens[1]).toMatch(/-label$/);
      expect(first).toHaveAccessibleName("Heading");
      expect(second!.getAttribute("aria-labelledby")).toMatch(/-label$/);
      expect(second).toHaveAccessibleName("Plain");
    });

    it("Value can be exposed with aria-hidden={false}", () => {
      render(
        <Progress.Root value={40} aria-label="x">
          <Progress.Value aria-hidden={false} data-testid="value" />
        </Progress.Root>,
      );
      expect(screen.getByTestId("value")).toHaveAttribute("aria-hidden", "false");
    });

    it("omits aria-valuenow and aria-valuetext while indeterminate", () => {
      render(<Anatomy />);
      const root = bar();
      expect(root).not.toHaveAttribute("aria-valuenow");
      expect(root).not.toHaveAttribute("aria-valuetext");
      expect(root).toHaveAttribute("aria-valuemin", "0");
      expect(root).toHaveAttribute("aria-valuemax", "100");
      expect(root).toHaveAttribute("data-indeterminate", "");
      expect(root.style.getPropertyValue("--progress-value")).toBe("");
    });

    it("owns role and the ARIA values against consumer props and a render element", () => {
      const props = {
        role: "status",
        "aria-valuenow": 3,
        "aria-valuetext": "no",
      } as Record<string, unknown>;
      render(
        <>
          <Progress.Root value={40} aria-label="a" {...props} />
          <Progress.Root
            aria-label="b"
            render={<section role="status" aria-valuenow={9} aria-valuetext="nine" />}
          />
        </>,
      );
      const [a, b] = screen.getAllByRole("progressbar");
      expect(a).toHaveAttribute("aria-valuenow", "40");
      expect(a).toHaveAttribute("aria-valuetext", "40%");
      expect(b!.tagName).toBe("SECTION");
      expect(b).not.toHaveAttribute("aria-valuenow");
      expect(b).not.toHaveAttribute("aria-valuetext");
    });
  });

  describe("arithmetic", () => {
    it("clamps the value", () => {
      render(<Anatomy value={150} />);
      expect(bar()).toHaveAttribute("aria-valuenow", "100");
      expect(bar()).toHaveAttribute("data-complete", "");
    });

    it("is complete at exactly max and above, not below", () => {
      const { rerender } = render(<Anatomy value={99.9} />);
      expect(bar()).not.toHaveAttribute("data-complete");
      rerender(<Anatomy value={100} />);
      expect(bar()).toHaveAttribute("data-complete", "");
      rerender(<Anatomy value={-5} />);
      expect(bar()).toHaveAttribute("aria-valuenow", "0");
      expect(bar()).not.toHaveAttribute("data-complete");
    });

    it("uses min and max", () => {
      render(<Anatomy value={15} min={10} max={20} />);
      expect(bar()).toHaveAttribute("aria-valuemin", "10");
      expect(bar()).toHaveAttribute("aria-valuemax", "20");
      expect(bar()).toHaveAttribute("aria-valuetext", "50%");
      expect(bar().style.getPropertyValue("--progress-value")).toBe("50%");
    });

    it("switches between indeterminate and determinate without remounting", () => {
      const { rerender } = render(<Anatomy />);
      const element = bar();
      rerender(<Anatomy value={20} />);
      expect(bar()).toBe(element);
      expect(element).not.toHaveAttribute("data-indeterminate");
      rerender(<Anatomy value={null} />);
      expect(bar()).toBe(element);
      expect(element).toHaveAttribute("data-indeterminate", "");
    });
  });

  describe("text", () => {
    it("formats the fraction by default", () => {
      render(<Anatomy value={2} max={8} locale="en" />);
      expect(bar()).toHaveAttribute("aria-valuetext", "25%");
    });

    it("formats the fraction for a percent format", () => {
      render(
        <Anatomy
          value={1}
          max={3}
          locale="en"
          format={{ style: "percent", maximumFractionDigits: 1 }}
        />,
      );
      expect(bar()).toHaveAttribute("aria-valuetext", "33.3%");
    });

    it("formats the value for a unit format", () => {
      render(
        <Anatomy
          value={3.2}
          max={8}
          locale="en"
          format={{ style: "unit", unit: "megabyte", maximumFractionDigits: 1 }}
        />,
      );
      expect(bar()).toHaveAttribute("aria-valuetext", "3.2 MB");
      expect(screen.getByText("3.2 MB", { selector: "span" })).toBeInTheDocument();
    });

    it("uses the locale", () => {
      render(<Anatomy value={40} locale="de" />);
      expect(bar()).toHaveAttribute("aria-valuetext", "40 %");
    });

    it("getAriaValueText receives the clamped value and the default state", () => {
      const get = vi.fn((value: number | null, state: ProgressState) =>
        value === null ? null : `${state.valueText}, 2 minutes left`,
      );
      const seen: ProgressState[] = [];
      render(
        <Progress.Root value={140} aria-label="x" locale="en" getAriaValueText={get}>
          {(state) => {
            seen.push(state);
            return <Progress.Value data-testid="value" />;
          }}
        </Progress.Root>,
      );
      expect(get).toHaveBeenCalledWith(100, expect.objectContaining({ valueText: "100%" }));
      expect(bar()).toHaveAttribute("aria-valuetext", "100%, 2 minutes left");
      expect(seen.at(-1)!.valueText).toBe("100%, 2 minutes left");
      expect(seen.at(-1)!.formattedValue).toBe("100%");
      expect(screen.getByTestId("value")).toHaveTextContent("100%", { normalizeWhitespace: true });
    });

    it("getAriaValueText returning null omits the attribute", () => {
      render(<Progress.Root value={40} aria-label="x" getAriaValueText={() => null} />);
      expect(bar()).not.toHaveAttribute("aria-valuetext");
      expect(bar()).toHaveAttribute("aria-valuenow", "40");
    });

    it("getAriaValueText is called with null while indeterminate and can set a text", () => {
      render(
        <Progress.Root
          aria-label="x"
          getAriaValueText={(v) => (v === null ? "Connecting" : null)}
        />,
      );
      expect(bar()).toHaveAttribute("aria-valuetext", "Connecting");
      expect(bar()).not.toHaveAttribute("aria-valuenow");
    });

    it("Value shows nothing while indeterminate", () => {
      render(
        <Progress.Root aria-label="x">
          <Progress.Value data-testid="value" />
        </Progress.Root>,
      );
      expect(screen.getByTestId("value")).toBeEmptyDOMElement();
    });
  });

  describe("data attributes", () => {
    const parts = () => [
      bar(),
      screen.getByText("Uploading"),
      screen.getByTestId("track"),
      screen.getByTestId("indicator"),
    ];

    it("data-indeterminate on every part", () => {
      render(<Anatomy />);
      for (const part of parts()) {
        expect(part).toHaveAttribute("data-indeterminate", "");
        expect(part).not.toHaveAttribute("data-complete");
        expect(part).not.toHaveAttribute("data-region");
      }
    });

    it("data-complete on every part, Value included", () => {
      render(<Anatomy value={100} />);
      for (const part of [...parts(), screen.getByText("100%", { selector: "span" })]) {
        expect(part).toHaveAttribute("data-complete", "");
        expect(part).not.toHaveAttribute("data-indeterminate");
      }
    });

    it("neither while in progress", () => {
      render(<Anatomy value={30} />);
      for (const part of parts()) {
        expect(part).not.toHaveAttribute("data-complete");
        expect(part).not.toHaveAttribute("data-indeterminate");
      }
    });
  });

  describe("custom properties", () => {
    it("--progress-value on the Root, none on the Indicator", () => {
      render(<Anatomy value={40} />);
      expect(bar().style.getPropertyValue("--progress-value")).toBe("40%");
      expect(screen.getByTestId("indicator")).not.toHaveAttribute("style");
    });

    it("the consumer's entry wins per property", () => {
      render(
        <Progress.Root
          value={40}
          aria-label="x"
          style={{ "--progress-value": "1%", color: "red" } as React.CSSProperties}
        />,
      );
      expect(bar().style.getPropertyValue("--progress-value")).toBe("1%");
      expect(bar().style.color).toBe("red");
    });
  });

  describe("function props and render", () => {
    it("every part receives the state", () => {
      const states: Record<string, ProgressState> = {};
      const record = (part: string) => (state: ProgressState) => {
        states[part] = state;
        return part;
      };
      render(
        <Progress.Root value={25} aria-label="x" locale="en" className={record("root")}>
          <Progress.Track className={record("track")} />
          <Progress.Indicator className={record("indicator")} />
          <Progress.Label className={record("label")} />
          <Progress.Value className={record("value")} />
        </Progress.Root>,
      );
      const expected: ProgressState = {
        value: 25,
        min: 0,
        max: 100,
        percentage: 25,
        formattedValue: "25%",
        valueText: "25%",
        indeterminate: false,
        complete: false,
      };
      for (const part of ["root", "track", "indicator", "label", "value"]) {
        expect(states[part]).toEqual(expected);
      }
      expect(bar()).toHaveClass("root");
    });

    it("style and children functions", () => {
      render(
        <Progress.Root value={50} aria-label="x" style={(s) => ({ opacity: s.percentage! / 100 })}>
          {(s) => (
            <Progress.Value>
              {(v) => `${v.value} of ${v.max}${s.complete ? "!" : ""}`}
            </Progress.Value>
          )}
        </Progress.Root>,
      );
      expect(bar().style.opacity).toBe("0.5");
      expect(bar().style.getPropertyValue("--progress-value")).toBe("50%");
      expect(screen.getByText("50 of 100")).toBeInTheDocument();
    });

    it("render element merges className and style and forwards refs", () => {
      const rootRef = createRef<HTMLElement>();
      const elementRef = createRef<HTMLElement>();
      const indicatorRef = createRef<HTMLElement>();
      render(
        <Progress.Root
          ref={rootRef as React.Ref<HTMLDivElement>}
          value={40}
          aria-label="x"
          className="a"
          style={{ color: "red" }}
          render={<section ref={elementRef} className="b" style={{ margin: "1px" }} />}
        >
          <Progress.Indicator
            ref={indicatorRef as React.Ref<HTMLSpanElement>}
            render={<i className="fill" />}
          />
          <Progress.Label render={<label />}>Name</Progress.Label>
        </Progress.Root>,
      );
      const root = bar();
      expect(root.tagName).toBe("SECTION");
      expect(root).toHaveClass("a", "b");
      expect(root.style.color).toBe("red");
      expect(root.style.margin).toBe("1px");
      expect(root.style.getPropertyValue("--progress-value")).toBe("40%");
      expect(rootRef.current).toBe(root);
      expect(elementRef.current).toBe(root);
      expect(indicatorRef.current?.tagName).toBe("I");
      const label = screen.getByText("Name");
      expect(label.tagName).toBe("LABEL");
      expect(root.getAttribute("aria-labelledby")).toContain(label.id);
    });

    it("a consumer ref alone and a render element ref alone are attached", () => {
      const a = createRef<HTMLDivElement>();
      const b = createRef<HTMLElement>();
      render(
        <>
          <Progress.Root ref={a} aria-label="a" />
          <Progress.Root aria-label="b" render={<section ref={b} />} />
        </>,
      );
      expect(a.current?.getAttribute("aria-label")).toBe("a");
      expect(b.current?.getAttribute("aria-label")).toBe("b");
    });

    it("render function receives props and state", () => {
      render(
        <Progress.Root
          value={60}
          aria-label="x"
          render={(props, state) => <article {...props} data-p={String(state.percentage)} />}
        />,
      );
      expect(bar().tagName).toBe("ARTICLE");
      expect(bar()).toHaveAttribute("data-p", "60");
    });
  });

  describe("lanes (consumer)", () => {
    function Uploader({ steps, wrap }: { steps: Deferred<void>[]; wrap: boolean }) {
      const [value, setValue] = useState<number | null>(null);
      const [pending, start] = useTransition();
      return (
        <>
          <button
            onClick={() =>
              start(async () => {
                setValue(50);
                await steps[0]!.promise;
                if (wrap) startTransition(() => setValue(80));
                else setValue(80);
                await steps[1]!.promise;
              })
            }
          >
            Upload
          </button>
          <output>{String(value)}</output>
          {pending && <Progress.Root value={value} aria-label="Uploading" />}
        </>
      );
    }

    it("a post-await setState renders before the action settles", async () => {
      const steps = [deferred(), deferred()];
      render(<Uploader steps={steps} wrap={false} />);
      await act(async () => screen.getByRole("button").click());
      // Mounted from `pending` in the same tick as the click; the sync-prefix value is held.
      expect(bar()).not.toHaveAttribute("aria-valuenow");
      await act(async () => steps[0]!.resolve());
      expect(bar()).toHaveAttribute("aria-valuenow", "80");
      await act(async () => steps[1]!.resolve());
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent("80");
    });

    it("a startTransition-wrapped setState is held until the action settles (the pitfall)", async () => {
      const steps = [deferred(), deferred()];
      render(<Uploader steps={steps} wrap={true} />);
      await act(async () => screen.getByRole("button").click());
      expect(bar()).not.toHaveAttribute("aria-valuenow");
      await act(async () => steps[0]!.resolve());
      expect(bar()).not.toHaveAttribute("aria-valuenow");
      expect(screen.getByRole("status")).toHaveTextContent("null");
      await act(async () => steps[1]!.resolve());
      expect(screen.getByRole("status")).toHaveTextContent("80");
    });
  });

  describe("dev warnings", () => {
    it("warns once for a degenerate range: 0%, not complete", () => {
      const { rerender } = render(<Anatomy value={5} min={5} max={5} />);
      rerender(<Anatomy value={5} min={5} max={5} />);
      const calls = errorSpy.mock.calls.filter((c) => String(c[0]).includes("must be greater"));
      expect(calls).toHaveLength(1);
      expect(bar().style.getPropertyValue("--progress-value")).toBe("0%");
      expect(bar()).not.toHaveAttribute("data-complete");
      expect(bar()).toHaveAttribute("aria-valuemin", "5");
      expect(bar()).toHaveAttribute("aria-valuemax", "5");
    });

    it("warns once for a non-finite value and renders indeterminate", () => {
      const { rerender } = render(<Anatomy value={Number.NaN} />);
      rerender(<Anatomy value={Number.NaN} />);
      const calls = errorSpy.mock.calls.filter((c) => String(c[0]).includes("not a finite number"));
      expect(calls).toHaveLength(1);
      expect(bar()).toHaveAttribute("data-indeterminate", "");
      render(<Progress.Root value={Infinity} aria-label="inf" />);
      expect(screen.getByRole("progressbar", { name: "inf" })).toHaveAttribute(
        "data-indeterminate",
        "",
      );
    });

    it("does not warn for a missing name (documented limitation)", () => {
      render(<Progress.Root value={40} />);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it.each([
      ["Progress.Track", <Progress.Track key="t" />],
      ["Progress.Indicator", <Progress.Indicator key="i" />],
      ["Progress.Label", <Progress.Label key="l" />],
      ["Progress.Value", <Progress.Value key="v" />],
    ] as [string, ReactNode][])("%s outside its Root throws", (name, element) => {
      expect(() => render(<>{element}</>)).toThrow(
        `${name} must be rendered inside a Progress.Root.`,
      );
    });
  });

  describe("server render", () => {
    const ui = (
      <Anatomy
        value={3.2}
        max={8}
        locale="en"
        format={{ style: "unit", unit: "megabyte", maximumFractionDigits: 1 }}
      />
    );
    /** The markup with ids masked and `style` serialised by the DOM (attribute for attribute). */
    const normalise = (html: string) => {
      const host = document.createElement("div");
      host.innerHTML = html;
      for (const el of host.querySelectorAll<HTMLElement>("[style]")) {
        el.setAttribute("style", el.style.cssText);
      }
      return host.innerHTML.replace(/_[rR]_[0-9a-z]+_/g, "ID");
    };

    it("renderToString carries the values before any script", () => {
      const html = renderToString(ui);
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuetext="3.2 MB"');
      expect(html).toContain("--progress-value:40%");
      expect(html).not.toContain("data-indeterminate");
      expect(renderToString(<Anatomy />)).toContain('data-indeterminate=""');
    });

    it("equals the client markup and hydrates without a mismatch", async () => {
      const html = renderToString(ui);
      const { container } = render(ui);
      expect(normalise(container.innerHTML)).toBe(normalise(html));

      const host = document.createElement("div");
      host.innerHTML = html;
      document.body.append(host);
      const recoverable = vi.fn();
      await act(async () => {
        hydrateRoot(host, ui, { onRecoverableError: recoverable });
      });
      expect(recoverable).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      host.remove();
    });
  });
});
