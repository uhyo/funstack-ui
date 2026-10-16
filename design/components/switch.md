# Switch

Status: **proposed** (2026-10-16, GitHub issue #27). Follows `design/conventions.md` (accepted);
where this document and the conventions disagree, the conventions win. The platform facts come
from `docs/research/form-controls.md` (binding); this document adds the probes recorded in
`memo/architect/switch-checkbox-notes.md` (react-dom 19.3.1 source reading and
`memo/architect/probes/checkbox-form-reset-ordering.mjs`).

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/form-controls.md`,
`docs/research/react-async-apis.md`, `design/components/toggle.md` (the sibling design: Switch is
to Toggle what `<input type="checkbox">` is to `<button aria-pressed>`), `design/components/accordion.md`
(mount reconciliation and the `"platform"` reason), WAI-ARIA APG "Switch" pattern, ARIA in HTML,
prior art (Base UI `Switch`, React Aria `Switch`, Radix `Switch`, Ark UI `Switch`).

Switch is the first **native form control** in the library and the home of the shared machinery
that Checkbox (`design/components/checkbox.md`) and RadioGroup reuse: a controlled native input
that renders the optimistic value, plus the two residual browser paths (mount reconciliation and
form reset). Read this document before the Checkbox one.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | One plain component, `Switch`, rendering `<input type="checkbox" role="switch">`. No `.Root`, no `Thumb`, no `Label`, no `Indicator`. The label is the consumer's `<label>`. |
| 2 | State | One library-owned state, `checked`: `checked` / `defaultChecked` / `checkedChangeAction(next, details)`. `details.reason` is `"activate"` or `"platform"`. |
| 3 | What the DOM shows | `checked={optimistic}` on the native input. This is a **correctness requirement**, not a style choice: react-dom restores a controlled input to its current props after every event, and only sync-lane (optimistic) state survives that restore (research section 2). |
| 4 | Residual browser paths | Pre-hydration clicks and Firefox form-state restoration (mount reconciliation) and **form reset**, including React's automatic reset after a successful `<form action>`. Both dispatch with `reason: "platform"` through the shared hook `useNativeChecked` (section 7). |
| 5 | Forms | Native participation for free: `name`, `value` (default `"on"`), `required`, `form`, `disabled`, `autoFocus` pass through. A Switch inside `<form action={serverFn}>` and a Switch with `checkedChangeAction={serverFn}` are two independent channels (section 9). The Switch never reads `useFormStatus`. |
| 6 | Next value | `next = !optimistic`, as in Toggle; equal to the DOM's post-click value in every supported case. |
| 7 | Disabled while pending | **No** (conventions 3.6). Native `disabled` only from the prop. |
| 8 | `preventDefault()` | Not a veto and **unsupported** on checkable inputs: it desyncs the DOM while the action is pending. Dev warning. Veto = controlled mode. |
| 9 | ViewTransition | `<ViewTransition default={transition ?? "none"}>` outermost; types `fsui-switch` plus `fsui-switch-on` / `fsui-switch-off`. Animates the settling of an action, never the optimistic flip (conventions 5.1). |
| 10 | ARIA | `role="switch"` on the input; the native `checked` state is the ARIA state. `aria-checked` is **owned and always removed** (forbidden on native inputs by ARIA in HTML). No key handling: native Space. |
| 11 | `render` | Must keep an `<input type="checkbox">`; `type`, `checked`, `role`, `onChange` and the state attributes are owned. Dev warning when the mounted node is anything else. |
| 12 | `switch` attribute | Not used (WebKit-only). Reserved as `experimental_switch` for when Chromium ships it. |
| 13 | Files | `src/switch/{index.ts,switch.tsx,switch.test.tsx,switch.browser.test.tsx}`, `src/internal/use-native-checked.ts`, `src/internal/use-form-reset.ts` (conventions 3.8). `switch.tsx` and both hooks are `"use client"`. Exports `Switch`, `SwitchProps`, `SwitchState`, `SwitchCheckedChangeDetails`. |

---

## 1. Anatomy

```
<ViewTransition default="none">                       React boundary, no DOM
  <input type="checkbox" role="switch" checked …>     the only element
```

Switch renders exactly one DOM element, a void one. As with Toggle, owner, trigger and the thing
that reflects state collapse onto it:

- owner: holds committed state, `useOptimistic`, `useTransition`;
- trigger: renders optimistic `checked`, gets `data-pending` on every dispatch;
- content region: none. The input has no children, so nothing inside it can suspend.

**Why no parts.** The alternatives were weighed against conventions 1.1 ("parts never render
wrapper elements the consumer did not ask for") and the research's two shapes (section 7 there):

| Shape | What it buys | What it costs |
| --- | --- | --- |
| A. `Switch` = the input (chosen) | One element; JS-free markup in its static form; styling with `appearance: none` + `::before` (verified in Blink and Gecko, long-standing in WebKit) or just `accent-color`; the consumer's own `<label>` gives the name and the hit area. | A React-element thumb or icon cannot live inside the input. |
| B. `Switch.Root` (`<label>`) + `Switch.Input` + `Switch.Thumb` | A sibling element with `data-checked` / `data-pending` for a React-rendered thumb. | Three parts and a context for what `label:has(:checked) .thumb` does in CSS today; a wrapper the consumer may not want (the label is often elsewhere in a settings row); `Thumb` would be the only part in the library whose state is a copy of a sibling's. |

A is chosen. Everything B offers is reachable without the library:

```tsx
<label className="row">
  <Switch name="wifi" className="sr-only-input" />
  <span className="track" aria-hidden><span className="thumb" /></span>
  Wi-Fi
</label>
```

```css
.row:has(:checked) .thumb { translate: 1em 0; }
.row:has([data-pending]) .track { opacity: .6; }
.row:has(:focus-visible) .track { outline: 2px solid var(--focus); }
.row:has(:disabled) { opacity: .5; }
```

(`.sr-only-input` is a visually-hidden clip, **not** `display: none` or `hidden`, which would
remove the input from focus and the accessibility tree.) When the thumb must be a React element
that reads `pending`, the function form of `render` may render siblings next to the input
(section 2.6). If a `Switch.Thumb` ever proves necessary it can be added without changing A: the
input stays the element that owns state and the thumb would read it through context.

There is no `Switch.Label` part either. `<label htmlFor>` and wrapping `<label>` are the platform's
label association, work before hydration, forward clicks to the input, and need no id wiring from
the library. `id` passes through.

## 2. Usage

### 2.1 Uncontrolled with an async action ("autosave on change")

```tsx
import { Switch } from "@funstack/ui/switch";

<label>
  <Switch
    defaultChecked={settings.notifications}
    checkedChangeAction={async (next) => {
      await api.updateSetting("notifications", next);
    }}
  />
  Email notifications
</label>
```

The switch flips the instant it is clicked (`:checked`, `data-checked`), shows `data-pending`
until the save resolves, then keeps the new value. If the save rejects, the switch flips back and
the error reaches the Error Boundary around it.

### 2.2 Uncontrolled with a Server Function (from a Server Component)

```tsx
// Server Component
import { Switch } from "@funstack/ui/switch";
import { updateSetting } from "./actions"; // "use server"; (key, next, details) => Promise<void>

<label>
  <Switch defaultChecked={settings.notifications} checkedChangeAction={updateSetting.bind(null, "notifications")} />
  Email notifications
</label>
```

`details` is serialisable and `details.event` is virtual (conventions 2.2), so the Server
Function receives `("notifications", true, { reason: "activate" })` with no wrapper.

### 2.3 Inside a form, no action (native submission)

```tsx
// Server Component
import { Switch } from "@funstack/ui/switch";
import { saveSettings } from "./actions"; // "use server"; (formData) => Promise<void>

<form action={saveSettings}>
  <label><Switch name="notifications" defaultChecked={settings.notifications} /> Email notifications</label>
  <label><Switch name="digest" value="weekly" defaultChecked={settings.digest} /> Weekly digest</label>
  <button type="submit">Save</button>
</form>
```

Nothing but the native input is involved: the form posts `notifications=on&digest=weekly` for
checked switches and omits unchecked ones, `useFormStatus().pending` covers the submit, and after
the action succeeds React resets the form, which the Switch follows (section 6.6). Before
hydration the switches already work.

### 2.4 Controlled, local state

```tsx
const [airplane, setAirplane] = useState(false);

<label>
  <Switch checked={airplane} checkedChangeAction={(next) => { setAirplane(next); }} />
  Airplane mode
</label>
```

### 2.5 Controlled, server-backed ("update on success")

```tsx
const [enabled, setEnabled] = useState(feature.enabled);

<Switch
  aria-label="Enable beta features"
  checked={enabled}
  checkedChangeAction={async (next) => {
    await api.setFeature(feature.id, next);
    startTransition(() => setEnabled(next)); // required after an await (conventions 2.3 #4)
  }}
/>
```

The parent writes only on success, so a rejected save leaves `enabled` unchanged and the
optimistic flip reverts. Controlled twin of 2.1; section 11 tests the parity.

Caveat (conventions 2.5): the latest-intent guard protects uncontrolled state only. Two rapid
clicks whose saves complete in the opposite order leave this parent with the *older* intent,
because each `setEnabled(next)` is a whole-value write landing in completion order. A parent
that must survive overlap writes functionally against what the action changed, or keeps a
sequence number and ignores stale completions:

```tsx
const seq = useRef(0);
checkedChangeAction={async (next) => {
  const id = ++seq.current;
  await api.setFeature(feature.id, next);
  if (id === seq.current) startTransition(() => setEnabled(next));
}}
```

### 2.6 Function props and `render`

```tsx
<Switch
  checkedChangeAction={save}
  className={({ checked, pending }) => clsx("switch", checked && "switch-on", pending && "switch-busy")}
/>

// Element form: a design-system input. MyInput must accept `ref` and spread onto an <input>.
<Switch checkedChangeAction={save} render={<MyInput size="lg" />} />

// Function form: siblings next to the input (the input must be rendered with `props` spread).
<Switch
  checkedChangeAction={save}
  render={(props, state) => (
    <>
      <input {...props} />
      <span className="thumb" aria-hidden>{state.pending ? <Spinner /> : null}</span>
    </>
  )}
/>
```

There is no `children` prop: the element is void.

### 2.7 Styling the input itself

```css
/* Minimal: recolour the native control. */
.switch { accent-color: var(--accent); }

/* Headless: the input is the track, ::before is the thumb. Works in Blink, Gecko and WebKit. */
.switch {
  appearance: none;
  inline-size: 2.5em; block-size: 1.5em; border-radius: 1em;
  background: var(--track-off);
  transition: background-color 120ms;
}
.switch::before {
  content: ""; display: block; inline-size: 1.25em; block-size: 1.25em; margin: .125em;
  border-radius: 50%; background: white;
  transition: translate 120ms;
}
.switch:checked { background: var(--track-on); }
.switch:checked::before { translate: 1em 0; }
.switch[data-pending] { cursor: progress; }
.switch:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.switch:disabled { opacity: .5; }
.switch:user-invalid { outline-color: var(--danger); }
```

`:checked` and `[data-checked]` always agree (the DOM state *is* the optimistic state); the
data attribute exists so selectors look the same across components and so wrapper parts can use
`:has([data-checked])`. Tailwind: `checked:bg-accent data-pending:animate-pulse`.

### 2.8 `transition`

```tsx
<Switch checkedChangeAction={save} transition="fsui-fade" />
```

As on Toggle (its section 7), `<ViewTransition>` animates the commit that **ends** the action
(`data-pending` leaving, a controlled snap-back, content the parent changes in the same
transition), not the optimistic flip, which is a sync-lane commit. The flip is a CSS `transition`
on `:checked` as in 2.7. Every `transition` example carries the reduced-motion block from
conventions 5.4.

---

## 3. Props

```ts
// packages/ui/src/switch/switch.tsx
import type { ComponentPropsWithRef, CSSProperties, ViewTransitionClass } from "react";
import type { ActionDetails, ChangeAction, ChangeReason, RenderProp, StateValue } from "../internal/types.js";

export interface SwitchState {
  /** Optimistic checked state: what the user sees, including an in-flight change. */
  readonly checked: boolean;
  /** An action dispatched by this Switch is in flight (including the resulting render). */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/** Details passed as the second argument of `checkedChangeAction`. */
export interface SwitchCheckedChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user toggled the switch (click, Space, label click); `event` is the native
   * `click` event. `"platform"`: the browser changed the value itself: a form reset (`event` is
   * the `reset` event) or a click before hydration / Firefox form-state restoration found on
   * mount (`event` is `undefined`).
   */
  readonly reason: ChangeReason;
}

export interface SwitchProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    | "type" | "role" | "checked" | "defaultChecked" | "onChange" | "aria-checked"
    | "className" | "style" | "children"
  > {
  /** Controlled checked state. `undefined` means uncontrolled. */
  checked?: boolean;
  /**
   * Initial checked state in uncontrolled mode (default `false`). Also the value a form reset
   * returns to: the latest prop value is mirrored into the input's `defaultChecked`.
   */
  defaultChecked?: boolean;
  /**
   * Called with the next checked state on every change. Runs inside the Switch's transition; may
   * be sync or async (also a Server Function). Rejections reach the nearest Error Boundary.
   * Also called with `details.reason === "platform"` for a form reset or a pre-hydration click.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  checkedChangeAction?: ChangeAction<boolean, SwitchCheckedChangeDetails>;
  /** Renders a natively disabled input; never dispatches. Default `false`. */
  disabled?: boolean;
  /** Submitted as the input's value when checked. Default `"on"` (platform). */
  value?: string;
  /**
   * Forwarded as `default` to the Switch's `<ViewTransition>`. Default `"none"`. Animates the
   * commit that ends an action, not the optimistic flip; animate the flip with CSS on `:checked`.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, SwitchState>;
  style?: StateValue<CSSProperties | undefined, SwitchState>;
  /** Replace the rendered element (element form) or take over rendering (function form). Must keep an `<input type="checkbox">`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, SwitchState>;
}
```

Omissions from the native prop set:

| Omitted | Why |
| --- | --- |
| `type` | Always `"checkbox"`; owned. |
| `role` | Always `"switch"`; owned. |
| `checked`, `defaultChecked` | Re-declared as the controllable triple. The DOM `checked` is `optimistic`; the DOM `defaultChecked` is managed by the hook (section 7). |
| `onChange` | The library's own handler (conventions 1.5). React drives it from the native `click`, so `details.event` is a `PointerEvent`/`MouseEvent` for mouse, keyboard and label activation alike. |
| `aria-checked` | Forbidden on native inputs (ARIA in HTML); owned with value `undefined` so a `render` element cannot add it. `Omit` cannot exclude a hyphenated prop at the type level (Toggle row 3); the runtime removal is the guarantee. |
| `children` | Void element. |
| `className`, `style` | Re-declared with the function-of-state form. |

Everything else on `<input>` passes through: `id`, `name`, `value`, `required`, `form`,
`autoFocus`, `aria-label`, `aria-labelledby`, `aria-describedby`, `onClick`, `onBlur`,
`onInput`, `onInvalid`, `title`, and so on. `onClick` passes through because the library does not
use it; a consumer `onClick` that calls `preventDefault()` runs before the library's `onChange`,
so the click is an **already-cancelled click**: no dispatch, no warning, and the browser reverts
the DOM after dispatch (conventions 2.3 item 3). Only a `preventDefault()` *inside the action*
desyncs and warns (section 6.7). `readOnly` passes through but has no effect on checkable inputs
(platform).

`checked` and `defaultChecked` both set, or `checked` flipping between `undefined` and a boolean
after mount, log a dev warning (shared hook, conventions 3.1). `defaultChecked` is read once for
the initial value; later values only move the reset target (section 6.6).

---

## 4. States

| State | Kind | Owner | Shown as | Source |
| --- | --- | --- | --- | --- |
| `checked` | library-owned, with residual browser paths (mount, form reset) | Switch | DOM `checked` (hence `:checked` and the ARIA state), `data-checked`, `state.checked` | **optimistic** (`useOptimistic(committed, (_, next) => next)`) |
| `pending` | library-owned | Switch | `data-pending`, `state.pending` | `useTransition()` of this Switch |
| `disabled` | prop | Switch | `disabled` attribute, `data-disabled`, `state.disabled`, `:disabled` | prop |

Attribute emission, exactly:

```tsx
<input
  type="checkbox"
  role="switch"
  checked={optimistic}                        // the DOM state is the optimistic state
  disabled={disabled}
  data-checked={optimistic ? "" : undefined}  // presence form (conventions 4.1)
  data-pending={pending ? "" : undefined}
  data-disabled={disabled ? "" : undefined}
/>
```

Pseudo-class equivalents (conventions 4.2), documented next to each attribute:

| Attribute | Pseudo-class | Difference |
| --- | --- | --- |
| `data-checked` | `:checked` | None, except during the unsupported `preventDefault()` misuse (6.7). Wrappers use `:has(:checked)`. |
| `data-disabled` | `:disabled` | Only the pseudo-class sees `<fieldset disabled>` inheritance; `data-disabled` reflects the prop only. |
| `data-pending` | – | Library-only. |
| – | `:focus-visible`, `:hover`, `:active` | Platform (conventions 4.2). |
| – | `:required`, `:user-invalid`, `:user-valid` | Platform validity; no attribute. |

Why the DOM shows optimistic state, in one paragraph (research section 2, verified in jsdom,
Chromium and Firefox): at the end of every event batch react-dom runs `flushSyncWork()` and then
`restoreStateOfTarget()`, which writes the fiber's current `checked` prop back to the input. A
Switch whose `checked` prop were driven by committed (transition-lane) state would be written back
to the **old** value right after the click, and with an async action would stay old until the
transition commits. `useOptimistic` renders at sync priority, so it is flushed before the restore
and the restore writes the new value. Conventions 3.2's rule ("trigger parts render optimistic
state") is therefore a correctness requirement for every native checkable input.

---

## 5. Keyboard and ARIA

APG pattern: Switch, "HTML checkbox input" variant.

| Interaction | Behaviour | Provided by |
| --- | --- | --- |
| Space | Toggles (on key**up**); dispatches `"activate"` | native `<input type="checkbox">` |
| Enter | Does nothing to the value (APG lists Enter as optional for switches; the native input does not toggle on it). Implicit form submission is the platform's business. | native |
| Click / tap, click on the associated `<label>` | Toggles; dispatches `"activate"` | native |
| Tab | Focusable unless `disabled` | native |

The library installs no `onKeyDown`. Every activation path arrives as a `click` event (React's
`onChange` for checkable inputs is derived from `click`), so `details.event.type === "click"`.

ARIA:

- `role="switch"` on `<input type="checkbox">` is allowed by ARIA in HTML and listed in the APG;
  Chromium exposes it as `switch` with `checked` (research probe 06). Screen readers say "on/off"
  or "checked/not checked" depending on the product; both are acceptable and identical for the
  `<button role="switch">` alternative.
- **`aria-checked` is never set.** ARIA in HTML forbids it on native inputs, and Chromium ignores
  it there anyway. The native `checked` state is what AT reads, and it is the optimistic value,
  so AT hears the flip immediately (unlike Accordion's `<summary>`, there is no platform-forced
  exception here).
- The accessible name comes from the consumer's `<label>` or `aria-label`/`aria-labelledby`.
  It must not change with `checked`: the state is already conveyed. The docs model this.
- `disabled` uses the native attribute (APG allows it; a switch is not a composite widget).
- `required` and validity are native: `:user-invalid` after a submit attempt. Chromium flags an
  unchecked required checkbox as invalid in the accessibility tree before any interaction
  (research section 3); platform behaviour, noted for AT testing.

---

## 6. Behaviour

### 6.1 Dispatch

On `onChange` (that is, on the native `click` the browser already used to flip the input), unless
`disabled`:

```ts
const next = !optimistic;
dispatch(next, createActionDetails(event.nativeEvent, { reason: "activate" }));
```

`next` is computed from the optimistic value, as in Toggle 6.1, so a second click while pending
reverses the first. It equals `event.currentTarget.checked` (the DOM's post-flip value) in every
supported case, because React restored the DOM to `optimistic` at the end of the previous event.

Every click changes the value, so every click dispatches. The one exception is `disabled`: a
natively disabled input fires no `click`, and the handler guards anyway for `render` elements that
do not honour `disabled`.

### 6.2 Sequence: sync action

```
click (browser flips DOM: checked=true)
  ├─ React onChange → dispatch: transition starts; optimistic := true; action(true, details) returns
  │  flushSyncWork → sync-lane commit:   checked=true data-checked data-pending
  │  restoreStateOfTarget → el.checked = true  (writes the optimistic value: no-op)
  └─ action resolved; setInternal(true) in a nested transition
     transition-lane commit:            checked=true data-checked              (data-pending gone)
```

### 6.3 Sequence: async action that resolves

```
click → DOM checked=true → onChange → dispatch
  ├─ sync-lane commit + restore:   checked=true data-checked data-pending      (immediately)
  │  ... promise pending; the switch shows "on" with a pending marker ...
  └─ resolve → setInternal(true)
     transition-lane commit:        checked=true data-checked                   (pending gone)
```

### 6.4 Sequence: async action that rejects (DOM rolls back)

```
click → DOM checked=true → onChange → dispatch
  ├─ sync-lane commit + restore:   checked=true data-checked data-pending
  └─ reject
     ├─ optimistic reverts to committed (false); the next render passes checked={false}
     │  and react-dom writes el.checked = false: the DOM rolls back with the state
     └─ the error propagates to the nearest Error Boundary above <Switch>
```

A boundary that wraps only the Switch replaces it with the fallback, so the rolled-back switch
is usually never seen. Consumers who want the switch to stay mounted and flip back catch inside
the action, which turns the rejection into success for the library; in uncontrolled mode that
**commits** the new value (conventions 2.4), so "to veto, be controlled":

```tsx
<Switch
  checked={enabled}
  checkedChangeAction={async (next) => {
    try {
      await api.setFeature(id, next);
      startTransition(() => setEnabled(next));
    } catch (e) {
      startTransition(() => setError(e)); // `enabled` unchanged → optimistic reverts → DOM follows
    }
  }}
/>
```

### 6.5 Sequence: two overlapping clicks (latest wins)

```
click 1 (DOM true;  optimistic false→true)   action(true)   id=1
click 2 (DOM false; optimistic true→false)   action(false)  id=2   ← next from optimistic
   ...both pending; the switch shows off + data-pending...
action 2 resolves → id === latest → setInternal(false) queued (held while 1 is pending)
action 1 resolves → id !== latest → write skipped
single transition-lane commit:   checked=false, pending gone
```

Same properties as Toggle 6.5: the action is called once per click in click order; `data-pending`
lasts until all in-flight actions settle; both dispatches' types land on the final commit; a
superseded rejection is surfaced by the shared hook (conventions 2.4).

### 6.6 Sequence: form reset (residual browser path)

`form.reset()` restores every input to its `defaultChecked`. For a controlled native input React
freezes `el.defaultChecked` at the mount-time `checked` (`updateInput` writes `defaultChecked`
only when `checked == null`, verified in 19.3.1) and never re-syncs state after a reset, including
its own automatic reset after a successful `<form action>` (`requestFormReset`, run in the commit's
mutation phase). Without handling, DOM and library state desync (research probe 07).

The shared hook (section 7) listens to `reset` on the input's form owner. The listener fires
**before** the reset algorithm; the hook defers to a microtask, after the reset (and after the
commit, when the reset is React's), and then:

```
reset event (listener runs; DOM not yet reset)
  └─ microtask:
       if event.defaultPrevented → nothing (another listener cancelled the reset)
       next := el.defaultChecked            // the value the browser just reset to
       base := latestInFlight()?.next ?? optimistic
       next === base → ensure el.checked === base; done
       else → dispatch(next, { reason: "platform", event: resetEvent })
            → sync-lane commit: checked=next data-pending; DOM already shows next
            → action settles → uncontrolled: commit next; controlled: parent accepts or refuses
            → settle commit: React writes checked={optimistic}; DOM follows the decision
```

What `el.defaultChecked` is, by mode:

| Mode | `el.defaultChecked` | So a reset returns to |
| --- | --- | --- |
| Uncontrolled | Kept equal to the **latest `defaultChecked` prop** (`?? false`) by the hook's layout effect. React does the same for a plain uncontrolled `<input defaultChecked>`. | The current default. After a successful `<form action>` whose Server Component re-renders with new data, the Switch shows the new data, as a plain input would (probe 3 in the notes verifies the ordering: browser resets to the old default in the mutation phase, the layout effect then syncs both properties, the microtask reads the new one). |
| Controlled | Left at React's mount-time value. The parent's idea of "default" is unknowable. | The mount-time value, **offered to the parent** as a `"platform"` dispatch (`event.type === "reset"`). The parent accepts by adopting it or refuses by not updating; after settle the DOM follows the parent. |

Observable behaviour: an uncontrolled Switch in a form behaves exactly like a native checkbox
(reset button, automatic reset after submit), with `checkedChangeAction` told about it. A
controlled Switch is never silently desynced: the parent hears about the reset and decides.
The alternative for controlled mode, ignoring resets entirely ("React state wins", which is what
React itself intends for controlled inputs), is listed as question 1 for the product owner.

### 6.7 Sequence: `preventDefault()` (unsupported)

With `checked={optimistic}`, calling `details.event.preventDefault()` in the action's sync prefix
yields the sequence below. (A pass-through `onClick` that cancels the click is a different case:
it runs *before* the library's `onChange`, so the guard sees an already-cancelled click and does
not dispatch at all, conventions 2.3 item 3.)

```
click → DOM true → onChange → dispatch → sync-lane commit + restore: el.checked = true
  └─ browser's canceled-activation step: el.checked = false       (after React's listener)
     DOM says off, optimistic / data-checked / AT say on, for as long as the action is pending
     → action settles → next commit re-applies optimistic → in sync again
```

Verified in jsdom, Chromium and Firefox (research section 2); a microtask fix does not work
for real clicks. So: **`preventDefault()` is not a veto and is unsupported on Switch and
Checkbox.** In development the handler checks `event.nativeEvent.defaultPrevented` after the
dispatch and logs once per instance: "Switch: `preventDefault()` on the change event is not
supported; it desyncs the input while the action is pending. Use controlled mode to veto a
change." The hook's re-apply effect (section 7) limits the damage to the pending window.

### 6.8 Sequence: click before hydration (mount reconciliation)

SSR renders `<input type="checkbox" role="switch">` (with `checked=""` when the initial value is
true). A click before hydration flips the DOM natively. `hydrateRoot` keeps the DOM's `checked`
(`initInput`: `element.checked = isHydrating ? element.checked : !!checked`), fires no `onChange`
and logs no mismatch (`diffHydratedProperties` skips `checked`; no `suppressHydrationWarning`
needed). Firefox's form-state restoration on reload arrives the same way.

```
hydration commit (checked prop false, DOM true)
  └─ hook's mount layout effect:
       base := latestInFlight()?.next ?? optimistic   (false)
       el.checked (true) !== base → dispatch(true, { reason: "platform", event: undefined })
       → sync-lane commit: checked=true data-checked data-pending
       → action settles → uncontrolled commits true; controlled parent decides; DOM follows
```

One dispatch per Switch, once per mount; the StrictMode re-run of the effect sees
`latestInFlight().next === el.checked` and does nothing. A Switch rendered by `createRoot` (no
hydration) never dispatches here: `initInput` writes `el.checked` from the prop.

### 6.9 Other edge cases

| Case | Behaviour |
| --- | --- |
| `checked` prop changes externally while an action is pending | Optimistic rebases and still shows `next`; after settle the Switch shows whatever `checked` is then; React writes the DOM. |
| Controlled parent never updates `checked` (veto) | After settle the switch snaps back; React writes `el.checked = checked`. Snap-back commit animates if `transition` is set (no `fsui-*` types). |
| Controlled parent updates after `await` without `startTransition` | Value right; the update is urgent and not held with the action (post-await rule). |
| Switch unmounts while pending | Action keeps running; the post-await write is ignored; the hook's listeners are removed by effect cleanup. |
| The input is moved to another form or its `form` attribute changes | The hook re-checks the form owner after every commit and moves the `reset` listener. |
| Another `reset` listener cancels the event | No reset happens; the hook sees `defaultPrevented` and does nothing. |
| `name` absent | Not submitted; everything else works (a Switch outside a form is the common autosave case). |
| `value` absent | Submitted as `"on"` (platform). |
| `<fieldset disabled>` ancestor | Natively disabled (`:disabled`, no `click`), but `data-disabled` and `state.disabled` reflect the prop only. Documented; the library does not walk ancestors. |
| `render` element is not an `<input type="checkbox">` | Dev warning from the hook's ref callback; behaviour undefined. |
| StrictMode | Effects double-run: mount reconciliation deduplicated via `latestInFlight`; the reset subscription is re-attached (stable deps). |

---

## 7. Shared internal: `useNativeChecked` (conventions 3.8)

The native-input machinery is specified once in conventions 3.8 as three hooks: `useFormReset`
(stable `reset` subscription on a form owner), `useNativeChecked` (per `<input>`), and
`useNativeGroupReconciliation` (per fieldset Root). Switch, a single control, uses
`useNativeChecked` alone; its residual paths are reported by the hook itself. RadioGroup items use
the same hook with `group: true` and let their Root report once per group. This section records
the per-element hook's options and the behaviour Switch relies on; the rules themselves
(base comparison, stable subscription, `defaultChecked` read, reset target by mode, click guard)
are conventions 3.8 rules 1 to 9 and are not restated.

```ts
// packages/ui/src/internal/use-native-checked.ts
"use client";
import type { RefCallback } from "react";

export interface UseNativeCheckedOptions {
  /** Dev-only: expected `input.type` and the name used in warnings. */
  readonly type: "checkbox" | "radio";
  readonly component: string;
  /** What the DOM must show after every commit: the optimistic value. */
  readonly checked: boolean;
  /**
   * The form-reset target. Uncontrolled parts pass the latest `defaultChecked` prop (`?? false`),
   * mirrored into `el.defaultChecked` after every commit. Controlled parts pass `undefined`:
   * React's mount-time value stays. (Conventions 3.8 rule 6.)
   */
  readonly defaultChecked: boolean | undefined;
  /** Checkbox only: `el.indeterminate` after every commit (the part passes `indeterminate && !pending`). */
  readonly indeterminate?: boolean;
  /**
   * `true` inside a group (`RadioGroup.Item`): the hook does the tag check and the re-apply only;
   * mount reconciliation and form reset are reported once per group by the Root through
   * `useNativeGroupReconciliation`. Default `false`: the hook reports both paths itself.
   */
  readonly group?: boolean;
  /** From `useControllableAction`: the value the DOM is compared against on the residual paths. */
  readonly latestInFlight?: () => { readonly next: boolean } | null;
  /**
   * Single controls only. The browser changed the value on a residual path and it differs from
   * what the user intends. `event` is the `reset` event, or `undefined` for mount reconciliation.
   * The part dispatches with `reason: "platform"`.
   */
  readonly onPlatformChange?: (next: boolean, event: Event | undefined) => void;
}

/** Returns the ref to attach to the input (merged by `useRender`). */
export function useNativeChecked(options: UseNativeCheckedOptions): RefCallback<HTMLInputElement>;

/**
 * Shared `onChange` guard (conventions 3.8 rule 9): no dispatch when the click is already
 * cancelled; otherwise dispatch, then warn once per instance in development if the action's sync
 * prefix (or a pass-through `onClick`) called `preventDefault()`.
 */
export function guardCheckableChange(event: Event, dispatch: () => void, componentName?: string): void;
```

Behaviour, in order of declaration (effects run in declaration order):

1. **Ref callback.** Stores the node. In development, warns once when the node is not an
   `HTMLInputElement` whose `type` equals `options.type` ("Switch: expected to render an
   `<input type="checkbox">` but got …; the platform semantics need a real input"). Returns a
   cleanup that clears the node.
2. **Mount reconciliation** (single controls; `useLayoutEffect`, `[]`): `base =
   latestInFlight()?.next ?? checked`; if `el.checked !== base`, call
   `onPlatformChange(el.checked, undefined)`. Runs before the re-apply effect so the
   pre-hydration value is read before it is overwritten.
3. **Re-apply after every commit** (`useLayoutEffect`, no deps; all parts), in this order:
   `if (defaultChecked !== undefined) el.defaultChecked = defaultChecked;` first, because writing
   the default can move `checked` on an input still at its default; then
   `want = latestInFlight()?.next ?? checked; if (el.checked !== want) el.checked = want;` then
   `if (indeterminate !== undefined) el.indeterminate = indeterminate;`. Skipped for `checked` in
   the mount commit (conventions 3.8 rule 3). Programmatic property writes fire no events.
4. **Form reset** (single controls; `useFormReset(ref, onReset)`): in the microtask,
   `next = el.defaultChecked; base = latestInFlight()?.next ?? checked;` if `next !== base` call
   `onPlatformChange(next, event)`, else `if (el.checked !== base) el.checked = base`.

The hook does not know about transitions, `reason` values or dispatch; the part wires
`onPlatformChange` to `dispatch(next, createActionDetails(event, { reason: "platform" }))`.

---

## 8. ViewTransition

```tsx
return (
  <ViewTransition default={transition ?? "none"}>
    {element /* the <input> */}
  </ViewTransition>
);
```

Types added on every dispatch (`"activate"` and `"platform"` alike): `fsui-switch` and
`fsui-switch-on` (`next === true`) or `fsui-switch-off` (`next === false`), per conventions 5.3;
the platform's words for a switch are on/off, where Toggle's are press/release.

What animates is exactly Toggle's table (its 7.2): the settling commit, a controlled snap-back
(no types), a boundary swap (no types); never the optimistic flip. The product-owner decision that
`transition` stays on Toggle (conventions 5.1) applies unchanged: the prop costs nothing when
unset and keeps the "every animatable part" rule without exceptions. Honest expectation setting
in the docs: on a bare input the visible effect of `transition` is limited to cross-fading the
input's own rendering when `data-pending` leaves; the `render` function form with siblings (2.6)
is where it does visible work.

---

## 9. Server Components and forms

`switch.tsx` is a `"use client"` file. A Server Component may render `<Switch>` with
serialisable props and a Server Function as `checkedChangeAction` (2.2), or inside
`<form action={serverFn}>` with `name` (2.3). The two channels are **independent** (research
section 5):

| | `checkedChangeAction={serverFn}` | `<form action={serverFn}>` + `name` |
| --- | --- | --- |
| Runs | Per change, in the Switch's own transition | On submit, in the form's transition |
| Pending | `data-pending` on the Switch | `useFormStatus().pending` in the form's subtree; the Switch shows nothing |
| Receives | `(next, details)`; `details.event === undefined` | `FormData` with `name=value` for checked switches |
| Rollback | Optimistic reverts on rejection | n/a (native submission) |
| Reset | n/a | React resets the form after success; the Switch follows (6.6) |

Both at once is allowed and does not couple them: a Switch with an action inside a form posts
with the form **and** autosaves on change; while the form action is pending the Switch's
transition is entangled with it (conventions 2.3 #5), and vice versa. The Switch never reads
`useFormStatus` into its own `pending`: that would mark every control pending during a submit.
Consumers who want that styling use `form:has(…)` or `useFormStatus` in their own `className`
function. "Submit on change" is `checkedChangeAction={() => formRef.current?.requestSubmit()}`.

A **static** Switch (no action props, no `checked`) in a Server Component is a working native
input before hydration and with JS off; it still hydrates to a client module (the file carries
the directive). A directive-free variant is a candidate for issue #19 (research section 8 item 7).

---

## 10. Out of scope (recorded, not designed)

- **`experimental_switch`**: renders the lowercase `switch` attribute (`<input type="checkbox"
  switch>`) for native switch rendering. WebKit 17.4 only; Chromium has an Intent to Prototype
  (2026-07) and no milestone; Gecko no signal. Added as a prop on `Switch` when Chromium ships,
  per conventions 8; the attribute changes only default rendering, which headless consumers
  replace anyway. The platform-attributes augmentation does not list `switch` yet; it is added
  together with the prop, since nothing renders the attribute until then (conventions 7.4).
- **`indeterminate`**: never for Switch (MDN: `:indeterminate` never matches a switch; a switch
  is binary). Checkbox has it.
- **`Switch.Thumb` / `Switch.Label`**: see section 1; added only if CSS `:has()` and the `render`
  function form prove insufficient in practice.
- **Group of switches**: consumer `<fieldset>` + `<legend>`; no library part.
- **`errorAction`**: none in v0 (conventions 2.4).

---

## 11. Test plan (`src/switch/switch.test.tsx`, `switch.browser.test.tsx`)

Rows marked (both) run under `describe.each` over the uncontrolled wrapper and the controlled
"update on success" wrapper from `renderBoth`. Interactions go through `user-event`; assertions
are on the DOM only. jsdom unless the Env column says browser; jsdom implements label activation,
`form.reset()`, the `reset` event, `:checked` in `matches()`, and the event order the research
verified (probe 04), so most rows stay there.

| # | Area | Env | Test |
| --- | --- | --- | --- |
| 1 | Roles and ARIA | jsdom | Renders `<input type="checkbox" role="switch">`, `checked` false; `defaultChecked` renders `checked` true; `aria-checked` is never present, including when passed through props or a `render` element (`toHaveAttribute("aria-checked")` false). |
| 2 | Roles and ARIA | jsdom | `data-checked`, `data-pending`, `data-disabled` absent when false and `""` when true; `disabled` renders the native attribute; `name`, `value`, `required`, `form`, `id`, `aria-label`, `onBlur` pass through; `type="radio"` through props/render is overridden. |
| 3 | Roles and ARIA | jsdom | `<label htmlFor>` and a wrapping `<label>` name the input (`getByLabelText`) and clicking the label dispatches once. |
| 4 | Keyboard | jsdom | Focus, Space: dispatches `(true, details)` with `details.event.type === "click"` and `details.reason === "activate"`; Enter does not dispatch. |
| 4b | Keyboard | browser | Same Space row in Chromium, Firefox and WebKit with the engine's real activation (jsdom and user-event both synthesise it). |
| 5 | Keyboard | jsdom | Disabled input is not focusable and Space does not dispatch. |
| 6 | Sync action (both) | jsdom | Click calls `checkedChangeAction` once with `(true, details)`; `details.event instanceof window.Event` asserted via `details.event`, never `toEqual`; `details.reason === "activate"`; after `act`, `checked` true, no `data-pending`. Second click dispatches `false`. |
| 7 | Sync action (both) | jsdom | `disabled` never dispatches, even when clicked programmatically through `ref`. |
| 8 | Async action (both) | jsdom | With `deferred`: immediately after click `el.checked === true`, `data-checked=""`, `expectPending`; a sibling reading the wrapper's committed value still shows the old value. After `resolve()`: `expectNotPending`, `checked` true, sibling updated. |
| 9 | Rejection (both) | jsdom | `reject(err)` inside `<ErrorCatcher>`: the catcher records `err`; the wrapper's committed value is unchanged. Variant with the boundary above the wrapper's sibling display: the sibling still shows the old value. |
| 9b | Rejection, DOM rollback | jsdom | Controlled wrapper that catches inside the action and does not update: after `reject`, `el.checked === false`, `data-checked` absent, no `data-pending`, Switch still mounted. |
| 10 | Rejection (both) | jsdom | Caught-inside variant: uncontrolled commits `true`; controlled veto wrapper ends with `checked` false. |
| 11 | Overlap | jsdom | Two clicks, two deferreds: action receives `true` then `false`; during flight `el.checked === false` and pending. Resolve 2 then 1, and 1 then 2: final `false`, not pending. |
| 12 | Overlap | jsdom | After resolving only the second deferred, `data-pending` is still present. |
| 12a | Superseded rejection (both) | jsdom | Resolve 2, then reject 1: `<ErrorCatcher>` records the error; committed value `false`. |
| 12b | Superseded rejection (both) | jsdom | Reject 1 while 2 is pending: recorded; resolving 2 afterwards does not throw again. |
| 13 | Suspending content (both) | jsdom | Wrapper renders `<Suspender key={value}>` under a `<Suspense fallback>` above the Switch. Click: old content stays, no fallback, `data-pending` on. Resolve: new content, pending gone. |
| 14 | Function props | jsdom | `className`, `style`, `render` receive `{ checked, pending, disabled }`; while pending they see `checked: true, pending: true` and the attributes agree. |
| 15 | `render` element | jsdom | `render={<MyInput className="x" style={{…}} />}` renders MyInput's input, merges class, keeps the element's style, forwards `ref`, keeps `type="checkbox"` and `role="switch"`, and clicking still dispatches. A `render` element with `checked`, `defaultChecked` or `aria-checked` has them removed. |
| 16 | `render` function | jsdom | Function form receives `(props, state)`; rendering `<><input {...props}/><span/></>` works and the sibling can read `state.pending`. Rendering a `<button>` logs the dev warning. |
| 17 | Post-await rule | jsdom | Controlled parent that `await`s then `startTransition(() => setChecked(next))`: `checked` and `data-pending` converge in one state. |
| 18 | `transition` prop | jsdom | Renders identically with `transition` unset, `"fsui-fade"`, and a type map (wiring only). |
| 19 | Dev warnings | jsdom | `checked` with `defaultChecked` warns once; mode switch warns once; `preventDefault()` in the action's sync prefix warns once and leaves `el.checked === false` while pending (documents the desync), in sync after settle; a pass-through `onClick` that cancels the click neither dispatches nor warns (row 26). |
| 20 | Platform: form reset (both) | jsdom | Inside `<form>` with `<button type="reset">`: after a click (committed `true`), reset → action called with `(false, { reason: "platform" })`, `details.event.type === "reset"`; uncontrolled: `el.checked` false after settle; controlled parent that refuses: `el.checked` true again after settle; parent that accepts: false. A listener that cancels `reset` → no dispatch, DOM unchanged. |
| 21 | Platform: React automatic reset | jsdom | `<form action={async () => {}}>` containing an uncontrolled Switch with no action: click (true), submit; after the action resolves the DOM and `data-checked` are back to `defaultChecked` (false) with no desync. Variant: the parent re-renders with `defaultChecked={true}` inside the action's transition → the Switch ends `checked` true (reset target follows the latest prop). |
| 21b | Platform: React automatic reset | browser | Row 21's first variant in all three engines (`requestFormReset` goes through the engine's `form.reset()`). |
| 22 | Platform: pre-hydration click | jsdom | `renderToString` markup, flip `el.checked` before `hydrateRoot`: one dispatch `(true, { reason: "platform" })` with `details.event === undefined`, no hydration warning (console spy), uncontrolled commits `true`; controlled parent that refuses → `el.checked` false after settle. `createRoot` variant never dispatches on mount. |
| 23 | `details.event` is virtual | jsdom | Toggle row 21 verbatim, plus `JSON.stringify(details) === '{"reason":"activate"}'`. |
| 24 | Forms | jsdom | `new FormData(form)` has `name=on` when checked and nothing when unchecked; `value="weekly"` posts `weekly`; `required` unchecked → `form.checkValidity()` false and `:invalid` matches. |
| 25 | Directive | build | `dist/switch/switch.mjs`, `dist/internal/use-native-checked.mjs` and `dist/internal/use-form-reset.mjs` start with `"use client"`; `dist/switch/index.mjs` does not. |
| 26 | Sync action (both) | jsdom | A pass-through `onClick` that calls `preventDefault()`: no dispatch, `el.checked` back to the old value after the click, no warning about the action (conventions 2.3 item 3). |

Not automated, covered by the research's probes and the example app: the accessibility-tree role
(`switch`, probe 06), Firefox form-state restoration on reload, `appearance: none` rendering,
ViewTransition behaviour.

---

## 12. Implementation notes

### 12.1 Files

```
packages/ui/src/internal/
  use-form-reset.ts            # "use client" (conventions 3.8); stable reset subscription on a form owner
  use-native-checked.ts        # "use client" (section 7); per input, shared with Checkbox and RadioGroup.Item
packages/ui/src/switch/
  index.ts                     # no directive: export { Switch } and the three types
  switch.tsx                   # "use client"
  switch.test.tsx
  switch.browser.test.tsx      # rows 4b, 21b
```

`index.ts` imports `../internal/platform-attributes.js` for side effects like the other
subpaths, exports `Switch`, `SwitchProps`, `SwitchState`, `SwitchCheckedChangeDetails`. The root
`src/index.ts` re-exports the same; `tsdown.config.ts` gains `"src/switch/index.ts"`.

### 12.2 Component sketch

```tsx
"use client";
import { ViewTransition } from "react";
import type { ChangeEvent, ComponentPropsWithRef } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { transitionTypes } from "../internal/transition-types.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { guardCheckableChange, useNativeChecked } from "../internal/use-native-checked.js";
import { useRender } from "../internal/use-render.js";

export function Switch({
  checked, defaultChecked, checkedChangeAction, disabled = false, transition,
  className, style, render, ...rest
}: SwitchProps) {
  const { optimistic, pending, dispatch, latestInFlight } = useControllableAction<
    boolean, SwitchCheckedChangeDetails
  >({
    controlled: checked,
    defaultValue: defaultChecked,
    initialValue: false,
    action: checkedChangeAction,
    transitionTypes: (next) => transitionTypes("switch", next ? "on" : "off"),
    warn: { component: "Switch", prop: "checked" },
  });

  const inputRef = useNativeChecked({
    type: "checkbox",
    component: "Switch",
    checked: optimistic,
    defaultChecked: checked === undefined ? (defaultChecked ?? false) : undefined,
    latestInFlight,
    onPlatformChange: (next, event) =>
      dispatch(next, createActionDetails(event, { reason: "platform" })),
  });

  const state: SwitchState = { checked: optimistic, pending, disabled };

  const element = useRender<ComponentPropsWithRef<"input">, SwitchState>({
    defaultElement: "input",
    render, state, className, style, children: undefined,
    ref: inputRef,
    // Pass-through layer: a `render` element's own props win over these.
    props: { ...rest, disabled },
    // Library-controlled layer (owned keys, conventions 1.2).
    libraryProps: {
      type: "checkbox",
      role: "switch",
      checked: optimistic,
      defaultChecked: undefined,
      "aria-checked": undefined,
      "data-checked": dataAttr(optimistic),
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        guardCheckableChange(event.nativeEvent, () =>
          dispatch(!optimistic, createActionDetails(event.nativeEvent, { reason: "activate" })),
        "Switch"); // already-cancelled click: no dispatch, no warning; preventDefault() in the action: dev warning (6.7)
      },
    },
  });

  return <ViewTransition default={transition ?? "none"}>{element}</ViewTransition>;
}
Switch.displayName = "Switch";
```

- **Owned keys** (documented per conventions 1.2): `type`, `role`, `checked`, `defaultChecked`,
  `aria-checked`, `onChange`, `data-checked`, `data-pending`, `data-disabled`. `disabled` and
  `name` are pass-through (a `render` element may set them), unlike Accordion's `name`, because
  here they are the consumer's form wiring, not library state.
- **`onChange`, not `onClick`.** React warns when `checked` is given without `onChange`, and
  `onChange` on a checkable input is React's `click`-driven change event, so `details.event` is
  the click. The consumer's `onClick` passes through and runs first.
- **`children: undefined`** is passed to `useRender`; `SwitchProps` has no `children`.
- **No `useId`, no context, no key handling.** Label association is the consumer's `<label>`.
- **Transition types** come from the shared `transitionTypes("switch", …)` helper.
- **The click guard** (`guardCheckableChange`, conventions 3.8 rule 9) is shared with Checkbox
  and RadioGroup: a click already cancelled by a pass-through `onClick` never dispatches; a
  `preventDefault()` inside the action warns once per instance.
- **`defaultChecked` for the hook** is `undefined` in controlled mode so React's mount-time value
  stays (6.6); in uncontrolled mode it is the latest prop so the reset target follows re-renders.
- Nothing else: Switch is `useControllableAction` + `useNativeChecked` + `useRender`. Checkbox is
  the same three calls plus `indeterminate`; the duplication of the ten `libraryProps` lines
  between the two files is accepted over a factory, so each component stays readable on its own.

### 12.3 Example app and docs site

A Switch page exercising: autosave with a fake 800 ms action and a rejecting variant inside an
Error Boundary; a settings `<form action>` with a reset button (both residual paths visible);
the headless CSS of 2.7 and the wrapper recipe of section 1; a controlled veto. The docs page
documents `defaultChecked` as the reset target and `preventDefault()` as unsupported.

---

## Cross-component (resolved 2026-10-16)

The assumptions this design made about RadioGroup and Checkbox are now conventions, recorded as
resolved questions 16 to 21 and section 3.8 there: `checked` is the vocabulary word on every
checkable input; `details.reason` is the shared `ChangeReason`; `checked={optimistic}` on every
native input (`optimistic === item.value` for radios); `aria-checked` owned and removed; the
three-hook machinery with one dispatch per state owner; `<fieldset>` + `<legend>` (`Label`)
groups; native `disabled`; no `useFormStatus` coupling. The one difference that stays: `name` is
pass-through on Switch and Checkbox and Root-owned on RadioGroup items.

## Conventions feedback (applied 2026-10-16)

All ten items were applied to `design/conventions.md`: void-element parts have no `children`
(1.3); form reset and the stable subscription (3.5, 3.8); `defaultX` as the reset target and `null`
from platform paths (3.1); the `preventDefault()` rules including the pass-through `onClick` case
(2.3); `checked` / `indeterminate` rows and pseudo-class equivalents (4.1, 4.2); the types table
(5.3); the layout (9.1); the public `ChangeReason` type (2.2, 9.4); the "Platform path" test row
(10.1); and `experimental_switch` as a future flag customer (8).

## Questions for the product owner

1. **Form reset in controlled mode** (6.6): resolved, notify the parent (conventions resolved
   question 17).
2. **No `Switch.Thumb` / `Switch.Label` parts in v0** (section 1): resolved, plain-input anatomy
   (conventions resolved question 16).
3. **`transition` on a void input**: kept for consistency (same as Toggle, conventions resolved
   question 9), documented as doing little on a bare input. Confirm or drop for Switch/Checkbox.
4. **`experimental_switch`**: agree to wait for Chromium rather than add the flag now (WebKit-only
   today)?
5. **Shared `ChangeReason` type**: resolved, public type in `internal/types.ts` re-exported from
   the root (conventions resolved question 19).
