/**
 * FUNSTACK UI — headless UI library for React, Async React-native.
 *
 * Every component is also available from its own subpath (`@funstack/ui/toggle`), which is the
 * documented form.
 */
export { Toggle } from "./toggle/index.js";
export type { ToggleProps, ToggleState, TogglePressedChangeDetails } from "./toggle/index.js";

export type {
  Action,
  ActionDetails,
  ChangeAction,
  RenderProp,
  StateValue,
} from "./internal/types.js";
