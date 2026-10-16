import { AccordionItem } from "./accordion-item.js";
import { AccordionPanel } from "./accordion-panel.js";
import { AccordionRoot } from "./accordion-root.js";
import { AccordionTrigger } from "./accordion-trigger.js";

/**
 * Accordion built on `<details>`/`<summary>`: `Root` (div) > `Item` (details) > `Trigger`
 * (summary, first child) + `Panel` (div). JS-free when the Root has no value props; a transition
 * state owner with optimistic `data-open` and `data-pending` otherwise.
 */
export const Accordion = {
  Root: AccordionRoot,
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Panel: AccordionPanel,
} as const;

export type {
  AccordionRootProps,
  AccordionRootMultipleProps,
  AccordionRootExclusiveProps,
  AccordionRootState,
  AccordionValueChangeDetails,
} from "./accordion-root.js";
export type { AccordionItemProps, AccordionItemState } from "./accordion-item.js";
export type { AccordionTriggerProps, AccordionTriggerState } from "./accordion-trigger.js";
export type { AccordionPanelProps, AccordionPanelState } from "./accordion-panel.js";
