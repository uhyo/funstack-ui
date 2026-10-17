# Toast: top layer, announcements, timers and dismissal

Date: 2026-10-17. GitHub issue #55 (wave 5). Engines probed: Chromium 156.0.8078.4 and Firefox
157.0 (Playwright 1.64.1). WebKit still cannot launch locally, so WebKit rows come from BCD and
vendor sources and are marked as such. Current stable versions: Chrome 155 (chromiumdash,
155.0.8059.85), Firefox 158, Safari 27 (BCD 8.1.6, 2026-10-15). Probes:
`memo/platform-researcher/probes/12-toast/` (Playwright probes plus a jsdom React probe).

## Summary and verdict

**Adopt** a single `popover="manual"` **region** (a labelled `<section>`) as the toast viewport,
`Element.ariaNotify()` / `Document.ariaNotify()` as the announcement channel (no `aria-live`), Invoker
Commands for the close button only where it targets a popover, `@starting-style` for enter
animations, and plain Pointer Events for swipe. **Not yet:** `interestfor`, `scrollsnapchange`,
element-scoped view transitions. **No platform toast exists**: the Chromium `<toast>` proposal is
"No longer pursuing" (chromestatus 5674896879255552), and APG has no Toast pattern.

Three findings change the API design:

1. **A toaster outside an open modal `<dialog>` is inert and absent from the accessibility tree**,
   even when it is raised above the dialog in the top layer (verified in Chromium and Firefox).
   Live-region toasts are therefore silent while a modal is open. The viewport must be
   rendered inside the topmost open modal dialog, or announce through `document.ariaNotify()`.
   WHATWG issue #9936 ("A popover on top of a modal dialog should be interactable") is still open.
2. **Toast queue updates must be urgent, not transitions.** While any async action is pending
   anywhere in the app, React 19.3.1 holds every transition update until that action settles
   (react-async-apis.md §2). A toast pushed with `startTransition` while a form submit is pending
   would not appear until the submit finishes. This is a justified exception to "transition by
   default" (vision.md: "unless there is a specific reason for urgency"). It also means React
   `<ViewTransition>` cannot animate toast enter/exit; CSS does it.
3. **Announcement is `ariaNotify()`, not a live region.** It is interoperable as of Safari 27
   (Sept 2026), works regardless of the region's DOM state, and avoids the inert-region and
   "live region must pre-exist" problems. The library should still keep announcement behind one
   internal function so the strategy can be swapped after screen-reader testing.

| Feature | Blink | WebKit | Gecko | Verdict |
| --- | --- | --- | --- | --- |
| `popover="manual"` (top layer, no light dismiss, no Escape) | 114 | 17 | 125 | **adopt** |
| `Element.ariaNotify()` / `Document.ariaNotify()` (`priority: "normal" \| "high"`) | 141 (flag `AriaNotify` stable) | 27 (BCD) | 150 (bug 2018095) | **adopt** |
| `@starting-style` (enter animation) | 117 | 17.5 | 129 | **adopt** |
| `transition-behavior: allow-discrete` for `display` (exit animation of the region) | 117 | 18 | ✗ (bug 1882408) | progressive enhancement |
| Invoker Commands (`command="hide-popover"`, `request-close`) | 135 | 26.2 | 144 | **adopt** where applicable |
| Pointer Events + `setPointerCapture` + `touch-action` (swipe) | ✓ | 13 | ✓ | **adopt** |
| `scrollend` | 114 | 26.2 | 109 | possible (scroll-snap swipe) |
| `scrollsnapchange` / `scrollsnapchanging` | 129 | ✗ | ✗ | **not yet** |
| `Element.startViewTransition()` (scoped) | 147 | ✗ | ✗ | **not yet** |
| `interestfor` / `interest` events | 142 | ✗ (position: negative) | ✗ (position: neutral) | **not yet** |
| `popover="hint"` | 151 | Safari TP only | 153 | not useful for Toast |
| `<toast>` element | No longer pursuing | – | – | n/a |

## 1. Top layer: `popover="manual"`

### Why `manual`

| Popover type | Shown when another popover opens | Light dismiss | Escape | Fit for toasts |
| --- | --- | --- | --- | --- |
| `auto` | closes unrelated auto popovers, and is closed by them | yes | yes | no: opening a toast would close the user's open menu |
| `hint` | closes other hints | yes | yes | no; Safari 27.0 lacks it |
| `manual` | independent | no | no | **yes** |

Probe results (`toast-platform.mjs`, Chromium 156 and Firefox 157, identical):

- `showPopover()` on a manual region **does not move focus** and **does not close an open auto
  popover** (menu stays open, focus stays on the menu item).
- **Escape** inside an open auto menu closes the menu only. Escape with focus inside the manual
  region does nothing, so the library must handle Escape itself (dismiss the focused toast, or
  return focus to where the user was, as Base UI and React Aria do).
- A **click inside the region light-dismisses an open auto popover**, because the region is not
  in the popover's ancestor chain. That is the expected "click outside" behaviour.
- **Re-raising**: the most recently shown top-layer element paints on top. A dialog or menu
  opened after the region covers it. Synchronous `hidePopover(); showPopover()` raises the region
  again, **keeps focus inside it** and does not close an open auto popover (`reshow-focus.mjs`).
  It fires `beforetoggle`/`toggle` (closed→open, coalesced), so listeners must tolerate it.

### One region popover, not one popover per toast

Recommend **one** region element that holds the list. Per-toast popovers would each need their
own stacking, would split the landmark, and each `showPopover()` would reorder the top layer. The
region is a landmark: `<section popover="manual" aria-label="Notifications">` (a named `section`
maps to `region`; confirmed in the Chromium AX tree). Inside it, an `<ol>`/`<li>` list gives
screen readers the count. Show the region while it has toasts. An empty, shown region must not
capture clicks (`pointer-events: none` when it has no items).

### Modal dialogs (the important caveat)

`showModal()` makes everything outside the dialog subtree inert, and the top layer does not
change that. Verified in Chromium and Firefox:

- Region shown before `showModal()`: the dialog covers it.
- Region re-shown **after** `showModal()` (so it is above the dialog in the top layer): hit
  testing skips it (`elementFromPoint` returns the dialog), `focus()` on a toast button fails,
  real mouse clicks do not reach it.
- Chromium AX tree: the region, its text and its buttons are present before the modal opens and
  **completely absent** while it is open. Any `aria-live` region inside it would be silent.
- A manual popover that is a **DOM descendant of the dialog** is focusable and clickable. It stays
  `:popover-open` after the dialog closes but is not rendered (`checkVisibility()` false), so the
  library must move it back.

This matches dialog.md ("never portal anything out of a Dialog"). WHATWG HTML #9936 proposes
making such popovers interactive. It is open (42 comments, last activity 2026-06-26), and one
maintainer noted that interactivity without making the popover an accessibility child of the
modal would not be enough. Do not wait for it.

Recommendation: the Toaster portals its viewport into the **topmost open modal dialog** when one
exists (the library's own Dialog can register itself; a document-wide fallback is
`document.querySelectorAll("dialog:modal")`, last match). It moves back to its home container when
the dialog closes. Announcements go through `document.ariaNotify()` when the viewport is not in
the topmost modal (see §2), so they are not lost during the move.

## 2. Announcement: `ariaNotify()` instead of live regions

### Support

`Element.ariaNotify(announcement, { priority })` and `Document.ariaNotify(...)`: Chrome 141,
Firefox 150, Safari 27 (BCD 8.1.6; Chromium flag `AriaNotify` stable on all desktop platforms in
the 155 branch, `AriaNotifyV2` is test-only). MDN marks it "Baseline 2026, newly available since
September 2026". Mozilla position positive (standards-positions #1049), WebKit "support" (#370).
Spec: WAI-ARIA `ARIANotifyMixin` (w3c/aria PR #2577).

Semantics (MDN): `priority: "normal"` (default) queues after current speech like
`aria-live="polite"`; `"high"` interrupts like `assertive`. Live-region announcements take
priority over `ariaNotify()`. No user activation needed. Voice language comes from the element's
`lang` (or nearest ancestor). Controlled by the `aria-notify` Permissions Policy; a blocked call
fails silently.

### Why it fits Toast better than `aria-live`

| Concern | `aria-live` / `role=status` region | `ariaNotify()` |
| --- | --- | --- |
| Region must exist and be exposed before content changes | yes; a popover that was `display:none` and is shown with content may not announce | n/a |
| Inert region (modal open) | silent (verified: not in AX tree) | `document.ariaNotify()` still works |
| What is read | the DOM text, including button names ("Undo, button") unless carefully marked | exactly the string the library composes (title + description) |
| NVDA quirks | React Aria toggles `aria-hidden` after mount because NVDA otherwise skips the toast | none known |
| Suspense content | announced when the fallback renders, again when revealed (or not at all) | library calls after the content commits |
| Double announcement risk | – | must not combine with a live region |

### Caveats

- **macOS VoiceOver may drop an announcement** when another accessibility event fires at the same
  time (BCD note, all engines, BCD issue #29610). Toasts usually appear right after a click,
  which itself produces focus/state events. Announce after commit, not in the click handler.
- **Several calls in a row are unreliable**; MDN advises combining. A burst of toasts should be
  coalesced into one string per frame.
- **Element target must be in the accessibility tree.** Chromium's `HandleAriaNotification`
  returns early when the node has no AX object (for example `display: none`). Calling on an
  element inside an inert region is unverified. Use the toast element when it is exposed and
  `document` otherwise (or always `document`, setting `lang` concerns aside).
- **Shadow trees:** Firefox bug 2082506 (NEW, filed 2026-10-16): `Element.ariaNotify()` does nothing
  for elements in a shadow tree. Not relevant to FUNSTACK UI's light-DOM output, but it argues
  for `document.ariaNotify()` as the default target.
- **AT coverage is not something BCD measures.** Browser support is complete; per-screen-reader
  behaviour (NVDA, JAWS, Narrator, VoiceOver, Orca) has not been verified here. Keep the
  announcement behind one internal `announce(text, priority)` function so a live-region fallback
  can be swapped in if AT testing finds gaps.

### Roles

Without a live region, a toast needs no `status`/`alert` role. Options:

- `<li>` with the title/description inside (Sonner-style). Simple, and correct when the toast is
  not focusable as a whole.
- `role="alertdialog" aria-modal="false"` with `aria-labelledby`/`aria-describedby` (React Aria,
  Base UI for high priority). This exposes dialog semantics without dialog behaviour; only worth
  it if the toast itself takes focus.

Recommend the list item, with focusable controls (close, action) inside it.

## 3. Keyboard access and the hotkey

APG has no Toast pattern. The Alert pattern says alerts must not affect keyboard focus and that
alerts that disappear automatically can fail WCAG 2.2.3. The landmark region is reachable through
screen-reader landmark navigation, but sighted keyboard users need a hotkey:

| Library | Hotkey | Notes |
| --- | --- | --- |
| Radix Toast 1.3.1 | **F8** (configurable `hotkey`), label "Notifications (F8)" | |
| Base UI 1.9.0 | **F6**, global `keydown` listener with `preventDefault()` | Overrides the browser's own F6 |
| React Aria 3.53 | **F6** via its landmark manager (cycles all landmarks) | Library-wide landmark navigation |
| Sonner 2.0.8 | Alt+T | |

F6 is the browser's pane-cycling key (address bar ↔ page) in Chrome and Firefox on Windows and
Linux. Taking it over globally is hostile unless the library implements full landmark cycling,
as React Aria does. Recommend a configurable `hotkey` with **F8** as the default, the shortcut in
the region's accessible name ("Notifications (F8)"), and Escape or Shift+Tab out of the region
returning focus to the element focused before the hotkey. Pause all timers while focus is inside.

## 4. Timers: pause on hover, focus, hidden tab

- **Pause triggers:** `pointerenter`/`pointerleave` and `focusin`/`focusout` on the region,
  `visibilitychange` (`document.hidden`), and window `blur`/`focus`. All are Baseline. Base UI
  pauses on all of these; React Aria on hover and focus.
- **Pausing only helps sighted users.** A screen-reader user hears the announcement once; the
  action button is gone when the timer ends. WCAG 2.2.1 (Timing Adjustable, level A) applies to
  toasts that contain actions. Recommend no auto-dismiss by default for toasts with an action,
  and document that an action must also be reachable elsewhere if a timeout is set.
- **CSS option (not recommended as the source of truth):** an `animation` on the toast with
  `animation-play-state: paused` under `:hover`/`:focus-within` could drive dismissal via
  `animationend`, with no JS. It cannot see window blur or a hidden tab, and it hides the timer
  from React. Use it only as a visual progress indicator.
- **`interestfor`** is Chromium-only (WebKit negative, Mozilla neutral) and does not help here:
  `interest` events fire on an interest target shown from an invoker, not on hover over an
  arbitrary region.

## 5. Dismissal: close button, swipe

- **Close button:** a plain `<button type="button">` calling the library. Invoker Commands
  (`command="hide-popover"`) only apply when the *whole region* should close, which is never the
  case for a single toast. Keep it in JS.
- **Swipe:** Pointer Events with `setPointerCapture`, plus `touch-action: pan-y` (horizontal swipe)
  or `pan-x` (vertical) on the toast so the page can still scroll in the other axis. All Baseline.
  This is what Base UI (`swipeDirection`, default down and right) and Radix do.
- A CSS scroll-snap swipe (a horizontal scroller per toast, dismissed on `scrollend`) would give
  native momentum, but mouse users cannot drag it, and the only reliable "snapped to the dismissed
  position" event (`scrollsnapchange`) is Chromium-only. Not yet.
- WCAG 2.5.1 (Pointer Gestures): swipe must never be the only way to dismiss. The close button
  and Escape satisfy that.

## 6. Animation

- **Enter:** `@starting-style` on the toast (Chrome 117, Safari 17.5, Firefox 129). It works on
  elements inserted into the DOM, which is what an urgent React commit does.
- **Exit:** the library keeps the toast mounted with `data-ending` until
  `Promise.all(el.getAnimations().map(a => a.finished))` resolves, then removes it (the Base UI
  "transitionStatus" pattern). Height collapse of the stack uses
  `grid-template-rows: 1fr → 0fr`, which animates in every engine (`interpolate-size` is flagged,
  modern-platform-survey.md).
- **Region exit** (`display` + `overlay` with `allow-discrete`) does not animate in Firefox
  (bug 1882408); the region only hides when empty, after the last toast's exit, so this does not
  matter.
- **`<ViewTransition>` does not fit:** it only runs for transition commits (finding 2). A document
  view transition would also block hit testing for its duration in Firefox
  (view-transition-mount-cost.md), and toasts often arrive while the user is typing or clicking.
  Element-scoped view transitions (Chrome 147, Chromium-only) would fix the scope but not the
  lane problem. Not yet.
- Respect `prefers-reduced-motion` in the documented CSS recipe.

## 7. React 19.3 interaction

- **Imperative API, React-owned state.** `toast(...)` is called from anywhere, including action
  bodies and Server Function results. Keep the queue in a `useState`/`useReducer` inside the
  `Toaster` and have `toast()` call its registered dispatcher. **Do not** use
  `useSyncExternalStore` for it (react-async-apis.md: store mutations during a transition force a
  blocking re-render).
- **Urgent dispatch** (finding 2). Probe `toast-lanes.mjs` (jsdom, React 19.3.1), with an
  unrelated async action pending:

  | `toast()` called | Toast visible |
  | --- | --- |
  | outside any transition | immediately |
  | synchronously inside `startTransition(() => ...)` | **only after the unrelated action settles** |
  | from `queueMicrotask` scheduled inside `startTransition` | immediately |
  | after `await` inside an async `startTransition` | immediately |

  So a consumer who calls `toast()` from the sync part of an action (or a library action prop's
  sync prefix) gets a held toast. The dispatcher should escape the caller's transition, for
  example by dispatching from a microtask. Held updates still apply in call order, so the
  queue order stays correct.
- **Promise toasts** (`toast.promise(p, {loading, success, error})`): one toast whose content is
  updated urgently when `p` settles. Do not model it with Suspense: a suspended toast in an urgent
  commit shows its fallback, which is fine, but the announcement must be issued on settle, not on
  the reveal.
- **Suspense inside toast content:** wrap each toast in its own `<Suspense>` so one slow toast
  cannot hide others; announce after the content commits (layout effect), using the composed
  string, not `textContent` of a fallback.
- **Pending state:** an action button inside a toast (`Undo`) is an ordinary action prop with
  `data-pending`. While it is pending, the toast's timer must be paused, or it disappears with
  the pending action.
- **SSR:** toasts are client-only. The `Toaster` renders its empty region on the server; the
  `popover` attribute serialises fine in React 19.3 (no hydration issue), and `showPopover()` runs
  in an effect when the first toast arrives.

## 8. Recommendation for the architect

1. **Anatomy:** `Toaster` (provider + `<section popover="manual" aria-label="Notifications (F8)">`
   + `<ol>`), `Toast.Root` (`<li>`), `Toast.Title`, `Toast.Description`, `Toast.Action`
   (action prop), `Toast.Close`. Imperative `toast()` returning an id, plus `dismiss(id)`.
2. **Top layer:** one manual popover. Re-raise (`hidePopover(); showPopover()`) when a new toast
   arrives after another top-layer element opened. Portal into the topmost open modal dialog and
   back.
3. **Announcements:** `ariaNotify()` with `priority: "high"` only for `type: "error"`. No
   `aria-live` on the region. One internal `announce()` so a live-region fallback can replace it.
4. **State updates:** queue mutations are urgent. Document this as the second explicit urgent
   exception to "transition by default" (after text input).
5. **Timers:** default 5 s; pause on hover, focus inside, hidden tab, window blur, and while an
   action in the toast is pending. Default to no timeout when the toast has an action.
6. **Keyboard:** configurable `hotkey`, default F8. Escape inside the region dismisses the focused
   toast; focus returns to the previously focused element when the region is left or emptied.
7. **Swipe:** optional `swipeDirection`, Pointer Events + `touch-action`. Never the only dismissal.
8. **Animation:** `@starting-style` enter, `data-ending` + `getAnimations()` exit, grid-row collapse.
   No `<ViewTransition>` for Toast.
9. **Testing:** browser tests for the modal-dialog case (inertness, portal move) and re-raise;
   jsdom for timers and queue. Record a manual screen-reader pass (NVDA + Chrome/Firefox, VoiceOver
   + Safari) for `ariaNotify()` before the component leaves experimental.

## References

- BCD 8.1.6 (2026-10-15): https://unpkg.com/@mdn/browser-compat-data@latest/data.json
  (`api.Element.ariaNotify`, `api.Document.ariaNotify`, `html.global_attributes.popover`,
  `css.at-rules.starting-style`, `css.properties.transition-behavior`, `api.Element.scrollsnapchange_event`,
  `api.Element.startViewTransition`, `html.elements.button.interestfor`, `html.elements.button.command`)
- Chromium 155 branch (8059) runtime flags (`AriaNotify` stable, `AriaNotifyV2` test):
  https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8059/third_party/blink/renderer/platform/runtime_enabled_features.json5
- Chromium `AXObjectCacheImpl::HandleAriaNotification`:
  https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/modules/accessibility/ax_object_cache_impl.cc
- chromestatus ARIA Notify API: https://chromestatus.com/feature/5745430754230272 ;
  Toast UI element (no longer pursuing): https://chromestatus.com/feature/5674896879255552 ;
  Interest Invokers: https://chromestatus.com/feature/4530756656562176
- MDN `Element.ariaNotify()`: https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaNotify
- Mozilla bugs: 2018095 (ship ariaNotify, Firefox 150), 2082506 (shadow tree), 1882408 (display
  transitions): https://bugzilla.mozilla.org/show_bug.cgi?id=2082506
- WHATWG HTML #9936, popover above modal dialog interactable (open): https://github.com/whatwg/html/issues/9936
- APG patterns index (no Toast): https://www.w3.org/WAI/ARIA/apg/patterns/ ; APG Alert:
  https://www.w3.org/WAI/ARIA/apg/patterns/alert/
- WCAG 2.2: 2.2.1 Timing Adjustable, 2.2.3 No Timing, 2.5.1 Pointer Gestures, 4.1.3 Status
  Messages: https://www.w3.org/TR/WCAG22/
- React Aria toast source (react-aria 3.53.1 `dist/private/toast/useToast.mjs`, `useToastRegion.mjs`):
  https://unpkg.com/react-aria@3.53.1/dist/private/toast/useToast.mjs ; docs:
  https://react-aria.adobe.com/Toast/useToast.html
- Base UI 1.9.0 toast (`toast/viewport/ToastViewport.mjs`, `toast/root/ToastRoot.mjs`):
  https://unpkg.com/@base-ui/react@1.9.0/toast/viewport/ToastViewport.mjs
- Radix Toast 1.3.1 (F8 hotkey): https://unpkg.com/@radix-ui/react-toast@1.3.1/dist/index.mjs
- FUNSTACK research: dialog.md (portals and inertness), react-async-apis.md §2 (entanglement),
  view-transition-mount-cost.md (hit testing during a view transition), modern-platform-survey.md
- Probes: `memo/platform-researcher/probes/12-toast/`
