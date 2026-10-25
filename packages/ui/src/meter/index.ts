// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only: the
// built JS has no import of it.
import "../internal/platform-attributes.js";
import { MeterIndicator } from "./meter-indicator.js";
import { MeterLabel } from "./meter-label.js";
import { MeterRoot } from "./meter-root.js";
import { MeterTrack } from "./meter-track.js";
import { MeterValue } from "./meter-value.js";

/**
 * Meter (WAI-ARIA `meter`): `Root` (`div[role=meter]`, directive-free, so a Server Component may
 * render it and it runs on the server), `Track`, `Indicator` (sized by your CSS from
 * `--meter-value`), `Label` and `Value`. `low` / `high` / `optimum` decide the region
 * (`data-region`: `optimum`, `suboptimum`, `even-less-good`) with the platform's rules.
 *
 * @see https://ui.funstack.work/components/meter
 */
export const Meter = {
  Root: MeterRoot,
  Track: MeterTrack,
  Indicator: MeterIndicator,
  Label: MeterLabel,
  Value: MeterValue,
} as const;

export type { MeterRootProps, MeterState, MeterRegion } from "./meter-root.js";
export type { MeterTrackProps } from "./meter-track.js";
export type { MeterIndicatorProps } from "./meter-indicator.js";
export type { MeterLabelProps } from "./meter-label.js";
export type { MeterValueProps } from "./meter-value.js";
