"use client";
import { Activity } from "react";
import type { ReactNode } from "react";
import { ToolbarContext } from "./toolbar-context.js";

export interface OverlayContentOptions {
  readonly isLibrary: boolean;
  readonly keepMounted: boolean | undefined;
  /** Committed open, or held while the exit animates (design/components/popover.md 4.4). */
  readonly visible: boolean;
  readonly wrapContent: (children: ReactNode) => ReactNode;
}

/**
 * The children of a popup (Popover, Dialog, Menu, Combobox). JS-free mode: always rendered.
 * Library mode: rendered while `visible`, or with `keepMounted` inside an `<Activity>` whose mode
 * changes with committed state, inside the Root's transition (conventions 5.5). The content is
 * not part of an enclosing Toolbar's sequence (the engine excludes `[popover]` and `dialog`), so
 * parts inside it see no Toolbar. `children` is called only when rendered.
 */
export function renderOverlayContent(
  { isLibrary, keepMounted, visible, wrapContent }: OverlayContentOptions,
  children: () => ReactNode,
): ReactNode {
  let node: ReactNode;
  if (!isLibrary) {
    node = children();
  } else if (keepMounted === true) {
    node = <Activity mode={visible ? "visible" : "hidden"}>{wrapContent(children())}</Activity>;
  } else {
    node = visible ? wrapContent(children()) : null;
  }
  return <ToolbarContext value={null}>{node}</ToolbarContext>;
}
