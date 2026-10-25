// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only.
import "../internal/platform-attributes.js";
import { ToolbarRoot } from "./toolbar-root.js";
import { ToolbarSeparator } from "./toolbar-separator.js";

/**
 * Toolbar (WAI-ARIA APG Toolbar pattern): `Root` (div role="toolbar") with one Tab stop and
 * arrow keys over its focusable descendants, and `Separator` (hr). Any focusable element is an
 * item: no wrapper parts. A command button is `Button` from `@funstack/ui/button`, which stays
 * focusable when disabled inside a Toolbar (design/components/button.md 7.3).
 *
 * @see https://ui.funstack.work/components/toolbar
 */
export const Toolbar = {
  Root: ToolbarRoot,
  Separator: ToolbarSeparator,
} as const;

export type { ToolbarRootProps, ToolbarRootState, ToolbarOrientation } from "./toolbar-root.js";
export type { ToolbarSeparatorProps, ToolbarSeparatorState } from "./toolbar-separator.js";
