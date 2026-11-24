# Refactoring audit of `packages/ui/src` (#157)

Date: 2026-11-24, at `93b9dcb` (0.1.0-alpha.18). Read-only: no library code was changed.

Method: grep-driven survey of all non-test source (about 30.6k lines, `internal/` 90 files),
full reads of the core hooks (`use-controllable-action`, `use-action-trigger`, `report-dropped`,
`call-urgent-handler`, `use-overlay-root`, `use-popover-popup`, `use-popover-trigger`,
`use-overlay-close`, `overlay-popup`, `css-transition-cut`, `use-exit-animation`,
`content-focus-probe`, the native-group and form helpers, `render-element`, `use-render`,
the dev-warning helpers) and of `dialog-popup`, `dialog-trigger`, `dialog-root`; partial reads of
the other large roots. Not everything was read line by line, so each candidate names what was
verified and what is an inference. Test coverage is out of scope (the reviewer's
`memo/reviewer/refactor-test-safety.md`).

## 0. Summary

The core is in better shape than the size suggests. The state model (`useControllableAction`),
the pure-trigger transition (`useActionTrigger`), the dropped-rejection rule, the fact-handler
rule, the CSS transition cut, the ViewTransition boundary, `useRender` and the native-input
machinery each have **one** implementation, and component folders do not import each other (one
exception: `toast-viewport` reads `DialogContext`). No dead module and no dead function was
found; only a handful of over-exported symbols.

The mess is concentrated in four places:

1. **Two overlay popups implement the same state machine twice.** `use-popover-popup.ts` and
   `dialog/dialog-popup.tsx` each carry the apply effect, `awaitingClose`, the library-echo flag
   (`libraryHide` / `libraryClose`), `refusedFact` with the `inert` guard (#156), the `autofocus`
   write, the content probe and the hold release. Every overlay fix since #148 was made twice.
2. **Slider and NumberField duplicate the step/commit core** (two channels, `stepHeld`, `liveRef`,
   `gestureStart`, `commitSeq`, the rollback step after a rejected commit), nearly line for line.
3. **Small rules are restated per part instead of called**: the pure-trigger `whilePending`
   wiring (4 parts), "fixed at mount" props (4), reset target for a controlled value (4), intent
   reads (5 spellings), part counters (3), document-order comparators (4), focusable selectors (3).
4. **The spec is larger than the code** (31.6k lines of design docs for 30.6k lines of source)
   and is written as a history: `design/conventions.md` opens with an 85-line amendment log, and
   the component docs carry amendment tails that supersede their own bodies.

Three places where behaviour differs between components without a documented reason were found
(section 2, category B): Accordion's value order, `disabled` on `Toast.Action` / `Toast.Close` /
`Form.Submit`, and `Form.Root`'s rejections.

## 1. Rule map

Legend: **central** = one implementation, called everywhere; **duplicated** = the same logic
written more than once; **variant** = reimplemented with a difference. For a variant:
*intentional* = the difference is stated in a comment or design doc, *accidental* = no statement
found.

| # | Behaviour | Where | Status |
| --- | --- | --- | --- |
| 1 | Controllable state, optimistic value, latest-dispatch guard, burst replay for set-valued state (#150), `adopt`, `adoptFact` + `epoch` (#148) | `internal/use-controllable-action.ts` (14 importers) | **Central.** Every state owner goes through it. The only other `useTransition` owners are `use-action-trigger.ts` and `form/form-root.tsx` (row 4). |
| 2 | "What the user intends" (conventions 3.8 rule 1) | `intendedValue()` in `use-controllable-action.ts` (RadioGroup, CheckboxGroup); `ctx.intended()` in `use-overlay-root.ts:300`; inline `latestInFlight()?.next ?? optimistic` in `accordion-root.tsx:347,362`, `dialog-root.tsx:150`, `use-native-checked.ts:90,153` | **Variant, accidental.** The inline form is the one `intendedValue`'s own doc comment warns against (it drops a nullish `next`). It is safe at all five sites today (booleans and sets are never nullish), so this is a consistency issue, not a bug. `dialog-root.tsx:150` could call `intended()`, which it already has. |
| 3 | Pure-trigger transition, `whilePending`, `then` continuation, open-generation guard | `internal/use-action-trigger.ts` (6 importers: Button, `use-overlay-close`, Menu.Item, Toast.Action, and the step channels of Slider and NumberField) | **Central hook, duplicated wiring.** Each part repeats: resolve the default (`whilePending ?? "ignore"` or by ownership), pass `ignoreWhilePending`, render `aria-disabled` iff `pending && ignoring`, `data-pending`, and `preventDefault()` when `run` returned `false`. Four copies (`button.tsx`, `use-overlay-close.ts`, `menu-item.tsx`, `toast-action.tsx`). The default per part differs **intentionally** (conventions 2.5.1). |
| 4 | Dropped rejections go to `reportError` (`reportDropped`, `useConnected`; #145, #152) | `internal/report-dropped.ts`, called by the two hooks only | **Central, with one gap.** `form/form-root.tsx:106,158` owns a third `useTransition` and awaits the consumer's `action` in it with no latest / connected handling: a superseded submission's rejection, or one that settles after the form unmounted, is dropped silently. The spec is silent (field-form.md lists "superseded rejection" as N/A). **Accidental** as far as I can tell; see B3. |
| 5 | `on*` fact handlers (`callUrgentHandler`) | `internal/call-urgent-handler.ts`; callers: `use-overlay-root.ts:355` (`onOpenChange`), `combobox-root.tsx:337` (`onInputValueChange`), `toast-viewport.tsx:283` (`onClose`) | **Central.** It repeats `reportDropped`'s two-line `reportError` fallback, **intentionally** (documented: the module must stay directive-free and `report-dropped.ts` is a client module). Splitting `report-dropped.ts` would remove the copy (A7). |
| 6 | Overlay Root: mode detection, ids, close intents, open generation, `requestOpen` / `requestClose` / `notifyClosed`, `shown` mirror | `internal/use-overlay-root.ts` (Popover, Menu, Combobox, Dialog) | **Central**, but the value has grown to 20 members, two of which Dialog omits (`shown`, `setShown`) and one of which only a popover uses (`hiddenBeforeToggle`); `isShown` is an option only Dialog passes. Dialog wraps `requestClose` again in `dialog-root.tsx` for `returnValue`. See A9. |
| 7 | Overlay Popup: mount reconciliation, the apply effect, `awaitingClose`, library-echo flag, fact reporting | `internal/use-popover-popup.ts` (Popover, Menu, Combobox) and `dialog/dialog-popup.tsx` | **Duplicated.** The header of `overlay-popup.tsx` says the two "stay separate" because Dialog has `showModal` / `close` / `cancel` / `submit`; that was a fair call when it was written, but the shared part has since grown with #148, #155 and #156. The two apply effects are the same nine steps with `isPopoverOpen(el)` / `showPopover` / `hidePopover` on one side and `el.open` / `showModal`/`show` / `close(returnValue)` on the other. |
| 8 | Refused re-open (`refusedFact`, `inert` during the show; #155, #156) | `use-popover-popup.ts:132,186-215` and `dialog-popup.tsx:233,272-297` | **Duplicated**, with one **intentional** difference: Dialog applies it to non-modal dialogs only (a modal dialog must hold focus; stated in the comment and in overlay-open-change.md). The `inert` + `autofocus` + `try/finally` wrapper is otherwise the same code. |
| 9 | Initial focus | `useInitialFocusTarget`, `resolveInitialFocus` in `overlay-popup.tsx` (**central**); the `autofocus` attribute write around the show is **duplicated** (row 8); the JS-free `autofocus` write is a **variant**: in the callback ref in `use-popover-popup.ts:433-441`, in a `useEffect` keyed on a state copy of the element in `dialog-popup.tsx:357-363`. **Accidental** (same rule, two mechanisms). Menu's quiet focus (`resolveInitialFocus` option, `focus-visible.ts`) is Menu-only and intentional. |
| 10 | Focus return | `returnFocusToTrigger` in `overlay-popup.tsx`, `useContentFocusProbe` (**central** helpers). Callers differ **intentionally**: a popover records `focusWasInside` at `beforetoggle` and returns focus itself (the platform restores nothing for nested popovers); a dialog relies on the platform and only covers "opener gone" and "content unmounted before `close()`". Stated in both files. |
| 11 | Light dismiss and Escape | Popovers: the platform (`popover="auto"`). Dialog: a JS baseline inline in `dialog-popup.tsx:464-577` (document `pointerdown` + `click`, backdrop hit-test, non-modal Escape, nested-layer check), or native `closedby` behind the flag. Menu: `menu/menu-outside.ts` (outside right-click). Menu and Combobox: `listenInvokerPresses` in `internal/invokers.ts` (foreign invoker press, #126). Tooltip: `use-tooltip-interaction.ts`. Combobox: `use-deferred-leave.ts`. | **Separate by design**: each solves a different platform gap and is documented. Dialog's is the only one written inline in a component (a split seam, A4). |
| 12 | The #147 CSS transition cut | `internal/css-transition-cut.ts`; 3 call sites in `use-popover-popup.ts`, 2 in `dialog-popup.tsx` | **Central.** Every library-owned show / hide of the two popup kinds goes through it. |
| 13 | Exit hold (`held`, baseline, release) | `use-exit-animation.ts`, `useCloseHold` in `overlay-popup.tsx`; Toast uses `animationBaseline` / `exitAnimations` directly | **Central.** |
| 14 | Overlay Trigger | `internal/use-popover-trigger.ts` (Popover, Menu.Trigger, Menu.SubmenuTrigger); `combobox/combobox-trigger.tsx` and `dialog/dialog-trigger.tsx` are their own | **Variant.** `combobox-trigger.tsx:160-170` repeats the click rule of `use-popover-trigger.ts:186-203` (toggle against `intended()`, the #115 `hiddenBeforeToggle` branch); the rest of it differs **intentionally** (no server-rendered `popovertarget`, focus goes to the input). Dialog's Trigger only opens and uses `commandfor`: **intentional**. The "no Popup rendered" dev warning exists for Dialog only (`dialog-trigger.tsx:108`): **accidental**, dev-only. |
| 15 | Overlay Close part | `internal/use-overlay-close.ts` (Popover.Close, Dialog.Close) | **Central.** `PopoverCloseState` / `DialogCloseState` restate `OverlayCloseState` (public type names, fine). |
| 16 | Native checkable inputs: re-apply, mount reconciliation, form reset | `use-native-checked.ts`, `use-checkable-input.ts` (Checkbox, Switch), `group-member.ts`, `use-fieldset-group.ts` | **Central.** |
| 17 | Native-group reconciliation | `use-native-group-reconciliation.ts` (RadioGroup, CheckboxGroup, Slider, NumberField, and Select through `use-native-select-value.ts`) | **Central.** Eight options, each documented; `dispatchEqualReset` and the `path` argument exist for CheckboxGroup only (#151). Accordion has its own mount reconciliation and re-apply effect over `<details>` (`accordion-root.tsx:361-392`): **intentional** (not a form control, no reset). |
| 18 | Form reset subscription | `use-form-reset.ts` on `use-form-owner-event.ts` | **Central.** The *reset target of a controlled value* (`const [mountValue] = useState(value)`) is **duplicated** in `slider-root.tsx:488`, `number-field-root.tsx:647`, `select-root.tsx:170`, `use-combobox-form.ts:35`. |
| 19 | Step / commit channels of a continuous control | `slider-root.tsx:295-470`, `number-field-root.tsx:310-490` | **Duplicated.** Same refs, same `runCommit` with `commitSeq` and the rollback step, same `step` / `commit` skeleton, same comments. |
| 20 | Set-valued state (`useValueSet`, patches, exclusive vs multiple) | `value-set.ts`, `use-value-set.ts`, `use-item-order.ts` (helpers **central**); the exclusive-or-multiple reducer choice, the "`exclusive` fixed at mount" state + warning and the set-to-public-value conversion are **duplicated** in `toggle-group-root.tsx` and `accordion-root.tsx` | **Variant.** ToggleGroup and CheckboxGroup hand the action its array in **document order** (`compareDocumentOrder`); Accordion uses **registration order** (`accordion-root.tsx:161-168,267`), while accordion.md says document order. **Accidental**; see B1. |
| 21 | Roving focus and arrow keys | `use-roving-focus.ts` (Toolbar, standalone ToggleGroup), `use-native-focusgroup.ts`, `arrow-keys.ts`; own engines in `tabs/tabs-list.tsx` (uses `resolveArrowKey`), `menu/use-menu-keyboard.ts` and `accordion-root.tsx:182-218,394-405` (its own `NAV_KEYS` / `nextTrigger`, does not use `resolveArrowKey`) | **Four engines.** Menu and Tabs differ **intentionally** (typeahead, submenus; selection follows focus). Accordion's has no roving `tabindex`, so it cannot use `useRovingFocus`, but its key table and "next enabled item, document order, wrap" are a fourth copy of the same arithmetic: **accidental** duplication of the small part. |
| 22 | `disabled` / `aria-disabled` on button-like parts | `disabledButton`, `isHostButton`, `rendersButton` in `render-element.ts` (8 callers) | **Variant.** `button.tsx:153,208-211` computes the same thing by hand (equivalent to `disabledButton(render, disabled, { alwaysFocusable })`): accidental, no behaviour difference. `toast-action.tsx:108` and `toast-close.tsx:57` read `rest.disabled` and own nothing; `form-submit.tsx:91` always renders native `disabled`. See B2. Toggle / ToggleGroup.Item staying natively disabled inside a Toolbar while Button does not is **intentional** (toggle-group.md decision 13). |
| 23 | `useRender`, `render` prop, owned keys | `use-render.tsx`, `render-element.ts`, `merge-props.ts` (99 importers) | **Central.** |
| 24 | Dev warnings | `useDevWarning` (53 calls), `useElementCheck` (25), `warnOnce` (5, directive-free parts), `use-name-warning.ts`, `registerTrigger` | **Mostly central.** About 20 hand-rolled `useRef(false)` + `console.error` sites remain (`tooltip-root.tsx` x3, `field-root.tsx` x3, `toast-viewport.tsx` x2, `use-thumb-registry.ts` x2, `use-controllable-action.ts` x2, `transition-boundary.tsx`, `use-item-order.ts`, `radio-group-root.tsx`, `slider-root.tsx`, `select-value.tsx`, `menu-context-trigger.tsx`, `dialog-trigger.tsx`, `use-option-registry.ts`, `overlay-popup.tsx`). Message format is `Part.Name: …` everywhere except Tooltip's `[Tooltip] …` (`tooltip-root.tsx:138-152`): **accidental**. `const isDev = …` is repeated in 65 modules **intentionally** (documented in `use-dev-warning.ts`: the per-module constant is what lets the message fold away in production). |
| 25 | Hydration and JS-free mode | Mode detection: `use-overlay-root.ts:223-237` and `accordion-root.tsx:236-246` (**duplicated**, same shape and same warning text). `useHydratedMount`, `syncPresence` (**central**; RadioGroup / CheckboxGroup items, Select.Option, Tooltip). `suppressHydrationWarning` in Dialog.Popup, Select.Value, Accordion.Item. | Mode detection is a variant of "fixed at mount" (row 20). |
| 26 | ViewTransition | `useTransitionBoundary` / `transitionBoundary` (17 importers), `transitionTypes` (15). `addTransitionType` is called in `use-controllable-action.ts` and, for the step channel, by hand in `slider-root.tsx:449` and `number-field-root.tsx:450`. | **Central**, plus the step duplicate (row 19). |
| 27 | Field integration | `use-field-control.ts`, `field-context.ts`, `validity.ts` (11 importers) | **Central.** `combobox-root.tsx:278-281` resolves `name` / `disabled` from `FieldContext` by hand where `number-field-root.tsx:297` calls `resolveFieldDefaults`: accidental, no behaviour difference found. |
| 28 | Reading current props from stable callbacks | `useLatest` (insertion effect; 20 importers), `useEffectEvent` (13 files), and a hand-rolled ref written in a passive effect (`use-step-button.ts:51-54`) | **Three mechanisms**, no stated rule for which to use. The passive-effect ref is updated later than `useLatest` (after paint): **accidental**. |
| 29 | Listener attachment on a popup element | Callback ref + `useLatest` handlers in `use-popover-popup.ts:411-460` ("no passive-effect window, no extra render"); `useState` copy of the element + `useEffect` + `useEffectEvent` in `dialog-popup.tsx:220,257-268,464-577` | **Variant, accidental.** Dialog's listeners attach one render later than the element mounts, so the `beforetoggle` of a `showModal()` made in the mount commit's layout effect (`defaultOpen`) is not heard. I found no observable consequence (the two things that handler does for an open are no-ops at mount), so this is fragility, not a known bug. |
| 30 | Part counters ("is a Label mounted") | `use-register-count.ts` (Slider only, although its comment names NumberField); hand-rolled in `number-field-root.tsx:639-643` and `use-option-registry.ts:36-39,78-81` | **Duplicated.** |
| 31 | Document order | `dom-order.ts` (4 importers); inline `compareDocumentPosition` in `toast-viewport.tsx:111-114`, `use-option-registry.ts:87`, `tabs-root.tsx:163` | **Duplicated.** |
| 32 | "Focusable" selector | `use-roving-focus.ts:38`, `menu-popup.tsx:152`, `tooltip-root.tsx:57` | **Three variants**, each slightly different (`area[href]`, `iframe`, `summary`, the `contenteditable` clause). Purposes differ (roving items, "does the menu contain something focusable", "is the tooltip interactive"), but nothing states that the differences are wanted. |

## 2. Candidates

Categories: **A** internal only, no observable change. **B** aligns behaviour between
components: observable, needs a user decision. **C** touches the public API. Size: S under half
a day, M one to two days, L more. Ranked by benefit over risk; the order is also a workable
execution order (small and safe first, the overlay merge only after its helpers are shared).

### Rank 1. Share the overlay show wrapper and the echo / refused flags (A, S)

- Files: `internal/use-popover-popup.ts`, `dialog/dialog-popup.tsx`, `internal/overlay-popup.tsx`.
- What: move into `overlay-popup.tsx` (a) one `showWithFocus(element, { refused, target, show })`
  that does the `inert` guard, the `autofocus` write and the `try/finally`, and (b) one small
  hook for the three flags (`awaitingClose`, the library echo, `refusedFact`) with named
  operations (`beginLibraryHide()`, `takeEcho()`, `markFact()`, `adopted()`).
- Benefit: #155 and #156 were each made in two places; the next change to the refused rule is
  made once. It is also the first step of rank 6, and worth doing even if rank 6 never happens.
- Risk: low. Pure extraction of code that is already textually parallel; Dialog's `!modal`
  condition stays at the call site.

### Rank 2. Accordion's value order is not the documented one (B, S)

- Files: `accordion/accordion-root.tsx` (`fromSet`, `registeredValues`, `reconcileOnMount`).
- What is wrong: multiple mode sorts `next` by the order the Items **registered** (mount order,
  a `Map`'s insertion order). `design/components/accordion.md` (2.3) says document order, and
  ToggleGroup and CheckboxGroup sort by `compareDocumentOrder`. Exclusive mount reconciliation
  likewise picks "the first opened item in registration order".
- What would change for users: `valueChangeAction`'s `next` array (multiple mode) lists open
  items in document order also when Items did not mount top to bottom: an Item inserted in the
  middle later, or one inside a Suspense boundary that resolves late. Today such an Item sorts
  last. For a list rendered once top to bottom nothing changes. In exclusive mode with several
  pre-hydration opens, the winner becomes the first in the document.
- Benefit: code matches the spec and the sibling components; `fromSet` can use `sortByOrder`.
- Risk: low. A consumer that compares arrays by position could see a different order in the
  rare case above.

### Rank 3. One step/commit core for Slider and NumberField (A, M)

- Files: `slider/slider-root.tsx` (872), `number-field/number-field-root.tsx` (782), new
  `internal/use-step-commit.ts`.
- What: a hook generic in the value type that owns `live` / `liveRef`, `stepHeld`,
  `gestureStart`, `commitSeq`, `runCommit` with the rollback step, `useControllableAction` for
  the commit channel, `useActionTrigger` for the step channel, `shown` / `shownRef`, `pending`,
  and exposes `step(next, reason, event, extra)`, `commit(reason, event, extra)`,
  `openGesture()`. The components keep what differs: Slider's thumbs and pointer gesture,
  NumberField's draft text, rounding, hidden-input sync and announcements (as `onStep` hooks).
- Benefit: removes roughly 150 duplicated lines from each of the two largest components and
  makes "continuous control" (conventions 2.3 corollary) a thing with one implementation. Both
  roots drop under about 650 lines before any other split.
- Risk: medium. The two differ in small ways that must survive (`equalValues` vs `Object.is`,
  NumberField rounds before the no-op check and clears the draft inside the step, `live` is
  boxed in NumberField because `null` is a value). The reviewer's `commit-action-suite.tsx`
  already runs against both, which is the safety net to confirm first.

### Rank 4. A pure-trigger helper for the `whilePending` wiring (A, S)

- Files: `button/button.tsx`, `internal/use-overlay-close.ts`, `menu/menu-item.tsx`,
  `toast/toast-action.tsx`, `internal/use-action-trigger.ts`.
- What: `usePureTrigger({ whilePending, defaultWhilePending, openGeneration })` returning
  `{ pending, run, ignoring, pendingProps }` where `pendingProps` is `aria-disabled` iff
  `pending && ignoring` plus `data-pending`. `Button` also switches to `disabledButton(render,
  disabled, { alwaysFocusable })`, which is what its hand-written lines compute.
- Benefit: conventions 3.6's one-line rule ("`aria-disabled` while pending if and only if the
  part is ignoring") lives in one place instead of four.
- Risk: low. Button merges form-channel pending into the same attribute, so it passes its own
  `pending` in; that is the only irregular caller.

### Rank 5. `disabled` on `Toast.Action`, `Toast.Close` and `Form.Submit` (B, touches C; S)

- Files: `toast/toast-action.tsx`, `toast/toast-close.tsx`, `form/form-submit.tsx`.
- What differs today: every other button-like part owns `disabled` through `disabledButton`
  (native `disabled` on a host `<button>`, `aria-disabled` on a link or component `render`,
  `data-disabled` always, a disabled link does not navigate, `state.disabled`). The two Toast
  parts only read `rest.disabled` to skip their own work: no `data-disabled`, no
  `aria-disabled` on a non-button `render`, a disabled link `render` still navigates, and the
  state has no `disabled` field. `Form.Submit` renders native `disabled` whatever the element.
- What would change for users: `Toast.Action` and `Toast.Close` gain `data-disabled` and, on a
  link / component `render`, `aria-disabled="true"` and a cancelled click; their state types
  gain `disabled: boolean` (the category C part). `Form.Submit` with a non-button `render`
  would get `aria-disabled` instead of a meaningless `disabled` attribute (it already warns in
  development that only a button submits, so this half may be judged not worth it).
- Benefit: conventions 3.6 holds for every part; consumers style one `[data-disabled]`.
- Risk: low; additive attributes. Needs the user's yes because attributes and a state field
  appear.

### Rank 6. One overlay popup core for popovers and Dialog (A, L)

- Files: `internal/use-popover-popup.ts` (482), `dialog/dialog-popup.tsx` (625),
  `internal/overlay-popup.tsx`, `dialog/dialog-root.tsx`.
- What: after rank 1, extract the apply effect and the close bookkeeping into
  `useOverlayPopupCore(ctx, driver)`, where `driver` is the platform difference
  (`isShown`, `show`, `hide`, which events report a close, who returns focus). Dialog keeps
  `command` / `submit` handling, `returnValue`, modality and dismissal; the popover hook keeps
  `interestfor`, `whileShown`, `reshow`, `source`. As part of it, move Dialog's listeners to the
  callback ref (rule map row 29) and its JS-free `autofocus` write next to them (row 9).
- Benefit: the largest duplication in the library, and the part where the subtle behaviours of
  the last waves live (#147, #148, #155, #156). One apply effect to reason about.
- Risk: high. This is the most timing-sensitive code in the library (synchronous `beforetoggle`,
  queued `toggle` / `close`, three engines). Do it only after ranks 1 and 9, in steps that each
  keep the browser suites green on all engines, and stop if the driver interface needs more
  than about six members: at that point two readable implementations beat one abstract one.
  The row 29 change alone removes a render per Dialog mount, which is observable to a profiler
  but not to behaviour.

### Rank 7. Small shared helpers for restated rules (A, S each; can go one per commit)

1. `useMountFixed(value)` + warning: `use-overlay-root.ts:229`, `accordion-root.tsx:238,249`,
   `toggle-group-root.tsx:256`. With it, a shared `useLibraryMode(...)` for the two JS-free mode
   detections.
2. Reset target of a controlled value (`mountValue`): `slider-root.tsx:488`,
   `number-field-root.tsx:647`, `select-root.tsx:170`, `use-combobox-form.ts:35`.
3. Intent reads: replace the five `latestInFlight()?.next ?? x` with `intendedValue` or
   `ctx.intended()` (rule map row 2).
4. `useRegisterCount` in `number-field-root.tsx:639` and `use-option-registry.ts` (three counters).
5. `compareDocumentOrder` in `toast-viewport.tsx:111`, `use-option-registry.ts:87`,
   `tabs-root.tsx:163`.
6. One `internal/focusable.ts` with the selector(s) and a comment per variant that is wanted.
7. The Trigger click rule shared by `use-popover-trigger.ts:186-203` and
   `combobox-trigger.tsx:160-170` as `toggleFromTrigger(ctx, event)`.
8. `resolveFieldDefaults` in `combobox-root.tsx:278-281`.
9. `resolveArrowKey` (or a shared "next enabled, wrap" function) in `accordion-root.tsx`.
10. Split `report-dropped.ts` into a directive-free `reportDropped` and the client
    `useConnected`, so `call-urgent-handler.ts` imports it instead of repeating it.

- Benefit: each removes one place where a rule can drift; together about 150 lines.
- Risk: low each. Item 3 is the only one near subtle code and is a pure rename of semantics
  that are already equal.

### Rank 8. `Form.Root`'s rejections follow the library rule (B, S)

- Files: `form/form-root.tsx:106,158`.
- What differs today: `Form.Root` runs a function `action` in its own `useTransition` without
  the latest / connected handling the other two transition owners have. The latest submission's
  rejection reaches the Error Boundary (React's route); a rejection of a submission that a later
  one superseded, or one that settles after the form unmounted or was hidden, is dropped with
  no trace. Conventions 2.4 says such rejections go to `reportError`.
- What would change for users: those two cases fire a window `error` event (seen by monitoring
  and by test runners) instead of nothing. With `useActionState` (the documented use) the
  dispatcher does not reject, so nothing changes there.
- Benefit: "no rejection is ever silently lost" becomes true library-wide; `useActionTrigger`
  could own this transition, which removes the third `useTransition`.
- Risk: low. Verify the claim with a failing test first; I read the code, I did not run it.

### Rank 9. Split `dialog-popup.tsx` along its seams (A, S to M)

- Files: `dialog/dialog-popup.tsx` → `dialog/dialog-dismiss.ts` (the JS light-dismiss baseline,
  the non-modal Escape, `closestDialog`, `isOpenLightPopover`, `escapeBelongsToInnerLayer`,
  `onBackdrop`; about 150 lines, as a plain `listenDialogDismiss(dialog, options)` returning a
  cleanup, the shape of `menu/menu-outside.ts`) and the `command` / `submit` handlers.
- Benefit: the component drops to about 400 lines and what remains is the state machine, which
  is what rank 6 then compares against the popover hook.
- Risk: low; the functions are already closed over `dialog`, `modal`, `lightDismiss` only.

### Rank 10. Dev warnings through the three helpers, one message format (A, S; dev-only text changes)

- Files: the ~20 sites in rule map row 24.
- What: replace hand-rolled `warned` refs with `useDevWarning` / `useElementCheck` / `warnOnce`
  where the timing matches (most do), and rename Tooltip's `[Tooltip] …` messages to
  `Tooltip.Trigger: …` / `Tooltip.Popup: …`. Add the "no Popup rendered" check to the shared
  Trigger hook or drop it from Dialog (row 14).
- Benefit: one once-per-instance mechanism, all texts fold away in production by the same
  rule, consistent console output.
- Risk: low. Strictly this changes development console text, which tests assert on; no runtime
  behaviour. A few sites warn from inside handlers or once per Root across parts
  (`trigger-ref.ts`, `guardCheckableChange`) and should stay as they are.

### Rank 11. Slim the overlay hook interfaces (A, M)

- Files: `use-overlay-root.ts`, `use-popover-trigger.ts`, `use-popover-popup.ts`,
  `dialog/dialog-context.ts`, `menu/*`.
- Flag soup found: `OverlayRootValue` has 20 members; Dialog `Omit`s two and never calls a
  third; `isShown` exists for Dialog only. `usePopoverTrigger` takes `handlers`, `activate`,
  `beforeOpen`, `disabledAs`, all added for Menu (`activate` even changes which dev warning is
  printed). `usePopoverPopup` takes `initialFocus` and `resolveInitialFocus` (the second
  replaces the first), `whileShown`, `source`, and returns `reshow`, again for Menu.
- What: split the Root value into a core (state, requests, facts, intents, generation, refs)
  and a popover extension (`shown`, `setShown`, `hiddenBeforeToggle`); make the Trigger hook's
  click a parameter (`onActivate`, default the shared toggle of rank 7.7) instead of
  `activate` + `beforeOpen`; give the Popup hook one `focus` option.
- Benefit: Dialog's context type stops being "the popover one minus two"; the hooks' options
  read as a contract rather than as Menu's history.
- Risk: medium; mostly types, but Menu's three triggers depend on the exact handler order.
  Best done together with rank 6 or not at all.

### Rank 12. Split `combobox-root.tsx` and `toast-viewport.tsx` (A, M each)

- `combobox/combobox-root.tsx` (831): the file already has section banners. Extract the text
  lane (`use-combobox-text.ts`: `internalText`, `textRef`, `writeText`, `onInputValueChange`),
  the active option (`use-active-option.ts`: `activeRef`, `pendingEdge`, `autoArmed`, the two
  layout effects) and the keyboard (`use-combobox-keyboard.ts`, the counterpart of
  `menu/use-menu-keyboard.ts`). `use-combobox-form.ts`, `use-option-registry.ts` and
  `use-deferred-leave.ts` show the pattern already works here.
- `toast/toast-viewport.tsx` (671): extract focus (`sortedRoots`, `moveFocusOut`),
  announcements (`flushAnnouncements`, `queueAnnouncement`) and pause sources; `toast-timers.ts`
  and `use-modal-portal-host.ts` are the precedent.
- Benefit: each root becomes orchestration; the extracted pieces can be read alone.
- Risk: medium. These closures share many refs; a split that passes ten refs around is worse
  than the current file. Split only where the hook's interface is five members or fewer.

### Rank 13. A set-valued state core for ToggleGroup, Accordion, CheckboxGroup (A, M)

- Files: `toggle-group-root.tsx`, `accordion-root.tsx`, `checkbox-group-root.tsx`,
  `internal/value-set.ts`.
- What: `useSetValueAction({ value, defaultValue, exclusive, action, order, ... })` wrapping
  `useValueSet` x2, `useControllableAction` with the reducer choice, the set-to-public-value
  conversion and the mount-fixed `exclusive`. Accordion's `reduce(set, item, open, exclusive)`
  becomes `applyPatch`.
- Benefit: three roots share the #150 burst rule by construction; follows naturally from rank 2.
- Risk: medium. Details types differ (`{ added, removed }` vs `{ item, open }`) and
  CheckboxGroup has parent reports and the `whole` reset. Lower priority than the others
  because the shared helpers already carry most of the weight.

### Rank 14. Reorganise `internal/` (A, M mechanical)

- What: 90 flat files. Group by rule: `internal/state/` (controllable action, action trigger,
  report-dropped, urgent handler, action-details), `internal/overlay/`, `internal/native-input/`,
  `internal/group/`, `internal/render/`, `internal/dev/`, `internal/placement/`. Move modules
  with one consumer next to it: `tooltip-warm.ts` → `tooltip/`, `use-native-select-value.ts` →
  `select/`, `use-until-found.ts` → `tabs/`, `use-modal-registration.ts` stays (Toast reads the
  registry). Rename hooks that return an element (`useOverlayClose`, `useStepButtonElement`) or
  leave a note; `usePopover*` hooks that Menu and Combobox use keep their names.
- Benefit: the rule map above becomes the directory listing; conventions 9.1 shrinks to a
  pointer.
- Risk: none to behaviour, but it touches every import, so it conflicts with any parallel
  branch. Do it last, in one commit, when nothing else is open. Tests that list files
  (`isolated-files.ts`, `directives.test.ts`, `production-bundle.test.ts`) need the new paths.

### Rank 15. One rule for reading current props from stable callbacks (A, S)

- Files: `number-field/use-step-button.ts:51-54` (hand-rolled ref written in a passive effect);
  a paragraph in conventions.
- What: use `useLatest` there, and state the rule: `useEffectEvent` for functions called from
  effects, `useLatest` for values read by handlers, timers and post-`await` code.
- Risk: low; `useLatest` writes earlier than the current passive effect, never later.

### Rank 16. Label-like parts (A, S, low value)

- Files: `dialog-title.tsx`, `dialog-description.tsx`, `popover-title.tsx`,
  `popover-description.tsx` (pairwise identical after renaming), and the Label parts of Slider,
  NumberField, Combobox (register + id + `useRender`).
- What: a `renderLabelPart(...)` helper. About 15 lines saved per part; props types and docs
  must stay per part, so the gain is small. Listed for completeness; skip unless touching them.

### Housekeeping (A, S, no ranking needed)

- Over-exported, used only in their own file: `findOption`, `readResetValue`, `applySelection`
  (`use-native-select-value.ts`), `MENU_POINT_TOUCH_GAP` (`menu-point.ts`), `useStepButton`
  (`use-step-button.ts`), `RovingOrientation`, `ArrowMove`, and about 60 option / result
  interfaces. Harmless; drop `export` where no test imports them.
- Test-only exports living in source: `resetWarnOnce`, `resetFocusVisibleOption`,
  `resetInvalidBatch`, `resetToastServerWarning`. Fine, but mark them the same way (`@internal
  Tests only`) so the pattern is recognisable.
- No dead module and no unreferenced function was found (script: every `export` in non-test
  source checked for a reference outside its file).

### Stale or drifting comments found

- `internal/use-register-count.ts`: "Slider's and NumberField's Labels"; NumberField does not
  use it.
- `internal/content-focus-probe.tsx`: "shared by the popover-like Popups (Popover, Menu) and
  Dialog.Popup"; Combobox uses it too through `usePopoverPopup`.
- `internal/overlay-popup.tsx` header: "The two stay separate"; true, but it no longer says
  what is duplicated on purpose. After rank 1 it should list exactly that.
- `internal/use-action-trigger.ts`: the `run` doc comment was edited in place several times and
  reads as a log (`#146 review F1` twice, broken line wraps mid-sentence). Rewrite as the
  current contract.
- `internal/use-popover-trigger.ts:200`: "Today the show waits for the apply effect, so the
  order is not observable" describes a moment in time; say what invariant `beforeOpen` needs.
- Source comments cite design sections 342 times (`design 2.4`, `popover.md 14.2`) and issues
  31 times. The section numbers are a coupling: slimming the design docs (section 3) must keep
  numbering stable or update the citations in the same change.

## 3. Spec debt

### What has accumulated

- **Size.** `design/conventions.md` is 3,487 lines; the 22 component docs total 28,120. The spec
  is larger than the source it specifies.
- **`conventions.md` opens with its own history.** Lines 3 to 85 are a single "Status" sentence
  listing every amendment since 2026-10-15 with the sections each touched. It names things that
  no longer exist (`report-superseded.ts`, now `report-dropped.ts`; "the two-channel capture of
  #100", then "is gone"; Toast's `closeAction`; `Toolbar.Button`).
- **History inside the rules.** 352 issue references, 88 dates, 37 "amended", 33 "superseded" in
  `conventions.md` alone. Rules read like "(product-owner decision, library-wide; amended with
  Button, #79)" or "a `Button` inside a Toolbar, formerly `Toolbar.Button`". The current rule is
  there, but the reader has to subtract the history to find it.
- **"Resolved questions" (lines 3010 to 3447, 45 entries) and "Open questions"** are a decision
  log appended to the rules; several restate rules that sections 1 to 13 already hold, in the
  wording of the day they were decided.
- **Component docs are a body plus amendment tails that override the body.** `popover.md`: the
  design ends at line 1691; lines 1692 to 2474 are "Conventions feedback", "Review corrections",
  "Decisions recorded" and six amendments, one of which (#118, `aria-expanded` renders the shown
  state) is itself revised in place and then superseded by the next (#121, no `aria-expanded` on
  an invoker). `dialog.md` has the same shape from line 2189 (543 lines), including "Questions
  for the product owner (all nine accepted)". The heaviest: `button.md` (20 "superseded"),
  `combobox.md` (37 "amend"), `menu.md` (28), `popover.md` (25), `dialog.md` (18),
  `slider.md` (15 "superseded"), `tooltip.md` and `context-menu.md` (40+ review references each).
- **Contradictions and dead references**, found by spot check, not exhaustively:
  - `toggle-group.md` still specifies `Toolbar.Button` as a part (37 mentions; decisions 1 and
    13, the anatomy, the examples), with a note further down that it was removed in favour of
    `Button`. `button.md` mentions it 26 times, `conventions.md` 6.
  - `toast.md` 16 (test plan) says overlap is "N/A since #81 (one run at a time)" for
    `Toast.Action`; #146 made that `whilePending`, default by `closeOnSettle`. The same table
    still says `closeAction`.
  - `accordion.md` 2.3 says document order; the code uses registration order (candidate rank 2).
  - Files named in the docs that do not exist: `toolbar/toolbar-button.tsx` (conventions,
    button.md, toggle-group.md), `internal/toggle-button-props.ts` (toggle-group.md),
    `internal/invoker-press.ts` (menu.md, combobox.md; conventions 9.1 notes the rename inline).
  - Conventions 9.1's `internal/` listing omits `pointer-capture.ts`, `transition-boundary.tsx`,
    `trigger-ref.ts`, `use-interest-dismiss.ts`, `use-value-set.ts`, and ends with an unsorted
    "and the rest" line of eleven files.
  - `overlay-open-change.md` is a 949-line cross-cutting design that amends `popover.md`,
    `dialog.md`, `menu.md`, `combobox.md` and conventions at once; each of those carries a
    pointer amendment, so the overlay rule is now spread over six documents.
- **Sections that restate the code or the tests.** Every component doc has a "Test plan" and
  "Implementation notes" (often also "Implementation plan (developer)", "Implementation
  deviations", "For the product owner"). They were instructions for a wave that is finished;
  the tests and the code are now the truth, and these sections are where drift is likeliest.

### Proposal

1. **One changelog, append-only.** Create `design/CHANGELOG.md` (or `design/history/` with one
   file per wave if a single file is too long). Move there, verbatim and dated: the Status
   paragraph of `conventions.md`, "Resolved questions", "Open questions", and from every
   component doc the tails ("Amendment: …", "Review corrections", "Decisions recorded",
   "Questions for the product owner", "Conventions feedback", "Implementation deviations").
   Nothing is deleted; `git` and the changelog hold the reasoning. Each entry keeps its issue
   number, date and who decided (user or product owner).
2. **Fold, then cut.** Before an amendment moves out, its outcome is written into the body
   section it changes, as the present-tense rule with no "formerly", "amended" or "since #n".
   One issue reference per rule is fine where the reasoning is worth finding ("see changelog
   #148"); dates and "user decision" markers go to the changelog. A rule that was superseded is
   removed from the body, not struck through.
3. **`conventions.md` becomes rules only.** Target shape: a five-line status (current version,
   precedence, pointer to the changelog), the Decisions table, sections 1 to 13. Section 9.1's
   file listing is replaced by the grouping of candidate rank 14 (or by a generated listing);
   the migration note 13.5 moves to the changelog. Realistic target: 1,500 to 1,800 lines.
4. **Overlay rule in one place.** Fold `overlay-open-change.md` into a conventions section
   ("3.5 Requests and facts", which already exists in outline) plus short per-component deltas;
   the four component docs then say only what is theirs (Dialog's `returnValue`, Menu's stack,
   Combobox's input). This mirrors what candidate ranks 1 and 6 do in code.
5. **Component docs keep contract, drop instructions.** Keep: decisions at a glance, anatomy,
   props and types, state model, keyboard and ARIA, platform features, async walkthroughs,
   call-site examples. Move to the changelog or delete: "Implementation notes / plan /
   deviations", "For the product owner". Replace each "Test plan" by a short "Behaviour
   matrix" only where it states behaviour that no other section states; otherwise drop it
   (conventions 10.1 already lists the required coverage).
6. **Keep section numbers stable while slimming.** Source comments cite sections 342 times. Do
   not renumber surviving sections in the same change that removes text; where a cited section
   disappears (popover.md 14.x is cited from code), either keep a two-line stub that points to
   the code, or fix the citations in the same commit. A grep for `design [0-9]` and
   `\.md [0-9]` in `packages/ui/src` gives the list.
7. **Order of work.** (a) Create the changelog and move the pure-history blocks (Status
   paragraph, resolved questions, "questions for the product owner"): no rule changes, easy to
   review. (b) Fold one component at a time, starting with the ones whose amendments contradict
   their bodies (toggle-group for `Toolbar.Button`, popover for `aria-expanded`, toast for #146
   and #148, button for #81 / #146). (c) Conventions last, because every component fold tells
   which conventions text is still cited. (d) Add a check to the docs build or a test that
   fails on a `design/` reference to a source file that does not exist; it would have caught
   the four dead paths above.
8. **Going forward.** An amendment is made by editing the rule and adding a changelog entry in
   the same commit. Design docs stop growing "Amendment" headings.

### What the user should decide

- Whether history may leave the design docs at all (the proposal keeps all of it, in a
  changelog, but the docs would no longer show how a rule came to be).
- Whether "Test plan" and "Implementation notes" sections may be dropped from component docs.
- The three category B items (ranks 2, 5, 8) and whether rank 6 (the overlay merge, the one
  large and risky item) is wanted now or only its safe first step (rank 1).
