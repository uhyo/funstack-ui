/**
 * FUNSTACK UI — headless UI library for React, Async React-native.
 *
 * Every component is also available from its own subpath (`@funstack/ui/toggle`), which is the
 * documented form.
 */
export { Toggle } from "./toggle/index.js";
export type { ToggleProps, ToggleState, TogglePressedChangeDetails } from "./toggle/index.js";

export { Accordion } from "./accordion/index.js";
export type {
  AccordionRootProps,
  AccordionRootMultipleProps,
  AccordionRootExclusiveProps,
  AccordionRootState,
  AccordionValueChangeDetails,
  AccordionItemProps,
  AccordionItemState,
  AccordionTriggerProps,
  AccordionTriggerState,
  AccordionPanelProps,
  AccordionPanelState,
} from "./accordion/index.js";

export { Tabs } from "./tabs/index.js";
export type {
  TabsRootProps,
  TabsRootState,
  TabsValueChangeDetails,
  TabsOrientation,
  TabsActivationMode,
  TabsListProps,
  TabsListState,
  TabsTabProps,
  TabsTabState,
  TabsPanelProps,
  TabsPanelState,
  TabsIndicatorProps,
  TabsIndicatorState,
} from "./tabs/index.js";

export type {
  Action,
  ActionDetails,
  ChangeAction,
  RenderProp,
  StateValue,
} from "./internal/types.js";
