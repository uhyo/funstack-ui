import { TabsIndicator } from "./tabs-indicator.js";
import { TabsList } from "./tabs-list.js";
import { TabsPanel } from "./tabs-panel.js";
import { TabsRoot } from "./tabs-root.js";
import { TabsTab } from "./tabs-tab.js";

/**
 * Tabs (WAI-ARIA APG Tabs pattern): `Root` (div) > `List` (tablist) > `Tab` (button) and an
 * optional `Indicator` (span), plus one `Panel` (tabpanel) per tab. Tabs and the Indicator render
 * the optimistic selection; Panels render the committed one, so a suspending panel keeps the
 * current panel on screen while the Root and the selected Tab show `data-pending`.
 */
export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Tab: TabsTab,
  Panel: TabsPanel,
  Indicator: TabsIndicator,
} as const;

export type {
  TabsRootProps,
  TabsRootState,
  TabsValueChangeDetails,
  TabsOrientation,
  TabsActivationMode,
} from "./tabs-root.js";
export type { TabsListProps, TabsListState } from "./tabs-list.js";
export type { TabsTabProps, TabsTabState } from "./tabs-tab.js";
export type { TabsPanelProps, TabsPanelState } from "./tabs-panel.js";
export type { TabsIndicatorProps, TabsIndicatorState } from "./tabs-indicator.js";
