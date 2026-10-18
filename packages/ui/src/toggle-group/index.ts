// Platform attribute typings (`focusgroup`, `focusgroupstart`) for consumers of this subpath
// (conventions 7.4). Type-only.
import "../internal/platform-attributes.js";
import { ToggleGroupItem } from "./toggle-group-item.js";
import { ToggleGroupRoot } from "./toggle-group-root.js";

/**
 * A set of toggle buttons sharing one value (design/components/toggle-group.md): several values
 * by default, at most one with `exclusive`.
 */
export const ToggleGroup = { Root: ToggleGroupRoot, Item: ToggleGroupItem } as const;

export type {
  ToggleGroupRootProps,
  ToggleGroupMultipleProps,
  ToggleGroupExclusiveProps,
  ToggleGroupRootState,
  ToggleGroupValueChangeDetails,
  ToggleGroupOrientation,
} from "./toggle-group-root.js";
export type { ToggleGroupItemProps, ToggleGroupItemState } from "./toggle-group-item.js";
