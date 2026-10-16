/**
 * FUNSTACK UI — headless UI library for React, Async React-native.
 *
 * Every component is also available from its own subpath (`@funstack/ui/toggle`), which is the
 * documented form.
 */
// Ships the platform attribute typings (`interestfor`, `focusgroup`, ...) to consumers
// (conventions 7.4). Type-only: nothing is imported at runtime.
import "./internal/platform-attributes.js";

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

export { Tooltip } from "./tooltip/index.js";
export type {
  TooltipRootProps,
  TooltipRootState,
  TooltipProvides,
  TooltipTriggerProps,
  TooltipTriggerState,
  TooltipPopupProps,
  TooltipPopupState,
  TooltipSide,
  TooltipAlign,
} from "./tooltip/index.js";

export { Switch } from "./switch/index.js";
export type { SwitchProps, SwitchState, SwitchCheckedChangeDetails } from "./switch/index.js";

export { Checkbox } from "./checkbox/index.js";
export type {
  CheckboxProps,
  CheckboxState,
  CheckboxCheckedChangeDetails,
} from "./checkbox/index.js";

export type {
  Action,
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "./internal/types.js";
