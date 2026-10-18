// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only.
import "../internal/platform-attributes.js";
import { ToolbarButton } from "./toolbar-button.js";
import { ToolbarRoot } from "./toolbar-root.js";
import { ToolbarSeparator } from "./toolbar-separator.js";

/**
 * Toolbar (WAI-ARIA APG Toolbar pattern): `Root` (div role="toolbar") with one Tab stop and
 * arrow keys over its focusable descendants, `Button` (an action button, focusable when
 * disabled) and `Separator` (hr). Any focusable element is an item: no wrapper parts.
 */
export const Toolbar = {
  Root: ToolbarRoot,
  Button: ToolbarButton,
  Separator: ToolbarSeparator,
} as const;

export type { ToolbarRootProps, ToolbarRootState, ToolbarOrientation } from "./toolbar-root.js";
export type {
  ToolbarButtonProps,
  ToolbarButtonState,
  ToolbarButtonActionDetails,
} from "./toolbar-button.js";
export type { ToolbarSeparatorProps, ToolbarSeparatorState } from "./toolbar-separator.js";
