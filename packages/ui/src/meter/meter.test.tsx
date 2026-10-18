// Meter tests (jsdom), mapped to design/components/progress.md section 12.1. The region
// arithmetic is unit-tested in meter-region.test.ts, formatting in internal/range-value.test.ts.
//
// Progress / Meter: no action props and no library-owned state; the sync / async / rejection /
// overlap / superseded-rejection / suspending-content / controlled-parity / post-await /
// platform-path / urgent-action rows are N/A (the consumer-lanes row is in progress.test.tsx;
// Meter has no indeterminate state). Keyboard: none (the role is not interactive).
//
// Covered by `meter.browser.test.tsx` instead: the accessibility tree (CDP) and the native
// `<meter>` oracle for the regions.
import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetWarnOnce } from "../internal/dev-warn.js";
import { Meter } from "./index.js";
import type { MeterRootProps, MeterState } from "./index.js";

function Storage(props: Partial<MeterRootProps>) {
  return (
    <Meter.Root value={4.6} max={5} low={3.5} high={4.5} optimum={0} locale="en" {...props}>
      <Meter.Label>Storage</Meter.Label>
      <Meter.Value data-testid="value">
        {({ formattedValue, max }) => `${formattedValue} of ${max} GB`}
      </Meter.Value>
      <Meter.Track data-testid="track">
        <Meter.Indicator data-testid="indicator" />
      </Meter.Track>
    </Meter.Root>
  );
}

const meter = () => screen.getByRole("meter");

let errorSpy: { mock: { calls: unknown[][] }; mockRestore: () => void };
beforeEach(() => {
  resetWarnOnce();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe("roles and ARIA", () => {
  it("renders the section 1 attributes", () => {
    render(<Storage format={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }} />);
    const root = meter();
    expect(root.tagName).toBe("DIV");
    expect(root).toHaveAttribute("aria-valuemin", "0");
    expect(root).toHaveAttribute("aria-valuemax", "5");
    expect(root).toHaveAttribute("aria-valuenow", "4.6");
    expect(root).toHaveAttribute("aria-valuetext", "4.6 GB");
    expect(root).toHaveAttribute("data-region", "even-less-good");
    expect(root).toHaveAccessibleName("Storage");
    expect(root.getAttribute("aria-labelledby")).toBe(screen.getByText("Storage").id);
    expect(screen.getByTestId("value")).toHaveTextContent("4.6 GB of 5 GB");
    expect(screen.getByTestId("value")).toHaveAttribute("aria-hidden", "true");
    expect(root).not.toHaveAttribute("data-indeterminate");
    expect(root).not.toHaveAttribute("data-complete");
  });

  it("names through aria-label with the dangling Label token", () => {
    render(<Meter.Root value={50} aria-label="CPU" aria-labelledby="" />);
    expect(meter().getAttribute("aria-labelledby")).toMatch(/-label$/);
    expect(meter()).toHaveAccessibleName("CPU");
  });

  it("owns role and the ARIA values", () => {
    const props = { role: "img", "aria-valuenow": 1 } as Record<string, unknown>;
    render(<Meter.Root value={50} aria-label="x" {...props} render={<section role="img" />} />);
    expect(meter().tagName).toBe("SECTION");
    expect(meter()).toHaveAttribute("aria-valuenow", "50");
    expect(meter()).toHaveAttribute("aria-valuetext", "50%");
  });
});

describe("values and regions", () => {
  it("clamps the value", () => {
    render(<Meter.Root value={2} max={1} aria-label="x" />);
    expect(meter()).toHaveAttribute("aria-valuenow", "1");
  });

  it("defaults make every value optimum", () => {
    render(<Meter.Root value={10} aria-label="x" />);
    expect(meter()).toHaveAttribute("data-region", "optimum");
  });

  it.each([
    [1, "optimum"],
    [4, "suboptimum"],
    [4.6, "even-less-good"],
  ])("lower is better: %d is %s on every part", (value, region) => {
    render(<Storage value={value} />);
    for (const part of [
      meter(),
      screen.getByText("Storage"),
      screen.getByTestId("value"),
      screen.getByTestId("track"),
      screen.getByTestId("indicator"),
    ]) {
      expect(part).toHaveAttribute("data-region", region);
    }
  });

  it("higher is better", () => {
    render(<Meter.Root value={20} low={30} high={70} optimum={100} aria-label="x" />);
    expect(meter()).toHaveAttribute("data-region", "even-less-good");
  });

  it("getAriaValueText names the region", () => {
    render(
      <Storage
        format={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }}
        getAriaValueText={(v, { formattedValue, region }) => {
          expect(v).toBe(4.6);
          return region === "even-less-good" ? `${formattedValue}, almost full` : formattedValue;
        }}
      />,
    );
    expect(meter()).toHaveAttribute("aria-valuetext", "4.6 GB, almost full");
    expect(screen.getByTestId("value")).toHaveTextContent("4.6 GB of 5 GB");
  });

  it("getAriaValueText returning undefined omits the attribute", () => {
    render(<Meter.Root value={50} aria-label="x" getAriaValueText={() => undefined} />);
    expect(meter()).not.toHaveAttribute("aria-valuetext");
  });
});

describe("custom properties", () => {
  it("--meter-value, -low, -high, -optimum with the clamped values", () => {
    render(<Meter.Root value={150} low={-10} high={80} optimum={200} aria-label="x" />);
    const style = meter().style;
    expect(style.getPropertyValue("--meter-value")).toBe("100%");
    expect(style.getPropertyValue("--meter-low")).toBe("0%");
    expect(style.getPropertyValue("--meter-high")).toBe("80%");
    expect(style.getPropertyValue("--meter-optimum")).toBe("100%");
  });

  it("the consumer's entry wins per property; the Indicator has no inline size", () => {
    render(
      <Meter.Root value={50} aria-label="x" style={{ "--meter-value": "3%" } as CSSProperties}>
        <Meter.Indicator data-testid="indicator" />
      </Meter.Root>,
    );
    expect(meter().style.getPropertyValue("--meter-value")).toBe("3%");
    expect(meter().style.getPropertyValue("--meter-low")).toBe("0%");
    expect(screen.getByTestId("indicator")).not.toHaveAttribute("style");
  });
});

describe("function props and render", () => {
  it("every part receives the same state", () => {
    const states: Record<string, MeterState> = {};
    const record = (part: string) => (state: MeterState) => {
      states[part] = state;
      return part;
    };
    render(
      <Meter.Root
        value={40}
        low={30}
        high={70}
        optimum={50}
        aria-label="x"
        locale="en"
        className={record("root")}
      >
        <Meter.Track className={record("track")} />
        <Meter.Indicator className={record("indicator")} />
        <Meter.Label className={record("label")} />
        <Meter.Value className={record("value")} />
      </Meter.Root>,
    );
    const expected: MeterState = {
      value: 40,
      min: 0,
      max: 100,
      low: 30,
      high: 70,
      optimum: 50,
      percentage: 40,
      formattedValue: "40%",
      valueText: "40%",
      region: "optimum",
    };
    for (const part of ["root", "track", "indicator", "label", "value"]) {
      expect(states[part]).toEqual(expected);
    }
  });

  it("render element forwards refs and keeps the Label id", () => {
    const ref = createRef<HTMLDivElement>();
    const elementRef = createRef<HTMLElement>();
    render(
      <Meter.Root ref={ref} value={10} render={<section ref={elementRef} className="m" />}>
        <Meter.Label render={<label />}>Load</Meter.Label>
      </Meter.Root>,
    );
    expect(ref.current).toBe(meter());
    expect(elementRef.current).toBe(meter());
    expect(meter()).toHaveClass("m");
    expect(meter()).toHaveAccessibleName("Load");
  });
});

describe("dev warnings", () => {
  it("warns once for a non-finite value and renders min", () => {
    const { rerender } = render(<Meter.Root value={Number.NaN} min={2} max={4} aria-label="x" />);
    rerender(<Meter.Root value={Number.NaN} min={2} max={4} aria-label="x" />);
    expect(
      errorSpy.mock.calls.filter((c) => String(c[0]).includes("not a finite number")),
    ).toHaveLength(1);
    expect(meter()).toHaveAttribute("aria-valuenow", "2");
  });

  it("warns once for a degenerate range", () => {
    render(<Meter.Root value={1} min={1} max={1} aria-label="x" />);
    expect(
      errorSpy.mock.calls.filter((c) => String(c[0]).includes("must be greater")),
    ).toHaveLength(1);
    expect(meter().style.getPropertyValue("--meter-value")).toBe("0%");
  });

  it.each([
    ["Meter.Track", <Meter.Track key="t" />],
    ["Meter.Indicator", <Meter.Indicator key="i" />],
    ["Meter.Label", <Meter.Label key="l" />],
    ["Meter.Value", <Meter.Value key="v" />],
  ] as [string, ReactNode][])("%s outside its Root throws", (name, element) => {
    expect(() => render(<>{element}</>)).toThrow(`${name} must be rendered inside a Meter.Root.`);
  });
});

describe("server render", () => {
  it("renderToString carries the values and hydrates without a mismatch", async () => {
    const ui = <Storage format={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }} />;
    const html = renderToString(ui);
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuetext="4.6 GB"');
    expect(html).toContain('data-region="even-less-good"');
    expect(html).toContain("--meter-value:92%");
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
