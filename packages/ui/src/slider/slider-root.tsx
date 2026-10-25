"use client";
import { addTransitionType, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { mergeTokenLists } from "../internal/merge-props.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  Orientation,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import { useActionTrigger } from "../internal/use-action-trigger.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useFieldControl, useFieldValueChange } from "../internal/use-field-control.js";
import { useLatest } from "../internal/use-latest.js";
import { useNativeGroupReconciliation } from "../internal/use-native-group-reconciliation.js";
import { useRegisterCount } from "../internal/use-register-count.js";
import { useSupersededRejection } from "../internal/use-superseded-rejection.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import {
  clampToNeighbours,
  equalValues,
  nearestThumb,
  platformDefault,
  pointerValue,
  resolveTie,
  sanitize,
  shapeOf,
  sliderGeometry,
  tiedRange,
  toArray,
} from "./slider-arithmetic.js";
import { SliderContext } from "./slider-context.js";
import type { SliderContextValue, SliderFieldWiring } from "./slider-context.js";
import { useSliderDevWarnings } from "./use-slider-dev-warnings.js";
import { useThumbRegistry } from "./use-thumb-registry.js";

/** One number (one thumb) or one number per thumb, in ascending order. */
export type SliderValue = number | readonly number[];

/** The arrow-key axis and layout of a Slider. */
export type SliderOrientation = Orientation;

/** Details passed as the second argument of `Slider.Root`'s `valueChangeAction` (each step). */
export interface SliderValueChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user moved a thumb (`details.event` is the native `input` event for a key
   * press, the `pointerdown` / `pointermove` / `pointerup` for a drag, the `keydown` for a
   * JS-normalised key).
   * `"platform"`: a form reset (the `reset` event) or a value found in the inputs at mount
   * (`undefined`).
   * `"dismiss"`: the commit action rejected and the slider reverted to the committed value
   * (uncontrolled mode; `undefined`).
   */
  readonly reason: ChangeReason;
  /** Index of the thumb that moved; `null` on a platform path or a revert, where several may change. */
  readonly thumb: number | null;
}

/** Details passed as the second argument of `Slider.Root`'s `valueCommitAction` (each gesture). */
export interface SliderValueCommitDetails extends ActionDetails {
  /**
   * `"activate"`: a gesture ended (`details.event` is the native `change` event for a key press,
   * the `pointerup` / `pointercancel` / `lostpointercapture` for a drag, the `keydown` for a
   * JS-normalised key). `"platform"`: a form reset (the `reset` event) or mount reconciliation
   * (`undefined`). Never `"dismiss"`.
   */
  readonly reason: ChangeReason;
  /** Index of the thumb the gesture moved; `null` on a platform path. */
  readonly thumb: number | null;
}

/**
 * State of `Slider.Root` and `Slider.Label`, passed to the function forms of `className`,
 * `style`, `children` and `render`.
 */
export interface SliderRootState<T extends SliderValue = number> {
  /**
   * The value the thumbs show: the value a gesture has reached while a pointer is captured or a
   * step or commit is in flight, else the optimistic value. Content rendered from it must not
   * suspend.
   */
  readonly value: T;
  /** `value` as an array, one entry per thumb, in thumb order. */
  readonly values: readonly number[];
  /** A step or commit dispatched through this Slider is in flight. */
  readonly pending: boolean;
  /** A pointer is captured on a thumb. */
  readonly dragging: boolean;
  /** The `orientation` prop. */
  readonly orientation: SliderOrientation;
  /** The `disabled` prop, or the enclosing Field's. */
  readonly disabled: boolean;
  /** The `min` prop. */
  readonly min: number;
  /** The `max` prop. */
  readonly max: number;
  /** The `step` prop. */
  readonly step: number;
}

/**
 * Props of `Slider.Root`. `T` is `number` (one thumb) or `readonly number[]` (one entry per
 * thumb), inferred from `value` / `defaultValue`.
 *
 * @see https://ui.funstack.work/components/slider
 */
export interface SliderRootProps<T extends SliderValue = number> extends Omit<
  ComponentPropsWithRef<"div">,
  | "defaultValue"
  | "role"
  | "className"
  | "style"
  | "children"
  // The value attributes are the native inputs' (design 8): never authored.
  | "aria-valuemin"
  | "aria-valuemax"
  | "aria-valuenow"
  | "aria-valuetext"
  | "aria-orientation"
> {
  /** Controlled value: one number, or one per thumb in ascending order. `undefined`: uncontrolled. */
  value?: T;
  /**
   * Initial value in uncontrolled mode; also the form-reset target (latest value).
   *
   * @defaultValue the platform's midpoint, `min + (max - min) / 2`, snapped to `step`
   */
  defaultValue?: T;
  /**
   * Runs inside the Root's step transition on every step: each pointer move, each key press,
   * each platform change, and the revert after a rejected commit (`reason: "dismiss"`,
   * uncontrolled). Awaited; `data-pending` meanwhile (without this action a step starts no
   * transition and is never pending). Adopt the value here in a controlled
   * parent (`setValue(next)` in the sync prefix is a transition update). Not the place for a
   * save: a pending async action entangles every transition in the app, and a drag is many
   * steps. A `setState` after your own `await` needs `startTransition`.
   */
  valueChangeAction?: ChangeAction<T, SliderValueChangeDetails>;
  /**
   * Runs inside the Root's commit transition once per gesture: pointer release, each key press,
   * a form reset, a value found at mount. Awaited; the thumb keeps the gesture's value and shows
   * `data-pending` until it settles; in uncontrolled mode the value is committed when it
   * resolves and reverts to the previous value if it rejects. May be a Server Function.
   */
  valueCommitAction?: ChangeAction<T, SliderValueCommitDetails>;
  /**
   * Lower bound of the range.
   *
   * @defaultValue `0`
   */
  min?: number;
  /**
   * Upper bound of the range. A `max` that is not on the step grid from `min` is unreachable, as
   * on a native range (dev warning).
   *
   * @defaultValue `100`
   */
  max?: number;
  /**
   * Must be positive. Values snap to `min + n × step`.
   *
   * @defaultValue `1`
   */
  step?: number;
  /**
   * Minimum number of steps between two adjacent thumbs.
   *
   * @defaultValue `0` (thumbs may share a value)
   */
  minStepsBetweenThumbs?: number;
  /**
   * Layout and arrow-key axis. Vertical sliders have `min` at the bottom.
   *
   * @defaultValue `"horizontal"`
   */
  orientation?: SliderOrientation;
  /**
   * `aria-valuetext` for a thumb, from the value it shows. Set it when the number alone is not
   * meaningful ("3 of 5 stars", "Tuesday"). Default: none (the number is announced).
   */
  getAriaValueText?: (value: number, index: number) => string;
  /**
   * Form field name for every thumb's input (a Thumb's own `name` wins). With several thumbs,
   * read with `FormData.getAll()`.
   */
  name?: string;
  /** The `form` attribute for every thumb's input (a Thumb's own `form` wins). */
  form?: string;
  /**
   * Disables every input (native `disabled`; not submitted) and the pointer. Never set while
   * pending. Inside a `Field.Root`, the Field's `disabled` also applies.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, SliderRootState<T>>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, SliderRootState<T>>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, SliderRootState<T>>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, SliderRootState<T>>;
}

const isDev = process.env.NODE_ENV !== "production";

const STEP_TYPES = transitionTypes("slider", "change");
const COMMIT_TYPES = transitionTypes("slider", "commit");

function replaceAt(values: readonly number[], index: number, value: number): readonly number[] {
  return values.map((v, i) => (i === index ? value : v));
}

/** Writes each registered input's `defaultValue` (the attribute a form reset restores). */
function writeDefaults(
  registry: ReadonlyMap<number, HTMLInputElement>,
  target: readonly number[],
): void {
  for (const [index, input] of registry) {
    const entry = target[index];
    if (entry !== undefined) input.defaultValue = String(entry);
  }
}

/** A pointer captured on a Thumb or the Track (design 4.1). */
interface ActiveGesture {
  readonly pointerId: number;
  /** Detaches the gesture's listeners. */
  readonly detach: () => void;
}

/**
 * Owns the slider's state (design/components/slider.md 2): the committed value through
 * `useControllableAction` with `valueCommitAction` (once per gesture), each step through its own
 * transition (`valueChangeAction`), and the value a gesture has reached in the urgent lane
 * (`live`), which the thumbs show while a pointer is captured or anything is in flight. Also the
 * pointer gesture, the Thumb registry, mount reconciliation and form reset, and the geometry
 * custom properties `--slider-start`, `--slider-end` and `--slider-value-<i>`.
 *
 * Owned keys (conventions 1.2): `role` (`"group"` with several thumbs), `aria-labelledby` (the
 * Label's id while a Label is mounted and there are several thumbs; token-merged with the
 * consumer's), `data-pending`, `data-dragging`, `data-orientation`, `data-disabled`. The custom
 * properties are merged into `style`, where the consumer's entries win.
 *
 * Inside a `Field.Root` (design 9.4) the Root calls `useFieldControl`: with one thumb, Thumb 0's
 * input is the Field's labelable control; with several, the Root registers itself as the group
 * and also owns the Field label in `aria-labelledby`, the Field's `aria-describedby` and
 * `data-invalid`. `name` / `disabled` default from the Field.
 */
function SliderRootImpl<T extends SliderValue = number>(props: SliderRootProps<T>) {
  const {
    value,
    defaultValue,
    valueChangeAction,
    valueCommitAction,
    min = 0,
    max = 100,
    step: stepProp = 1,
    minStepsBetweenThumbs = 0,
    orientation = "horizontal",
    getAriaValueText,
    name: nameProp,
    form,
    disabled: disabledProp = false,
    className,
    style,
    children,
    render,
    ...rest
  } = props;

  const stepValid = Number.isFinite(stepProp) && stepProp > 0;
  const step = stepValid ? stepProp : 1;
  const gap = Math.max(0, minStepsBetweenThumbs) * step;

  const id = useId();
  const labelId = `${id}-label`;

  // The shape (one number or an array) is fixed at mount (design 3.1).
  const [shape] = useState<"number" | "array">(() => shapeOf(value ?? defaultValue) ?? "number");
  const fromArray = useCallback(
    (values: readonly number[]): T => (shape === "number" ? values[0] : values) as T,
    [shape],
  );

  // --- State (design 2) ----------------------------------------------------------------------

  const [live, setLive] = useState<readonly number[] | null>(null);
  const [gestureThumb, setGestureThumb] = useState<number | null>(null);
  /**
   * A step was taken and its gesture's commit has not been dispatched yet. Holds `live` on
   * screen between a key's native `input` and `change` when no step transition runs (no
   * `valueChangeAction`): otherwise react-dom restores the controlled input to the old value
   * after `input`, and Firefox then fires no `change`.
   */
  const [stepHeld, setStepHeld] = useState(false);
  const [pendingThumb, setPendingThumb] = useState<number | null>(null);

  /** The value of the latest step, read by the commit in the same or a later event. */
  const liveRef = useRef<readonly number[] | null>(null);
  /** The shown value when the open gesture began; `null` when no gesture is open. */
  const gestureStart = useRef<readonly number[] | null>(null);
  const activeGesture = useRef<ActiveGesture | null>(null);
  const commitSeq = useRef(0);
  const trackRef = useRef<HTMLElement | null>(null);

  // One capture for both channels, before both transitions (see `captureSuperseded`).
  const captureSuperseded = useSupersededRejection();

  const runCommit = async (next: T, details: SliderValueCommitDetails): Promise<void> => {
    const seq = ++commitSeq.current;
    try {
      await valueCommitAction?.(next, details);
    } catch (error) {
      // Design 2.4: in uncontrolled mode, tell the preview channel about the rollback, for the
      // latest commit only. Yield once to leave the commit's transition (conventions 2.6).
      if (value === undefined && seq === commitSeq.current) {
        await undefined;
        // `stepTo` and `committedRef` are declared below; this runs long after the render.
        stepTo(toArray(committedRef.current), null, "dismiss", undefined);
      }
      throw error;
    }
  };

  const commitState = useControllableAction<T, SliderValueCommitDetails>({
    controlled: value,
    defaultValue,
    initialValue: platformDefault(min, max, step) as T,
    action: runCommit,
    transitionTypes: () => COMMIT_TYPES,
    warn: { component: "Slider.Root", prop: "value" },
    captureSuperseded,
  });
  const { optimistic, committed, dispatch } = commitState;
  const committedRef = useLatest(committed);

  // A step is not a re-entry: a continuous control dispatches one step per key press or pointer
  // move and every step must run (design/components/button.md 16.1), so no in-flight guard.
  const { pending: stepPending, run: runStep } = useActionTrigger({
    ignoreWhilePending: false,
    captureSuperseded,
  });

  const optimisticValues = useMemo(() => toArray(optimistic), [optimistic]);
  const held = gestureThumb !== null || stepHeld || stepPending || commitState.pending;
  const shown = held && live !== null ? live : optimisticValues;
  const pending = stepPending || commitState.pending;

  // --- Inside a Field.Root (design 9.4) ------------------------------------------------------

  // One thumb: its input is the Field's labelable control. Several: the Root (`role="group"`)
  // registers, `Field.Label` drops `for` and names the group through `aria-labelledby`.
  const thumbCount = shown.length;
  const field = useFieldControl({
    labelable: thumbCount === 1,
    name: nameProp,
    disabled: disabledProp,
    component: "Slider.Root",
  });
  const fieldName = field.fieldName;
  const name = field.name;
  const disabled = field.disabled;
  const fieldId = field.id;
  const thumbId = useCallback(
    (index: number) => (index === 0 && fieldId !== undefined ? fieldId : `${id}-thumb-${index}`),
    [id, fieldId],
  );
  const rootRef = thumbCount > 1 ? field.ref : undefined;
  useDevWarning(
    field.inField && field.required,
    isDev &&
      "Slider.Root: a range is never empty, so `required` on the enclosing Field.Root has no " +
        "effect on the slider.",
  );
  /**
   * The reason of the latest change the user or the platform made, consumed by the Field
   * notification below: `"activate"` dismisses a shown server error, a rollback does not.
   */
  const lastReason = useRef<ChangeReason | null>(null);
  // A pointer gesture and the JS-normalised keys fire no `input` / `change` the Field hears:
  // tell it at the commit, when the optimistic value changes (design 9.4.4).
  useFieldValueChange(optimisticValues.join("\u0000"), () => {
    const edit = lastReason.current === "activate";
    lastReason.current = null;
    return edit;
  });
  const {
    "aria-labelledby": fieldLabelledBy,
    "aria-describedby": fieldDescribedBy,
    "aria-invalid": fieldInvalid,
    "data-invalid": fieldDataInvalid,
  } = field.attributes;
  const inField = field.inField;
  const fieldRef = field.ref;
  const fieldWiring = useMemo<SliderFieldWiring | null>(() => {
    if (!inField) return null;
    const single = thumbCount === 1;
    return {
      inputRef: single ? fieldRef : undefined,
      describedBy: single ? fieldDescribedBy : undefined,
      invalid: fieldInvalid,
      dataInvalid: fieldDataInvalid,
      name: fieldName,
    };
  }, [inField, fieldRef, thumbCount, fieldDescribedBy, fieldInvalid, fieldDataInvalid, fieldName]);

  /** What the thumbs show, for handlers; also written by `stepTo` ahead of the render. */
  const shownRef = useLatest(shown);

  const latest = useLatest({
    valueChangeAction,
    fromArray,
    runStep,
    min,
    max,
    step,
    gap,
    orientation,
    disabled,
  });

  // --- Step and commit (design 2.4) ---------------------------------------------------------

  const stepTo = useCallback(
    (
      next: readonly number[],
      thumb: number | null,
      reason: ChangeReason,
      event: Event | undefined,
    ): boolean => {
      // No-op against what the user sees (conventions 2.3 item 8).
      if (equalValues(next, shownRef.current)) return false;
      liveRef.current = next;
      shownRef.current = next;
      // A controlled parent that adopts steps changes the optimistic value per step.
      lastReason.current = reason;
      setLive(next);
      setPendingThumb(thumb);
      // A revert has no commit after it: the optimistic value already shows the committed one.
      if (reason !== "dismiss") setStepHeld(true);
      const { valueChangeAction: action, fromArray: toValue, runStep: run } = latest.current;
      // Without a step action there is nothing to run and no consumer update to keep
      // interruptible: no transition, so `data-pending` does not blink on every pointer move.
      if (action === undefined) return true;
      run(() => {
        for (const type of STEP_TYPES) addTransitionType(type);
        return action?.(toValue(next), createActionDetails(event, { reason, thumb }));
      });
      return true;
    },
    [latest, shownRef],
  );

  const commitGesture = useCallback(
    (thumb: number | null, reason: ChangeReason, event: Event | undefined): void => {
      const start = gestureStart.current;
      gestureStart.current = null;
      // The commit's own pending state holds `live` from here (set in this same batch).
      setStepHeld(false);
      const next = liveRef.current;
      // Nothing changed since the gesture began (a drag out and back, a trailing `change`).
      if (start === null || next === null || equalValues(next, start)) return;
      lastReason.current = reason;
      setPendingThumb(thumb);
      dispatch(latest.current.fromArray(next), createActionDetails(event, { reason, thumb }));
    },
    [dispatch, latest],
  );

  // --- Thumb registry ------------------------------------------------------------------------

  const { registry, registerThumb, formElement } = useThumbRegistry();

  // --- Labels --------------------------------------------------------------------------------

  // The ref is for the dev warning, which can run before the re-render the registration scheduled.
  const {
    count: labelCount,
    register: registerLabel,
    countRef: labelCountRef,
  } = useRegisterCount();

  // --- Residual browser paths: mount reconciliation and form reset (design 9.2, 9.3) --------

  const [mountValue] = useState(value);
  const resetTarget = (): readonly number[] =>
    value !== undefined
      ? toArray(mountValue ?? value)
      : toArray(defaultValue ?? platformDefault(min, max, step));

  const readCurrent = (): readonly number[] =>
    shownRef.current.map((v, index) => {
      const input = registry.get(index);
      if (input === undefined) return v;
      const read = Number(input.value);
      return Number.isFinite(read) ? read : v;
    });

  const { onItemMounted } = useNativeGroupReconciliation<readonly number[]>({
    element: formElement,
    readCurrent,
    readDefault: resetTarget,
    base: () => shownRef.current,
    // Compare as the DOM would hold the values: a consumer's off-grid value is sanitised by the
    // browser (not by jsdom), and that is not a platform change.
    equals: (a, b) => {
      const reference = shownRef.current;
      return equalValues(
        sanitize(a, reference, min, max, step, gap),
        sanitize(b, reference, min, max, step, gap),
      );
    },
    onPlatformChange: (next, event) => {
      if (next.length !== shownRef.current.length) return;
      const before = shownRef.current;
      gestureStart.current = before;
      liveRef.current = before;
      stepTo(next, null, "platform", event);
      commitGesture(null, "platform", event);
    },
    onResetEvent: () => {
      // react-dom writes `defaultValue = value` after every update of a controlled input, so the
      // reset target is written here, right before the browser's reset algorithm reads it.
      writeDefaults(registry, resetTarget());
    },
  });

  // --- Keyboard (design 4.2) -----------------------------------------------------------------

  const inputStep = useCallback(
    (index: number, raw: number, event: Event) => {
      if (!Number.isFinite(raw)) return;
      const before = shownRef.current;
      if (index >= before.length) return;
      // A key press is a one-step gesture: it starts at the value shown before it.
      if (stepTo(replaceAt(before, index, raw), index, "activate", event)) {
        if (gestureStart.current === null) gestureStart.current = before;
      }
    },
    [shownRef, stepTo],
  );

  const inputCommit = useCallback(
    (index: number, event: Event) => {
      // A pointer gesture commits at its release.
      if (activeGesture.current !== null) return;
      commitGesture(index, "activate", event);
    },
    [commitGesture],
  );

  const inputKeyDown = useCallback(
    (index: number, event: KeyboardEvent) => {
      const {
        orientation: axis,
        disabled: off,
        min: lo,
        max: hi,
        step: inc,
        gap: g,
      } = latest.current;
      if (off) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      // Vertical: Firefox decreases a vertical range on ArrowRight; the APG says increase.
      // Horizontal RTL: the track is mirrored (min on the right), so ArrowLeft increases;
      // Chromium and Firefox mirror a native range, WebKit does not (design 7). LTR stays native.
      let increaseKey: "ArrowLeft" | "ArrowRight";
      if (axis === "vertical") {
        increaseKey = "ArrowRight";
      } else {
        // Read at the keydown: the direction may come from any ancestor and change at any time.
        const input = event.currentTarget as Element | null;
        if (input === null || getComputedStyle(input).direction !== "rtl") return;
        increaseKey = "ArrowLeft";
      }
      event.preventDefault();
      const before = shownRef.current;
      const current = before[index];
      if (current === undefined) return;
      const delta = event.key === increaseKey ? inc : -inc;
      const next = replaceAt(
        before,
        index,
        clampToNeighbours(before, index, current + delta, lo, hi, inc, g),
      );
      if (activeGesture.current !== null) {
        stepTo(next, index, "activate", event);
        return;
      }
      gestureStart.current = before;
      liveRef.current = before;
      stepTo(next, index, "activate", event);
      commitGesture(index, "activate", event);
    },
    [commitGesture, latest, shownRef, stepTo],
  );

  // --- Pointer (design 4.1) ------------------------------------------------------------------

  const warnedNoTrack = useRef(false);
  const beginGesture = useCallback(
    (index: number | null, event: PointerEvent, element: HTMLElement) => {
      const { disabled: off } = latest.current;
      if (off || event.button !== 0 || activeGesture.current !== null) return;
      const track = trackRef.current;
      if (track === null) {
        if (isDev && !warnedNoTrack.current) {
          warnedNoTrack.current = true;
          console.error(
            "Slider.Thumb: a pointer press needs a Slider.Track to map the pointer to a value. " +
              "Without a Track the slider is keyboard-only.",
          );
        }
        return;
      }
      // No text selection, no focus change through the compatibility `mousedown`.
      event.preventDefault();
      const rtl = getComputedStyle(track).direction === "rtl";

      const valueAt = (clientX: number, clientY: number): number => {
        const { min: lo, max: hi, orientation: axis } = latest.current;
        const rect = (trackRef.current ?? track).getBoundingClientRect();
        return pointerValue(rect, clientX, clientY, axis, rtl, lo, hi);
      };
      const moveTo = (thumb: number, raw: number, cause: Event): void => {
        const { min: lo, max: hi, step: inc, gap: g } = latest.current;
        const before = shownRef.current;
        if (thumb >= before.length) return;
        stepTo(
          replaceAt(before, thumb, clampToNeighbours(before, thumb, raw, lo, hi, inc, g)),
          thumb,
          "activate",
          cause,
        );
      };

      const start = valueAt(event.clientX, event.clientY);
      const startValues = shownRef.current;
      // A press on a Thumb that shares its value with a neighbour (stacked thumbs) moves the one
      // that can go toward the pointer, the Track's tie rule; when the press is exactly on the
      // value, the first move decides. Otherwise a Thumb press moves that Thumb.
      const tied = index === null ? null : tiedRange(startValues, index);
      /** The thumb the gesture moves; `null` while a press on stacked thumbs is undecided. */
      let decided: number | null =
        index === null ? nearestThumb(startValues, start) : tied ? resolveTie(tied, start) : index;
      /** The thumb shown as dragging and focused meanwhile. */
      let thumb = decided ?? index ?? 0;
      const pointerId = event.pointerId;
      try {
        element.setPointerCapture(pointerId);
      } catch {
        // An inactive pointer id (a synthetic event): the gesture still follows the element.
      }

      const decide = (raw: number): boolean => {
        if (decided !== null) return true;
        decided = resolveTie(tied, raw);
        if (decided === null) return false;
        if (decided !== thumb) {
          thumb = decided;
          setGestureThumb(thumb);
          registry.get(thumb)?.focus({ focusVisible: false } as FocusOptions);
        }
        return true;
      };
      const follow = (pointerEvent: PointerEvent): void => {
        const raw = valueAt(pointerEvent.clientX, pointerEvent.clientY);
        if (decide(raw)) moveTo(thumb, raw, pointerEvent);
      };

      const onMove = (moveEvent: PointerEvent): void => {
        if (moveEvent.pointerId !== pointerId) return;
        follow(moveEvent);
      };
      const onEnd = (endEvent: PointerEvent): void => {
        if (endEvent.pointerId !== pointerId) return;
        detach();
        // The release position is the gesture's last (an engine may coalesce the final move
        // into the `pointerup`); a cancel or a lost capture keeps the last move's value.
        if (endEvent.type === "pointerup") follow(endEvent);
        activeGesture.current = null;
        setGestureThumb(null);
        commitGesture(thumb, "activate", endEvent);
      };
      const detach = (): void => {
        element.removeEventListener("pointermove", onMove);
        element.removeEventListener("pointerup", onEnd);
        element.removeEventListener("pointercancel", onEnd);
        element.removeEventListener("lostpointercapture", onEnd);
      };
      element.addEventListener("pointermove", onMove);
      element.addEventListener("pointerup", onEnd);
      element.addEventListener("pointercancel", onEnd);
      element.addEventListener("lostpointercapture", onEnd);

      activeGesture.current = { pointerId, detach };
      setGestureThumb(thumb);
      gestureStart.current = shownRef.current;
      liveRef.current = shownRef.current;
      // A capture alone holds `live` on screen: start it from what is shown, not from the value
      // an earlier gesture left behind (a press exactly on the current value steps nothing).
      setLive(shownRef.current);
      // `:focus-visible` does not match after a pointer press, as on a native range.
      registry.get(thumb)?.focus({ focusVisible: false } as FocusOptions);
      if (decided !== null) moveTo(thumb, start, event);
    },
    [commitGesture, latest, registry, shownRef, stepTo],
  );

  // An unmount mid-gesture leaves no listener behind.
  useEffect(
    () => () => {
      activeGesture.current?.detach();
      activeGesture.current = null;
    },
    [],
  );

  // --- Development warnings ------------------------------------------------------------------

  useSliderDevWarnings({
    stepProp,
    stepValid,
    min,
    max,
    step,
    value,
    defaultValue,
    shape,
    // Inside a Field, `Field.Label` names the group (design 9.4.2).
    unnamedGroup:
      shown.length > 1 &&
      !inField &&
      rest["aria-label"] === undefined &&
      rest["aria-labelledby"] === undefined,
    labelCountRef,
  });

  // --- Render --------------------------------------------------------------------------------

  const count = shown.length;
  const geometry = sliderGeometry(shown, min, max);

  const shownValue = fromArray(shown);
  const dragging = gestureThumb !== null;
  const state = useMemo<SliderRootState<T>>(
    () => ({
      value: shownValue,
      values: shown,
      pending,
      dragging,
      orientation,
      disabled,
      min,
      max,
      step,
    }),
    [shownValue, shown, pending, dragging, orientation, disabled, min, max, step],
  );

  // Memoised: the functions are stable, so this changes only with the state below.
  const context = useMemo<SliderContextValue>(
    () => ({
      state: state as SliderRootState<SliderValue>,
      shown,
      min,
      max,
      step,
      gap,
      orientation,
      disabled,
      pending,
      draggingThumb: gestureThumb,
      pendingThumb,
      name,
      form,
      getAriaValueText,
      labelId,
      thumbId,
      trackRef,
      inputStep,
      inputCommit,
      inputKeyDown,
      beginGesture,
      registerThumb,
      registerLabel,
      onItemMounted,
      field: fieldWiring,
    }),
    [
      state,
      shown,
      min,
      max,
      step,
      gap,
      orientation,
      disabled,
      pending,
      gestureThumb,
      pendingThumb,
      name,
      form,
      getAriaValueText,
      labelId,
      thumbId,
      inputStep,
      inputCommit,
      inputKeyDown,
      beginGesture,
      registerThumb,
      registerLabel,
      onItemMounted,
      fieldWiring,
    ],
  );

  // Several thumbs: the Field's label, then `Slider.Label` while one is mounted (the consumer's
  // tokens come first through the merge). Only when there is one: an owned `undefined` would
  // remove the consumer's own tokens.
  const labelledBy =
    count > 1 ? mergeTokenLists(fieldLabelledBy, labelCount > 0 ? labelId : undefined) : "";
  const libraryProps: Partial<ComponentPropsWithRef<"div">> & DataAttributes = {
    role: count > 1 ? "group" : undefined,
    ...(labelledBy !== "" ? { "aria-labelledby": labelledBy } : {}),
    // The group element is described (read when focus enters it); one thumb: its input is.
    ...(count > 1 && fieldDescribedBy !== undefined
      ? { "aria-describedby": fieldDescribedBy }
      : {}),
    // Inside a Field only (`aria-invalid` goes on the inputs, never on the group).
    ...(inField ? { "data-invalid": fieldDataInvalid } : {}),
    "data-pending": dataAttr(pending),
    "data-dragging": dataAttr(dragging),
    "data-orientation": orientation,
    "data-disabled": dataAttr(disabled),
  };

  const element = useRender<ComponentPropsWithRef<"div">, SliderRootState<T>>({
    defaultElement: "div",
    render,
    state,
    className,
    // The geometry properties lose to the consumer's own entries (design 3.1).
    style: (s) => ({ ...(geometry as CSSProperties), ...resolveStateValue(style, s) }),
    children,
    props: rest,
    libraryProps,
    ref: rootRef,
  });

  return <SliderContext value={context}>{element}</SliderContext>;
}

SliderRootImpl.displayName = "SliderRoot";

/**
 * `Slider.Root`. Overloaded so that the value's shape is inferred from `value` / `defaultValue`
 * as `number` or `readonly number[]` (an array literal would otherwise infer a mutable
 * `number[]`), and every action and state function receives that shape (design 3.1).
 *
 * @see https://ui.funstack.work/components/slider
 */
export const SliderRoot = SliderRootImpl as {
  (props: SliderRootProps<number>): ReactNode;
  (props: SliderRootProps<readonly number[]>): ReactNode;
  (props: SliderRootProps<SliderValue>): ReactNode;
  displayName?: string;
};
