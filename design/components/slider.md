# Slider

Status: **proposed** (2026-10-18, wave 5, GitHub issue #54). Follows `design/conventions.md`
(accepted); where this document and the conventions disagree, the conventions win. The
conventions changes this design needs are listed under "Conventions feedback (proposed)" and
are **not yet applied** (another design holds `conventions.md` concurrently).

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/slider.md` (binding: a visually
hidden native `<input type="range">` per thumb, the optimistic value rendered during a drag, no
React commit event for a range, `form.reset()` a no-op on a controlled value input, multi-thumb
through neighbour `min` / `max`, vertical through `writing-mode`, `aria-valuetext`),
`docs/research/form-controls.md` (controlled native inputs, mount reconciliation, reset),
`docs/research/react-async-apis.md` (entanglement, optimistic sync lane), the accepted designs
of Checkbox / RadioGroup / Select (native-input machinery) and Combobox (the urgent lane, the
`reset`-event mirror, a Root that renders a hidden form element), the WAI-ARIA APG Slider and
Slider (Multi-Thumb) patterns, prior art (Base UI, Radix, React Aria, Ark UI), and working notes
in `memo/architect/slider-notes.md`.

Slider is the first **continuous** control in the library: a gesture produces tens of changes a
second, and only the last one is worth saving. The platform gives most of it for free through a
native range input: role, value and bounds, keyboard (including RTL mirroring and vertical
orientation), `<label>`, form participation, `disabled`. The library adds what the native control
cannot: a styleable thumb and track, pointer geometry, several thumbs that cannot cross, and the
Async React half: **a step is a transition** (a controlled parent's filter re-renders without
blocking the thumb), **a gesture is a dispatch** (the value is saved once, with `data-pending`,
and rolls back if the save fails), and the thumb under the pointer is **urgent** (it is where the
pointer is, like focus).

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `Slider.Root` (`div`; `role="group"` only with several thumbs), `Slider.Label` (`label`), `Slider.Track` (`div`, owns pointer interaction), `Slider.Indicator` (`span`, the fill), `Slider.Thumb` (`span` **plus** a visually hidden `<input type="range">`, one per value; explicit `index`), `Slider.Value` (`span`, not `<output>`). No `HiddenInput`, `Control`, `Marker` or `Output` parts. |
| 2 | Two actions | `valueChangeAction(next, details)` on every **step** (each `input` event, each pointer move) and `valueCommitAction(next, details)` once per **gesture** (pointer release, each key press, a platform reset). Both are ordinary `ChangeAction`s: awaited inside the Root's transitions, `data-pending` while in flight, errors to the boundary. The save belongs in `valueCommitAction`; a per-step network call is documented against. |
| 3 | Lanes | A step is a **transition** (through `useActionTrigger`): a controlled parent adopting `setPrice(v)` in the sync prefix gets an interruptible render, and content that suspends keeps the old UI with `data-pending`. The gesture's commit is the state owner's dispatch (`useControllableAction`: optimistic, latest wins). The thumb under the pointer is driven by a **`live` value in the urgent lane** (`useState`, written in the event); what the thumbs render is `live` while a gesture or a dispatch is in flight, else the optimistic value (section 2.2). No `UrgentChangeAction`: React does not require urgency here, and the urgent state is library-internal. |
| 4 | Uncontrolled commit | Uncontrolled committed state is written when the **commit** action resolves, not per step. A rejected save therefore rolls the thumb back to the value before the gesture (the vision's "optimistic + rollback"), and a `valueChangeAction` consumer is told with one `"dismiss"` step (2.4). |
| 5 | Value shape | `value: number \| readonly number[]` (one thumb or several), inferred from `value` / `defaultValue`; the shape is fixed at mount. Thumbs cannot cross: each hidden input's native `min` / `max` are its neighbours' values (plus `minStepsBetweenThumbs × step`), so Home / End / PageUp / PageDown and the accessibility tree respect the neighbours natively. |
| 6 | Platform first | `min`, `max`, `step`, `name`, `form`, `disabled`, `aria-valuetext` (from `getAriaValueText`) go on the native inputs; never `aria-valuemin` / `aria-valuemax` / `aria-valuenow`. Values snap and clamp exactly as the platform sanitises them (an unreachable `max` stays unreachable; dev warning). The default value is the platform's midpoint. |
| 7 | Keyboard | Native for every key (Arrow, PageUp / PageDown, Home / End; RTL mirrored by the browser; vertical Up / Down from `writing-mode: vertical-lr; direction: rtl` on the input). One JS normalisation: ArrowLeft / ArrowRight on a vertical slider (Firefox decreases on Right, against the APG). |
| 8 | Pointer | Library code on the Track and Thumb: `pointerdown` (prevented, so no text selection), pointer capture, value from the pointer position along the track's inline or block axis (direction read from the Track's computed style), `touch-action: pan-y` / `pan-x` inline. A track press moves the nearest thumb and focuses its input. The hidden input is `pointer-events: none`; no synthetic `input` / `change` events are fired for pointer gestures (13). |
| 9 | Forms and reset | Each input posts under its Thumb's `name` (or the Root's `name` for all). Reset: the library writes each input's `defaultValue` mirror **in the `reset` event** (react-dom rewrites the attribute after every value change) and dispatches the JS-computed reset target (uncontrolled: the latest `defaultValue`; controlled: the mount-time value) as one `"platform"` step + commit in the microtask. Mount reconciliation covers pre-hydration key presses and Firefox restoration. |
| 10 | Exposure | `data-pending` on Root and on the Thumb the gesture moved; `data-dragging` on Root and the captured Thumb; `data-orientation` on every part; `data-disabled`; `data-index` on Thumb. Geometry through CSS custom properties, never positioning: `--slider-value` (Thumb), `--slider-start` / `--slider-end` and `--slider-value-<i>` (Root, inherited). |
| 11 | ViewTransition | **No `transition` prop on any part** (Select precedent): nothing mounts from library state and every move is urgent or optimistic. Types `fsui-slider`, `fsui-slider-change` (step), `fsui-slider-commit` (gesture) for consumers' own boundaries. Thumb motion and rollback animate with a CSS transition on the registered custom property, disabled under `[data-dragging]`. |
| 12 | SSR | Every part file is `"use client"`. Server HTML carries the inputs with their values; before hydration keyboard and form submission work natively (the visuals catch up at mount through reconciliation); pointer does nothing. A plain `<input type="range">` from a Server Component remains the JS-free form slider (issue #19). |
| 13 | Not in v1 | `largeStep` / Shift+Arrow, `step="any"`, `list` / tick marks, per-thumb `disabled`, `inverted`, a value tooltip, `<rangegroup>`, `appearance: base` (section 13). |

---

## 1. Anatomy

```tsx
import { Slider } from "@funstack/ui/slider";

// One thumb, saved on release.
<Slider.Root name="volume" defaultValue={40} max={100} valueCommitAction={saveVolume}>
  <Slider.Label>Volume</Slider.Label>
  <Slider.Value />
  <Slider.Track className="track">
    <Slider.Indicator className="fill" />
    <Slider.Thumb className="thumb" />
  </Slider.Track>
</Slider.Root>

// Two thumbs, a live filter in a transition, saved on release.
<Slider.Root
  value={price}
  min={0} max={500} step={10} minStepsBetweenThumbs={1}
  valueChangeAction={(next) => { setPrice(next); }}          // sync prefix: a transition update
  valueCommitAction={(next) => saveFilter(next)}             // once per gesture
  getAriaValueText={(v) => `${v} dollars`}
>
  <Slider.Label>Price</Slider.Label>
  <Slider.Value>{({ values: [lo, hi] }) => `$${lo} – $${hi}`}</Slider.Value>
  <Slider.Track className="track">
    <Slider.Indicator className="fill" />
    <Slider.Thumb index={0} aria-label="Minimum price" name="price-min" className="thumb" />
    <Slider.Thumb index={1} aria-label="Maximum price" name="price-max" className="thumb" />
  </Slider.Track>
</Slider.Root>
```

Rendered HTML for the two-thumb example (`price` is `[100, 300]`; ids from one `useId` in Root;
inline styles abbreviated):

```html
<div role="group" aria-labelledby="_r_1_-label" data-orientation="horizontal"
     style="--slider-start: 20%; --slider-end: 60%; --slider-value-0: 20%; --slider-value-1: 60%">
  <label id="_r_1_-label">Price</label>
  <span>$100 – $300</span>
  <div class="track" data-orientation="horizontal" style="touch-action: pan-y">
    <span class="fill" data-orientation="horizontal"></span>
    <span class="thumb" data-index="0" data-orientation="horizontal" style="--slider-value: 20%; touch-action: pan-y">
      <input type="range" id="_r_1_-thumb-0" name="price-min" aria-label="Minimum price"
             min="0" max="290" step="10" value="100" aria-valuetext="100 dollars"
             style="position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; pointer-events: none">
    </span>
    <span class="thumb" data-index="1" data-orientation="horizontal" style="--slider-value: 60%; touch-action: pan-y">
      <input type="range" id="_r_1_-thumb-1" name="price-max" aria-label="Maximum price"
             min="110" max="500" step="10" value="300" aria-valuetext="300 dollars" style="…">
    </span>
  </div>
</div>
```

| Part | Element | Role | Renders from | Notes |
| --- | --- | --- | --- | --- |
| `Root` | `div` | `group` when `values.length > 1`, none otherwise | shown value (section 2.2), pending, dragging | Owns `useId`, the commit hook, the step transition, `live`, the gesture, the Thumb registry, form reset and mount reconciliation. `aria-labelledby` → the `Label` id while one is mounted (token-merged with the consumer's). Custom properties `--slider-start`, `--slider-end`, `--slider-value-<i>`. `data-pending`, `data-dragging`, `data-orientation`, `data-disabled`. |
| `Label` | `label` | | | `id` → the Root's `aria-labelledby` (several thumbs); `for` → the only thumb's input (one thumb). Registers with the Root from a layout effect, as Combobox's Label. |
| `Track` | `div` | none | orientation | The rail. Owns `onPointerDown` (a press moves the nearest thumb and starts its drag); inline `touch-action`. Its box is the geometry reference for pointer math. `data-orientation`, `data-disabled`. |
| `Indicator` | `span` | none | | The fill between the first and last thumb (from `min` to the value for one thumb). Renders no inline position: it is placed by the consumer's CSS from `--slider-start` / `--slider-end`. `data-orientation`, `data-disabled`. |
| `Thumb` | `span` **containing** `input[type=range]` | the input is the `slider` | shown value for its `index` | `index` (default `0`). The span: `data-index`, `data-orientation`, `data-dragging`, `data-pending`, `data-disabled`, `--slider-value`, inline `touch-action`, `onPointerDown`. The input: `id`, `name`, `form`, `min` / `max` (neighbours), `step`, `value` (shown), `disabled`, `aria-label` / `aria-labelledby` / `aria-describedby` (forwarded from the Thumb's props), `aria-valuetext`, the vertical `writing-mode`, the hidden-input style, the library's `onChange`, native `change` and `keydown` listeners. `inputRef` reaches it. |
| `Value` | `span` | none | shown value | Displays the value: `children(state)`, or the thumb at `index`, or the single value as text. Not `<output>` (research §2: a `status` live region that updates per step chatters). |

Why this shape:

- **One native range per thumb, visually hidden inside the Thumb** (research verdict). It is
  the focusable, labelled, form-participating element with role `slider`, native keys, RTL
  mirroring and `disabled`, in every engine, with no ARIA to maintain. Sized to the Thumb
  (`inset: 0; width: 100%; height: 100%`, Base UI's rule) so an assistive-technology focus ring
  lands on the visible thumb. `opacity: 0`, never `display: none` (it must stay in the
  accessibility tree) and `pointer-events: none`, so the library's pointer code is the only
  pointer path and the native thumb size never decides the mapping (research §4, structure 1).
- **`Thumb` renders two elements.** Conventions 1.1 says a part renders at most one DOM element.
  The styled thumb and the native control cannot be the same element (no engine ships
  `appearance: base` and `::slider-thumb`, research §2), and a separate `Slider.Input` child
  part (Ark's `HiddenInput`) would make a Thumb without it silently non-functional. Every
  prior-art library renders both; this design does too and asks for the exception in the
  conventions feedback. `ref` goes to the styled element, `inputRef` to the control.
- **Explicit `index`** (React Aria), not registration order (Radix, Base UI): the value array
  decides how many thumbs exist and which value each input holds; an index that is explicit
  survives conditional rendering and reads like `Tabs.Tab value`. Two Thumbs with the same
  index, or an index outside the value, warn in development.
- **`Track` owns the pointer** because the value-to-position mapping needs one box; Thumbs are
  usually absolutely positioned inside it and a press on a Thumb bubbles to it. A Thumb
  rendered outside the Track still works (its own `onPointerDown` delegates to the Root, which
  reads the Track's box); a Root with no Track is keyboard-only (dev warning on a pointer press).
- **`Indicator`, not `Range`**: the vocabulary already has "purely visual element that tracks
  state" (conventions 1.1), and Base UI uses the same word; Radix's `Range` is the alternative
  (product-owner item 4).
- **`Label` is a part** because a multi-thumb slider is a `group` that needs a name from an
  element with an id, and a single-thumb slider wants `<label for>`; one part does whichever
  applies from the thumb count. Thumbs of a multi-thumb slider still need their own names
  (`aria-label="Minimum price"`), as the APG multi-thumb pattern requires (dev warning when a
  Thumb of a multi-thumb slider has none).
- **No `<ViewTransition>` anywhere** (section 11).

Element constraints for `render`: `Thumb`'s styled element may be anything (the input is always
the library's); `Track` any element with a box; `Label` must stay a `<label>` when the slider
has one thumb (the `for` association) and may be any element otherwise; `Root` any element.
Library-controlled attributes (`role`, `aria-labelledby` tokens, ids, `data-*`, the custom
properties, `touch-action`) land on whichever element renders (owned keys, conventions 1.2).

---

## 2. States and lanes

| State | Owner | Kind | Lane | Library-owned or browser-owned |
| --- | --- | --- | --- | --- |
| `value` (committed, optimistic) | Root, `useControllableAction<T>` with `valueCommitAction` as its action | the value of the slider | **transition** (optimistic through `useOptimistic`) | Library-owned; residual browser paths: pre-hydration keys and Firefox restoration (mount reconciliation), form reset. Uncontrolled state is written when a gesture's commit resolves (2.3). |
| `live` | Root, `useState<readonly number[] \| null>` | the value a gesture has reached | **urgent** (written in the DOM event, never in a transition) | Library-owned, internal: it is the thumb under the pointer, or the value a key press produced, before anything has committed. Not controllable, not in the public vocabulary; it shows up only as the value the thumbs render. |
| step transition | Root, `useActionTrigger` | `valueChangeAction` in flight | transition | One `run` per step; latest run's rejection goes to React, older ones are surfaced (conventions 3.4). No state of its own. |
| `gesture` | Root, `useState<{ thumb: number } \| null>` | a pointer is captured on a thumb | urgent | `dragging = gesture !== null`; `data-dragging`. Keyboard is never "dragging". |
| `pendingThumb` | Root, `useState<number \| null>` | the thumb the latest step or commit was for | urgent | `data-pending` on that Thumb while the Root is pending; `null` for platform dispatches. |
| `pending` | Root | step or commit transition in flight | | `stepPending || commitPending`. Includes the Suspense wait of a step's render (a controlled parent's list loading). |
| focus | DOM | | | Browser-owned. The library calls `focus()` only on the thumb a track press moved. |

### 2.1 Why two actions, and what each is for

React's `onChange` for a range fires on every native `input` (every pointer move, every key
press) and there is **no React event for the native `change`** that marks the end of a gesture
(research finding 2). The library therefore distinguishes the two itself and gives each a prop:

| | `valueChangeAction` | `valueCommitAction` |
| --- | --- | --- |
| Called | on every step: each pointer move during a drag, each key press, each platform change | once per gesture: pointer release, each key press (a one-step gesture), each platform change |
| Lane | transition, through the Root's step transition (`useActionTrigger`) | transition, through the Root's commit dispatch (`useControllableAction`) |
| Awaited, pending | yes; `data-pending` while any step is in flight | yes; `data-pending` while the commit is in flight |
| Optimistic | none of its own (the thumb shows `live`, 2.2) | `setOptimistic(next)`: the thumb keeps the gesture's value through the save and reverts on rejection |
| Uncontrolled state | **not written** | written when it resolves (latest wins) |
| Meant for | adopting the value in a controlled parent (`setPrice(next)` in the sync prefix, a transition update), a live preview, cheap synchronous work | saving: a Server Function, a fetch, `requestSubmit()` |

A per-step action that awaits a network call is documented against, twice: every pending async
action entangles every transition in the app (conventions 2.3 item 5), and a drag would start
dozens of them. The library does not warn (a sync prefix that returns a promise for a cheap
reason is legitimate); the docs put the rule next to every example. A Server Function belongs in
`valueCommitAction`.

### 2.2 What the thumbs render: `live`, then optimistic

The research's finding 1 says the controlled input must render the optimistic value during a
drag, and its probe shows why it worked there: the action was still pending. `useOptimistic`
holds a value only **while a transition is pending**. A step whose action is synchronous (or
absent) finishes in a microtask, after which the optimistic value re-bases onto the committed
value; between two pointer moves the thumb would snap to the committed value, which in
uncontrolled mode (2.3) and for a controlled "update on success" parent is the value *before*
the gesture. Holding one transition open for the gesture is not an option: an action must never
await user input (conventions 2.3 item 6) and a pending async action entangles the whole app.

So the Root keeps the gesture's value in the urgent lane and derives what to show:

```ts
const held = gesture !== null || stepPending || commitPending;
const shown: readonly number[] = held && live !== null ? live : toArray(optimistic);
```

- `live` is written synchronously in the event by every step (2.4), like Combobox's active
  option: it is the position under the pointer, which is immediate everywhere else in the
  library (focus, typed text). It is never a transition and never dispatches by itself.
- While a pointer is captured, or any step or commit is in flight, the thumbs, `--slider-*`,
  `aria-valuetext`, `Slider.Value` and every `state.value` render `live`. The moment nothing is
  pending they render the optimistic value, which by then equals the committed one (success:
  `committed === next` in the same commit as `pending` leaving; rejection: the value before the
  gesture). No effect clears `live`; it is simply ignored, and the next step overwrites it.
- React's end-of-event restore of a controlled input (`restoreControlledInputState`) writes the
  current prop back into the DOM; the prop is `shown`, rendered in the sync flush of the same
  event, so the DOM, the attributes and the accessibility tree agree in every phase.

This is **not** the urgent lane of conventions 2.6 (`UrgentChangeAction`): no consumer-facing
action is urgent, and a controlled `value` still gates committed state. It is the library's
third urgent state after Combobox's text and active option, used, as the rule says, only where
React's timing requires it.

### 2.3 Uncontrolled state is committed per gesture

`useControllableAction`'s `action` is `valueCommitAction`, so the uncontrolled write happens when
the gesture's commit resolves, not per step. Consequences, documented on the component page:

- A rejected `valueCommitAction` (a failed save) rolls the thumb back to the value before the
  gesture in uncontrolled mode; a controlled parent gets the same by adopting on success only.
- `valueChangeAction` resolving changes no library state; it is the preview channel.
- Overlapping gestures (a new drag while a save is pending) follow latest intent: the last
  commit's value is what lands; the earlier save's result is ignored, its rejection surfaced.

### 2.4 Step, commit, and the "dismiss" revert

The Root has two internal entry points; every path (pointer, keyboard, platform) uses them:

```ts
// Inside Slider.Root. `values` are always arrays internally; `fromArray` restores the prop shape.
function step(next: readonly number[], thumb: number | null, reason: ChangeReason, event: Event | undefined): boolean {
  if (equal(next, shownRef.current)) return false;                 // no-op against what is shown
  liveRef.current = next; shownRef.current = next;                 // a commit in the same event reads these
  setLive(next);                                                   // urgent
  setPendingThumb(thumb);
  runStep(() => {                                                  // useActionTrigger: own transition
    addTransitionType("fsui-slider"); addTransitionType("fsui-slider-change");
    return valueChangeAction?.(fromArray(next), createActionDetails(event, { reason, thumb }));
  });
  return true;
}

function commit(thumb: number | null, reason: ChangeReason, event: Event | undefined): void {
  const next = liveRef.current;                                    // the gesture's last step
  if (next === null || equal(next, gestureStart.current)) return;  // nothing changed since the gesture began
  gestureStart.current = next;                                     // a trailing native `change` must not re-commit
  setPendingThumb(thumb);
  dispatch(fromArray(next), createActionDetails(event, { reason, thumb }));  // useControllableAction
}
```

The commit's wrapped action, as Combobox wraps its value action:

```ts
async (next, details) => {
  const id = ++commitId.current;
  try {
    await valueCommitAction?.(next, details);
  } catch (error) {
    if (!isControlled && id === commitId.current) {
      await undefined;                                             // leave the transition (conventions 2.6)
      step(toArray(committedRef.current), null, "dismiss", undefined);   // tell the preview channel
    }
    throw error;
  }
}
```

The `"dismiss"` step exists so that a `valueChangeAction` consumer whose preview followed the
drag follows the rollback too (the Combobox text-revert precedent). It is dispatched in
uncontrolled mode only, for the latest commit only: a controlled parent owns its state and wrote
it itself; a superseded commit's rejection is surfaced by the hook and a newer gesture is in
flight. `details.event` is `undefined` and `details.thumb` is `null`.

---

## 3. Props and types

Shared types from `packages/ui/src/internal/types.ts` (conventions 2.2, 9.4).

### 3.1 `Slider.Root`

```ts
export type SliderValue = number | readonly number[];
export type SliderOrientation = "horizontal" | "vertical";

export interface SliderValueChangeDetails extends ActionDetails {
  /**
   * "activate": the user moved a thumb (`details.event` is the native `input` event for a key
   * press, the `pointerdown` / `pointermove` for a drag, the `keydown` for a JS-normalised key).
   * "platform": a form reset (the `reset` event) or a value found in the inputs at mount
   * (`undefined`).
   * "dismiss": the commit action rejected and the slider reverted to the committed value
   * (uncontrolled mode; `undefined`).
   */
  readonly reason: ChangeReason;
  /** Index of the thumb that moved; `null` on a platform path or a revert, where several may change. */
  readonly thumb: number | null;
}

export interface SliderValueCommitDetails extends ActionDetails {
  /**
   * "activate": a gesture ended (`details.event` is the native `change` event for a key press,
   * the `pointerup` / `pointercancel` / `lostpointercapture` for a drag, the `keydown` for a
   * JS-normalised key). "platform": a form reset (the `reset` event) or mount reconciliation
   * (`undefined`). Never "dismiss".
   */
  readonly reason: ChangeReason;
  readonly thumb: number | null;
}

export interface SliderRootState<T extends SliderValue = number> {
  /** The value the thumbs show (section 2.2): `live` during a gesture, else optimistic. Content rendered from it must not suspend. */
  readonly value: T;
  /** `value` as an array, one entry per thumb, in thumb order. */
  readonly values: readonly number[];
  /** A step or commit dispatched through this Slider is in flight. */
  readonly pending: boolean;
  /** A pointer is captured on a thumb. */
  readonly dragging: boolean;
  readonly orientation: SliderOrientation;
  readonly disabled: boolean;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface SliderRootProps<T extends SliderValue = number>
  extends Omit<ComponentPropsWithRef<"div">, "defaultValue" | "role" | "className" | "style" | "children"> {
  /** Controlled value: one number, or one per thumb in ascending order. `undefined`: uncontrolled. */
  value?: T;
  /** Initial value in uncontrolled mode; also the form-reset target (latest value). Default: the platform's midpoint, `min + (max - min) / 2`, snapped to `step`. */
  defaultValue?: T;
  /**
   * Runs inside the Root's step transition on every step: each pointer move, each key press,
   * each platform change, and the revert after a rejected commit (`reason: "dismiss"`,
   * uncontrolled). Awaited; `data-pending` meanwhile. Adopt the value here in a controlled
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

  /** Default `0`. */
  min?: number;
  /** Default `100`. A `max` that is not on the step grid from `min` is unreachable, as on a native range (dev warning). */
  max?: number;
  /** Default `1`. Must be positive. Values snap to `min + n × step`. */
  step?: number;
  /** Minimum number of steps between two adjacent thumbs. Default `0` (thumbs may share a value). */
  minStepsBetweenThumbs?: number;
  /** Default `"horizontal"`. Vertical sliders have `min` at the bottom. */
  orientation?: SliderOrientation;
  /**
   * `aria-valuetext` for a thumb, from the value it shows. Set it when the number alone is not
   * meaningful ("3 of 5 stars", "Tuesday"). Default: none (the number is announced).
   */
  getAriaValueText?: (value: number, index: number) => string;
  /** Form field name for every thumb's input (a Thumb's own `name` wins). With several thumbs, read with `FormData.getAll()`. */
  name?: string;
  /** The `form` attribute for every thumb's input (a Thumb's own `form` wins). */
  form?: string;
  /** Disables every input (native `disabled`; not submitted) and the pointer. Never set while pending. */
  disabled?: boolean;
  className?: StateValue<string | undefined, SliderRootState<T>>;
  style?: StateValue<CSSProperties | undefined, SliderRootState<T>>;
  children?: StateValue<ReactNode, SliderRootState<T>>;
  render?: RenderProp<ComponentPropsWithRef<"div">, SliderRootState<T>>;
}
```

`T` is inferred from `value` or `defaultValue` (`defaultValue={[20, 80]}` makes every action
receive `readonly number[]`); with neither it is `number`. The shape (number or array) is fixed
at mount; switching warns in development, as a controlled/uncontrolled switch does. Owned keys:
`role` (`"group"` with several thumbs, removed otherwise), `aria-labelledby` (the Label's id,
token-merged with the consumer's), `data-pending`, `data-dragging`, `data-orientation`,
`data-disabled`, the `--slider-*` custom properties (merged into `style`; the consumer's wins
per property). `aria-label` passes through (an alternative name for a group). There is no
`transition` prop (section 11), no `required` (a range is never invalid), no `inverted`, no
`largeStep` (section 13).

### 3.2 `Slider.Thumb`

```ts
export interface SliderThumbState {
  readonly index: number;
  /** The value this thumb shows (section 2.2). */
  readonly value: number;
  /** The Root is pending and this thumb is the one the latest step or commit moved. */
  readonly pending: boolean;
  /** A pointer is captured on this thumb. */
  readonly dragging: boolean;
  readonly orientation: SliderOrientation;
  readonly disabled: boolean;
}

export interface SliderThumbProps
  extends Omit<ComponentPropsWithRef<"span">, "onPointerDown" | "aria-label" | "aria-labelledby" | "aria-describedby" | "className" | "style" | "children"> {
  /** Which value this thumb edits. Default `0`. */
  index?: number;
  /** Form field name of this thumb's input; overrides the Root's `name`. */
  name?: string;
  /** The `form` attribute of this thumb's input; overrides the Root's. */
  form?: string;
  /** Forwarded to the input (the element with role `slider`), not the styled element. Required for every thumb of a multi-thumb slider unless `aria-labelledby` is given (dev warning). */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** The native `<input type="range">` inside the thumb. */
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
  className?: StateValue<string | undefined, SliderThumbState>;
  style?: StateValue<CSSProperties | undefined, SliderThumbState>;
  /** Rendered inside the styled element, next to the input (an icon, a value bubble). */
  children?: StateValue<ReactNode, SliderThumbState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, SliderThumbState>;
}
```

Owned keys on the styled element: `onPointerDown`, `data-index`, `data-orientation`,
`data-dragging`, `data-pending`, `data-disabled`, `--slider-value` and `touch-action` (in
`style`, consumer wins per property). The four `aria-*` / `autoFocus` props are stripped from
the styled element and placed on the input. The input's own attributes are all library-written
and not reachable through props: `id`, `type`, `name`, `form`, `min`, `max`, `step`, `value`,
`disabled`, `aria-valuetext`, inline style, `onChange`, the `change` and `keydown` listeners. A
`render` element never touches the input.

### 3.3 `Slider.Track`, `Slider.Indicator`, `Slider.Label`, `Slider.Value`

```ts
export interface SliderTrackState { readonly orientation: SliderOrientation; readonly dragging: boolean; readonly disabled: boolean; }
export interface SliderTrackProps
  extends Omit<ComponentPropsWithRef<"div">, "onPointerDown" | "className" | "style" | "children"> {
  className?: StateValue<string | undefined, SliderTrackState>;
  style?: StateValue<CSSProperties | undefined, SliderTrackState>;
  children?: StateValue<ReactNode, SliderTrackState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, SliderTrackState>;
}

export type SliderIndicatorState = SliderTrackState;
export interface SliderIndicatorProps
  extends Omit<ComponentPropsWithRef<"span">, "className" | "style" | "children"> { … }

export interface SliderLabelProps
  extends Omit<ComponentPropsWithRef<"label">, "htmlFor" | "id" | "className" | "style" | "children"> {
  className?: StateValue<string | undefined, SliderRootState>;
  style?: StateValue<CSSProperties | undefined, SliderRootState>;
  children?: StateValue<ReactNode, SliderRootState>;
  render?: RenderProp<ComponentPropsWithRef<"label">, SliderRootState>;
}

export interface SliderValueState<T extends SliderValue = number> extends SliderRootState<T> {
  /** The `index` prop, or `null`. */
  readonly index: number | null;
}
export interface SliderValueProps<T extends SliderValue = number>
  extends Omit<ComponentPropsWithRef<"span">, "className" | "style" | "children"> {
  /** Show one thumb's value. Without it a single-thumb slider shows its value; a multi-thumb slider needs `children` (dev warning otherwise, renders nothing). */
  index?: number;
  className?: StateValue<string | undefined, SliderValueState<T>>;
  style?: StateValue<CSSProperties | undefined, SliderValueState<T>>;
  children?: StateValue<ReactNode, SliderValueState<T>>;
  render?: RenderProp<ComponentPropsWithRef<"span">, SliderValueState<T>>;
}
```

`Track` owned keys: `onPointerDown`, `data-orientation`, `data-disabled`, `touch-action`.
`Indicator`: `data-orientation`, `data-disabled` (and nothing else: no inline position).
`Label`: `id`, `htmlFor`. `Value`: none; its default content is `String(value)` for the thumb it
shows, with no separator string for several values (conventions 11: no visible built-in text).

### 3.4 Namespace

```ts
export const Slider = {
  Root: SliderRoot, Label: SliderLabel, Track: SliderTrack, Indicator: SliderIndicator, Thumb: SliderThumb, Value: SliderValue,
} as const;
```

Exports: every `Slider<Part>Props` / `State` above, `SliderValue`, `SliderOrientation`,
`SliderValueChangeDetails`, `SliderValueCommitDetails`.

---

## 4. The gesture: pointer, keyboard, platform

Every path is "steps, then a commit" through the two entry points of 2.4. The gesture-start
value (`gestureStart`) is the shown value when the gesture begins; the commit dispatches only
when the last step differs from it.

### 4.1 Pointer

| Event | Where | Behaviour |
| --- | --- | --- |
| `pointerdown` (primary button, not `disabled`) | Thumb | `preventDefault()` (no text selection, no focus change through the compat `mousedown`); `setPointerCapture` on the Thumb; `gesture = { thumb: index }`; `gestureStart` = shown; the input is focused (`:focus-visible` does not match after a pointer press, so no ring appears, as on a native range); `step` with the value under the pointer if it differs. `pointermove`, `pointerup`, `pointercancel` and `lostpointercapture` listeners are attached to the captured element for the gesture's duration (`addEventListener`, removed at its end). |
| `pointerdown` | Track (no gesture already begun for this pointer) | Same, with the **nearest thumb** by value distance to the pointer's value; on a tie (two thumbs at one value) the thumb that can move toward the pointer. Capture on the Track. |
| `pointermove` (the captured `pointerId` only) | captured element | `step(thumb, valueFromPointer)`. |
| `pointerup`, `pointercancel`, `lostpointercapture` | captured element | `gesture = null`; `commit(thumb, "activate", event)`; listeners removed. A cancelled gesture commits where it stopped (the user's last intent; leaving the value uncommitted would strand the preview). |

Value from the pointer: the Track's `getBoundingClientRect()` at the step; horizontal
`fraction = (clientX - left) / width`, mirrored (`1 - fraction`) when the Track's computed
`direction` is `rtl` (read once at `pointerdown`); vertical `fraction = (bottom - clientY) /
height` (`min` is always at the bottom). Then `min + fraction × (max - min)`, snapped and clamped
(section 5). Inline `touch-action: pan-y` (horizontal) or `pan-x` (vertical) on the Track and
Thumb keeps page scrolling along the other axis.

The hidden input never receives the pointer (`pointer-events: none`), so no native `input` or
`change` fires for a pointer gesture and the library fires none itself (product-owner item 8):
`details.event` is the `PointerEvent`, and a `<form onChange>` listener sees keyboard changes
only. Radix's `BubbleInput` alternative needs the `HTMLInputElement.prototype.value` setter trick
to get past React's value tracker and would re-enter React's event dispatch from inside
`pointermove`; recorded in section 13 as a possible follow-up.

### 4.2 Keyboard

The native input handles every key (section 7). What arrives:

| Native event | Library |
| --- | --- |
| `input` (React `onChange` on the input) | `step(index, Number(input.value), "activate", nativeEvent)`; `gestureStart` = the shown value before this press if no gesture is open (a key press is a one-step gesture) |
| `change` (a native listener through the input's ref: React surfaces no `onChange` for it, research finding 2) | `commit(index, "activate", event)` |
| `keydown` ArrowLeft / ArrowRight while `orientation="vertical"` | `preventDefault()`; `step` to `value ∓ step` (Right increases, APG), then `commit`, both with the `keydown` (Firefox decreases on ArrowRight natively; Chromium increases; the normalisation makes both match the APG) |

Because `input` and `change` fire back to back in one task, the thumb renders the new value in
the `input` event's sync flush and the commit's optimistic render in the next microtask flush;
`shown` is the same number in both. Holding a key repeats the pair; each repeat is a gesture and
a commit dispatch; latest wins.

### 4.3 Platform paths

| Path | Trigger | What dispatches |
| --- | --- | --- |
| Mount reconciliation | the Root's mount layout effect reads every registered input's `value` (pre-hydration key presses; Firefox form-state restoration) | one `step` + `commit` with `reason: "platform"`, `thumb: null`, `event: undefined`, when the DOM values differ from the base (the shown value) |
| Late-mounting Thumb | a Thumb inside a Suspense boundary that hydrates after the Root reports its mount | the same, in a microtask, once per commit (`useNativeGroupReconciliation`'s `onItemMounted`) |
| Form reset | `reset` on the first registered input's form (section 9.2) | one `step` + `commit` with the `reset` event and the JS-computed reset target |

Platform dispatches are not blocked by `disabled` (conventions 2.3 item 7: the form's author
acted on the whole form).

### 4.4 No-op and overlap rules

- A step whose value equals the shown value dispatches nothing (conventions 2.3 item 8, judged
  against what the user sees). A press exactly on the current value, a key at `min` (the browser
  fires no `input`), a reset to the current value: nothing.
- A gesture whose last step equals its start value dispatches no commit (a drag out and back).
  The steps it dispatched remain; the preview saw them.
- A new gesture while a commit is pending: `live` moves at once (urgent); its steps' transitions
  are entangled with the pending save (held until it settles; the thumb still follows); its
  commit supersedes the earlier one (latest wins); the earlier rejection is surfaced.
- A controlled parent that does not adopt steps sees the thumb follow the pointer anyway
  (`live`) and return to `value` when the gesture settles: a per-step veto is visible only at
  release. Clamping is done with `min` / `max` / `step`, not by refusing steps.

---

## 5. Value arithmetic

The library computes exactly what the platform's value sanitisation would, so the number it
renders is the number the DOM holds and `FormData` posts (research §1):

- `snap(v) = min + round((v - min) / step) × step`, rounded to the decimal places of `step` and
  `min` (so `0.1` steps never show `0.30000000000000004`); ties round toward `+∞` as the HTML
  step-mismatch algorithm does.
- Clamp to `[min, max]`; if the snapped value exceeds `max`, the last grid point below `max`.
  Hence `min 0, max 5, step 2` caps at `4`, as a native range does. Development warns when
  `(max - min)` is not a multiple of `step` ("`max` is unreachable").
- Thumb `i` is additionally clamped to `[values[i-1] + gap, values[i+1] - gap]` with
  `gap = minStepsBetweenThumbs × step`; the same bounds are rendered as the input's native
  `min` / `max`, so native Home / End / PageUp / PageDown and clamping, and the accessibility
  tree's `valuemin` / `valuemax`, respect the neighbours (research §5; the neighbours are on the
  grid because every thumb shares `step` and the original `min`).
- A consumer `value` / `defaultValue` off the grid or outside the bounds is **not** rewritten
  (a controlled prop is the parent's): it is rendered as given, the DOM sanitises it, and
  development warns once. The first user step snaps it.
- Default value with neither prop: `snap(min + (max - min) / 2)` (the platform's default;
  product-owner item 6); with `max < min`, `min`.
- Array values must be ascending; development warns otherwise (the thumbs would be rendered
  crossed and the neighbour bounds inverted).

---

## 6. Pending, data attributes, CSS

### 6.1 Attributes

| Attribute | Root | Track | Indicator | Thumb | Meaning |
| --- | --- | --- | --- | --- | --- |
| `data-pending` | while any step or commit is in flight | | | while the Root is pending and this thumb is `pendingThumb` | conventions 4.3: owner and the trigger the user acted on |
| `data-dragging` | while a pointer is captured | | | on the captured thumb | urgent; keyboard never sets it |
| `data-orientation` | `horizontal` / `vertical` | same | same | same | |
| `data-disabled` | | | | | the Root's `disabled` |
| `data-index` | | | | `0`, `1`, … | style the min and max thumbs differently |

Platform pseudo-classes next to them: `:disabled` on the input; focus on the thumb through
`:has(:focus-visible)` (the input is the focused element); `:active` is not meaningful (the
pointer is captured on the Thumb or Track; use `[data-dragging]`).

### 6.2 Geometry through custom properties

The library never positions a thumb; it publishes percentages and the consumer's CSS places
things. Rendered from the shown value, so they follow the pointer, the save and the rollback:

| Property | On | Value |
| --- | --- | --- |
| `--slider-value` | Thumb | this thumb's position, `0%` to `100%` |
| `--slider-value-<i>` | Root (inherited) | each thumb's position, for custom parts |
| `--slider-start`, `--slider-end` | Root (inherited) | the fill's extent: `0%` to the value for one thumb; the first to the last value for several |

```css
.track { position: relative; block-size: 4px; background: var(--rail); border-radius: 2px; }
.track[data-orientation="vertical"] { block-size: 160px; inline-size: 4px; }

.fill { position: absolute; inset-block: 0; inset-inline-start: var(--slider-start); inset-inline-end: calc(100% - var(--slider-end)); background: var(--accent); }
[data-orientation="vertical"] .fill { inset-inline: 0; inset-block-end: var(--slider-start); inset-block-start: calc(100% - var(--slider-end)); }

.thumb { position: absolute; inline-size: 20px; block-size: 20px; border-radius: 50%; background: white; box-shadow: var(--ring);
         inset-block-start: 50%; inset-inline-start: var(--slider-value); translate: -50% -50%; }
[dir="rtl"] .thumb { translate: 50% -50%; }                 /* logical insets flip; the centring offset does not */
[data-orientation="vertical"] .thumb { inset-inline-start: 50%; inset-block-end: var(--slider-value); inset-block-start: auto; translate: -50% 50%; }
.thumb:has(:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }
.thumb[data-dragging] { scale: 1.15; }
.thumb[data-pending]::after { content: ""; /* spinner */ }
[data-disabled] .thumb { opacity: .5; }

/* Animate keyboard steps and rollbacks; never the pointer. */
@property --slider-value { syntax: "<percentage>"; inherits: false; initial-value: 0%; }
@property --slider-start { syntax: "<percentage>"; inherits: true; initial-value: 0%; }
@property --slider-end   { syntax: "<percentage>"; inherits: true; initial-value: 0%; }
.thumb { transition: --slider-value 120ms ease-out; }
.fill  { transition: --slider-start 120ms ease-out, --slider-end 120ms ease-out; }
[data-dragging] .thumb, [data-dragging] .fill { transition: none; }
@media (prefers-reduced-motion: reduce) { .thumb, .fill { transition: none; } }
```

Logical insets make the same CSS work under `dir="rtl"` (percentages count from the inline
start) and the pointer math mirrors to match (4.1). The `@property` registrations are the
consumer's: the library ships no CSS.

### 6.3 Styling the native control instead

A consumer who wants the browser's own thumb can skip `Track` / `Indicator` / `Thumb` styling
and instead un-hide the input through `inputRef` and vendor pseudo-elements; the research (§2)
records why that is a recipe and not the anatomy (no standard pseudo-elements in any engine,
rules written twice, Gecko-only fill). Not documented as a supported mode in v1.

---

## 7. Keyboard, orientation, direction

APG Slider / Slider (Multi-Thumb). Every row is native unless marked; the probe table in the
research (§1) is the source.

| Key | Horizontal LTR | Horizontal RTL (inherited `direction: rtl`) | Vertical | By |
| --- | --- | --- | --- | --- |
| ArrowRight | + step | − step (mirrored) | + step | native; **vertical: JS** (Firefox decreases natively) |
| ArrowLeft | − step | + step (mirrored) | − step | native; **vertical: JS** |
| ArrowUp | + step | + step | + step | native (`writing-mode: vertical-lr; direction: rtl` on the input puts `min` at the bottom in both engines) |
| ArrowDown | − step | − step | − step | native |
| PageUp / PageDown | ± 10 % of the range (step-aligned) | same | same | native |
| Home / End | the thumb's `min` / `max` (its neighbour in a multi-thumb slider) | same | same | native, through the neighbour bounds |
| Tab / Shift+Tab | between thumbs (each input is a tab stop) | | | native |
| Shift+Arrow | not handled (section 13) | | | |

Each key press fires native `input` then `change`: one step and one commit (4.2).

**Orientation.** `orientation="vertical"` renders `writing-mode: vertical-lr; direction: rtl`
inline on every hidden input, so the accessibility tree reports `vertical` (Chromium derives it
from `writing-mode` and ignores `aria-orientation`, research §3; `aria-orientation` is not set),
the pointer axis is the Track's block axis, and the custom properties count from the bottom.

**Direction.** A horizontal slider inherits the page's or container's `direction`: the browser
mirrors the arrow keys, the Track's computed `direction` mirrors the pointer math, and logical
insets mirror the CSS. Nothing is read from `document.dir`; a `dir="rtl"` container works. The
vertical input's forced `direction: rtl` is independent of the page direction.

---

## 8. ARIA

| Element | Attributes |
| --- | --- |
| Root (several thumbs) | `role="group"`, `aria-labelledby` → Label id while a Label is mounted (consumer tokens merged), or the consumer's `aria-label`; dev warning with neither |
| Root (one thumb) | no role; the Label's `for` names the input |
| Thumb input | implicit `slider`; `id`; `min` / `max` (neighbour-adjusted), `step`, `value`; `aria-valuetext` from `getAriaValueText(shownValue, index)` when given; `aria-label` / `aria-labelledby` / `aria-describedby` from the Thumb's props; `disabled`; `name`, `form`; the vertical writing mode. **Never** `aria-valuemin` / `aria-valuemax` / `aria-valuenow` (ARIA in HTML: SHOULD NOT; Chromium lets them override the native values, research §3) and never `aria-orientation` |
| Thumb (styled element), Track, Indicator, Value | no role (a `span` / `div` with data attributes); the input inside the Thumb is the accessible node |
| Label | `label[for]` (one thumb) or `label[id]` (several) |

Name requirements: a single-thumb slider is named by `Slider.Label`, or by `aria-label` /
`aria-labelledby` on its Thumb; each thumb of a multi-thumb slider needs its own `aria-label` /
`aria-labelledby` and the group needs the Label (or `aria-label` on Root). Development warns for
a thumb or group with no accessible name.

Screen-reader pass before leaving "proposed": NVDA, JAWS and VoiceOver announce the value (and
`aria-valuetext`), the bounds, the orientation, and the neighbour-limited range of a multi-thumb
slider; a vertical slider is announced as vertical in WebKit (unverified; the research probed
Chromium only).

---

## 9. Forms

### 9.1 Participation

- Each Thumb's input carries `name` (its own, else the Root's) and `form`. One thumb posts
  `volume=73`; two thumbs with one Root `name` post `price=100&price=300`
  (`FormData.getAll("price")`); with per-Thumb names they post `price-min=100&price-max=300`.
  The `<rangegroup>` explainer submits per-input pairs the same way (research §5), so a future
  native rendering keeps the posted shape.
- A range always has a value; nothing is `required` and `validity.valid` is always `true`.
- `disabled` on Root disables every input: not submitted, not focusable. Never disabled while
  pending (conventions 3.6).
- `<form action>` and `useFormStatus` are the form channel (conventions 2.7): a Slider with no
  actions inside a `<form action={serverFn}>` posts its value with the form. "Submit on
  release" is `valueCommitAction={() => formRef.current?.requestSubmit()}`.

### 9.2 Reset (the controlled-value-input path)

`form.reset()` restores an input to its `value` attribute, and react-dom keeps a controlled
input's `value` attribute equal to its current value after every update, so a reset is a no-op
on a React-controlled range (research finding 3, `react-range-reset.mjs`). This differs from
checkboxes, whose `defaultChecked` is the mount-time value, and it is the same problem Combobox
solved for its text input (Combobox 11.1, conventions 3.8 rule 6). The Slider does the same:

1. `useFormReset` is subscribed on the first registered input's form owner (the Thumb inputs
   are form-associated; a Root has no `.form`). All thumbs are expected in one form (a Thumb
   with a different `form` attribute is a dev warning).
2. **In the `reset` event** (`onResetEvent`, synchronously, before the reset algorithm) the
   Root writes each input's `defaultValue` to its reset target: uncontrolled, the latest
   `defaultValue` prop (or the platform default); controlled, the Root's mount-time `value`.
   The algorithm then restores the DOM to those values the browser's way.
3. **In the microtask** (`onReset`, unless the `reset` was cancelled) the Root dispatches the
   JS-computed reset target, not a DOM read (a React render between the event and the microtask
   could have re-applied the shown value), as one `"platform"` step + commit with the `reset`
   event and `thumb: null`, when it differs from the base (the shown value). Uncontrolled: the
   commit resolves and the value is committed. Controlled: the reset is **offered** to the
   parent (conventions resolved question 17); after settle the DOM follows the parent's
   decision through react-dom's own `value` update.
4. React's automatic reset after a successful `<form action>` arrives the same way; the
   subscription is stable across commits (`useFormReset`).

### 9.3 Mount reconciliation

react-dom keeps a hydrated input's DOM value (`initInput`) and fires no `onChange`, so a key
press before hydration, a pre-hydration `form.reset()`, or Firefox's form-state restoration
leaves DOM ≠ state. The Root's mount layout effect reads every registered input's `value`,
compares with the shown value, and dispatches one `"platform"` step + commit with
`event: undefined` (4.3). Thumbs that mount later (a Suspense boundary hydrating after the
Root) report through `onItemMounted` and are reconciled in a microtask, once per commit. A
controlled parent that refuses sees react-dom re-apply its value to the inputs.

No per-commit re-apply effect is needed for `value` (react-dom's `updateInput` rewrites it on
every render of the input), unlike `checked` / `indeterminate` in `useNativeChecked`; the only
DOM write the library makes outside render is the reset mirror of 9.2.

---

## 10. Server rendering and before hydration

Every part file is `"use client"` (context, hooks, DOM listeners); Server Components render every
part and may pass Server Functions to both actions (`valueCommitAction` is the sensible one).
Server HTML contains the whole anatomy with the inputs' `value`, `min`, `max`, `step`, `name`,
`aria-valuetext` and the custom properties computed from the initial value; every attribute is a
pure function of props, so hydration matches.

Before hydration: Tab reaches the inputs and arrow keys change their native values (the visible
thumb does not move, because `--slider-value` is rendered by React); a form submitted then posts
the native value; the pointer does nothing (the input is `pointer-events: none` and the Track
has no behaviour yet). At mount the reconciliation of 9.3 adopts the pre-hydration value with
`"platform"` and the visuals catch up. Progressive enhancement, not a JS-free mode, as Menu and
Combobox (conventions 7.3).

The JS-free form slider is a plain `<input type="range">` rendered by a Server Component
(research §4, structure 2, and §7 item 8); it is not a part of this anatomy and is tracked with
the directive-free variants in issue #19.

---

## 11. ViewTransition

No part has a `transition` prop and none renders a `<ViewTransition>` (the Select precedent in
conventions 5.1): nothing in the anatomy mounts, unmounts or changes content from committed
library state; the thumb position is urgent (`live`) or optimistic, and an optimistic flip
never gets a view transition. The end of a save shows nothing but `data-pending` leaving, and a
rollback moves the thumb through the same custom property the pointer drives, which the CSS of
6.2 animates with a registered `@property` transition (off while dragging).

Transition types are still attached, for a consumer's own boundary around content keyed on the
value: every step adds `fsui-slider` and `fsui-slider-change`; every commit adds `fsui-slider`
and `fsui-slider-commit`. A rollback carries none (conventions 5.3).

---

## 12. Async walkthroughs

Notation: `L` = `live`, `O` = optimistic, `C` = committed, `S` = shown (2.2), `P` = Root pending,
`G` = gesture. One thumb, `min 0`, `max 100`, `step 1`.

1. **Uncontrolled, `valueCommitAction={save}` (800 ms), drag 40 → 70.** `pointerdown` on the
   track at 55: prevented, captured, input focused, `G={thumb:0}`, `gestureStart=[40]`,
   `step([55])`: `L=[55]`, `S=[55]` in the same event, `valueChangeAction` absent, step
   transition resolves at once. Moves: `L=[60]`, `[66]`, `[70]`, each a step. `pointerup`:
   `G=null`, `commit`: `dispatch([70])` → `O=[70]`, `P=true`, `data-pending` on Root and Thumb
   0; `await save(70)`. `S=[70]` throughout (`L` while pending, then `O`). Resolves: `C=[70]`,
   `P=false`, `S=O=[70]`; the thumb never moved after release.
2. **Same, the save rejects.** The error reaches the boundary above `Slider.Root`; `O` reverts
   to `[40]`; `P=false`; `S=[40]`: the thumb slides back (CSS transition). The Root dispatched
   one `valueChangeAction([40], { reason: "dismiss" })` first (none here). `C` was never
   written.
3. **Controlled live filter, `value={price}` `valueChangeAction={(v) => setPrice(v)}`, the
   list under it suspends for 300 ms per value.** Each move: `L` follows at once;
   `setPrice(v)` is a transition update held while the list loads (the old list stays, Root
   and Thumb `data-pending`); a later move supersedes the render for the earlier price. Release:
   `commit` → `dispatch([70])`, no commit action, resolves at once; `S=L=[70]` while
   `stepPending` is still true; when the list for 70 commits, `isPending` of the step
   transition leaves in the same commit as `price=70`, so `S=O=C=[70]` with no snap.
4. **Controlled "update on success", no `valueChangeAction`:** `value={v}`
   `valueCommitAction={async (n) => { await save(n); startTransition(() => setV(n)); }}`. Drag:
   `L` moves, `C` stays; release: `O=[70]`, `P=true`; success: `C=[70]`; failure: `O` reverts,
   thumb returns to `[40]`, error to the boundary, no `"dismiss"` step (controlled).
5. **Keyboard, ArrowRight with the 800 ms save.** Native `input` → `onChange`: `step([41])`,
   `L=[41]`, `S=[41]` in the sync flush; native `change` → `commit`: `O=[41]`, `P=true`.
   Second press before it settles: the input reads 41 → 42 → `step` + `commit([42])`: latest
   wins; `data-pending` stays; both saves run; the first's result is ignored (its rejection
   surfaced); settle: `C=[42]`.
6. **Drag while a save is pending.** As 1 before `save` resolves, press and drag to 80: `L`
   moves at once (urgent); the step transitions are entangled with the save (held until it
   settles; nothing visible since `valueChangeAction` is absent); release: `commit([80])`
   supersedes; `save(70)`'s resolution does not write `C`; `save(80)` does.
7. **Two thumbs, press between them.** `[100, 300]`, press at 180: nearest is thumb 0
   (distance 80 vs 120) → `step([180, 300])`; drag past 300: thumb 0 clamps to `[290, 300]`
   (`minStepsBetweenThumbs=1`, step 10); the input's native `max` reads `290`, so End on thumb
   0 stops there too.
8. **Form reset.** `<form>` with `name="volume"`, uncontrolled `defaultValue={40}`, `C=[70]`.
   `form.reset()`: in the `reset` event the Root writes `input.defaultValue = "40"`; the
   algorithm sets the DOM to 40; the microtask dispatches `step([40], "platform")` and
   `commit`: `O=[40]`, `P` briefly, `C=[40]`. Controlled with a parent that ignores the reset:
   `O` reverts on settle and react-dom writes the parent's value back into the input. React's
   automatic reset after a `<form action>` arrives the same way.
9. **Pressed before hydration.** Server HTML with `value="40"`; the user tabs to the input and
   presses End (DOM `100`); hydration keeps it; the Root's mount effect reads `[100] ≠ [40]` →
   `step` + `commit([100], { reason: "platform", event: undefined })`; `S=[100]`; `C=[100]`
   on resolve. The `--slider-value` catches up in that sync render.
10. **A drag that returns.** 40 → 60 → 40 and release: three steps dispatched (60, 50, 40), no
    commit (the last step equals `gestureStart`), `G=null`, `S=O=[40]`.
11. **Vertical, ArrowRight in Firefox.** `keydown` ArrowRight on the input: prevented;
    `step([41])` + `commit([41])` with the `keydown` as `details.event`; no native `input` /
    `change` fire. ArrowUp: native, 41 → 42.

---

## 13. Not in v1

- **`largeStep` and Shift+Arrow** (Base UI): PageUp / PageDown are native and cover the APG's
  "larger than the step"; a JS Shift binding is a small addition when asked for.
- **`step="any"`**: the native arrow increment for `any` is engine-defined; design when a
  continuous slider is requested.
- **`list` / `<datalist>` ticks and a `Slider.Tick` part**: the hidden input shows no ticks;
  tick marks are consumer markup from `--slider-value-<i>`-style math until a part is designed.
- **Per-thumb `disabled`**, **`inverted`**, **`thumbAlignment`** (Base UI) and a built-in
  value tooltip: no consumer case yet.
- **Synthetic `input` / `change` on the hidden input for pointer gestures** (Radix's
  `BubbleInput`): a follow-up if form-level listeners turn out to matter (product-owner item 8).
- **`<rangegroup>`** (Open UI, Chromium Intent to Prototype) and **`appearance: base` with
  `::slider-*`** (CSS Forms 1, Chromium flag only): both could replace the hidden inputs or the
  styled parts without changing the state API; revisit at Intent to Ship (research §7 item 9).
- **A directive-free JS-free slider** (a Server Component rendering `<input type="range">`):
  issue #19.

---

## 14. Test plan

`packages/ui/src/slider/slider.test.tsx` (jsdom) and `slider.browser.test.tsx` (Chromium,
Firefox, WebKit). "both" = `describe.each` over uncontrolled and the two controlled wrappers
(adopt steps; update on commit success). jsdom has no range key stepping and no layout: keyboard
rows set the input's value through the native `HTMLInputElement.prototype.value` setter and fire
`input` then `change` (the researcher's probe shape, `react-range.mjs`), pointer rows mock the
Track's `getBoundingClientRect` and polyfill `setPointerCapture` / `releasePointerCapture` /
`hasPointerCapture` if `vitest.setup.ts` lacks them; real keys and real pointers are browser rows.

### 14.1 jsdom

| Area | Tests |
| --- | --- |
| Roles and ARIA | The section 1 HTML: one `input[type=range]` per Thumb with `id`, `min` / `max` / `step` / `value` / `name` / `form`; `aria-label` lands on the input and not on the span; `aria-valuetext` from `getAriaValueText`; no `aria-valuemin` / `-max` / `-now` / `aria-orientation` ever (also through `render` or props); Root `role="group"` and `aria-labelledby` = Label id only with several thumbs, consumer tokens merged, absent with one thumb where `label[for]` = input id; Label registration (no `aria-labelledby` without a Label); dev warnings: unnamed thumb in a multi-thumb slider, duplicate / out-of-range `index`, off-grid value, unreachable `max`, descending array. |
| Value arithmetic | `snap` / clamp cases of section 5 including `0.1` steps, `max 5 step 2 → 4`, ties toward `+∞`; neighbour clamping with `minStepsBetweenThumbs`; the inputs' native `min` / `max` follow the neighbours' shown values; default value is the platform midpoint. |
| Steps (both) | A simulated `input` event calls `valueChangeAction(next, { reason: "activate", thumb })` once with the native event, inside a transition (a `useTransition` probe in the parent reports pending only through the library's `data-pending`, never urgently); the DOM `value`, `--slider-value`, `aria-valuetext` and `Slider.Value` update in the same event; a value equal to the shown one dispatches nothing. |
| Commit (both) | `change` after `input` calls `valueCommitAction(next, { reason: "activate", thumb })` with the `change` event; `change` without a value change (a trailing native `change`) dispatches nothing; a pointer gesture ending at its start value dispatches steps and no commit. |
| Pointer | With a mocked Track rect: `pointerdown` on the Track is prevented, captures, focuses the nearest thumb's input, dispatches the step; moves dispatch steps for the captured `pointerId` only; a second pointer is ignored; `pointerup`, `pointercancel` and `lostpointercapture` each commit; RTL (`direction: rtl` on the Track's computed style) mirrors; vertical uses the block axis; a `pointerdown` on a Thumb outside the Track works; `disabled` ignores the pointer; `data-dragging` on Root and the captured Thumb, gone at release. |
| Async commit (both) | Deferred `valueCommitAction`: `data-pending` on Root and the moved Thumb, the thumb's DOM value and `--slider-value` hold the gesture value, uncontrolled committed state unchanged (a `children` probe) until resolve; then committed. |
| Rejection (both) | The catcher above Root receives it; the thumb's DOM value returns to the pre-gesture value; uncontrolled: `valueChangeAction(prev, { reason: "dismiss", thumb: null, event: undefined })` dispatched once, outside the transition (the `await undefined` yield); controlled: no `"dismiss"` step. Caught-inside variants commit. |
| No snap | Uncontrolled with a sync `valueChangeAction`: between two simulated moves (after the first step's transition has settled) the input still shows the first step's value. Controlled adopt-steps parent whose dependent content suspends: after release the input shows the gesture value until the content resolves, then the parent's value, never the pre-gesture value in between (guards the `held` derivation of 2.2). Controlled parent that does not adopt steps: the thumb follows during the drag and returns to `value` after release. |
| Overlap, superseded rejection (both) | Two key presses with a slow commit: `data-pending` stays, final committed is the latest; the older commit's rejection reaches the catcher after and while the newer is pending; a drag while a commit is pending supersedes it. |
| Suspending content (both) | A controlled adopt-steps parent's content keyed on the value suspends: old content stays, no fallback above the component, `data-pending` on Root and Thumb; then new content. |
| Platform path (both) | Mount reconciliation: `renderToString`, set the input's value before `hydrateRoot` → one `step` + `commit` with `reason: "platform"`, `thumb: null`, `event: undefined`, StrictMode still one, none when equal; late Thumb through `onItemMounted`. Form reset: `form.reset()`, `<button type="reset">`, automatic reset after a successful `<form action>` → `defaultValue` attributes equal the reset target at the time of the `reset` event (uncontrolled: latest `defaultValue`; controlled: mount-time), one `step` + `commit` with the `reset` event, a cancelled `reset` dispatches nothing, a refusing controlled parent gets the DOM re-synced after settle; `disabled` still follows a reset. |
| Forms | `FormData` has one entry per thumb under the Thumb's or Root's `name`; `disabled` omits them; `form` attribute honoured. |
| Keyboard normalisation | Vertical: a `keydown` ArrowRight / ArrowLeft is prevented and dispatches step + commit with the `keydown`; horizontal: not prevented, nothing dispatched by the library for `keydown`. |
| Function props / `render` | Every part's documented state; `Slider.Value` default text, `index`, and the multi-thumb-without-children warning; Thumb `render={<div />}` keeps the input inside and the handlers; `inputRef` reaches the input; `className` / `style` merge; the `--slider-*` and `touch-action` entries lose to the consumer's `style` per property. |
| Post-await rule | A controlled parent updating after its own `await` inside `startTransition` in `valueCommitAction`. |
| Directive | Every file under `src/slider/` except `index.ts` begins with `"use client"`. |
| Types | `T` inferred as `readonly number[]` from an array `defaultValue` and as `number` from none; `transition`, `required`, `aria-valuenow` are not props (type test). |

### 14.2 Browser mode (`slider.browser.test.tsx`)

| Row | Assertion | Engine branches |
| --- | --- | --- |
| Real keys | ArrowRight / ArrowLeft / ArrowUp / ArrowDown / PageUp / PageDown / Home / End on a focused thumb change the value as the section 7 table says, each pressing `valueChangeAction` once and `valueCommitAction` once; under `dir="rtl"` on a container Left / Right mirror; Home / End on a multi-thumb slider stop at the neighbour. | none |
| Vertical keys | Up increases, Down decreases in all engines; ArrowRight increases in **every** engine (Firefox would decrease natively: the JS normalisation row). | none; the assertion is the same everywhere |
| Real drag | A real pointer press on the track moves the nearest thumb and focuses its input (`document.activeElement`), the thumb element follows the pointer (its `getBoundingClientRect` centre tracks `clientX` within one step), `pointerup` commits once; no text selection was started; `:focus-visible` does not match the input after a pointer press. Touch (Chromium touch emulation): `touch-action` keeps vertical page scroll on a horizontal slider. | WebKit: `:focus-visible` after a programmatic focus is asserted loosely (documented) |
| Hidden input | The input has a box equal to the thumb's, `opacity: 0`, and `elementFromPoint` at the thumb's centre is the styled element (pointer-events none). | none |
| Accessibility tree (Chromium) | CDP: role `slider`, `valuemin` / `valuemax` follow the neighbours, `orientation: vertical` for a vertical slider, `valuetext` not overridden, `aria-valuetext` present as an attribute. | `browserName === "chromium"`; others assert the attributes only |
| Pre-hydration key | `renderToString` into an `iframe srcdoc`, press End before `hydrateRoot`: the value survives hydration, one `"platform"` step + commit, the thumb's `--slider-value` catches up. | WebKit may use the keyboard fallback (Combobox L4 rule) |
| Firefox restoration | Reload a page with a changed range value: Firefox restores it; mount reconciliation dispatches `"platform"`. | `browserName === "firefox"` only |
| Rollback animation | With the 6.2 CSS, a rejected commit transitions `--slider-value` (a `transitionstart` on the thumb); during a drag no transition runs (`[data-dragging]`). | none |
| No `startViewTransition` | Spy before a drag, a key press, a rejected commit: zero calls (no boundary exists). | none |

---

## 15. Implementation notes

```
packages/ui/src/slider/
  index.ts               # no directive; namespace + types; imports platform-attributes
  slider-context.ts      # "use client": SliderContext (shown values, bounds, step()/commit()/beginGesture(), registry, ids, state flags)
  slider-root.tsx        # "use client": useControllableAction (commit), useActionTrigger (steps), live/gesture/pendingThumb state, arithmetic, pointer gesture, registry, reconciliation, reset, custom properties
  slider-label.tsx       # "use client": registers its id; for= with one thumb
  slider-track.tsx       # "use client": onPointerDown → beginGesture(nearest), touch-action
  slider-indicator.tsx   # "use client"
  slider-thumb.tsx       # "use client": styled element + hidden input; onChange, native change + keydown listeners; registration; forwarded aria-*; inputRef
  slider-value.tsx       # "use client"
  slider-arithmetic.ts   # no directive: snap / clamp / neighbours / percent / decimal places (pure; unit-tested)
  slider.test.tsx, slider.browser.test.tsx
packages/ui/src/internal/
  use-native-group-reconciliation.ts   # widen `element` to FormAssociatedElement (an input) and add `onResetEvent` pass-through to useFormReset
```

- **Root.** `useControllableAction<T, SliderValueCommitDetails>({ controlled: value,
  defaultValue, initialValue: platformDefault(min, max, step), action: wrappedCommit,
  transitionTypes: () => ["fsui-slider", "fsui-slider-commit"], warn: { component: "Slider",
  prop: "value" } })`; `const { pending: stepPending, run: runStep } = useActionTrigger()`;
  `live`, `gesture`, `pendingThumb` as `useState`; `shown` derived as 2.2; `shownRef`,
  `liveRef`, `committedRef` through `useLatest` for handlers and the wrapped action;
  `gestureStart` and `commitId` refs. Values are arrays internally; `shape` (`"number"` |
  `"array"`) is captured at mount from `value ?? defaultValue`. The context value is memoised on
  `shown`, `pending`, `gesture`, `pendingThumb`, bounds and the stable functions (#48).
- **Arithmetic** in `slider-arithmetic.ts`: `snap(value, min, max, step)` with decimal rounding
  (`decimals = max(decimals(step), decimals(min))`), `clampToNeighbours(values, i, next, gap)`,
  `percent(value, min, max)`, `nearestThumb(values, target)`, `platformDefault(min, max,
  step)`.
- **Pointer gesture** (`beginGesture(index, event, element)` in Root): `event.preventDefault()`;
  `element.setPointerCapture(event.pointerId)`; read the Track's rect and computed `direction`;
  `setGesture({ thumb: index })`; `gestureStart.current = shownRef.current`; focus the input;
  `step` with the pointer value; attach `pointermove` / `pointerup` / `pointercancel` /
  `lostpointercapture` on `element` (filtering on `pointerId`), detached in the end handler,
  which sets `gesture` to `null` and calls `commit`. Thumb and Track `onPointerDown` call it;
  the Track's checks `button === 0`, `disabled`, and that no gesture is open.
- **Thumb.** Registers `{ index, input }` with the Root from a layout effect (and calls
  `onItemMounted`). Renders the styled element with the owned keys of 3.2 and, inside it,
  `<input type="range" value={shown[index]} min={lower} max={upper} step={step} …
  onChange={(e) => ctx.step(index, Number(e.target.value), "activate", e.nativeEvent)} />`
  with the hidden-input style (plus `writingMode: "vertical-lr", direction: "rtl"` when
  vertical). A layout effect adds the native `change` listener (`useEffectEvent` body →
  `ctx.commit(index, "activate", event)`) and, when vertical, `keydown` for ArrowLeft /
  ArrowRight. `inputRef` merged with the internal ref.
- **Reconciliation and reset** through `useNativeGroupReconciliation` with `element` = the
  first registered input (widened type), `readCurrent` = the registered inputs' values in index
  order, `readDefault` = the JS reset target, `base` = `shownRef.current`, `equals` = array
  equality, `onPlatformChange(next, event)` → `step(next, null, "platform", event)` then
  `commit(null, "platform", event)` (the commit sees `live === next`), and the new
  `onResetEvent` writing each input's `defaultValue` from the reset target. The reset target:
  uncontrolled, `toArray(defaultValue ?? platformDefault)`; controlled, the mount-time
  `toArray(value)`.
- **Label.** Registers its id with the Root from a layout effect (Combobox's Label); renders
  `htmlFor` only when `values.length === 1`.
- **Dev warnings** per sections 1, 3, 5, 8 and conventions (both/mode switch, shape switch,
  wrong element, a Thumb outside a Root throws).
- **Docs site and example app.** Playground: a volume slider with a fake 800 ms save and a
  failure toggle (rollback visible), a price range filtering a suspending list (the
  transition-by-default demo), a vertical slider, an RTL container, a `<form action>` with
  reset. Docs page: the two-action model as the first concept (2.1), the CSS recipe of 6.2 with
  the `@property` registrations, the keyboard table, the "save goes in `valueCommitAction`"
  rule next to every example.

---

## Conventions feedback (proposed)

To be applied to `design/conventions.md` at acceptance by whoever holds it (another design holds
it now):

1. **2.1 action kinds.** Add a row: **commit notification** for a continuous state,
   `<state>CommitAction`, receiving `(next, details)`, called once per gesture, awaited in the
   owner's transition like a change action (Slider's `valueCommitAction`). The `(details)`-only
   `<event>Action` row stays reserved.
2. **1.1 part vocabulary.** Add `Track` (the rail a thumb moves along; owns pointer
   interaction) and `Thumb` (a draggable value handle: a styled element containing a visually
   hidden native `<input type="range">`); widen `Indicator` with "the fill of a slider",
   `Label` with "`label[for]` naming a single Thumb's input, or `label[id]` naming a
   multi-thumb Root", and `Value` with "a `span` showing a Slider's value" (next to Select's
   `<selectedcontent>`).
3. **1.1 one element per part: an exception.** "A part whose platform control cannot be its
   styled element renders the control as a **visually hidden child** of its one styled element
   (`Slider.Thumb`): `ref` goes to the styled element, a documented `inputRef` to the control,
   and the props the control needs (`name`, `form`, the `aria-*` naming trio) are listed as
   forwarded."
4. **2.3 item 5 (entanglement).** Add the continuous-control corollary: a component whose
   interaction produces many steps documents which of its actions may be slow (the commit) and
   which must stay cheap (the step).
5. **3.2 three values.** Add to the urgent row: "the value a slider gesture has reached
   (`live`), shown while a pointer is captured or a step or commit is in flight, else the
   optimistic value; no consumer-facing urgent action". And a rule: **the position under a
   captured pointer is urgent library state**, like virtual focus.
6. **3.3 when uncontrolled state is committed.** Note the gesture case: "for a continuous
   control the dispatch is the gesture's commit action; steps do not write uncontrolled state,
   so a rejected commit rolls the whole gesture back."
7. **3.5 residual paths.** Generalise Combobox's text-input rule to every controlled value
   input: "a **controlled value input** (`type=text`, `type=range`, …) has no reset target of its
   own, because react-dom keeps its `value` attribute equal to the current value; the component
   writes the reset target into `defaultValue` in the `reset` event (`useFormReset`'s
   `onResetEvent`) and dispatches the JS-computed target from the microtask." Add "a value typed
   or stepped into a native range before hydration" to mount reconciliation.
8. **3.8 hooks.** `useNativeGroupReconciliation`: `element` accepts any `FormAssociatedElement`
   (Slider subscribes through its first Thumb input), and a new `onResetEvent` option is passed
   to `useFormReset`. Rule 6 gains the value-input sentence of item 7.
9. **4.1 vocabulary.** Add `dragging` (Root, Thumb: a pointer is captured; urgent); `pending`
   gains "`Slider.Thumb`: the thumb the latest step or commit moved"; `orientation` gains the
   Slider parts.
10. **5.1.** Slider joins Select as a component with no `transition` prop on any part.
11. **5.3 types.** `Slider`: `fsui-slider`, `fsui-slider-change` (step), `fsui-slider-commit`
    (gesture).
12. **9.4 public types.** A component whose value has two shapes may be generic
    (`SliderRootProps<T extends SliderValue = number>`), with the shape fixed at mount.
13. **10.1 test rows.** Add "**Continuous control**: between steps the shown value never
    reverts to the committed value; a rejected commit reverts the whole gesture; a gesture that
    returns to its start dispatches no commit" for any component with a step/commit pair.

---

## For the product owner

Genuine product decisions, with recommendations; none blocks implementation.

1. **Two actions, and the gesture commits uncontrolled state** (decisions 2 to 4, sections 2.1
   to 2.3): `valueChangeAction` per step, `valueCommitAction` per gesture, both transitions, the
   uncontrolled write tied to the commit so a failed save rolls the thumb back. Alternative: the
   research's literal shape, every step a full dispatch and the commit a side notification
   (simpler; no rollback on a failed save in uncontrolled mode; a controlled "update on success"
   parent snaps during the drag). **Recommendation: as designed**; it is what the vision's
   "optimistic + rollback" means for a slider, and the cost is one documented sentence.
2. **Steps are transitions, not an `UrgentChangeAction`** (decision 3, 2.2): the thumb is driven
   by an internal urgent `live` value, the consumer-facing action stays a transition so a
   controlled filter renders interruptibly. Alternative: `valueChangeAction: UrgentChangeAction`
   (Combobox's lane), which would make a parent's `setPrice` synchronous and push
   `useDeferredValue` onto every consumer. **Recommendation: as designed.**
3. **`valueCommitAction` as a new action kind** (`<state>CommitAction(next, details)`,
   feedback 1) rather than `commitAction(details)` with the value inside `details`.
   **Recommendation: as designed**; `valueCommitAction={save}` reads like Base UI's
   `onValueCommitted` and Radix's `onValueCommit`.
4. **`Slider.Indicator`, not `Slider.Range`** (section 1): the vocabulary word exists.
   **Recommendation: `Indicator`.** Cost: Radix users look for `Range`.
5. **`Slider.Thumb` renders two elements** (the styled element and the hidden input; feedback
   3). Alternative: a required `Slider.Input` child part. **Recommendation: accept the
   exception**; every prior-art library does this and a Thumb that can be rendered broken is
   worse than a two-element part.
6. **Default value is the platform's midpoint**, not `min` (section 5). **Recommendation:
   platform** (Select adopts the browser's default the same way); Base UI and Radix default
   differently, which the docs note.
7. **An unreachable `max` stays unreachable** (section 5): the library matches native
   sanitisation and warns in development instead of letting the thumb reach a value the DOM
   cannot hold. **Recommendation: as designed.**
8. **No synthetic `input` / `change` events for pointer gestures** (4.1, section 13): a
   `<form onChange>` listener sees keyboard changes only. Alternative: Radix's `BubbleInput`
   trick. **Recommendation: as designed for v1**; add the bubbling if a form library integration
   asks for it.
9. **The `"dismiss"` revert step in uncontrolled mode** (2.4): one extra `valueChangeAction`
   call after a rejected commit so a preview follows the rollback. Alternative: none (the
   consumer's own commit action threw, so they know). **Recommendation: keep it**; it is the
   Combobox text-revert precedent and costs nothing when `valueChangeAction` is absent.
10. **Explicit `index` on `Slider.Thumb`** (React Aria) rather than registration order (Radix,
    Base UI). **Recommendation: explicit**, default `0`.
11. **No `transition` prop on any part** (section 11), the Select precedent. **Recommendation:
    as designed.**
12. **Conventions feedback 1 to 13** to apply on acceptance by whoever holds `conventions.md`.
