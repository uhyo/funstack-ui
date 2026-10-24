# Architect notes: Combobox (#50), 2026-10-17

Working notes behind `design/components/combobox.md`. Not a spec.

## Prior art read for this design

- Base UI (1.6): separate `Combobox` ("filterable Select, no free text") and `Autocomplete`
  (`value` is the text; `mode: list | both | inline | none`). Parts: Root, Label, InputGroup,
  Input, Trigger, Icon, Clear, Value, Chips/Chip/ChipRemove, Portal, Backdrop, Positioner,
  Popup, Arrow, Status, Empty, List, Row, Item, ItemIndicator, Group, GroupLabel, Separator,
  Collection. Root props: value/defaultValue/onValueChange, inputValue/defaultInputValue/
  onInputValueChange, filter (or null), filteredItems, items, autoHighlight, highlightItemOnHover,
  multiple, name/form/autoComplete, open/defaultOpen/onOpenChange, isItemEqualToValue,
  itemToStringLabel, openOnInputClick (Autocomplete), submitOnItemClick (Autocomplete).
  Async: `filter={null}`, fetch in onInputValueChange with AbortController, `aria-busy` on Popup.
- React Aria `ComboBox`: one component, `allowsCustomValue` (text reverts on blur without it),
  `inputValue`/`onInputChange`, `selectedKey`/`onSelectionChange`, `menuTrigger: input|focus|manual`,
  `loadingState`, `formValue: "text" | "key"`.
- Ark UI `Combobox`: `allowCustomValue`, `inputBehavior: autohighlight|autocomplete|none`,
  `selectionBehavior: replace|clear|preserve`, `openOnClick`, `loopFocus`.
- Headless UI `Combobox`: `value/onChange`, `Combobox.Input displayValue`, `onChange` for query,
  `immediate`, `nullable`, `virtual`.

Borrowed: Empty/Status/List/Popup split (Base UI), `allowCustomValue` + blur revert (React Aria),
`openOnClick` / `loop` (Ark), `autoHighlight` (Base UI/Ark). Rejected: `items`/`filter`/
`itemToString` (Server Component boundary, duplicates options, not Suspense-shaped), Portal/
Positioner/Arrow, Chips (v1), `displayValue` (two explicit states instead).

## Decisions I went back and forth on

- **Urgent action naming.** Three candidates: `onInputChange` (first `on*` ever; would be
  copied), `inputValueAction` (reads as a pure trigger), `inputValueChangeAction` typed
  `UrgentChangeAction`. Chose the third: the triple survives, the type carries the lane. The
  cost is that the name does not shout "urgent"; the type and the doc comment do.
- **Active option lane.** Considered a transition (everything is transition). Rejected because
  arrow-key navigation would freeze while any async action is pending (entanglement), and
  because activedescendant is focus, which is urgent/browser-owned everywhere else. Rule
  proposed for conventions: virtual focus is urgent.
- **Hidden input location.** Root renders it as its single element (conditional on `name`).
  Alternatives: a `HiddenInput` part (noise), the Input rendering two elements (breaks the one-
  element rule), a wrapper div (unasked-for element, wrong anchor box).
- **Popup vs List.** The research's single `role=listbox popover=auto` element cannot hold
  Empty/Status. Two parts; `aria-controls` → List, `showPopover` on Popup.
- **Close after accept.** Followed Menu decision 3 (stay open with data-pending, close in the
  settle commit). Text changes at once; rollback reverts it. Escalated as question 4.
- **Label derivation.** Library writes text only on accept (label read from DOM at that
  moment), revert, Clear, reset, mount. Never from a `value` prop change. Preselected values
  need `defaultInputValue`. Dev warning at mount. Escalated as question 3.
- **Escape.** Not intercepted; platform close watcher handles it; second Escape reaches an outer
  Dialog. Dropped "Escape clears" (APG optional). Escalated as question 9.
- **Tab accept.** No. Escalated as question 5.
- **Trigger `commandfor`.** No: the anchor must be the input. Escalated as question 8.
- **`announce` default.** None (no shipped strings). Escalated as question 6.
- **Logical `position-area`.** `block-end span-inline-end` instead of the shared physical
  helper; RTL for free; no side/align props.

## Things to verify during implementation

- `useDeferredValue` re-render is NOT entangled with a pending async action (section 4's claim;
  browser row "typing while a save is pending"). If it is, document and move on; the design
  does not depend on it beyond that sentence.
- React's optimistic sync flush happens before implicit form submission on Enter (hidden input
  carries the new custom value in FormData), in all three engines.
- `useDeferredValue` + `use()` inside the List: a *newly mounted* boundary shows its fallback
  (first open) but an already-shown one keeps old results under a deferred update. Confirm
  there is no fallback flash when the List's children function identity changes per render.
- react-dom keeps the DOM value of a hydrated text input and fires no onChange (mount
  reconciliation reads it in a layout effect; `suppressHydrationWarning` on `value` may be
  needed — check whether hydration warns about a value attribute mismatch; it should not, since
  React compares the `value` *attribute* for inputs? Verify).
- `encodeURIComponent(value)` as an id fragment: characters `!'()*` are left as is and are valid
  in ids; fine. Empty-string value → id `..-option-`; allowed but discourage `""` values.
- Firefox form-state restoration of the visible text input across reloads arrives through mount
  reconciliation; the hidden input is not restored (hidden inputs are not autofilled/restored).
- WebKit 302008 with `flip-block` on the listbox inside Popover (dedicated row).
- `ariaNotify` on an element inside a popover: announced? (Chromium 141+, Firefox 150, Safari 27.)
- `onPointerDown preventDefault` on the Popup also blocks text selection inside options and the
  scrollbar drag? Scrollbar drag still works with preventDefault on pointerdown in Chromium (the
  scrollbar is not a pointer target for the event's default action of focus change… verify in
  Firefox / WebKit; fallback: prevent only when `target.closest('[role=option]')`, and accept the
  blur-on-scrollbar case through `relatedTarget === null`? No: scrollbar clicks focus nothing; the
  input keeps focus in Chromium. Verify).

## Status

Design written and committed as proposed; eleven questions for the product owner; conventions
changes listed in the doc (not applied: another session owns conventions.md today).

## After acceptance (2026-10-17)

Accepted with one user override: `announce` ships a default English message ("No results" /
"1 result" / "N results"), overridable, `null` to silence. New conventions section 11 (built-in
strings: English defaults, accessibility-only, always a function prop, no locale mechanism).
Conventions feedback 1 to 12 applied (2.6 urgent lane, 3.2 virtual focus row, 3.5 residual
paths, 1.1 vocabulary, 4.1 rows, 5.1 deferred note, 5.3 types, 7.3, 8, 9.4, 10.1 row,
resolved question 27, decisions row 11).

## After review (2026-10-17)

Folded `memo/reviewer/combobox.md` (H1, M1-M3, L1-L6) and the developer's deviations into the
design ("Review revisions" table at the end) and into conventions 1.1, 2.6, 3.5, 3.8, 4.1, 10.1
and resolved question 27. Choices I made where the product owner left room:

- **Status inside the List renders `role="none"`** (the reviewer's suggestion). A role-less
  `div` would also do, but `none` states the intent and keeps axe's required-children check
  quiet; the busy listbox (`aria-busy`, which axe exempts from the check) carries the meaning.
- **`loading` is not exposed** as `state.loading` or `data-loading` in v1; `[aria-busy="true"]`
  on the List covers styling. Listed in section 13 as a possible follow-up.
- **L1 (dangling `aria-labelledby`)**: the design now says the Label registers and the List
  emits `aria-labelledby` only while a Label is mounted, otherwise the consumer's `aria-label`
  (dev warning with neither). Recorded in 9 and the test plan; it is a Low finding, so the
  developer may land it with or after the fix wave.
- **RTL override spelling** for a consumer with an RTL island: `style={{ positionArea:
  "block-end span-left" }}`. Not verified in an engine; it is the physical equivalent of the
  logical keyword for an RTL anchor, and consumer `style` wins per property.
- The two mouse-related additions (`onMouseDown` prevented alongside `onPointerDown`, Trigger
  `onPointerCancel`) are now owned keys in the `Omit` lists.

Verified items from "Things to verify" above: the deferred-lane claim (yes, not entangled; React
19.3.1 `requestDeferredLane`), the implicit-submission flush (no: Firefox submits before React's
scheduled flush, hence `flushSync` for the closed-Enter commit), the hydration path (fine).

## Small fold (2026-10-17, later)

- Section 3.5's `ComboboxListProps` / `ComboboxGroupProps` had `"aria-labelledby"` in the `Omit`
  list while section 9, the parts table and the code keep it as a consumer prop merged with
  the Label / GroupLabel id. Fixed the types to match `combobox-list.tsx` / `combobox-group.tsx`.
- Recorded in 6.5 the accepted `autoHighlight` side effect: arming is per open / per edit
  (`autoArmed` ref in the Root), so an active option unmounting from an outside result change
  is cleared but not re-highlighted until the next open or edit. Deliberate: re-arming on every
  unmount would undo the caret keys' clearing on any unrelated re-render.

## 2026-10-23: the urgent lane is a handler (#96)

The user reversed my 2026-10-17 call above ("urgent action naming", third candidate). Reading the
docs, they objected that `action` must always mean "wrapped in a transition". They are right
about what the suffix is for: v1 protected the no-`on*` rule and spent the suffix's meaning to do
it, and at the call site (`inputValueChangeAction={async (q) => ...}`) the suffix misleads where
the type comment is not visible. New rule (vision 3, conventions 2.1 and 2.6): `fooAction` is
always a transition; `on<State>Change` is reserved for a React-imposed urgent handler, today one
prop, `onInputValueChange: UrgentChangeHandler`. No alias (alpha).

Guard: a type-level test, `src/__tests__/action-naming.test.ts` (conventions 10.1), because the
rule is about a type ("a key ending in `Action` returns `unknown`"), oxlint as configured has no
custom rule authoring and the repo has no ESLint. Pass-through DOM `on*` props are excluded by
`keyof DOMAttributes<Element>`; a listed registry of every public `*Props` type with a runtime
completeness check against `src/index.ts`. Checklist is in the combobox design amendment.

Noted but not done: the Roadmap release entry and the version bump belong to the developer and
the release skill. `ComboboxInputValueChangeDetails` keeps its name on purpose (9.4).

### Implementation deviations folded back (2026-10-23, after `wave14-rename`)

The developer's `action-naming.test.ts` differs from my snippet in two places, both my errors:

- `keyof DOMAttributes<Element>` does not cover `<dialog>`'s `onCancel` / `onClose`
  (Dialog.Popup, Popover.Popup pass-throughs) nor `formAction` on `<button>` / `<input>`, whose
  function member returns `void` and would be flagged as a non-transition action. The guard
  excludes pass-throughs by name as `DOMAttributes | DialogHTMLAttributes | ButtonHTMLAttributes
  | InputHTMLAttributes`. Lesson: when a type guard must distinguish "React's name" from "ours",
  enumerate React's attribute interfaces per element the library passes through, not just
  `DOMAttributes`.
- `Form.Root`'s `action` is `string | fn`; `NonNullable<P[K]> extends fn` fails on the string
  member, so my claim that it "passes" was wrong. The guard checks the function members only
  (`Extract<NonNullable<T>, fn>`) and treats a key with no function member as an offender. I
  should have type-checked the snippet against the real exports before claiming a result.

Conventions 10.1 and the Combobox checklist now describe the implemented guard. Also corrected
the checklist's "top-of-file row list" item (`combobox.test.tsx` has none; the urgent rows are
the `renderBoth("urgent text")` describe).

## #112: Trigger click while open was a light dismiss (2026-10-24)

Wave 17 audit C1 / D1. The Trigger is not the popover's `source` and named no popover, so its
press light-dismissed the listbox at `pointerup` on every engine; the `pointerdown` snapshot in
3.3 existed only to toggle in the right direction afterwards. 5.4 row 1 and the docs claimed the
close was awaited; it was not (refusing controlled parent flickered, no view-transition exit).

Decision: make the Trigger an invoker of the popup after hydration (`commandfor` + `command=
"toggle-popover"` written through the ref, click always cancelled), judge the toggle against
`intended()`, drop the snapshot and `onPointerCancel`. Same rule as #110 (conventions 3.5, "a
part's library-owned close is the single source of that close"), second trap recorded there.

Facts relied on:
- HTML "topmost clicked popover" treats the invoker's popover as the clicked one; the invoker is
  found through the popover target (`popovertarget`, or `commandfor` with a popover command). A
  custom `command` would not qualify.
- WebKit `Document::handlePopoverLightDismiss` (main, 2026-10-24) checks
  `button->commandForElement()` then `button->popoverTargetElement()`. Chromium / Firefox were
  verified by the reviewer's probe (`invoker-light-dismiss.browser.test.tsx`: `none` closed,
  `commandfor` and `popovertarget` stayed open). WebKit cannot be run on this machine; the CI job
  decides, with `popovertarget` as the recorded fallback.
- The pre-hydration objection (PO decision 8) is only about the server HTML; light dismiss only
  exists after the library opened the popup, i.e. after hydration. Writing from the ref keeps
  decision 8 intact. Precedents: `hidden="until-found"` upgrade, JS-free Popover Trigger's
  `aria-expanded` write.

Left alone, on purpose: Clear (browser-owned close by design, deviation 5); other overlays
(Popover / Menu Trigger = `source` + `commandfor`; Dialog Trigger = invoker; Select's picker is
native); writing the attributes only while open (no benefit); a non-button `render` (dev
warning, not a snapshot path).

Open: audit T1's sweep ("every click-X-while-open row of every overlay gets a real-mouse browser
row") is still worth doing after #110 and #112 land; not part of either issue.
