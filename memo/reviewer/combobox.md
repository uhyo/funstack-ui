# Review: Combobox (#50), 2026-10-17

Commits reviewed: 08e1d23 (ui), da70b4e, ddf1e42 (keys judged against `:popover-open`), a2451a7
(docs), 44b64e5, 3f61f1f (tests). Design: design/components/combobox.md (accepted), conventions
2.6 and 11. Verdict: **acceptable with fixes** (one H, three M; the architecture holds up: the
urgent lane, the deferred results, accept-then-close, the open-generation guard, form reset and
the hydration path are right, no rework). Local runs: jsdom 111/111; browser Chromium + Firefox
42 passed / 2 skipped (WebKit-only 302008 row). WebKit cannot be launched here: still unverified.

## Experiments (temporary files, deleted)

- P1 jsdom, B1 Chromium 156 + Firefox 157: the anatomy's async search (`<Suspense
  fallback={<Combobox.Status>}>` inside the List), `ariaNotify` spied, type "j" with the
  search unresolved. **Announced "No results" while the fallback shows**, then "3 results" on
  resolve. All three environments. BUG (H1).
- P2 jsdom: type "ja", ArrowDown (Japan active), type "p": `aria-activedescendant` still on
  Japan while the user edits. APG says otherwise (M1).
- P4 jsdom: `valueChangeAction` that throws synchronously, controlled-style
  `inputValueChangeAction` reading React's transition slot: the rollback write ("France") runs
  **inside the Root's transition** (`T != null`); the typing and accept writes do not. (M2)
- B2 Chromium/Firefox, `dir="rtl"` on a container: Chromium popup left edge = input left edge
  (166/166), Firefox neither edge (input 166..374, popup 128..338). Confirms the developer's
  deviation 1 data.
- B3 Chromium CDP AX tree during the first load: `listbox "Country"` > `status
  live=polite atomic=true` > "Searching…"; the listbox has no `busy`. (M3)
- P3 jsdom: a second Enter on the pending option (re-accept path) does not close before the
  save settles (the close transition is entangled with the pending action). No finding.

## Findings

H1 combobox-root.tsx:447, 511-528. The announcement effect reads `loading` (from `statusCount`
**state**) through its render closure. In the open commit the Status mounts and registers in a
layout effect; that sync re-render flushes the open commit's passive effects first, so the
effect sees `loading === false`, `stale === false` (the open transition rendered the new query)
and `registry.size === 0`, and announces "No results" on every open of an async combobox (P1,
B1). That is exactly the noise design 6.3/6.4 and the docs (ComboboxPage.tsx:569-571 "Nothing is
announced while results are ... loading") promise away, and it is the default behaviour of the
recommended anatomy. The comment at :517 already identified the race for `optionCount` and
switched to the registry ref; `loading` needs the same treatment (keep the Status count in a
ref updated by `registerStatus`, read it in the effect). A keyed-per-query `<Suspense>` would
hit the same race on every query. Tests: no row covers it; the browser announcement row
(combobox.browser.test.tsx:474) pre-resolves "j" and the jsdom rows never use a fallback. Add a
jsdom row (fallback inside the List, stubbed `ariaNotify`: zero calls until resolve, then "3
results").

M1 combobox-root.tsx:659-664 (`typed`), 451-469 (revalidation); design 6.5 / section 8. APG
"Editable Combobox With List Autocomplete", listbox popup keys: printable characters, Home,
End, Left and Right "move visual focus to the textbox". Here the active option survives typing
(and Home/End/Left/Right) whenever it stays mounted (P2), so (a) `aria-activedescendant` keeps a
screen reader on the option while the user edits, and (b) Enter accepts an option the user has
typed past (with `allowCustomValue`, Enter accepts the old highlight instead of committing the
typed text). The implementation follows design 6.5, so this is a design correction: `typed()`
clears the active option (`setActive(null)`; `autoHighlight` re-highlights the first option once
the results settle), and Home/End/Left/Right clear it without `preventDefault`. Needs the
architect; I'd treat it as a pre-release fix, not a v2 item.

M2 combobox-root.tsx:326-337. A `valueChangeAction` that throws **synchronously** (a plain
function, a sync validation) makes the `catch` run synchronously inside
`useControllableAction`'s `startOwnTransition` callback, so `writeText` - and the consumer's
`inputValueChangeAction` - run inside the transition (P4). Conventions 2.6: "never inside
`startTransition`"; a controlled parent's `setText` becomes a transition update. Fix: yield once
before the rollback (`await undefined;` at the top of the catch, then write and rethrow), with a
jsdom row for a sync-throwing action asserting the write is outside a transition (the `T` probe,
or a `useTransition` held as in combobox.test.tsx:463).

M3 combobox-group.tsx:151, 160; combobox-list.tsx:74. Deviation 3 makes `Combobox.Status`
inside the List the documented loading pattern (design anatomy, docs ComboboxPage.tsx:95,
117-119), which puts `role="status"` (a polite live region, B3) inside `role="listbox"`: outside
the listbox's required owned elements (option, group), so axe `aria-required-children` fails
the docs' own example, and the List is not `aria-busy` while loading (only while stale). The
library already knows "loading" (`statusCount > 0`), so: `aria-busy="true"` (and arguably
`data-stale`-like exposure) on the List while loading, and a Status inside a List rendered
without the `status` role (e.g. `role="none"` with the text left as is; the busy listbox carries
the meaning, the count is announced on settle). Architect to choose; the design's 1 / 6.3 text
should change with it.

L1 combobox-list.tsx:73. `aria-labelledby` always names `${id}-label`, also when no
`Combobox.Label` is rendered (an Input named by `aria-label` only): a dangling IDREF, and the
listbox has no name. Register the Label (as Status does) or fall back to the Input's
`aria-label`; at least a dev warning. (Group's unconditional `aria-labelledby` is Menu's
precedent; leave it.)
L2 combobox-trigger.tsx:94, 110, 117-118. `openAtPress` is cleared only by a click. A press that
never becomes a click (pointer dragged off, `pointercancel`) leaves it set; the next click that
has no pointerdown (AT activation, `element.click()`) uses the stale value and does nothing once.
Clear it on `pointercancel` / `lostpointercapture`, or ignore it when `event.detail === 0`.
L3 combobox-root.tsx:746-759. `leave()` (also from the deferred timer) has no `disabled` guard:
disabling the Root while the input is focused (a submitting form) can blur it and run the
revert / custom commit, although `disabled` documents "nothing dispatches". Usually a no-op
(commitText finds the label equal); add the guard.
L4 combobox.browser.test.tsx:525-531. The "keyboard did not reach the iframe" fallback applies
to every engine, so a Chromium/Firefox regression in the pre-hydration keyboard path would pass
with a console warning. Restrict it to `browserName === "webkit"` (the only unprobed engine).
L5 `autoHighlight` with async results: the first option of the **stale** list stays active, so
a fast "jam" + Enter accepts the first "ja" result. Probably acceptable (the Input shows
`data-stale`), but the design should say so (or Enter while stale with only an auto-highlight
waits / does nothing). Design question, no code change required.
L6 Design doc corrections to land with the deviations: 3.3 (Clear closes), 5.5 + walkthrough 4
(refusal closes), 6.3 + anatomy (Status inside List = loading, M3), 7.2 + 12.2 (container RTL
does not flip), 11.1 + conventions feedback 4 (no hidden-input `defaultValue` mirror; JS reset
target; visible input mirrored in the `reset` event), section 8 (keys judged against
`:popover-open`), 3.3 (Trigger decides at `pointerdown`), 5.2 (typing drops the pending close),
5.4 (`relatedTarget === null` deferred check).

## Checklist notes (no finding)

- Urgent lane: `typed`, `accept`, `clear`, the focusout revert, reset and mount reconciliation
  call `inputValueChangeAction` outside any transition (P4 shows the typing and accept writes
  with `T === null`); the jsdom row at :463 proves typing stays in sync while a pending save
  holds every transition. The only leak is M2.
- Deferred results: `query = useDeferredValue(text)`, `stale` on Popup / List / Input,
  `aria-busy` while stale, old results kept, no out-of-order results (row :565). The design's
  section 4 lane claim is verified (jsdom + both engines; React source agrees).
- Accept: text at once, optimistic `aria-selected` / `data-selected` / `data-pending` on the
  target, hidden input follows, close in the settling commit; latest-dispatch + open-generation
  + unchanged-text guards (`DispatchMeta` keyed by the details object) are correct; superseded
  rejections reach the boundary; rejection rolls back text and stays open.
- APG: `role=combobox`, `aria-autocomplete=list`, `aria-expanded` (optimistic), `aria-controls`,
  `aria-activedescendant` removed on close and when the option unmounts, never dangling;
  listbox/option/group roles; `aria-selected` only on the selection; Trigger/Clear
  `tabindex=-1`; focus never leaves the input (pointerdown + mousedown prevented on Popup,
  Option, Trigger, Clear). Escape left to the platform (Dialog / Popover nesting rows pass).
- Form: hidden input `value={optimistic ?? ""}`; reset target per conventions 3.8 rule 6; the
  `onResetEvent` third argument of `useFormReset` is minimal and correctly ordered before the
  reset algorithm; the controlled-text resync after reset is covered. Enter-to-submit with
  `flushSync` (Firefox) is right: `setOptimistic` is a sync-lane update, so `flushSync` commits
  the hidden value before the implicit submission; browser row passes in both engines.
- Announcements: default English strings, `announce` override, `null` silences, nothing while
  stale, keyed by count + query; all fine apart from H1.
- API: names, owned keys and data attributes follow conventions 1.2 / 4.1; types exported from
  the subpath and the root (`UrgentChangeAction` included); every part file `"use client"`.

## Deviation verdicts

1. RTL only page-level: **accept for v1.** B2 reproduces it (logical keywords resolve against
   the top-layer containing block). Correct design 7.2 / 12.2. Record a repo issue for a
   follow-up: read the input's `direction` at open (Popover/Menu already read computed style
   for their physical matrix) and pick `span-left` / `span-right`, or adopt
   `span-self-inline-end` once Firefox supports it.
2. Hidden input cannot mirror `defaultValue`: **accept.** Correct per spec (type=hidden is in
   value mode "default": `.value` is the attribute and reset changes nothing). Fix the design
   11.1 sentence and conventions feedback 4's "named pattern".
3. Status inside the List means loading: **accept the heuristic, with fixes:** H1 (the effect
   must read the count from a ref), and M3 (`aria-busy` while loading; no `role=status` inside
   the listbox). Document that a non-fallback hint must go in the Popup (it does).
4. Controlled refusal closes the listbox: **accept.** Adoption by an "update on success" parent
   is only visible after the action's commit, which is the commit that closes; deferring the
   close would split it from that commit (and from its view transition). Text and selection
   revert, which is what matters. Update 5.5 / walkthrough 4.
5. Clear while open closes (light dismiss): **accept.** Re-opening would flash and run an open
   transition; the Trigger is one click away. Docs already say it (ComboboxPage.tsx:369).

Added behaviours:
- Keys judged against `:popover-open`: **accept.** It fixes a real Escape-then-Enter race and
  matches "what the user sees"; corollary (Enter during a still-committing open submits a form
  while `aria-expanded="true"`) is consistent with the same rule.
- Trigger reads its state at `pointerdown`: **accept** (light dismiss runs before the click);
  L2 for the stale value.
- Deferred `focusout` with `relatedTarget === null`: **accept.** Also the right behaviour for
  Safari/macOS, where clicked buttons do not take focus; window blur stays a no-op via
  `document.hasFocus()`. L3 for the missing disabled guard.
- Typing cancels the pending close: **accept.** The value still commits; closing under a user
  who is typing a new search would be wrong. Record in design 5.2.

## Repo issue to record (human)

- "Combobox: container-level `dir=rtl` does not flip the listbox (logical `position-area`
  keywords resolve against the top-layer containing block; Firefox lacks
  `span-self-inline-end`)" - follow-up for deviation 1.
