// Meter browser tests (design/components/progress.md 12.2): the accessibility tree (Chromium,
// CDP) and the native `<meter>` as an oracle for `meterRegion()`. Firefox exposes the native
// region through `:-moz-meter-*` pseudo-classes; Chromium through which `::-webkit-meter-*-value`
// pseudo-element is painted (read from a screenshot of a meter whose three region pseudo-elements
// have distinct colours); WebKit asserts the library's attributes only and records the gap.
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { axProperty, getAXNodes } from "../__tests__/ax-tree.js";
import { browserName } from "../__tests__/engine.js";
import { Meter } from "./index.js";
import type { MeterRegion } from "./index.js";
import { meterRegion } from "./meter-region.js";

describe("Meter (browser)", () => {
  describe("accessibility", () => {
    it("exposes role, values and names", async () => {
      render(
        <>
          <Meter.Root value={4.6} max={5} optimum={0} low={3.5} high={4.5} locale="en">
            <Meter.Label>Storage</Meter.Label>
          </Meter.Root>
          <Meter.Root value={30} aria-label="CPU" />
        </>,
      );
      const [storage, cpu] = screen.getAllByRole("meter");
      expect(storage).toHaveAttribute("aria-valuetext", "92%");
      expect(storage).toHaveAttribute("data-region", "even-less-good");
      expect(cpu).toHaveAttribute("aria-valuenow", "30");
      if (browserName !== "chromium") return;

      const nodes = await getAXNodes();
      const byName = (name: string) =>
        nodes.find((n) => n.role?.value === "meter" && n.name?.value === name);
      const node = byName("Storage");
      expect(node).toBeDefined();
      expect(axProperty(node, "valuemin")).toBe(0);
      expect(axProperty(node, "valuemax")).toBe(5);
      expect(axProperty(node, "value")).toBeCloseTo(4.6, 5);
      // The dangling `-label` token is skipped: the aria-label names the meter (design 6.1).
      expect(axProperty(byName("CPU"), "value")).toBe(30);
    });
  });

  // Bounds low 30, high 70 on [-10, 100] (so a value of 0 still paints a fill); the 2.4 table at
  // and beside each boundary.
  const rows: [optimum: number, value: number][] = [
    [10, 0],
    [10, 30],
    [10, 31],
    [10, 70],
    [10, 71],
    [90, 100],
    [90, 70],
    [90, 69],
    [90, 30],
    [90, 29],
    [50, 30],
    [50, 70],
    [50, 29],
    [50, 71],
  ];

  const colours: Record<MeterRegion, string> = {
    optimum: "0,255,0",
    suboptimum: "0,0,255",
    "even-less-good": "255,0,0",
  };

  const oracleCss = `
meter.oracle { appearance: none; display: block; inline-size: 110px; block-size: 20px; }
meter.oracle::-webkit-meter-bar { background: rgb(255, 255, 255); border: 0; block-size: 20px; }
meter.oracle::-webkit-meter-optimum-value { background: rgb(${colours.optimum}); block-size: 20px; }
meter.oracle::-webkit-meter-suboptimum-value { background: rgb(${colours.suboptimum}); block-size: 20px; }
meter.oracle::-webkit-meter-even-less-good-value { background: rgb(${colours["even-less-good"]}); block-size: 20px; }
`;

  let cleanupStyle: (() => void) | undefined;
  afterEach(() => {
    cleanupStyle?.();
    cleanupStyle = undefined;
  });

  function nativeMeter(optimum: number, value: number): HTMLMeterElement {
    const meter = document.createElement("meter");
    meter.className = "oracle";
    meter.min = -10;
    meter.max = 100;
    meter.low = 30;
    meter.high = 70;
    meter.optimum = optimum;
    meter.value = value;
    document.body.append(meter);
    return meter;
  }

  /** The RGB of the pixel at (x, y) of a screenshot of `element`. */
  async function pixel(element: HTMLElement, x: number, y: number): Promise<string> {
    const base64 = await page.screenshot({ element, save: false });
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const scale = image.naturalWidth / element.getBoundingClientRect().width;
    const [r, g, b] = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
    return `${r},${g},${b}`;
  }

  const mozPseudo: Record<MeterRegion, string> = {
    optimum: ":-moz-meter-optimum",
    suboptimum: ":-moz-meter-sub-optimum",
    "even-less-good": ":-moz-meter-sub-sub-optimum",
  };

  /**
   * Gecko's operators (`HTMLMeterElement::GetOptimumState`): strict where Chromium's are not, so a
   * value exactly on `low` (lower is better) or on `high` (higher is better) is `suboptimum` in
   * Firefox and `optimum` in Chromium. HTML leaves the boundaries to the implementation; the
   * library follows Chromium (design 2.4). Recorded in memo/developer/cross-engine.md.
   */
  function geckoRegion(value: number, low: number, high: number, optimum: number): MeterRegion {
    if (optimum < low) {
      if (value < low) return "optimum";
      return value <= high ? "suboptimum" : "even-less-good";
    }
    if (high < optimum) {
      if (value > high) return "optimum";
      return value >= low ? "suboptimum" : "even-less-good";
    }
    return low <= value && value <= high ? "optimum" : "suboptimum";
  }

  describe("native meter oracle", () => {
    it.each(rows)("optimum %d, value %d agrees with the platform", async (optimum, value) => {
      render(
        <Meter.Root
          value={value}
          min={-10}
          max={100}
          low={30}
          high={70}
          optimum={optimum}
          aria-label="m"
        />,
      );
      const region = screen.getByRole("meter").getAttribute("data-region") as MeterRegion;
      expect(region).toBe(meterRegion(value, 30, 70, optimum));

      const native = nativeMeter(optimum, value);
      try {
        if (browserName === "firefox") {
          const matched = (Object.keys(mozPseudo) as MeterRegion[]).filter((r) =>
            native.matches(mozPseudo[r]),
          );
          expect(matched).toEqual([geckoRegion(value, 30, 70, optimum)]);
        } else if (browserName === "chromium") {
          const style = document.createElement("style");
          style.textContent = oracleCss;
          document.head.append(style);
          cleanupStyle = () => style.remove();
          expect(await pixel(native, 2, 10)).toBe(colours[region]);
        }
        // WebKit: no oracle is exposed to script; the library's region is asserted above.
      } finally {
        native.remove();
      }
    });
  });
});
