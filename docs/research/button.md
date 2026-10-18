# Button: pending semantics, re-entry, forms, composition (issue #79)

Research for wave 8 (tracker #80). Date: 2026-10-18. Inputs: `docs/vision.md`,
`design/conventions.md` (3.6, 2.5, 2.7, 7.1, 7.3), `internal/use-action-trigger.ts`,
`form/form-submit.tsx`, `toolbar/toolbar-button.tsx`, `menu/menu-item.tsx`. Engines: BCD 8.1.6
(2026-10-15: Chrome 155, Firefox 158, Safari 27 current), chromiumdash stable 155.0.8059.85,
Playwright Chromium 156 / Firefox 157 (WebKit still cannot launch on this machine). Libraries
read from their published packages: react-aria-components 1.22.1 / react-aria 3.53.1, Base UI
1.9.0, Radix Themes 3.3.0, MUI Material 9.5.0, govuk-frontend 6.6.0; React 19.3.1 source.
Probes: `memo/platform-researcher/probes/16-button/`.

## Summary

| Question | Verdict |
| --- | --- |
| `aria-busy` on the button | **Not by default.** Its meaning is "this element's content is being modified", not "an operation is running"; NVDA and VoiceOver ignore it; JAWS is reported to hold back busy content. Leave it to pass-through. |
| Native `disabled` while pending | **No** (conventions 3.6 stands). Verified: Chromium and Firefox blur a focused button the moment it becomes `disabled` (focus goes to `<body>`); WebKit keeps focus on a disabled element (bug 119713 open). Either way the user's place is lost or inconsistent. |
| Re-entry while pending | **Ignore by default** (a click or Enter/Space while the Button's own action is pending does not start a second run). This departs from the current `useActionTrigger` behaviour (every click runs) and is the main design decision; see section 2. |
| `aria-disabled` while pending | **Recommended together with "ignore"**, as the honest AT state of a control that will not act (React Aria does exactly this). Needs a conventions 3.6 amendment; flagged. |
| Announcement of pending | **No built-in announcement in v1** (same as `Form.Submit`, `Menu.Item`, `Toolbar.Button`); document the outcome-announcement pattern. React Aria's focused-only assertive announcement is the model if one is added later. |
| Default `type` | **`type="button"`**, every surveyed library agrees; **`type="submit"` when `formAction` is given** (MUI's rule; React warns otherwise). |
| `formAction` | **Adopt** as a first-class prop with **per-submitter pending** read from `useFormStatus().action`. Verified in React 19.3.1. Keep `Form.Submit`. |
| `useFormStatus` for a plain `type="submit"` Button | **No**; that is `Form.Submit`'s job (conventions 2.7). |
| Invoker Commands (`command` / `commandfor`) | **Adopt as pass-through** (Baseline: Chrome 135, Firefox 144, Safari 26.2). No Button-specific API. |
| `interestfor` | Not for Button; it belongs to `Tooltip.Trigger` (already flagged, Chromium-only). |
| Server Components | **`"use client"`** for the Button module. A directive-free root buys nothing: an action-less, form-less button does nothing. Server Functions work as `action` and `formAction`; `formAction` even works before hydration. |

---

## 1. Pending semantics for assistive technology

### 1.1 `aria-busy`

- **Spec meaning.** WAI-ARIA: "Indicates an element is being modified and that assistive
  technologies could wait until the modifications are complete before exposing them to the
  user." It is global (allowed on `button`) but describes the element's **content** being
  updated (live regions, feeds, a tree being rebuilt), not an operation the element started. MDN's
  only widget example is a tree grid mid-update.
- **Platform mapping.** Chromium 156 exposes it (`busy=1` in the CDP AX tree for
  `<button aria-busy="true">`, probe `focus-disabled.mjs`).
- **AT behaviour.** a11ysupport.io (data last updated 2021) lists no support in NVDA (Chrome,
  Firefox) or VoiceOver (macOS, iOS). Steve Faulkner's test page reports it "works" in JAWS only,
  and a Vispero (JAWS vendor) note, not retrievable on 2026-10-18, is widely cited as saying JAWS
  **hides the content of a busy element**. On a button the content *is* the accessible name, so
  the worst case is a nameless or skipped button in JAWS. Not verified here (no screen readers in
  this environment).
- **Ecosystem.** React Aria Components does not set it. Spectrum Web Components' pending-state
  examples set it next to native `disabled`. MUI, Radix Themes and Base UI do not.

Conclusion: `aria-busy` gives no reliable signal and has a plausible failure mode in JAWS.
Keep conventions 3.6's stance: `data-pending` only; `aria-busy` is the consumer's through
pass-through (as it already is for `Form.Root`).

### 1.2 `disabled` vs `aria-disabled` while pending

Probe `focus-disabled.mjs` (focused button, then `button.disabled = true`):

| | Chromium 156 | Firefox 157 | WebKit |
| --- | --- | --- | --- |
| `activeElement` right after | the button | the button | not run (cannot launch) |
| After two frames | `<body>`, `blur` fired | `<body>`, `blur` fired | per WebKit bug 119713 (NEW since 2013, last touched 2022): focus is **not** removed from an element that stops being focusable |
| Next Tab | the element after the button (sequential starting point kept) | same | |
| Enter / Space after disabling | no click | no click | |
| Same with `aria-disabled="true"` | focus stays | focus stays | |
| Implicit submission (Enter in a text field) with the default button `disabled` | blocked | blocked | |

So native `disabled` drops focus to `<body>` in two engines (a screen reader then reads the
document or nothing, and focus does not return when the action settles) and leaves focus on a
dead element in the third. Conventions 3.6's reason holds. `aria-disabled` keeps focus and the
element is still activatable, so any blocking has to be done in the click handler.

### 1.3 Announcing pending

- **WCAG 4.1.3 Status Messages** defines a status message as content that informs "on the
  waiting state of an application, on the progress of a process". The library itself renders no
  visible waiting state (it emits `data-pending`; the spinner is the consumer's CSS or
  `children(state)`), so any visible indicator is consumer content. Still, the most common
  consumer pattern, `{({ pending }) => (pending ? "Saving…" : "Save")}`, changes the **name of
  the focused button**, and name / description changes on the focused element are not reliably
  spoken (the Field design already found that a changed `aria-describedby` on the focused element
  is announced by neither NVDA nor VoiceOver, `design/components/field-form.md` M2).
- **React Aria Components** (`Button.tsx`, 1.22.1): when `isPending` turns on **while the
  button is focused**, and again when it turns off, it calls its LiveAnnouncer
  (`announce({ "aria-labelledby": buttonId + progressBarId }, "assertive")`): the button's own
  name plus the consumer's `ProgressBar` label, with no library string. Unfocused buttons announce
  nothing.
- **Spectrum Web Components** swaps the `aria-label` to a `pendingLabel` while pending (which,
  per the point above, is unreliable on the focused element).
- **This library today**: `Form.Submit`, `Menu.Item`, `Toolbar.Button`, `Dialog.Close` and
  `Popover.Close` announce nothing for their pending state; NumberField announces steps and the
  Form announces server errors through `internal/announce.ts` (`ariaNotify()`: Chrome 141,
  Firefox 150, Safari 27; live-region fallback).

Recommendation: no automatic announcement in v1, consistent with every existing trigger and with
section 11 (a built-in string only where its absence is an accessibility gap; the gap that
matters is the **outcome**, which the consumer owns: a toast, a Field error, `ariaNotify` in the
action). If the architect wants one, copy React Aria's shape: only while focused, only on the
edges (start, end), speaking strings the consumer already provides, through `announce()`; an
`announce(state)` function prop (section 11 rules) would be the override.

---

## 2. Re-entry: a second activation while pending

### 2.1 What the current engine does

`useActionTrigger.run` starts a new `startTransition` per click. Both runs execute
concurrently; `pending` (one `useTransition`) stays true until every run has settled; the
latest run's rejection goes through React, an earlier one is rethrown from render
(conventions 2.4). For `Dialog.Close` / `Menu.Item` the follow-up (`then`, the close) happens
once, but **the action itself runs once per click** (`toggle-group.md` 11.5 documents this for
`Toolbar.Button`). "Superseding" is therefore not what happens: nothing is cancelled and nothing
is skipped; the second click duplicates the side effect.

Conventions 2.5's "latest intent wins" is about which **value** commits; a pure trigger has no
value, so the rule gives no protection. Conventions 3.6's escape hatch
(`[data-pending] { pointer-events: none }`) blocks only the mouse: Enter and Space on the
focused button still click it.

### 2.2 Prior art

| Source | Second activation while pending | Focus | Mechanism |
| --- | --- | --- | --- |
| React `useTransition` / `startTransition` | runs concurrently; docs: "Actions within a Transition do not guarantee execution order" | n/a | primitive |
| React `<form action>` / `formAction` | runs concurrently (verified, probe `form-action-status.mjs`: two clicks → `A start, A start`) | n/a | `startHostTransition` per submit |
| React `useActionState` | **queued**, sequential, each gets the previous result; a throw cancels the queue | n/a | primitive |
| React Aria Components `Button isPending` | **ignored**: every `on*` handler except focus/blur/hover/pointer-enter-leave is removed; `href` removed | kept | `aria-disabled="true"` while pending; consumer drives `isPending` |
| MUI Button `loading` | **ignored** | lost (native) | `disabled={disabled \|\| loading}` |
| Radix Themes Button `loading` | **ignored** | lost (native) | `disabled` defaults to `loading` |
| Spectrum Web Components pending state | **ignored** | lost (native) | "should be disabled or not interactive during pending states" |
| GOV.UK Frontend `preventDoubleClick` | **ignored for 1 s** | kept | debounce; guidance: double sends were a real, measured problem (GOV.UK Notify) |
| Base UI Button, Radix Primitives, shadcn/ui | no pending concept | | Base UI offers `focusableWhenDisabled` (`aria-disabled`, handlers short-circuited) for the consumer to drive |

Every component library with a pending/loading button blocks repeats; only React's primitives
run them, and React itself points to `useActionState` (queue) or custom logic for ordering.

### 2.3 Options for Button

| Option | Good for | Bad for |
| --- | --- | --- |
| **Ignore while pending** | Save, Pay, Send, Delete, Load more: the common case; prevents double submission for keyboard and pointer alike | rapid-fire commands (a "+1" counter); the consumer can use the `useActionState` queue or a non-awaiting action for those |
| Run every activation (today's engine) | consistency with Menu.Item / Toolbar.Button | duplicate side effects; contradicts the ecosystem; `pointer-events` workaround is mouse-only |
| Queue | ordered, result-threaded commands | a library queue duplicates `useActionState`, and conventions 2.5 says "no queueing in the library" |

Recommendation: **ignore by default**. Implementation detail for the architect: the guard must
key on the Button's own `pending` from a ref updated synchronously at dispatch (React's
`isPending` is a render value; two clicks in one frame would both see `false`), and on a
`render`ed link it must `preventDefault()` so the link does not navigate twice. An opt-out
(something like `repeatable`) is optional; a consumer who wants concurrent runs can also return
without awaiting (conventions 2.3 item 5), which ends `pending` at once.

Flag: this makes Button differ from `Toolbar.Button` and `Menu.Item`. The architect and PO
should decide whether the rule is "pure triggers ignore re-entry" library-wide (an amendment of
conventions 2.5 / 3.6 and of `useActionTrigger`, which could take an `ignoreWhilePending`
option) or Button-only.

### 2.4 AT state while ignoring

If activation is ignored, the honest state is "unavailable". React Aria sets `aria-disabled`
for exactly this. That conflicts with conventions 3.6 ("does not set `disabled`,
`aria-disabled` or `inert` … because its action is in flight"), but 3.6's two stated reasons do
not apply to `aria-disabled` on a pure trigger: it does not drop focus (verified above), and the
latest-intent rule does not protect a trigger (2.1). Recommendation: `aria-disabled="true"` while
the Button's own action is pending, `data-disabled` **not** set (so `[data-disabled]` styling
stays the consumer's `disabled` only; `[data-pending]` styles pending). Whether NVDA / JAWS /
VoiceOver speak an `aria-disabled` change on the focused element was not verified here; the
value is that a user who presses again, or navigates back to the button, hears "unavailable"
instead of silence. If the PO keeps 3.6 literally, ignore-without-`aria-disabled` is still
better than running twice.

---

## 3. Relationship to forms

### 3.1 Default `type`

| Library | Default |
| --- | --- |
| React Aria `useButton` | `type = 'button'` |
| Base UI `useButton` | `type: 'button'` merged under the consumer's props |
| MUI `useButtonBase` | `'button'` unless `formAction` is given, then the native default (submit) |
| Radix Themes | none (native default, `submit` inside a form) |
| FUNSTACK `Toolbar.Button`, `Menu.Item`, `Dialog.Close` | `type="button"`, owned |

Native `<button>` inside a form defaults to submit (the HTML Auto state, which since Invoker
Commands is a submit button only when neither `command` nor `commandfor` is present). For a
button whose behaviour is its `action`, an accidental submit is a bug, so **`type="button"` by
default**. Recommend **not owning** `type` (unlike `Toolbar.Button`): a consumer may pass
`"submit"` / `"reset"`, with a development warning when `action` is combined with a submitting
type (two behaviours on one click, one in a transition and one in the form's).

### 3.2 `formAction`

Verified in React 19.3.1 (`react-dom-client` `extractEvents$1`, `startHostTransition`; probe
`form-action-status.mjs`):

1. React runs a submitter's function `formAction` instead of the form's `action`, in the
   form's host transition, with automatic form reset; `useFormStatus()` returns
   `{ pending, data, method, action }` where **`action` is the submitter's function**. So a
   Button can expose **its own** pending as
   `status.pending && status.action === formAction`. Probe: clicking A marks only A as "mine"
   while every submitter sees `pending`.
2. Submissions are **not queued**: two clicks run the function twice concurrently.
3. `preventDefault()` in the submitter's `onClick` stops React's form action (and the native
   submission), so the re-entry guard of section 2 works for `formAction` too. Implicit
   submission (Enter in a field) clicks the default button, so it goes through the same guard
   when the Button is the default button.
4. `type="button"` with `formAction` logs "A button can only specify a formAction along with
   type="submit" or no type.", so the default type must switch to `"submit"` when `formAction`
   is given (MUI's rule).
5. Progressive enhancement: for a Server Function, Fizz renders `name="$ACTION_ID_…"`,
   `formaction`, `formmethod="POST"` and `formenctype`, so the button submits to the server
   **before hydration and without JS** (`pushFormActionAttribute`). A client function renders a
   `javascript:` URL that throws.
6. React warns when `name`, `formEncType`, `formMethod` or `formTarget` are passed with a
   function `formAction` (it owns them).

React Aria Components and MUI both pass `formAction` through. Note that React Aria flips a
pending submit button to `type="button"` "to stop implicit form submission"; probe
`focus-disabled.mjs` shows this is incomplete: in a form with one text field and no other submit
button, Enter still submits (the form then has no default button, and one blocking field allows
implicit submission), and it would run the form's `action`, not the button's. A click guard on
the default button (3 above) is the reliable form.

`formAction` does **not** make `Form.Submit` redundant. They cover different cases:

| | `Form.Submit` | `Button formAction` |
| --- | --- | --- |
| Submits | the form's own `action` (`Form.Root`, `Dialog.Form`, any `<form action>`) | its own function instead |
| `pending` | the form's submission, any submitter (`useFormStatus().pending`; conventions 2.7: allowed because it has no action of its own) | only submissions through its own `formAction` |
| Typical use | the one primary submit button | secondary submitters: "Save draft" next to "Publish", "Delete" in an edit form |

Recommendation: adopt `formAction` on Button with per-submitter pending and the re-entry guard;
keep `Form.Submit` as the documented submit button. `action` and `formAction` together should be
a type error or a development warning (two actions for one click).

Interaction with `Form.Root`: `Form.Root` runs a function `action` itself from `onSubmit`, but
conventions 2.7 already says "a submitter with its own `formaction` … stay[s] on React's path",
so `useFormStatus` behaves as in the probe. Worth one test row in the design.

### 3.3 Should a submit Button reflect `useFormStatus`?

Only for its own `formAction` (3.2). A `<Button type="submit">` with neither `action` nor
`formAction` submits the form's action; reflecting the form's pending there would duplicate
`Form.Submit` exactly, and an `action` Button must not fold form pending into its own
(conventions 2.7). Recommend: no; the Button docs point to `Form.Submit` for that case.

---

## 4. Composition

Merge order (conventions 1.2, `merge-props.ts`): the element's handlers run first, then the
part's pass-through ones, then the part's library handlers; ARIA id lists are token-merged.

| Composition | What happens | Notes for the design |
| --- | --- | --- |
| `<Tooltip.Trigger render={<Button action={save} />}>` | Tooltip attaches hover/focus listeners by `addEventListener` and merges `aria-describedby`; Button's click runs the action. Same shape as the tested `Tooltip.Trigger render={<Menu.Item />}`. | Ignoring re-entry must not remove focus/hover listeners (React Aria keeps `Focus`, `Blur`, `Hover`, `Pointer(Enter\|Leave\|Over\|Out)` for exactly this reason). With `aria-disabled` while pending the element keeps all its events, so the tooltip still shows. |
| `<Popover.Trigger render={<Button />}>`, `<Dialog.Trigger render={<Button />}>` | The Trigger's props (`commandfor`, `command`, its `onClick`) reach Button as pass-through; inside Button they run **before** Button's own handler. In library mode the Trigger `preventDefault()`s the click. | Button must **not** treat an already-`defaultPrevented` click as cancelled (unlike the checkable-input rule of conventions 2.3 item 3), or a Trigger-wrapped Button with an `action` would never run it. Button's re-entry guard cannot stop the outer Trigger (its handler ran first); that is fine (the Trigger's own state machine handles repeats). Button must leave `command` / `commandfor` untouched. |
| `<Button render={<Dialog.Trigger />}>` | Button's props, including its library `onClick`, reach the Trigger as pass-through; the Trigger's library handler runs last. | Works; the documented direction should be "Trigger renders Button", matching `Dialog.Trigger render={<Menu.Item />}`. |
| Inside `Toolbar.Root` | The roving engine (`use-roving-focus.ts`) picks up any focusable descendant, so a Button joins with no context read. | Native `disabled` removes it from the sequence and from AT discovery, which the APG Toolbar example does not want; that is why `Toolbar.Button` uses `aria-disabled`. Two options: (a) Button reads `ToolbarContext` and renders `disabled` as `aria-disabled` inside a toolbar (Base UI does this for every composite item), making `Toolbar.Button` a thin alias; (b) keep `Toolbar.Button` as the toolbar's button and document it. (a) is cheap for a new component (the toggle-group design's objection was about changing `Toggle`). |
| Inside `Menu.Popup` | Not a menu item (no `role`, not in the menu's roving set). | `Menu.Item` is the action item; docs say so. |

### 4.1 Invoker Commands

BCD 8.1.6: `button` `command` / `commandfor`, `CommandEvent`, `HTMLButtonElement.command` /
`commandForElement` all Chrome 135, Firefox 144, Safari 26.2; `request-close` Chrome 139.
Baseline (newly available), already adopted by Dialog / Popover / Menu. Custom commands
(`--name`) dispatch only a `command` event on the target (HTML: "If command is in the Custom
state, then return" after firing it). React 19.3.1 still knows neither attribute nor event
(no `onCommand`); the attributes pass through lowercase and are typed by
`internal/platform-attributes.ts` on `ButtonHTMLAttributes`, so Button gets them for free.

Relevance: a `<Button commandfor="dlg" command="show-modal">` works with no JS before
hydration, and the explicit `type="button"` matters inside a form: per the activation steps, a button with a form owner returns early in the Auto state and submits in the Submit state, so only the Button state reaches the command. There is nothing for
Button to add: no prop, no flag. One rule: if both `action` and `command` are present, the click
runs the action and the browser runs the command; the design should say so (same as `Toolbar.Button`
today).

`interestfor` (Chrome 142 only; Firefox / Safari none) stays on `Tooltip.Trigger` behind its
existing flag.

---

## 5. Server Components

- Button needs `useTransition` (or `useActionTrigger`), `useFormStatus`, a click handler and a
  ref-based guard, so the module is `"use client"` (conventions 7.1).
- Could the root be directive-free when there is no `action`, as `Progress.Root` / `Meter.Root`
  are? Those roots render a client **context provider** and use only `useId` (7.1's provider
  exception). Button has no context to provide, and a directive is per module, not per render:
  a directive-free `Button` would have to import a client `ButtonAction` component for the action
  case, which the one-way import rule forbids. And the action-less case gains nothing: a Button
  with no `action`, no `formAction` and no `command` does nothing that `<button type="button">`
  does not.
- What Server Components can already do with a `"use client"` Button: pass a Server Function as
  `action` (works, `details.event` is virtual, conventions 2.2) or as `formAction` (works and is
  progressively enhanced, 3.2 point 5), pass `commandfor` / `command`, and style with
  `[data-pending]`. What they cannot do: pass function `children` / `className` / `style` /
  `render` (functions are not serialisable), which Progress's directive-free root allows. This
  is the cost to document.
- Before hydration: an `action` Button does nothing on click (like `Toolbar.Button`); a
  `formAction` Server Function Button submits natively; a command Button runs its command.

Verdict: `"use client"`, no directive-free variant; record it in the design doc's Directive row.

---

## 6. Recommendation for the architect

Anatomy: a single component `Button` (`@funstack/ui/button`), `<button>` by default, `render`
allowed (`<a href>` included, as `Menu.Item` / `Toolbar.Button`).

```ts
export interface ButtonActionDetails extends ActionDetails {}

export interface ButtonState {
  /** This Button's own action (or its own formAction submission) is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface ButtonProps extends Omit<ComponentPropsWithRef<"button">,
  "onClick" | "className" | "style" | "children"> {
  action?: Action<[details: ButtonActionDetails]>;   // own transition, useActionTrigger
  formAction?: ...;                                   // native / React form action; type defaults to "submit"
  type?: "button" | "submit" | "reset";              // default "button" ("submit" with formAction); not owned
  disabled?: boolean;                                 // native; aria-disabled inside a Toolbar (option 4a)
  transition?: ViewTransitionClass;                   // as Toolbar.Button
  className / style / children / render as usual
}
```

1. **Pending**: `data-pending` and `state.pending` for the Button's own `action` transition,
   or `useFormStatus().pending && status.action === formAction`. Never native `disabled`
   while pending.
2. **Re-entry**: ignore activation while pending (ref-based guard, `preventDefault()` so a link
   or a `formAction` submission does not happen twice). Decide whether this becomes the rule for
   all pure triggers (`useActionTrigger` option) or Button-only. **Conventions 2.5 / 3.6
   amendment needed.**
3. **AT**: `aria-disabled="true"` while pending (React Aria's choice), not `data-disabled`;
   no `aria-busy` (pass-through only); no built-in announcement in v1.
   **Conventions 3.6 amendment needed** for the `aria-disabled` part.
4. **Forms**: `type="button"` default, `"submit"` with `formAction`; `action` + submitting
   `type`, and `action` + `formAction`, warn in development; `Form.Submit` stays and is what docs
   recommend for the form's own submit.
5. **Composition**: do not treat a `defaultPrevented` click as cancelled; keep focus / hover /
   pointer-enter-leave listeners working while pending; leave `command` / `commandfor` alone;
   choose 4a (read `ToolbarContext`, `aria-disabled` in toolbars) or 4b (keep `Toolbar.Button`).
6. **RSC**: `"use client"` module; Server Functions as `action` / `formAction`.
7. **Tests** beyond the standard rows: re-entry by mouse and by keyboard (Enter, Space) both
   ignored; two clicks in one frame run once; `formAction` per-submitter pending with two
   submitters; implicit submission through a pending default Button is ignored; Trigger-wrapped
   Button (`Dialog.Trigger render={<Button action />}`) runs both; Tooltip still opens on a
   pending Button; a `render={<a href />}` pending Button does not navigate twice.

Nothing here needs an experimental flag.

---

## References

- WAI-ARIA 1.2, `aria-busy`: https://www.w3.org/TR/wai-aria-1.2/#aria-busy
- MDN, `aria-busy`: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy
- a11ysupport.io, `aria-busy` (data 2021-03-01): https://a11ysupport.io/tech/aria/aria-busy_attribute
- Steve Faulkner, `aria-busy` test: https://s.codepen.io/stevef/debug/OZwMqv
- WCAG 2.2, 4.1.3 Status Messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- APG Button pattern: https://www.w3.org/WAI/ARIA/apg/patterns/button/
- APG Toolbar example (focusable disabled items): https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/examples/toolbar/
- HTML, the button element (Auto state, activation behaviour, custom commands): https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element
- HTML, focus fixup: https://html.spec.whatwg.org/multipage/interaction.html#focus-fixup-rule
- WebKit bug 119713, "Remove focus if supportsFocus state is changed" (NEW): https://bugs.webkit.org/show_bug.cgi?id=119713
- MDN BCD 8.1.6 (`html.elements.button.command`, `commandfor`, `api.CommandEvent`, `api.Element.ariaNotify`): https://unpkg.com/@mdn/browser-compat-data@8.1.6/data.json
- React, `useTransition` (ordering of Actions): https://react.dev/reference/react/useTransition
- React, `useActionState` (queueing): https://react.dev/reference/react/useActionState
- React, `useFormStatus`: https://react.dev/reference/react-dom/hooks/useFormStatus
- react-dom 19.3.1 source: `react-dom-client.development.js` (`extractEvents$1`, `startHostTransition`, `dispatchActionState`), `react-dom-server.node.development.js` (`pushFormActionAttribute`)
- React Aria Components 1.22.1 `Button.tsx` (isPending: `aria-disabled`, handler removal, assertive announcement, submit→button): https://github.com/adobe/react-spectrum/blob/main/packages/react-aria-components/src/Button.tsx
- React Aria Button docs: https://react-aria.adobe.com/Button
- Base UI 1.9.0 Button (`focusableWhenDisabled`, `type="button"`): https://base-ui.com/react/components/button
- MUI Material 9.5.0 Button `loading` (native `disabled`), `useButtonBase` type rule: https://mui.com/material-ui/react-button/#loading
- Radix Themes 3.3.0 Button `loading`: https://www.radix-ui.com/themes/docs/components/button
- Spectrum Web Components pending state: https://opensource.adobe.com/spectrum-web-components/tools/pending-state/
- GOV.UK Design System, Button, preventing double clicks (govuk-frontend 6.6.0: 1 s debounce): https://design-system.service.gov.uk/components/button/
- GitLab UI issue 1044, accessible loading button: https://gitlab.com/gitlab-org/gitlab-ui/-/issues/1044
- Probes: `memo/platform-researcher/probes/16-button/focus-disabled.mjs` (+ `.output.txt`), `form-action-status.mjs` (+ `.output.txt`)
