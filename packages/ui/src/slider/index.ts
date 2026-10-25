// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only: the
// built JS has no import of it.
import "../internal/platform-attributes.js";
import { SliderIndicator } from "./slider-indicator.js";
import { SliderLabel } from "./slider-label.js";
import { SliderRoot } from "./slider-root.js";
import { SliderThumb } from "./slider-thumb.js";
import { SliderTrack } from "./slider-track.js";
import { SliderValuePart } from "./slider-value.js";

/**
 * Slider (WAI-ARIA APG Slider and Slider (Multi-Thumb) patterns): `Root` (`role="group"` with
 * several thumbs), `Label`, `Track` (owns the pointer), `Indicator` (the fill), one `Thumb` per
 * value (a styled element containing a visually hidden native `<input type="range">`), and
 * `Value`. Two actions: `valueChangeAction` on every step (a transition; keep it cheap) and
 * `valueCommitAction` once per gesture (the save; uncontrolled state is committed when it
 * resolves and rolls back when it rejects).
 *
 * @see https://ui.funstack.work/components/slider
 */
export const Slider = {
  Root: SliderRoot,
  Label: SliderLabel,
  Track: SliderTrack,
  Indicator: SliderIndicator,
  Thumb: SliderThumb,
  Value: SliderValuePart,
} as const;

export type {
  SliderValue,
  SliderOrientation,
  SliderRootProps,
  SliderRootState,
  SliderValueChangeDetails,
  SliderValueCommitDetails,
} from "./slider-root.js";
export type { SliderLabelProps } from "./slider-label.js";
export type { SliderTrackProps, SliderTrackState } from "./slider-track.js";
export type { SliderIndicatorProps, SliderIndicatorState } from "./slider-indicator.js";
export type { SliderThumbProps, SliderThumbState } from "./slider-thumb.js";
export type { SliderValueProps, SliderValueState } from "./slider-value.js";
