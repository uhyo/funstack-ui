"use client";
import { addTransitionType, useCallback, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { createActionDetails } from "./action-details.js";
import { callAction } from "./call-action.js";
import type { ActionDetails, ChangeAction, ChangeReason } from "../types.js";
import { useActionTrigger } from "./use-action-trigger.js";
import { useControllableAction } from "./use-controllable-action.js";
import { useLatest } from "../use-latest.js";

/** A value in a box: `null` is a value for some controls, so "none" is the box's absence. */
interface Boxed<V> {
  readonly value: V;
}

export interface StepCommitOptions<T, V, S, F extends object> {
  /** The controlled value (`undefined`: uncontrolled). */
  readonly controlled: T | undefined;
  readonly defaultValue: T | undefined;
  readonly initialValue: T;
  /** `valueChangeAction`: run in the step transition on every step. */
  readonly stepAction: ChangeAction<T, F & ActionDetails> | undefined;
  /** `valueCommitAction`: the action of `useControllableAction`, once per gesture. */
  readonly commitAction: ChangeAction<T, F & ActionDetails> | undefined;
  /** The step transition's types (`transitionTypes(component, "change")`). */
  readonly stepTypes: readonly string[];
  /** The commit transition's types (`transitionTypes(component, "commit")`). */
  readonly commitTypes: readonly string[];
  /** `useControllableAction`'s mode-switch warning. */
  readonly warn: { readonly component: string; readonly prop: string };
  /** The value as the control works with it internally. Stable (a module-level function). */
  readonly toShown: (value: T) => V;
  /** Back to the prop's shape, for the actions. */
  readonly fromShown: (shown: V) => T;
  /** The no-op test of a step and of a commit (conventions 2.3 item 8). */
  readonly equals: (a: V, b: V) => boolean;
  /**
   * The component's `details` fields for a step or a commit of `next` from `source`. Called
   * in the event that dispatches, after `onStep` (so a control that writes its form value there
   * can read it back: `details.valid`, field-form.md 7.5).
   */
  readonly details: (reason: ChangeReason, source: S | null, next: V) => F;
  /** A pointer is captured (a drag, a held button): holds `live` on screen by itself. */
  readonly captured: boolean;
  /** Applied to every step's value before the no-op test (NumberField's rounding). */
  readonly normalize?: ((next: V) => V) | undefined;
  /** Called by a step that changed the value, before its action runs. */
  readonly onStep?: ((next: V) => void) | undefined;
  /** Called by a commit that dispatched, after the dispatch. */
  readonly onCommit?: ((next: V, source: S | null, reason: ChangeReason) => void) | undefined;
}

export interface StepCommit<T, V, S> {
  /** What the control shows: `live` while held, else the optimistic value. */
  readonly shown: V;
  /** `shown` for handlers; also written by `step` ahead of the render. */
  readonly shownRef: RefObject<V>;
  /** The optimistic value, in the prop's shape. */
  readonly optimistic: T;
  /** The optimistic value, through `toShown`. */
  readonly optimisticShown: V;
  /** A step or a commit is in flight. */
  readonly pending: boolean;
  /** The source of the latest step or commit (raw: not cleared when nothing is pending). */
  readonly pendingSource: S | null;
  /**
   * One step: a pointer move, a key press, a tick, a platform change, the `"dismiss"` revert.
   * Returns `false` when `next` equals what is shown (nothing happened).
   */
  readonly step: (
    next: V,
    source: S | null,
    reason: ChangeReason,
    event: Event | undefined,
  ) => boolean;
  /**
   * Ends the open gesture: dispatches the commit of the value its steps reached, unless no
   * gesture is open or the value is back where the gesture began. Returns whether it dispatched.
   */
  readonly commit: (source: S | null, reason: ChangeReason, event: Event | undefined) => boolean;
  /**
   * The commit of a value that writes no state (conventions 3.3.1: NumberField's invalid typed
   * draft, uncontrolled): no gesture, no `live` step, no optimistic value. Runs `stepAction` in
   * the step transition and `commitAction` as a stateless dispatch, both with the same details
   * (`valid: false`). When the commit action rejects, `onReject` runs (before the rethrow); it
   * returns whether it dropped what the commit kept, having put the form value back to the shown
   * value, and then, unless a writing commit came after this one, the preview channel hears one
   * `"dismiss"` step of the shown value (no `live` step: the field already shows it), deferred
   * to the settle of a writing commit still in flight (its own revert replaces it if that commit
   * rejects). A stateless commit is not a later commit for a writing one's own `"dismiss"`.
   */
  readonly commitStateless: (
    next: V,
    source: S | null,
    reason: ChangeReason,
    event: Event | undefined,
    onReject: () => boolean,
  ) => void;
  /**
   * One `"dismiss"` step of the shown value for the preview channel, with no `live` step (the
   * control already shows it): a kept draft whose number `stepAction` heard has ended without a
   * step of its own (number-field.md 4.1). The caller has put the form value back first, so the
   * details read it.
   */
  readonly notifyDismiss: () => void;
  /** Opens a gesture at the shown value. */
  readonly openGesture: () => void;
  /** Opens a gesture at the shown value and shows it as `live` (a pointer capture begins). */
  readonly captureGesture: () => void;
  /**
   * Opens a gesture that began at `start`, unless one is open; the value it reached is left as
   * the step that calls this wrote it (Slider's native `input`, whose `change` commits later).
   */
  readonly markGestureStart: (start: V) => void;
  /**
   * For `useFieldValueChange`: whether the latest change was the user's (`"activate"`); consumes
   * it, so a later change from elsewhere is not taken for an edit.
   */
  readonly takeEdit: () => boolean;
}

/**
 * The step and commit core of a continuous control (conventions 2.3 corollary; slider.md 2.2 to
 * 2.4, number-field.md 2.2 to 2.4), shared by Slider and NumberField. Two channels: every step
 * runs `stepAction` in its own transition (`useActionTrigger`, no re-entry guard), once per
 * gesture `commitAction` is the action of `useControllableAction`. The value a gesture has
 * reached is urgent state (`live`), shown while a pointer is captured, a step waits for its
 * commit (`stepHeld`) or anything is in flight. A rejected commit in uncontrolled mode, for the
 * latest commit only, leaves the transition and reports the revert as a `"dismiss"` step.
 *
 * `T` is the prop's value, `V` the value the control works with (Slider: an array per thumb),
 * `S` the source of a gesture (Slider: the thumb index; NumberField: the button, key, wheel or
 * input), `F` the component's `details` fields.
 */
export function useStepCommit<T, V, S, F extends object>(
  options: StepCommitOptions<T, V, S, F>,
): StepCommit<T, V, S> {
  const { controlled, defaultValue, initialValue, commitAction, commitTypes, warn, toShown } =
    options;

  /** The value the open gesture has reached, for rendering. */
  const [live, setLive] = useState<Boxed<V> | null>(null);
  /**
   * A step was taken and its gesture's commit has not been dispatched yet. Holds `live` on
   * screen between a step and its commit when no step transition runs (no `stepAction`):
   * otherwise react-dom restores a controlled input to the old value after its `input`, and
   * Firefox then fires no `change` (slider.md 2.2).
   */
  const [stepHeld, setStepHeld] = useState(false);
  const [pendingSource, setPendingSource] = useState<S | null>(null);

  /** The value of the latest step, read by the commit in the same or a later event. */
  const liveRef = useRef<Boxed<V> | null>(null);
  /** The shown value when the open gesture began; `null` when no gesture is open. */
  const gestureStart = useRef<Boxed<V> | null>(null);
  const commitSeq = useRef(0);
  /**
   * The reason of the latest change the user or the platform made, consumed by `takeEdit`:
   * `"activate"` dismisses a shown server error, a rollback does not.
   */
  const lastReason = useRef<ChangeReason | null>(null);
  /**
   * The stateless commits (`commitStateless`) by their details: the writing commit they follow
   * (`commitSeq`, not advanced by them) and their `onReject`.
   */
  const statelessCommits = useRef(
    new WeakMap<object, { readonly seq: number; readonly onReject: () => boolean }>(),
  );

  /**
   * A rejected stateless commit ended its kept draft while a writing commit was in flight: the
   * `"dismiss"` notice waits for that commit (sent when it resolves; its own revert replaces it
   * when it rejects).
   */
  const dismissDeferred = useRef(false);

  const runCommit = async (next: T, details: F & ActionDetails): Promise<void> => {
    const stateless = statelessCommits.current.get(details);
    if (stateless !== undefined) {
      try {
        await (commitAction === undefined
          ? undefined
          : callAction(warn.component, details, (d) => commitAction(next, d)));
      } catch (error) {
        // Yield once to leave the commit's transition, as the writing path below does
        // (conventions 2.6): `onReject` writes urgent state (the draft).
        await undefined;
        // `notifyDismiss` and `commitState` are declared below; this runs long after the render.
        if (stateless.onReject() && stateless.seq === commitSeq.current) {
          // A writing commit still in flight reports the end itself: its own `"dismiss"` if it
          // rejects, the deferred notice below if it resolves. One notice either way.
          if (commitState.latestInFlight() === null) notifyDismiss();
          else dismissDeferred.current = true;
        }
        throw error;
      }
      return;
    }
    const seq = ++commitSeq.current;
    try {
      // Through `callAction` here, not only in `useControllableAction`: a `details.reject()`
      // (conventions 2.4.1) must take the revert below too.
      await (commitAction === undefined
        ? undefined
        : callAction(warn.component, details, (d) => commitAction(next, d)));
      if (dismissDeferred.current && seq === commitSeq.current) {
        dismissDeferred.current = false;
        notifyDismiss();
      }
    } catch (error) {
      if (seq === commitSeq.current) dismissDeferred.current = false;
      // In uncontrolled mode, tell the preview channel about the rollback, for the latest commit
      // only. Yield once to leave the commit's transition (conventions 2.6).
      if (controlled === undefined && seq === commitSeq.current) {
        await undefined;
        // `step` and `committedRef` are declared below; this runs long after the render.
        step(toShown(committedRef.current), null, "dismiss", undefined);
      }
      throw error;
    }
  };

  const commitState = useControllableAction<T, F & ActionDetails>({
    controlled,
    defaultValue,
    initialValue,
    action: runCommit,
    transitionTypes: () => commitTypes,
    warn,
  });
  const { optimistic, committed, dispatch } = commitState;
  const committedRef = useLatest(committed);

  // A step is not a re-entry: a continuous control dispatches one step per key press or pointer
  // move and every step must run (design/components/button.md 16.1), so no in-flight guard.
  const { pending: stepPending, run: runStep } = useActionTrigger({
    ignoreWhilePending: false,
  });

  const optimisticShown = useMemo(() => toShown(optimistic), [optimistic, toShown]);
  const held = options.captured || stepHeld || stepPending || commitState.pending;
  const shown = held && live !== null ? live.value : optimisticShown;
  const pending = stepPending || commitState.pending;

  const shownRef = useLatest(shown);

  const latest = useLatest({
    stepAction: options.stepAction,
    stepTypes: options.stepTypes,
    fromShown: options.fromShown,
    equals: options.equals,
    details: options.details,
    normalize: options.normalize,
    onStep: options.onStep,
    onCommit: options.onCommit,
    runStep,
    warnName: warn.component,
  });

  const step = useCallback(
    (next: V, source: S | null, reason: ChangeReason, event: Event | undefined): boolean => {
      const { normalize, equals, onStep } = latest.current;
      if (normalize !== undefined) next = normalize(next);
      // No-op against what the user sees (conventions 2.3 item 8).
      if (equals(next, shownRef.current)) return false;
      const reached = { value: next };
      liveRef.current = reached;
      shownRef.current = next;
      // A controlled parent that adopts steps changes the optimistic value per step.
      lastReason.current = reason;
      setLive(reached);
      setPendingSource(source);
      onStep?.(next);
      // A revert has no commit after it: the optimistic value already shows the committed one.
      if (reason !== "dismiss") setStepHeld(true);
      const {
        stepAction: action,
        stepTypes,
        fromShown,
        details,
        runStep: run,
        warnName,
      } = latest.current;
      // Without a step action there is nothing to run and no consumer update to keep
      // interruptible: no transition, so `data-pending` does not blink on every pointer move.
      if (action === undefined) return true;
      // Built in the event, not in the transition callback: `details.valid` reads the DOM.
      const fields = details(reason, source, next);
      run(() => {
        for (const type of stepTypes) addTransitionType(type);
        return callAction(warnName, createActionDetails(event, fields), (d) =>
          action(fromShown(next), d),
        );
      });
      return true;
    },
    [latest, shownRef],
  );

  const commit = useCallback(
    (source: S | null, reason: ChangeReason, event: Event | undefined): boolean => {
      const start = gestureStart.current;
      gestureStart.current = null;
      // The commit's own pending state holds `live` from here (set in this same batch).
      setStepHeld(false);
      const reached = liveRef.current;
      const { equals, fromShown, details, onCommit } = latest.current;
      // Nothing changed since the gesture began (a drag out and back, a trailing `change`).
      if (start === null || reached === null || equals(reached.value, start.value)) return false;
      const next = reached.value;
      lastReason.current = reason;
      setPendingSource(source);
      dispatch(fromShown(next), createActionDetails(event, details(reason, source, next)));
      onCommit?.(next, source, reason);
      return true;
    },
    [dispatch, latest],
  );

  const commitStateless = useCallback(
    (
      next: V,
      source: S | null,
      reason: ChangeReason,
      event: Event | undefined,
      onReject: () => boolean,
    ): void => {
      const {
        stepAction: action,
        stepTypes,
        fromShown,
        details,
        runStep: run,
        warnName,
      } = latest.current;
      // Built in the event: `details.valid` reads the DOM the caller has just written.
      const fields = details(reason, source, next);
      lastReason.current = reason;
      setPendingSource(source);
      // The commit's pending state holds `live` on screen: show what is shown now, not what an
      // earlier gesture left behind.
      const current = { value: shownRef.current };
      liveRef.current = current;
      setLive(current);
      if (action !== undefined) {
        run(() => {
          for (const type of stepTypes) addTransitionType(type);
          return callAction(warnName, createActionDetails(event, fields), (d) =>
            action(fromShown(next), d),
          );
        });
      }
      const commitDetails = createActionDetails(event, fields);
      statelessCommits.current.set(commitDetails, { seq: commitSeq.current, onReject });
      dispatch(fromShown(next), commitDetails, { stateless: true });
    },
    [dispatch, latest, shownRef],
  );

  /** The `"dismiss"` notice of a rejected stateless commit: the shown value, no `live` step. */
  const notifyDismiss = useCallback((): void => {
    const {
      stepAction: action,
      stepTypes,
      fromShown,
      details,
      runStep: run,
      warnName,
    } = latest.current;
    const value = shownRef.current;
    lastReason.current = "dismiss";
    if (action === undefined) return;
    const fields = details("dismiss", null, value);
    run(() => {
      for (const type of stepTypes) addTransitionType(type);
      return callAction(warnName, createActionDetails(undefined, fields), (d) =>
        action(fromShown(value), d),
      );
    });
  }, [latest, shownRef]);

  const openGesture = useCallback(() => {
    const start = { value: shownRef.current };
    gestureStart.current = start;
    liveRef.current = start;
  }, [shownRef]);

  const captureGesture = useCallback(() => {
    openGesture();
    // A capture alone holds `live` on screen: start it from what is shown, not from the value
    // an earlier gesture left behind (a press that steps nothing).
    setLive({ value: shownRef.current });
  }, [openGesture, shownRef]);

  const markGestureStart = useCallback((start: V) => {
    if (gestureStart.current === null) gestureStart.current = { value: start };
  }, []);

  const takeEdit = useCallback(() => {
    const edit = lastReason.current === "activate";
    lastReason.current = null;
    return edit;
  }, []);

  return {
    shown,
    shownRef,
    optimistic,
    optimisticShown,
    pending,
    pendingSource,
    step,
    commit,
    commitStateless,
    notifyDismiss,
    openGesture,
    captureGesture,
    markGestureStart,
    takeEdit,
  };
}
