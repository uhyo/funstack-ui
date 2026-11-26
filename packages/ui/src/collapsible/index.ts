// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only: the
// built JS has no import of it.
import "../internal/platform-attributes.js";
import { CollapsiblePanel } from "./collapsible-panel.js";
import { CollapsibleRoot } from "./collapsible-root.js";
import { CollapsibleTrigger } from "./collapsible-trigger.js";

/**
 * One disclosure built on `<details>`/`<summary>`: `Root` (details) > `Trigger` (summary, first
 * child) + `Panel` (div). JS-free when the Root has none of `open`, `defaultOpen` and
 * `openChangeAction`; a transition state owner with optimistic `data-open` and `data-pending`
 * otherwise.
 *
 * @see https://ui.funstack.work/components/collapsible
 */
export const Collapsible = {
  Root: CollapsibleRoot,
  Trigger: CollapsibleTrigger,
  Panel: CollapsiblePanel,
} as const;

export type {
  CollapsibleRootProps,
  CollapsibleRootState,
  CollapsibleOpenChangeDetails,
} from "./collapsible-root.js";
export type { CollapsibleTriggerProps, CollapsibleTriggerState } from "./collapsible-trigger.js";
export type { CollapsiblePanelProps, CollapsiblePanelState } from "./collapsible-panel.js";
