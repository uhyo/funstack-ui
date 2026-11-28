# Slider

Status: **accepted**, implemented. History (reviews, decisions, implementation notes, the
test plan): `design/CHANGELOG.md`, parts "slider.md". The code under `packages/ui/src/slider/` is the ground truth where this document is silent.
Follows `design/conventions.md` (accepted); where this document and the conventions disagree,
the conventions win.

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
native range input: role, value and bounds, keyboard (vertical orientation through
`writing-mode`; RTL mirroring in Chromium and Firefox, which the library completes for WebKit),
`<label>`, form participation, `disabled`. The library adds what the native control
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
| 3 | Lanes | A step is a **transition** (through `useActionTrigger`): a controlled parent adopting `setPrice(v)` in the sync prefix gets an interruptible render, and content that suspends keeps the old UI with `data-pending`. The gesture's commit is the state owner's dispatch (`useControllableAction`: optimistic, latest wins). The thumb under the pointer is driven by a **`live` value in the urgent lane** (`useState`, written in the event); what the thumbs render is `live` while a gesture or a dispatch is in flight, else the optimistic value (section 2.2). No `UrgentChangeHandler` (Combobox's `onInputValueChange`): React does not require urgency here, and the urgent state is library-internal. A step without a `valueChangeAction` starts no transition (nothing to run, nothing to keep interruptible), so a drag with only a commit action is never pending; `live` is held from a step to its gesture's commit by an internal `stepHeld` flag (2.2). |
| 4 | Uncontrolled commit | Uncontrolled committed state is written when the **commit** action resolves, not per step. A rejected save therefore rolls the thumb back to the value before the gesture (the vision's "optimistic + rollback"), and a `valueChangeAction` consumer is told with one `"dismiss"` step (2.4). The slide-back itself is visible only while the Root stays mounted: the rejection reaches the boundary above the Root, which replaces it (2.3). |
| 5 | Value shape | `value: number \| readonly number[]` (one thumb or several), inferred from `value` / `defaultValue`; the shape is fixed at mount. Thumbs cannot cross: each hidden input's native `min` / `max` are its neighbours' values (plus `minStepsBetweenThumbs × step`), so Home / End / PageUp / PageDown and the accessibility tree respect the neighbours natively. |
| 6 | Platform first | `min`, `max`, `step`, `name`, `form`, `disabled`, `aria-valuetext` (from `getAriaValueText`) go on the native inputs; never `aria-valuemin` / `aria-valuemax` / `aria-valuenow`. Values snap and clamp exactly as the platform sanitises them (an unreachable `max` stays unreachable; dev warning). The default value is the platform's midpoint. |
| 7 | Keyboard | Native for every key (Arrow, PageUp / PageDown, Home / End; vertical Up / Down from `writing-mode: vertical-lr; direction: rtl` on the input), with two JS normalisations of ArrowLeft / ArrowRight, both handled from `keydown`: on a vertical slider (Firefox decreases on Right, against the APG) and on a horizontal slider whose input has computed `direction: rtl` (Chromium and Firefox mirror a native range, WebKit does not; the track is mirrored, so Left increases). Those keys fire no native `input` / `change`. LTR horizontal keys stay fully native. |
| 8 | Pointer | Library code on the Track and Thumb: `pointerdown` (prevented, so no text selection), pointer capture, value from the pointer position along the track's inline or block axis (direction read from the Track's computed style), `touch-action: pan-y` / `pan-x` inline. A track press moves the nearest thumb and focuses its input; a Thumb press on stacked thumbs (equal values) uses the same tie rule, and a press exactly on the shared value lets the first move pick. The release position is the gesture's last step (an engine may coalesce the final move into `pointerup`). The hidden input is `pointer-events: none`; no synthetic `input` / `change` events are fired for pointer gestures (13). |
| 9 | Forms and reset | Each input posts under its Thumb's `name` (or the Root's `name` for all). Reset: the library writes each input's `defaultValue` mirror **in the `reset` event** (react-dom rewrites the attribute after every value change) and dispatches the JS-computed reset target (uncontrolled: the latest `defaultValue`; controlled: the mount-time value) as one `"platform"` step + commit in the microtask. Mount reconciliation covers pre-hydration key presses and Firefox restoration. |
| 10 | Exposure | `data-pending` on Root and on the Thumb the gesture moved (never during a drag without a `valueChangeAction`; with one, each step is a real transition, so a spinner belongs on `[data-pending]:not([data-dragging])`); `data-dragging` on Root and the captured Thumb; `data-orientation` on every part; `data-disabled`; `data-index` on Thumb. Geometry through CSS custom properties, never positioning: `--slider-value` (Thumb), `--slider-start` / `--slider-end` and `--slider-value-<i>` (Root, inherited). |
| 11 | ViewTransition | **No `transition` prop on any part** (Select precedent): nothing mounts from library state and every move is urgent or optimistic. Types `fsui-slider`, `fsui-slider-change` (step), `fsui-slider-commit` (gesture) for consumers' own boundaries. Thumb motion and rollback animate with a CSS transition on the registered custom property, disabled under `[data-dragging]`. |
| 12 | SSR | Every part file is `"use client"`. Server HTML carries the inputs with their values; before hydration keyboard and form submission work natively (the visuals catch up at mount through reconciliation); pointer does nothing. A plain `<input type="range">` from a Server Component remains the JS-free form slider (#19 resolved 2026-10-23, user decision, option A of `docs/research/zero-js-variants.md` 5: no directive-free variant; a recipe on the docs page, conventions 7.3). |
| 13 | Not in v1 | `largeStep` / Shift+Arrow, `step="any"`, `list` / tick marks, per-thumb `disabled`, `inverted`, a value tooltip, `<rangegroup>`, `appearance: base` (section 13). |
| 14 | Inside a Field | `Slider.Root` calls `useFieldControl` with `labelable: count === 1`: one thumb registers its input (the Field's control id becomes `thumbId(0)`, `Field.Label` gets `for`); several register the Root `div` (`aria-labelledby` → `Field.Label`, as CheckboxGroup). `aria-invalid` on every Thumb input, never on the group; `aria-describedby` on the input (one) or the Root (several). `name` / `disabled` from the Field; `required` not applicable (dev warning). The slot and `:user-invalid` live on the first Thumb's input. `useFieldValueChange` keyed on the optimistic values with `edit = true` for `"activate"` commits, because pointer and normalised-key gestures fire no native `input` / `change`. Section 9.4. |

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
| `Root` | `div` | `group` when `values.length > 1`, none otherwise | shown value (section 2.2), pending, dragging | Owns `useId`, the commit hook, the step transition, `live` and `stepHeld`, the gesture, the Thumb registry, form reset and mount reconciliation. `aria-labelledby` → the `Label` id while one is mounted (token-merged with the consumer's). Custom properties `--slider-start`, `--slider-end`, `--slider-value-<i>`. `data-pending`, `data-dragging`, `data-orientation`, `data-disabled`. |
| `Label` | `label` | | Root disabled and pending | `id` → the Root's `aria-labelledby` (several thumbs); `for` → the only thumb's input (one thumb). Registers with the Root from a layout effect, as Combobox's Label. `data-disabled`, `data-pending` (the owner's, conventions 4.1 rule 4). |
| `Track` | `div` | none | orientation | The rail. Owns `onPointerDown` (a press moves the nearest thumb and starts its drag); inline `touch-action`. Its box is the geometry reference for pointer math. `data-orientation`, `data-dragging`, `data-disabled` (every boolean and enum of its state, conventions 4.1 rule 2). |
| `Indicator` | `span` | none | | The fill between the first and last thumb (from `min` to the value for one thumb). Renders no inline position: it is placed by the consumer's CSS from `--slider-start` / `--slider-end`. `data-orientation`, `data-dragging`, `data-disabled`. |
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
| `live` | Root, `useState<{ value: readonly number[] } \| null>` (boxed, as NumberField's) | the value a gesture has reached | **urgent** (written in the DOM event, never in a transition) | Library-owned, internal: it is the thumb under the pointer, or the value a key press produced, before anything has committed. Not controllable, not in the public vocabulary; it shows up only as the value the thumbs render. |
| step transition | Root, `useActionTrigger` | `valueChangeAction` in flight | transition | One `run` per step; latest run's rejection goes to React, older ones are surfaced (conventions 3.4). No state of its own. |
| `gestureThumb` | Root, `useState<number \| null>` | the thumb a captured pointer moves (`null`: no pointer captured) | urgent | `dragging = gestureThumb !== null`; `data-dragging`, and `data-dragging` on that Thumb. Keyboard is never "dragging". |
| `stepHeld` | Root, `useState<boolean>` | a step was taken and its gesture's commit has not been dispatched yet | urgent | Library-owned, internal. Set by every step except the `"dismiss"` revert, cleared by the commit (in the same batch as the dispatch, whose pending state takes over). Keeps `live` on screen between a key's native `input` and `change` when no step transition runs (2.2). |
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
const held = gestureThumb !== null || stepHeld || stepPending || commitPending;
const shown: readonly number[] = held && live !== null ? live.value : toArray(optimistic);
```

- `live` is written synchronously in the event by every step (2.4), like Combobox's active
  option: it is the position under the pointer, which is immediate everywhere else in the
  library (focus, typed text). It is never a transition and never dispatches by itself.
- While a pointer is captured, a step is waiting for its gesture's commit (`stepHeld`), or any
  step or commit is in flight, the thumbs, `--slider-*`,
  `aria-valuetext`, `Slider.Value` and every `state.value` render `live`. The moment nothing is
  pending they render the optimistic value, which by then equals the committed one (success:
  `committed === next` in the same commit as `pending` leaving; rejection: the value before the
  gesture). No effect clears `live`; it is simply ignored, and the next step overwrites it.
- React's end-of-event restore of a controlled input (`restoreControlledInputState`) writes the
  current prop back into the DOM; the prop is `shown`, rendered in the sync flush of the same
  event, so the DOM, the attributes and the accessibility tree agree in every phase. This is
  what `stepHeld` is for: a step with no `valueChangeAction` starts no transition (next bullet),
  so without the flag nothing would hold `live` between a key's native `input` and its
  `change`; react-dom would restore the input to the old value after `input`, and Firefox then
  fires no `change` at all (Chromium does). The flag is set by every step except the
  `"dismiss"` revert (which has no commit after it) and cleared when the gesture commits.
- A step runs the step transition **only when a `valueChangeAction` exists**. Without one
  there is nothing to run and no consumer update to keep interruptible, and a transition per
  pointer move would toggle `data-pending` on every step (two renders per `pointermove`, about
  120 a second during a drag) although nothing is in flight. With a synchronous
  `valueChangeAction` each step is still a real transition and the blink is inherent; the 6.2
  recipe therefore styles the spinner on `[data-pending]:not([data-dragging])`.

This is **not** the urgent lane of conventions 2.6 (an `on<State>Change: UrgentChangeHandler` prop): no consumer-facing
action is urgent, and a controlled `value` still gates committed state. It is the library's
third urgent state after Combobox's text and active option, used, as the rule says, only where
React's timing requires it.

### 2.3 Uncontrolled state is committed per gesture

`useControllableAction`'s `action` is `valueCommitAction`, so the uncontrolled write happens when
the gesture's commit resolves, not per step. Consequences, documented on the component page:

- A rejected `valueCommitAction` (a failed save) rolls the thumb back to the value before the
  gesture in uncontrolled mode; a controlled parent gets the same by adopting on success only.
  What the user sees differs: the rejection reaches the nearest boundary, which is above the
  Root, so the uncontrolled slider is **unmounted** and replaced by the fallback (no
  slide-back; a retry remounts it showing `defaultValue`). The slide-back of the 6.2 CSS is
  visible only while the Root stays mounted: an update-on-success parent whose commit action
  catches its own failure (walkthrough 4), or a non-adopting parent at release.
- `valueChangeAction` resolving changes no library state; it is the preview channel.
- Overlapping gestures (a new drag while a save is pending) follow latest intent: the last
  commit's value is what lands; the earlier save's result is ignored, its rejection passed to
  `reportError` (conventions 2.4; section 4.4).

### 2.4 Step, commit, and the "dismiss" revert

The Root has two internal entry points, `step` and `commit`; every path (pointer, keyboard,
platform) uses them. They are implemented once for Slider and NumberField, in
`internal/action/use-step-commit.ts`; what differs (the array shape, `equalValues`, NumberField's
rounding, draft, hidden input and announcement) is passed in as options. Values are arrays
inside the Root; `fromArray` restores the prop's shape for the actions.

`step(next, thumb, reason, event)`:

- Returns `false` and does nothing when `next` equals the shown value (`equalValues`): no-op
  against what the user sees (conventions 2.3 item 8).
- Otherwise writes the reached value synchronously (a commit in the same event reads it), sets
  `live` (urgent), `pendingThumb` and the reason the Field notification reads (9.4.4), and sets
  `stepHeld` unless the reason is `"dismiss"` (a revert has no commit after it).
- Runs `valueChangeAction` in the step transition (`useActionTrigger`, no in-flight guard; types
  `fsui-slider`, `fsui-slider-change`) with `{ reason, thumb }`. Without a `valueChangeAction`
  it starts no transition (2.2).

A gesture records the shown value it began at:

- A key the Root normalises, a platform change and a pointer capture open a gesture at the
  shown value before their first step. A capture also sets `live` to the shown value, so a
  press that steps nothing shows the current value, not what an earlier gesture left behind.
- A native `input` opens a gesture after its step, and only when none is open: its `change`
  commits later, and several `input` events before one `change` are one gesture from the value
  shown before the first.

`commit(thumb, reason, event)`:

- Closes the open gesture: the gesture start is cleared (`null`) and `stepHeld` with it, in the
  same batch as the dispatch, whose pending state holds `live` from here.
- Dispatches nothing when no gesture was open (a trailing native `change`) or the reached value
  equals the value the gesture began at (a drag out and back).
- Otherwise sets `pendingThumb` and dispatches `fromArray(reached)` through
  `useControllableAction` with `{ reason, thumb }`.

The commit's wrapped action, as Combobox wraps its value action: it awaits
`valueCommitAction`; on a rejection in uncontrolled mode, for the latest commit only, it yields
once (`await undefined`, which leaves the transition, conventions 2.6), runs
`step(committed, null, "dismiss", undefined)` and rethrows.

The `"dismiss"` step exists so that a `valueChangeAction` consumer whose preview followed the
drag follows the rollback too (the Combobox text-revert precedent). It is dispatched in
uncontrolled mode only, for the latest commit only: a controlled parent owns its state and wrote
it itself; a superseded commit's rejection is passed to `reportError` by the hook (conventions
2.4) and rolls nothing back, because a newer commit owns the value. `details.event` is `undefined` and `details.thumb` is `null`.

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
   * press, the `pointerdown` / `pointermove` / `pointerup` for a drag, the `keydown` for a
   * JS-normalised key).
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
  /** Inside a `Field.Root`: an error is shown for the field (`data-invalid` on Root and Thumb). `false` outside. */
  readonly invalid: boolean;
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
receive `readonly number[]`); with neither it is `number`. `Slider.Root` is exported as an
overloaded const (`number` / `readonly number[]` / `SliderValue`) so that an array literal
infers `readonly number[]` (a plain generic would infer a mutable `number[]`). The shape (number or array) is fixed
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
export type SliderLabelState<T extends SliderValue = SliderValue> = SliderRootState<T>; // every part has a state type (conventions 9.4)
export interface SliderIndicatorProps
  extends Omit<ComponentPropsWithRef<"span">, "className" | "style" | "children"> { … }

// `T` defaults to `SliderValue` in the parts, not `number`: a part is not connected to its Root's `T`.
export interface SliderLabelProps<T extends SliderValue = SliderValue>
  extends Omit<ComponentPropsWithRef<"label">, "htmlFor" | "id" | "className" | "style" | "children"> {
  className?: StateValue<string | undefined, SliderRootState<T>>;
  style?: StateValue<CSSProperties | undefined, SliderRootState<T>>;
  children?: StateValue<ReactNode, SliderRootState<T>>;
  render?: RenderProp<ComponentPropsWithRef<"label">, SliderRootState<T>>;
}

export interface SliderValueState<T extends SliderValue = SliderValue> extends SliderRootState<T> {
  /** The `index` prop, or `null`. */
  readonly index: number | null;
}
export interface SliderValueProps<T extends SliderValue = SliderValue>
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

`Slider.Value` and `Slider.Label` are generic like the Root, but a part cannot see its Root's
type parameter, so their `T` defaults to `SliderValue` (`number | readonly number[]`), not
`number`: `state.value` must be narrowed (`<Slider.Value<number>>`, or a `typeof` check) or
`state.values` read instead, which is what the examples do. A `number` default would let
`<Slider.Value>{({ value }) => value.toFixed(0)}</Slider.Value>` type-check inside an array
slider and throw at runtime.

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
| `pointerdown` (primary button, not `disabled`) | Thumb | `preventDefault()` (no text selection, no focus change through the compat `mousedown`); `setPointerCapture` on the Thumb; `gestureThumb = index`; `gestureStart` = shown; the input is focused (`:focus-visible` does not match after a pointer press, so no ring appears, as on a native range); `step` with the value under the pointer if it differs. **Stacked thumbs**: when the pressed thumb shares its value with neighbours, the Track's tie rule applies to the stack: a pointer above the value picks the last thumb of the stack, below it the first; exactly on it the press is undecided (the pressed thumb shows `data-dragging` and takes focus) until the first move off the value picks, moving `data-dragging` and focus to the chosen thumb. Without this a stack at `max` could never be pulled apart: the top thumb's bounds are its neighbour's value. `pointermove`, `pointerup`, `pointercancel` and `lostpointercapture` listeners are attached to the captured element for the gesture's duration (`addEventListener`, removed at its end). |
| `pointerdown` | Track (no gesture already begun for this pointer) | Same, with the **nearest thumb** by value distance to the pointer's value; on a tie (two thumbs at one value) the thumb that can move toward the pointer. Capture on the Track. |
| `pointermove` (the captured `pointerId` only) | captured element | `step(thumb, valueFromPointer)`. |
| `pointerup`, `pointercancel`, `lostpointercapture` | captured element | `pointerup` first takes a last `step` at the release position when it differs from the last move (an engine may coalesce the final move into the `pointerup`; `details.event` is then the `pointerup`); `pointercancel` / `lostpointercapture` keep the last move's value. Then `gesture = null`; `commit(thumb, "activate", event)`; listeners removed. A cancelled gesture commits where it stopped (the user's last intent; leaving the value uncommitted would strand the preview). |

Value from the pointer: the Track's `getBoundingClientRect()` at the step; horizontal
`fraction = (clientX - left) / width`, mirrored (`1 - fraction`) when the Track's computed
`direction` is `rtl` (read once at `pointerdown`); vertical `fraction = (bottom - clientY) /
height` (`min` is always at the bottom). Then `min + fraction × (max - min)`, snapped and clamped
(section 5). Inline `touch-action: pan-y` (horizontal) or `pan-x` (vertical) on the Track and
Thumb keeps page scrolling along the other axis.

The hidden input never receives the pointer (`pointer-events: none`), so no native `input` or
`change` fires for a pointer gesture and the library fires none itself (product-owner item 8):
`details.event` is the `PointerEvent`, and a `<form onChange>` listener sees keyboard changes
only, and among those not ArrowLeft / ArrowRight on a vertical or RTL slider, which the library
handles from `keydown` (4.2). Radix's `BubbleInput` alternative needs the `HTMLInputElement.prototype.value` setter trick
to get past React's value tracker and would re-enter React's event dispatch from inside
`pointermove`; recorded in section 13 as a possible follow-up.

### 4.2 Keyboard

The native input handles every key (section 7). What arrives:

| Native event | Library |
| --- | --- |
| `input` (React `onChange` on the input) | `step(index, Number(input.value), "activate", nativeEvent)`; `gestureStart` = the shown value before this press if no gesture is open (a key press is a one-step gesture) |
| `change` (a native listener through the input's ref: React surfaces no `onChange` for it, research finding 2) | `commit(index, "activate", event)` |
| `keydown` ArrowLeft / ArrowRight while `orientation="vertical"`, or horizontal with the input's computed `direction` `rtl` (read at each `keydown` from `event.currentTarget`, so a direction set on any ancestor at any time counts; no `instanceof`, the pre-hydration row runs in an iframe realm) | `preventDefault()`; `step` to `value ± step`, then `commit`, both with the `keydown`. Vertical: Right increases (APG; Firefox decreases natively, Chromium increases). RTL: Left increases (the track is mirrored, `min` on the right; Chromium and Firefox mirror a native range, WebKit does not: `RangeInputType::handleKeydownEvent` maps Left to −step with no direction check). A press with Alt, Ctrl or Meta is left to the browser. No native `input` / `change` fires for these keys. Horizontal LTR keys are never touched. |

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
  commit supersedes the earlier one (latest wins); the earlier commit's rejection is passed to
  `reportError`, not to the boundary (conventions 2.4).
- A controlled parent that does not adopt steps sees the thumb follow the pointer anyway
  (`live`) and return to `value` when the gesture settles: a per-step veto is visible only at
  release, and it returns once (no `80 → 20 → 80` bounce: `stepHeld` is cleared in the same
  batch as the commit dispatch, whose pending state holds `live` until the optimistic revert).
  Clamping is done with `min` / `max` / `step`, not by refusing steps.
- A step without a `valueChangeAction` starts no transition at all (2.2); `data-pending` is
  then the commit's alone.
- A superseded rejection, on either channel, is reported the moment it arrives, in every mode
  (uncontrolled, update on success, adopting parent) and whatever the other channel is doing:
  `reportError` is a plain call from the action's continuation, not a render. The **latest**
  commit's rejection reaches the boundary, after every older overlapping action has settled
  (conventions 2.4).

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
| `data-pending` | while any step (with a `valueChangeAction`) or commit is in flight | | | while the Root is pending and this thumb is `pendingThumb` | conventions 4.3: owner and the trigger the user acted on |
| `data-dragging` | while a pointer is captured | | | on the captured thumb | urgent; keyboard never sets it |
| `data-orientation` | `horizontal` / `vertical` | same | same | same | |
| `data-disabled` | | | | | the Root's `disabled` |
| `data-readonly` | | | | | the Root's `readOnly` or the Field's, on the same parts as `data-disabled` |
| `data-index` | | | | `0`, `1`, … | style the min and max thumbs differently |

A drag with no `valueChangeAction` never sets `data-pending` (no step transition runs). With
one, even a synchronous one, every pointer move is a short pending render: a spinner on
`[data-pending]` alone blinks throughout the drag, so the recipe below gates it on
`:not([data-dragging])`.

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
.thumb[data-pending]:not([data-dragging])::after { content: ""; /* spinner; not during a drag, where a step action makes every move pending */ }
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
| ArrowRight | + step | − step (mirrored) | + step | native LTR; **RTL: JS** (WebKit does not mirror); **vertical: JS** (Firefox decreases natively) |
| ArrowLeft | − step | + step (mirrored) | − step | native LTR; **RTL: JS**; **vertical: JS** |
| ArrowUp | + step | + step | + step | native (`writing-mode: vertical-lr; direction: rtl` on the input puts `min` at the bottom in both engines) |
| ArrowDown | − step | − step | − step | native |
| PageUp / PageDown | ± 10 % of the range (step-aligned) | same | same | native |
| Home / End | the thumb's `min` / `max` (its neighbour in a multi-thumb slider) | same | same | native, through the neighbour bounds |
| Tab / Shift+Tab | between thumbs (each input is a tab stop) | | | native |
| Shift+Arrow | not handled (section 13) | | | |

Each native key press fires `input` then `change`: one step and one commit (4.2). The
JS-handled keys (vertical Left / Right, RTL Left / Right) are prevented at `keydown` and
dispatch the same step and commit with the `keydown` as `details.event`; no native `input` /
`change` fires for them.

**Orientation.** `orientation="vertical"` renders `writing-mode: vertical-lr; direction: rtl`
inline on every hidden input, so the accessibility tree reports `vertical` (Chromium derives it
from `writing-mode` and ignores `aria-orientation`, research §3; `aria-orientation` is not set),
the pointer axis is the Track's block axis, and the custom properties count from the bottom.

**Direction.** A horizontal slider inherits the page's or container's `direction`: the
Track's computed `direction` mirrors the pointer math and logical insets mirror the CSS, so
`min` is drawn on the right. The arrow keys are **not** left to the browser under RTL: Chromium
and Firefox mirror ArrowLeft / ArrowRight on a native range, WebKit does not (if left to the
browser, ArrowRight in Safari would increase the value and move the thumb **left**, the
opposite of the key and of the same page in Chrome and Firefox). The library reads `getComputedStyle(input).direction`
at each `keydown` and, when it is `rtl`, handles ArrowLeft (+ step) and ArrowRight (− step)
itself through the vertical normalisation's path, so every engine behaves as Chromium and
Firefox did natively and LTR stays fully native. The cost is the vertical row's: those two keys
fire no native `input` / `change`. Nothing is read from `document.dir`; a `dir="rtl"` container
works. The vertical input's forced `direction: rtl` is independent of the page direction.

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
- **`readOnly`** on Root (conventions 3.6.1; **proposed**, #203; a boolean prop of
  `SliderRootProps`, and `readOnly` in every part's state): every input stays focusable and is submitted, and nothing steps or commits.
  The `pointerdown` handlers of Track and Thumb do nothing, as when disabled; the Thumb's
  `keydown` cancels the keys that move a range (the four arrows, Home, End, Page Up, Page
  Down; with a modifier too), so no native `input` fires; a native `input` that arrives anyway
  (an assistive technology's increment action) steps nothing, and the shown value is written
  back to the input in that event. Each input renders `aria-readonly="true"` (owned; the
  `slider` role has the state). Turning `readOnly` on during a drag ends the stepping: the
  gesture commits where it stopped. Keys pressed before hydration are undone at mount, not
  dispatched. `Slider.Thumb` has no `readOnly`.
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

### 9.4 Inside a `Field`

This section is accepted, including the dev warning for `Field.Root required` around a Slider. If a
screen-reader pass finds group descriptions unread, moving `aria-describedby` onto each thumb
input is pre-approved as a follow-up. The wiring follows Field 7.1 / 7.2 (`useFieldValueChange`,
no `data-pending` from the hook, per-item `aria-invalid` for a `group`). Everything below is
the Root's and the Thumb's; no new part, no new public prop.

```tsx
<Field.Root name="volume">
  <Field.Label>Volume</Field.Label>                 {/* label[for] → the only thumb's input */}
  <Slider.Root defaultValue={40}>
    <Slider.Track><Slider.Indicator /><Slider.Thumb /></Slider.Track>
  </Slider.Root>
  <Field.Description>Loud is above 80.</Field.Description>
  <Field.Error />
</Field.Root>

<Field.Root name="price" validate={(_, fd) => (Number(fd.getAll("price")[1]) - Number(fd.getAll("price")[0]) > 500 ? "Narrow the range to 500 or less." : null)}>
  <Field.Label>Price</Field.Label>                  {/* label[id]; the Root is aria-labelledby it */}
  <Slider.Root defaultValue={[100, 900]} max={1000}>
    <Slider.Track>
      <Slider.Indicator />
      <Slider.Thumb index={0} aria-label="Minimum price" />
      <Slider.Thumb index={1} aria-label="Maximum price" />
    </Slider.Track>
  </Slider.Root>
  <Field.Error />
</Field.Root>
```

Rendered (idle; one thumb, then two):

```html
<div>                                                                   <!-- Field.Root -->
  <label id="_f_-label" for="_f_-control">Volume</label>
  <div data-orientation="horizontal" style="--slider-end: 40%">          <!-- Slider.Root: no role, data-invalid when shown -->
    <div><span data-index="0"><input type="range" id="_f_-control" name="volume" value="40"
         aria-describedby="_f_-description" aria-invalid="false"></span></div>
  </div>
  <p id="_f_-description">Loud is above 80.</p>
</div>

<div>
  <label id="_g_-label">Price</label>                                     <!-- no `for` once the group registered -->
  <div role="group" aria-labelledby="_g_-label" aria-describedby="_g_-description" …>
    <div>
      <span data-index="0"><input type="range" id="_s_-thumb-0" name="price" aria-label="Minimum price" aria-invalid="false" …></span>
      <span data-index="1"><input type="range" id="_s_-thumb-1" name="price" aria-label="Maximum price" aria-invalid="false" …></span>
    </div>
  </div>
</div>
```

#### 9.4.1 Where the hook runs, and how its attributes reach the inputs

`Slider.Root` calls `useFieldControl({ labelable: count === 1, name, disabled, component:
"Slider.Root" })`, where `count` is `shown.length` (known in the Root at render; the Thumb is not
the owner part). The Root does not pass its own `id` prop to the hook: that `id` is the `div`'s
and keeps passing through; the Field's control id is for the thumb input. The hook's single
`attributes` object does not fit a two-element control as "spread into the owner's
`libraryProps`", so the Root **splits it** and routes the pieces through `SliderContext`:

| Piece | One thumb | Several thumbs |
| --- | --- | --- |
| `field.ref` (registration) | through context (`ctx.field.inputRef`); **Thumb `index` 0** merges it into its input ref (`useMergedRefs`), so the registered element is the input | merged into the Root's library ref, so the registered element is the group `div` |
| `id` (`ids.control`) | `thumbId(0)` returns the Field's control id (`thumbId = (i) => i === 0 && fieldId !== undefined ? fieldId : \`${id}-thumb-${i}\``); the Thumb renders it as today, and `Slider.Label`'s `for` (if one is mounted) agrees | unchanged library ids on every input |
| `aria-labelledby` | none (the Field's `for` names the input) | on the Root `div`, token-merged: the Field's label id, then `Slider.Label`'s id while one is mounted, then the consumer's; the "a multi-thumb slider needs a name" warning counts the Field as a name |
| `aria-describedby` | through context to Thumb 0's input, token-merged with the Thumb's forwarded `aria-describedby` (the consumer's tokens first, Field 4.3) | on the Root `div` (the group element, read when focus enters the group, Field 5.1: the same placement as RadioGroup / CheckboxGroup); a Thumb's own forwarded tokens stay on its input |
| `aria-invalid` | through context to **every** Thumb's input (`ctx.field.invalid`), owned there | the same: every input, **never on the group `div`** (ARIA 1.2 deprecated `aria-invalid` on `group`; Field 5.1 / CheckboxGroup precedent) |
| `data-invalid` | on the Root `div` (owned) and on every Thumb's styled `span` (through context), so the recipe can colour the thumb; not on the hidden input | the same |
| `name` | `field.name` (own `name` ?? the Field's) replaces the Root's `name` in context; a Thumb's own `name` still wins per input | the same; with one name every thumb posts under it (`FormData.getAll`) |
| `disabled` | `field.disabled` (own `||` the Field's) replaces `disabled` everywhere the Root uses it (inputs, pointer, `data-disabled`, state) | the same |
| `required` | **not applicable**: a range always has a value and `Slider.Root` has no `required` prop (3.1). The registration reports `required: false`; `Field.Root required` on a Field whose control is a Slider logs a dev warning once ("a range is never empty; `required` has no effect") and still sets `data-required` on the Field parts (the Field's own prop) | the same |
| `form` | unchanged pass-through; the Field reads `el.form` from the registered input, so a Slider submitting to another form validates in that form | unchanged |
| `data-pending` | **nothing from the Field**: the Root's and the Thumb's `data-pending` stay the slider's own step / commit (Field 7.3; conventions 2.7) | the same |

Why the Root registers the group `div` and not a `<fieldset>`: the Root is a `div` with
`role="group"` (section 8); Field's `validityElementOf` and `focusTargetOf` handle a non-fieldset
element with `querySelectorAll("input, select, textarea")`, so no element change is needed. The
Field's capture listeners on the `div` see every input's `input` / `change` / `focusout` /
`invalid` (the same as on a fieldset).

Why the Root and not the Thumb calls the hook: the labelable-vs-group choice needs the count,
the Field allows one registration, and `name` / `disabled` are Root props. The Thumb only
consumes what the context gives it (ref, id, `aria-describedby`, `aria-invalid`, `data-invalid`).

Why Thumb 0 is "the" labelable input and not "the first mounted Thumb": `index` is explicit and
`index={0}` is the default; a single-thumb slider has exactly one Thumb, which is index 0 (a
Thumb with another index renders nothing and warns, 3.2).

#### 9.4.2 `Field.Label` and `Slider.Label`

Inside a Field, `Field.Label` is the name: with one thumb it renders `for` → the Field's control
id, which is the thumb input's id (above); with several, it renders no `for` once the Root
registered `labelable: false`, and the Root carries `aria-labelledby` → the Field label id. This
is exactly the CheckboxGroup shape (Field 4.2, 7.2). The server HTML of a multi-thumb Field
carries `for` until hydration removes it (Field 8).

`Slider.Label` stays for use outside a Field (its `for` / `id` wiring is unchanged). Inside a
Field it still works: with one thumb both labels point at the same input (two `for`s, the
accessible name concatenates); with several, both ids are in the Root's `aria-labelledby`. No
warning: `Combobox.Label` has the same rule. Each thumb of a multi-thumb slider still needs its
own `aria-label` / `aria-labelledby` (section 8); the Field names the group, not the thumbs.

#### 9.4.3 The custom-validity slot and `:user-invalid`

The Field writes `validate`'s result and a shown server error with `setCustomValidity` on its
**validity element**: the registered input (one thumb) or, for the group `div`, the first named
`willValidate` input in DOM order, which is the first Thumb's input (Track, Indicator and Value
contain no form controls). A range has no native constraints, so `validity` is `valid` unless the
slot is set; with the slot set, the input matches `:invalid`, and after a submission attempt (or a
change-then-blur) `:user-invalid`, as any input does; `validationMessage` is the slot's text.
A submit attempt then fires `invalid` on that input: the Field (with a `Field.Error` mounted)
cancels the bubble, renders the message and the collector focuses the input (Field 2.5;
`focusTargetOf(div)` → the first enabled named input = the first thumb). The Form's settle focus
for a server error lands on the same input (Field 3.5).

`validate`'s `value` is `formData.get(name)`: the **first** thumb's value as a string. A rule
over several thumbs reads `formData.getAll(name)` (the example above). Per-Thumb names
(`price-min` / `price-max`) still post correctly, but then `errors` and `validate` key on the
Field's `name`, which no input carries: a dev warning when a Thumb's `name` differs from the
Field's (the `useFieldControl` warning extended to the Thumb inputs through the Root).

Thumbs that mount late (a Suspense boundary) can change which input is first: the Field's
`refresh()` re-resolves the validity element on every read and clears the slot on the previous
element (Field 14, "the slot"), so nothing needs doing here.

#### 9.4.4 Gestures the Field cannot hear: `useFieldValueChange`

Field dismisses a shown server error and re-runs `validate` from the control's native `input` /
`change`. A pointer gesture fires neither (4.1: the hidden input never receives the pointer and
the library fires no synthetic events, product-owner item 8), and neither do the JS-normalised
keys (ArrowLeft / ArrowRight on a vertical or RTL slider, 4.2). With
`Form.Root errors={{ volume: "Too loud" }}` a drag to a quieter value would otherwise leave the
error shown and the slot set, so the next submit is blocked by a stale custom error.

**Decision: the direct Field hook, not `BubbleInput`.** The Root calls

```ts
const lastReason = useRef<ChangeReason | null>(null);      // written by commitGesture before it dispatches
useFieldValueChange(optimisticValues.join("\u0000"), () => lastReason.current === "activate");
```

- `value`: the optimistic values as one string (two arrays are never `Object.is`-equal). In
  uncontrolled mode `optimistic` changes once per gesture, at the commit dispatch (2.3), and on
  a rollback; with a controlled adopt-steps parent it changes per adopted step. During a drag the
  thumbs show `live`, which is not in the key: the Field is told at the **commit**, which is
  when the value is worth validating (the same granularity as the native key path's `change`;
  a per-move refresh would build a `FormData` sixty times a second for nothing). The DOM already
  holds the live value during the drag, so a submission attempt mid-drag validates what is shown.
- `takeEdit`: `true` when the latest commit's `reason` was `"activate"` (pointer, key, or a
  normalised key): the user made the change, so a shown server error is dismissed exactly as an
  `input` event would. `"platform"` (reset, mount reconciliation) and the `"dismiss"` revert
  report `false`: a rollback to the committed value is not an edit, so a server error about that
  value stays shown. `lastReason` is set in `commitGesture` before the dispatch and read in the
  layout effect of the commit's optimistic render (same task for a key, the `pointerup` task for
  a drag).
- A key press fires native `input` + `change` **and** notifies at the commit: the second refresh
  is idempotent (the mirror compares before it sets state, Field 14), so no extra render.
- Cross-field rules in other Fields follow through `Form.Root`'s `refreshFields` (Field 7.1);
  outside a `Form.Root` only the Slider's own Field refreshes, which the Field design documents.

`BubbleInput` (a synthetic bubbling `input` / `change` on the hidden input at each move) stays
out (section 13): it needs the prototype `value` setter to get past React's tracker, re-enters
React's dispatch from `pointermove`, and would tell every form listener the user "typed"; the
hook is the same post-commit layout effect Combobox and CheckboxGroup already use.

#### 9.4.5 Walkthroughs

1. **Server error, then a drag.** `errors={{ volume: "Too loud" }}` at mount: the Field writes
   the slot on the input, shows the error, `aria-invalid="true"` on the input, `data-invalid` on
   the Root and the Thumb span. The user drags to 30 and releases: `commitGesture("activate")`
   sets `lastReason`, dispatches; the optimistic render's layout effect notifies `edit = true`;
   the Field dismisses, clears the slot, `aria-invalid="false"`; Save submits.
2. **`validate` on a range, submit attempt.** The price example: thumbs at 100 and 900; the
   user clicks Save. The slot holds "Narrow the range…" (written at mount and after the last
   commit); the browser fires `invalid` on the first thumb's input; the Field cancels the bubble,
   renders the message, focuses the first thumb (`:user-invalid` now matches it, `data-invalid`
   on the Root). The user drags the max thumb to 500: at the commit the Field re-runs `validate`
   → `null`, the slot clears, the error unmounts.
3. **RTL ArrowLeft.** A horizontal slider under `dir="rtl"` inside a Field with a server error:
   ArrowLeft is handled from `keydown` (4.2), no native events; the commit notifies with
   `edit = true` and dismisses the error.
4. **Rejected save.** `valueCommitAction` rejects, caught inside (uncontrolled): the value
   reverts (`"dismiss"`), the optimistic key changes, notify with `edit = false`: `validate`
   re-runs on the reverted value; a server error that was shown stays shown.
5. **Form reset.** The `reset` event: the Field re-reads in its microtask (Field 2.2) and the
   Root's `"platform"` commit notifies with `edit = false`; both read the reset values.

#### 9.4.6 Tests

jsdom, `slider.test.tsx`, "Inside a Field" (conventions 10.1 row), both shapes:

| Row | Proves |
| --- | --- |
| One thumb, wiring | Inside `Field.Root name="volume" disabled`: the input's `id` is the Field's control id and `Field.Label`'s `for` equals it; `name="volume"` on the input; `disabled` on the input and `data-disabled` on the parts; `aria-describedby` = the Thumb's own tokens + the Field's description id; `aria-invalid="false"`; no `aria-labelledby` on the Root; `Slider.Label` mounted too: both `for`s equal the input id. |
| Several thumbs, wiring | `Field.Label` has no `for` after mount; the Root has `role="group"`, `aria-labelledby` = Field label id + `Slider.Label` id (+ consumer tokens, consumer's first), `aria-describedby` = the Field's description id; **every** input has `aria-invalid="false"` and the Root `div` has none; the group-name warning does not fire with a `Field.Label` and no `Slider.Label`. |
| `required` | `Field.Root required` around a Slider warns once; no input is `required`; `data-required` is on the Field parts. |
| Server error and a pointer commit | `Form.Root errors={{ volume: "Too loud" }}`: `Field.Error` shows it, the (first) input's `validationMessage` is the message and `validity.customError` is true, `aria-invalid="true"` on every input, `data-invalid` on the Root and the Thumb spans; a mocked-rect press, move and release: after the commit the error is gone, the slot is `""`, `aria-invalid="false"`. |
| `validate` and a commit | `validate` reading `getAll(name)` runs at mount (slot set), after a pointer commit (cleared when the rule passes), after a vertical / RTL `keydown` commit, and after a `"platform"` reset; `Field.Error` renders the string after a `requestSubmit()` attempt (the `invalid` event, fallback mode) and the first thumb's input is focused. |
| Rollback | A rejected commit caught inside (uncontrolled): one notification with `edit = false`: a shown server error stays shown; `validate` saw the reverted value. |
| Form focus | `Form.Root` settle with `errors` for the Slider's Field: focus lands on the first thumb's input (several thumbs) / the input (one). |
| Two channels | A `valueCommitAction` in flight: `data-pending` on the Root and the moved Thumb only; the Field's `data-pending` follows the form's submission only. |
| Late Thumb | Thumb 1 mounts after Thumb 0 inside a Field: the slot moves to no other element (index 0 stays first); the Field's listeners on the group `div` hear the new input's `change`. |

Browser, `slider.browser.test.tsx`, all three engines: with `validate` returning a message, a
real click on `Form.Submit` fires `invalid` on the first thumb's input, the Field cancels the
bubble (no `reportValidity` UI; the collector's focus is on the thumb input), the input matches
`:user-invalid`, and a real drag that fixes the rule clears the error and lets the next click
submit (the action is called once with the dragged value in its `FormData`). Engine note: WebKit
sets the user-validity flag on a submit attempt like the others (Field's browser rows already
pin this for text inputs); the row asserts the same in all three.

Type test: `required` is still not a `Slider.Root` prop; no new public prop.

#### 9.4.7 Implementation notes

- `slider-root.tsx`: `useFieldControl` as above; `useMergedRefs(libraryRef, count > 1 ?
  field.ref : undefined)` for the Root element; `thumbId` reads `field.id`; `name` / `disabled`
  taken from the hook's result before everything that uses them; the Root's `libraryProps` gain
  `aria-labelledby` (count > 1, token-merged: Field label id, `Slider.Label` id, consumer),
  `aria-describedby` (count > 1, token-merged) and `data-invalid`; `lastReason` ref written in
  `commitGesture`; `useFieldValueChange` as in 9.4.4; the group-name warning adds
  `field.inField` to its "named" condition; the `required` warning through `useDevWarning`.
- `slider-context.ts`: `field: { inputRef: RefCallback<HTMLElement> | undefined;
  describedBy: string | undefined; invalid: "true" | "false" | undefined; dataInvalid: "" |
  undefined } | null` (`null` outside a Field; `inputRef` and `describedBy` set only with one
  thumb).
- `slider-thumb.tsx`: index 0 merges `ctx.field?.inputRef` into the input ref (after the
  consumer's `inputRef`); every Thumb puts `aria-invalid` on its input (owned) and
  `data-invalid` on its span; `aria-describedby` on the input is the token merge of the
  forwarded prop and `ctx.field?.describedBy`.
- `slider-label.tsx`: unchanged (`htmlFor: single ? ctx.thumbId(0) : undefined` already yields
  the Field's id).
- Conventions 3.8's `useFieldControl` and `useFieldValueChange` rows list Slider. The Field
  docs page's "FUNSTACK controls" list includes Slider; the Slider page has an "Inside a Field"
  example (the price range with `validate`).

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
(research §4, structure 2, and §7 item 8); it is not a part of this anatomy. #19 resolved 2026-10-23, user decision, option A of `docs/research/zero-js-variants.md` 5: no directive-free variant; the docs page shows the native recipe (conventions 7.3).

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
`G` = `gestureThumb`. One thumb, `min 0`, `max 100`, `step 1`.

1. **Uncontrolled, `valueCommitAction={save}` (800 ms), drag 40 → 70.** `pointerdown` on the
   track at 55: prevented, captured, input focused, `G=0`, `gestureStart=[40]`,
   `step([55])`: `L=[55]`, `S=[55]` in the same event, `stepHeld=true`; `valueChangeAction` is
   absent, so no step transition starts and nothing is pending during the drag. Moves:
   `L=[60]`, `[66]`, `[70]`, each a step. `pointerup`: a last step at the release position if
   the pointer moved since the last `pointermove`; `G=null`, `stepHeld=false`, `commit`:
   `dispatch([70])` → `O=[70]`, `P=true`, `data-pending` on Root and Thumb
   0; `await save(70)`. `S=[70]` throughout (`L` while pending, then `O`). Resolves: `C=[70]`,
   `P=false`, `S=O=[70]`; the thumb never moved after release.
2. **Same, the save rejects.** The error reaches the boundary above `Slider.Root`, which
   replaces the slider with its fallback: the Root is **unmounted**, so no slide-back is
   visible (`O` reverts to `[40]` and `P` to `false` in the same commit, but nothing renders
   them). The Root dispatched one `valueChangeAction([40], { reason: "dismiss" })` first (none
   here). `C` was never written, so a retry that remounts the slider shows `defaultValue`
   (`[40]`). The visible slide-back (the 6.2 CSS transition on `--slider-value`) belongs to
   walkthrough 4's handled failure and to a non-adopting parent's release; the docs must not
   promise it for uncontrolled mode.
3. **Controlled live filter, `value={price}` `valueChangeAction={(v) => setPrice(v)}`, the
   list under it suspends for 300 ms per value.** Each move: `L` follows at once;
   `setPrice(v)` is a transition update held while the list loads (the old list stays, Root
   and Thumb `data-pending`); a later move supersedes the render for the earlier price. Release:
   `commit` → `dispatch([70])`, no commit action, resolves at once; `S=L=[70]` while
   `stepPending` is still true; when the list for 70 commits, `isPending` of the step
   transition leaves in the same commit as `price=70`, so `S=O=C=[70]` with no snap.
4. **Controlled "update on success", no `valueChangeAction`:** `value={v}`
   `valueCommitAction={async (n) => { await save(n); startTransition(() => setV(n)); }}`. Drag:
   `L` moves, `C` stays; release: `O=[70]`, `P=true`; success: `C=[70]`; failure caught inside
   the action (the parent keeps its value): `O` reverts and the thumb slides back to `[40]` with
   the slider still mounted, no `"dismiss"` step (controlled); a failure that escapes the action
   reaches the boundary and unmounts the slider as in 2.
5. **Keyboard, ArrowRight with the 800 ms save.** Native `input` → `onChange`: `step([41])`,
   `L=[41]`, `stepHeld=true`, `S=[41]` in the sync flush (react-dom's end-of-event restore
   writes `41` back, not `40`: without `stepHeld`, and with no step transition to hold `live`,
   it would restore `40` and Firefox would then fire no `change`); native `change` → `commit`:
   `stepHeld=false`, `O=[41]`, `P=true`.
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
12. **Stacked thumbs.** `defaultValue={[100, 100]}`, `max=100`. Thumb 1 is later in the DOM, so
    it is on top; the user presses it and drags left. The press is exactly on the shared value,
    so the gesture is undecided: Thumb 1 shows `data-dragging` and its input has focus, nothing
    steps. The first move, to 90, is below the value, so the first thumb of the stack is picked:
    `data-dragging` and focus move to Thumb 0, `step([90, 100])`, and the drag continues on it.
    (Were the pressed Thumb always the one moved, its bounds would be `[100, 100]`: nothing
    would move and nothing commit.)
13. **Horizontal RTL in Safari, ArrowLeft.** `keydown` on the input, whose computed
    `direction` is `rtl`: prevented; `step([41])` + `commit([41])` with the `keydown`; no
    native `input` / `change`. The thumb moves left, toward `max` on the left, as in Chrome and
    Firefox, where the native range would have done the same (and now also goes through the
    library).

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
  `BubbleInput`): a follow-up if consumer form-level listeners turn out to matter (product-owner
  item 8). Field, the first library listener, is served by the direct hook instead
  (`useFieldValueChange`, 9.4.4), so this stays out.
- **`<rangegroup>`** (Open UI, Chromium Intent to Prototype) and **`appearance: base` with
  `::slider-*`** (CSS Forms 1, Chromium flag only): both could replace the hidden inputs or the
  styled parts without changing the state API; revisit at Intent to Ship (research §7 item 9).
- **A directive-free JS-free slider** (a Server Component rendering `<input type="range">`):
  issue #19, resolved 2026-10-23 as a docs recipe, not a part (conventions 7.3).

---

## 14. Test plan

Moved to `design/CHANGELOG.md` (part "slider.md"). Not part of the contract: the code and the tests are the reference.

## 15. Implementation notes

Moved to `design/CHANGELOG.md` (part "slider.md"). Not part of the contract: the code and the tests are the reference.
