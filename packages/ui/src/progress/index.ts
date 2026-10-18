// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only: the
// built JS has no import of it.
import "../internal/platform-attributes.js";
import { ProgressIndicator } from "./progress-indicator.js";
import { ProgressLabel } from "./progress-label.js";
import { ProgressRoot } from "./progress-root.js";
import { ProgressTrack } from "./progress-track.js";
import { ProgressValue } from "./progress-value.js";

/**
 * Progress (WAI-ARIA `progressbar`): `Root` (`div[role=progressbar]`, directive-free, so a
 * Server Component may render it and it runs on the server), `Track` (the rail), `Indicator`
 * (the fill, sized by your CSS from `--progress-value`), `Label` and `Value`. Output-only: no
 * actions and no pending state; a `value` of `null` (the default) is indeterminate. Write a value
 * that reports on a pending action with a plain `setState`, never inside `startTransition`.
 */
export const Progress = {
  Root: ProgressRoot,
  Track: ProgressTrack,
  Indicator: ProgressIndicator,
  Label: ProgressLabel,
  Value: ProgressValue,
} as const;

export type { ProgressRootProps, ProgressState } from "./progress-root.js";
export type { ProgressTrackProps } from "./progress-track.js";
export type { ProgressIndicatorProps } from "./progress-indicator.js";
export type { ProgressLabelProps } from "./progress-label.js";
export type { ProgressValueProps } from "./progress-value.js";
