"use client";
import { startTransition, useEffect, useRef, useState } from "react";
import { Menu } from "@funstack/ui/menu";
import { sleep } from "./fake-api.js";

// A focusable canvas as the region: right-click it, long-press it on touch, or focus it (Tab)
// and press Shift+F10 / the ContextMenu key. The checkbox and radio items keep the menu open and
// show data-pending while their (fake) save runs; "Export" is a submenu. The same options sit in
// the toolbar above: a context menu is never the only way to an action. A second right-click
// elsewhere on the canvas moves the open menu there.
export function ContextMenuCanvas() {
  const [grid, setGrid] = useState(true);
  const [zoom, setZoom] = useState("fit");
  const [exported, setExported] = useState("(nothing exported yet)");
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const { width, height } = element;
    context.clearRect(0, 0, width, height);
    const step = zoom === "fit" ? 20 : 40;
    if (grid) {
      context.strokeStyle = "rgb(128 128 128 / 0.35)";
      for (let x = 0; x <= width; x += step) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y <= height; y += step) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
    }
    context.fillStyle = "rgb(99 102 241)";
    const size = step * 3;
    context.fillRect(width / 2 - size / 2, height / 2 - size / 2, size, size);
  }, [grid, zoom]);

  const saveGrid = async (next: boolean) => {
    await sleep(500);
    startTransition(() => setGrid(next));
  };
  const saveZoom = async (next: string) => {
    await sleep(500);
    startTransition(() => setZoom(next));
  };
  const exportAs = (format: string) => async () => {
    await sleep(800);
    startTransition(() => setExported(`Exported diagram.${format}`));
  };

  return (
    <div className="demo-stack">
      <div className="demo-row" role="group" aria-label="View">
        <label className="demo-row">
          <input
            type="checkbox"
            checked={grid}
            onChange={(e) => startTransition(() => setGrid(e.target.checked))}
          />
          Grid
        </label>
        <select
          aria-label="Zoom"
          value={zoom}
          onChange={(e) => startTransition(() => setZoom(e.target.value))}
        >
          <option value="fit">Fit</option>
          <option value="100">100%</option>
        </select>
      </div>
      <Menu.Root>
        <Menu.ContextTrigger
          render={
            <canvas ref={canvas} width={320} height={160} tabIndex={0} aria-label="Diagram" />
          }
          className="demo-canvas"
        />
        <Menu.Popup
          className="demo-menu"
          aria-label="Diagram options"
          transition={{
            "fsui-menu-open": "menu-in",
            "fsui-menu-close": "menu-out",
            default: "none",
          }}
        >
          <Menu.CheckboxItem checked={grid} checkedChangeAction={saveGrid}>
            Show grid
          </Menu.CheckboxItem>
          <Menu.RadioGroup value={zoom} valueChangeAction={saveZoom}>
            <Menu.GroupLabel className="demo-menu-label">Zoom</Menu.GroupLabel>
            <Menu.RadioItem value="fit">Fit</Menu.RadioItem>
            <Menu.RadioItem value="100">100%</Menu.RadioItem>
          </Menu.RadioGroup>
          <Menu.Separator />
          <Menu.Root>
            <Menu.SubmenuTrigger>Export</Menu.SubmenuTrigger>
            <Menu.Popup className="demo-menu">
              <Menu.Item action={exportAs("svg")}>
                {({ pending }) => (pending ? "Exporting…" : "SVG")}
              </Menu.Item>
              <Menu.Item action={exportAs("png")}>
                {({ pending }) => (pending ? "Exporting…" : "PNG")}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        </Menu.Popup>
      </Menu.Root>
      <p className="demo-readout">{exported}</p>
    </div>
  );
}
