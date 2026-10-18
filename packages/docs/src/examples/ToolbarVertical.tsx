"use client";
import { useState } from "react";
import { Menu } from "@funstack/ui/menu";
import { Toolbar } from "@funstack/ui/toolbar";

// A vertical toolbar. Up / Down walk the tools; on Shapes, ArrowRight opens the menu with its
// first item focused (ArrowLeft under direction: rtl) and ArrowDown moves on to the next tool.
export function ToolbarVertical() {
  const [tool, setTool] = useState("select");
  return (
    <div className="demo-row">
      <Toolbar.Root orientation="vertical" aria-label="Tools" className="demo-toolbar">
        <Toolbar.Button className="demo-toolbar-button" action={() => setTool("select")}>
          Select
        </Toolbar.Button>
        <Toolbar.Button className="demo-toolbar-button" action={() => setTool("draw")}>
          Draw
        </Toolbar.Button>
        <Toolbar.Separator className="demo-toolbar-separator" />
        <Menu.Root>
          <Menu.Trigger className="demo-toolbar-button">Shapes</Menu.Trigger>
          <Menu.Popup className="demo-menu" side="right">
            <Menu.Item action={() => setTool("rectangle")}>Rectangle</Menu.Item>
            <Menu.Item action={() => setTool("ellipse")}>Ellipse</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </Toolbar.Root>
      <p>
        Tool: <output>{tool}</output>
      </p>
    </div>
  );
}
