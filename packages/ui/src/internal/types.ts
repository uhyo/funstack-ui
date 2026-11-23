import type { ReactElement, ReactNode } from "react";

/** The arrow-key axis of a composite widget (Toolbar, Tabs, ToggleGroup, Slider). */
export type Orientation = "horizontal" | "vertical";

/**
 * A callback the library runs inside a Transition. May be sync or async: the library awaits
 * whatever it returns (a thenable is awaited, anything else is ignored). The return type is
 * `unknown` rather than `void | Promise<void>` so that `(next) => save(next)` compiles when `save`
 * returns data, as Server Functions usually do (conventions 2.2).
 */
export type Action<Args extends readonly unknown[] = []> = (...args: Args) => unknown;

/**
 * The base of every `details` object an action receives (the second argument of a change action).
 */
export interface ActionDetails {
  /** The DOM event that caused the action, or `undefined` for programmatic changes. */
  readonly event: Event | undefined;
}

/** An action called with the next value of a controllable state. */
export type ChangeAction<T, Details extends ActionDetails = ActionDetails> = Action<
  [next: T, details: Details]
>;

/**
 * A change **handler** the library calls synchronously, outside any Transition, and does not
 * await: the urgent lane (conventions 2.6; first used by Combobox's `onInputValueChange`). Not an
 * action: nothing is pending or optimistic for it. The body runs during the DOM event, so
 * `(next) => setText(next)` is an urgent update, which is what a controlled text input needs; a
 * returned promise is ignored (development warns once).
 */
export type UrgentChangeHandler<T, Details extends ActionDetails = ActionDetails> = (
  next: T,
  details: Details,
) => void;

/**
 * Why a change action was dispatched (conventions 2.2). One library-wide vocabulary: every
 * `<Component><State>ChangeDetails` that exposes `reason` declares it with this type.
 *
 * - `"activate"`: the user acted on a trigger part (click, Enter/Space, label click, focus in an
 *   automatic-activation mode). `details.event` is the native event.
 * - `"dismiss"`: the user closed the component without acting on one of its parts: Escape,
 *   Android back, an assistive-technology dismiss gesture, or a click outside (light dismiss).
 *   `details.event` is the platform's `close` event. Dialog is the first component to use it.
 * - `"platform"`: the browser changed the state itself: find-in-page, a form reset (`event` is
 *   the `reset` event), or interaction before hydration found at mount (`event` is `undefined`).
 * - `"timeout"`: the library's own timer closed the component; no user gesture and no platform
 *   event (`event` is `undefined`). Toast's auto-dismiss is the only user.
 */
export type ChangeReason = "activate" | "dismiss" | "platform" | "timeout";

/**
 * What a pure trigger (`Button`, `Dialog.Close`, `Popover.Close`, `Menu.Item`, `Toast.Action`)
 * does with an activation that arrives while its own action is pending (conventions 2.5.1):
 *
 * - `"run"`: the activation runs the action again, in the same transition; the part shows
 *   `data-pending` until every run has settled and is never `aria-disabled` because of pending.
 * - `"ignore"`: the activation starts nothing and its default action (a link's navigation, a
 *   form submission, a command) is cancelled; the part renders `aria-disabled="true"` while
 *   pending.
 *
 * The default depends on the part: `"run"` where the action is the user's alone (`Button`),
 * `"ignore"` where the library closes something after it (a Close part, a closing menu item).
 */
export type WhilePending = "run" | "ignore";

/** A prop value that is either a plain value or a function of the part's state. */
export type StateValue<T, State> = T | ((state: State) => T);

/**
 * Element polymorphism. Element form replaces the default element and the library merges its
 * props into it; function form receives the merged props and the part's state and renders
 * whatever it likes (it must spread `props` onto a DOM element).
 */
export type RenderProp<Props, State> =
  | ReactElement<Partial<Props>>
  | ((props: Props, state: State) => ReactNode);
