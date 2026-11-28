/**
 * `@funstack/ui/types`: the shared types that more than one component's props name and no
 * component owns (conventions 9.2).
 *
 * A pure types module (conventions 7.1): `export type` lines only, no value, no directive and no
 * platform-typings import (7.4 is for entries that render elements). Its JavaScript output is an
 * empty module. The root entry re-exports the same names; component subpaths do not.
 */
export type {
  Action,
  ActionDetails,
  ChangeAction,
  ChangeReason,
  Rejectable,
  RenderProp,
  StateValue,
  UrgentChangeHandler,
  UrgentHandler,
  WhilePending,
} from "../internal/types.js";
