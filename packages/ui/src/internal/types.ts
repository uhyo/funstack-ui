import type { ReactElement, ReactNode } from "react";

/**
 * A callback the library runs inside a Transition. May be sync or async: the library awaits
 * whatever it returns (a thenable is awaited, anything else is ignored). The return type is
 * `unknown` rather than `void | Promise<void>` so that `(next) => save(next)` compiles when `save`
 * returns data, as Server Functions usually do (conventions 2.2).
 */
export type Action<Args extends readonly unknown[] = []> = (...args: Args) => unknown;

export interface ActionDetails {
  /** The DOM event that caused the action, or `undefined` for programmatic changes. */
  readonly event: Event | undefined;
}

/** An action called with the next value of a controllable state. */
export type ChangeAction<T, Details extends ActionDetails = ActionDetails> = Action<
  [next: T, details: Details]
>;

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
 */
export type ChangeReason = "activate" | "dismiss" | "platform";

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
