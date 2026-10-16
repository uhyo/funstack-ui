# `<dialog>` for the Dialog component

Research date: **2026-10-16**. Support data verified against MDN browser-compat-data 8.1.6
(2026-10-15), wpt.fyi stable runs (Chrome 155, Firefox 157, Safari 27.0; 2026-10-06 to 10-15),
vendor release notes, bug trackers and the live HTML spec. Behaviour was verified with
Playwright probes on Chromium 156 and Firefox 157 (`memo/platform-researcher/probes/04-dialog/`).
WebKit could not be run locally, so its column is based on release notes and WPT, not a probe.

| Engine | Stable release | Date |
| --- | --- | --- |
| Blink | Chrome 155 | 2026-10-06 |
| Gecko | Firefox 158 | 2026-10-13 |
| WebKit | Safari 27.0 | 2026-09-14 |

Related issue: GitHub #24. Builds on the dialog rows of
[modern-platform-survey.md](./modern-platform-survey.md), with two corrections (see
"Corrections to earlier research").

## Summary

`<dialog>` with `showModal()` gives a Dialog component the hard parts for free in all three
engines: top layer, `::backdrop`, inertness of the rest of the page (also in the accessibility
tree), an implicit `aria-modal="true"`, Escape and Android back handling, initial focus, and focus
return to the opener. A React Dialog therefore needs **no focus trap, no portal, no z-index
management and no Escape handler**. Declarative triggers (`commandfor` + `command="show-modal"` /
`"request-close"` / `"close"`) are Baseline and work before hydration and without JS.

What the platform does **not** give, and the library must add:

- **Scroll locking.** `showModal()` does not stop the page from scrolling under the backdrop
  (wheel, PageDown). One CSS rule fixes it: `html:has(dialog:modal) { overflow: hidden }`.
- **Light dismiss in Safari.** `closedby="any"` is in Chrome 134 and Firefox 141. Safari 27.0
  lacks it (Technology Preview only).
- **Exit animations in Firefox.** Gecko cannot keep a closing dialog rendered while `display`
  transitions to `none`, so closing is instant there. `overlay` exists only in Chromium.
- **React gaps.** A hydrated `<dialog>` never fires `onToggle` / `onBeforeToggle`
  (react/react#37261). A function `action` on `<form method="dialog">` stops the form from closing
  the dialog. `autoFocus` is lost on client-rendered dialog content.
- **Consistent initial focus.** Chromium still uses the pre-2023 algorithm. It focuses a
  `tabindex="-1"` element and ignores `autofocus` on the `<dialog>` itself. Firefox follows the
  spec.

### Verdicts

| Feature | Verdict | Reason |
| --- | --- | --- |
| `<dialog>`, `showModal()`, `show()`, `close()`, top layer, `::backdrop`, `:modal` | **Adopt** | Baseline for years. |
| `requestClose(returnValue)` | **Adopt** | Chrome 134, Firefox 139, Safari 18.4. Use it for user-initiated closes. |
| `beforetoggle` / `toggle` on `<dialog>` (`ToggleEvent`) | **Adopt** (native listener, not the React prop) | Chrome 132, Firefox 133, Safari 26. React prop broken after hydration. |
| `ToggleEvent.source` | **Adopt** | Chrome 140, Firefox 145, Safari 26.5. Reports the invoker for command-opened dialogs. |
| Invoker Commands: `show-modal`, `close`, `request-close` | **Adopt** | Chrome 135 (`request-close` 139), Firefox 144, Safari 26.2. Cancelable `command` event. |
| `:open` | **Adopt** | Chrome 133, Firefox 136, Safari 26.5. |
| `@starting-style` + `transition-behavior: allow-discrete` (enter) | **Adopt** | Works in all engines. |
| CSS exit animation of a closing dialog/backdrop | **Adopt as progressive enhancement** | Chromium (with `overlay`) and WebKit animate; Gecko closes instantly (bug 1834877). No JS fallback. |
| `overlay` in `transition` lists | **Adopt** (harmless) | Chromium only. Needed in Chromium to keep the dialog above the page and keep the backdrop during the exit. CSSWG is considering removing it. |
| `<form method="dialog">`, `formmethod="dialog"`, `returnValue` | **Adopt** for JS-free closes; **not** together with a function `action` | React overrides the method of a form with a function action. |
| `closedby="any" \| "closerequest" \| "none"` | **Adopt behind experimental flag** | Chrome 134, Firefox 141, Safari TP only. Without the flag, light dismiss is JS. |
| `CloseWatcher` (JS API) | **Not yet** (not needed) | Chrome 126, Firefox 149, Safari TP only. `<dialog>` already gets close requests. |
| `inert` attribute | **Adopt** where needed, not for modal dialogs | `showModal()` makes the rest of the document inert by itself. |
| `scrollbar-gutter: stable` + `html:has(dialog:modal) { overflow: hidden }` | **Adopt** | Only reliable CSS-only scroll lock in Chromium and Firefox. |
| `overscroll-behavior: contain` on the dialog as the scroll lock | **Not yet** | Chromium partial, Firefox none, Safari ignores it without overflow. |
| The spec's 2023+ dialog initial-focus algorithm | **Not yet relied on** | Firefox only. Chromium flag is `experimental`. Safari passes 2 of 5 WPT subtests. |

## Support table per engine

Versions are the first stable release with full support. "TP" = Safari Technology Preview only.

| Feature | Chrome | Firefox | Safari | Notes |
| --- | --- | --- | --- | --- |
| `showModal()`, `::backdrop`, `returnValue`, `cancel` event | 37 | 98 | 15.4 | |
| `:modal` | 105 | 103 | 15.6 | |
| `inert` attribute | 102 | 112 | 15.5 | |
| `requestClose()` | 134 | 139 | 18.4 | Safari 27.0 fixed recursion and disconnected-dialog bugs. |
| `beforetoggle` / `toggle` on dialog | 132 | 133 | 26 | Opening `beforetoggle` is cancelable, closing is not (verified). |
| `ToggleEvent.source` | 140 | 145 | 26.5 | `null` when opened by script. |
| `command` / `commandfor` (incl. `show-modal`, `close`) | 135 | 144 | 26.2 | Baseline 2025-12. |
| `command="request-close"` | 139 | 144 | 26.2 | |
| `closedby` attribute / `closedBy` property | 134 | 141 | TP 242 | WebKit umbrella bug 284592. Interop 2026. Safari 27.0 fails all `closedby` WPT. |
| Light dismiss on `click` (not pointerdown/up) | 154 | ? | – | From the survey. The spec text still uses pointerdown/pointerup. |
| `CloseWatcher` | 126 | 149 | TP 249 | Firefox 149 also added Android back for dialogs and popovers. |
| `:open` | 133 | 136 | 26.5 | |
| `@starting-style` | 117 | 129 | 17.5 | |
| `transition-behavior: allow-discrete` on `display` | 117 | ✗ (129 partial) | 17.4 | BCD: Firefox does not transition `display`. Display animation in Gecko is meta bug 1834877 (NEW); Nightly pref not yet enabled. |
| `overlay` | 117 | ✗ | ✗ | CSSWG issue "Consider removing the overlay property" open since 2025-12. |
| `scrollbar-gutter` | 94 | 97 | 18.2 | |
| `overscroll-behavior` on non-overflowing boxes | 144 | 150 | ✗ (partial) | Safari: "no effect on scroll containers without scrollable overflow". |
| Spec dialog initial focus (keyboard-focusable filter, `autofocus` on dialog) | ✗ (flag `DialogNewFocusBehavior` is `experimental`) | yes (WPT 5/5) | partial (WPT 2/5) | |
| Focus restore follows the spec (non-modal close does not steal focus) | yes | yes | ✗ in 27.0 (WPT 3/6), fixed in TP 251/252 | |

## Findings

### Open, close and events

Verified identically in Chromium 156 and Firefox 157:

- **`showModal()` event order.** `beforetoggle(open, cancelable)` fires, then `toggle(open)`.
  Calling `preventDefault()` on the opening `beforetoggle` keeps the dialog closed.
- **`close()` event order.** `beforetoggle(closed, not cancelable)` fires, then `toggle(closed)`
  and `close`. `toggle` is queued as a task, so its order relative to `close` varies; both
  orders were observed. Do not depend on it.
- **`requestClose(v)`.** It fires a `cancel` event that is **always cancelable** from script. If
  nobody prevents it, the dialog closes with `returnValue = v`. Repeated calls stay cancelable,
  because the anti-abuse rule below applies only to user close requests.
- **`toggle` is coalesced.** Read `dialog.open` or `:modal` in the handler, not
  `ToggleEvent.newState`. This is the same rule as Accordion 2.3.
- **Removing the `open` attribute by hand** hides the dialog (`display: none`) and fires `toggle`.
  It does **not** fire `close`, and `:modal` **stays true** in both engines. The spec says never
  to do this. A React `open` prop on a modal dialog would do exactly this, so the library must
  never render `open` for a modal dialog.

### Close requests, `closedby`, and the user-activation rule

- **Close requests.** Escape on desktop, Android back (Chrome; Firefox 149+), and AT dismiss
  gestures reach a dialog as close requests. The dialog fires `cancel`, then closes unless the
  event was cancelled.
- **Anti-abuse rule** (HTML "request to close a close watcher"). A user close request can be
  cancelled only if the page has had a user activation since the last cancelled one.
  - Verified in both engines: the first Escape gives `cancel.cancelable === true`. If the page
    prevents it, the second Escape gives `cancelable === false` and the dialog closes.
  - **Consequence.** A "you have unsaved changes" veto on Escape works once per user
    interaction. It can never be a reliable gate.
  - Testing note: Playwright's `page.evaluate` counts as a user gesture and re-arms the rule.
- **Grouping.** Close watchers created without an intervening user activation share a group, and
  one close request closes the whole group. Dialogs opened from separate clicks stay separate:
  nested modals opened from two clicks need two Escapes (verified).
- **`closedby`** takes `any` (light dismiss + close requests), `closerequest` or `none`. If the
  attribute is missing or invalid, a modal dialog behaves as `closerequest` and a non-modal one as
  `none`.
  - `closedby="none"` stops Escape and the back button.
  - It does **not** stop `requestClose()` or `command="request-close"`; both still close the
    dialog (spec note, verified). The survey said the opposite.
- **Safari 27.0 has no `closedby`.** The attribute is ignored, so modal dialogs behave as
  `closerequest` and non-modal ones as `none`. Light dismiss and "Escape cannot close" both need
  JS there:
  - backdrop click: `click` on the dialog whose coordinates are outside its border box;
  - "no Escape": `preventDefault()` on `cancel`, which works only once per activation, so
    `closedby="none"` cannot be emulated faithfully.

### Light dismiss and portals

The spec's "nearest clicked dialog" walks **flat-tree ancestors** of the click target. A click
counts as inside the dialog only if its target is a DOM descendant of the dialog. Verified in
both engines:

- A popover that is a DOM child of a `closedby="any"` modal dialog can be clicked without closing
  the dialog.
- A popover rendered outside the dialog (a portal to `<body>`) is inert, because `showModal()`
  blocks everything outside the dialog subtree. A click on it closes the dialog.

**Rule for the library: never portal anything out of a Dialog.** Menus, Selects, Tooltips and
Toasts opened from inside a dialog must render inside its subtree. The top layer already puts
them on top, so portals are unnecessary. This applies to every FUNSTACK overlay component.

### Nesting with popovers and other dialogs

Verified in both engines:

- `showModal()` on a dialog **outside** an open `popover="auto"` closes that popover. The spec
  runs "hide popovers until" from the dialog's topmost popover ancestor.
- `showModal()` on a dialog **inside** an open popover keeps the popover open.
- With a popover open inside a modal dialog, Escape closes the popover first and the dialog
  stays open.
- Nested modal dialogs stack. Escape closes the topmost one, focus returns to its opener inside
  the lower dialog, and a second Escape closes the lower one.

### Focus

**Initial focus (spec, current).**

1. If the `<dialog>` has `autofocus`, the dialog itself gets focus.
2. Otherwise the first descendant with `autofocus` gets focus.
3. Otherwise the first **sequentially focusable** descendant gets focus.
4. Otherwise the dialog itself gets focus.

Probed:

| Case | Chromium 156 | Firefox 157 |
| --- | --- | --- |
| No focusable content | dialog | dialog |
| `tabindex="-1"` element before a button | the `tabindex="-1"` element (old algorithm) | the button (spec) |
| `autofocus` on a descendant | that descendant | that descendant |
| `autofocus` on the `<dialog>` | first button (old algorithm) | dialog (spec) |
| First focusable is a link | link | link |

Safari 27.0 passes 2 of 5 `child-sequential-focus` WPT subtests.

Practical rules for consumers, valid in all engines:

- Put `autofocus` on the element that should receive focus.
- For long or destructive dialogs, put `tabindex="-1"` + `autofocus` on the heading or content
  wrapper. APG recommends focusing static content in that case.
- Do not rely on `autofocus` on the `<dialog>` element itself.

**Focus return.** On close, focus goes back to the element that was focused when the dialog
opened. For non-modal dialogs this happens only if focus was inside the dialog. Verified in
Chromium and Firefox, also when `showModal()` is called later, from a timer, after the command
was intercepted. Safari 27.0 fails half of the related WPT tests:

- it restores focus on non-modal close even when focus is outside the dialog;
- it sometimes picks the wrong element.

Both bugs are fixed in TP 251/252. If the opener was removed from the DOM while the dialog was
open, focus is left on an element inside the now-hidden dialog in both engines. **The library
must handle the "trigger unmounted" case** itself, for example by focusing the Root's fallback
or `<body>`.

**Focus trapping.** A modal dialog makes everything outside it inert. Tab cycles through the
dialog and the browser chrome, which is the platform-intended behaviour and acceptable under APG
("focus moves to the browser UI" is allowed). **No JS focus trap is needed** for modal dialogs.
Non-modal dialogs are not traps by definition.

### Accessibility

- **Role.** `<dialog>` maps to role `dialog` (HTML-AAM).
- **Modality.** HTML-AAM: if `open` was set by `showModal()`, the dialog is exposed as
  `aria-modal="true"`; after `show()` or a declarative `open` attribute, `aria-modal="false"`.
  Chromium's accessibility tree after `command="show-modal"` shows `dialog "Title" modal=true`,
  and the background is pruned from the tree (verified through CDP). **Do not set `aria-modal`
  by hand.**
- **Name.** The name is not automatic. The library must wire `aria-labelledby` to the title part
  and optionally `aria-describedby` to the description part. `role="alertdialog"` is a consumer
  choice: it is allowed on `<dialog>` and keeps all the native behaviour.
- **Invoker state.** A `command="show-modal"` invoker gets **no** `aria-expanded`, unlike a
  `popovertarget` invoker. APG does not require one. `aria-haspopup="dialog"` is optional and
  inconsistently announced, so the library should not add it by default.
- **VoiceOver.** It did not reliably move into dialogs on `autofocus` / `focus()`. WebKit bug
  314893 is resolved FIXED; which Safari release carries the fix was not verified.

### Animation

- **Enter.** `@starting-style` + `transition-behavior: allow-discrete` works in all three
  engines, on the dialog and on `::backdrop`. Verified by screenshots in Chromium and Firefox.
- **Exit.** The closing dialog has to stay rendered (`display` held at `block`) and stay in the
  top layer while it fades. Screenshot probe, 2 s fade, sampled at 300 ms:

| Engine | `display` during exit | Dialog visible | Above page content | `::backdrop` kept |
| --- | --- | --- | --- | --- |
| Chromium, no `overlay` | block | yes | **no** (drops under z-indexed content) | **no** |
| Chromium, with `overlay … allow-discrete` | block | yes | yes | yes |
| Firefox 157 (either) | `none` immediately | no | – | no |
| Safari 27.0 | animates (release notes fixed "display transitions … animate incorrectly when closing"); top-layer behaviour without `overlay` not verified | | | |

The same holds for `@keyframes` exit animations: Firefox ends them at once. Popover exits behave
the same way in Firefox, which affects the Tooltip doc as well.

Recommended CSS. The library ships no styles, so this is a documentation snippet:

```css
dialog, dialog::backdrop {
  transition: opacity 150ms, display 150ms allow-discrete, overlay 150ms allow-discrete;
  opacity: 0;
}
dialog:open, dialog:open::backdrop { opacity: 1; }
@starting-style { dialog:open, dialog:open::backdrop { opacity: 0; } }
```

`<ViewTransition>` does not apply to `showModal()` / `close()` performed by the browser
(conventions 3.5). If the library calls `showModal()` itself inside a React commit, a view
transition could in principle capture it. Top-layer elements in a view transition were not
probed and are left to the design or implementation.

### Scroll locking

`showModal()` does not prevent background scrolling. Probed with a 5000 px page and the focus
inside the dialog:

| Technique | Chromium wheel on backdrop / on dialog / PageDown | Firefox (same three) |
| --- | --- | --- |
| nothing | scrolls / scrolls / scrolls | scrolls / scrolls / scrolls |
| `dialog { overscroll-behavior: contain }` | scrolls / blocked / blocked | scrolls / scrolls / scrolls |
| `html:has(dialog:modal) { overflow: hidden }` | blocked / blocked / blocked | blocked / blocked / blocked |

Recommendation:

```css
html { scrollbar-gutter: stable; }               /* no layout shift when the scrollbar goes */
html:has(dialog:modal) { overflow: hidden; }
dialog { overscroll-behavior: contain; }         /* stop chaining from a scrollable dialog body */
```

- **Where the rule lives.** It is pure CSS and keyed on `:modal`, so it also works for dialogs
  opened by `command` before hydration. The library cannot inject it, because it ships no CSS. So
  either it goes into the docs' starter stylesheet, or the Root toggles a `data-` attribute on
  `<html>`. The design should pick one; CSS-only is preferred.
- **iOS Safari.** It has a long history of ignoring `overflow: hidden` on the root for touch
  scrolling. Reports from 2025 in whatwg/html#7732 say it still leaks; not verified on Safari 27.
- **Platform fix.** whatwg/html#7732 (a built-in scroll lock for modal dialogs) is open with no
  resolution.
- **Non-modal dialogs** never lock scroll.

### Forms

- **Plain HTML.** `<form method="dialog">` closes its dialog on submit with
  `returnValue = submitter.value`, firing `submit` then `close`. `formmethod="dialog"` on a submit
  button does the same per button. JS-free and pre-hydration safe.
- **With a function `action` (React 19.3.1).** React calls the action with the `FormData` and
  logs "Cannot specify a encType or method for a form that specifies a function as the action".
  **The dialog stays open** (verified). An action prop and `method="dialog"` cannot be combined.
  - This fits FUNSTACK's model: "submit, await the action, then close" is the behaviour a
    Suspense-native dialog wants anyway. The library closes the dialog with
    `requestClose(returnValue)` after the action resolves, inside its transition.
  - A Server Function as the form action works, because React handles it the same way.
- **`returnValue`** is a string. `requestClose(v)` and `close(v)` set it, and so do the `value`
  attribute of a `command="close"` / `"request-close"` button and the submitter of a
  `method="dialog"` form.

### React 19.3 integration

| Item | Status in react-dom 19.3.1 / @types/react 19.3.0 |
| --- | --- |
| `closedby` | Typed on `DialogHTMLAttributes` as `"any" \| "closerequest" \| "none"`. Unknown to react-dom, passed through verbatim (lowercase). |
| `onCancel`, `onClose` | Typed. Native listeners attached on both client render and hydration. Work. |
| `onToggle`, `onBeforeToggle` on `<dialog>` | Typed (`ToggleEventHandler`). **Client render: work. Hydrated: never fire** (react/react#37261, open; fix PRs #37262 and #37293 open). Verified in both engines. |
| Bubbling of `toggle` | 19.3.1 still emulates bubbling for `toggle` / `beforetoggle`. A nested `<details>` or popover inside a dialog triggers the dialog's `onToggle`. Fixed on `main` by #37580 (merged 2026-09-14), not released. |
| `command`, `commandfor` | Untyped. Passed through lowercase. Covered by the conventions 7.4 augmentation. |
| `command` event | Not synthesized. Needs `addEventListener`. Cancelable: `preventDefault()` stops the built-in show/close (verified). |
| `open` | Boolean attribute. SSR can emit it for **non-modal** dialogs only. |
| Pre-hydration open via `command="show-modal"` | Works natively. Hydration then logs "attributes of the server rendered HTML didn't match" because of the `open` attribute. The dialog stays modal and open, and React does not patch it. **Needs `suppressHydrationWarning` on `<dialog>`.** |
| `autoFocus` | SSR emits `autofocus`. On the client React omits the attribute and calls `.focus()` at mount, which does nothing while the dialog is closed. So client-rendered content loses its initial focus target (react/react#23301, open since 2022). Lowercase `autofocus=""` in JSX sets the attribute but logs an "Invalid DOM property" warning. |

Consequence: the Dialog listens to `toggle`, `beforetoggle` and `command` with `addEventListener`
through its ref, the conventions 7.4 pattern, and checks `event.target === dialog` because of
React's emulated bubbling. It sets `autofocus` through a ref-based attribute write, also the
7.4 pattern, for whatever part or prop the design chooses for "initial focus".

### Invoker Commands as the declarative trigger

```html
<button type="button" commandfor="d1" command="show-modal">Edit profile</button>
<dialog id="d1" aria-labelledby="d1-title">
  <h2 id="d1-title">Edit profile</h2>
  …
  <button type="button" commandfor="d1" command="request-close">Cancel</button>
</dialog>
```

This works with no JS, before hydration and from a Server Component. The browser provides:

- top layer and inertness;
- focus in, and focus back to the invoker;
- Escape;
- `ToggleEvent.source` = invoker;
- a `command` event the library can intercept.

`request-close` goes through `cancel`, so it is vetoable. `close` is not. Prefer `request-close`
for Cancel / ✕ buttons. Verified flow: `command(show-modal)` → `toggle(open)`, then
`command(request-close)` → `cancel` → `close` / `toggle(closed)`.

## What the library must still do

1. **Scroll lock.** Document the CSS above. If the design wants it built in, toggle an attribute
   on `<html>` from the Root, but CSS-only covers pre-hydration opens.
2. **Light dismiss in Safari.**
   - Without the flag: a `click` listener on the dialog that calls `requestClose()` when the
     click is outside the dialog's border box and the target is the dialog itself.
   - Behind `experimental_closedby` (or whatever the conventions' flag naming yields): render
     `closedby` and skip the JS.
   - Either way, no portals out of the dialog.
3. **`dismissible={false}` on Safari** can only be approximated. `preventDefault` on `cancel`
   holds once per user activation. Document that Escape cannot be fully blocked before
   `closedby="none"` ships in WebKit, and do not promise it.
4. **Toggle observation.** Use native `toggle` / `beforetoggle` / `command` / `close` listeners
   through the ref. Never rely on `onToggle` until react/react#37261 ships. Filter on
   `event.target === dialog`.
5. **Initial focus.** Offer one way to name the initial focus target that works on client
   render. Write `autofocus` via the ref (layout effect), and let the platform's dialog focusing
   steps do the rest. Do not call `.focus()` from JS on open: the platform order works in all
   engines once `autofocus` is present.
6. **Focus return fallback.** If the opener is gone at close time, move focus somewhere sane.
7. **Form actions.** Provide "action then close", either a Dialog-aware form or a close part
   with an action, because `method="dialog"` cannot be combined with React form actions.
8. **Labelling.** `aria-labelledby` / `aria-describedby` wiring to Title / Description parts via
   `useId`.
9. **Hydration.** `suppressHydrationWarning` on the `<dialog>`, plus mount-time reconciliation if
   the dialog was opened before hydration.
10. **Exit animation / unmount ordering.** If content unmounts on close, defer the unmount until
    `dialog.getAnimations()` settle. Otherwise the content vanishes while the dialog is still
    fading in Chromium and Safari. In Firefox there is nothing to wait for.
11. **Never render `open` on a modal dialog.** Modal open and close go through `showModal()` /
    `requestClose()` / `close()` only.

Not needed: focus trap, portal, z-index stacking, Escape keydown handler, `aria-modal`,
`aria-hidden` on siblings, `inert` on siblings, nested-dialog bookkeeping.

## Open-state ownership options

Conventions 3.5 classify `<dialog open>` as browser-owned. Two facts make Dialog different from
Tooltip, and closer to the Accordion precedent:

- Opening a dialog usually **loads content**: a form prefilled from the server, or a detail view.
  That is exactly the case where "content committed, trigger optimistic" pays off.
- The opening command is **cancelable** (`command` event, `beforetoggle(open)`). The library can
  take over the open without losing the declarative markup, which is the analogue of Accordion's
  `preventDefault` on the summary click.

Closing is different. Close requests come from Escape, back, light dismiss, `request-close`,
`method="dialog"` and the AT dismiss gesture. Only some are cancelable, and only once per
activation. Users expect Escape to close **now**.

### Option A: fully browser-owned (Tooltip model)

- **How it works.** Trigger = `command="show-modal"`. Content is always mounted (hidden by
  `display: none`). `openChangeAction` is a notification fired from `toggle`. Controlled `open`
  is re-applied after the action settles.
- **Pros.** Zero JS, RSC-friendly, works before hydration, simplest.
- **Cons.**
  - Content that suspends does so at page mount, not at open. "Load then open" is impossible.
  - Nothing is pending on open, so `data-pending` on the trigger is meaningless.
  - Always-mounted content means every dialog's data loads with the page.
  - Violates principle 1's spirit for the common "open a detail dialog" case.

### Option B: fully library-owned

- **How it works.** Open and close both go through the transition. Escape is prevented in
  `cancel` and re-dispatched.
- **Cons.**
  - Close cannot be reliably intercepted: the second Escape is not cancelable, back and light
    dismiss behave the same, and `close()` from a `method="dialog"` form is not cancelable.
  - Delaying a user's Escape behind an async action is a UX regression.
  - The model would constantly fall back to the residual browser path. That makes it B in name
    and A in practice for closes.

### Option C (recommended): two modes, as in Accordion, and in library mode open is library-owned while close is browser-owned

**JS-free mode** applies when the Root has none of `open`, `defaultOpen`, `openChangeAction`.
It is Option A exactly:

- Trigger renders `commandfor` + `command="show-modal"`; Close renders `command="request-close"`.
- Content is always mounted. The browser owns everything.
- No `data-open` (use `:open` / `:modal`). Works from a Server Component and before hydration.

**Library mode** applies when any of the three props is present.

**Open is library-owned.** After hydration the Root intercepts the `command` event (or the
trigger's click when no `commandfor` is rendered) with `preventDefault()`, then dispatches
`openChangeAction(true)` in its transition:

- The trigger shows optimistic `data-open` and `data-pending`.
- The Popup content renders from **committed** state. If it suspends, React keeps the dialog
  closed and the trigger pending until the data is ready.
- A layout effect then calls `showModal()`. Verified: a deferred `showModal()` after an
  intercepted command still focuses inside the dialog and returns focus to the trigger.
- This is the Tabs / Accordion rule, "triggers optimistic, content committed", applied to a
  dialog.

**Close is browser-owned.** Every close request closes natively and immediately:

- Escape, back, `closedby="any"`, `request-close` and `close` buttons, and `method="dialog"`
  forms all close natively, with no wait.
- The Root listens to the native `close` event and dispatches `openChangeAction(false)` as a
  notification with `details.reason: "platform"` (or a new `"dismiss"` reason, which is a
  conventions question).
- Committed state follows. A controlled parent that keeps `open={true}` gets `showModal()`
  re-applied after its action settles, as conventions 3.5 prescribe for browser-owned state.
- Library-initiated closes (an action-then-close form or Close part) are library-owned: the
  action runs, then `requestClose()` in the transition.

**Pre-hydration clicks** use the native path; mount reconciliation dispatches with
`reason: "platform"`, as in Accordion 2.3. If library-mode content is not mounted while closed,
a pre-hydration open would show an empty dialog. So library mode either renders the trigger
**without** `commandfor` until hydration (click does nothing before hydration), or SSRs the
content (`keepMounted`). That choice belongs to the design. The tension is the same one as
Accordion's lazy panels.

**`openChangeAction` stays a single prop.** It is awaited for `true` and a notification for
`false`. Document this the way conventions 3.5 documents browser-owned notifications.

**Content mounting.** In library mode the Popup's children unmount when closed by default. Use
the conventions 3.7 `keepMounted` shape, with `true` meaning `<Activity mode="hidden">`.
`"until-found"` is meaningless for a closed modal dialog and should be rejected by the type.

Why C over A: it is the only option that delivers principle 1 (Suspense-native) for the
dominant dialog use case while keeping a JS-free path. Why C over B: the platform does not let a
page reliably delay a close request, and the anti-abuse rule exists precisely to stop pages from
trapping users. The open side is where the async work happens, and it is fully cancelable.

**Optimistic open, an alternative inside C, not recommended.** Open the dialog immediately
(`showModal()` on click) and render a Suspense fallback inside it while content loads. This is
the consumer's choice: put `<Suspense>` inside `Dialog.Popup`, as conventions 6 already allow. It
does not need its own library mode.

### Design-affecting flags

- `closedby` naming and default. Modal dialogs default to `closerequest`. `dismissible` /
  light-dismiss API needs the experimental flag for `closedby` and a JS fallback otherwise.
- `openChangeAction(false)` is a notification, not a gate. A conventions note is needed, plus
  probably a `"dismiss"` reason.
- No portals anywhere in FUNSTACK overlays.
- Initial-focus API (prop on Popup vs. marker part vs. documented `autofocus`) must survive
  client render. Plain `autoFocus` does not.
- Scroll-lock delivery: CSS docs vs. Root-managed attribute.

## Corrections to earlier research

- [modern-platform-survey.md](./modern-platform-survey.md) says `requestClose()` "respects
  `closedby`". It does not: the spec says it ignores `closedby`, and `closedby="none"` dialogs
  close on `requestClose()` and `command="request-close"` in Chrome and Firefox (verified). Only
  user close requests and light dismiss consult `closedby`.
- [popover-anchor-tooltip.md](./popover-anchor-tooltip.md) and the survey treat
  `@starting-style` + `allow-discrete` as giving open/close animation everywhere. Open
  animations work in all engines. **Close animations do not run in Firefox** for dialogs or
  popovers, because Gecko does not transition `display` (BCD partial, bug 1834877). Exit
  animations are a progressive enhancement.

## Upstream issues to track (do not file; listed for a repo issue)

- react/react#37261, hydrated `<dialog>` never fires `onToggle` / `onBeforeToggle` (open; PRs
  #37262, #37293).
- react/react#37580, stop emulating bubbling for `toggle` (merged to `main` 2026-09-14,
  unreleased).
- react/react#23301, `autoFocus` inside `<dialog>` (open).
- WebKit 284592, `closedby` umbrella (in TP; not in 27.0).
- Mozilla 1834877, `display` animation (NEW).
- Chromium `DialogNewFocusBehavior` (runtime flag `experimental`).
- whatwg/html#7732, scroll lock for modal dialogs (open).
- CSSWG "Consider removing the overlay property" (open).

## References

- HTML spec, the dialog element, dialog focusing steps, close the dialog, `requestClose()`,
  `closedby`, dialog light dismiss:
  https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element
- HTML spec, close requests and close watchers (anti-abuse, grouping):
  https://html.spec.whatwg.org/multipage/interaction.html#close-requests-and-close-watchers
- HTML spec, focus delegate (dialog → sequentially focusable):
  https://html.spec.whatwg.org/multipage/interaction.html#focus-delegate
- HTML-AAM, `dialog` and the `open` attribute (aria-modal mapping):
  https://w3c.github.io/html-aam/#el-dialog
- WAI-ARIA APG, Dialog (Modal) pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- MDN browser-compat-data 8.1.6: https://github.com/mdn/browser-compat-data
- Web features explorer, `<dialog closedby>`:
  https://web-platform-dx.github.io/web-features-explorer/features/dialog-closedby/
- WebKit, Safari 27.0 features: https://webkit.org/blog/18325/webkit-features-for-safari-27-0/
- WebKit, STP 249 (close watchers, `closedby`):
  https://webkit.org/blog/18182/release-notes-for-safari-technology-preview-249/
- WebKit, STP 242 (`closedby`):
  https://webkit.org/blog/17934/release-notes-for-safari-technology-preview-242/
- WebKit, STP 251 and 252 (dialog focus fixes):
  https://webkit.org/blog/18194/release-notes-for-safari-technology-preview-251/,
  https://webkit.org/blog/18304/release-notes-for-safari-technology-preview-252/
- WebKit bugs 284592 (closedby), 314893 (VoiceOver into dialogs): https://bugs.webkit.org/
- Mozilla bugs 1834877 (display animation), 1882408 (transition-behavior meta):
  https://bugzilla.mozilla.org/show_bug.cgi?id=1834877
- Chromium, Intent to Ship: updated dialog initial focus algorithm:
  https://groups.google.com/a/chromium.org/g/blink-dev/c/CEL3wWHrTAQ
- Chromium `runtime_enabled_features.json5` (`DialogNewFocusBehavior: experimental`):
  https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/runtime_enabled_features.json5
- wpt.fyi, the-dialog-element (stable):
  https://wpt.fyi/results/html/semantics/interactive-elements/the-dialog-element?label=stable
- CSSWG, removing `overlay` (Dec 2025 discussion):
  https://lists.w3.org/Archives/Public/public-css-archive/2025Dec/0163.html
- whatwg/html#7732, prevent page scroll when a modal dialog is visible:
  https://github.com/whatwg/html/issues/7732
- react/react#37261, #37262, #37293, #37580, #23301: https://github.com/react/react
- Probes and outputs: `memo/platform-researcher/probes/04-dialog/`
