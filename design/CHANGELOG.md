# Design changelog

The history of `design/conventions.md` and `design/components/*.md`. Append-only.

The design documents state the current rules. This file holds how they came to be: amendments,
resolved and open questions, review corrections, notes for the product owner, implementation
notes and test plans that were written for a wave that is finished.

## How to use this file

- **Changing a rule.** Edit the rule in its design document, in the present tense, with no
  "formerly", "amended" or "since #n". In the same commit, append an entry at the end of this
  file: date, issue, who decided (user or product owner), which sections changed, and the
  reasoning worth keeping.
- **Never edit an entry.** A correction is a new entry that names the one it corrects.
- **Nothing here binds.** Where this file and a design document disagree, the design document is
  the rule; where a design document and the code disagree, that is a bug in one of them.
- `scripts/check-design-refs.mjs` does not check this file: entries name files that are gone.

## The archive (2026-11-24, #157)

Until 2026-11-24 the design documents carried their own history: a "Status" list of amendments,
"Resolved questions", "Amendment: ..." tails that overrode the text above them, review
corrections, "Implementation notes" and "Test plan" sections. The refactoring wave (#157, user
decision 2026-11-24) rewrote the documents as current rules and moved those blocks here,
**verbatim**, one part per source document and step. Inside a part:

- Headings, section numbers and cross-references are as they were written. "Section 3.5" or
  "above" in a moved block means the document it came from, as it stood on its date; the text
  may name parts, props and files that no longer exist (`Toolbar.Button`, `closeAction`,
  `report-superseded.ts`).
- A numbered section that source comments cite and that moved here whole ("popover.md 14.2")
  left a one-line stub under its number in the design document; find the text under the part
  named after the document.
- Parts are in the order the work was done, not in date order. The dates are in the entries.

New entries (after the archive) go at the end of the file, newest last.

---

# conventions.md: status, resolved questions, open questions

Status: **accepted** (2026-10-15, GitHub issue #5; open questions resolved by the product owner
with the user, see the end of this document; amended 2026-10-15 after the Toggle design, #6, with
the ViewTransition correction in 5.1, the pending-is-never-disabled rule in 3.6, and the Server
Function note in 2.4; amended 2026-10-17 after the CheckboxGroup design, #33, see resolved
question 20; amended 2026-10-17 with the Popover design, #38: the top-layer rule in 3.5 and 5.1,
and the `focusGroup` detection in 8, issue #43; Popover and Menu accepted the same day, see
resolved questions 24 and 25; amended 2026-10-17 with the Select design, #50, see resolved
question 26; amended 2026-10-17 with the Combobox design, #50: the urgent lane in 2.6 and 3.2,
the built-in strings rule in section 11, see resolved question 27; amended 2026-10-17 with the
Dialog close amendment, #46: the "cancelable step" rule for part-initiated closes in 3.5; amended 2026-10-18 with the Toast
design, #54, see resolved question 28: `"timeout"` in 2.2, the urgent queue in 2.6, the registry
and the library-driven region in 3.5, the `ending` / `paused` / `type` rows in 4.1, the third
no-`transition` category in 5.1, the Suspense guard in 6, the function export in 1.1 and 9.3,
the strings in 11, the Lanes row in 10.1; amended 2026-10-18 with the Slider design, #54, see resolved
question 29: the commit action in 2.1, the hidden-control exception in 1.1, the continuous-control
corollary in 2.3, the gesture value in 3.2 and 3.3, the controlled value input's reset in 3.5 and 3.8,
`dragging` in 4.1, the no-`transition` note in 5.1, the types in 5.3, generic props in 9.4, the
continuous-control row in 10.1; amended 2026-10-18 with the Field and Form design, #54, see resolved
question 30: `Control` / `Description` / `Error` / `Submit` in 1.1 and the element rules in 1.2, the
validity mirror in 2.6, the form-channel amendments in 2.7, the reset and settle notes in 3.5, the
owned custom-validity slot in 3.6, `useFieldControl` and `useFormOwnerEvent` in 3.8, `invalid` /
`required` in 4.1 and 4.2, the no-`transition` note and the CSS-exit rule (#46) in 5.1, the types in
5.3, the shared context location in 7.1, the shared state type in 9.4, the three rows in 10.1, the
platform-string note in 11; amended 2026-10-18 with the ToggleGroup and Toolbar design, #66, **accepted
2026-10-18**: the `Button` row and the `Item` / `Separator` notes in 1.1, the roving tab stop in 3.2 and
7.4, `aria-disabled` in 3.6, the rows in 4.1 and 5.3, the shared context in 7.1, the flag row in 8, the
files in 9.1; amended 2026-10-18 with the Progress and Meter design, #68, see resolved question 32: the
`Track` / `Indicator` / `Label` / `Value` notes in 1.1, the consumer-side lane rule in 2.6, the mirrored-state
examples in 3.5, `complete` / `region` / `indeterminate` in 4.1, the fourth no-`transition` category in 5.1
and the types in 5.3, the `react-server` hook list and the first use of the provider exception in 7.1 and
7.3, the shared state types in 9.4, the two rows and the directive-free note in 10.1, the platform-string
note in 11; amended 2026-10-18 with the NumberField design, #67, see resolved question 33: `Increment` /
`Decrement` and the widened `Root` / `Input` / `Label` in 1.1 with the hidden-sibling exception, the draft text
and the held value in 2.6 and 3.2, the uncontrolled hidden input in 3.5 and 3.8 rule 6, the surface /
validity-element mirror in 3.6, `validityElement` in 3.8, the `pending` / `disabled` rows in 4.1, the
no-`transition` note in 5.1 and the types in 5.3, the directive-free modules in 7.1, the `announce` helper
in 8, the three rows in 10.1, the two static strings in 11; amended 2026-10-18 with the Button design,
#79, **accepted 2026-10-22**, see resolved question 34: the `Button` row in 1.1, the cancelled-click note and item 9 in 2.3, the
re-entry rule in 2.5, the own-`formAction` reading in 2.7, the hook option in 3.4, `aria-disabled` while
pending in 3.6, the `pending` row in 4.1, the row in 5.3, the folder in 9.1, the Re-entry row in 10.1;
review fold 2026-10-22: the component-`render` `type` rule and the non-host-button `disabled` rule
in 1.2, the counter-only guard in 2.5, 3.4 and 10.1; wave 9 amendments #81 and #83, 2026-10-22,
`design/components/button.md` 16 and 17: the guard as the hook's default in 2.5 and 3.4, the
library-wide `disabled` sweep in 1.2; amended 2026-10-22 with the Context menu design, #45,
`design/components/context-menu.md`, **accepted 2026-10-22**, see resolved question 35: the
`ContextTrigger` row in 1.1, the outside right-click example in 2.2, the move note in 3.5, the
`context` row in 4.1, and section 12, shipped functional CSS, a user decision; amended 2026-10-23 with
the urgent-handler rename, #96, **user decision**, see resolved question 39: `fooAction` always means
a transition, the urgent lane is `on<State>Change: UrgentChangeHandler` in 2.1, 2.6, 3.2, 9.4 and
10.1, the type guard in 10.1; `docs/vision.md` principle 3 names the exception; amended
2026-10-24 with the wave 16 refactoring fold, #100: `disabledButton` in 1.2, the two-channel
capture in 2.4 and 3.4, the production-bundle rule for development text in 7.2, the shared
control hooks in 3.8, the `internal/` layout in 9.1, the cross-channel row in 10.1, the
shipped-CSS modules in 12; amended 2026-11-23 with #145, **user decision**, and #150, see resolved
question 42: superseded rejections go to `reportError` in 2.4, 3.4 and 10.1 (the two-channel
capture of #100 is gone), the set-valued commit in 2.5, 3.3 and 3.4, `report-superseded.ts` in 9.1,
the Overlap row in 10.1); amended 2026-11-23 with #151 and #152, see resolved question 43: the
latest rejection after its owner left in 2.4 and 3.4, the reset with an empty diff in 3.3,
`report-dropped.ts` in 9.1, the Superseded rejection row in 10.1).
Binding for every component design in
`design/components/`. `docs/vision.md` wins over this document; this document wins
over any individual component design.

Amended 2026-11-23 with #146, **user decision** (all of it, including the parts of mixed
ownership; see resolved question 44): the pure-trigger re-entry guard is no longer
unconditional; it is the prop `whilePending` (`"run"` | `"ignore"`), whose default follows who
owns the action. Applied: decision 2, the `Button` row in 1.1, item 9 in 2.3, the last bullet of
the contract in 2.4, the pure-trigger bullet in 2.5 and the new 2.5.1, the hook option in 3.4,
`aria-disabled` while pending in 3.6, `WhilePending` in 9.4, the Re-entry and Superseded
rejection rows in 10.1; `design/components/button.md` 18 and the Close / Item / Action sections
of dialog.md, popover.md, menu.md and toast.md. **Implemented 2026-11-24** (branch
`feat/146-while-pending`, `memo/developer/issue-146.md`).

Amended 2026-11-24 with #148, **user decision** (resolved question 45;
`design/components/overlay-open-change.md`, accepted, **implemented 2026-11-24**, branch
`feat/148-on-open-change`, `memo/developer/issue-148.md`): an action is a change the library
can still roll back, an `on*` handler reports one it cannot hold; overlay Roots get
`onOpenChange` next to `openChangeAction`; Toast's `closeAction` becomes `onClose`; one rule for
every `on*` handler (synchronous, not awaited, may return a promise, rejection or throw to
`reportError`, no promise warning). Applied here: decisions 2, 3 and 11, 2.1, 2.2 (the channel
note), 2.4 (the fact's routes), 2.6, 3.2 (the mirror's reason), 3.4 (`adoptFact`), 3.5, 4.3,
5.1, 5.3 and 10.1 (the Fact handler row, the allow-list). `docs/vision.md` principle 3 carries
the rule.

## Resolved questions (2026-10-15)

Decided by the product owner, items 1, 2 and 5 confirmed with the user:

1. **Action naming**: keep the `x` / `defaultX` / `xChangeAction` triple (`pressedChangeAction`,
   `valueChangeAction`, `openChangeAction`). No bare `changeAction`.
2. **Urgent opt-out placeholder**: v0 provides no mechanism. Native `on*` props the library does not
   use pass through to the element as an unsupported escape hatch; library-used handlers are removed
   from part prop types. **Superseded 2026-10-17** by the urgent lane of section 2.6 (resolved
   question 27; renamed to `on<State>Change: UrgentChangeHandler` 2026-10-23, resolved question
   39); the pass-through escape hatch remains for interactions with no urgent handler.
3. **Swallowed errors count as success** in uncontrolled mode. No veto mechanism until a real case
   appears.
4. **Root entry plus per-component subpaths.**
5. **`experimental_<feature>` props** per part; `@funstack/ui/experimental` subpath only for whole
   components that cannot exist without a flagged feature.
6. **Transition entanglement**: being re-verified by the React researcher and recorded in
   `docs/research/react-async-apis.md`. Guidance "await only what the UI must wait for" stands.
7. **No hover/focus data attributes**; consumers use CSS pseudo-classes.
8. **Never natively disabled while pending** (section 3.6): the library emits `data-pending` only;
   latest-intent covers repeated activation; CSS or `aria-busy` are the consumer's escape hatches.
9. **`transition` stays on Toggle in v0** (section 5.1), documented as animating the settling of
   the action, not the optimistic flip.
23. **Conditional `<ViewTransition>` boundary** (issue #35, 2026-10-16): a part renders the
    boundary only when `transition` is given; the prop is static; `"none"` keeps the boundary;
    static-mode Accordion renders none; page-policy CSS is the consumer's choice; mount-prone parts
    get a browser test row asserting no `startViewTransition` call without the prop.
10. **`Arrow` part held for v0** (from the Tooltip design). Popups ship without an `Arrow` part
    until a component shows it cannot be done in CSS on the popup itself. **Superseded
    2026-10-23 (wave 11, #20):** the user chose the Tooltip arrow for wave 11, so
    `Tooltip.Arrow` ships, echoing the resolved `data-side` / `data-align` (section 13.2,
    `design/components/tooltip.md`); the pseudo-element recipe stays documented as the
    zero-markup alternative. Popover and Menu still have no `Arrow`.
11. **`provides="description" | "name"`** is the convention for any part whose content labels or
    describes another element (Tooltip's `Popup`, future `Label`/`Description` parts):
    `"description"` wires `aria-describedby`, `"name"` wires `aria-labelledby`. It is an
    **explicit prop with a fixed default** (`"description"`); there is no automatic switch to
    `"name"` based on whether the trigger already has an accessible name (clarified 2026-10-16
    after the Tooltip implementation; the design wins). The prop name is shared across components.
12. **All Accordion parts are client modules** (section 7.3). Server Components render them and
    the native toggle works before hydration; directive-free variants were a later concern (#19,
    resolved as none: question 38).

13. **`details.event` is a virtual Proxy-served property** (raised by the Toggle design, #6;
    resolved by research #17, `docs/research/server-function-action-props.md`, option (e), see
    section 2.2). Server Functions may be passed directly to any action prop; the thin client
    wrapper is optional.
14. **`details.reason` vocabulary unified** to `"activate"` | `"platform"` (section 2.2); Tabs'
    `"find"` and Accordion's `"trigger"` are renamed. Their public details types declare
    `reason: ChangeReason` as 2.2 requires; the implementation had kept narrower local unions
    until #100 (after 0.1.0-alpha.11), a breaking type change for a consumer who annotated the
    narrower type.
15. **Tabs warns in development** when neither `value` nor `defaultValue` is given.
16. **Plain-input anatomy for native form controls** (wave 2, 2026-10-16): `Switch` and
    `Checkbox` are single components rendering the input, with no `Indicator`, `Thumb` or
    `Label` parts; `RadioGroup` is `Root` (`<fieldset role="radiogroup">`) / `Label` (`<legend>`)
    / `Item` (`<input type="radio">`), the research's shape 1. Sibling indicators are consumer
    markup styled with `:has()`, or rendered through `render`'s function form.
17. **Form reset in controlled mode notifies the parent** with `reason: "platform"` and the
    `reset` event (section 3.8 rule 6); resets are never silently ignored.
18. **`indeterminate` is suspended while pending** (`state.indeterminate = indeterminate &&
    !pending`, section 4.1).
19. **One public `ChangeReason` type** (`"activate" | "platform" | "dismiss"`, section 2.2)
    replaces the per-component unions; `"dismiss"` was added with the Dialog design.
22. **Dialog (#26)**: the product owner accepted all nine questions as recommended (issue #26
    comment): `"dismiss"` reason; no Escape disabling in v0; the `open` attribute is never
    server-rendered; `state.open` is `false` in JS-free mode; `lightDismiss` defaults to `false`;
    both `Dialog.Close action` and `Dialog.Form` stay; a pre-hydration click opens an empty
    dialog that fills in after hydration; a refused close re-opens the dialog; the jsdom dialog
    shim is accepted.
20. **`CheckboxGroup`** was deferred to its own design (issue #33) and accepted 2026-10-17
    (`design/components/checkbox-group.md`): own `Item` part, `Parent` with `values`, APG restore
    cycle, dynamic native `required` on Items with no `aria-required` on the fieldset,
    `details.added` / `removed`, `next` in document order, no partial-hydration warning,
    `transition` on `Item` and `Parent`. The conventions changes it asked for (the `equals`
    option, rule 3.8.3 scoped to radios, `Parent` in 1.1, the derived `indeterminate` note in
    4.1, computed native validity attributes in 3.6, the diff shape in 2.2, the types in 5.3)
    are applied.
21. **Shared native-input machinery** is the three-hook contract of section 3.8: per-element
    `useNativeChecked` (with `group: true` inside a group), the group adapter
    `useNativeGroupReconciliation` on a fieldset Root, both on `useFormReset`; one dispatch per
    state owner.
24. **Popover (#38)** accepted 2026-10-17 with all eight questions as recommended
    (`design/components/popover.md`): `<dialog popover="auto" aria-modal="false">` with focus
    moving in and `render={<div />}` for the disclosure variant; part-initiated closes
    library-owned, dismissals notified; JS-free `aria-expanded` by DOM write (`data-open` since #121); no `Form` /
    `lightDismiss`; `role` an overridable default; the nested focus-return rule; placement
    `bottom` / `center`; Trigger-less popovers unanchored. Dialog's view-transition close is
    issue #46. The conventions changes it asked for (the top-layer boundary rule in 3.5 / 5.1,
    the part-initiated close shape in 3.5, the `"dismiss"` examples in 2.2, the `Popup` element
    in 1.1, the `open` row in 4.1, the types in 5.3, the DOM-written ARIA row in 7.4) are
    applied.
25. **Menu (#39)** accepted 2026-10-17 with all eleven questions as recommended
    (`design/components/menu.md`): item activation closes the whole stack after the item's
    action settles, with `data-pending` on the item and a view-transition exit; checkbox and
    radio items keep the menu open by default (`closeOnActivate`); always library mode; hover
    intent by timers (100 / 150 ms) on the submenu Root and pointer-move focus on items; Tab
    closes the stack with an immediate `hidePopover()`; submenu `flip-inline` fallback kept
    despite WebKit 302008; a nested `Menu.Root` is the submenu with `SubmenuTrigger` the only
    new part; `GroupLabel` and `<hr>`; `experimental_focusgroup` on `Menu.Popup`; the shared
    `useActionTrigger` (landed with #41, before Menu merged). The conventions changes it asked for
    (`GroupLabel` / `Separator` / `Item` in 1.1, `useActionTrigger` in 3.4, the always-library
    configuration in 7.3, the committed-state wording in 5.1, the types in 5.3, the flag row in
    8, the `checked` and `open` rows in 4.1, the `"dismiss"` examples in 2.2) are applied.
26. **Select (#50)** accepted 2026-10-17 (`design/components/select.md`), questions 1 to 3 and
    5 to 8 as recommended and question 4 decided the other way: a real `<select>` rendering
    `value={optimistic}` with no open state; `value: string` with `""` for the placeholder;
    `Select.Value` as `<selectedcontent>` with the hydration workaround and an automatic
    `MutationObserver` refresh (WebKit contingency recorded); late options re-applied with the
    `useSyncExternalStore` hydration tell; the reset target mirrored into `defaultSelected`;
    **no dev warning** with neither `value` nor `defaultValue`, the Select adopting the
    browser's first-option default (native-first, RadioGroup precedent); no `transition` on any
    part; `Group label` required with optional `GroupLabel`; the WebKit 302008 test row with a
    consumer CSS mitigation; the `experimental_baseAppearance` flag row withdrawn. The
    conventions changes it asked for (`Option` / `Value` in 1.1, the element rule in 1.2, the
    `string` exception in 3.1, the late-option path in 3.5, `useNativeSelectValue` and
    `HTMLSelectElement` in 3.8, the `selected` / `open` rows in 4.1, the no-transition note in
    5.1, `fsui-select` in 5.3, the `selectedcontent` rows in 7.4, the flag row in 8) are applied.
27. **Combobox (#50)** accepted 2026-10-17 (`design/components/combobox.md`), questions 1 to 5
    and 7 to 11 as recommended and question 6 **overridden by the user**: one `Combobox` with
    `allowCustomValue` (no separate Autocomplete); the urgent lane as `inputValueChangeAction:
    UrgentChangeAction` (section 2.6; **renamed** `onInputValueChange: UrgentChangeHandler` by
    the user 2026-10-23, #96, resolved question 39); two explicit states (`value`, `inputValue`) with no
    `itemToString`; accepting an option keeps the listbox open with `data-pending` on the
    option and closes on settle (Menu's rule); Tab does not accept; `multiple` deferred; no
    `commandfor` on the Trigger and no JS-free mode; Escape left to the platform; the WebKit
    302008 row with a `positionTryFallbacks` escape hatch; and, by the user's decision, a
    **default English announcement** (`"No results"`, `"1 result"`, `"N results"`) through
    `ariaNotify`, overridable through `announce(count, state)`, which sets the built-in-strings
    rule of section 11. The conventions changes it asked for (2.6 and 3.2 urgent lane and
    virtual focus, `UrgentChangeAction` in 9.4, the residual paths in 3.5, `Input` / `Clear` /
    `Empty` / `Status` and the `Root` / `List` / `Label` / `Option` notes in 1.1, the `active` /
    `stale` / `empty` / `selected` / `open` rows in 4.1, the deferred-render note in 5.1, the
    types in 5.3, the always-library note in 7.3, the `ariaNotify` note in 8, the urgent test
    row in 10.1, section 11) are applied. **Revised after review** (2026-10-17, "Review
    revisions" in the design): the sync-throw rollback rule in 2.6 and 10.1; `Status` inside a
    `List` is the role-less loading fallback and the listbox is `aria-busy` while loading (1.1,
    4.1); the hidden-input pattern in 3.5 and 3.8 rule 6 has no `defaultValue` mirror (the
    reset target is computed in JS; a text input's mirror is written in the `reset` event
    through `useFormReset`'s `onResetEvent`).

28. **Toast (#54)** accepted 2026-10-18 (`design/components/toast.md`), all nine product-owner
    questions as recommended (module-level `toast` singleton with `createToastManager` for
    isolation; `"timeout"` in `ChangeReason` and `Toast.Close` as `"dismiss"`; action toasts
    persistent by default; swipe deferred; focusable `dialog` / `alertdialog` Roots; F8; foreign
    modal dialogs undetected in v1; the library-owned Suspense guard; `limit` 3 with queueing),
    with one amendment: a `toast()` call on the server is a no-op with a dev warning and is
    never buffered (the module-level manager would share a queue between requests). The
    conventions changes it asked for (the function export in 1.1 and 9.3, `"timeout"` and the
    "part that carries a decision" wording in 2.2, the urgent-by-design queue in 2.6, the Toast
    region row and the module-level registry in 3.5, the `pending` / `ending` / `paused` /
    `type` rows in 4.1, the third no-`transition` category in 5.1 and the Toast row in 5.3, the
    Suspense guard in 6, the Lanes row in 10.1, the two strings in 11) are applied.
29. **Slider (#54)** accepted 2026-10-18 (`design/components/slider.md`), all twelve
    product-owner items as recommended: two actions with the gesture's `valueCommitAction`
    committing uncontrolled state (rollback on a failed save); steps as transitions driven by an
    internal urgent `live` value, no `UrgentChangeAction`; `<state>CommitAction` as an action
    kind; `Slider.Indicator` (not `Range`); the two-element `Thumb`; the platform midpoint
    default; an unreachable `max` stays unreachable; no synthetic `input` / `change` for pointer
    gestures; the `"dismiss"` revert step in uncontrolled mode; explicit `index`; no
    `transition` prop. Decisions 1, 2 and 8 were made autonomously for wave 5 and are to be
    reported to the user. The conventions changes it asked for (the commit action in 2.1 and
    decision 2, `Track` / `Thumb` and the widened `Indicator` / `Label` / `Value` plus the
    hidden-control exception in 1.1, the continuous-control corollary in 2.3, the gesture value
    in 3.2 and 3.3, the controlled value input's reset and pre-hydration path in 3.5 and 3.8,
    `dragging` and the `pending` / `orientation` rows in 4.1, the no-`transition` note in 5.1,
    the types in 5.3, generic props in 9.4, the continuous-control row in 10.1) are applied.
30. **Field and Form (#54)** accepted 2026-10-18 (`design/components/field-form.md`), all
    eleven product-owner items as recommended: `Form.Root` runs a function `action` itself on
    the client (`onSubmit` `preventDefault()` + its own transition, the element's `action`
    unwrapped for progressive enhancement) with `autoReset` defaulting to `true` (reset on a
    settle with no errors); `Field.Root` exposes the form's pending; no `aria-errormessage` in
    v1; server errors written into `setCustomValidity` with the stale-value suppression;
    repeat submissions not dropped; the validity display urgent with no `transition`;
    `Dialog.Form` `errors` / `autoReset` as a follow-up; `Field.Label` for group controls by
    registration (`for` dropped, `aria-labelledby` on the group); sync `validate(value,
    formData)`. Items 1 and 4 are reported to the user as the most visible. The conventions
    changes it asked for (`Control` / `Description` / `Error` / `Submit` and the widened `Label`
    / `Root` in 1.1, the element rules and the Field-owned `id` in 1.2, the validity mirror in
    2.6 and decision 11, the three form-channel amendments in 2.7, the reset and settle notes in
    3.5, the owned custom-validity slot in 3.6, `useFieldControl` / `useFormOwnerEvent` in 3.8,
    `invalid` / `required` and the `pending` row in 4.1 and the `:user-invalid` row in 4.2, the
    no-`transition` note in 5.1 and the types in 5.3, the shared context in 7.1, the shared
    state type in 9.4, the three rows in 10.1, the platform-string note in 11) are applied,
    together with the #46 fold's CSS-exit rule in 5.1.

31. **ToggleGroup and Toolbar (#66)** accepted 2026-10-18 (`design/components/toggle-group.md`),
    all twelve recommendations as recommended: the `exclusive` discriminant with multiple as the
    default; exclusive mode deselectable by default with `deselectable={false}`; Toolbar `loop`
    default `true` with the native `wrap` token; `Menu.Trigger` opening on the inline-end arrow in
    a vertical Toolbar; a nested ToggleGroup transparent to the arrows; one DOM-written roving
    `tabindex` engine shared by Toolbar and a standalone ToggleGroup; Tab from a text-entry item
    to the next item; `Toolbar.Button` and `Toolbar.Separator` only; `Toggle` unchanged;
    `experimental_focusgroup` on both Roots; no Label parts; no form participation and no
    `details.reason`. The conventions changes it asked for (1.1, 3.2, 3.6, 4.1, 5.3, 7.1, 7.4, 8,
    9.1) are applied.
32. **Progress and Meter (#68)** accepted 2026-10-18 (`design/components/progress.md`), all eleven
    product-owner items as recommended (optional `value` with `null` meaning indeterminate; `max`
    100; directive-free Roots rendering the client context provider; always-referenced
    `aria-labelledby`; no Field registration, no native variant and no English indeterminate text;
    `getAriaValueText(value, state)`; an `aria-hidden` Value; no `transition`, types,
    `useFormStatus` or `pending`; two pages and two subpaths) and all nine conventions proposals,
    applied: the part notes in 1.1, the consumer-side lane rule in 2.6, the mirrored-state
    examples in 3.5, `complete` / `region` / `indeterminate` in 4.1, the fourth no-`transition`
    category in 5.1 and the types in 5.3, the hook list in 7.1 relaxed to React's `react-server`
    exports (proposal 6a, the architect's choice: `use-render.tsx` may drop its directive instead
    of the `render-element.ts` split) and the provider exception's first use in 7.1 and 7.3, the
    shared state types in 9.4, the two rows and the directive-free note in 10.1, the
    platform-string note in 11.
33. **NumberField (#67)** accepted 2026-10-18 (`design/components/number-field.md`), all fourteen
    product-owner items as recommended (two actions with Slider's semantics; typed text committed
    on blur / Enter with an internal draft; typed values neither clamped nor snapped; unparsable
    text reverting silently; strict grouping; rounding on commit; the runtime `locale` with a
    `lang` warning; no `aria-roledescription`, `role="group"`, static `"Increase"` / `"Decrease"`;
    opt-in wheel and the 400 / 60 ms hold; `validityElement` in the Field contract; the
    uncontrolled hidden input; the live-region fallback; the v1 scope) and conventions proposals
    1 to 12, applied: `Increment` / `Decrement`, the widened `Root` / `Input` / `Label` and the
    hidden-sibling exception in 1.1, the draft text and held value in 2.6 and 3.2, the
    pre-hydration text and the uncontrolled hidden input in 3.5 and 3.8 rule 6, the surface /
    validity-element mirror in 3.6, `validityElement` and the hook rows in 3.8, `pending` /
    `disabled` in 4.1, the no-`transition` note in 5.1 and the types in 5.3, the directive-free
    modules in 7.1, `internal/announce.ts` in 8, the three rows in 10.1, the two static strings
    in 11. `validityElement` also amends the accepted Field design
    (`design/components/field-form.md` 7.1 and its "Amendment: `validityElement`" section).
34. **Button (#79)** accepted 2026-10-22 (`design/components/button.md`), every recommendation
    as recommended: the single-element `Button` with a bare `action`; the re-entry guard (ignore
    while pending, `aria-disabled="true"` meanwhile, never native `disabled`, no `aria-busy`, no
    announcement, no opt-out prop), library-wide as a rule and landed for Button only, with the
    follow-up for `Dialog.Close`, `Popover.Close` and `Menu.Item` filed as #81; `type="button"`
    by default and `"submit"` with `formAction`; `formAction` with per-submitter pending from
    `useFormStatus().action`; `Form.Submit` unchanged and unguarded; a cancelled click is not a
    veto for a pure trigger; `Button` reads `ToolbarContext`; `focusableWhenDisabled` in v1;
    `"use client"`. User decisions: **`Toolbar.Button` is removed** (a breaking change; `Button`
    replaces it inside a Toolbar) and `focusableWhenDisabled` ships. The conventions changes
    (decisions row 2, 1.1, 2.3, 2.5, 2.7, 3.4, 3.6, 4.1, 5.3, 9.1, 10.1) are applied.
35. **Context menu (#45)** accepted 2026-10-22 (`design/components/context-menu.md`), every
    decision as proposed: `Menu.ContextTrigger` in the Menu namespace (a plain region with no
    ARIA; a Root may hold a `Trigger` and a `ContextTrigger` sharing one Popup); placement at
    the point with no anchor (research S4: inline `--menu-point-x` / `-y` and three shipped
    `@position-try` options, `side={null}` to opt out); a move on a second right-click (no
    dispatch); the outside right- / middle-click close for **every** menu; editable targets
    keep the native menu by default (`editableTargets="menu"`); long-press for touch and pen;
    the names `data-context` / `state.context`, `--menu-point-x` / `-y`, `editableTargets`,
    `longPressDelay`; press-drag-release, a touch offset, close-on-scroll, RTL placement and a
    `nonce` deferred. **User decision:** positioning-only shipped CSS is allowed through React
    `<style href precedence>`, documented and overridable (section 12); the virtual-anchor
    alternative is rejected. The conventions changes (1.1, 2.2, 3.5, 4.1, 12) are applied.

36. **Wave 11 Part A, positioning (#20, #53, #88 RTL)** accepted 2026-10-23
    (`design/components/tooltip.md`, `popover.md`, `menu.md`, `context-menu.md` Part A,
    `combobox.md` amendments; section 13), every recommendation as recommended: the resolved
    `data-side` / `data-align` under the same names, observed on Tooltip's native path too;
    inline-relative `align`, the `inline-start` / `inline-end` sides, `inline-end` as the
    submenu default; no workaround for Mozilla 2019601 (asserted through the probe; human task
    #89); the context-menu direction from the popup's computed `direction`; no `data-side` on
    Combobox (possible follow-up). **User decision:** `Tooltip.Arrow` ships, superseding
    resolved question 10. **Part B (#21 skip-delay, #88 press-drag-release, touch offset,
    close-on-scroll, CSP) accepted 2026-10-23** (`tooltip.md` Part B, `context-menu.md` Part B,
    `menu.md` note; section 12), as recommended: global provider-less skip-delay with no
    opt-out and no cooldown; touch press-drag-release ships, with the iOS / Android device
    check a human task (#90; upstream items #91); the wheel guard on every menu; no
    scroll lock, close-on-scroll for point opens only; `nativeMenu` rejected; `<CSPProvider
    nonce>` and `STYLE_SHA256` from `@funstack/ui/csp`. **User decision:** the skip-delay
    stylesheet's selector rule is allowed; shipped CSS is "placement and interaction timing,
    never visuals" (section 12).

37. **Wave 12, Tooltip warm opens (#93)** accepted 2026-10-23 (`design/components/tooltip.md`
    amendment for #93; sections 4.1 and 7.4), every recommendation as recommended:
    `data-instant` on `Tooltip.Popup`, attribute only with no `state.instant`, written from the
    popup's synchronous `beforetoggle` on both paths (the native path's one passive listener)
    and cleared at the close's, so exits always animate; no prop, no CSS-only route.

38. **Wave 13, directive-free ("zero-JS") variants (#19)** resolved 2026-10-23, **user
    decision, option A** of `docs/research/zero-js-variants.md` 5 (section 7.3): no new
    components; "JS-free" means no behaviour JS on the native path and works before and without
    hydration, not "no client bundle"; native-HTML recipes on the form-control docs pages
    (Switch, Checkbox, RadioGroup, Slider, NumberField, Select); Tooltip not viable natively
    outside Chromium; Popover blocked on the `aria-expanded` gap (closed by #121, question 41); option B
    (`@funstack/ui/accordion/native`) recorded as a ready plan, not scheduled. Supersedes the
    "tracked in #19" notes in the component documents (Accordion feedback 1, Tooltip 14.1,
    RadioGroup, CheckboxGroup, Switch, Select, Slider, NumberField). The server `useId`
    collision found by the research is #94 (upstream uhyo/funstack-static#198, fixed in
    `@funstack/static` 1.3.4 and re-verified; section 7.3 records the host requirement).

39. **Urgent handler naming (#96, from the docs feedback #95)** decided by the user 2026-10-23:
    `fooAction` **always** means a handler the component wraps in a transition; the urgent lane
    is a plain synchronous handler and is named like one. Combobox's `inputValueChangeAction`
    becomes **`onInputValueChange`** and the type `UrgentChangeAction` becomes
    **`UrgentChangeHandler`** (same signature, `(next, details) => void`; the details type
    `ComboboxInputValueChangeDetails` is unchanged). This reverses Combobox question 2 (resolved
    question 27), which had kept the `Action` suffix so that the no-`on*` rule had no exception;
    the user judged the suffix's meaning more valuable than the rule's purity. Breaking, with
    **no deprecated alias** (alpha). Applied: `docs/vision.md` principles 2 and 3; sections 2.1
    (the new table row and "the suffix is the contract"), 2.6, 3.2, 7.4, 9.4, 10.1 (the renamed
    row and the new "Action naming" type guard); decisions 2 and 11; resolved question 2;
    `design/components/combobox.md` (edited in place, plus the amendment with the migration and
    the implementation checklist); the type-name mentions in `slider.md`, `number-field.md`,
    `toast.md`. Guard: a type-level test, not a lint rule (oxlint as configured has no custom
    naming rule and the repo has no ESLint; a lint rule could not see the type anyway, and the
    rule is about types: "a prop ending in `Action` returns `unknown`"). **Implemented** on
    `wave14-rename` (`feat(ui)!: rename Combobox inputValueChangeAction to onInputValueChange`);
    two deviations from the design's guard snippet were folded back into 10.1 and the Combobox
    checklist: the DOM pass-through exclusion needs `DialogHTMLAttributes` / `ButtonHTMLAttributes`
    / `InputHTMLAttributes` besides `DOMAttributes` (`onCancel` / `onClose`, `formAction`), and
    the transition check applies to the function members of the prop type only, since
    `Form.Root`'s `action` is `string | fn` and the snippet's `NonNullable<P[K]> extends fn`
    failed it (the design's claim that it "passes" was wrong as written).
40. **Invoker Triggers' `aria-expanded` renders the shown state (#118)** decided by the architect
    2026-10-24. On every part whose `aria-expanded` describes a library-owned popover
    (`Popover.Trigger`, `Menu.Trigger`, `Menu.SubmenuTrigger` in library mode; `Combobox.Trigger`
    and `Combobox.Input`), the attribute renders the **committed** open state, the shown popup,
    not the optimistic one; `data-open` and the render-prop `open` stay optimistic. Grounds
    (`docs/research/invoker-aria-expanded.md`): Chromium and WebKit derive a `commandfor`
    invoker's expanded state from its popover and never read the attribute, Firefox maps nothing
    for `commandfor` and reads it, so the optimistic value reached assistive technology in one
    engine only and the three disagreed during every pending phase; ARIA in HTML
    (w3c/html-aria#514) is making the attribute an author MUST NOT on invokers; and the APG's
    meaning of `aria-expanded` is "the controlled element is displayed", which is committed
    state in every overlay. Applied: 3.2 (the bounded rule), the 4.1 `open` row, 7.3 (the
    Popover bullet's engine claim and the Menu paragraph); `design/components/popover.md`,
    `menu.md` and `combobox.md` edited in place plus an amendment each. `Dialog.Trigger` renders
    no `aria-expanded` and `Select` has no popover, so neither changes. Option E of the research
    (a `popovertarget` Trigger with no `aria-expanded`, the spec-conformant end state, which
    would also unblock a directive-free Popover) is a separate evaluation in its own issue.
    **Revised 2026-10-24 after the review (M1):** `committed` left `Combobox.Input` (no invoker,
    so every engine reads it) and a non-button Trigger render saying "expanded" over a hidden
    listbox after Escape or a light dismiss until the notification, and any action entangled with
    it, settled: a regression in Chromium and WebKit on the focused element. The attribute now
    renders **`shown`**, an urgent `useState` mirror in `useOverlayRoot` (3.2's table) that the
    Popup writes from `toggle` (read from `:popover-open`), sets at mount for a pre-hydration open
    and clears on unmount; no transition can delay it, so the attribute equals `:popover-open`
    within a task in every phase and in every engine, and the three lag phases the review listed
    (dismissal window, pre-hydration `defaultOpen`, platform path) are gone. Consequence:
    `defaultOpen` server-renders `aria-expanded="false"` (the popup is not shown before
    hydration). JS-free mode keeps its DOM write (7.4). Not exposed in render-prop state.
    **Superseded for `<button>` Triggers by 41 (#121)**: they render no `aria-expanded`; the
    `shown` mirror stays the source where the attribute is still rendered.
41. **Overlay Triggers are `popovertarget` invokers and render no `aria-expanded` (#121)**,
    decided by the architect and approved by the user through the product owner, 2026-10-24.
    `Popover.Trigger`, `Menu.Trigger` and `Menu.SubmenuTrigger` render `popoverTarget={popupId}`
    (default action `toggle`) instead of `commandfor` + `command="toggle-popover"`;
    `Combobox.Trigger` writes `popovertarget` through its ref after hydration as it wrote the pair
    (#112), under the same invoker test as the other two (not while disabled and focusable, #132). On a `<button>` no `aria-expanded` is rendered: HTML-AAM maps a `popovertarget`
    invoker to its popover's state and Chromium, Firefox and WebKit all expose it (measured,
    `memo/architect/probes/121-popovertarget/`; `role="menuitem"` included), ARIA in HTML #514
    forbids the explicit attribute there, and Firefox ORs an explicit value in. Sub-decisions:
    (1) adopted now, before 0.1.0, not waiting for #514 (stale; the engines already behave as it
    says); (2) a non-button `render` (no invoker, #115) keeps `aria-expanded` from the Root's
    `shown` mirror (#118); (3) JS-free mode's `toggle` listener writes `data-open` on the Trigger
    instead of `aria-expanded`, so `[data-open]` is the styling hook in both modes, with a
    `:has(+ :popover-open)` recipe for pages that never hydrate; (4) #125 classifies a foreign
    `popovertarget` invoker's close as `"activate"` from `ToggleEvent.source`; (5) a
    native-disabled Trigger with its popup shown exposes no state (a disabled button is no
    invoker): accepted as transient. Unchanged: `Popover.Close` (`commandfor` + `hide-popover`:
    Chromium and Firefox expose no state for an invoker inside its own popover with either
    attribute, and the `command` event carries a foreign hide's reason), Dialog (`popovertarget`
    cannot open a modal `<dialog>`; its Trigger has no `aria-expanded`), `Combobox.Input` (explicit
    attribute, `role="combobox"`), the Popup's `onCommand` for foreign `commandfor` invokers.
    Verified identical for both attributes (Chromium and Firefox measured, WebKit source): the
    light-dismiss exemption (#112), cancelled-click suppression (mouse, Enter, Space), the
    implicit anchor, nested stacking, `ToggleEvent.source`. **Breaking (DOM only, in the
    0.1.0-alpha line):** `aria-expanded` disappears from the four Triggers (consumers move CSS
    from `[aria-expanded="true"]` to `[data-open]`) and `commandfor` / `command` become
    `popovertarget`; no prop or type change (`commandfor` / `command` stay omitted as reserved,
    `popoverTarget` / `popoverTargetAction` join the omitted keys). Evaluation:
    `memo/architect/eval-121-popovertarget.md`. Applied: decision 7, 3.2, 3.5, 7.3, 7.4;
    `popover.md`, `menu.md` and `combobox.md` edited in place plus an amendment each (Popover's
    carries the implementation and test plan).
42. **Superseded rejections are reported, not thrown (#145); set-valued state commits resolved
    changes (#150)**, 2026-11-23. #145 is a **user decision** on the architect's evaluation
    (`memo/architect/143-design-questions.md`, option B): the rejection of an older overlapping
    action no longer reaches the Error Boundary through a throw from render; it is passed to the
    global `reportError` (`console.error` where there is none), as React's standalone
    `startTransition` does. Every superseded rejection of a burst is reported and reports continue
    after unmount; the latest action's rejection still reaches the boundary. Removed:
    `useSupersededRejection`, the `captureSuperseded` option, the "throw before `useTransition`"
    hook-order rule, the "first error of a burst" rule. This reverses the product-owner decision
    recorded in 2.4 until then ("the library closes the gap"); "the library never swallows an
    error" stands. #150 was found by that evaluation and was masked by the boundary before:
    uncontrolled set-valued state committed the latest dispatch's `next`, which contains earlier
    in-flight changes, so a change whose action rejected was committed. Now a component that
    passes a `reducer` (CheckboxGroup; ToggleGroup and Accordion without `exclusive`) commits
    the resolved dispatches, replayed in dispatch order when the last overlapping one settles.
    From the review (`memo/reviewer/review-145-150.md`): the `exclusive` modes pass no reducer
    (single-valued, latest wins, as Tabs), and CheckboxGroup's form reset replaces the value
    whole. Leftover: #151 (a reset equal to the intended value dispatches nothing; fixed, 43).
    Applied: 2.4, 2.5, 3.3, 3.4, 9.1, 10.1, decision 3; the component designs edited in place.
43. **The latest rejection after its owner left is reported (#152); an equal reset joins a burst
    (#151)**, 2026-11-23, implementation fixes of the gaps recorded with 42. #152: a latest
    rejection that arrives after the owning component unmounted went nowhere (React routes it
    only through a render of the owner); both hooks now pass it to `reportError`
    (`reportSuperseded` renamed `reportDropped`, `report-dropped.ts`). **Deliberate deviation
    from React, pending user / product-owner confirmation:** a component that is *hidden*
    (`<Activity>`, `keepMounted` overlays, a Suspense fallback) counts as gone, because no React
    API tells hiding from unmounting when the rejection arrives (both run the effect cleanups).
    The rejection is reported only, once; React itself would deliver it to the boundary when the
    component is shown again. The alternative is **report and throw**: closer to React (the
    boundary on re-show) but the error is reported twice when the component comes back, and for
    the library's `keepMounted` overlays a boundary fallback would appear on reopening, possibly
    long after and out of context. Chosen: report only (exactly once, simple test contract;
    reviewer agreed, `memo/reviewer/review-151-152.md`). #151:
    uncontrolled CheckboxGroup dispatches a form reset with an empty diff while a dispatch is in
    flight (unless the latest dispatch is a reset), so the absolute reset enters the replay; its
    `added` / `removed` can be empty, so a consumer persists a reset's `next` whole
    (`checkbox-group.md` 2.6).
    Applied: 2.4, 3.3, 3.4, 9.1, 10.1; `checkbox-group.md` 5.4, `toast.md` walkthrough 6.

44. **`whilePending` (#146)**, user decisions of 2026-11-23 (issue #146 comments), implemented
    2026-11-24. The guard is a prop, `whilePending`, a string (`WhilePending = "run" |
    "ignore"`) so that modes can be added; no `"queue"` now; the default follows who owns the
    action: a part whose action the library owns ignores, a fully user-owned trigger runs. Also
    accepted there: a set-valued action's `next` may include still-pending changes (2.5),
    documented, with `useActionState` as the way out. The five questions below were answered as
    recommended: (1) a Close part with a user `action` defaults to `"ignore"`; (2) `Menu.Item`
    and (3) `Toast.Action` follow `closeOnActivate` / `closeOnSettle`; (4) a `Button` with a
    function `formAction` defaults to `"run"` as well, and the dropped rejection of an older
    overlapping submission is documented; (5) the opt-out value is `"run"`. The sub-question of
    3 was left to the implementation: `ToastActionOptions` gets no field (2.5.1). Found in
    review (F1, product-owner decision 2026-11-24): a closing part's continuation runs once, when
    the last run settles, and only if the latest run resolved (2.5.1, the continuation bullet). Applied: 2.3, 2.4, 2.5, 2.5.1, 3.4, 3.6, 9.4, 10.1; `button.md` 18, `dialog.md`
    3.4, `popover.md` 3.4, `menu.md` 2.3 / 3.4, `toast.md` 3.2 / 11.

45. **Requests and facts (#148)**, user decisions of 2026-11-23 and 2026-11-24 (issue #148
    comments); design `design/components/overlay-open-change.md`, accepted, **not implemented
    yet** (no alpha release before it lands). (1) An action is a change the library can still
    roll back; an `on*` handler reports one it cannot hold. (2) Overlay Roots (Popover, Menu,
    Combobox, Dialog) get `onOpenChange` for facts next to `openChangeAction` for requests; the
    pair exists only there. (3) A controlled Root whose parent keeps `open={true}` after a fact
    re-opens: the prop and the DOM never disagree. (4) An uncontrolled fact commits `false`
    urgently, with no `data-pending` and no view transition. (5) `reason: "platform"`
    dispatches stay actions, a popup found open at hydration included, so `onOpenChange` only
    receives `false`. (6) Toast's `closeAction` becomes `onClose`. (7) One rule for every `on*`
    handler (2.1): synchronous, not awaited, may return a promise, rejection or throw to
    `reportError`, no promise warning; `onInputValueChange` loses its warning. (8) The
    development warning is the static one (`open` without `onOpenChange`); no runtime
    heuristic. Applied: decisions 2 and 11, 2.1, 2.6, the Urgent handler row of 10.1; the
    remaining sections follow the implementation (that document's 12.2).

## Open questions

None at the moment. #148 is resolved question 45.

The questions of #146 that stood here are resolved question 44; their text is kept below for
the record.

### #146: `whilePending`, the parts of mixed ownership (2026-11-23, resolved: question 44)

1. **A Close part that is given a user `action`** (`<Dialog.Close action={deleteItem}>`,
   `Popover.Close` alike). The user's example is the Close *without* an action, where nothing of
   the part's own is pending and a repeated click is already a no-op. With an `action` the
   ownership is mixed: the consumer's function, then the library's close. **Recommendation:
   `"ignore"` by default**, opt out with `whilePending="run"`. The activation still ends in the
   library's close, a resolved run removes the part, and the typical action here (delete,
   confirm) is the one a double click must not repeat. The other reading ("there is user code,
   so it is a user-owned trigger: `"run"`") makes `Dialog.Close action={deleteItem}` double-run
   on a double click unless every call site adds the prop.
2. **`Menu.Item`**: (a) **recommended**: the default follows `closeOnActivate`: `"ignore"` when
   the menu closes after the action (the default), `"run"` with `closeOnActivate={false}`, where
   the item stays and is a user-owned trigger inside a menu ("Zoom in", the counter case of
   #146). (b) always `"ignore"`: one fixed default per part, simpler props table; the keep-open
   counter item needs `whilePending="run"`. (c) always `"run"`: the item's `action` is the
   consumer's; a double Enter on "Delete" runs twice.
3. **`Toast.Action`**: the same three options with `closeOnSettle`. **Recommended: (a)**,
   `"ignore"` when the toast closes on settle (the default; one Undo), `"run"` with
   `closeOnSettle={false}`. Sub-question: the prop is on the `Toast.Action` part only;
   `toast({ action: { label, action } })` (`ToastActionOptions`) gets no `whilePending` field,
   because the part is where the consumer renders the button. Say so if the option object
   should carry it too.
4. **`Button` with a function `formAction`** follows `Button`'s default, `"run"`: a second
   click submits again, exactly as React's own `<button formAction>`. Consequence to confirm:
   overlapping submissions are React's form channel, and React drops the rejection of the older
   one (no boundary, no `reportError`); the library does not own that transition and cannot
   report it, so "the library never swallows an error" (2.4) does not cover it. **Recommendation:
   accept and document** (the Button page shows `whilePending="ignore"` on the submitter
   example). The alternative, `"ignore"` by default for the `formAction` path only, would give
   one component two defaults.
5. **The opt-out value**: `whilePending="run"` (2.5.1 explains why not `"allow"` or
   `"overlap"`). The user named only `"ignore"`; confirm or rename before it ships.

---

# checkbox.md: questions and feedback

## Cross-component (resolved 2026-10-16)

As Switch's section: everything assumed here is now in conventions 3.8 and resolved questions 16
to 21. `CheckboxGroup` is deferred as issue #33 (section 10). RadioGroup has no `indeterminate`;
an empty radio group matching `:indeterminate` is the platform's business.

## Conventions feedback (applied 2026-10-16)

Both items were applied: "consumer-owned, mirrored" is named as the fourth kind of state in
conventions 3.5 and on the `indeterminate` row of 4.1; the `render` element-type restriction for
native inputs and fieldset Roots is in 1.2, with the dev warning in the shared hook.

## Questions for the product owner

1. **`state.indeterminate = indeterminate && !pending`** (section 4): resolved, suspended while
   pending (conventions resolved question 18).
2. **No `Checkbox.Indicator` in v0** (section 1): resolved, plain-input anatomy (conventions
   resolved question 16).
3. **CheckboxGroup deferred** (section 10): resolved, issue #33 (conventions resolved question
   20); designed and accepted 2026-10-17 in `design/components/checkbox-group.md`, which also
   answered the group-level `required` question (dynamic native `required` on the Items).
4. **`indeterminate` with uncontrolled `checked`** is allowed (no warning). Alternative: warn
   that mixed only makes sense when the parent controls `checked`. Recommendation: allow; the
   dash simply persists until the parent changes the prop, and a warning would be wrong for the
   "mixed until first interaction" use.

---

# button.md: questions and feedback

## Conventions amendments (applied to `design/conventions.md` in this commit; accepted 2026-10-22)

1. **Decisions table, row 2**: a pure trigger ignores activation while its own action is pending
   and says so with `aria-disabled="true"` (#79).
2. **1.1 `Button` row**: `Button` is now the general single-element button (`@funstack/ui/button`)
   and replaces `Toolbar.Button`; the "not a general button component" sentence goes. 3.6, 4.1
   and 5.3 drop their `Toolbar.Button` mentions accordingly.
3. **2.3 item 3**: a pure trigger does not treat an already-cancelled click as a veto (the
   Trigger-wrapped Button); item 9 reworded to "never *natively* disabled while pending; pure
   triggers ignore re-entry (2.5)".
4. **2.5**: new bullet "**Pure triggers ignore re-entry.**" with the rule, the two guard sources,
   `preventDefault()`, the non-awaiting spelling, and the staged rollout (Button in #79; the
   other parts in the follow-up).
5. **2.7**: a part with its **own** `formAction` may expose per-submitter form-channel pending
   (`useFormStatus().action` identity), the third allowed reading of the channel.
6. **3.4**: `useActionTrigger`'s `ignoreWhilePending` option and `run`'s boolean return.
7. **3.6**: "A part is never **natively** disabled while pending" (unchanged reason), plus: a pure
   trigger renders `aria-disabled="true"` while its own action is pending because it ignores
   activation then; `data-disabled` and `state.disabled` are the consumer's `disabled` only; the
   "latest-intent rule makes repeated activation safe" sentence is removed (it never protected a
   trigger); `focusableWhenDisabled` joins Tabs / Toolbar as a source of `aria-disabled`.
8. **4.1 `pending` row**: `Button` (its own action, or its own `formAction` submission).
9. **5.3**: `Button` emits no types.
10. **9.1**: `button/` folder.
11. **10.1**: a "Re-entry" row required for every guarded pure trigger; the superseded-rejection
    row notes that a guarded trigger declares it N/A with the reason.
12. **Resolved questions**: entry 34.
13. **1.2** (review fold, 2026-10-22): `type="button"` is emitted for a host `<button>` **and for a
    component `render` element**, omitted only for a host element of another tag; a `disabled`
    part whose rendered element is not a host `<button>` uses `aria-disabled`.
14. **2.5, 3.4, 10.1** (review fold): the guard source is the in-flight counter only; the held
    commit window accepts a new run.

---

## Recommendations and decisions (all accepted 2026-10-22)

1. **Re-entry guard: Button in wave 8, the rest in a follow-up** (5.5). The rule is library-wide
   in the conventions now; `Dialog.Close`, `Popover.Close`, `Menu.Item` switch in **#81** because
   of their re-run tests and docs and `menu-dom.ts`'s `aria-disabled` query.
   Alternative: switch all five now (one wave, about twenty assertions and four design docs,
   plus the Menu navigation change). Recommended: staged. **Accepted: staged, #81 filed.**
2. **No opt-out prop** (5.4): the non-awaiting action is the spelling. Alternative: `repeatable`.
3. **`aria-disabled="true"` while pending; `data-disabled` and `state.disabled` untouched** (5.3).
4. **`type` is owned on a `<button>`**, computed from the Button's own `type` prop (6.1), so a
   `render` element's `type` is overridden. Alternative: not owned (the element's wins), which
   would make `render={<button type="submit">}` a silent submit button.
5. **`formAction` per-submitter pending with the `submittedWith` ref** (6.2). Alternative: prop
   identity only, with a documented "pass a stable function" rule.
6. **`Form.Submit` stays unguarded** (6.4).
7. **Implicit submission goes through the guard**, no `type` flip (6.5).
8. **`Button` reads `ToolbarContext`** (7.3). Accepted.
9. **`Toolbar.Button`: keep as an alias or remove.** The draft recommended keeping the alias
   through `0.1.0`. **User decision: remove it now** (one name for one component; the project is
   alpha; a breaking change recorded in 7.3 and the migration note in 14).
10. **`focusableWhenDisabled`** (3, 7.2): the one prop this design adds beyond the product owner's
    list. It is the toolbar rule as a prop and the only way to put a Tooltip on a disabled Button
    (a natively disabled button fires no events, and `aria-disabled` is owned). **User decision:
    in v1.**
11. **Trigger-wrapped Button runs its action on a cancelled click** (7.1), as decided.
12. **Browser rows 21 to 26** are the ones jsdom cannot observe; 21 (focus retention) is the
    load-bearing accessibility claim and runs on all three engines.

## Resolved questions (2026-10-22)

1. Remove `Toolbar.Button` now, or keep the alias? **Removed now** (user).
2. `focusableWhenDisabled` in v1, or defer? **In v1** (user).
3. The follow-up for the other pure triggers: **one issue, #81** (product owner).

## Open questions

None at present.

---

---

# checkbox-group.md: questions and feedback

## Conventions feedback

To apply to `design/conventions.md` if this design is accepted:

1. **3.8, `useNativeGroupReconciliation`**: add the `equals` option (default `Object.is`), as the
   table already anticipates for #33.
2. **3.8 rule 3, "Unsupported: partial hydration"**: scope it to **radio** groups; react-dom's
   same-`name` restore is radio-only, and CheckboxGroup supports late Items without a warning.
3. **1.1 part vocabulary**: add `Parent` ("a mixed-state checkbox that controls a subset of a
   CheckboxGroup; `input[type=checkbox]`").
4. **4.1 `indeterminate` row**: add `CheckboxGroup.Parent`, where the value is library-derived
   from optimistic state and **not** suspended while pending (the suspension rule is for the
   consumer-owned prop on Checkbox).
5. **4.1 / 3.6**: a note that a library may render a **computed native validity attribute**
   (`required` on CheckboxGroup Items) from optimistic state; it is owned on the part.
6. **5.3 transition types**: `fsui-checkbox-group`, `fsui-checkbox-group-check`,
   `fsui-checkbox-group-uncheck`.
7. **2.2 `details` fields**: `added` / `removed` as the shape for set-valued states (Accordion's
   `item` / `open` stays; a future set-valued component should prefer the diff form).

---

# combobox.md: questions and feedback

## Conventions feedback (applied to `design/conventions.md` at acceptance, 2026-10-17)

1. **2.6 Urgent updates.** Replace "not provided in v0" with the urgent lane as designed in
   section 4: an urgent state keeps the `x` / `defaultX` / `xChangeAction` triple; its action
   is typed `UrgentChangeAction<T, Details>` (sync, called outside any transition, not awaited,
   no pending, no optimistic); the library uses it only where React requires urgency
   (controlled text input). Still no `on*` props. Resolved question 2 updated accordingly.
2. **2.2 shared types / 9.4.** Add `UrgentChangeAction` to `internal/types.ts` and the root
   entry's public types.
3. **3.2 three values.** Add a fourth row for the urgent lane: `text` / `activeValue`-style
   states, source `useState`, lane sync, shown by the input and the virtual focus. And a rule:
   **virtual focus (`aria-activedescendant`) is urgent library state**, as DOM focus is
   browser-owned and immediate; it is never a transition and never dispatches.
4. **3.5 residual paths.** Add "text typed into a controlled text input before hydration is
   reconciled at mount with `reason: "platform"` through the urgent action"; and "form
   participation through a hidden input mirroring the optimistic value, with `defaultValue`
   mirrored as the reset target" as a named pattern (Combobox; a future multi-select).
   *Corrected after review (deviation 2):* a hidden input has no reset behaviour, so the pattern
   is "a hidden input mirroring the optimistic value, with the reset target computed in JS";
   conventions 3.5 and 3.8 rule 6 carry the corrected wording.
5. **1.1 part vocabulary.** `Label` gains "`label[for]` naming an `Input` part"; add `Input`
   (the text field of a combobox), `List` (an ARIA `listbox` inside a `Popup`; the Popup is the
   container because a listbox may contain only options and groups), `Option` (Combobox:
   `div[role=option]`, never focused), `Clear`, `Empty` (rendered by the library only when the
   list has no options and is not stale), `Status` (`div[role=status]`), and the rule that a
   Root may render exactly one hidden form element when it owns a form value but no visible
   element.
6. **4.1 vocabulary.** Add `active` (virtual focus on an Option, urgent), `stale` (the shown
   results are for an older text; `aria-busy` equivalent on the listbox), `empty` (the list
   has no options), `selected` row gains `Combobox.Option` and `Combobox.Input`
   (`data-selected` = a non-null optimistic value), `open` row gains `Combobox.Input` /
   `Trigger` (optimistic `data-open`; no `aria-expanded` on a `<button>` since #121, the browser exposes the state; Popup none).
7. **5.1 ViewTransition.** Note that updates from `useDeferredValue` activate a boundary like
   transitions do, so a part whose content re-renders from a deferred value (Combobox.Popup)
   documents the `default: "none"` type-map form as the recommended spelling.
8. **5.3 types.** `Combobox`: `fsui-combobox`, `fsui-combobox-open`, `fsui-combobox-close`,
   `fsui-combobox-select`.
9. **7.3.** Combobox joins Menu as an always-library-mode component; its progressive
   enhancement is "the text input works before hydration and is adopted at mount".
10. **8 experimental table.** No new flag. Record `ariaNotify` as adopted without a flag (all
    three stable engines) and the Open UI customizable combobox as a future `experimental_`
    rendering candidate.
11. **10.1 test rows.** Add "Urgent action (both)" as a required row for any component with an
    urgent state: called synchronously per DOM event, outside a transition, DOM in sync for a
    controlled parent.
12. **New section 11, built-in strings** (from the user's decision on question 6): a built-in
    UI string is an English default, exists only where accessibility needs text the consumer
    might forget, and is always overridable through a prop that takes a function (so the
    message can depend on state); the library never ships a locale mechanism.

---

## Questions for the product owner

1. **One Combobox with `allowCustomValue`** (decision 1) rather than `Combobox` + `Autocomplete`
   as Base UI does. Recommendation: one component. The two share everything but the meaning of
   unmatched text on commit; a second namespace would duplicate twelve parts and the whole test
   plan for one boolean's worth of behaviour, and React Aria / Ark show the single shape reads
   fine (`allowsCustomValue` / `allowCustomValue`). Cost: a consumer building a pure search box
   still sees `value` / `valueChangeAction` and must learn that with `allowCustomValue` the
   value is the committed text. Alternative: ship `Autocomplete` later as a thin preset over the
   same parts if the docs show confusion.
2. **The urgent lane is `inputValueChangeAction: UrgentChangeAction`** (section 4), keeping the
   triple and the no-`on*` rule, with urgency expressed by the type and the docs. Alternatives:
   a one-off `onInputChange` handler (an `on*` exception), or `inputValueAction`. Recommendation:
   as designed; this becomes the library-wide urgent convention (feedback 1).
3. **`value` and `inputValue` are two explicit states; the library never derives the text from
   the value** (2.2), so a preselected value needs `defaultInputValue` / `inputValue` at the
   call site (dev warning otherwise). Alternative: an `itemToString` / `displayValue` function
   on Root (Headless UI, Base UI), which a Server Component cannot pass and which duplicates the
   Options' labels. Recommendation: as designed.
4. **Accepting an option keeps the listbox open with `data-pending` on the option until
   `valueChangeAction` settles** (5.2, Menu decision 3), the input text changing at once.
   Alternative: close at once and run the action detached (prior art everywhere; no pending
   surface, no rollback the user can see). Recommendation: as designed; sync actions are
   indistinguishable.
5. **Tab does not accept the active option** (section 8; manual selection). Many
   implementations (React Aria with `autoHighlight`-like modes, Chrome's own address bar) accept
   on Tab. Recommendation: no, because Tab is "leave" everywhere else in the library (Menu
   closes on Tab), and `autoHighlight` + Enter covers the "accept the first match" flow. Could
   become a prop (`selectOnTab`) if asked for.
6. **`announce` has no default string** (6.4). Alternative: a default English `"${n} results"`
   with override. Recommendation: no default, matching "the library ships no text"; the docs
   show the one-liner next to every example. Flagging because it is an accessibility default
   that is off until the consumer acts.
7. **`multiple` deferred** (section 13) with the anatomy leaving room for `Chips`. Confirm.
8. **No JS-free mode; the Trigger server-renders no invoker attribute** (section 1, 2.4): a pre-hydration
   Trigger click does nothing, a pre-hydration keystroke is adopted at mount. Alternative:
   a server-rendered invoker attribute on the Trigger for a pre-hydration open of an empty, button-anchored popup
   (Menu's shape), at the cost of wrong anchoring and width after hydration unless the library
   re-opens with `source: input`. Recommendation: as designed.
9. **Escape is left to the platform** (5.4): the library never intercepts it, so Escape when the
   listbox is closed reaches an enclosing Dialog / Popover, and there is no "second Escape clears
   the text" (APG optional behaviour). Confirm.
10. **The WebKit 302008 row and the `style={{ positionTryFallbacks: "none" }}` escape hatch**
    (7.3), keeping `flip-block` by default (Menu / Select precedent). Confirm.
11. **Conventions feedback 1 to 11** to apply on acceptance by whoever holds `conventions.md`.

---

---

# context-menu.md: questions and feedback

## Conventions feedback

Applied to `design/conventions.md` with this design:

1. **1.1 part vocabulary.** Add `ContextTrigger`: a region whose `contextmenu` (right-click,
   Shift+F10, long-press) opens the owner's Popup at the pointer; a plain element with no role
   or ARIA; `data-open` / `data-pending` / `data-disabled`.
2. **4.1 vocabulary.** `open` row: `Menu.ContextTrigger`. New row `context` (boolean,
   `Menu.Popup`): the current open came from a ContextTrigger and is placed at a point, with
   `--menu-point-x` / `--menu-point-y` set.
3. **2.2 `"dismiss"` examples.** A right- or middle-click outside a menu (the library's own
   close, since click-based light dismiss ignores those buttons).
4. **New section 12, shipped functional CSS.** The library ships no visual CSS; a component may
   ship **functional at-rules** it cannot express inline (`@position-try` options) as a React
   `<style href precedence>` rendered by the part that needs them, hoisted and deduplicated,
   with `--fsui-` prefixed names, an opt-out through the part's existing "stylesheet owns
   placement" switch, and the CSP note. First (and so far only) user: `Menu.Popup`'s point
   placement.
5. **3.5 residual paths.** A **move** (re-show at a new point without a state change) is a new
   kind of library-driven DOM operation on browser-owned open state: no dispatch, a coalesced
   `toggle`, documented in the component.

---

# dialog.md: questions and feedback

## Conventions feedback (applied 2026-10-16)

All eight items below were applied to `design/conventions.md`: `"dismiss"` in `ChangeReason`
and `details.returnValue` (2.2); per-direction ownership (3.5); observing the form channel and
the `Form` part (2.7, 1.1); `keepMounted` narrowing (3.7); `pending` on an owner without DOM
(4.3); `Dialog.Popup experimental_closedBy` (8); the Dialog `open` row (4.1); and the
part-cancelled-event note for the `preventDefault()` warning (2.3). Kept for the record:

1. **2.2 `reason` vocabulary: add `"dismiss"`.** "The user closed the component without acting
   on one of its parts: Escape, Android back, an assistive-technology dismiss gesture, light
   dismiss. `details.event` is the platform's `close` (or `toggle`) event." `"activate"` keeps
   its meaning (Trigger, Close, Form submit are parts). `"platform"` keeps its meaning (mount
   reconciliation; the browser, not the user). Without this value a dialog would have to label
   an Escape as `"platform"`, which misdescribes a user action, or as `"activate"`, which
   contradicts "acted on a trigger part". Popover and Menu will need the same value.
2. **3.5 browser-owned table: a third column.** Dialog's `open` is library-owned for the
   transition that opens it and browser-owned for the close. The table's two columns cannot
   express "awaited for `true`, a notification for `false`" on one prop. Suggested sentence
   under the table: "A state may be library-owned in one direction and browser-owned in the
   other (Dialog: open is a transition, close is a notification); the component doc says which,
   and the `xChangeAction` doc comment says so per value."
3. **2.7 form-level actions: `Dialog.Form`.** The part observes React's form channel
   (`useFormStatus`) to close the dialog after a successful action; it does not fold form pending
   into any control's `pending` and does not wrap the action. Suggest a sentence: "A part may
   *observe* the form channel to perform a platform side effect after a successful action
   (Dialog.Form closes the dialog); it never wraps the action and never reports form pending as
   its own `pending`." Also `Form` joins the part vocabulary table (1.1): "A form whose successful
   submission completes the component's interaction. Default `form`."
4. **3.7 `keepMounted` shape.** "Future content regions … reuse the prop unchanged" should allow
   narrowing the type: Dialog accepts `boolean` only, because `"until-found"` has no meaning
   inside a closed `display: none` dialog.
5. **4.3 `data-pending` on an owner without DOM.** Tooltip's Root had no action; Dialog's does.
   Suggest: "When the owner renders no element, `pending` is exposed through its `children`
   function and on the trigger part only."
6. **8 experimental table.** `experimental_closedby` moves from `Dialog.Root` to `Dialog.Popup`
   (the part that renders the attribute) and is spelled `experimental_closedBy` like
   `experimental_interestFor`.
7. **4.1 `open` row.** Add Dialog: Trigger emits optimistic `data-open` in library mode; the
   `<dialog>` emits none (`:open` / `:modal` are exact, 7.4). The row already says this for
   browser-owned popups; Dialog's Popup is the first part whose open is library-driven and yet
   emits no attribute, because the DOM attribute is written by the same commit.
8. **2.3 item 3, the `preventDefault()` note.** Dialog's Trigger `preventDefault()`s the click
   itself (to cancel the command), so `details.event.defaultPrevented` is already `true` when
   the consumer's sync prefix runs. Worth a sentence so the dev warning for "defaultPrevented
   after the prefix" is not applied to Dialog (or is keyed on a flag the part sets).

## Questions for the product owner (all nine accepted as recommended, issue #26 comment)

1. **`"dismiss"` reason** (feedback 1): approve the third value, or fold dismissals into
   `"platform"`? Recommendation: approve; `"platform"` should keep meaning "not the user".
   Accepted; now in conventions 2.2.
2. **No way to disable Escape in v0.** The platform allows one veto per activation, which is not
   an API. Options: ship nothing (recommended, documented), or an `experimental_closedBy="none"`
   value that works in Chromium and Firefox only and cannot be emulated in Safari.
3. **The library never renders the `open` attribute**, so a non-modal `defaultOpen` dialog and a
   JS-free non-modal dialog cannot start open in the server HTML. Accept for v0 (recommended;
   non-modal dialogs are the minority and the flash is one hydration), or allow `open` to be
   rendered for the non-modal initial render only, with the "remove by hand" caveat managed by
   never re-rendering it.
4. **`state.open` is `false` in JS-free mode** rather than `undefined` (Accordion chose
   `undefined` for the same situation). Recommendation: keep `false` here (the only reader is a
   `children` function that branches on a boolean) and accept the inconsistency, or align with
   Accordion.
5. **`lightDismiss` defaults to `false`** (Radix and Base UI default to outside-click dismissal).
   Recommendation: keep `false`; a modal with a form should not close on a stray click.
6. **`Dialog.Close action` and `Dialog.Form` both exist.** Either alone would do; both are
   proposed because one is the library's action-prop idiom and the other is the platform's
   form idiom. Drop one?
7. **Pre-hydration click in library mode opens an empty dialog** that fills in after hydration
   (2.4). Alternatives were a dead Trigger or always-rendered content. Confirm.
8. **Refused close re-opens the dialog** (2.3), by the conventions' re-apply rule. Confirm that
   consistency wins over "closed stays closed" (the alternative would make the controlled `open`
   prop lie after a dismiss).
9. **jsdom dialog shim** (13.1) is a second test shim next to the popover one; the alternative is
   to move most Dialog rows to browser mode, which is slower on three engines.

---

---

# menu.md: questions and feedback

## Conventions feedback

All eight items were applied to `design/conventions.md` at acceptance. Kept for the record:

1. **1.1 part vocabulary.** Add `GroupLabel` ("Names a `Group`; `div` with an id, wired through
   `aria-labelledby`") and note `Separator`'s default element `hr`. `Item` gains "Menu:
   `button[role=menuitem]`".
2. **2.5 / 2.4: a shared `useActionTrigger`.** Pure-trigger parts with their own transition
   (`Dialog.Close`, `Popover.Close`, `Menu.Item`) should share one internal hook that surfaces a
   superseded rejection as `useControllableAction` does, closing the gap Dialog recorded. Suggest
   naming it in 3.4 next to the state hook.
3. **3.5 ownership.** Menu adds "always library mode" as a legitimate third configuration: a
   component whose baseline cannot be JS-free still renders the declarative command for the
   anchor and the pre-hydration open. One sentence in 3.5 or 7.3.
4. **5.1 `transition` on items.** Menu items have no `transition` prop (their only library-driven
   change is the optimistic flip, which never animates). This contradicts "every animatable part
   has `transition`" only if an item counts as animatable; suggest the rule read "every part whose
   mount, unmount or content is driven by committed library state", which items are not.
5. **5.3 types.** `Menu`: `fsui-menu`, `fsui-menu-open`, `fsui-menu-close`, `fsui-menu-check`,
   `fsui-menu-uncheck`, `fsui-menu-select`.
6. **8 experimental table.** `focusgroup` row: add `Menu.Popup experimental_focusgroup`
   (`focusgroup="menu wrap|nowrap"`, no `tabindex` on items on the native path).
7. **4.1 vocabulary.** `checked` on `Menu.CheckboxItem` / `Menu.RadioItem` (optimistic,
   `aria-checked`), `open` on `Menu.Trigger` / `SubmenuTrigger`.
8. **2.2 `"dismiss"` examples.** "Focus leaving the component (Tab out of a menu), the pointer
   leaving a hover-opened submenu, a parent overlay closing."

---

---

# number-field.md: questions and feedback

## Open question (resolved)

- **Should validity follow the draft while the user types a fix?** Today the visible input's
  validity changes at commit (6.2), so an invalid field stays `:user-invalid` (and, in Firefox,
  keeps its bubble) until blur or Enter, where a native number input re-validates per
  keystroke. Making the mirror follow the draft would mean parsing per keystroke and writing
  the hidden input's value (or a parallel custom message) on every `input` event: the
  per-keystroke parse the commit model deliberately avoids (2.1), with `validate` then seeing
  drafts too. The architect's view: leave it; the `:user-invalid` styling is the consumer's and
  the Firefox bubble appears only for a bare form outside a Field. Worth a product-owner
  decision only if user feedback names it.

  **Resolved (product owner and user, 2026-10-18): leave it.** Validity keeps following the committed
  value. Revisit only if user feedback asks for it.

## Conventions feedback (applied to `design/conventions.md` 2026-10-18, 29a94c5)

All twelve items below are applied (conventions resolved question 33; the Field amendment is
in `design/components/field-form.md`); the list is kept as the record of what changed and why.

1. **1.1 part vocabulary.** Add `Increment` / `Decrement`: "`button[type=button][tabindex=-1]`
   that steps a numeric value, with press-and-hold (NumberField); `aria-controls` → the field's
   input; natively `disabled` when the next step would change nothing." Widen `Input` with "the
   visible text field of a NumberField (`input[type=text][inputmode]`, the owner surface for
   `data-pending`, with the urgent draft text), which renders the hidden native number input
   right after it"; `Label` with "for NumberField it renders `label[for]` naming the visible
   input and its id names the Root group"; `Root` with "NumberField's is a `div[role=group]`".
2. **1.1 one element per part: a second exception.** "A part whose user surface is itself a
   native input and whose form control must be a different element renders the control as a
   **visually hidden sibling immediately after it** (`NumberField.Input`): `ref` goes to the
   visible input, a documented `hiddenInputRef` to the control, and the props the control
   needs (`name`, `form`, `min`, `max`, `step`, `required`) are listed as forwarded to it."
3. **2.6 / 3.2 urgent states.** Add "the draft text of a NumberField: internal, written from
   the `input` event, with no `UrgentChangeAction` and no triple (the text is not a value until
   it is parsed at commit)"; and reuse Slider's `live` rule for "the value under a held button".
4. **3.5 residual paths / 3.8 rule 6.** Add "text typed into the visible input before
   hydration (NumberField) is parsed and dispatched as a `"platform"` step + commit at mount,
   or adopted as the draft when the input is still focused"; and the hidden-input shape: "a
   library-owned native input that is **not the user's surface** may be **uncontrolled**, with
   `defaultValue` as the reset target (react-dom keeps it in the `value` attribute and updates
   it when the prop changes) and its `.value` written through the ref at every change and
   re-applied after every commit (NumberField's hidden number input); the platform's own reset
   then applies to it and it needs no `onResetEvent` mirror. A controlled `value` would make
   react-dom rewrite the attribute on every update."
5. **3.6 the custom-validity slot.** Add: "A control whose **user surface** and **validity
   element** differ (NumberField: the visible text input and the hidden number input) keeps the
   Field's slot on the validity element, and both the Field (after each slot write) and the
   control (after each value write) mirror `validityElement.validationMessage` into the
   surface's own slot (`setCustomValidity`), so the surface is invalid exactly when the control
   is, with the platform's message, and the platform's report UI, `:user-invalid` and the
   Field's focus land on the surface. The surface carries no native constraint of its own."
6. **3.8 `useFieldControl` / `FieldControlRegistration`.** Add `validityElement?: () =>
   ValidatableElement | null`: "where `validity`, `validationMessage` and the slot are read and
   written when that is not the registered element; `:user-invalid`, the listeners and the
   focus target stay on the registered element; the Field mirrors after writing the slot
   (3.6)". Add the NumberField rows to the `useFieldControl` and `useFieldValueChange` tables
   (the Input registers the visible input, `labelable: true`, with the hidden input as the
   validity element; `useFieldValueChange(optimistic, edit = "activate")`).
7. **4.1 vocabulary.** `pending` gains "`NumberField.Increment` / `Decrement`: the button the
   latest step or commit came from"; `disabled` gains "a NumberField button at its bound". No
   new attribute.
8. **5.1 / 5.3.** NumberField joins Select and Slider as a component with no `transition` prop;
   types `fsui-number-field`, `fsui-number-field-change` (step), `fsui-number-field-commit`
   (gesture).
9. **8 (`ariaNotify`).** Record the second user and the fallback: "`internal/announce.ts`
   speaks through `ariaNotify()` where it exists and otherwise through one module-level
   `role="status"` live region in `document.body` (NumberField's step announcements); a
   component announcing through it renders no live region of its own." (Superseded by #113 A1:
   no fallback region; conventions 8 now says `ariaNotify()` only.)
10. **10.1 test rows.** The "Inside a Field" row lists NumberField; the "Continuous control" row
    applies to the hold; the "Platform path" row gains "for a control with a hidden native
    input, every path leaves the hidden value equal to the shown value".
11. **11 built-in strings.** NumberField adds two **static** strings, `"Increase"` and
    `"Decrease"` (the buttons' default `aria-label`s), overridden through the ordinary
    `aria-label` / `aria-labelledby` pass-through, Toast's region-name rule; the announced
    value is the formatted text (not a library string), overridable through `announce(value,
    state)`; **no `aria-roledescription`** and no string for it.
12. **7.1.** `number-field-format.ts`, `number-field-arithmetic.ts` and `internal/decimal.ts`
    are directive-free modules (the arithmetic precedent of Slider).

---

## For the product owner

Genuine product decisions, with recommendations; none blocks implementation except item 10,
which needs the conventions owner.

1. **Two actions with Slider's semantics** (decisions 2 to 5, section 2): `valueChangeAction`
   per step, `valueCommitAction` per gesture committing uncontrolled state, a typed value
   firing both. Alternative: one `valueChangeAction` per gesture with the hold previewed
   internally (one prop fewer; no step channel for a live total; a later pair would change the
   prop's meaning). **Recommendation: as designed.**
2. **Typed text is committed on blur and Enter, never per keystroke, and the draft is
   internal** (decision 4, 2.1, no `inputValue` triple). Alternative: Base UI's per-keystroke
   parsed value. **Recommendation: as designed**; the triple can be added later without a
   breaking change.
3. **Typed values are neither clamped nor snapped** (5.6): `min` / `max` / `step` are native
   constraints with the browser's message; stepping clamps and snaps. Alternative: clamp (and
   snap) on commit as Base UI and React Aria do. **Recommendation: platform.**
4. **Unparsable text reverts silently at commit** (4.1), React Aria's rule. Alternative: keep
   the text and show a built-in "Enter a number" message (a third built-in string; the hidden
   input cannot be made `badInput`). **Recommendation: revert in v1**, revisit if the docs
   feedback asks.
5. **Strict grouping in the parser** (5.3): `1,5` under `en` is unparsable, not `15`.
   Alternative: strip every group separator (React Aria, Base UI, Chromium's native input).
   **Recommendation: strict**; a reverted draft beats a silently wrong order of magnitude.
6. **Rounding to the format's `maximumFractionDigits` on commit** (5.4): what the user sees is
   what the form posts. Alternative: keep full precision in the value and let the text differ.
   **Recommendation: round.**
7. **`locale` defaults to the runtime locale with a dev warning when the document's `lang`
   disagrees** (5.1); no `lang` auto-detection (it cannot run on the server). Alternative:
   detect `document.documentElement.lang` through `useSyncExternalStore` with a post-hydration
   re-render (a flash on every server-rendered page that does not pass `locale`).
   **Recommendation: as designed.**
8. **No `aria-roledescription`; `role="group"` on the Root; buttons named `"Increase"` /
   `"Decrease"` as static built-in strings overridden by `aria-label`** (8.2, 8.4). Alternative
   for the name: React Aria's "Increase Quantity" through `aria-labelledby`. **Recommendation:
   as designed** (the group gives the context once; the product owner's lean on the role
   description is confirmed by the role-name argument).
9. **Wheel: `stepOnWheel`, off by default, each event a one-step gesture** (4.4), and **the hold
   timing 400 / 60 ms with no focus move** (4.3). **Recommendation: as designed.**
10. **The Field contract gains `validityElement`** with the Field-side mirror (proposals 5 and
    6, section 7). This is the one item that touches another component's accepted design and
    needs the conventions owner's acceptance; without it NumberField inside a Field cannot show
    `stepMismatch` / `rangeOverflow` (the Field would read the visible input's `customError`
    only) and the Field's slot write would erase the mirror. **Recommendation: accept**; the
    change is one optional registration field and one line in the Field's slot write, and no
    existing control is affected.
11. **The hidden number input is uncontrolled with `defaultValue` as the reset target**
    (6.1, proposal 4), a new shape next to the controlled-value-input mirror of Slider and
    Combobox. Alternative: controlled + `onResetEvent` mirror. **Recommendation: uncontrolled**;
    the platform resets it, react-dom keeps the attribute, and no `value` + `defaultValue`
    warning.
12. **The announcement fallback is a module-level live region** (8.3, `internal/announce.ts`)
    for engines without `ariaNotify`. Alternative: no fallback (Combobox's current rule).
    **Recommendation: the region**, since the product owner asked for a fallback; Combobox may
    migrate to the helper as an implementation choice. (Superseded by #113 A1: the region was
    dropped under the no-fallbacks policy, 8.3.)
13. **In v1**: `largeStep` with PageUp / PageDown and Shift+Arrow, `format` of style `decimal`,
    `percent` (default `step` `0.01`), `currency`, `unit`; **not in v1**: `smallStep`,
    `step="any"`, a scrub area, Escape reverting, iPhone `inputmode="text"`, `compact` parsing
    (section 13). **Recommendation: as listed.**
14. **Conventions proposals 1 to 12** to be applied by the conventions owner on acceptance.

**Accepted by the product owner (2026-10-18):** recommendations 1-14 are accepted as written.
- Item 3, platform constraints instead of clamping typed values: accepted. Typed values stay as typed, and the browser's validity message reports them.
- Item 5, strict grouping in the parser: accepted.
- Item 10, the `validityElement` addition to the Field contract: accepted. The conventions owner (design-toolbar) applies it together with proposals 1-12.

---

# popover.md: questions and feedback

## Conventions feedback

All applied to `design/conventions.md` (items 1 and 2 with the proposal, items 3 to 8 at
acceptance). Kept for the record:

1. **3.5 / 5.1: the boundary wraps the top-layer element itself.** A library-driven open or close
   of a top-layer element (`showPopover()` / `hidePopover()` in a layout effect of a transition
   commit) is animatable by `<ViewTransition>` when the boundary wraps the element, in every
   engine; browser-initiated opens and closes still are not.
2. **8: `focusGroup` detection** (issue #43), with the developer's `useSyncExternalStore` form
   and the Tabs native-path markup.

3. **4.1 `open` row.** Add Popover: Trigger emits optimistic `data-open` in library mode and a
   DOM-synced `data-open` in JS-free mode; its exposed expanded state is the browser's (`popovertarget`, #121; `aria-expanded` only on a non-button render, the shown state since #118); the Popup emits none
   (`:popover-open`).
4. **5.3 types.** `Popover`: `fsui-popover`, `fsui-popover-open`, `fsui-popover-close`.
5. **3.5 ownership table.** A third shape next to Dialog's "library-owned open, browser-owned
   close": Popover's "library-owned for parts, browser-owned for dismissals". Suggested sentence
   under the table: "Where the platform's close is cancelable without an anti-abuse rule
   (popovers), a component may own the closes its parts initiate and leave dismissals to the
   browser; the component doc lists which is which."
6. **2.2 `"dismiss"` row.** Add "script `hidePopover()` or another top-layer element hiding the
   popover" to the examples; the `toggle` event is the platform event there.
7. **1.5 / 3.2.** `aria-expanded` is the first ARIA state attribute the library keeps current
   through a DOM write outside React (JS-free Popover). If accepted (question 3), 7.4's table
   gets a row: "ARIA state the platform changes for browser-owned state and AT needs explicitly:
   write it on the DOM from the platform event through the ref; never React state."
8. **1.1 part vocabulary.** `Popup`'s default element reads `div[popover]`; Popover's is
   `dialog[popover]`. Suggest "`div[popover]` or `dialog[popover]`".

---

## Follow-ups (not part of this design)

- **Dialog: view transition on the library-driven close.** `Dialog.Close action` calls
  `dialog.close()` from the action's continuation, outside any commit, so `transition` never
  animates it, and Dialog 10.3 says "never the close". With the amended convention, Dialog could
  route the post-action close through the Root (`dispatch(false)`, then `close()` in the apply
  effect) and get a view-transition exit in every engine. It changes `openChangeAction(false)`
  from a notification to an awaited call for that one path. Filed as issue #46; not changed
  here.
- `internal/anchor-position.ts` shared by Tooltip, Popover and Menu; Tooltip's design names the
  helper locally.
- `Popover.Form`, an `anchor` prop, a hover-to-open prop ("hover to preview, click to pin";
  a consumer's own `interestfor` button already opens and, since #127, dismisses a library
  Popover on Chromium), a `manual` pinned variant, and a `returnFocus` prop: each when a consumer case
  appears. Context menus: #45.
- Human upstream reports collected in #44: Chromium `<dialog popover>` exposed as modal; WebKit
  302008 / 317926.

---

---

# progress.md: questions and feedback

## Conventions proposals (applied to `design/conventions.md` 2026-10-18, f3ab2e4)

All nine items below were applied by the wave's conventions owner (resolved question 32); the
list is kept as the record of what changed and why. For item 6(a) the conventions chose to relax
the 7.1 hook list to React's `react-server` exports; the implementation still took the
`render-element.ts` split (14.1), which the relaxed rule also allows.

1. **1.1 part vocabulary.** Widen `Track` ("the rail of a Progress / Meter; no interaction"),
   `Indicator` ("the fill of a Progress / Meter, sized by the consumer's CSS from the Root's
   `--progress-value` / `--meter-value`"), `Label` ("for an output role that is not labelable
   (Progress, Meter) it renders `span[id]` and the Root references the id through
   `aria-labelledby` unconditionally"), `Value` ("Progress / Meter: a `span`, `aria-hidden` by
   default, showing `formattedValue`").
2. **3.5 "consumer-owned, mirrored".** The row names "a future Progress `value`" as a mirrored
   prop. With a `div` there is no DOM property to mirror: Progress's `value` is a plain prop
   rendered as attributes. Drop Progress from the examples (Checkbox `indeterminate` and Dialog
   `returnValue` remain).
3. **4.1 vocabulary.** Add `complete` (Progress, every part: the clamped value reached `max`)
   and `region` (Meter, every part, enum `optimum` / `suboptimum` / `even-less-good`, the
   platform's words); widen `indeterminate` with "Progress (every part): `value` is `null`;
   derived, not a DOM property, never suspended".
4. **5.1 no-`transition` categories.** Progress and Meter join Slider / Select / Toast / Field:
   "a part that displays a consumer-owned value with no library state or dispatch, whose
   changes arrive in the consumer's lane (usually urgent, 2.6) and animate through a CSS
   transition on a registered custom property". 5.3: `Progress`, `Meter`: none.
5. **2.6 / 2.3 item 5, the consumer's side.** Add one sentence after the Toast paragraph: "The
   same rule holds for **consumer state that reports on a pending action** (a progress value): it
   is written with a plain `setState`, which after an `await` inside the action is urgent
   anyway; wrapping it in `startTransition` holds it until the action settles. Component docs
   that display such a value (Progress) say so." It is the one place the library's "wrap it in
   `startTransition`" advice inverts, and it belongs in the conventions so the next output-only
   component inherits it.
6. **7.1 directives.** Two facts to record: (a) React 19.3.1's `react-server` build exports
   `use`, `useId`, `useCallback`, `useMemo`, `useDebugValue`, `cache`, `cacheSignal`
   (`react.react-server.js`), so the rule "hooks other than `use` / `useId`" is stricter than
   React; the architect may relax it to that list (which would let `use-render.tsx` lose its
   directive) or keep it and accept the `render-element.ts` split (implementation note 14.1).
   (b) The second exception (a directive-free file rendering a client-created context provider)
   is now **used** by `Progress.Root` / `Meter.Root`; the sentence "No initial component needs
   the second exception; a component that does says so in its design doc" gets its first
   reference. Also in 7.3: Progress / Meter are the first components whose Root is itself a
   Server Component, next to the JS-free Accordion whose parts are all client modules.
7. **9.4 public types.** `ProgressState` / `MeterState` shared by every part (the `FieldState`
   rule); `MeterRegion` exported.
8. **10.1 test rows.** Add "**Lanes (consumer)**: for a component that displays a value a
   pending action reports, a post-`await` urgent write renders before the action settles and a
   `startTransition`-wrapped one does not" (Progress), and "**Server render**: for a
   directive-free Root, `renderToString` equals the client markup and the Root module's import
   graph reaches no `"use client"` module but its context". The Directive row already covers
   "exactly as the design doc records"; note that a design may record a **directive-free** Root.
9. **11 built-in strings.** Progress and Meter add **no** string: the default `aria-valuetext`
   is `Intl.NumberFormat`'s localised output (a platform string, like Field's
   `validationMessage`), there is no default text while indeterminate, and the override is
   `getAriaValueText(value, state)` (function of state) with `format` / `locale` as the
   serialisable path. Record it next to the Field line.

---

## For the product owner

Genuine product decisions, with recommendations; none blocks implementation.

1. **`value` optional on `Progress.Root`, `null` by default, meaning indeterminate** (2.3), so a
   spinner is `<Progress.Root aria-label="Loading" />`; the alternative is a required
   `value: number | null` (an omitted value is a type error, nothing is ever indeterminate by
   accident). **Recommendation: optional with `null` default**: it is what native `<progress>`
   does without `value`, and what Base UI does; `undefined` cannot mean "uncontrolled" here
   because nothing is controllable.
2. **`max` defaults to 100** on both Roots (3.1, 3.3), not the platform's 1. Every prior-art
   library uses 100, and a consumer porting `value={40}` from any of them would otherwise see a
   full bar. **Recommendation: 100**, with the platform's default noted in the docs.
3. **The Root is directive-free and renders the client context provider itself** (section 8),
   the first use of conventions 7.1's second exception; the alternative is `"use client"` on the
   Root like every other component (loses "runs once on the server", function props from a
   Server Component, and the locale guarantee). **Recommendation: directive-free**, with the
   docs site's Server Component example as the proof and the one-line fallback recorded.
4. **`aria-labelledby` always references the Label id, dangling when no Label is rendered**
   (6.1). The alternative, a registering Label, requires state in the Root and therefore
   `"use client"` (item 3). **Recommendation: always-referenced**, the `Field.Description`
   precedent, with the CDP row that proves `aria-label` still names the bar.
5. **No Field registration in v1** (6.2): a Progress or Meter inside a Field is a sibling of the
   control with its own name; a Field whose only content is a Meter keeps today's "no form
   control registered" warning. Alternative: register with `labelable: false` so `Field.Label`
   names it. **Recommendation: none in v1**; revisit if a settings-form demo wants the read-only
   field layout.
6. **No supported native `<progress>` / `<meter>` variant** (section 11), honouring the
   research's verdict over the "where viable" wording of #68; a consumer may still
   `render={<progress />}`. **Recommendation: none in v1.**
7. **No English `aria-valuetext` while indeterminate** (2.2; Base UI says "indeterminate
   progress"). Conventions 11 allows an English default only for an accessibility gap, and
   screen readers already announce an unvalued progressbar as busy. **Recommendation: none**;
   `getAriaValueText` covers consumers who want words.
8. **`getAriaValueText(value, state)`** rather than Slider's `(value, index)` or Base UI's
   `(formattedValue, value)` (2.2): Meter's region and the default text are in `state`.
   **Recommendation: as designed** (the Combobox `announce(count, state)` shape).
9. **`Progress.Value` is `aria-hidden` by default** (section 1), overridable by the consumer's
   `aria-hidden={false}`. **Recommendation: as designed** (the text is already in
   `aria-valuetext`).
10. **No `transition` prop on any part, no transition types, no `useFormStatus` coupling, no
    `pending` prop** (sections 4.4, 9). **Recommendation: as designed.**
11. **Two docs pages** (Progress, Meter) and two subpaths (`@funstack/ui/progress`,
    `@funstack/ui/meter`) rather than one "Progress & Meter" page / namespace (section 13).
    **Recommendation: two**; Field & Form share a page because they are used together, Progress
    and Meter are not.
12. **Conventions proposals 1 to 9** to hand to the conventions owner on acceptance.

**Accepted by the product owner (2026-10-18):** recommendations 1-12 are accepted as written.
- Item 2, `max` defaults to 100: accepted.
- Item 3, a directive-free Root that renders the client context provider: accepted as the pattern for future presentational components.
- Item 12, the conventions proposals: they go to the wave's conventions owner (the ToggleGroup/Toolbar architect).

---

---

# radio-group.md: questions and feedback

## Cross-component (resolved 2026-10-16)

The six assumptions this design stated about Switch and Checkbox are settled in
`design/conventions.md` (section 3.8 and resolved questions 16 to 21): shape 1 anatomy on all
three; the shared machinery is `useFormReset` + `useNativeChecked` (with `group: true` in Items)
+ `useNativeGroupReconciliation` on the fieldset Root, giving one dispatch per group; the
`defaultPrevented` rules are the shared `guardCheckableChange`; `checked` is the vocabulary word
and `data-indeterminate` exists on Checkbox only; `details.reason` is the public `ChangeReason`;
form props are pass-through on single controls and Root-owned here.

## Conventions feedback (applied 2026-10-16)

All nine items were applied to `design/conventions.md`: `RadioGroup.Item` on the `checked` row
(4.1); the form-reset path (3.5, 3.8); the already-cancelled click rule (2.3 item 3); "disabled
never dispatches" scoped to user interaction (2.3 item 7, 3.6); `null` from platform paths (3.1);
`fsui-radio-group` (5.3); the `render` restriction for inputs and fieldset Roots (1.2); `Label`
as `<legend>` in the part vocabulary (1.1); and the #19 note (7.3; #19 since resolved as "no
directive-free variant, native recipe in the docs", conventions resolved question 38).

## Questions for the product owner

The design was accepted on 2026-10-16; items not marked resolved stand as designed unless the
product owner reopens them.

1. **Anatomy.** Resolved: shape 1 (conventions resolved question 16).
2. **`next: string | null`.** Accept that `valueChangeAction` is typed `string | null` because a
   form reset can empty the group? The alternative (type `string`, never dispatch `null`) would
   leave `data-checked` stale after a reset to "nothing checked", which is the common
   `<form action>` case. Consumers with `string`-only saves write `if (next !== null)`.
3. **No `orientation` prop.** Radix, Base UI and React Aria have one; native arrows ignore it.
   Keep it off (recommended) or add a styling-only `data-orientation` with a documented "arrows
   are not restricted" caveat?
4. **No `Home`/`End`.** APG does not list them for radio groups; adding them means keyboard JS.
   Confirm.
5. **No `details.item`.** The issue sketch mentions it; for a single-value group `next` *is* the
   item, and Accordion needs `item` only because its `next` is a set. Omitted; confirm.
6. **Reset of a disabled group dispatches** (section 5.3). Confirm, or prefer Accordion's
   "re-apply committed state, no dispatch" for disabled groups.
7. **Root must be a `<fieldset>`.** No `div[role=radiogroup]` variant in v0 (it would lose legend
   naming, disabled inheritance and `.form`). Confirm.
8. **Part name `Label` vs `Legend`.** Resolved: `Label`, now in the conventions' part vocabulary
   (1.1) as the `<legend>` of fieldset-based groups.
9. **`transition` on `Item`.** Kept for parity with Toggle and Tabs; on a void element it animates
   only `data-pending` leaving and the rollback write. Keep, or drop as the first documented
   exception?

---

# select.md: questions and feedback

## Conventions feedback (applied 2026-10-17)

1. **1.1 part vocabulary**: add `Value` ("the element the browser fills with the selected
   option's content; `<selectedcontent>`; no `children`") and `Option` (`<option>` in Select).
2. **1.2 `render` rules**: Select's `Root`, `Trigger`, `Value`, `Option`, `Group` must keep
   their element (`select`, `button`, `selectedcontent`, `option`, `optgroup`).
3. **3.1**: note that Select's `value` is `string` with `""` as the placeholder, an exception to
   "none selected is `null`" grounded in `select.value` (question 1).
4. **3.5 residual paths**: add "late-mounting options in a `<select>` are re-applied; a hydrated
   late option is reconciled, a created one is not (the `useSyncExternalStore` server-snapshot
   tell)", and "a platform dispatch requires the intended option to exist".
5. **3.8**: widen `FormAssociatedElement` with `HTMLSelectElement`; add `useNativeSelectValue`
   as the select analogue of `useNativeChecked` (mirror `defaultSelected` then re-apply, in that
   order, because `defaultSelected` moves a non-dirty option's selection); `adopt(next)` on
   `useControllableAction` for the no-default case.
6. **4.1**: `selected` row gains `Select.Option` (optimistic, equal to `:checked`); `open` row
   notes Select emits none (`:open` only).
7. **5.1**: Select's parts have no `transition` (the Menu-items reasoning).
8. **5.3**: `fsui-select`.
9. **7.4**: `selectedcontent` intrinsic element added to the augmentation; the
   `suppressHydrationWarning` + `dangerouslySetInnerHTML` pattern for a browser-filled element
   gets a row ("element whose children the parser writes before hydration").
10. **8**: withdraw the `Select.Root experimental_baseAppearance` row: the markup is
    unconditional and the opt-in is consumer CSS (progressive enhancement, no flag).

## Questions for the product owner (resolved 2026-10-17, see below)

1. **`value: string`, never `null`** (decision 3). Accept the deviation from conventions 3.1
   ("none selected is `null`"), on the grounds that a `<select>` has no empty state other than
   an option, that `""` is what `required` validates against, and that it keeps
   `valueChangeAction` free of a `null` branch? The alternative (`string | null` with `null`
   mapped to "no option selected") would make `null` and `""` two spellings of the same DOM
   state.
2. **Automatic `<selectedcontent>` refresh through a MutationObserver** (decision 6, 6.3), in
   `Select.Value`. Accept the mechanism, with the WebKit contingency recorded as an issue if the
   first CI runs show the picker closing or losing focus on refresh?
3. **The hydration tell for late options** (6.2): one `useSyncExternalStore` per Option so that
   a pick made before a late boundary hydrates is kept while a client-created option is never
   mis-reported. The simpler alternative, "late options are re-applied, never reconciled", would
   silently overwrite a pre-hydration pick on options that streamed in after the Root hydrated.
   Accept the extra hook, or accept the limitation?
4. **Dev warning when neither `value` nor `defaultValue` is given** (decision 3; Tabs
   precedent). RadioGroup chose no warning because "unchecked" is the HTML default; here the HTML
   default (first option) is not representable without a placeholder. Confirm the warning.
5. **No `transition` prop on any Select part** (decision 13): the first component where no part
   has one. The alternative is a `transition` on `Option` for parity with `RadioGroup.Item`,
   which would wrap an `<option>` inside the UA picker and animate nothing. Confirm the
   omission.
6. **`Group label` required, `GroupLabel` optional** (1.). Confirm, or make `GroupLabel`
   required and derive the attribute from its text (impossible for rich content, so rejected
   here).
7. **WebKit 302008 handling**: a dedicated WebKit row under a timeout, and a documented consumer
   CSS mitigation rather than any library CSS. Confirm (the Menu precedent).
8. **Conventions change 10**: withdraw the `experimental_baseAppearance` flag row. Confirm.

---

# slider.md: questions and feedback

## Conventions feedback (applied to `design/conventions.md` 2026-10-18)

All thirteen items below are applied (conventions resolved question 29); the list is kept as the
record of what changed and why.

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
12. **Conventions feedback 1 to 13** to apply on acceptance by whoever holds `conventions.md`
    (applied 2026-10-18).

**Accepted by the product owner (2026-10-18):** all twelve recommendations as written. The user asked the team to proceed autonomously on wave 5, so decisions 1, 2 and 8 were made here; they will be reported to the user, who may revisit them before the first release that includes Slider. Apply the conventions feedback (item 12) to `design/conventions.md` and set the status above to accepted.

---

# switch.md: questions and feedback

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

---

# tabs.md: questions and feedback

## Conventions feedback

1. **Server Functions as change actions do not work as written.** Conventions section 7.1 says a
   Server Component "passes a Server Function" as the action. The `(next, details)` signature
   puts a DOM `Event` in `details`, and React refuses to serialise it (`encodeReply` accepts only
   plain objects). So `valueChangeAction={serverFn}` throws at call time; every Server Function
   must be wrapped in a client component today. Options for the owner: (a) document the wrapper
   as the rule; (b) detect server references (`$$typeof === Symbol.for("react.server.reference")`)
   in the shared hook and call them with `(next)` only; (c) make `details` serialisable by
   dropping `event`. I recommend (a) now and (b) if a demo shows the wrapper is too noisy.
2. **`useControllableAction.transitionType` returns one string.** Tabs emits two types per
   dispatch (`fsui-tabs` and a direction), and the direction needs the dispatching element.
   Suggested shape: `transitionTypes?: (next, prev, details) => readonly string[]`.
3. **`keepMounted` is a three-way choice, not a boolean.** Conventions section 5.5 mentions
   "`keepMounted` panels" as the Activity case. This design uses `keepMounted?: boolean |
   "until-found"` on the Panel. If Accordion adopts `hidden="until-found"` too, the same prop
   shape should be used there, and the conventions vocabulary table could list it.
4. **Exposure table.** `data-orientation` is listed for Root, List and Tab; this design follows
   that and does not emit it on Panel. Confirm this is intended rather than an omission.
5. **Optimistic parts and `<ViewTransition>`.** Given the lead's finding that optimistic commits
   never start a view transition, this design drops the boundary and the `transition` prop from
   `Indicator` and documents `Tab`'s as settle/snap-back only. If the corrected section 5 removes
   `transition` from trigger parts altogether, `Tab` should follow; if it keeps it for Toggle,
   `Tab` stays as designed.
6. **No-op rule precision.** Section 2.3 item 8 says "clicking the already-selected Tab calls
   nothing". This design reads "selected" as the optimistic value, which makes clicking back to the
   committed tab a cancelling dispatch (section 9.4). Worth stating in the conventions so every
   single-shot component does the same.

## Open questions for the product owner

1. **Default `activationMode`.** This design keeps `"automatic"` (APG, prior art, and the mode
   that shows off the Suspense model) and documents manual for awaited round trips. If the owner
   prefers to optimise for server-action-heavy apps, `"manual"` as default is a one-line change
   with no other impact on the design.
2. **`defaultValue` defaulting to `null`.** Resolved (product owner, 2026-10-16): keep `null` and
   add a dev-mode warning, fired once, when both `value` and `defaultValue` are undefined. Not yet
   implemented (developer memo).
3. **Server Function ergonomics** (Conventions feedback, item 1) affects every component, not
   just Tabs.

---

# toggle-group.md: questions and feedback

## Conventions feedback (applied in this commit, pending acceptance of this design)

1. **1.1 part vocabulary**: `Item` row gains ToggleGroup's `button[aria-pressed]`; new `Button` row
   (`Toolbar.Button`: a pure-trigger `button` with `action`, focusable when disabled); `Separator`
   row notes the perpendicular `aria-orientation` inside a Toolbar.
2. **3.2 / 7.4**: a roving Tab stop over arbitrary children is urgent library state that lives
   outside React: the container writes `tabindex` through the DOM from layout effects, a
   `MutationObserver` and focus / pointer events, items render none, and library item parts omit
   `tabIndex` (new row in the 7.4 table; one sentence in 3.2 next to virtual focus).
3. **3.6**: `Toolbar.Button` joins Tabs as a part that uses `aria-disabled` because its pattern wants
   a focusable disabled control.
4. **4.1**: `pressed` row gains `ToggleGroup.Item`; `pending` row gains `ToggleGroup.Root` / `Item`
   and `Toolbar.Button`; `orientation` row gains both components' parts.
5. **5.3**: ToggleGroup's three types; Toolbar none.
6. **7.1**: `internal/toolbar-context.ts` as the second cross-folder context (read by
   `ToggleGroup.Root`, `Toolbar.Separator` and `Menu.Trigger`).
7. **8 flag table**: `Toolbar.Root experimental_focusgroup` and `ToggleGroup.Root
   experimental_focusgroup` on the `focusgroup` row, with the nested-group rule.
8. **9.1 layout**: `use-roving-focus.ts` and `toolbar-context.ts` under `internal/`.
9. **Header**: the amendment note for #66, marked as pending the design's acceptance.

Nothing in `ChangeReason`, the action signature, the state triple or the Suspense stance changes.

---

## Recommendations for the product owner

1. **Exclusive mode deselects by default.** A pressed `aria-pressed` button can always be released,
   and that is what the button announces; `deselectable={false}` (exclusive variant only) is the
   opt-out for view switchers, documented as "prefer RadioGroup for an exclusive form choice".
   Alternative: default `false` (React Aria's `disallowEmptySelection` is opt-in too, so this is the
   ecosystem's default as well).
2. **`exclusive` is the discriminant, multiple is the default** (`value: string[]`), as Accordion
   and as the Toggle design forecast, rather than Base UI's `multiple` flag with single as default.
3. **Toolbar `loop` defaults to `true`** (Tabs, Menu, Base UI, Radix), overriding the native
   `focusgroup="toolbar"` default with the `wrap` token so the two paths agree. Alternative:
   `false`, matching the platform and React Aria.
4. **`Menu.Trigger` in a vertical Toolbar opens on the inline-end arrow** (ArrowRight; ArrowLeft in
   RTL) with the first item focused and leaves Up / Down to the Toolbar; horizontal is unchanged
   (7.4). Alternative: no arrow opening in a vertical toolbar (Enter / Space only).
5. **A ToggleGroup inside a Toolbar is transparent to the arrows** (no second axis within the
   group, 7.3), diverging from the APG example's nested radiogroup on purpose.
6. **One roving engine that writes `tabindex` through the DOM** for both the Toolbar and a
   standalone ToggleGroup, instead of item wrapper parts (6.1). Consequences to accept: before
   hydration every item is a Tab stop; an item's own `tabIndex` prop is unsupported in a toolbar;
   a `MutationObserver` per container. This is the decision I would escalate to the user if any:
   it is the first library-written attribute on elements the library did not render.
7. **Text-entry items keep their arrows and Tab moves to the next item from them** (6.3), matching
   Chromium's native toolbar focusgroup; the docs carry APG's "one such control, last".
8. **`Toolbar.Button` ships as the library's first plain action button**, scoped to the Toolbar
   (focusable-disabled, `useActionTrigger`, `data-pending`); a general `Button` stays a separate
   design. `Toolbar.Separator` is an `<hr>` with perpendicular `aria-orientation`. No `Toolbar.Link`,
   `Toolbar.Group` or `Toolbar.Input`.
9. **`Toggle` is unchanged**; `ToggleGroup.Item` renders the same element through the same
   attribute block, and `Menu.Trigger` gains only a `ToolbarContext` read.
10. **`experimental_focusgroup` on both Roots** with the `toolbar` token under an explicit
    `role="group"` for the standalone ToggleGroup (`nomemory` + `focusgroupstart` on the first pressed
    Item), and a dev warning plus no attribute on a nested group.
11. **No `Label` parts and no missing-label warning**: both Roots are named through `aria-label` /
    `aria-labelledby` pass-through, with the docs insisting on it. Alternative: a dev warning on an
    unnamed `Toolbar.Root` (APG requires the name) — cheap to add if wanted.
12. **ToggleGroup has no form participation and no `details.reason`** (no residual browser path);
    `ToggleGroupValueChangeDetails` is `{ added, removed }` and can grow.

---

## Open questions

None at present: #74 and #75 are sections 17 and 18.

---

# toggle.md: questions and feedback

## Conventions feedback

All five items below were applied to `design/conventions.md` on 2026-10-15 by the conventions
architect (uncommitted at the time of writing). They are kept here as the record of why.

1. **Optimistic updates do not activate `<ViewTransition>`** (section 7.2, verified). Conventions
   5.1 says "the optimistic feedback, the eventual commit, and a rollback all animate through the
   same boundary". Only the last two do. The sentence should become: "The optimistic commit is a
   sync-lane render and does not animate; the commit that ends the action, and any rollback,
   animate." This also affects Tabs: a `Tabs.Indicator` or `data-selected` style keyed on
   optimistic selection will not get a view transition on click; the `Tabs.Panel` swap (committed)
   will. Worth a line in 3.2 as well, since it is the second concrete cost of "triggers render
   optimistic state".
2. **`details.event` and Server Functions** (section 9). Resolved by research #17: `event` is a
   virtual Proxy-served property (conventions 2.2); Server Functions are passed directly.
3. **Boolean data attribute emission**: conventions 4.1's example `data-pending={pending ||
   undefined}` renders `data-pending="true"`, but the helper table and the prose specify
   `data-pending=""`. The example should read `data-pending={pending ? "" : undefined}`.
4. **Transition types on rollback commits are empty** (section 7.2 table). Conventions 5.3 could
   note that a snap-back or boundary-swap commit carries no `fsui-*` type, so type-map consumers
   need a `default` entry for rollbacks.
5. **Hook signature**: `transitionType` returning a single string cannot express
   `fsui-<component>` plus `fsui-<component>-<change>`; see 12.2.

## Questions for the product owner

1. Section 6.6: confirm "never disabled while pending" as the library-wide stance for triggers
   (it will come up again for Tabs and Accordion).
2. (Resolved by #17.) Server Functions are passed directly; see conventions 2.2.
3. Section 7: given that the flip itself cannot be view-transitioned, is a `transition` prop on
   Toggle worth keeping in v0 for consistency, or should Toggle ship without it until a component
   where it clearly pays off (Tabs.Panel) exists? Recommendation: keep it, documented honestly as
   in 2.8; it keeps the "every animatable part" rule simple, and since #35 an unset prop renders
   no boundary, so it is free for consumers who do not use it. (Resolved: kept.)

---

# tooltip.md: questions and feedback

## 11. Conventions feedback

1. **ViewTransition table (5.1 / 5.3).** Add a row stating that Tooltip renders no
   `<ViewTransition>` and has no `transition` prop, and that this follows from 3.5. The current
   wording "every part whose mount, unmount or content is driven by library state" is correct but
   a reader of 5.1 alone will expect `Popup` to wrap.
2. **Augmentation file (7.4).** Resolved: the CSS properties are augmented on
   `React.CSSProperties` inside the single `declare module "react"`; a `csstype` augmentation is
   not possible (not a dependency; TS2664 under pnpm).
3. **Id-reference merging (1.2).** "Library-controlled attributes (`aria-*` state, `id` wiring)
   win over the element's" should carve out ARIA id-reference lists (`aria-describedby`,
   `aria-labelledby`), which are merged as token lists. A trigger can be described by more than
   its tooltip.
4. **Listeners via `addEventListener` (1.5 / 7.4).** Tooltip attaches hover/focus listeners
   through refs rather than React event props, so no `on*` prop is omitted from its types. 7.4
   permits this for events React does not synthesize; it should say a part may do the same for
   synthesized events when the handlers must be feature-detected away, and that only prop-form
   handlers are omitted from the type.
5. **Required coverage (10.1).** Add: "Rows that cannot apply to a component with no action props
   (sync, async, rejection, overlap, post-await, controlled/uncontrolled parity) are listed as N/A
   in a comment at the top of the test file, with the reason."
6. **`open` in the vocabulary (4.1).** The table lists `open` on Popup and Trigger; Tooltip emits
   neither because 7.4's "do not duplicate a pseudo-class for browser-owned state" rule applies.
   Suggest the row read "library-owned open state only; browser-owned open uses `:popover-open`".
7. **RSC context providers (7.1).** Not needed by Tooltip, but the rule "directive-free files must
   not import from files with the directive" conflicts with React 19.3's sanctioned pattern of
   rendering a client-module context provider from a server file. Worth a sentence when a
   component actually needs it.

---

## 14. Open questions for the product owner

1. **"Zero-JS" reading.** No Tooltip part can be directive-free (section 2.4). Accept "no
   runtime behaviour JS on the native path, client components still hydrate", or ask for the
   `children`-function variant of `Root` that makes `Trigger` and `Popup` directive-free at the
   cost of a second API shape. Recommendation: accept. **Resolved (#19, 2026-10-23, option A;
   conventions 7.3 and resolved question 38):** accepted as recommended, and a directive-free
   Tooltip is ruled out on its own merits: `interestfor` is Chromium-only, so it would show no
   tooltip at all in Firefox and Safari (`docs/research/zero-js-variants.md` 4).
2. **Baseline popover type `manual`.** Chosen over `auto` so tooltips never close open menus.
   The price is that the library owns Escape and outside-click in JS until `hint` is universal.
3. **No `open` / `openChangeAction` / `data-open` in v0** (section 4.1). Confirm that a tooltip
   is the first component with no action prop at all.
4. **Focus delay.** Keyboard focus waits `delay` like hover (parity with Chromium's native
   behaviour). Radix and Base UI open instantly on focus. Keep parity, or special-case focus to 0?
5. **Prop name `provides`** for the name/description relation. Alternatives considered:
   boolean `label` (ambiguous with string labels), `relation` (vague).
6. **No skip-delay group** in v0 (section 6).
7. **Arrow ships thin** and mis-points after a fallback flip (section 3). Ship it, or hold it
   back until a resolved-side signal exists? (Held: conventions resolved question 10. The
   signal exists since wave 11, section 7.4; see the amendment below.)
8. **vitest browser mode** is the only way to test what this component actually does in a
   browser. The jsdom plan tests the JS shim and the markup only.

---

---

# toggle-group.md: test plan, docs pages, implementation notes, review fold

## 14. Test plan

`src/toggle-group/toggle-group.test.tsx`, `src/toolbar/toolbar.test.tsx` and
`src/internal/use-roving-focus.test.tsx` in jsdom; `src/toggle-group/toggle-group.browser.test.tsx`
and `src/toolbar/toolbar.browser.test.tsx` in browser mode (Chromium, Firefox, WebKit). Rows marked
(both) run under `renderBoth`. N/A rows for ToggleGroup: platform path (no residual browser path),
urgent action, continuous control, form channel, inside a Field (not a form control). N/A for
Toolbar: every action-state row except `Toolbar.Button`'s own sync / async / rejection / overlap /
superseded rejection, which `useActionTrigger` gives it (tested as for `Menu.Item`).

| # | Area | Project | Test |
| --- | --- | --- | --- |
| 1 | Roles and ARIA | jsdom | `ToggleGroup.Root` is `div[role="group"]` with `data-orientation`, no `aria-orientation`; Items are `button[type="button"][aria-pressed]`, never `"mixed"`; `data-pressed` / `data-pending` / `data-disabled` by presence. `Toolbar.Root` is `div[role="toolbar"][aria-orientation]`; `Toolbar.Button disabled` renders `aria-disabled="true"` and no `disabled`; `Toolbar.Separator` is `hr[aria-orientation]` perpendicular to the toolbar in both orientations. |
| 2 | Value model (both) | jsdom | Multiple: click dispatches `(next, { added, removed })` with `next` in document order and a fresh array; exclusive: switch carries both `added` and `removed`, deselect gives `null` with `removed: [prev]`; `deselectable={false}` dispatches nothing on the pressed Item; disabled Items (own and Root) never dispatch; `details.event` is the native click (asserted via `details.event`). |
| 3 | Async action (both) | jsdom | Deferred action: Item `aria-pressed` flips at once, `data-pending` on Root and the Item, sibling committed content unchanged; after resolve pending gone, content updated. Per-Item pending: a second click on the same Item clears its `data-pending` while the Root keeps it. |
| 4 | Rejection (both) | jsdom | Rejected action reaches `<ErrorCatcher>` above the Root; optimistic reverts; uncontrolled committed unchanged. Caught-inside resolves and commits. |
| 5 | Overlap | jsdom | Bold then Italic with two deferreds, resolved 2 → 1 and 1 → 2: final committed `[bold, italic]`; stacked patches re-base when 1 rejects. Settled changes (#150, uncontrolled multiple): 1 rejects before / after 2 resolves: committed `[italic]`, the rejection reported. Exclusive (uncontrolled, from `left`), both settle orders: a rejected press of Center then a resolved press of Right ends on Right alone; a rejected press of Center then a resolved release ends with nothing pressed. |
| 6 | Superseded rejection (both) | jsdom | Reject 1 after 2 resolved, and while 2 pends: `reportError` (stubbed) is called once and the catcher is not; 2's outcome unaffected. |
| 7 | Suspending content (both) | jsdom | 11.6 with `createSuspender`. |
| 8 | Function props, `render` | jsdom | Root and Item `className` / `style` / `children` / `render` receive the documented state; `render={<MyButton />}` keeps dispatch, class merge, `ref`. `Toolbar.Button render={<a href />}` gets no `type`. |
| 9 | Post-await rule | jsdom | Controlled parent updating after `await` inside `startTransition` converges in one state. |
| 10 | Keyboard, standalone group | jsdom | Matrix `{horizontal, vertical} × {ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Home, End}` with `loop` on and off; RTL swaps horizontal arrows (`direction: rtl` via style); disabled Items are skipped; arrows never dispatch; `preventDefault` on handled keys; modifier keys ignored. |
| 11 | Roving tab stop, standalone group | jsdom | After mount exactly one Item has `tabindex="0"`: the first pressed enabled Item, else the first enabled; it follows the optimistic pressed Item after a click (and reverts on rollback); an Item mounted later (child-only re-render) gets `tabindex="-1"` through the observer; an Item with its own `tabIndex={-1}` is skipped by arrows. Before the layout effect (SSR string) no `tabindex` is rendered. |
| 12 | Keyboard, Toolbar | jsdom | Same matrix over mixed children (`Toolbar.Button`, `Toggle`, plain `<button>`, `<a href>`, a disabled button, an `aria-disabled` `Toolbar.Button`): `disabled` skipped, `aria-disabled` reachable; memory: Tab out and back (focus `body`, then `tab()`) lands on the last focused item; first entry on the first item, `aria-disabled` included; the remembered item unmounting moves the stop to the first item. |
| 13 | Text-entry items | jsdom | An `<input type="text">`, a `textarea`, a `[contenteditable]` and a `role="spinbutton"` in the toolbar: arrows and Home / End are not `preventDefault`ed and move nothing; Tab from the input moves to the next item, Shift+Tab to the previous; Tab from a last-placed input leaves the toolbar (focus not inside). |
| 14 | ToggleGroup inside Toolbar | jsdom | One `tabindex="0"` in the whole toolbar; Left / Right flow through the group's Items and out the other side; the group renders no `focusgroup` even with `experimental_focusgroup` (warns once), and `orientation` / `loop` on it warn and are ignored; group `data-orientation` equals the Toolbar's; disabled Items skipped; the group's clicks still dispatch with correct `next`. |
| 15 | `Menu.Trigger` in a Toolbar | jsdom | Horizontal: ArrowDown opens with the first item focused and the toolbar does not move (`defaultPrevented`); ArrowRight moves to the next item without opening. Vertical: ArrowRight opens with the first item focused (ArrowLeft under RTL); ArrowDown moves to the next item without opening; Enter still opens. Outside a toolbar: unchanged. A `Menu.Popup`'s items are not toolbar items (arrow from the trigger after close lands on the next toolbar item). |
| 16 | `experimental_focusgroup` tokens | jsdom | `Toolbar.Root` renders `toolbar inline wrap`, `toolbar block nowrap` for vertical + `loop={false}`; standalone group adds `nomemory` and `focusgroupstart` on the first pressed Item, none when nothing is pressed; JS navigation still works in jsdom (no `focusGroup`); nested group renders none. |
| 17 | Dev warnings | jsdom | `value` + `defaultValue` warns once; `exclusive` switch after mount warns; nested group's ignored props warn once each. |
| 18 | Directive | script | Every part file in `dist/toggle-group/`, `dist/toolbar/`, `dist/internal/use-roving-focus.mjs` and `dist/internal/toolbar-context.mjs` starts with `"use client"`; the two `index.mjs` do not. |
| 19 | `details.event` is virtual | jsdom | As Toggle row 21, for `ToggleGroupValueChangeDetails` and `ToolbarButtonActionDetails`. |
| 20 | Native focusgroup path | browser | Chromium: with the flag, one Tab stop from outside (a `<button>` before and after the toolbar; `page.keyboard.press("Tab")` counts), items carry no `tabindex`, arrows and Home / End move (RTL mirrored), `disabled` skipped and `aria-disabled` reached, Tab from an `<input>` item goes to the next item, the nested `ToggleGroup` adds no Tab stop, Tab re-enters on the last focused item; standalone group: Tab enters on the pressed Item. Firefox and WebKit (`focusGroup` absent, `src/__tests__/engine.ts`): the same assertions hold through the JS path with the attribute inert. |
| 21 | JS path parity | browser | Without the flag, Chromium runs the JS path: the row-20 assertions hold identically (guards decision 7 and 6.3 across paths). |
| 22 | Safari click focus | browser | WebKit: clicking an item (which does not focus it) still makes it the Tab stop (`pointerdown` memory): Tab from outside lands on it. |
| 23 | ViewTransition | browser | `{show && <ToggleGroup.Item />}` and `{show && <Toolbar.Button />}` mounted in a `startTransition`: `document.startViewTransition` called zero times without `transition`, once with `transition="none"` (conventions 10.1). |
| 24 | Engine unit | jsdom | `use-roving-focus.test.tsx`: item discovery (focusable set, `[popover]` / `dialog` / nested toolbar / `inert` / `tabindex="-1"` exclusions), `entry` and `memory` modes, re-apply on observer records, `native: true` writes nothing. |
| 25 | Radio unit, navigation (#74) | jsdom | Toolbar `b1`, a same-`name` group of three radios with the middle one checked, `b2`, a group with none checked, `b3`. ArrowRight from `b1` focuses the checked radio and checks nothing; ArrowLeft from `b2` the same; ArrowRight from `b2` and ArrowLeft from `b3` both focus the **first** radio of the unchecked group; Home / End from `b2` land on `b1` / `b3` (the toolbar's first and last items; the native path does the same, and the probe never pressed Home from a button); a separate toolbar whose first and last items are radio units: Home / End land on their representatives; on a radio, every arrow and Home / End is left unhandled (`defaultPrevented` false, focus unchanged in jsdom, which has no native radio navigation); `loop` wrapping from `b3` lands on `b1`, from `b1` backwards on `b3`. |
| 26 | Radio unit, Tab (#74) | jsdom | Tab from the checked radio focuses `b2`; Shift+Tab from it focuses `b1`; Tab from an unchecked radio whose sibling is checked focuses that sibling, then `b2`; Tab from any radio of the unchecked group focuses `b3`, Shift+Tab `b2`; Tab from the last unit of a toolbar with nothing after it is not handled (leaves natively). `tabindex`: `0` on the representative while its unit is the stop and `-1` on the other radios of the unit; `-1` on every radio of a unit that is not the stop; after `focusin` on an unchecked radio, `0` moves to it. A `RadioGroup.Root` (fieldset) inside the toolbar behaves the same; `RadioGroup.Root disabled` removes the unit (`:disabled`). A `button[role="radio"]` is an ordinary item (arrows walk through it). |
| 27 | Radio unit, both paths (#74) | browser | The row-25 and row-26 sequences on Chromium native (flag on) and on the JS path (flag off, and Firefox / WebKit): identical focus and `checked` results, including arrows checking and wrapping within the group (WebKit: stopping at the group's last radio, the browser's own radio behaviour; the row branches on the engine for that step, `server.browser`) and the "trapped horizontal arrows, leave with Tab" consequence; memory re-enters on the remembered radio. WebKit runs on CI only. |
| 28 | Tooltip in a roving container (#75) | jsdom | A `Tooltip.Trigger` with `tabindex="-1"` written by the engine inside a standalone `ToggleGroup.Root` and inside a `Toolbar.Root` logs no #57 warning (before the selector change the row failed with three warnings: the check runs in a passive effect, after the engine's layout effect wrote `-1` in the same mount commit, so every non-first Item's Tooltip warned); a `tabindex="-1"` trigger under a plain `div` still warns. |

ViewTransition behaviour beyond row 23 is observed in the docs examples, as for every component.

---

## 15. Docs pages

- `packages/docs/src/pages/ToggleGroupPage.tsx` at `/components/toggle-group`: intro, the 2.1
  formatting example (`ToggleGroupStyles.tsx`, fake async save with a pending spinner, inside
  `DemoErrorBoundary`), the 2.2 alignment example with `exclusive` and the `deselectable={false}`
  variant (`ToggleGroupAlignment.tsx`), the controlled diff pattern of 2.3, anatomy, props tables for
  Root (both variants, with the `exclusive` discriminant explained), Item, state / data attributes,
  keyboard table 7.1, a "When to use RadioGroup instead" callout (research 1.2), the
  `experimental_focusgroup` note, the reduced-motion block.
- `packages/docs/src/pages/ToolbarPage.tsx` at `/components/toolbar`: intro, the 2.4 editor toolbar
  (`ToolbarEditor.tsx`: two groups, separators, a `Menu.Trigger`, `Toolbar.Button`s with a fake
  async action and an `aria-disabled` one, a text input last), the 2.5 vertical toolbar
  (`ToolbarVertical.tsx`), anatomy, props tables for Root / Button / Separator, keyboard tables 7.2
  to 7.4, the "one text-entry control, last" and "label the toolbar" callouts, a "before hydration
  every item is a Tab stop" note, CSS for the `<hr>` separator, the flag note.
- `packages/docs/src/navigation.ts`: `ToggleGroup` after `Toggle`, `Toolbar` after `Menu` in
  `componentNavItems`; routes in `App.tsx`.
- `ExperimentalPage.tsx`: two rows for `Toolbar.Root experimental_focusgroup` and
  `ToggleGroup.Root experimental_focusgroup`.
- `MenuPage.tsx`: a short "Inside a Toolbar" note with the 7.4 table.
- `TogglePage.tsx`: a cross-link ("several toggles that share a value: ToggleGroup").
- `RoadmapPage.tsx`: move ToggleGroup out of "more components" into the shipped list with Toolbar.
- `packages/example`: a page combining both with the Tooltip toolbar demo's icons, so the
  cross-engine behaviour of the Toolbar can be checked by hand.

---

## 16. Implementation notes

### 16.1 Files

```
packages/ui/src/internal/
  toolbar-context.ts          # "use client": ToolbarContext = createContext<{ orientation } | null>(null); useToolbarContext()
  use-roving-focus.ts         # "use client": the engine (6.2); exports isTextEntryItem for tests
  use-roving-focus.test.tsx
packages/ui/src/toggle-group/
  index.ts
  toggle-group-context.ts     # "use client": optimistic + committed sets, toggle(value, event), disabled, orientation, nativeFocusgroup, focusgroupStartValue, registerItem(element, value)
  toggle-group-root.tsx       # "use client"
  toggle-group-item.tsx       # "use client"
  toggle-group.test.tsx
  toggle-group.browser.test.tsx
packages/ui/src/toolbar/
  index.ts
  toolbar-root.tsx            # "use client"
  toolbar-button.tsx          # "use client"
  toolbar-separator.tsx       # "use client"
  toolbar.test.tsx
  toolbar.browser.test.tsx
```

`tsdown.config.ts` gains `src/toggle-group/index.ts` and `src/toolbar/index.ts`; both `index.ts`
import `../internal/platform-attributes.js` for the `focusgroup` / `focusgroupstart` typing
(conventions 7.4; `focusgroupstart` is added to the augmentation if Tabs has not already).

### 16.2 `ToggleGroup.Root`

- `useControllableAction<ReadonlySet<string>, ToggleGroupValueChangeDetails>` over the internal
  set (`controlled` mapped from `value`, `defaultValue` mapped the same way, `initialValue` an
  empty set), `reducer` = `reduce` of 5.2 in multiple mode and `undefined` in exclusive mode,
  `transitionTypes` from `added` / `removed`,
  `warn: { component: "ToggleGroup", prop: "value" }`. The action wrapper converts `next` to the
  consumer's shape (`string[]` in document order, or `string | null`) before calling
  `valueChangeAction`.
- `toggle(value, event)` (context): computes the patch per the 5.2 table against `optimistic`,
  returns without dispatching for the no-op cases, else `dispatch(reduce(optimistic, patch),
  createActionDetails(event, patch))`.
- `const toolbar = useToolbarContext()`; `inToolbar = toolbar !== null`. Standalone:
  `useRovingFocus(rootRef, { orientation, loop, native, entry: pressedFirst, memory: false })` and
  its handlers in `libraryProps`; inside a Toolbar: no engine, no handlers, `orientation =
  toolbar.orientation`, and `useDevWarning` for each of `orientation`, `loop`,
  `experimental_focusgroup` when passed (`experimental_focusgroup` only when `true`).
- Registration: `registerItem(element, value)` adds to a `Map<HTMLElement, string>` in a ref and
  returns the cleanup; the Item merges it into its ref with `useMergedRefs`. Document order at
  dispatch: the map's entries sorted with `compareDocumentOrder` (`internal/dom-order.ts`); the
  set arithmetic (`toSet`, `applyPatch`, `sortByOrder`, `EMPTY_SET`) is `internal/value-set.ts`.
- `nativeFocusgroup` comes from `useNativeFocusgroup(flag)` (`internal/use-native-focusgroup.ts`,
  shared with Tabs.List and Menu.Popup).
- `focusgroupStartValue` (standalone, flag on, every engine): the first pressed enabled value in
  the current order, or `null`. The order (and which values have a disabled Item) is the `layout` of
  `useItemOrder` (`internal/use-item-order.ts`, conventions 3.8, shared with CheckboxGroup),
  refreshed in a layout effect after each Root commit rather than a ref read during render; `state.value` is the optimistic set sorted by it (the value's own
  order until the first layout effect), while `next` is always sorted from the DOM at dispatch.
  An Item reordered by a child-only render is picked up at the Root's next commit.
- The multiple variant declares `deselectable?: never`: TypeScript's excess-property check does
  not reject `deselectable` on the union when no discriminant is present.

### 16.3 `ToggleGroup.Item`

- Reads context; `pressed = optimistic.has(value)`; `pending` per 5.3; `disabled = ctx.disabled
  || props.disabled`.
- Renders exactly what `Toggle` renders (same `useRender` call shape, `rendersButton`, owned keys)
  with `onClick: (e) => { if (disabled) return; ctx.toggle(value, e.nativeEvent); }` and
  `focusgroupstart` when `ctx.focusgroupStartValue === value`. The implementer may lift Toggle's
  attribute block into an internal helper (`internal/toggle-button-props.ts`) used by both; the
  public `Toggle` is unchanged either way.
- `useTransitionBoundary("ToggleGroup.Item", transition, element)`.

### 16.4 `Toolbar.Root`

- `useRovingFocus(rootRef, { orientation, loop, native, entry: firstEnabled, memory: true })`;
  provides `ToolbarContext` `{ orientation }` (memoised).
- `focusgroup` token string as Tabs.List builds it, without `nomemory`.

### 16.5 `Toolbar.Button`

- `const { pending, run } = useActionTrigger();` `onClick: (e) => { if (disabled) return;
  run(() => action?.(createActionDetails(e.nativeEvent, {}))); }`. `aria-disabled` instead of
  `disabled`; `type="button"` through `rendersButton`.

### 16.6 `Menu.Trigger`

- `const toolbar = useToolbarContext();` In `onKeyDown`: `openKeys = toolbar?.orientation ===
  "vertical" ? { [rtl ? "ArrowLeft" : "ArrowRight"]: "first" } : { ArrowDown: "first", ArrowUp:
  "last" }` with `rtl` from `getComputedStyle(event.currentTarget).direction` at keydown. Nothing
  else in Menu changes; `menu.md` 3.2 and 5 get a one-line amendment on acceptance.

### 16.7 `useRovingFocus` sketch

```ts
"use client";
export function useRovingFocus(ref: RefObject<HTMLElement | null>, options: RovingFocusOptions) {
  const current = useRef<HTMLElement | null>(null);
  const managed = useRef(new WeakSet<HTMLElement>());
  const latest = useLatest(options);

  const apply = useEffectEvent(() => {
    const root = ref.current; if (root === null || latest.current.native) return;
    const items = itemsOf(root, managed.current);
    if (!latest.current.memory || current.current === null || !items.includes(current.current)) {
      current.current = latest.current.entry(items) ?? null;
    }
    for (const el of items) { managed.current.add(el); el.tabIndex = el === current.current ? 0 : -1; }
  });
  useLayoutEffect(() => { apply(); });                      // after every commit of the container
  useEffect(() => {                                          // children that change without the container
    const root = ref.current; if (root === null) return;
    const mo = new MutationObserver(apply);
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden", "inert", "aria-disabled"] });
    return () => mo.disconnect();
  }, []);
  // onFocus / onPointerDown: if the target is an item of this root, current = item; apply().
  // onKeyDown: 6.2 and 6.3.
  return { onKeyDown, onFocus, onPointerDown };
}
```

`itemsOf` is the pure query of 6.2; `isTextEntryItem` the predicate of 6.3; both exported for the
unit test. As built (d5af7f5, 881cb37) the sketch differs in shape, not behaviour: `createEngine()`
is a closure object held in `useState` whose `setOptions` is called from an insertion effect
(oxlint's `react(refs)` rejects reading refs in the `useState` initializer, and the idiom is
`useLatest`'s); `managed` is a `Map<HTMLElement, string | null>` of original `tabindex` values with
`restore` / `release`; the options carry `enabled`; the handlers include `onBlur`; the observer is
installed only while `enabled`.

---

## Implementation and review fold (#66, 2026-10-18)

From `memo/developer/toggle-group.md` (deviations and "Review fixes") and
`memo/reviewer/toggle-group-toolbar.md` (d03c398; six should-fix findings, five nits, eight
deviation verdicts); library and tests in d5af7f5 and 881cb37, docs in a621645 and b185942. Each
item is folded into the sections named.

| # | Item | Folded into |
| --- | --- | --- |
| D1 | **Standalone Tab stop.** `memory: false` taken literally put Tab from an unpressed Item onto the pressed one, still inside the group. As built: while focus is inside, the focused Item is the stop; on `focusout` to outside (`onBlur`, a new owned handler) the stop returns to `entry` (the pressed Item), as native `nomemory` + `focusgroupstart`. Reviewer: acceptable, better than the literal design. | decisions 6, 3.1, 6.2, 7.1 |
| D2 | **Engine shape.** `enabled` option (the hook runs unconditionally, off inside a Toolbar); `managed` is a `Map` from element to original `tabindex` with cleanup (a stale `0` on a disabled button) and restore (review finding 2: `release()` had removed a consumer-rendered `tabindex="0"`, making a `div[role=spinbutton]` unreachable under the flag in Chromium after SSR); `release()` on the native switch-over after hydration; `[popover]` / `dialog` elements excluded, the element itself included in the check; options through an insertion effect. | 6.2, 6.5, 16.7 |
| D3 | **Item order** (`state.value`, `focusgroupstart`) from a `layout` state refreshed in a layout effect, not a ref read in render. One extra sync render at mount when the value's order differs from the DOM's. | 16.2 |
| D4 | **`focusgroupstart`** rendered whenever the flag is on, not only where native (16.2 had said "native"; row 16 and Tabs said "flag on"; the latter wins: identical server and hydration markup). | 8, 9, 16.2 |
| D5 | **First entry in a Toolbar** had skipped `aria-disabled` items (APG "first control that is not disabled"); review finding 1 showed Chromium's native `focusgroup` enters on an `aria-disabled` first item, and the design requires the paths to agree. **Product-owner decision: the first item, `aria-disabled` or not**, matching native. Browser row on both paths. | decisions 6, 6.2, 7.2, 14 row 12 |
| D6 | `deselectable?: never` on the multiple variant (excess-property checks do not cover the union without a discriminant); `@ts-expect-error` test. | 16.2 |
| D7 | A disabled link `Toolbar.Button` (`render={<a href />}`, `aria-disabled`) `preventDefault()`s the click. Correct for a focusable-disabled control. | 3.4 (implied) |
| R4 | **Popups reset the Toolbar context.** `Popover.Popup`, `Dialog.Popup`, `Menu.Popup` and `Combobox.Popup` render `<ToolbarContext value={null}>` around their content, so a ToggleGroup, a Separator or a `Menu.Trigger` inside a popup within a Toolbar behaves as outside one (the engine already excluded popup content, which had left such a ToggleGroup with no engine at all). jsdom rows for each. | 6.5 |
| R5 | **Rollback re-basing test** (14 row 5) now rejects Bold's save with Italic pending. React keeps every optimistic update of the async action scope until it settles, so the rollback is observable only at the end (controlled, consumer-caught rejection: Bold `false`, Italic `true`); the re-base itself is tested by changing the committed value under two pending presses. | 14 row 5 |
| R6 | **Native-path browser coverage** gained vertical + `loop={false}` (`block nowrap`) and `Menu.Trigger` in a horizontal and a vertical Toolbar (opens on the perpendicular arrow with the first item focused, menu arrows stay the menu's, Escape returns to the trigger, the toolbar arrow moves on), on both paths. Result: no divergence on any row tested (`memo/developer/cross-engine.md`). | 14 rows 20, 21 |
| N7 | **Owned handlers.** Both Roots omit every handler they own (`onKeyDown`, `onFocus`, `onBlur`, `onPointerDown`) from their props types, Tabs.List's rule; the docs pages say so. | 3.1, 3.3 |
| N8 | The in-Toolbar `experimental_focusgroup` warning fires only for `true`. | 3.1, 16.2 |
| N9 | 14 row 15 asserts the first menu item has focus after the perpendicular arrow. | 14 row 15 |
| N10 | **RTL `side` advice**: `side="left"` for a vertical toolbar's menu under `direction: rtl`. | 7.4 |
| N11 | Reduced-motion block on the Toolbar page (`Toolbar.Button` has `transition`). | 15 |
| N13 | Tooltip's #57 composite-role check does not know `role="group"`. Believed at the time not to fire (check before the engine's write); it did fire, since the check is a passive effect and the engine's write a layout effect. Issue #75, fixed in 5eef360. | section 18 |
| R3 | Native radios inside a Toolbar diverge between the paths. Issue #74; the Toolbar page advises an exclusive ToggleGroup meanwhile. | section 17 |

Browser-test notes recorded by the developer: Playwright refuses to click an `aria-disabled`
button ("element is not enabled"), so the click-memory row (14 row 22) clicks an enabled one; the
`pointerdown` memory path is isolated only in WebKit, which CI runs.

---

# popover.md: amendment #148

## Amendment: requests and facts, `onOpenChange` (#148, 2026-11-24, user decision; implemented 2026-11-24)

Design: `design/components/overlay-open-change.md` (sections 2 and 3 are Popover's; conventions
resolved question 45). It overrides every place above that calls a dismissal's
`openChangeAction(false)` a "notification" (2 mode table, 2.3, 2.5, 3.1, 4.1 to 4.4, 10.2, 11,
12, 13):

- `Popover.Root` gains **`onOpenChange?: UrgentChangeHandler<boolean,
  PopoverOpenChangeDetails>`**. `openChangeAction` hears **requests only**: Trigger opens and
  closes, `Popover.Close`, foreign opens (routed at `beforetoggle`), a popup found open at
  hydration (`"platform"`), lost interest while an interest open is still pending
  (`"dismiss"`).
- A **fact** is the `toggle` (closed) of a hide the library did not perform in its apply effect:
  Escape, Android back, AT dismiss, light dismiss, another `auto` popover or a modal dialog, a
  parent popover closing, script `hidePopover()` (`"dismiss"`); a foreign `popovertarget` or
  `hide-popover` / `toggle-popover` invoker (`"activate"`, with its `ToggleEvent` /
  `CommandEvent`); lost interest after an interest open (`"dismiss"`, the `loseinterest` event).
  In that listener the Root supersedes every request in flight, writes committed `false`
  urgently (uncontrolled) and calls `onOpenChange(false, details)` synchronously. No
  `data-pending`, no view transition, no `fsui-popover-close` type; the CSS exit and `held`
  work as before.
- The library's own `hidePopover()` is recognised by a marker set in the apply effect (as
  Dialog's `libraryClose`), no longer by "`false` is intended", so a dismissal during a pending
  part close is reported at once (2.5 of the design).
- **#115 changes mechanism**: a non-button Trigger pressed while open finds the popup already
  hidden by light dismiss (`hiddenBeforeToggle()`); its click records an `"activate"` intent with
  the click and dispatches nothing, and the pending `toggle` reports the fact. The development
  warning for a non-button Trigger now says the close is a dismissal reported to `onOpenChange`.
- **Controlled**: a parent that keeps `open={true}` after a fact gets the popup re-shown in the
  fact's own commit (`epoch` in the Root value re-renders the Popup; the apply effect re-shows),
  or once the requests the fact superseded settled. `open` without `onOpenChange` warns once.
  Call-site examples gain `onOpenChange={setOpen}`.
- **JS-free mode** is selected only when the Root has none of `open`, `defaultOpen`,
  `openChangeAction`, `onOpenChange`.
- Errors: a promise `onOpenChange` returns, and a throw, go to `reportError`; a request the fact
  superseded that later rejects goes to `reportError` too.

---

# dialog.md: amendment #148

## Amendment: requests and facts, `onOpenChange` (#148, 2026-11-24, user decision; implemented 2026-11-24)

Design: `design/components/overlay-open-change.md` (sections 2 and 6 are Dialog's; conventions
resolved question 45). It overrides every place above that calls a dismissal's
`openChangeAction(false)` a "notification" (2, 2.3, 2.5, 3.1, 4.1 to 4.4, 10.3, 11, 12, 13):

- `Dialog.Root` gains **`onOpenChange?: UrgentChangeHandler<boolean,
  DialogOpenChangeDetails>`**. `openChangeAction` hears **requests only**: the Trigger and a
  foreign `show-modal` command, a dialog found open at hydration (`"platform"`), `Dialog.Close`,
  `Dialog.Form` (a `method="dialog"` submit, or the settle of a function action), a foreign
  `request-close` / `close` command.
- A **fact** is the `close` event of a close the library did not perform in its apply effect
  (`libraryClose`, unchanged): Escape, Android back, AT dismiss, light dismiss (the JS baseline or
  native `closedby="any"`, the Trigger click of an open non-modal `lightDismiss` dialog
  included, #116), script `close(v)` / `requestClose(v)`, `form.submit()` on a
  `method="dialog"` form, a `submit` whose propagation the consumer stopped. In that listener the
  Root supersedes every request in flight, writes committed `false` urgently (uncontrolled) and
  calls `onOpenChange(false, { reason: "dismiss", returnValue })` synchronously, with
  `returnValue` as the browser left it. No `data-pending`, no view transition, no
  `fsui-dialog-close` type.
- **Deleted: the stored dismissal** (`dismissedWhilePending`, 2.3 and walkthrough 11.13). A
  dismissal while a part's close is in flight is reported at once and supersedes that close; a
  later veto of it changes nothing (the controlled parent already adopted the fact). The pending
  part's `returnValue` is still dropped when the browser closes first.
- **Controlled**: a parent that keeps `open={true}` after a fact gets the dialog re-opened in the
  fact's own commit (`showModal()` / `show()`, focus moves back in by the dialog focusing steps),
  or once the requests the fact superseded settled. `open` without `onOpenChange` warns once.
  Call-site examples gain `onOpenChange={setOpen}`; 12.4's welcome dialog passes the Server
  Function to both props (`openChangeAction={rememberDismissed} onOpenChange={rememberDismissed}`).
- **JS-free mode** is selected only when the Root has none of `open`, `defaultOpen`,
  `openChangeAction`, `onOpenChange`.
- Errors: 4.3's "dismissal notification rejects" row is now: a promise `onOpenChange` returns,
  and a throw, go to `reportError`. 4.2's "close notification pending" rows are gone with the
  notification.

---

# menu.md: amendment #148

## Amendment: requests and facts, `onOpenChange` (#148, 2026-11-24, user decision; implemented 2026-11-24)

Design: `design/components/overlay-open-change.md` (section 4 is Menu's; conventions resolved
question 45). It overrides every place above that calls a dismissal's `openChangeAction(false)`
a "notification" (2.2, 3.1, 10, 12):

- Every `Menu.Root` (top level, context menu, submenu) gains **`onOpenChange?:
  UrgentChangeHandler<boolean, MenuOpenChangeDetails>`**. `openChangeAction` hears **requests
  only**: Trigger / ContextTrigger / SubmenuTrigger opens (click, keys, long-press, hover after
  `delay`), foreign opens, a menu found open at hydration (`"platform"`), an item's close after
  its action (on the root Root), a Trigger click while open (#110), ArrowLeft in a submenu, and
  the pointer leaving a hover-opened submenu (`"dismiss"`: held by the library, so a request).
- **Facts** (`onOpenChange(false)`): Escape, light dismiss, another top-layer element, Tab /
  focus leaving the tree, a right- or middle-click outside, a scroll or a captured-pointer
  release outside under a context menu, a submenu hidden because its parent closed (whatever
  closed the parent, an item's request included), a foreign invoker (`"activate"`), script.
  Synchronous in the `toggle` listener; committed `false` urgently; no `data-pending`, no view
  transition. A context-menu **move** is neither.
- An item's action pending and Escape: the menu closes at once (the fact); the item's
  continuation finds a new open generation and requests nothing; its rejection follows the
  "owner left" rule (`reportError`).
- A controlled submenu Root needs `onOpenChange` like any controlled Root (the W1 warning says
  so); a parent that keeps `open={true}` gets the menu re-shown at once.

---

# combobox.md: amendment #148

## Amendment: requests and facts (#148, 2026-11-24, user decision; implemented 2026-11-24)

Design: `design/components/overlay-open-change.md` (section 5 is Combobox's; conventions
resolved question 45). What it changes here:

| | Before | After |
| --- | --- | --- |
| `onInputValueChange` returning a promise | dev warning once; a rejection is unhandled; a throw propagates out of the `input` listener | **allowed, no warning**; the promise is not awaited; a rejection and a synchronous throw go to `reportError`; the text write and everything after it still happen (the handler rule, conventions 2.1) |
| `openChangeAction` | every open-state change, dismissals as a "notification" | **requests only**: typing and arrow opens, Trigger, `openOnClick`, foreign opens, a popup found open at mount (`"platform"`), the close after an accepted option, Alt+ArrowUp |
| `onOpenChange` | (none) | **new**, `UrgentChangeHandler<boolean, ComboboxOpenChangeDetails>`, always `false`: Escape, focus leaving the input, light dismiss, another top-layer element, a `Clear` click while open, script `hidePopover()` (`"dismiss"`); a foreign invoker button (`"activate"`) |
| After a dismissal | optimistic `false`, the action awaited in the Root's transition, `data-pending` on Input and Trigger, committed `false` when it settled | committed `false` in the event's urgent commit; no `data-pending`; no view transition |
| Controlled `open`, parent keeps `true` after a dismissal (5.5) | re-opens after the action settles | re-opens at once; needs `onOpenChange={setOpen}` not to (development warns for `open` without `onOpenChange`) |

The Root's three states now have three shapes, each for a reason: `value` (requests only:
`valueChangeAction`), `inputValue` (facts only: `onInputValueChange`), `open` (both).
Unchanged: the text revert and the custom-value commit after focus leaves (`valueChangeAction`),
`Clear`'s `null` dispatch, `aria-expanded` from the `shown` mirror, the accept flow (a pending
`valueChangeAction` is not superseded by an Escape; its continuation requests no close).

Sections 3.1 (Root props), 5.4 (the Closing table's "notification" rows), 5.5 and the
walkthroughs of 10 are rewritten with the implementation. Developer: the "returned a promise"
warning text and its test row (amendment #96, implementation checklist) are deleted;
`onInputValueChange` is called through `callUrgentHandler` (overlay-open-change.md 11).

---

# overlay-open-change.md: the whole document (#148)

# Overlay open state: requests and facts (`openChangeAction` / `onOpenChange`)

Status: **accepted** (2026-11-24, GitHub issue #148; every open point decided by the user the
same day, conventions resolved question 45). **Implemented 2026-11-24** (branch
`feat/148-on-open-change`; probes and notes in `memo/developer/issue-148.md`). The conventions
sections of 12.2 are amended in place; the component designs carry a short "#148" amendment
that points here. One deviation from the sketch of section 11, recorded in conventions 3.4: the
optimistic passthrough stays the plain committed value and the epoch lives in the reducer's
closure, because an object passthrough defeated React's render bailout (an update loop with an
inline ref).

Scope: `Popover.Root`, `Menu.Root` (context menu and submenus included), `Combobox.Root`
(`open` only), `Dialog.Root`, and Toast's `closeAction`. Tooltip is covered to say what does not
change. One cross-component document instead of five amendments, because the change is one rule
applied to one shared hook (`internal/use-overlay-root.ts`); at acceptance each component design
gets a short amendment that points here (section 12).

Inputs: `docs/vision.md`; conventions 2.1, 2.2, 2.4, 2.6, 3.5, 5.1; the component designs;
`memo/architect/143-design-questions.md` (#147, #148); the user's decisions on issue #148
(2026-11-23 and 2026-11-24).

## Decisions at a glance

| # | Topic | Decision | Source |
| --- | --- | --- | --- |
| 1 | The rule | An **action** (`fooAction`) is a change the library can still roll back: called before the commit, in a transition, awaited, with pending and optimistic state. An **`on*` handler** reports a change the library cannot hold: synchronous, urgent, not awaited, no pending state. | user |
| 2 | Where the pair exists | Only on overlay Roots: Popover, Menu, Combobox (`open`), Dialog. `openChangeAction` for requests, `onOpenChange` for facts. | user |
| 3 | Controlled refusal | A controlled Root whose parent keeps `open={true}` after a fact **re-opens**. The prop and the DOM never disagree. | user |
| 4 | Uncontrolled fact | Committed `open` becomes `false` urgently, in the event. No `data-pending`, no view transition. | user |
| 5 | Form controls, Accordion | `reason: "platform"` dispatches stay actions. No form control gets a second prop. | user |
| 6 | Dev warning | `open` without `onOpenChange` warns. No runtime heuristic (section 9). | user |
| 7 | What a fact is, exactly | The `toggle` (closed) / `close` event of a hide **the library did not perform in its apply effect**: everything `notifyClosed` receives today. Channel and `reason` are independent (section 2.2). | architect |
| 8 | A fact while a request is in flight | The fact wins: it supersedes every request in flight (section 2.5). Dialog's "dismissal kept for a vetoed part close" machinery is deleted. | architect |
| 9 | **Every `on*` handler the library defines** | One library-wide rule: called synchronously, not awaited, no pending state; it may return a promise; a returned promise's rejection and a synchronous throw go to `reportError`; no dev warning for a returned promise. Covers `onOpenChange` (four Roots), Toast's `onClose` and the existing `onInputValueChange`, whose promise warning is removed (section 2.6). | user |
| 10 | Toast `closeAction` | Renamed `onClose`, under rule 9 (section 7). | user |
| 11 | A popup found open at hydration | Stays a request: `openChangeAction(true, { reason: "platform" })`, as today. `onOpenChange` only ever receives `false` (section 2.12). | user |
| 12 | Tooltip | No callback today, none added. If one is ever wanted it is `onOpenChange` only. | architect |

---

## 1. The rule

The rule, as written into conventions 2.1 / 2.6 at acceptance, and into principle 3 of
`docs/vision.md` (bc0512c), which replaced its old "one exception React forces" paragraph:

> A prop named `action` or `fooAction` is a **request**. The library calls it before the change
> is committed, inside a transition, and awaits it; the outcome decides the state. A rejection,
> or a controlled parent that does not adopt, rolls the UI back, so the change has pending and
> optimistic state.
>
> A prop named `onFoo` reports a **fact**: a change that had already happened when the library
> heard of it, and that the library could not have held. It is called synchronously in the
> event that reports it, outside any transition, and is not awaited. There is no pending or
> optimistic state for it: the DOM already holds the new value.
>
> The test: **if the callback rejects, or the parent ignores it, can the library put the UI back
> without the user noticing?** If yes, it is an action. If the change was performed by the
> browser in front of the user (a popup the user dismissed, a keystroke), it is a fact.

Three consequences that follow from the test, each decided by the user:

- `onInputValueChange` (Combobox) is no longer "the one exception": it is the first fact.
- A form reset, a find-in-page reveal and input before hydration on a **form control or an
  Accordion** stay actions (`reason: "platform"`). The browser changed the DOM first, but there
  the DOM is the optimistic state: the library restores it on a rejection or a refusal, cheaply
  and invisibly. Same shape as a click.
- A dismissed popup fails the test. The user saw it go away; showing it again is not a rollback
  anybody wants, so the library does not offer one in uncontrolled mode. (Controlled mode
  re-opens, decision 3, for a different reason: the prop is the truth.)

A new `on*` prop needs the component's design doc to show who performs the change and why the
library cannot hold it, and a conventions amendment (the gate of 2.1, reworded from "a
React-imposed urgency").

---

## 2. Shared semantics (Popover, Menu, Combobox, Dialog)

### 2.1 Props, before and after

The four Roots share this part of their props. `<C>` is the component.

| Prop | Before | After |
| --- | --- | --- |
| `open?: boolean` | Controlled open state. | Unchanged. |
| `defaultOpen?: boolean` | Initial state, uncontrolled. | Unchanged. |
| `openChangeAction?: ChangeAction<boolean, <C>OpenChangeDetails>` | Every change: awaited for opens and for closes a part asks for; a "notification" after a dismissal. | **Requests only**: opens, and closes a part asks for. Never called for a fact. Contract unchanged (transition, awaited, pending, optimistic, Error Boundary, veto in controlled mode). |
| `onOpenChange?: UrgentChangeHandler<boolean, <C>OpenChangeDetails>` | (none) | **New. Facts only**: the popup was closed without the library performing the close. Synchronous, urgent, not awaited. |

`<C>OpenChangeDetails` is one type for both props (`reason`, the virtual `event`, and Dialog's
`returnValue`), so one function can serve both:

```tsx
// Controlled: the same setter in both channels. In the action it is a transition update,
// in the handler an urgent one.
const [open, setOpen] = useState(false);
<Dialog.Root open={open} openChangeAction={setOpen} onOpenChange={setOpen}>

// Uncontrolled: load on open (a request), log dismissals (a fact).
<Popover.Root
  openChangeAction={async (open) => { if (open) await preloadFilters(); }}
  onOpenChange={(open, { reason }) => track("filters closed", reason)}
>

// Controlled, server-backed open; dismissals adopted at once.
<Popover.Root
  open={open}
  openChangeAction={async (next) => {
    if (next) await prefetchFilters();
    startTransition(() => setOpen(next)); // after an await: wrap (conventions 2.3 item 4)
  }}
  onOpenChange={setOpen}                  // never wrap this one (section 2.4)
>
```

Types (`internal/types.ts`):

```ts
/** A fact about a state: called synchronously in the event that reports it, outside any
 *  Transition, not awaited. A returned promise's rejection, or a synchronous throw, is passed
 *  to reportError (the rule for every `on*` handler, conventions 2.1). */
export type UrgentChangeHandler<T, Details extends ActionDetails = ActionDetails> = (next: T, details: Details) => void;
```

The type is the existing one; only its doc comment changes. `void` as the return type accepts a
function that returns a promise (a Server Function, an `async` arrow), which is intended.

Trade-off, stated: controlled mode now needs two props where it needed one. The two names
differ by a prefix and a suffix, and the difference is the whole point (one is asked, one is
told), but it is one more thing to learn. The dev warning of section 9 catches the omission.
In these four components `onOpenChange` is only ever called with `false` (2.12); the `boolean`
argument stays for the pair's symmetry (`onOpenChange={setOpen}`) and for a future fact that
opens.
Rejected: letting `onOpenChange` alone receive requests too when `openChangeAction` is absent
(a second meaning for the name), and a combined `openChange` prop (no name left to say which
lane it runs in).

### 2.2 What is a fact, exactly

**A fact is the platform event (`toggle` with `newState: "closed"` on a popover, `close` on a
dialog) of a hide that the library did not perform in its apply effect.** That is precisely the
set of calls `notifyClosed` receives today (two call sites: `use-popover-popup.ts`,
`dialog-popup.tsx`), so the split needs no new classification code. It includes hides the
library *triggers* but cannot hold, because holding them would leave a popup on screen that the
user has already left: Menu's Tab-out, right-click outside and scroll close, Combobox's
focus-leaving close, the lost-interest hide, Dialog's JS Escape and light dismiss.

Everything dispatched through `requestOpen` / `requestClose` today stays a request.

**Channel and `reason` are independent.** The channel says whether the library held the change;
`reason` (conventions 2.2, vocabulary unchanged) says what the user did. Most facts are
`"dismiss"` and most requests `"activate"`; `"platform"` is always a request (2.12). The
crossovers:

| Channel | `reason` | Where |
| --- | --- | --- |
| `onOpenChange` | `"activate"` | A consumer's own invoker button (`popovertarget`, `commandfor` with a popover command) closes a popover, menu or listbox: the user acted on a button, the browser performed the hide (#125). A non-button Trigger pressed while open (#115). |
| `openChangeAction` | `"dismiss"` | A close the library does hold although no part asked: the pointer leaving a hover-opened submenu (`menu-hover.ts`), lost interest while an interest open is still pending (nothing is shown yet; the `false` supersedes the open). |

`onOpenChange` is never called for a change the consumer made through the `open` prop, for the
library's own hide after a request, or for the library's re-open of a refused fact.

### 2.3 Uncontrolled: what a fact does

In the platform event's listener, in this order, all in one batch:

1. The existing bookkeeping: clear `awaitingClose`, consume the close intent, read the exit
   animations and set `held` if there is a CSS exit (popover.md 4.4, unchanged).
2. Supersede the requests in flight (section 2.5).
3. Write committed `open = false` with a plain `setState`: **urgent**.
4. Call `onOpenChange(false, details)` synchronously.

One urgent commit follows. In it the Trigger loses `data-open`, the Popup's children unmount
(or stay for the CSS exit while `held`), and nothing is pending. No transition is started, so
no view transition runs and no `fsui-<component>-close` type is added. An unrelated async
action that is pending somewhere in the app does not delay any of this (today it delays the
committed state, because the notification commit is entangled with it: conventions 2.3 item 5).

### 2.4 Controlled: what a fact does, and the re-open

Steps 1, 2 and 4 are the same; step 3 is the parent's:

```tsx
<Dialog.Root open={open} openChangeAction={setOpen} onOpenChange={setOpen}>
```

`setOpen(false)` inside the handler is an urgent update, batched with the library's own
bookkeeping into the same commit; committed `open` is `false` in it and the DOM agrees.

**A parent that keeps `open={true}`** (decision 3): the commit that follows the event renders
`open={true}` over a hidden popup, and the apply effect, which already re-applies the prop to
the DOM after every commit, shows it again (`showPopover({ source })` / `showModal()`).

- The library forces that commit itself (an urgent internal state write in step 2), so the
  re-open does not depend on the parent re-rendering.
- It happens in the task of the `toggle` / `close` event: the popup was hidden for the time
  between the browser's hide and that event (about one task; a frame may paint). Today it stays
  hidden until the notification action settles; the re-open is now immediate.
- It is a fresh show: a new open generation, the CSS enter (`@starting-style`) runs, but **no
  initial focus of the library's own** (#155, user decision 2026-11-24): focus stays where the
  dismissal put it (the Trigger after Escape, the next tab stop after a Tab-out), so an
  un-migrated controlled Menu cannot trap the keyboard (review-148 L3). `usePopoverPopup` keeps a
  `refusedFact` flag: set when a fact hides the popup, cleared by any commit with `committed`
  false (the fact adopted), consumed by the next show. The rule holds for every popover element:
  **a refused re-open never moves focus.** For a refused re-show the library sets `inert` on the
  popup (any element) for the duration of the synchronous `showPopover()` call (only when the
  consumer has not set `inert` themselves) and removes it right after, so the popover focusing
  steps find nothing focusable and do nothing, whether they are the dialog focusing steps of a
  `<dialog popover>` (Popover's default) or a consumer's own `autofocus` in a `<div>` popup:
  the element the user clicked outside keeps focus with no `blur` / `focus` event and its
  selection, and after a refused Escape focus stays on the Trigger (#156, user decision
  2026-11-24, option (d) of `memo/architect/156-refused-reopen-focus.md`). If the popup's CSS
  exit transition is still running, the browser reverses that transition on the re-show. A
  non-modal Dialog (`modal={false}`, re-shown with `show()`, which runs the same dialog focusing
  steps) follows the same rule: `Dialog.Popup` keeps its own `refusedFact` flag and is `inert`
  for the duration of `show()` (#156 review L1). The modal Dialog is not covered: its re-open
  with `showModal()` is a normal open with initial focus, because a modal dialog must hold focus
  (and the content outside it is inert while it is open anyway). The children were never
  unmounted (committed never left `true`), so their state is kept.
- No callback is called for the re-open: the parent was told `false` and chose `true`.
- No view transition (the commit is urgent).
- While a request is in flight the apply effect waits, as it does today, and re-opens when it
  settled (section 2.5).

This is still **not a veto**: the user sees the popup go and come back. A popup that must not
be dismissed is configured on the platform side (Dialog without `lightDismiss`,
`experimental_closedBy="none"`), and docs keep saying "adopt a fact's `false`".

**The handler must write state directly.** `onOpenChange={(o) => startTransition(() =>
setOpen(o))}`, or a `setOpen` after an `await`, leaves `open={true}` in the event's own commit:
the popup is re-opened and then closed again when the late update lands. This is the mistake
the library's own "wrap it in `startTransition`" advice (conventions 2.3 item 4) invites, so
the docs of every Root say it next to the prop. No warning can catch it reliably (section 9),
so the sentence in the docs is the whole defence.

A controlled parent's own later updates are its own: if a request that was in flight when the
fact arrived calls `setOpen(true)` after its `await`, the parent has set `open={true}` and the
popup opens. Controlled state is the parent's; the library does not filter it.

### 2.5 A fact while a request is in flight

Three situations exist; a fact cannot arrive while an open is pending and nothing is shown
(there is nothing to hide; a cause that arrives then, like lost interest, is a superseding
request as today).

| In flight when the fact arrives | Today | After |
| --- | --- | --- |
| A part's close (`openChangeAction(false)` awaited, popup still shown), then Escape | The dismissal is not dispatched (`false` is already intended). Dialog stores it and sends it only if the parent later vetoes the part's close (dialog.md 2.3, 11.13). | `onOpenChange(false, { reason: "dismiss" })` at once. Uncontrolled: committed `false` now. The request keeps running; its outcome no longer decides anything. Both callbacks were called: the consumer was asked, then told. |
| A Close part's own `action` (the Close's transition; no Root request yet), then Escape | Notification dispatched; the Close's continuation finds `false` intended and requests nothing. | The fact, at once. The continuation's `requestClose` is a no-op as today, so `openChangeAction(false)` is never called for this close. |
| Trigger clicked twice while shown (close requested, then open requested again; the popup never hid), then Escape | The notification is a third dispatch and wins as the latest. | The fact wins: the pending open request must not show the popup again when it resolves. |

Rule: **a fact supersedes every request in flight on that Root.** In
`useControllableAction` terms (new method, section 11):

- the latest-dispatch counter advances, so no dispatch in flight commits uncontrolled state;
- the in-flight intent becomes the fact's value, so `intended()` is `false` and the next
  Trigger click is an open;
- optimistic patches older than the fact are dropped, so the Trigger does not keep `data-open`
  for a hidden popup while a superseded action is still running;
- a superseded request that later **rejects** goes to `reportError`, not to the Error Boundary
  (conventions 2.4: it is no longer the latest intent). Its resolution changes nothing.

One honest leftover: React's `isPending` stays `true` until the superseded action settles, so
the Trigger shows `data-pending` (without `data-open`) for that time. It reports the request
that is still running, not the dismissal; a dismissal by itself never produces `data-pending`.

Controlled mode, same situations: the handler is called at once, the parent adopts urgently.
If the parent keeps `open={true}`, the re-open waits until nothing is in flight, as the apply
effect does for every re-application today.

### 2.6 The handler's contract: the rule for every `on*` handler

User decision (2026-11-24): one rule for **every `on*` handler the library defines**, written
into conventions 2.1. "Consistency and simplicity are very important."

- Called **synchronously** in the event that reports the fact, outside any transition. A
  `setState` in its body is urgent.
- **Not awaited.** Nothing is pending or optimistic for it.
- **It may return a promise.** The library attaches a rejection handler that calls
  `reportError`. A synchronous throw is caught and passed to `reportError` too, so the
  library's own bookkeeping after the call still runs. Nothing reaches an Error Boundary: there
  is no render to throw from and nothing to roll back.
- **No dev warning for a returned promise.**

The handlers it covers (the complete list; a search of the public props found no other `on*`
prop that is not a DOM pass-through):

| Handler | Type | Change |
| --- | --- | --- |
| `Popover.Root`, `Menu.Root`, `Combobox.Root`, `Dialog.Root`: `onOpenChange` | `UrgentChangeHandler<boolean, <C>OpenChangeDetails>` | new |
| `toast({ onClose })` (`ToastOptions`) | `UrgentHandler<ToastCloseDetails>` | renamed from `closeAction` (section 7) |
| `Combobox.Root`: `onInputValueChange` | `UrgentChangeHandler<string, ComboboxInputValueChangeDetails>` | **its "returned a promise" dev warning is removed**; a rejection or a throw now goes to `reportError` (before: an unhandled rejection; a throw propagated out of the `input` listener) |

Specific to `onOpenChange`: called once per fact with `(next, details)`; `details.event` is
the platform event (or the recorded cause: the `CommandEvent`, the `loseinterest` event, the
`click`).

One shared helper implements the rule (`internal/call-urgent-handler.ts`, section 11), so the
three call sites cannot drift.

### 2.7 What each surface shows after a dismissal

Uncontrolled, or controlled with an adopting parent. "Fact commit" is the urgent commit of the
`toggle` / `close` task.

| Surface | Reads | Before | After |
| --- | --- | --- | --- |
| Popup visibility, `:popover-open` / `:open` | DOM | hidden at once by the browser | same |
| Exposed expanded state: the browser's own on a `popovertarget` Trigger (#121); `aria-expanded` on a non-button Trigger and on `Combobox.Input` (the urgent `shown` mirror, #118) | DOM / `shown` | `false` in the `toggle` task | same |
| Trigger `data-open`, `state.open` on Root / Trigger (Menu: `ContextTrigger` and `SubmenuTrigger` too; Combobox: Input and Trigger) | optimistic | removed when the notification is dispatched | removed in the fact commit (the same moment) |
| Committed `open`: Popup `state.open`, children mounted | committed | `true` until the notification action settled and its transition committed; later still while any async action is pending in the app | `false` in the fact commit |
| Trigger `data-pending`, Root `state.pending` | Root transition | present while the notification action runs | **absent** (except for a superseded request still running, 2.5) |
| Popup children | committed, `held` | unmount at the notification commit, or after the CSS exit | unmount in the fact commit, or after the CSS exit (`held`, unchanged) |
| View transition | transition commit | the notification commit starts one, with `fsui-<c>-close` | **none**, no type |
| A rejection | | Error Boundary above Root, for a popup that is already gone | `reportError` (a returned promise) |

### 2.8 View transitions and the `transition` prop

The `transition` prop of the Popup parts is unchanged in shape and meaning. What it animates:

| Change | Lane | `<ViewTransition>` |
| --- | --- | --- |
| Open through a request; content swap while open | transition, `fsui-<c>-open` | yes |
| Close through a request (Trigger, Close, item, Form) | transition, `fsui-<c>-close` | yes, in every engine |
| Controlled close (the parent sets `open={false}` in a transition) | the parent's transition, no library type | yes |
| **A fact** (dismissal), adopted or uncontrolled | urgent | **never**. CSS exit only (`@starting-style` / `allow-discrete`; none in Firefox) |
| Re-open of a refused fact | urgent | never. CSS enter |
| `held` release after a CSS exit | urgent | never (unchanged) |

So the split is by who performs the change: the view transition animates what the library does,
CSS animates what the browser does. A dismissal with `transition` set and no CSS exit used to
start a view transition that had nothing to show; it now starts none. Section 10 has the
consequence for #147.

### 2.9 Errors

| Case | Before | After |
| --- | --- | --- |
| `openChangeAction(true)` rejects | boundary; nothing shown | unchanged |
| A part's `openChangeAction(false)` rejects | boundary; popup still open | unchanged |
| The callback for a dismissal rejects | boundary above Root, which unmounts the component | `onOpenChange`: `reportError`; the UI is untouched |
| Controlled veto of an open, or of a part's close | snap-back | unchanged |
| Controlled refusal of a fact | re-open after the action settles | re-open at once (2.4) |
| A request in flight, superseded by a fact, rejects | n/a (the notification was a dispatch) | `reportError` (2.5) |

### 2.10 Server Functions

`details` stays serialisable with a virtual `event` (conventions 2.2), for both props.

- A Server Function passed to `openChangeAction` hears **requests only**. It no longer hears
  Escape or a click outside. This is the main behavioural loss of the change.
- A Server Function may be passed to `onOpenChange`, also from a Server Component. It is called
  from the event and not awaited; nothing shows pending; a rejection goes to `reportError`
  (2.6). This is what the "may return a promise" half of the rule buys: without it, "remember
  that the welcome dialog was dismissed" (dialog.md 12.4) would need a Client Component
  wrapper.

```tsx
// Server Component (dialog.md 12.4, after). A Close button is a request, Escape is a fact:
// to hear both, pass both.
<Dialog.Root defaultOpen={!user.sawWelcome} openChangeAction={rememberDismissed} onOpenChange={rememberDismissed}>
```

To verify at implementation (not probed): that the RSC frameworks in use accept a Server
Function call made outside a transition without a warning (it is a plain `callServer` call;
Next.js wraps the call in its own transition).

### 2.11 JS-free mode

Popover and Dialog select JS-free mode when the Root has **none of** `open`, `defaultOpen`,
`openChangeAction`, `onOpenChange` (one prop added to the test; the mode-switch dev warning
names four props). JS-free mode itself is unchanged: the browser owns every open and close, no
callback exists, the CSS exit is the only animation.

A Root with only `onOpenChange` is an uncontrolled library-mode Root. Rejected: a "JS-free plus
listener" mode (the browser owns the state, the handler only observes). It would be a third
mode with its own rules for `data-open` and content mounting, for a need `toggle` on a `ref`
already covers.

Menu and Combobox have no JS-free mode; nothing changes there.

### 2.12 A popup found open at hydration: a request, unchanged

Library mode renders the native invoker markup, so a click before hydration opens the popup
natively and empty; at mount the Popup finds it open with committed `false` (popover.md 2.4,
dialog.md 2.4) and dispatches `openChangeAction(true, { reason: "platform", event: undefined
})` in the Root's transition. The content mounts when it settles; a rejection or a refusing
parent hides the popup. **This stays exactly as it is** (user decision, 2026-11-24).

Why it is a request although the browser opened the popup first: it passes the rule's test. The
library can roll it back (it hides an empty popup), and the DOM is the optimistic state, which
is the reasoning that keeps pre-hydration input on form controls an action (decision 5). Every
open then goes through one channel, so load-on-open code in the action runs for all of them,
and Suspense and pending state behave as for any open.

Consequence: **`onOpenChange` is only ever called with `false`** in the four overlays.

History: the first draft of this document specified it as a fact (`onOpenChange(true, {
reason: "platform" })`) and offered this as the alternative. The fact version skipped the
action's load-on-open code, needed a transition for the uncontrolled write anyway (an urgent
mount of suspending content shows the nearest Suspense fallback), and made a controlled parent
wrap `setOpen(true)` while it must not wrap `setOpen(false)`.

---

## 3. Popover

### 3.1 Root props

| Prop | Before | After |
| --- | --- | --- |
| `open`, `defaultOpen`, `children` | | unchanged |
| `openChangeAction` | `ChangeAction<boolean, PopoverOpenChangeDetails>`: awaited for `true` and for a part's `false`; a notification for a dismissal | same type; **requests only** |
| `onOpenChange` | | **new**: `UrgentChangeHandler<boolean, PopoverOpenChangeDetails>` |

`PopoverOpenChangeDetails` (`{ reason: ChangeReason }` plus the virtual `event`),
`PopoverRootState` (`open` optimistic, `pending`) and every other part's props are unchanged.

### 3.2 Which event goes where

| Cause | Channel | `next` | `reason` | `details.event` |
| --- | --- | --- | --- | --- |
| Trigger click while closed | `openChangeAction` | `true` | `"activate"` | `click` |
| A foreign open: a consumer's invoker button, script `showPopover()`, interest (cancelled at `beforetoggle`, routed through the library) | `openChangeAction` | `true` | `"activate"` | `beforetoggle` `ToggleEvent` |
| `<button>` Trigger click while open | `openChangeAction` | `false` | `"activate"` | `click` |
| `Popover.Close`, after its own `action` if it has one | `openChangeAction` | `false` | `"activate"` | `click` |
| Lost interest while the interest open is still pending (#127) | `openChangeAction` | `false` | `"dismiss"` | `loseinterest` |
| Found open at hydration (2.12; unchanged) | `openChangeAction` | `true` | `"platform"` | `undefined` |
| Escape, Android back, an assistive-technology dismiss | **`onOpenChange`** | `false` | `"dismiss"` | `toggle` `ToggleEvent` |
| Light dismiss (click outside) | **`onOpenChange`** | `false` | `"dismiss"` | `toggle` |
| Another `auto` popover or a modal dialog opening outside the stack; a parent popover closing | **`onOpenChange`** | `false` | `"dismiss"` | `toggle` |
| Script `hidePopover()` | **`onOpenChange`** | `false` | `"dismiss"` | `toggle` |
| A foreign `hide-popover` / `toggle-popover` `commandfor` button | **`onOpenChange`** | `false` | `"activate"` | `CommandEvent` |
| A foreign `popovertarget` button (#125) | **`onOpenChange`** | `false` | `"activate"` | `beforetoggle` `ToggleEvent` (`source` is the button) |
| Lost interest after an interest open, popup shown (#127; the library's `hidePopover()` by proxy) | **`onOpenChange`** | `false` | `"dismiss"` | `loseinterest` |
| A non-button Trigger (`render={<a />}`) pressed while open (#115: light dismiss hides it at `pointerup`, before the `click`) | **`onOpenChange`** | `false` | `"activate"` | `click` |
| Controlled `open` changed by the parent; the library's re-open of a refused fact; removal from the document | none | | | |

The #115 row changes mechanism: today the `click` dispatches `(false, "activate")` as a request
for a popup that is already hidden. After: when the Trigger's click finds `true` intended but
the popup no longer `:popover-open`, it records an `"activate"` close intent with the click and
dispatches nothing; the pending `toggle` reports the fact. Reason and event are as today. The
existing browser row for #115 pins it.

### 3.3 Behaviour

Uncontrolled and controlled: sections 2.3 to 2.5. `data-open`, `data-pending`, the exposed
expanded state: 2.7. View transitions: 2.8. Nesting: an outside click closes the whole stack
and each Root gets its own `onOpenChange(false, { reason: "dismiss" })`; Escape closes the
innermost only. Focus return (popover.md 6.2) is untouched: it is driven by the `toggle`
listener, not by the dispatch.

Walkthroughs to rewrite at acceptance: popover.md 11 (every row that ends in "notification"),
4.3 ("Dismissal notification rejects" becomes one line: `reportError`), 2.3 ("A controlled
parent that refuses a dismissal": immediate re-open), 12.3 and 12.4 (controlled examples gain
`onOpenChange={setOpen}`).

---

## 4. Menu (context menu and submenus included)

### 4.1 Root props

| Prop | Before | After |
| --- | --- | --- |
| `open`, `defaultOpen`, `loop`, `delay`, `closeDelay`, `children` | | unchanged |
| `openChangeAction` | `ChangeAction<boolean, MenuOpenChangeDetails>`: awaited for `true` and for part closes; a notification for dismissals | same type; **requests only** |
| `onOpenChange` | | **new**: `UrgentChangeHandler<boolean, MenuOpenChangeDetails>` |

The same two props on every `Menu.Root`: the top-level one, a context-menu Root
(context-menu.md 3.1 adds nothing), and each submenu Root.

### 4.2 Which event goes where

| Cause | Channel | `next` | `reason` |
| --- | --- | --- | --- |
| Trigger click, Enter / Space / ArrowDown / ArrowUp on the Trigger, while closed | `openChangeAction` | `true` | `"activate"` |
| `ContextTrigger`: `contextmenu`, long-press, Shift+F10 / the Menu key (context-menu.md 2) | `openChangeAction` | `true` | `"activate"` |
| `SubmenuTrigger`: click, ArrowRight, Enter, hover after `delay` | `openChangeAction` (the submenu's Root) | `true` | `"activate"` |
| A foreign open (invoker button, script) | `openChangeAction` | `true` | `"activate"` |
| Found open at hydration (2.12; unchanged) | `openChangeAction` | `true` | `"platform"` |
| Item activation with `closeOnActivate`, after the item's `action` | `openChangeAction` (the **root** Root) | `false` | `"activate"` |
| Trigger click while open (#110) | `openChangeAction` | `false` | `"activate"` |
| ArrowLeft in a submenu | `openChangeAction` (that submenu's Root) | `false` | `"activate"` |
| The pointer leaving a hover-opened submenu, after `closeDelay` (held by the library today, `menu-hover.ts`; unchanged) | `openChangeAction` (that submenu's Root) | `false` | `"dismiss"` |
| Escape (the innermost menu) | **`onOpenChange`** | `false` | `"dismiss"` |
| Light dismiss; another `auto` popover or modal dialog opening outside | **`onOpenChange`** (every Root of the stack) | `false` | `"dismiss"` |
| Tab / Shift+Tab, focus leaving the menu tree (the library's immediate `hidePopover()`) | **`onOpenChange`** | `false` | `"dismiss"` |
| Right-click or middle-button press outside the tree (#45) | **`onOpenChange`** | `false` | `"dismiss"` |
| Context menu placed at a point: scroll of the document or an ancestor; captured-pointer release outside (context-menu.md 5) | **`onOpenChange`** | `false` | `"dismiss"` |
| A submenu hidden because its parent menu closed, whatever closed the parent (also a request on the root: item activation) | **`onOpenChange`** (the submenu's Root) | `false` | `"dismiss"` |
| A foreign invoker button closing the root popup (#125, #126) | **`onOpenChange`** | `false` | `"activate"` |
| Script `hidePopover()` | **`onOpenChange`** | `false` | `"dismiss"` |
| A context-menu **move** (right-click inside the region while open, context-menu.md 4.3); controlled prop change; re-open of a refused fact | none | | |

### 4.3 Behaviour

Sections 2.3 to 2.9 apply to each Root independently. Notes specific to Menu:

- **An item's action is pending and the user presses Escape.** The fact closes the menu at
  once. Uncontrolled: committed `false`; the items unmount (after the CSS exit, `held`). The
  item's action keeps running in the item's own transition; its continuation finds the menu
  closed (open-generation guard) and requests nothing; its rejection follows the existing
  "owner left" rule (`reportError`, conventions 2.4, #152).
- **Item activation closes a root with open submenus.** One request on the root Root
  (`openChangeAction(false, "activate")`); when the root popup hides in its commit, each submenu
  Root gets `onOpenChange(false, { reason: "dismiss" })` from its own `toggle`. Today those are
  `openChangeAction` notifications. A controlled submenu Root needs `onOpenChange` like any
  other controlled Root (the library would otherwise try to show it again under a hidden
  parent); the warning of section 9 covers it.
- `ContextTrigger` and `SubmenuTrigger` render optimistic `data-open` and the Root's
  `data-pending` like the Trigger: both follow 2.7. `data-context` on the Popup keeps its own
  rule (until the popup is hidden and its exit is over).
- `aria-expanded` on a `SubmenuTrigger` (a `menuitem`, not an invoker button) is the `shown`
  mirror: unchanged.
- `CheckboxItem` / `RadioItem` state (`checkedChangeAction`, `valueChangeAction`) is not open
  state and is untouched: actions.

---

## 5. Combobox

### 5.1 Root props (open state only)

| Prop | Before | After |
| --- | --- | --- |
| `open`, `defaultOpen` | | unchanged |
| `openChangeAction` | `ChangeAction<boolean, ComboboxOpenChangeDetails>`: every change | same type; **requests only** |
| `onOpenChange` | | **new**: `UrgentChangeHandler<boolean, ComboboxOpenChangeDetails>` |
| `value` / `defaultValue` / `valueChangeAction` | | unchanged: an action |
| `inputValue` / `defaultInputValue` / `onInputValueChange` | the "one exception"; a returned promise is a dev warning | reclassified as a fact (the keystroke is in the DOM first); under the rule of 2.6 the promise warning is removed and a rejection or a throw goes to `reportError` |

After the change the Root has three states in three shapes, each for a stated reason: `value`
(requests only: nothing but the library changes it), `inputValue` (facts only: the browser
writes every keystroke), `open` (both: parts ask, the browser dismisses).

### 5.2 Which event goes where

| Cause | Channel | `next` | `reason` |
| --- | --- | --- | --- |
| Typing; ArrowDown / ArrowUp / Alt+ArrowDown while closed; Trigger click while closed; a pointer click in the input with `openOnClick`; a foreign open | `openChangeAction` | `true` | `"activate"` |
| Found open at mount (2.12; only script can cause it here; unchanged) | `openChangeAction` | `true` | `"platform"` |
| The close after an accepted option (after `valueChangeAction` settled); re-accepting the selected option; Trigger click while open (#112); Alt+ArrowUp | `openChangeAction` | `false` | `"activate"` |
| Escape while open | **`onOpenChange`** | `false` | `"dismiss"` |
| Focus leaving the input to outside the popup (the library's immediate `hidePopover()`) | **`onOpenChange`** | `false` | `"dismiss"` |
| Light dismiss; another `auto` popover or modal dialog opening outside; a `Clear` click while open (the button is outside the popup) | **`onOpenChange`** | `false` | `"dismiss"` |
| A foreign invoker button closing the listbox (#126) | **`onOpenChange`** | `false` | `"activate"` |
| Script `hidePopover()` | **`onOpenChange`** | `false` | `"dismiss"` |

### 5.3 Behaviour

- What a close *also does* is unchanged and stays on its own channel: the text revert or the
  custom-value commit after focus leaves (`valueChangeAction`, an action, combobox.md 5.3), the
  `Clear` dispatch of `null`.
- **An accepted option's `valueChangeAction` is pending and the user presses Escape.** The fact
  closes the listbox at once (`onOpenChange`). The value action is a different state: it is not
  superseded, keeps `data-pending` on the option's owner and commits or rolls back as today;
  its continuation requests no close (nothing is open; open-generation guard).
- `aria-expanded` on the Input is the `shown` mirror (#118): unchanged. `data-open` on Input
  and Trigger is optimistic: 2.7.
- Controlled `open` with a refusing parent: the listbox re-opens at once after Escape, with the
  input still focused. Controlled `open` on a Combobox is rare; the docs example gets
  `onOpenChange={setOpen}`.

---

## 6. Dialog

### 6.1 Root props

| Prop | Before | After |
| --- | --- | --- |
| `open`, `defaultOpen`, `modal`, `children` | | unchanged |
| `openChangeAction` | `ChangeAction<boolean, DialogOpenChangeDetails>`: awaited for `true` and for a part's `false`; a notification for a dismissal | same type; **requests only** |
| `onOpenChange` | | **new**: `UrgentChangeHandler<boolean, DialogOpenChangeDetails>` |

`DialogOpenChangeDetails` keeps `reason` and `returnValue` on both channels: for a fact,
`returnValue` is `dialog.returnValue` as the browser left it (`""` for Escape).

### 6.2 Which event goes where

| Cause | Channel | `next` | `reason` | `returnValue` |
| --- | --- | --- | --- | --- |
| Trigger click; a foreign `show-modal` command (cancelled, routed) | `openChangeAction` | `true` | `"activate"` | `undefined` |
| Found open at hydration (2.12; unchanged) | `openChangeAction` | `true` | `"platform"` | `undefined` |
| `Dialog.Close`, after its own `action` if it has one | `openChangeAction` | `false` | `"activate"` | the Close's `value` |
| `Dialog.Form` without a function `action`, or any `method="dialog"` submit inside the Popup | `openChangeAction` | `false` | `"activate"` | the submitter's `value` |
| `Dialog.Form` with a function `action`, when it settled (`closeOnSettle`) | `openChangeAction` | `false` | `"activate"` | the submitter's `value` |
| A foreign `request-close` / `close` command (cancelled, routed) | `openChangeAction` | `false` | `"activate"` | the invoker's `value` |
| Escape, Android back, an assistive-technology dismiss (the platform's close request; the JS `keydown` baseline of a non-modal dialog) | **`onOpenChange`** | `false` | `"dismiss"` | `""` |
| Light dismiss: `lightDismiss` (JS baseline or native `closedby="any"`), including a Trigger click on an open non-modal `lightDismiss` dialog (#116) | **`onOpenChange`** | `false` | `"dismiss"` | `""` |
| Script `dialog.close(v)` / `requestClose(v)`; `form.submit()` on a `method="dialog"` form | **`onOpenChange`** | `false` | `"dismiss"` | `dialog.returnValue` |
| Controlled prop change; re-open of a refused fact; removal from the document (no `close` event) | none | | | |

`cancel` stays the consumer's pass-through hook for the platform's close request, with the
platform's once-per-activation rule; nothing about it changes.

### 6.3 Behaviour

Sections 2.3 to 2.9, with `close` in place of `toggle` and `showModal()` / `show()` for the
re-open (focus moves back into the dialog by the dialog focusing steps). Dialog-specific:

- **Deleted: the stored dismissal** (`dismissedWhilePending`, dialog.md 2.3 and walkthrough
  11.13). It existed because a dismissal during a pending part close could not be dispatched
  ("one `openChangeAction(false)`, not two") and had to survive a veto of the part's close. A
  fact is now reported the moment it happens (2.5), so there is nothing to store. The pending
  part `returnValue` is still dropped when the browser closes first.
- **The echo is recognised by its source**, as today (`libraryClose`). Popover's echo check
  moves from "`false` is already intended" to the same kind of marker (section 11), because "a
  fact during a pending part close" must now be reported and not mistaken for an echo.
- `Dialog.Form` (`closeOnSettle`, `closedSinceSubmit`): unchanged; a dismissal while the form
  action runs is a fact, and the settle then finds the dialog closed, as today.
- JS-free mode (2.11) and non-modal dialogs (never JS-free, dialog.md 2.6): no change beyond
  the channel.
- dialog.md 4.3 loses "Dismissal notification rejects" (now: `reportError`); 4.2's "close
  notification pending → Trigger pending" and "re-open while a close notification is still
  pending" rows disappear with the notification.

---

## 7. Toast: `closeAction` becomes `onClose`

User decision (2026-11-24): option (c) of the first draft. `closeAction` is renamed `onClose`
and follows the rule of 2.6.

### Why

`toast({ closeAction })` was called once when a toast leaves, with `ToastCloseDetails` (`id`,
`reason`: `"activate"` when its Action settled, `"dismiss"` for `Toast.Close` / Escape /
`toast.dismiss()`, `"timeout"`). The queue write that removes the toast is urgent by design
(conventions 2.6), so the toast is already leaving; the callback then ran from a microtask
inside the **Viewport's** transition and was awaited there. By the rule of section 1 that is a
fact for every reason: there is nothing the library could roll back (the request in a toast is
`Toast.Action`'s `action`, which stays an action). Running it in a transition also had two side
effects:

- **Entanglement.** While an async `closeAction` was pending, every transition in the app
  waited for it (conventions 2.3 item 5): a slow `deleteForReal` that started because a timer
  elapsed, with no user gesture, delayed an unrelated navigation.
- **The error surface was the whole toast region.** A rejection replaced everything under the
  boundary above the Viewport, for a toast that had already left. Elsewhere the rejection of an
  action whose owner has left is already report-only (conventions 2.4, #152).

### At the call site (the Undo-window pattern, toast.md 9.3)

```tsx
toast({
  title: "Message deleted",
  duration: 8000,
  action: { label: "Undo", action: () => restoreToList(id) },
  onClose: ({ reason }) => (reason === "activate" ? undefined : deleteForReal(id)),
});

// Showing the failure to the user is the consumer's:
onClose: async ({ reason }) => {
  if (reason === "activate") return;
  try {
    await deleteForReal(id);
  } catch {
    restoreToList(id);
    toast({ title: "Could not delete the message", priority: "high" });
  }
},
```

The first form is the old call site with one word changed, and a Server Function can be passed
directly. An unhandled failure reaches `window`'s `error` event and monitoring tools, and fails
a test run that does not expect it; the toast region stays up. Lost: the Error Boundary route.
A consumer who relied on the boundary to show a failed delete must catch (second form).

### Spec

| | Before | After |
| --- | --- | --- |
| Option on `ToastOptions` (wherever it is accepted today) | `closeAction?: Action<[details: ToastCloseDetails]>` | `onClose?: UrgentHandler<ToastCloseDetails>` |
| When | a microtask after the close, inside the Viewport's transition | where the close is applied to the queue (the Viewport's handler, timer callback or command loop), after the entry is marked ending; never inside a transition (the queue is urgent, toast.md 3.4) |
| Awaited | yes, by the Viewport's transition | no |
| A `setState` in the body | a transition update | urgent |
| Rejection / throw | Error Boundary above the Viewport | `reportError` |
| `reason` values, once per close, not called on Viewport unmount, called for a toast dismissed before it rendered | | unchanged |
| Viewport `useTransition` for close actions; the "`closeAction` in flight" state row (toast.md 12) | exists | removed |

```ts
/** A fact that carries no state. Same lane and error rule as UrgentChangeHandler. */
export type UrgentHandler<Details extends ActionDetails = ActionDetails> = (details: Details) => void;
```

The name is `onClose`, not `onOpenChange`: a toast has no `open` state (no `open` /
`defaultOpen`), so the conventions 2.1 row is "a fact with no state: `on<Event>`", which
replaces the reserved "Other notification: `<event>Action`" row. `Toast.Action`'s `action`,
`whilePending` and `closeOnSettle` are untouched.

History: the alternatives were (a) keep `closeAction` as an explicit exception to the rule
(both side effects stay) and (b) `onClose` with the return value ignored and a dev warning for
a promise (`void deleteForReal(id).catch(…)` at the call site, no Server Function).

---

## 8. Tooltip

No change. Tooltip has no `open` prop, no callback and no `data-open` (tooltip.md 4.1), and
this design adds none.

What changes is the argument in tooltip.md 4.1. It rejected an `openChangeAction` because a
tooltip's open state is browser-owned and an action "would invite awaited work on every hover".
Under the rule the answer is simpler: every tooltip open and close is performed by the browser
or by timers the user drives, so nothing about it is a request, and **if a callback is ever
wanted it is `onOpenChange` only** (both `true` and `false`, synchronous, no entanglement). It
would still cost the native path its only remaining listener, so it is not proposed now.

---

## 9. The development warning

User decision (2026-11-24): **the static warning only.**

`open !== undefined && onOpenChange === undefined`, checked once per Root instance after mount
(`useDevWarning`), in the four Roots:

```
Dialog.Root: `open` is set without `onOpenChange`. The browser can close this dialog without
asking (Escape, a click outside), and `onOpenChange` is where a controlled Root is told.
Without it the dialog re-opens after every dismissal. Pass `onOpenChange={setOpen}`, or
`onOpenChange={() => {}}` if re-opening is what you want.
```

This is React's `value` without `onChange`. React's opt-out is `readOnly`; here it is an
explicit empty handler, which states the intent in the code. An intentional re-open with a
handler (`onOpenChange={(o) => { if (!saving) setOpen(o); }}`) never triggers it.

**No runtime heuristic.** The mistake the static check cannot see is late adoption: a handler
that sets state in `startTransition` or after an `await` (2.4). At runtime it looks exactly
like an intentional re-open followed by an unrelated programmatic close ("the dialog cannot be
dismissed while saving; it closes when the save completes"): `open` stays `true` in the event's
own commit and turns `false` in a later one. The difference is when the parent scheduled its
update, which a child cannot observe; a lane probe fails on entanglement (conventions 2.3 item
5) and "no user input in between" fails on the same example. The first draft offered a
100 ms-window heuristic (W3) with a stated residual false positive; the user dropped it. The
docs sentence next to the prop (2.4) is the defence against late adoption.

Not warned either: `open` without `openChangeAction` (a Trigger-less controlled dialog is
legitimate with `onOpenChange` alone, dialog.md 12.3), and a promise returned from any `on*`
handler (2.6).

---

## 10. Interaction with #147 (CSS exit and view transition on one popup)

#147's restriction had two halves (memo, "#147", the "both" row):

1. **Library close**: the view transition and the popup's CSS exit start together; in Chromium
   the hidden box stays rendered through its fade and the new snapshot shows it next to the old
   image.
2. **Dismissal**: the CSS exit starts, then the *notification commit*, a transition commit,
   starts a view transition in the middle of the fade and captures the fading box in both
   snapshots.

**Half 2 disappears.** A fact produces an urgent commit, and only transition commits start a
view transition (2.8). After this change a dismissal starts none, with or without `transition`
on the Popup, in every engine. What goes with it:

- the "Dismissal" row of the view-transition tables (popover.md 10.2, dialog.md 10.3) becomes
  "never; CSS exit only";
- the browser rows "a dismissal runs one view transition, not two" become "runs none";
- the reason the recipe selector had to cover dismissals. Its stated side cost (an unrelated
  page view transition cuts a dismissal's fade) is no longer something the recipe needs to
  accept for the dismissal's own sake;
- in option B of #147 (the library cuts the popup's CSS transition around its own hide), the
  branch "cut at the notification commit too" is not needed. The library's cut is exactly: in
  the apply effect, around its own `hidePopover()` / `close()`, when `transition` is set.

**Half 1 remains** and is #147's to decide (recipe, or the library's inline cut after a
three-engine probe). It is unaffected by this design. **Decided 2026-11-24: the library's inline
cut (option B)**, around its own show as well as its hide (conventions 5.1,
`internal/css-transition-cut.ts`); the recipe line is gone from every stylesheet.

One residual overlap is new only in the sense that it is now the consumer's doing: a controlled
parent that adopts a fact inside `startTransition` (the late-adoption mistake) gets the
re-open, and then a controlled close in a transition commit, with a view transition if
`transition` is set. The docs name it (2.4); nothing warns (section 9).

Order of work: #148 first, then the #147 probe, which then has one case to cover instead of
two.

---

## 11. Implementation sketch (for the developer; not binding in detail)

**First step: the four probes at the end of this section.** The design rests on them; run them
(throwaway, three engines where a browser is involved) before writing library code, and bring
a failed one back to the architect.

- **`useControllableAction`**: one new method next to `adopt`:

  ```ts
  /** A fact: `next` is already true in the DOM. Supersedes every dispatch in flight (none of
   *  them commits; a later rejection is reported, not thrown), makes `next` the in-flight
   *  intent, drops older optimistic patches, and in uncontrolled mode writes the committed
   *  value urgently. Never calls the action. Call it from the platform event's listener. */
  readonly adoptFact: (next: T) => void;
  ```

  Dropping older optimistic patches: the `useOptimistic` passthrough becomes `{ value:
  committed, epoch }` with `epoch` in urgent state; a patch carries the epoch of its dispatch;
  the reducer ignores a patch whose epoch is older than the passthrough's. React re-bases
  pending patches when the passthrough changes, so one urgent `setEpoch` drops them. The same
  `setEpoch` is the urgent write that forces the commit in which a controlled Root re-opens.
  Other state owners never call `adoptFact` and are unaffected.
- **`useOverlayRoot`**: `onOpenChange` in the options and in mode detection; `notifyClosed`
  stops being an alias of `requestClose` and becomes: skip if this is the library's own hide;
  `adoptFact(false)`; call the handler through the shared helper below.
- **`internal/call-urgent-handler.ts`** (new, directive-free): `callUrgentHandler(handler,
  ...args)` calls the handler in `try` / `catch`, passes a throw to `reportError`, and attaches
  `.then(undefined, reportError)` to a returned thenable. The three call sites use it:
  `onOpenChange`, Toast's `onClose`, and Combobox's `onInputValueChange` (where it replaces the
  "returned a promise" dev warning).
- **`use-popover-popup.ts`**: the echo of the library's own `hidePopover()` is recognised by a
  marker set in the apply effect (as Dialog's `libraryClose`), not by `intended()`. The apply
  effect's re-open branch is unchanged. The #115 Trigger path (section 3.2).
- **`dialog-popup.tsx`**: remove `dismissedWhilePending`.
- **Mount reconciliation** (2.12): untouched, still `requestOpen(undefined, "platform")`.
- **Toast**: `scheduleCloseActions` becomes a synchronous loop after the queue write;
  the Viewport's close transition is removed.
- **Type guard** (`action-naming.test.ts`): the `on*` allow-list gains `onOpenChange` on the
  four Root props types (and `ToastOptions.onClose` if it is covered there).
- **The four probes** (the first step, above): (1) updates scheduled from a native `toggle` /
  `close` listener batch into one synchronous-lane commit with the parent's `setOpen` (expected:
  React reads the priority from `window.event`); (2) the passthrough re-base of `useOptimistic`
  drops the stale patch in the same commit; (3) a re-open inside a running CSS exit reverses it
  cleanly in Chromium and WebKit; (4) 2.10's Server Function call outside a transition.

---

## 12. Migration

### 12.1 Breaking changes (for the Roadmap page)

1. **`openChangeAction` no longer runs for dismissals** on `Popover.Root`, `Menu.Root`,
   `Combobox.Root` and `Dialog.Root`: Escape, a click outside, Android back, an
   assistive-technology dismiss, focus leaving a menu or combobox, a right-click outside a
   menu, another top-layer element, script `hidePopover()` / `close()`, a consumer's own invoker
   button closing a popover, lost interest. They are reported to the new `onOpenChange`
   instead.
2. **A controlled Root needs `onOpenChange`** as well: `open={open} openChangeAction={setOpen}
   onOpenChange={setOpen}`. Without it the popup re-opens after every dismissal (development
   warns).
3. **`onOpenChange` must set state directly**, not in `startTransition` and not after an
   `await`.
4. **A dismissal is no longer pending**: no `data-pending` on the Trigger, `state.pending`
   stays `false`, the committed state is `false` at once, and the callback is not awaited.
5. **A dismissal starts no view transition** and carries no `fsui-<component>-close` type.
   `transition` on a Popup animates opens and the closes a part asks for; a dismissal is
   animated by CSS only.
6. **A controlled Root that keeps `open={true}` after a dismissal is re-opened at once**, not
   after the callback settled.
7. **Errors**: a failing dismissal callback no longer reaches an Error Boundary; a rejected
   promise returned from `onOpenChange`, or a throw, goes to `reportError`.
8. **A dismissal during a pending close is reported at once**; a request that was in flight is
   superseded (its rejection goes to `reportError`). `Dialog.Root` no longer holds such a
   dismissal back.
9. **Server Functions**: one passed to `openChangeAction` no longer hears dismissals; pass it
   to `onOpenChange` too.
10. **Submenu Roots**: a submenu closed by its parent menu reports through `onOpenChange`.
11. **JS-free mode** (Popover, Dialog): `onOpenChange` on the Root selects library mode.
12. **Toast**: `toast({ closeAction })` is renamed `onClose`. It is called synchronously when
    the toast closes, is not awaited, no longer holds other transitions, and its rejection goes
    to `reportError` instead of the Error Boundary above the Viewport.
13. **`Combobox.Root`'s `onInputValueChange`** may return a promise: the development warning is
    gone, and a rejection or a throw goes to `reportError` (not breaking for correct code).

Not changing: a popup opened before hydration is still reported through
`openChangeAction(true, { reason: "platform" })`.

A codemod is not worth writing: the mechanical part (add `onOpenChange` next to a controlled
`openChangeAction`) is one line per Root, and the rest is a decision per call site.

### 12.2 Design documents to amend at acceptance

- `docs/vision.md` principle 3: the "one exception" paragraph becomes the rule of section 1.
- conventions: decisions 2, 3, 11; 2.1 (table: `on<State>Change` as "a fact about a state",
  `on<Event>` in place of the reserved notification row, the gate reworded; "never names a prop
  `onOpenChange`" removed); 2.2 (`"dismiss"` row: channel note; the crossover table of 2.2
  here); 2.4 (the fact handler's error route; superseded-by-a-fact); 2.6 (the urgent lane
  generalised; Toast's `closeAction` sentence); 3.4 (`adoptFact`); 3.5 (the "browser-owned"
  column: `xChangeAction` and "Controlled mode" and "Pending" rows; the "library-owned for some
  causes" bullet); 4.1 / 4.3 (no `data-pending` for a fact); 5.1 and 5.3 (no view transition
  and no close type for a fact); 10.1 (a new row "Fact handler (both)", the Urgent handler row
  merged into it, the Action naming allow-list). **Already applied at acceptance**: decisions
  2 and 11, 2.1, 2.6 (the handler rule, `onInputValueChange`'s warning, Toast's `onClose`), the
  Urgent handler row of 10.1, resolved question 45. The rest (2.2, 2.4, 3.4, 3.5, 4, 5, the new
  10.1 row) describes shipped behaviour and is amended with the implementation.
- popover.md 2 (mode table), 2.3, 2.5, 3.1, 4.1 to 4.4, 10.2, 11, 12, 13; dialog.md the same
  sections plus 2.3's stored dismissal, 11.13, 12.4; menu.md 2.2, 3.1, 10, 12; context-menu.md
  3.1, 5, 7, 10; combobox.md 3.1, 5.4, 5.5, 10; toast.md 3.3, 3.4, 9, 11, 12, 14;
  tooltip.md 4.1 (the argument). combobox.md and toast.md carry an amendment section for #148
  since acceptance; the other component designs get theirs with the implementation.

### 12.3 Churn estimate

Counted with `grep` on the current tree; upper bounds on what must be read, not on what must
be rewritten.

**Tests** (`packages/ui/src`):

| File(s) | Tests today | Lines mentioning `"dismiss"` | Expected work |
| --- | --- | --- | --- |
| `popover.test.tsx` / `.browser.test.tsx` | 92 / 46 | 10 / 17 | spy moves to `onOpenChange` in about 25 tests; the pending / notification / refusal rows rewritten (about 8) |
| `menu.test.tsx` / `.browser.test.tsx` | 100 / 38 | 6 / 8 | about 14 spy moves; submenu-closed-by-parent rows (about 4) |
| `menu-context-trigger.test.tsx` / `.browser.test.tsx` | 112 / 40 | 5 / 5 | about 10 spy moves |
| `combobox.test.tsx` / `.browser.test.tsx` | 141 / 47 | 5 / 8 | about 13 spy moves; controlled-refusal row rewritten |
| `dialog.test.tsx`, `dialog-close.test.tsx`, `dialog-form.test.tsx`, `dialog.browser.test.tsx` | 50, 19, 17, 30 | 3 + 16 lines in close / form | about 12 spy moves; the stored-dismissal rows (11.13) deleted and replaced (about 4) |
| Shared suites: `overlay-open-state-suite.tsx` (38), `overlay-browser-suite.tsx` (9), `overlay-close-part-suite.tsx` (15), `foreign-invoker-press-browser-suite.tsx` (2) | 64 | 6 | the dismissal-notification, refusal and re-open rows rewritten once for all four components (about 10); foreign-invoker rows flip channel |
| `toast.test.tsx` / `.browser.test.tsx` | 105 / 11 | 51 lines mentioning `closeAction` | a rename in about 20 tests; the "runs in a transition" and "rejection reaches the boundary" rows inverted (2) |
| `use-controllable-action.test.tsx`, `use-popover-hooks.test.tsx`, `action-naming.test.ts` | 15, 9, 4 | | new: `adoptFact` rows (about 6), allow-list entries |

In total: about 95 existing tests edited mechanically (the callback spy changes prop), about
30 rewritten because the asserted behaviour changes (pending, error route, re-open timing,
view-transition counts), about 30 new (the "Fact handler" row per component in both modes, a
fact during each kind of in-flight request, immediate re-open, the static warning, the Server
Function shape, the `reportError` route of each of the three handlers). The browser suites carry the rows that matter most (real Escape and light dismiss,
view-transition counts in three engines).

**Docs site** (`packages/docs`): the Browser-owned state page (the "Parts vs dismissals"
section is rewritten around the two channels) and the Action props page (the rule; the handlers
section) are the two conceptual rewrites; Popover (17 mentions of `openChangeAction`), Dialog
(19), Menu (6), Context menu (2), Combobox (6) pages each gain a props-table row, a "Requests
and facts" section and updated controlled examples; Toast page (7 mentions of `closeAction`); Pending and optimistic, Server Components and Suspense pages: a paragraph each;
Tooltip page: one sentence; Roadmap: the list of 12.1. Ten example files use `openChangeAction`
or `closeAction` (the controlled ones gain a prop; `ToastUndoWindow.tsx` is renamed inside).
The agent skill (`skills/funstack-ui-knowledge/SKILL.md`): three lines. The playground
(`packages/example`): four demo files, 18 mentions. With #147 decided, nine stylesheets lose or
narrow the recipe line.

---

## 13. Resolved questions (user, 2026-11-24)

1. **A popup found open at hydration** stays a request, `openChangeAction(true, { reason:
   "platform" })`; `onOpenChange` only receives `false` (2.12).
2. **A promise returned from a handler**: allowed, never a warning; rejection and throw to
   `reportError`. Made a library-wide rule for every `on*` handler, `onInputValueChange`
   included (2.6).
3. **The development warning** is the static one only; the runtime heuristic is dropped
   (section 9).
4. **Toast**: `closeAction` becomes `onClose` under the handler rule (section 7).
5. Noted without objection: the pointer leaving a hover-opened submenu stays a request with
   `reason: "dismiss"`, so "dismiss" does not always mean `onOpenChange` (2.2).

Also decided on the issue: no alpha release until #148 has landed.

---

# popover.md: test plan, implementation notes, review corrections, decisions, amendments

## 13. Test plan

### 13.1 jsdom shim additions (`src/__tests__/popover-shim.ts`)

The shim from the Tooltip implementation covers `showPopover` / `hidePopover` / `togglePopover`,
a synchronous `beforetoggle`, a coalesced, task-queued `toggle`, and `:popover-open`. Popover
needs these additions, each mirroring the platform: `beforetoggle` for an **open** honours
`preventDefault()` (the popover stays hidden; a close's `beforetoggle` stays non-cancelable);
`showPopover({ source })` records the source so a test can assert it (no anchoring in jsdom);
a document-level `click` emulation for `button[popovertarget]` (#121, no `command` event) and for `button[commandfor]` with `show-popover`,
`hide-popover` and `toggle-popover` that dispatches a cancelable `command` event on the target
and runs the command unless prevented (shared with the dialog shim in `invoker-shim.ts`);
**the popover focusing steps** run by `showPopover()` once shown (a `<dialog>`: the `autofocus`
descendant, else the first sequentially focusable descendant, else the dialog itself, which jsdom
focuses only with a borrowed `tabindex="-1"` for the call; any other popover: itself with
`autofocus`, else an `autofocus` descendant), so the jsdom focus rows assert what the browsers
do without a library fallback (6.1); and **every shown popover made `display: block`**
(`data-popover-shim-open` plus a `!important` rule), because jsdom's UA sheet hides
`[popover]:not(:popover-open)` and `dialog:not([open])`, its `:popover-open` never matches, and
jsdom refuses to focus anything under `display: none`. Escape and light dismiss are not simulable (no close watcher): the
dismiss path is driven by calling `popup.hidePopover()` and asserting the `"dismiss"`
notification. `getAnimations` is absent; the shim returns `[]`, so the deferred-unmount path is a
browser-mode test. The `<dialog>` popup needs nothing from the dialog shim (`showModal` is never
called).

### 13.2 Coverage against conventions 10.1 (jsdom)

"both" = `describe.each` over uncontrolled and controlled wrappers (controlled follows
update-on-success). Library mode unless stated.

| Row | Popover tests |
| --- | --- |
| Roles and ARIA | Default elements `button[type=button][commandfor][command=toggle-popover][aria-expanded=false]`, `dialog[id][popover=auto][role=dialog][aria-modal=false][aria-labelledby][aria-describedby][data-side=bottom][data-align=center]`, `h2[id]`, `p[id]`, `button[command=hide-popover]`; ids resolve; consumer `aria-describedby="x"` becomes `"x <id>"`; consumer `role="region"` wins; `aria-haspopup` passes through; `open` is never rendered; `render={<div />}` keeps `role`, `aria-modal`, `popover`, ids. |
| Keyboard | Enter / Space on the Trigger (user-event clicks) dispatch; Escape is not simulable (13.1). |
| Sync action (both) | Trigger click → `openChangeAction(true, details)`: `details.event` is the native `MouseEvent`, `reason: "activate"`, `defaultPrevented` true (the command was cancelled); click while optimistically open → `openChangeAction(false)` with `"activate"`; disabled Trigger never dispatches; a `beforetoggle` for an open dispatched on the popup by a test (foreign open) is cancelled and dispatches `true` with that event; a `command` event with `hide-popover` records an `"activate"` intent that the following `hidePopover()` + `toggle` consumes. |
| Async action (both) | `deferred()` open: `data-open`, `data-pending` and **no `aria-expanded`** (#121) on the Trigger, `showPopover` spy not called, children not rendered; resolve: `showPopover` called once with `{ source: trigger }`, children rendered, still no `aria-expanded`, attributes settled. Part-initiated close with a `deferred()`: popup still open and `:popover-open` while pending, `data-pending` on the Trigger, no `data-open`; resolve: `hidePopover` called once. Dismissal: `hidePopover()` then flush `toggle` → `openChangeAction(false, { reason: "dismiss" })` with the `toggle` event; Trigger pending meanwhile. The `shown` mirror's phases (`"false"` as soon as the `toggle` task has flushed, before the notification settles, also entangled with a pending unrelated action; `"true"` again with a refused dismissal's re-show `toggle`, #118 review M1) are asserted on a `render={<a href="#" />}` Trigger, the one Popover part that still renders `aria-expanded`, and on the Combobox Input in its own file. |
| Rejection (both) | Open rejects: `ErrorCatcher` receives it, `showPopover` never called, no `data-open`. Part-initiated close rejects: catcher above Root receives it, `hidePopover` never called by the library. Dismissal notification rejects: catcher receives it (component replaced). Controlled refusal of a dismissal → `showPopover` called again once settled; controlled refusal of a part-initiated close → `hidePopover` never called, `data-open` back. Caught-inside variants commit. |
| Overlap | Walkthrough 11.7 with two `deferred()`s resolved out of order: `openChangeAction` called twice, `showPopover` never called, final `aria-expanded="false"`. And 11.8: a `hidePopover()` + `toggle` during a pending part-initiated close dispatches nothing more. |
| Superseded rejection (both) | Older dispatch rejects after and while the newer is pending; `reportError` (stubbed) gets it once, the catcher does not; the popover ends as the newer dispatch left it. |
| Suspending content (both) | Children mount `<Suspender>` on open: `showPopover` not called, Trigger pending, no fallback from the boundary above; resolve: `showPopover` called, content present. `keepMounted`: Suspender mounts hidden inside `<Activity>` at page render. |
| Function props | `className` / `style` / `children` / `render` on every part receive the documented state; JS-free mode passes `open: false`, `pending: false`. |
| `render` element | `render={<div className="x" />}` on Popup keeps the library attributes and listeners; `render={<a href />}` on Trigger in library mode dispatches through the click handler and gets no `type`; a non-button Trigger in JS-free mode warns. |
| Post-await rule | Controlled parent updating after `await` inside `startTransition`, end to end, for an open and for a part-initiated close. |
| Directive | Every file under `src/popover/` except `index.ts` begins with `"use client"`. |
| Platform path | Mount with the popup already `:popover-open` (shim state set before `hydrateRoot`): one dispatch with `reason: "platform"`, `event: undefined`, StrictMode still one; parent accepts → children mount and `showPopover` not called again; parent refuses → `hidePopover` called and no notification. Controlled `open` flipping programmatically calls `showPopover` / `hidePopover` and the resulting `toggle` does not dispatch (echo). JS-free mode: a native-style open (shim `showPopover` + `toggle`) writes `aria-expanded="true"` on the Trigger element, a close writes `"false"`, and no React state changes (render count). |
| Close part | Without `action` in JS-free mode: `command="hide-popover"`, no handler. In library mode: click default-prevented and `openChangeAction(false, "activate")` dispatched; with `action`: `data-pending` on the Close while the deferred action runs, dispatch after resolve, nothing on reject (error in the catcher inside the popup). JS-free mode with `action`: `hidePopover` called directly after resolve. Dismissed and re-opened while the action runs: the stale close is dropped (3.4; the re-open click is entangled with the Close's pending async transition in jsdom and commits with it). |
| Focus | `initialFocus` ref / selector: the element has `autofocus=""` when `showPopover` is called (spy inspects the DOM) and not afterwards; missing target warns. Shim focusing steps: after a library open focus is on the `initialFocus` target, else the first focusable, else the popup. Nested focus return: with focus inside the popup, `hidePopover()` (shim: focus untouched) + `toggle` → the Trigger is focused; with focus on an outside button before the hide → focus untouched; with the Trigger unmounted → `blur()`. Unmounted content (6.2, H1): a Close / Trigger-inside / controlled close activated with focus inside and `transition` set returns focus to the Trigger (jsdom moves focus to `<body>` on removal, as browsers do); with `keepMounted` likewise. |
| Positioning | `side` / `align` matrix produces the `position-area` values and the fallbacks string (shared helper tests; the six-row matrix of conventions 13.1 since wave 11); `side={null}` emits neither style nor `data-side`; consumer `style.positionArea` wins. |
| Resolved placement (wave 11) | As Tooltip 13: requested values in jsdom; with `getComputedStyle` stubbed to a flipped `position-area` and the shim's `toggle(open)`, `data-side` / `data-align` and the function-prop state are the resolved pair (library mode and JS-free mode alike); `toggle(closed)` restores the requested ones; no extra render when the stub returns the requested keywords; `side="inline-end"` renders `self-x-end` inline and `data-side="inline-end"` while closed. |
| Mode guard | Changing Root from JS-free to library mode after mount warns; `transition` / `keepMounted={false}` in JS-free mode warn. |
| `transition` smoke | Popup renders with and without `transition`; with `transition` absent a part-initiated close keeps the children through the close commit (`held`) and unmounts after `toggle` (fake timers); with `transition` set the children are gone in the close commit. |

### 13.3 Browser mode (`popover.browser.test.tsx`, Chromium, Firefox, WebKit)

Only what jsdom cannot observe, branching on `src/__tests__/engine.ts` where engines differ and
asserting the documented degraded behaviour rather than skipping:

| Row | Assertion | Engine branches |
| --- | --- | --- |
| JS-free command path | A real `toggle-popover` click opens and closes the popup; `aria-expanded` on the Trigger follows; `hide-popover` on Close closes. | none |
| Library interception | The Trigger's click goes through the library (`details.event` is a `MouseEvent`); a foreign `<button commandfor command="show-popover">` is cancelled at `beforetoggle` and dispatches with a `ToggleEvent` whose `source` is that button; the popup is anchored below the Trigger (`getBoundingClientRect`: top edge equals the Trigger's bottom edge). | none |
| Escape and light dismiss | Escape closes and `openChangeAction(false, { reason: "dismiss" })` fires; a `user.click` on an outside element closes and focus is on that element; a click on the Trigger while open closes through the library (`"activate"`) and does not reopen. | none |
| Initial focus and return | A raw platform probe (no library) asserts that `showPopover()` on a `<dialog>` moves focus inside, in every engine. With the `<dialog>` default, focus is inside the popup after a library open (`initialFocus` target, else first focusable, else the popup); Escape returns focus to the Trigger. With `render={<div />}`, focus stays on the Trigger and Tab enters the popup. A `Popover.Close` activated from the keyboard with `transition="pop"` (content unmounted in the close commit) returns focus to the Trigger (6.2, H1). | None for focus: WebKit verified (CI run 39006036945). Tab-into-popup is asserted only with a DOM-adjacent Popup (Safari WPT gap). |
| Nested popovers | Opening the inner keeps the outer open; Escape closes the inner only and **the library** focuses the inner Trigger (every engine: the platform restores nothing for a nested popover); an outside click closes both and leaves focus alone; a second Escape closes the outer and the platform focuses the outer Trigger. | None for placement since 6e48fe6 (issue #56): the inner Popup uses an inline `side` with its `flip-inline` fallback on all three engines and the fallback-flip assertion (inner popup near the viewport edge flips to the other side) runs on WebKit too. WebKit 302008 (`position-try-fallbacks` on a nested popover hangs / spins) did not bite on CI; the Menu suite keeps the named WebKit guard row for it, and a hang here fails the row under the test timeout. |
| Exit animation and deferred unmount | With the 10.1 CSS and no `transition`: after a part-initiated close the children stay mounted until `getAnimations()` settle, and after a dismissal likewise; `held` clears. | Firefox has no CSS exit: branch on `popup.getAnimations({ subtree: true }).length === 0` right after the hide and assert the children unmount with the close commit. |
| ViewTransition | With `transition="pop"`: a library open calls `document.startViewTransition` once and the popup is `:popover-open` when the update callback has run; a part-initiated close calls it once and the old snapshot exists (`document.getAnimations()` includes a `::view-transition-old(…)` pseudo during the transition); a dismissal calls it only for the notification commit with the popup already hidden; **`transition="pop"` plus the 10.1 CSS exit: a dismissal calls it once, not twice** (the `held` release is a normal update; fails without the M1 fix in Chromium, Firefox animates no exit). Without `transition`: zero calls for an open and a close. A `Popover.Root` inserted by a transition with `transition="none"` calls it once (conventions 10.1 mount row); a plain open with `"none"` calls it zero times. **`transition="pop"` plus the 10.1 CSS exit, no consumer rule (#147), a part-initiated close**: the popup is `display: none` at `ready`, only the old image of its group exists and no inline `transition` is left (pseudo-element names read from `document.getAnimations()` at `ready`, reported in the failure message); the open has the popup at opacity 1 at `ready`; a dismissal's CSS fade keeps running through an unrelated view transition; a consumer `style={{ transition }}` is cut too and restored; under a CSP that blocks `style` attributes the cut is undone and React's inline style kept (`css-transition-cut.browser.test.tsx`, review H1); a library close in an urgent commit (no view transition) keeps its CSS exit (the gate, review M1). | None for the mechanism: the old-snapshot row passes on all three engines (WebKit on CI). The CSS exit rows assert the same in every engine; WebKit's pseudo-element names are unreliable, so it asserts `display` only (as Dialog 13.3). The unrelated-view-transition row branches on whether the dismissal fades at all (Firefox animates no exit). |
| Stack interactions | A Tooltip (`manual`, and `hint` where `supportsPopoverHint`) opened inside the popup does not close it; a modal Dialog opened from inside keeps it open and Escape closes the Dialog first; opening an unrelated `auto` popover closes it with `"dismiss"`. | `supportsPopoverHint` for the hint variant (Safari 27.0 maps it to `manual`; same assertion). |
| Accessibility | `aria-modal="false"` and `role="dialog"` present on the `<dialog>` (attribute assertions; no AX tree access in vitest browser mode, Chromium's `modal=true` exposure without the attribute is #44). | none |
| Resolved side (wave 11) | A Trigger at the bottom of the viewport with the default `side="bottom"`: once shown, `data-side="top"` and the section 10 gap sits between the popup's bottom edge and the Trigger (`getBoundingClientRect`); a Trigger in the middle: `data-side="bottom"`. Inside a scrollable container, scrolling the Trigger to the container's bottom edge and waiting two frames: `data-side` equals the side the popup box is on (the geometry invariant of conventions 13.2; this row accepts either side and is **not** pinned on the `topLayerAnchorReChoosesOnScroll` probe: Chromium re-chooses in every run of this row, locally and on CI, although the probe says it keeps the option, for a reason not yet found (noted in #92; the row pre-scrolls the container, opens through the library, 160 × 120 popup, bottom overflow); Tooltip's scroll row is the pinned one); Escape then re-open in the middle: `bottom`. JS-free mode (a `popovertarget` click) reports the resolved side the same way. | none (WebKit's computed-style behaviour is from source; this row is one of its first real checks) |
| Direction (wave 11) | `align="start"` under `document.documentElement.dir = "rtl"`: the popup's right edge meets the Trigger's right edge, `data-align="start"`; `side="inline-end"`: the popup sits left of the Trigger with `data-side="left"`. The same inside a `dir="rtl"` wrapper in an LTR document. | Container case: `anchorPositionHonoursParentDirection` true: mirrored; false (Firefox, Mozilla 2019601): the inline edges meet neither Trigger edge, asserted with the bug named. Page case: none. |

---

## 14. Implementation notes

```
packages/ui/src/popover/
  index.ts                 # no directive: namespace + type re-exports; imports platform-attributes for side effects
  popover-context.ts       # "use client": PopoverContext
  popover-root.tsx         # "use client": useOverlayRoot({ details: popoverDetails }) + context
  popover-trigger.tsx      # "use client"
  popover-popup.tsx        # "use client": <dialog popover>, usePopoverPopup, useAnchoredPlacement
  popover-close.tsx        # "use client": useOverlayClose (shared with Dialog.Close), command "hide-popover"
  popover-title.tsx        # "use client"
  popover-description.tsx  # "use client"
  popover.test.tsx
  popover.browser.test.tsx
packages/ui/src/internal/
  anchor-position.ts       # positionArea(side, align), POSITION_TRY_FALLBACKS, parsePositionArea (directive-free)
  use-resolved-placement.ts # "use client": useAnchoredPlacement (14.4; shared with Tooltip and Menu)
  use-overlay-root.ts      # "use client": section 14.1; shared with Menu, Combobox and Dialog
  use-popover-popup.ts     # "use client": section 14.2; shared with Menu and Combobox
  use-popover-trigger.ts   # "use client": section 14.3; shared with Menu and Combobox
  overlay-popup.tsx        # "use client": renderOverlayContent, useCloseHold, useInitialFocusTarget, returnFocusToTrigger, commandOf, useJsFreePropWarnings (14.2; shared with Dialog.Popup)
  content-focus-probe.tsx  # "use client": useContentFocusProbe (6.2)
  use-overlay-close.ts     # "use client": useOverlayClose, the Close part (3.4; shared with Dialog.Close)
  use-exit-animation.ts    # "use client": the `held` logic of 4.4, wrapped by useCloseHold
  popover-open.ts          # isPopoverOpen(element) (directive-free)
packages/ui/src/__tests__/popover-shim.ts   # additions, 13.1
```

- **Every part file is `"use client"`** (context for ids, mode and dispatch), as Dialog and
  Tooltip. `index.ts` is directive-free. Add `src/popover/index.ts` to the tsdown `entry` list.
- **Context** (`PopoverContextValue` = `PopoverRootValue` = `OverlayRootValue<HTMLElement, []>`):
  `{ mode, ids: { popup, title,
  description }, committed, optimistic, pending, intended(), openGeneration(),
  nextOpenGeneration(), requestOpen(event, reason), requestClose(event, reason),
  notifyClosed(event, reason), latestInFlight, triggerRef, popupRef, recordCloseIntent,
  takeCloseIntent }`, memoised by the hook on its members (Dialog's context extends it with the
  `<dialog>` element type and a close's `returnValue`). The
  Popup's state (`{ open: committed, side, align }`) is **not** on the Root context: the Popup
  publishes it through a second context (`PopoverPopupContext`) that Title and Description read;
  outside a Popup (which `aria-labelledby` allows) they fall back to `{ open: committed, side:
  "bottom", align: "center" }`. Better than Root carrying `side` / `align` it does not own
  (review, deviation 2).

### 14.1 `useOverlayRoot<Details, Popup, CloseArgs>(options)` (shared)

The Root's logic without the public props, for Popover, Menu, Combobox and Dialog
(`internal/use-overlay-root.ts`). `options`: `{ component, part, open, defaultOpen,
openChangeAction, mode?: "library", onDispatch?, details, isShown? }`; the type parameters are the
details type, the popup element type (`HTMLDialogElement` for Dialog) and the extra arguments of
a close (Dialog's `[returnValue: string]`), which reach the `details` builder. Inside: mode
detection once (`useState` initialiser; warn on change), `useControllableAction<boolean,
Details>` with `transitionTypes(component, next ? "open" : "close")` where `component` is
`"popover"`, `"menu"`, `"combobox"` or `"dialog"`, `useId`, `triggerRef`, `popupRef`, the
close-intent ref with `clearLater` (which asks `isShown(popup)`, default `:popover-open`, whether
the popup is still open a task later; Dialog passes `dialog.open`), and:

- `intended()` = `latestInFlight()?.next ?? committedOptimistic` (a boolean, so `??` is safe
  here), where `committedOptimistic` is a ref of the optimistic value of the **last commit**,
  not the render closure: a Close action's continuation runs after an `await` with the closure
  of the click's render and could otherwise dispatch a second `false` after a dismissal had
  settled. The ref is written in **`useInsertionEffect`** (mutation phase), so it is current for
  every layout effect of the same commit, a child's included (review L2; a Root layout effect
  would run after the children's). Valid from handlers and effects, not during render.
- `openGeneration()` / `nextOpenGeneration()`: a counter bumped by every `send(true)` and by the
  Popup's `beforetoggle(open)` (foreign and pre-hydration opens included). A part whose close
  runs after an `await` records it first and drops the close when it changed (3.4).
- `requestOpen(event, reason)`: library mode and `!intended()` → `dispatch(true, details)`.
- `requestClose(event, reason)`: library mode and `intended()` → `dispatch(false, details)`.
  This is the library-driven close Menu's item activation calls after the item's action.
- `notifyClosed(event, reason)`: library mode and `intended()` → `dispatch(false, details)`
  (same guard as `requestClose`; separate name because callers mean different things and Menu
  may add bookkeeping to one of them).
- `details(event, reason, ...closeArgs)` is a **required** builder: the popover-like components
  pass the exported `popoverDetails` (`createActionDetails(event, { reason })`); Dialog's adds
  `returnValue`. A builder must call `createActionDetails` (its Proxy keeps `event`
  non-enumerable so the details survive a Server Function boundary; a plain object literal
  breaks that). Requiring it keeps the hook free of a cast from a generic default.
- Returns `OverlayRootValue<Popup, CloseArgs>`; `PopoverRootValue` is its `<HTMLElement, []>`
  alias, the first argument of `usePopoverTrigger` and `usePopoverPopup`.
- `shown` / `setShown(next)` (#118): an urgent `useState(false)` mirror of the popup being in the
  top layer, written by the Popup from `:popover-open` (14.2) and read by `usePopoverTrigger` (for a
  non-button `render` only, #121) and the Combobox Input for `aria-expanded`. Never set inside a transition (that is the point: a
  pending notification or an entangled action must not delay it); `false` on the server and at
  hydration; a set to the current value is a no-op. Dialog does not maintain it (its Trigger has
  no `aria-expanded`). Not exposed in any `state` object.
- Menu's extension points (menu.md 14, landed with #40): `mode: "library"` forces library mode
  whatever the props, and `onDispatch(next, details)` runs synchronously before every dispatch
  (open-cause record, hover-timer cancellation).

### 14.2 `usePopoverPopup(ctx, options)` (shared)

Everything in the Popup except rendering. `options`: `{ part, initialFocus?, resolveInitialFocus?,
keepMounted?, transition, whileShown?, source? }` (the optional hooks are for Menu and Combobox:
`resolveInitialFocus(popup)` replaces `initialFocus` with a function called right before each
library open, no `cause` argument since the open cause is Menu's own ref; it returns an element,
`null`, or a `QuietFocusTarget` `{ element, focusVisible: false }` that is focused with
`focus({ focusVisible: false })` after `showPopover()` where the option is implemented (6.1);
`whileShown(popup)` installs listeners that live while the popup is shown and returns their
cleanup: called at the `toggle` that finds the popup shown, and reinstalled when the ref attaches to
a shown popup (a ref re-run, an inline consumer `ref`), cleaned up at the closing `toggle` and
when the element detaches (Menu: the outside listeners and the foreign-invoker press guard;
Combobox: the guard; #129, replacing the `onToggle` / `onBeforeToggle` callbacks). The
`focusVisible` probe behind `QuietFocusTarget` lives in `internal/focus-visible.ts` (#129); event
sources and invoker relationships (`eventSource`, `closedByPopoverTarget`, `isPopoverInvoker`,
`listenInvokerPresses`) in `internal/invokers.ts`). Returns `{ setElement (callback ref), visible,
renderContent, reshow }`; nothing with a ref inside the returned object (React Compiler's ref inference would flag every member once one
is passed as `ref`; consumers destructure). Effects and listeners:

1. **Mount reconciliation** (layout effect, once): `:popover-open` and library mode →
   `requestOpen(undefined, "platform")`. JS-free mode: write `aria-expanded` on the Trigger from
   `:popover-open`.
2. **Apply effect** (layout effect, every commit; section 2.5), with `opening` and
   `awaitingClose` refs; `showPopover({ source })` wrapped in the `autofocus` write / removal;
   the focus return right after `hidePopover()` when `focusWasInside` (6.2); the `held` release
   rule (4.4); `contentHadFocus` cleared when the popup is committed open and shown.
3. **Native listeners**, attached in the callback ref (`setElement`; the cleanup removes them),
   so they exist from the commit that mounts the element: no passive-effect window in which a
   close's `beforetoggle` could be missed, and no extra render through element state (review
   L5). The listeners call the latest render's handlers through a `handlers` ref published in a
   `useInsertionEffect` (calling `useEffectEvent` functions from a ref callback is a
   rules-of-hooks error). Each filtered on `event.target === popup` because React 19.3.1 emulates
   `toggle` bubbling:
   - `beforetoggle`: `newState === "open"` in library mode and not `opening` →
     `preventDefault()` + `requestOpen(event, "activate")`; otherwise (the library's own open,
     or any open in JS-free mode) → `nextOpenGeneration()`. Either way `contentHadFocus` is
     cleared. `newState === "closed"` → `awaitingClose = true`, `focusWasInside =
     popup.contains(activeElement) || contentHadFocus`, then `contentHadFocus = false`.
   - `toggle`: `awaitingClose = false`; library: `ctx.setShown(isPopoverOpen(popup))` (#118);
     JS-free: write `data-open` on the Trigger from `:popover-open` (#121); closed → focus fallback (6.2), then library mode → the `getAnimations`
     read of 4.4 (sets `held` for a dismissal's CSS exit; for a library-driven close `held` is
     already set by the render, and this read decides when to clear it), then
     `notifyClosed(intent?.event ?? event, intent?.reason ?? "dismiss")`.
   - `command`: `hide-popover`, or `toggle-popover` while open → `recordCloseIntent({ reason:
     "activate", event })`; `show-popover` / `toggle-popover` while closed need nothing (the
     open is caught at `beforetoggle`).
   - `interest` / `loseinterest` (library mode, #127): `interest` remembers the popup's interest
     invoker; the routed open sets `interestOpen` when its `source` is that invoker;
     `loseinterest` hides a shown interest-opened popup in a task (`"dismiss"` intent with the
     `InterestEvent`) or cancels a pending one with `requestClose(event, "dismiss")`.
4. **`held`** (4.4, `useCloseHold(committed, isLibrary, transition)` in `overlay-popup.tsx`,
   over `use-exit-animation.ts`'s `{ held, holdUntil, release, holdDuringRender, waiting }`,
   plus `afterClose(popup, echo)` for the `toggle(closed)` read and `releaseIfIdle` for the apply
   effect's release rule; shared with Dialog.Popup): the previous-committed derivation during render when `transition === undefined`;
   the `getAnimations` read in `toggle(closed)`; `allSettled(...).then(() => setHeld(false))` as
   a normal update with a generation counter; `release()` from `toggle(closed)` with no
   animations and from the apply effect's release rule.
5. **`renderContent(() => children)`** (6.2, H1): `renderOverlayContent({ isLibrary, keepMounted,
   visible, wrapContent }, children)` (`overlay-popup.tsx`): static mode renders the children;
   library mode renders them while `visible`, or inside an `<Activity>` with `keepMounted`,
   through `wrapContent` from `useContentFocusProbe(popupRef)` (`content-focus-probe.tsx`), a
   component whose layout-effect cleanup sets `contentHadFocus` when
   `popup.contains(activeElement)`; all under `<ToolbarContext value={null}>`. The thunk is
   called only when something renders.
6. **`initialFocus`**: `useInitialFocusTarget(part, noun)` resolves the ref or selector inside
   the popup and warns once when it does not resolve or lies outside; `resolveInitialFocus`,
   `returnFocusToTrigger(popup, trigger, canFocus?)` (the 6.2 focus return) and
   `commandOf(event)` (the `command` listener) are the other `overlay-popup.tsx` helpers
   Dialog.Popup shares. JS-free: the callback ref writes `autofocus` on the resolved target and
   keeps it while mounted (the browser runs the command; there is no "right before
   `showPopover()`"), as Dialog. The Trigger's callback ref also syncs `data-open` for a
   Trigger that mounts after the Popup (#121). Library mode (#118): the Popup's callback ref sets
   `shown` from `:popover-open` on attach (a pre-hydration open is `true` at once, before the
   `"platform"` dispatch) and `false` on detach (a popup removed while open fires no `toggle`);
   both are no-ops when the value is unchanged, so the common mount costs no render.
7. **Dev warnings** (section 9): `useJsFreePropWarnings` (`transition` / `keepMounted` in JS-free
   mode), `useElementCheck` and `useShownNameWarning`, once per instance (conventions 7.2).
   One Trigger per Root (#113 API3): the Root's `triggerRef` holds one element (last mounted
   wins), so `internal/trigger-ref.ts` `registerTrigger` warns once per Root when a second
   Trigger mounts while one is registered. Shared by `usePopoverTrigger` (Popover, Menu,
   submenus), `Dialog.Trigger` and `Combobox.Input`.

### 14.3 `usePopoverTrigger(ctx, { part, disabled, render, handlers?, activate?, beforeOpen?, disabledAs? })` (shared)

Returns `{ state, libraryProps, ref }`: `type` via `rendersButton`, `popoverTarget` (the Popup's
id, on a `<button>` or component render only; the typed camelCase prop, #121), `disabled` (owned, through `disabledButton(render, disabled, { handlesClick:
isLibrary, alwaysFocusable: disabledAs === "aria" })`, conventions 1.2: native on a host button
or for a JS-free activation, else `aria-disabled` with `popoverTarget` withheld), `aria-expanded` only when no `popoverTarget` is rendered (library: `ctx.shown`, #118; JS-free:
`false`), `onClick` only in library mode (`preventDefault()`; `disabled` → return;
`dispatch(!intended())` through `requestOpen` / `requestClose`), `data-open`, `data-pending`,
`data-disabled`; the callback ref writes `triggerRef` and warns for a non-button in JS-free mode.
Menu adds `aria-haspopup="menu"` and its own `onKeyDown` (ArrowDown / ArrowUp open with the
first / last item focused) on top. `activate` replaces the default toggle (SubmenuTrigger: open
or move focus in, never close); `beforeOpen` runs right before the default toggle's `requestOpen`
(Menu.Trigger records the open cause there and keeps the default toggle, #129). The module also
exports `RESERVED_INVOKER_KEYS` (`popoverTargetAction`, `commandfor`, `command` as owned
`undefined`) and `nonInvokerMessage(part, tag, popover, popup)`, the library-mode non-button
warning, which `Combobox.Trigger` reuses (#129).

### 14.4 Rendering (Popup)

```tsx
const element = useRender<ComponentPropsWithRef<"dialog">, PopoverPopupState>({
  defaultElement: "dialog",
  render, state, className,
  style: placement.style(style),           // useAnchoredPlacement({ side, align }): inline position-area / position-try-fallbacks under the consumer's style; the consumer's alone for side null
  children: content,                       // <PopoverPopupContext value={state}>{renderContent(() => children)}</PopoverPopupContext>: static → children; keepMounted → <Activity>; default → visible ? children : null (14.2 item 5)
  props: { role: "dialog", ...rest },      // `role` is a default the consumer's `rest` overrides
  libraryProps: { id, popover: "auto", open: undefined, "aria-modal": "false", "aria-labelledby": ids.title, "aria-describedby": ids.description, ...placement.dataAttributes },  // data-side / data-align, resolved (conventions 13.2); no keys for side null
  ref: useMergedRefs(setElement, placement.ref),       // the element and name checks run inside the hook
});
return useTransitionBoundary("Popover.Popup", isLibrary ? transition : undefined, element);
```

`popover="auto"` is typed in `@types/react`; `command="hide-popover"` / `"toggle-popover"` are in
`platform-attributes.ts` already. `aria-modal` on a `<dialog>` is typed. No new augmentation.

### 14.5 Implementation checks (example app, three engines)

Done on the first WebKit CI run (39006036945): `<dialog popover>` initial focus in WebKit (6.1,
verified, contingency closed) and the view-transition capture of a library-driven close in WebKit
(10.2, the old-snapshot row passes). Still open: that `showPopover({ source })` with a `<div>` or
`<a>` source anchors and nests in every engine; that `aria-modal="false"` makes Chromium expose
the popup as non-modal (CDP, manual); screen-reader pass (NVDA, JAWS, VoiceOver) for the
`<dialog>` popup and the `<div>` variant.

---

## Review corrections (2026-10-17)

From `memo/reviewer/popover.md` (review of the implementation, #40) and the developer's fix
notes in `memo/developer/popover.md`; code in commit 35e57e1, docs in a55c86c and 2225079. Each
item is folded into the section named; this list is the audit trail.

| Item | Correction | Section |
| --- | --- | --- |
| H1 | Focus-return rule 1 also counts focus that was inside the content when the close commit unmounted it, recorded by the content probe's layout cleanup (`useContentFocusProbe`); the apply effect returns focus right after `hidePopover()`. Required for every library-driven close with `transition` and the default mounting, Menu's item activation included. | 6.2, 2.5, 11.3, 14.2, 14.4, 15 |
| M1 | `held` → `false` is a normal update, never a transition: one document view transition per dismissal with `transition` plus a CSS exit. | 4.4, 10.2, 11.2, 11.4, 14.2 |
| L1 | WebKit runs the dialog focusing steps for `<dialog popover>`; the 6.1 contingency is closed and the up-front fallback removed. The jsdom shim emulates the focusing steps and shows every open popover. | 6.1, 13.1, 13.3, 14.5, decision 1 |
| L2 | `intended()` reads the last commit's optimistic value from a ref written in `useInsertionEffect`, current for every layout effect of the commit. | 14.1 |
| L3 | A `Popover.Close` action's close is dropped when the popover was dismissed and re-opened meanwhile (open-generation guard; product-owner decision). `openGeneration` / `nextOpenGeneration` on the Root value. | 3.4, 11.5, 13.2, 14.1, 14.2 |
| L4 | The Popup hook returns no ref-bearing member (`focusWasInside` dropped); consumers destructure. | 14.2 |
| L5 | Native listeners attach in the callback ref through a handlers ref published in an insertion effect; no element state, no passive-effect window. | 14.2 |
| L6 | `defaultOpen` renders the content and the Trigger's `data-open` into the server HTML; only the showing waits for hydration (since #121 the Trigger renders no `aria-expanded`; the browser exposes collapsed until the popup is shown). | 2.4, 2.5, 3.1 |
| L7 | `initialFocus` recommended over `autoFocus` in JS-free mode: React writes `autofocus` into server-rendered HTML only. | 2.1, 6.1, 12.1 |
| Deviation 2 | Title / Description state comes from a Popup context, not from `side` / `align` on the Root context. | 14 |
| Deviation 4 | The apply-effect release rule for `held`. | 4.4, 2.5 |
| Deviation 7 | The no-name warning checks `dialog`, `alertdialog` and `menu` roles only. | 9 |
| Deviation 8 | `resolveInitialFocus(popup)` takes no `cause`; Menu's `details` factory uses `createActionDetails`. | 14.1, 14.2, 15, menu.md 14 |
| M2 | `Popover.Close` dropped a superseded rejection (`useTransition` keeps the newest thenable). Closed by the shared `useActionTrigger` (ac7064e, #41; conventions 3.4), which also carries the open-generation guard; one jsdom row fails without it. | 3.4 (closed 2026-10-17) |

From the Dialog #46 review (`memo/reviewer/dialog-46.md` M2, 2026-10-18; code, docs and the
browser row in 5dcce5f, the WebKit correction in bcdb7e1):

| Item | Correction | Section |
| --- | --- | --- |
| Dialog #46 M2 | With `transition` plus the 10.1 CSS exit, Chromium captures a library-closed popup, still rendered through its fade, as a live `::view-transition-new` next to the `old` image (a double image; probed with the docs recipe). The recipe keeps the CSS exit and adds `html:active-view-transition .popover { transition: none; }` (untyped: a controlled close carries no types; cost: an unrelated page view transition also cuts a fade). Replaces "at most a CSS exit for dismissals"; the dismissal row's "nothing visible to animate" was wrong for a CSS exit. Chromium only: Firefox has no CSS exit, WebKit has the box `display: none` by `ready`. Docs `popover.css` / PopoverPage and the playground carry the rule. | 10.2, 13.3 |

---

## Decisions recorded (product owner, 2026-10-17)

All eight accepted as recommended:

1. **`<dialog popover>` as the default element, focus moving in** (decision 4, section 6.1),
   with `render={<div />}` as the disclosure-style variant that keeps focus on the trigger.
   Alternative: `<div popover role="dialog">` everywhere with a JS "first focusable" choice,
   which avoids the Chromium AX bug and the WebKit unknown at the cost of the research verdict
   and a small focus algorithm in JS. Decision: `<dialog>`, with the WebKit contingency as an
   implementation check (closed at review: WebKit runs the focusing steps; no fallback, 6.1).
2. **Part-initiated closes are library-owned** (decision 3): Trigger toggle and Close await
   `openChangeAction(false)` and hide in the commit, so `<ViewTransition>` can animate the exit
   and a controlled parent can veto them; dismissals stay browser-owned notifications. This
   differs from Dialog's "close is always browser-owned" and is what Menu builds on. Decision:
   accepted; the Dialog follow-up is issue #46.
3. **JS-free mode keeps `aria-expanded` current with a DOM write** from the popup's `toggle`
   listener (section 9), the first owned attribute the library writes outside React.
   Alternative: a React state write per toggle in Root (one render per open and close), which
   Tooltip rejected for hover but is cheap for a click-driven popover; or no `aria-expanded` in
   JS-free mode (Chromium's implicit mapping only). Decision: the DOM write (conventions 7.4).
4. **No `Popover.Form` and no `lightDismiss` in v0** (section 1). Decision: accepted; the
   controlled "submit, then close" shape is documented (12.4).
5. **`role` is an overridable default, not an owned key** (3.3), so a `<div>` popup can be a
   `region` or `group`. Decision: accepted.
6. **Nested focus-return rule** (6.2): the library focuses the Trigger only when focus was inside
   the popup at the hide and the platform left it on `<body>` or inside. Decision: accepted;
   Menu's submenus depend on it.
7. **Default placement `bottom` / `center`** (section 8) versus Tooltip's `top`. Decision:
   accepted.
8. **Trigger-less controlled popovers have no anchor** (2.7; `anchor` prop deferred). Decision:
   accepted for v0.

---

## Amendment: resolved side and direction (wave 11, 2026-10-23, issues #20 and #53)

Status: **accepted** (product owner, 2026-10-23, with Tooltip's amendment: same name for the
resolved value, inline-relative `align` and the new sides, Firefox 2019601 unworked-around and
tracked as #89); the cross-component rules are conventions 13 and the reasoning is in
Tooltip's amendment (same mechanism, same hook). Edited in place: decision 10, 3.3, 4, 8, 10,
13.2, 13.3.

| | v0 (as accepted) | Wave 11 |
| --- | --- | --- |
| `data-side` / `data-align`, `state.side` / `state.align` | the requested props | the resolved placement while shown (both modes), the requested props otherwise |
| Section 10 gap after a flip | on the wrong side | on the side facing the Trigger |
| `side` values | four physical | plus `inline-start` / `inline-end` |
| `align` `start` / `end` on `top` / `bottom` | physical | inline-relative (identical in LTR, mirrored in RTL); container `dir="rtl"` followed in Chromium and WebKit, Firefox misplaced (Mozilla 2019601, asserted) |
| Files | | `usePopoverPopup` is unchanged; `Popover.Popup` merges `useResolvedPlacement`'s `ref` with `setElement` |

Migration: as conventions 13.5. `PopoverSide` widens by two members; a stylesheet that keyed
the gap on `data-side` now follows flips. The Popover docs page's props and data-attribute
tables and `popover.css` ("the gap on the requested side") change wording.

Questions for the product owner: Tooltip's amendment questions 3 to 5 cover Popover (same name
for the resolved value; inline-relative `align` and the two new `side` values; Firefox
unworked-around). Nothing Popover-specific.

Implementation deviations of Part A (d3d0359) folded on 2026-10-23: the section 10 gap recipe
is symmetric (`margin-block` / `margin-inline`: a flip swaps the popup's own margins) and the
scroll row asserts the geometry invariant rather than a flip; the list is in Tooltip's
amendment ("Implementation deviations folded") and conventions 13.2.

## Amendment: a non-button Trigger's close while open is a light dismiss (#115, 2026-10-24)

Status: architect decision; no API change. Edited in place: section 1's element constraints,
2.7, the `render` doc comment in 3.2. Menu shares the rule (menu.md's element constraints) and
conventions 3.5 records it next to the #110 / #112 traps.

Finding (#110 review F1): `usePopoverTrigger` renders `commandfor` only on a button
(`disabledProps.invoker`), and the platform's light dismiss exempts only invoker buttons, so a
Trigger rendered as `<a>` or `<span>` is light-dismissed at `pointerup`, before its click, in
Chromium and Firefox (and WebKit, by the same algorithm). The close is browser-shaped: not
awaited, no veto, no view-transition exit. The direction of the click's dispatch is right.

Decision: the library-owned close is guaranteed for a `<button>` Trigger; a non-button Trigger
keeps the browser-shaped close and is warned about in development. Options rejected: a
`pointerdown` snapshot (fixes nothing here: the direction is already right and the close cannot
be made library-owned without an invoker); re-showing the popup after the dismissal to then
close it through the action (a visible blink to recover a guarantee the consumer gave up by
choosing the element); wrapping the rendered element in a `<button>` (changes the consumer's
markup; a button inside a link or a link inside a button is invalid HTML either way).

Implementation (developer), `packages/ui/src/internal/use-popover-trigger.ts`: the
`useElementCheck` message gains a library-mode branch, roughly: `${part}: rendered a <x>. Only a
<button> is the popover's invoker: a press on this element while the popup is open closes it
through light dismiss before the click, so openChangeAction(false) is not awaited and cannot
veto. Render a <button>.` (JS-free text unchanged.) No behaviour change. Doc comments on
`Popover.Trigger` / `Menu.Trigger` `render` say so; docs pages: the Menu page's "on every
browser" sentence already qualifies "a `<button>` Trigger" (#115); the Popover page's Trigger
row gets the same qualification. Tests: jsdom, the existing "non-button Trigger warns" row runs
in library mode too and asserts the new text; browser (Chromium / Firefox / WebKit, unbranched):
a `render={<a href="#" />}` Trigger with an async `openChangeAction`, real mouse: popup hidden at
`pointerup` + 20 ms, one dispatch `(false, "activate")` with the `click`, documenting the
degraded shape, next to #110's `<button>` row that asserts the awaited one.

Review follow-ups (#115 review, PO decisions, 2026-10-24): F3, the shared hook's library-mode
warning has a SubmenuTrigger text (keyed on `activate !== undefined`: since #129 Menu.Trigger
passes `beforeOpen` and keeps the default toggle, so only SubmenuTrigger passes `activate`; the
interim `opensOnly` option is gone): a press on a non-button SubmenuTrigger while its submenu is open
dismisses the submenu instead of moving focus into it (menu.md element constraints). F4, the
overlay Triggers and Close parts render `commandfor` / `command` only on a `<button>` or a
component render (`invoker && rendersButton(render)` at each call site; `disabledButton().invoker`
is unchanged, since Close derives its `aria-disabled` from it). Menu's press-drag gesture finds
a SubmenuTrigger's submenu through its hover registration instead of `commandfor`.

## Amendment: `aria-expanded` renders the shown state (#118, 2026-10-24)

Status: architect decision; no API change, no new prop, no new public state field. **Revised the
same day after the review's M1 (see "Revision" at the end of this amendment): the attribute
renders the Root's `shown` mirror of the popup's `toggle`, not `committed`. The grounds below
stand; the table's "after" column, the "Known gap" paragraph, the A' rejection and the
implementation list are superseded there.** Edited in place:
decisions 7 and 12, the anatomy table (1), 2.1 (the invoker sentence and the mode table), the
pending-open table in 2.2, 3.2's owned keys, 3.4's entanglement note, the ownership table in 4,
9's ARIA table, 10's lane table and CSS example, walkthroughs 11.1, 11.3 and the platform-path
one, 13.2, 14.3, conventions feedback 3. Menu and Combobox carry the same amendment. The
cross-component rule is conventions 3.2 ("an ARIA state attribute describes what the user agent
shows"), the `open` row of 4.1 and decision 40.

Finding (#112 review F2, verified in `docs/research/invoker-aria-expanded.md`, Chromium 156 and
Firefox 157 measured, WebKit from source): on a `<button commandfor command="toggle-popover">`,
Chromium and WebKit expose the popover's own state and never read an explicit `aria-expanded`
(`AXNodeObject::IsExpanded`, `AccessibilityObject::isExpanded` return early with
`popoverOpen()`); Firefox maps no expanded state for `commandfor` at all and exposes the
attribute. HTML-AAM maps both invoker kinds to an implicit `aria-expanded`, and ARIA in HTML
(w3c/html-aria#514, open, "meets 2 implementations") makes the attribute an author MUST NOT on
these buttons, after which Core-AAM 3.2 has user agents ignore it. So the "explicit attribute
overrides the implicit state" claim this document made in 2.1 and 9 was wrong, and the
optimistic value reached assistive technology in one engine out of three: during a pending close
Chromium and WebKit said "expanded" (the popup is still shown) while the DOM and Firefox said
"collapsed", and during a pending open the reverse.

Decision: in library mode, `Popover.Trigger`'s `aria-expanded` renders the **committed** open
state, which is the state the Popup shows (2.2: the Popup's visibility follows `committed`).
`data-open`, `state.open` on the Trigger and Root `children(state).open` stay optimistic;
`data-pending` is unchanged; JS-free mode is unchanged (the DOM write from `toggle` already
reports the shown state). The same rule applies to `Menu.Trigger`, `Menu.SubmenuTrigger`,
`Combobox.Trigger` and, for consistency inside the one widget, `Combobox.Input`, which is no
invoker but describes the same listbox as the Trigger and should not contradict it.
`Dialog.Trigger` renders no `aria-expanded` and `Select` has no popover, so nothing changes
there.

Why the shown state, and not "accept the split": the three engines must agree, and the value
two of them compute is the shown state, so that is the only value the attribute can carry and
be true everywhere. It is also what the attribute means (APG: "whether the controlled element
is displayed") and it matches the library's own rule that trigger ARIA is optimistic only where
the optimistic value is what the user sees (a pressed toggle, a checked menu item); a popup
shown from committed state is the other case, next to `<summary>`. The pending phases keep
their feedback: `data-open` flips at the click, `data-pending` marks the wait, and the popup
itself is the truth AT already hears in two engines.

| Phase | DOM `aria-expanded` before | after | Chromium / WebKit expose | Firefox exposes (after) |
| --- | --- | --- | --- | --- |
| closed | `"false"` | `"false"` | collapsed | collapsed |
| pending open (popup hidden) | `"true"` | `"false"` | collapsed | collapsed |
| open | `"true"` | `"true"` | expanded | expanded |
| pending part-initiated close (popup shown) | `"false"` | `"true"` | expanded | expanded |
| pending dismissal notification (popup hidden) | `"false"`* | `"true"` until the commit | collapsed | **expanded, stale** |

\* before, the optimistic value had already been flipped by the dismissal dispatch.

Known gap, Firefox only (last row): after a browser-owned dismissal (Escape, light dismiss,
script) the popup is hidden at once but `committed` flips only when `openChangeAction(false,
{ reason: "dismiss" })` settles, so Firefox exposes a stale "expanded" for that window (one
transition for a sync notification; the action's duration for an async one). Chromium and WebKit
are right throughout, since they do not read the attribute. Accepted: the window is bounded, it
is the engine with no `commandfor` mapping (upstream report 1 in the research), and the
spec-aligned end state (below) removes the attribute altogether.

Rejected:

- **B, drop `commandfor` in library mode** so the attribute wins everywhere: #112 depends on the
  invoker relationship for the light-dismiss exemption, Menu for the implicit anchor and the
  pre-hydration open.
- **C, keep the optimistic attribute and document the split**: inconsistent across engines
  today, non-conforming once #514 lands.
- **A', also DOM-write `aria-expanded` from the library-mode `toggle` listener** (the JS-free
  mechanism in both modes), which would close the Firefox dismissal window: a second writer for
  an attribute React renders, in exchange for a Firefox-only window on an attribute that is on
  its way to being ignored by every engine. Not worth the mechanism; revisit only if a
  screen-reader pass shows the window matters.
- **E, switch the Triggers to `popovertarget` and render no `aria-expanded`**: all three
  engines map `popovertarget` natively, the markup conforms to #514, and a static Trigger would
  need no attribute kept current (conventions 7.3's blocker for a directive-free Popover). It
  is the right end state but a cross-component change with its own trade-offs (the `command`
  event, conventions 7.4's typing, the light-dismiss exemption #112 relies on, the implicit
  anchor, `Popover.Close`, the loss of a jsdom-observable state), so it is **not decided here**;
  it has its own issue, opened from #118.

Implementation (developer; #112 and #115 / #116, which touched the same files, are on master,
so this can start at once):

- `packages/ui/src/internal/use-popover-trigger.ts`: `"aria-expanded": isLibrary ? ctx.committed
  : false` (was `state.open`); the comment above it says "committed: the shown popup (#118);
  `data-open` is the optimistic one". `PopoverTriggerHookState.open` stays optimistic. The hook's
  doc comment and `popover-trigger.tsx`'s ("the button shows optimistic `data-open` /
  `aria-expanded`") drop `aria-expanded` from the optimistic list.
- `packages/ui/src/combobox/combobox-trigger.tsx` and `combobox-input.tsx`: `"aria-expanded":
  popover.committed` (both were `popover.optimistic`); `data-open` and `state.open` unchanged.
- `menu-trigger.tsx`, `menu-submenu-trigger.tsx`: no code change (they go through the hook);
  their doc comments, if they list `aria-expanded` as optimistic, are corrected.
- Nothing changes in `use-popover-popup.ts` (the JS-free write stays) or in any Root.

Tests (jsdom has no accessibility tree: assert the DOM attribute; the attribute is what Firefox
exposes, and the Chromium row below shows the attribute and the platform state agree):

- `src/__tests__/overlay-open-state-suite.tsx`: `expectExpanded` now takes the committed
  value. Pending open (the "async action" open row): `expectExpanded(false)` with `data-open`
  present; pending part-initiated close: `expectExpanded(true)` with no `data-open`; the
  out-of-order overlap row: `false` while pending (nothing was ever shown), `false` after;
  settled rows unchanged. Rename the helper's doc to say "the shown state (#118)".
- `popover.test.tsx`: a row "aria-expanded is the committed state: `defaultOpen` renders
  `"true"` in `renderToString` and on the client; a deferred open shows `data-open` with
  `aria-expanded="false"`; a deferred part close shows no `data-open` with
  `aria-expanded="true"`; a refused controlled close keeps `"true"` throughout". JS-free rows
  unchanged.
- `menu.test.tsx`: the Suspense open row (currently `"true"` while pending) becomes `"false"`;
  the #110 Trigger-close row (currently `"false"` while pending) becomes `"true"`; a
  SubmenuTrigger pending-open row if one exists. `menu.browser.test.tsx` `expectPendingClose`:
  `"true"`.
- `combobox.test.tsx`: the controlled refused Trigger close (`"false"` while pending → `"true"`,
  stays `"true"` after); the pending open on the input (`"true"` → `"false"`, flips to `"true"`
  after the commit); the refused controlled open row is unchanged (`"false"`).
  `combobox.browser.test.tsx`'s #112 Trigger-close row: `"true"` at `pointerup` + 20 ms.
- Chromium accessibility row (optional, `popover.browser.test.tsx`, `server.browser ===
  "chromium"` branch; the other engines run the DOM assertions only): with
  `getAXNodes()` from `src/__tests__/ax-tree.ts`, find the Trigger's node by name and assert
  `axProperty(node, "expanded")` is `false` during a deferred open and `true` during a deferred
  part close, the same values as the attribute. This is the regression guard for the finding
  itself (the attribute and the AX state no longer disagree).
- Screen-reader pass before the next release notes mention it (NVDA + Firefox, NVDA or JAWS +
  Chrome, VoiceOver + Safari): a Trigger close announces "collapsed" when the popup hides, not at
  the click.

Docs pages (`packages/docs/src/pages`): `PopoverPage.tsx` (the "Trigger `aria-expanded`" state
row, the `defaultOpen` row is still right, the ARIA table row "Open state, both modes
(optimistic in library mode)" → "the shown popup; `data-open` is the optimistic one", the
pending-and-optimistic paragraph and the example sentence that pairs `aria-expanded="true"` with
`data-pending`); `MenuPage.tsx` (the entanglement sentence, the "optimistic" list in the
pending section, the Trigger data-attribute row); `ComboboxPage.tsx` (the pending sentence and
the `data-open` row's "(`aria-expanded`)" aside). The concept page on pending and optimistic
state gains one sentence: ARIA state follows what is shown, so an overlay Trigger's
`aria-expanded` is committed while its `data-open` is optimistic.

### Revision: `aria-expanded` renders `shown`, not `committed` (review M1, 2026-10-24)

Finding (`memo/reviewer/issue-118-review.md` M1, probed on Chromium and Firefox): `committed`
is right for the invoker Triggers in Chromium and WebKit only because those engines ignore the
attribute. Every element whose attribute *is* read, `Combobox.Input` (`role="combobox"`, no
invoker) in every engine, a non-button Trigger render (no `commandfor` since #115) in every
engine, and every Trigger in Firefox, reported "expanded" over a hidden popup after Escape or a
light dismiss until `openChangeAction(false, { reason: "dismiss" })` settled, and conventions 2.3
item 5 makes that window as long as any action the notification is entangled with (a slow save
while the user presses Escape). For the Input this was a regression from the optimistic value
(`"false"` at once), on the focused element, which is exactly what AT reads after Escape.

Decision: the attribute renders **`shown`**, a new urgent `useState(false)` in `useOverlayRoot`
(14.1) that mirrors whether the popup is in the top layer. The Popup writes it from the DOM in
three places (14.2): `toggle` → `setShown(isPopoverOpen(popup))` (read from `:popover-open`, not
`newState`, as the JS-free write does); the callback ref's attach → the same read, so a
pre-hydration open is `true` at once; the ref's detach → `false` (a popup removed while open
fires no `toggle`). `usePopoverTrigger` renders `isLibrary ? ctx.shown : false`; the Combobox
Input and Trigger render `popover.shown`. JS-free mode is unchanged (the DOM write; no React state
in that mode, 13.2's render-count row). `data-open`, `state.open` and `children(state).open` stay
optimistic; `shown` is not exposed in any `state` object (consumers have `:popover-open`).

Why a React mirror and not the DOM write of JS-free mode in both modes (A'): the write would
need a registry of target elements (the Combobox has two) and leaves React rendering a constant
`false` it must never change; a Root state has one writer, one reader per part and no attribute
plumbing. Why urgent and not a transition: it mirrors browser-owned state after the fact
(conventions 3.5: the DOM is the source, the mirror follows the platform event), so there is
nothing to await and nothing to roll back; a transition would re-create the very window being
closed. Cost: one sync-lane Root render per show and per hide, a task after the DOM change; the
Root re-renders at the open and close commits anyway, and the Root value is memoised, so the
Popup re-renders only when `shown` actually flipped.

| Phase | DOM `aria-expanded` | every engine exposes (the Input, a non-button Trigger, Firefox) |
| --- | --- | --- |
| closed | `"false"` | collapsed |
| pending open (popup hidden) | `"false"` | collapsed |
| open | `"true"` | expanded |
| pending part-initiated close (popup shown) | `"true"` | expanded |
| browser-owned dismissal, notification pending (popup hidden) | `"false"` one task after the hide | collapsed |
| refused dismissal, re-shown by the apply effect | `"false"` then `"true"` with the re-show's `toggle` | collapsed, then expanded |
| `defaultOpen` before hydration | `"false"` (server HTML) | collapsed, the popup is not shown |
| pre-hydration open found at mount (platform path) | `"true"` from the Popup's attach | expanded |

Chromium and WebKit expose a `commandfor` invoker's own state in every row, which is the same
value. The three lag phases the review listed (L5) are gone; the one remaining difference from
`:popover-open` is the `toggle` task itself (one task, coalesced by the platform).

Edits: 2.2 (the pending-open table), 2.5 (`defaultOpen` and the server HTML), 3.2, 4 (ownership
table), 9, 10 (lane table), walkthrough 11's platform path, 13.2 (the async row's dismissal
sentence), 14.1 (`shown` / `setShown`), 14.2 (`toggle` and the callback ref), L6, and the
"committed" annotations throughout; conventions 3.2 (the urgent row and the bounded rule), 3.5
(the "Optimistic source" cell), 4.1, decision 40. menu.md and combobox.md carry a shorter note.

Implementation (developer, on `fix/118-invoker-aria-expanded`, replacing the list above):

- `internal/use-overlay-root.ts`: `const [shown, setShown] = useState(false)`; `shown` and
  `setShown` on `OverlayRootValue` (doc: "the popup is in the top layer, mirrored from its
  `toggle`; Dialog does not maintain it"); `shown` in the memo deps.
- `internal/use-popover-popup.ts`: in `onToggle`, library mode, `ctx.setShown(isPopoverOpen(element))`
  next to the JS-free `syncExpanded`; in `setElement`, library mode, `ctx.setShown(isPopoverOpen(element))`
  after the listeners attach and `ctx.setShown(false)` in the cleanup. `reconcileOnMount` is
  unchanged (the attach read runs first).
- `internal/use-popover-trigger.ts`: `"aria-expanded": isLibrary ? ctx.shown : false`.
- `combobox/combobox-trigger.tsx`, `combobox/combobox-input.tsx`: `"aria-expanded": popover.shown`.
- Doc comments that say "committed" for the attribute say "shown (the popup is in the top layer)".

Tests (replacing the attribute expectations above; `flushTasks` flushes the shim's `toggle`):

- Shared suite `expectExpanded`: the "dismissal ... pending meanwhile" row asserts `false`
  right after the `toggle` flush while the notification is pending and `false` after; the
  "refused dismissal re-opens" row asserts `false` while hidden and `true` after the re-show
  (review L1, with the new values); pending open `false`, pending part close `true`, settled
  rows unchanged.
- `popover.test.tsx`: `defaultOpen` renders `aria-expanded="false"` in `renderToString`, matches
  on hydration, and is `"true"` after the apply effect's `showPopover()` and the `toggle` flush;
  the platform path (popup `:popover-open` before mount) renders `"true"` on the first commit
  while the `"platform"` dispatch is pending; a Popup unmounted while open leaves `"false"`; the
  JS-free render-count row still passes (no `setShown` in that mode).
- `combobox.test.tsx`: Escape (shim `hidePopover()` + `toggle` flush) with a deferred close
  action: input and Trigger `aria-expanded="false"` while `data-pending`, listbox hidden; the
  same with the notification entangled with a pending unrelated action (a deferred
  `valueChangeAction` save, walkthrough 6's shape): still `"false"`.
- Chromium AX row (`popover.browser.test.tsx`): unchanged, plus one sample right after a real
  Escape with a 300 ms action: DOM `"false"` and AX `expanded=false` for the Trigger; and the
  Combobox browser Escape probe the reviewer ran (M1) as a row on the Input: DOM `"false"`
  within a frame, AX `expanded=false` on Chromium.
- A render-count row on the Root (`children(state)` call count): one extra render per show and
  per hide, none for an unchanged value.

## Amendment: `popovertarget` Triggers, no `aria-expanded` (#121, 2026-10-24)

Status: architect decision, **approved by the user through the product owner** (#121; option E of
`docs/research/invoker-aria-expanded.md`, evaluated in `memo/architect/eval-121-popovertarget.md`,
probes in `memo/architect/probes/121-popovertarget/`). Cross-component rule: conventions decision
41 (decision 40 is superseded for `<button>` Triggers). Edited in place: decisions 7 and 12, the
anatomy table, 2.1 (the mode table and the invoker prose), 2.2 (the pending-open table), 2.5
(`defaultOpen` and the server HTML), 3.2 (owned keys), 3.4 (the Close keeps its command), 4 (the
ownership table), 9, 10 (the CSS example and the lane table), walkthroughs 11.1, 11.3 and the
platform path, 13.2, 14.1, 14.2, 14.3, conventions feedback 3, L6. Menu and Combobox carry a
shorter amendment each; Dialog is untouched.

**Breaking change (DOM attributes only; no prop, state field or type change).** In the
0.1.0-alpha line, with a BREAKING line in the release notes:

- `Popover.Trigger`, `Menu.Trigger`, `Menu.SubmenuTrigger` and (after hydration)
  `Combobox.Trigger` render `popovertarget` instead of `commandfor` + `command="toggle-popover"`.
- They render **no `aria-expanded`** when they render a `<button>`. CSS on
  `[aria-expanded="true"]` moves to `[data-open]`; tests that asserted the attribute assert its
  absence, or the AX state.
- `commandfor` / `command` stay omitted from the Trigger props types as reserved keys;
  `popoverTarget` / `popoverTargetAction` join the omitted keys.

Decision and sub-decisions (all five user-approved):

1. **Adopt now**, before 0.1.0; do not wait for w3c/html-aria#514 (open, `mergeable_state: dirty`,
   last touched 2025-12-01; Chromium and WebKit already ignore the attribute on an invoker, and
   all three engines map `popovertarget`).
2. **A non-button `render` keeps `aria-expanded={shown}`** (#115 strips the invoker attribute
   from it, so nothing else exposes the state; #514 only forbids the attribute next to
   `popovertarget` or a popover `command`, so this is conforming).
3. **JS-free mode writes `data-open`** on the Trigger from the Popup's `toggle` listener, the
   mechanism that wrote `aria-expanded` until now, so `[data-open]` is the styling hook in both
   modes; the docs page shows `:has(+ :popover-open)` for a page that never hydrates.
4. **#125** (filed): classify a foreign `popovertarget` invoker's close as `"activate"` from
   `ToggleEvent.source` (the invoker for an activation, `null` for Escape, light dismiss and
   script; Chrome 140, Firefox 145, Safari 26.5). Independent of this change.
5. **A native-disabled Trigger with its popup shown exposes no state** (a disabled button is no
   invoker, in every engine): accepted as a transient case.

Grounds, in short (the memo has the tables): HTML-AAM maps a `popovertarget` invoker to its
popover's expanded state and Chromium 156, Firefox 157 and WebKit expose it with no attribute
present, the `menuitem` role included; the explicit attribute is ignored by Chromium and WebKit
and OR-ed in by Firefox, and #514 makes it an author MUST NOT; so the one markup that is right in
every engine and every phase, including before hydration and in the `toggle` task that the
`shown` mirror lags, is `popovertarget` with no attribute. Everything the Triggers relied on the
invoker relationship for was measured identical for both attributes on Chromium and Firefox with a
real pointer and read in WebKit's source: the light-dismiss exemption (#112; `Document.cpp`
`handlePopoverLightDismiss` checks `commandForElement()` then `popoverTargetElement()`),
cancelled-click suppression (mouse, Enter, Space), the implicit anchor, nested stacking
(`Element::topmostPopoverAncestor` reads the popover's `invoker`, which "show popover" sets for
both), a press on the outer invoker with a stack open, and `ToggleEvent.source`. The only loss is
the `command` event from the library's own Trigger, which the Trigger cancels anyway.

Unchanged: `Popover.Close` (`commandfor` + `hide-popover`, 3.4), the Dialog parts
(`popovertarget` cannot open a modal `<dialog>`; `Dialog.Trigger` renders no `aria-expanded`),
`Combobox.Input` (explicit attribute, `role="combobox"`), the Popup's `onCommand` for foreign
`commandfor` invokers, `onBeforeToggle`'s routing of foreign opens, `showPopover({ source })`,
the `shown` mirror in `useOverlayRoot` (now read by non-button renders and the Combobox Input),
`Button`'s in-flight guard (attribute-agnostic), the `ButtonInvoker` docs example.

Rendering note: react-dom 19.3.1 knows `popoverTarget` / `popoverTargetAction` (the lowercase
spelling warns "Invalid DOM property"), serialises them camelCase in server HTML (parsed
case-insensitively) and lowercases them through `setAttribute` on the client; `@types/react`
types them. Write the camelCase prop in JSX; the Combobox ref write is the lowercase
`setAttribute("popovertarget", id)`. Nothing is added to `platform-attributes.ts`.

### Implementation plan (developer)

Source:

- `internal/use-popover-trigger.ts`: `popoverTarget: invoker ? ids.popup : undefined` replaces
  the `commandfor` / `command` pair; `"aria-expanded": invoker ? undefined : isLibrary ?
  ctx.shown : false`; the JS-free ref sync writes `data-open`
  (`element.toggleAttribute("data-open", isPopoverOpen(popup))`) instead of `aria-expanded`;
  doc comments (`button[popoverTarget]`, "no `aria-expanded` on an invoker, #121"). The
  non-button warnings keep their text (the exemption argument is unchanged).
- `internal/use-popover-popup.ts`: `syncExpanded` becomes `syncOpen`, writing `data-open` on the
  Trigger element in JS-free mode; `setShown` in library mode, `onCommand`, `onBeforeToggle`
  unchanged.
- `combobox/combobox-trigger.tsx`: the ref callback writes `popovertarget` and removes it in
  the cleanup (the `command` write goes); `"aria-expanded": rendersButton(render) ? undefined :
  popover.shown`; `Omit` gains `"popoverTarget" | "popoverTargetAction"`; doc comment.
  `combobox-input.tsx` unchanged.
- `popover/popover-trigger.tsx`, `menu/menu-trigger.tsx`, `menu/menu-submenu-trigger.tsx`: the
  `Omit` lists gain `"commandfor" | "command" | "popoverTarget" | "popoverTargetAction"`
  (`aria-expanded` stays); doc comments.
- `popover/popover-close.tsx`: doc comment only (keeps the command, says why).
- `internal/platform-attributes.ts`: the `commandfor` / `command` comments note they serve
  `Popover.Close`, Dialog and `Button` (no removal).
- `__tests__/invoker-shim.ts`: a `popovertarget` branch after the `commandfor` one returns
  nothing: read `popovertarget`, require a `[popover]` target, apply `popovertargetaction`
  (`toggle` default, `show`, `hide`; `show` on a shown and `hide` on a hidden popover are
  no-ops), **no `command` event**, the same disabled and submit-button exclusions, reusing the
  popover shim's registered `run` (`toggle-popover` / `show-popover` / `hide-popover`). The
  `popover-shim.ts` header comment names it.

Tests (jsdom has no accessibility tree; the DOM assertions pin the markup and the Chromium CDP
rows pin the exposed state; about 130 attribute assertion sites in 11 files, mostly mechanical):

- `src/__tests__/overlay-open-state-suite.tsx` (22 sites): `expectExpanded` splits into
  `expectInvoker()` (a `<button>` Trigger: `popovertarget` equal to the Popup id, no
  `aria-expanded`, in every phase) and the existing value assertion, which now runs on a
  `render={<a href="#" />}` Trigger row (the `shown` phases of the #118 revision: `false` during
  a pending open, `true` during a pending part close, `false` right after a dismissal's `toggle`
  flush while the notification is pending, `true` again after a refused dismissal's re-show).
  `data-open` / `data-pending` rows unchanged.
- `src/__tests__/overlay-disabled-render-suite.tsx` (8 sites): a native-disabled `<button>`
  renders `popovertarget` and no `aria-expanded`; the `aria-disabled` branch (a link or component
  render in library mode) withholds `popovertarget` and therefore renders `aria-expanded` (the
  "no invoker" rule); a non-button render has `aria-expanded` and no `popovertarget`.
- `popover.test.tsx` (26 + 16 sites): `renderToString` output has `popoverTarget="<id>"` and no
  `aria-expanded` on the Trigger (with and without `defaultOpen`), hydrates without a mismatch;
  the JS-free rows assert `data-open` written on the Trigger after a native toggle (through the
  shim's `popovertarget` branch), synced for a Trigger that mounts late, and the JS-free
  render-count row still passes; the platform path (popup `:popover-open` before mount) has no
  attribute to assert on the button and asserts `shown` through the link-render row; Close rows
  unchanged (`commandfor` + `hide-popover`); the foreign-invoker rows keep `dispatchCommand`.
- `menu.test.tsx` (10 + 7), `menu-context-trigger.test.tsx` (2 + 2): the Suspense open, #110
  Trigger-close, Escape and SubmenuTrigger rows assert `popovertarget` and no `aria-expanded`;
  one link-render row for the `shown` values; the context trigger is unchanged (it never had
  the attribute).
- `combobox.test.tsx` (22 + 15): see Combobox's amendment (the Input's rows are kept; the button
  Trigger's become absence assertions; `popovertarget` after mount, none in `renderToString`,
  none on a non-button render which renders `aria-expanded` instead).
- `use-popover-hooks.test.tsx` (1): the hook renders `popoverTarget` and no `aria-expanded` for
  a button, the reverse for a non-button render.
- Browser: `popover.browser.test.tsx` (24 + 9), `menu.browser.test.tsx` (6),
  `combobox.browser.test.tsx` (10 + 7), `overlay-browser-suite.tsx` (5): the DOM assertions swap
  to `popovertarget` / absence; the existing behaviour rows (light dismiss on the Trigger, the
  #112 Trigger close at `pointerup` + 20 ms, nested Popovers, Menu positioning and submenus,
  pre-hydration typing) run unchanged on all three engines. The **Chromium AX rows become the
  state assertions**: with `getAXNodes()` / `axProperty(node, "expanded")` from
  `src/__tests__/ax-tree.ts`, on `Popover.Trigger`, `Menu.Trigger`, `Menu.SubmenuTrigger` and
  `Combobox.Trigger`: `false` closed and during a deferred open, `true` open and during a deferred
  part close, `false` right after a real Escape with a 300 ms action (sampled within a frame),
  `true` again after a refused dismissal re-shows. Firefox and WebKit run the DOM assertions only
  (`server.browser === "chromium"` branch); the Firefox tree is checked manually with
  `memo/architect/probes/121-popovertarget/ax-firefox.mjs`.
- Screen-reader pass (owed since #118; NVDA + Firefox, NVDA or JAWS + Chrome, VoiceOver +
  Safari): the Trigger announces "collapsed" at the hide itself; a VoiceOver check of
  `Popover.Close` inside its popup (WebKit's quirk, research upstream report 2).

Docs pages (`packages/docs/src/pages`): `PopoverPage.tsx` (the owned keys, the Trigger state
row, the ARIA table row, the CSS example's `[aria-expanded="true"]` → `[data-open]` with the
`:has()` recipe, the pending-and-optimistic paragraph); `MenuPage.tsx` (the Trigger attribute
row, the pending section's list, the entanglement sentence); `ComboboxPage.tsx` (the overview
sentence, the owned keys, the `data-open` row's aside); `BrowserOwnedStatePage.tsx` (the
`aria-expanded` mirror sentence now names the non-button render and the Input); the concept
page on pending and optimistic state ("a `<button>` overlay Trigger renders no `aria-expanded`;
the browser exposes the popup's state"); the release notes' BREAKING line with the two selector
migrations. `DialogPage.tsx` and `ButtonPage.tsx` unchanged.

## Amendment: lost interest hides an interest-opened popup (#127, 2026-10-25)

Status: architect decision (low priority, Chromium-only today). Probes in
`memo/architect/probes/127-interestfor/`, notes in `memo/architect/popover-notes.md`. Edited in
place: decision 8, the 2.3 close table (the `popovertarget` row and a new lost-interest row),
the section 7 dismissal table, 14.2 item 3, the follow-ups list. Menu and Combobox share the
hook and inherit the behaviour with no amendment of their own.

### Decision

**Supported.** A `<button interestfor={popupId}>` naming a library-mode Popup (a consumer's own
button, or the Trigger with `interestfor` added through props) opens it on interest, which
already works through the foreign-open route of 2.2, and **loses it on lost interest**: the
library hides the popup itself, as a dismissal (`reason: "dismiss"`, `details.event` the
`loseinterest` `InterestEvent`, whose `source` is the button). Lost interest **during a pending
interest open** cancels the open (dispatch `false`, same reason and event), so a hover card
whose content is still loading does not appear under a pointer that has left. Nothing changes
in JS-free mode, where the platform's own interest relationship is intact.

Why support rather than warn: 2.2 promises that a foreign open is "cancelled at `beforetoggle`
and routed the same way", a transparent interception. Today the interception is what breaks the
platform's lost-interest hide (below), so a popup that opens on hover and never closes on
hover-out is a library bug, not a missing feature. The fix is one listener pair and one flag in
`usePopoverPopup`; a dev warning would have to detect the attribute in Chromium only and would
leave the consumer with nothing. Tooltip remains the component for `role="tooltip"` content
(name or description, `hint`, no focus, delays and warm opens): an `interestfor` Popover is a
hover card, interactive content a pointer can enter, which `auto` and the dialog focusing steps
already fit. The deferred "hover to preview, click to pin" API (follow-ups) is unchanged: this
amendment adds no prop.

### Cause (Chromium 156, source and probe)

`Element::InterestGained` fires `interest` on the target, registers the button as the target's
interest invoker, **then** shows the popover through `InvokePopover(button, kInterest)`, which
upgrades the popover's `invokedVia` to `kInterest` only if the show succeeded.
`Element::InterestLost` fires `loseinterest`, clears the invoker, and hides the popover **only
when `invokedVia == kInterest`**. The library cancels the interest show at `beforetoggle` and
re-shows in a later commit with `showPopover({ source: trigger })`, which `ShowPopoverInternal`
records as `kNone`, and no script API sets `kInterest`. So after the library's open the button
is still the popup's interest invoker (`:interest-source` matches, `loseinterest` still fires on
the popup) and the platform never hides. Measured (`interestfor-library-popover.mjs`): a plain
popover hides on hover-out with `ToggleEvent.source` = the button; after cancel-and-reshow with
the Trigger or no source the popup stays shown and `loseinterest` arrives with `:popover-open`
true; with a 600 ms "action" the pointer leaves while the popup is hidden (`loseinterest` on a
hidden popup) and the popup then appears and stays. Two more facts the implementation depends
on: (1) hiding the popup by **any** means while the button has interest (Escape, script
`hidePopover()`, the library's own close) makes Chromium fire `loseinterest` on the popup from
inside the hide, before the state flips, so a `loseinterest` listener sees `:popover-open`
still true; (2) a `hidePopover()` called synchronously from that listener re-enters the hide
(a nested `loseinterest`, a second hide) and **the `toggle` event never arrives** (three of
three cycles, `fix-shapes.mjs`, `sync`), whereas a hide deferred by one task fires no nested
`loseinterest` and the `toggle` arrives (`task`, three of three).

### Behaviour

| Situation (library mode, Chromium) | What happens | `reason` | `details.event` |
| --- | --- | --- | --- |
| Interest on a button naming the popup (hover or keyboard focus, after `interest-delay-start`) | `interest` fires on the popup, then the platform's show is cancelled at `beforetoggle` and routed as in 2.2; the Popup remembers that this open was an interest open; the popup shows when the action settles, anchored to the Trigger (`source`), or centred without one (2.7) | `"activate"` | the `beforetoggle` `ToggleEvent` (unchanged) |
| Lost interest (pointer left button and popup, or blur, after `interest-delay-end`) while the popup is shown and the current open was an interest open | the Popup records a `"dismiss"` intent and calls `hidePopover()` **in a task** (`setTimeout(0)`), only if the popup is still shown then; the `toggle` consumes the intent and notifies | `"dismiss"` | the `loseinterest` `InterestEvent` |
| Lost interest while the interest open is still pending (popup hidden, `intended()` true) | dispatch `false`: latest intent wins, the open never shows (walkthrough 11.7 shape); `openChangeAction` sees `true` then `false` | `"dismiss"` | the `loseinterest` `InterestEvent` |
| Lost interest while shown, but the current open was **not** an interest open (Trigger click, foreign `commandfor`, pre-hydration) | nothing: the platform rule (`invokedVia`) says a click-opened popover does not hide on lost interest | | |
| `loseinterest` fired from inside another hide (Escape, light dismiss, script, the apply effect) | the task finds the popup hidden and does nothing; the hide notifies once, as before | (that hide's) | |
| Pointer re-enters the button or the shown popup before `interest-delay-end` | nothing fires; the popup stays | | |

The hide is browser-shaped even though the library calls it: nothing is awaited, a controlled
parent that keeps `open={true}` sees the popup re-open after the action (conventions 3.5), the
exit is the 10.1 CSS exit and `held` works as for any dismissal, and there is no
`<ViewTransition>` exit (10.2). The one deliberate difference from a plain popover is the
`ToggleEvent.source` of the hide: `null` (a script `hidePopover()`), not the button; the button
is on `details.event.source` instead. Focus: the platform's lost-interest hide and
`hidePopover()` both run the "focus previous element" steps, so a focus-driven interest open
closed by blur leaves focus where the user moved it, and a hover open never moved focus unless
`initialFocus` / the dialog focusing steps did, which behave as for any library open (6.1).
**The lost-interest hide skips the 6.2 rule-2 fallback** (developer finding, dev-127): when
the dialog focusing steps had moved focus into the popup and nothing was focused before the
hover open, `hidePopover()` leaves focus on `<body>`, and the fallback's `focus()` on the Trigger
would grant a Trigger that carries `interestfor` interest by focus, re-opening the popup the user
just left (measured: hide, `toggle(closed)`, focus return, `interest`, re-open, in one frame).
The platform's own lost-interest hide restores only the previously focused element (which the
`hidePopover()` call already does when focus is inside) and never focuses the invoker, so the
library does the same here: a flag set in the task before `hidePopover()` and consumed by
`onToggle(closed)` suppresses the Trigger fallback for this one hide; a foreign button's hide
behaves identically (focus to the previous element, else `<body>`). Nested interest-opened
popups therefore leave focus on `<body>` after a lost-interest hide, as the platform does.
Other engines: `interestfor` is inert in Firefox and WebKit, so the button does nothing there;
a consumer who needs the hover card everywhere makes the button the Trigger (click opens in
every engine, interest adds hover on Chromium). Menu and Combobox inherit the rows (shared
hook); nothing composes `interestfor` with them today.

### Implementation plan (developer)

`internal/use-popover-popup.ts`, library mode only (the listeners are added with the others in
the callback ref and removed in its cleanup; the events exist only where `interestfor` does):

- `interestInvoker` ref (`Element | null`): set from an `interest` listener
  (`event.target === popup`) to `(event as InterestEvent).source` (not in TypeScript's DOM lib;
  read it as `Element | null | undefined` like `closedByPopoverTarget` reads
  `ToggleEvent.source`); cleared by `loseinterest` when its `source` is the same element.
- `interestOpen` ref (boolean): in `onBeforeToggle`, open branch, routed case, set to
  `toggle.source !== null && toggle.source === interestInvoker.current` right before
  `requestOpen` (the `interest` dispatch and the cancelled show are one synchronous platform
  step, so the comparison is exact); cleared in `onToggle` when the popup is closed, and by the
  pending cancel below. (Accepted staleness: a Trigger click that cancels a pending interest
  open leaves the flag set until the next close; the only effect is that a later lost interest
  of a re-hovered button closes that Trigger-opened popup, which is what the consumer asked for
  by naming the popup. A controlled parent that refuses an interest open leaves the flag stale
  the same way, since no `toggle(closed)` follows an open that never showed, and it is harmless
  for the same reason.)
- `onLoseInterest(event)`: `event.target === popup`, library mode, `source ===
  interestInvoker.current`; clear `interestInvoker`; return unless `interestOpen.current`. If
  `isPopoverOpen(popup)`: `setTimeout(() => { if (!isPopoverOpen(popup) || !ctx.intended())
  return; ctx.recordCloseIntent({ reason: "dismiss", event }); popup.hidePopover(); }, 0)`,
  the timer id kept in a ref and cleared on detach, and an `interestHide` flag set right before
  `hidePopover()` that `onToggle(closed)` reads and clears to skip `returnFocus` (the 6.2
  rule-2 Trigger fallback; the platform never focuses the invoker after a lost-interest hide, and
  focusing a Trigger with `interestfor` re-opens the popup). Else if `ctx.intended()`:
  `interestOpen.current = false; ctx.requestClose(event, "dismiss")` (`PopoverRootValue` has no
  close args). The intent is recorded inside the task right before the hide, so its one-task
  clear (which clears only while the popover is still open) cannot run first.
- `onBeforeToggle` close branch and `closedByPopoverTarget` are unchanged (the `source` of this
  hide is `null`). Doc comment on `onLoseInterest` names the Chromium facts above and #127.
- Nothing in `use-popover-trigger.ts`, the Root, Menu or Combobox.

Tests:

- jsdom (`popover.test.tsx`; helpers in `src/__tests__/popover-shim.ts` or a new
  `interest-shim.ts`: `dispatchInterest(popup, source)` / `dispatchLoseInterest(popup, source)`
  dispatching a plain `Event` with a `source` property, since jsdom has no `InterestEvent`; the
  platform's interest show is emulated by `popup.showPopover({ source: button })` right after
  `dispatchInterest`, which the library cancels and routes exactly as Chromium's
  `InvokePopover` is): (1) interest open then `loseinterest`: the popup hides,
  `openChangeAction(false, { reason: "dismiss", event })` with `event.type === "loseinterest"`
  and `event.source` the button, one call; (2) a 300 ms action, `loseinterest` before it
  settles: `openChangeAction` saw `true` then `false` (`"dismiss"`), the popup never shows,
  `data-pending` on the Trigger until the second settles; (3) Trigger-click open, then
  `interest` + `loseinterest` from a foreign button: stays open, no dispatch; (4)
  `loseinterest` with nothing pending and nothing shown: nothing; (5) interest open, then
  `loseinterest` fired synchronously followed by `hidePopover()` in the same task (Chromium's
  Escape shape): exactly one `false` notification, no error; (6) a Trigger-less controlled
  Popup: rows 1 and 2 hold. One `use-popover-hooks.test.tsx` row that Menu's popup hides on
  the same shape is optional. The #125 F1 jsdom row (an `interestfor` source stays `"dismiss"`)
  is unchanged.
- Browser (`popover.browser.test.tsx`, branch on `supportsInterestFor` from
  `src/__tests__/engine.ts`; `interest-delay: 0s` on the button): Chromium: real hover on a
  foreign `interestfor` button opens the popup (anchored to the Trigger), moving the pointer to
  an outside element hides it within 500 ms and notifies `"dismiss"` with a `loseinterest`
  event; Tab to the button opens, Tab away hides, focus is on the next element; a 600 ms action
  with the pointer leaving at 300 ms: the popup never becomes `:popover-open` and the second
  dispatch is `"dismiss"`; Escape while hovered: one notification, the popup hidden, and a
  later hover-out does nothing; the Trigger itself with `interestfor` (the issue's second case):
  hover opens, hover-out hides, a click while open closes through the library (`"activate"`).
  Firefox and WebKit: the same markup, hover and Tab open nothing and the popup stays hidden
  (the documented degradation). The #125 review-F1 Chromium row ("if still open, dispatch the
  lost-interest shape, then hide") loses its fallback: the hover-out itself must hide.
- Mutations: no task deferral → the Escape row (double hide, lost `toggle`) and jsdom row 5;
  no `interestOpen` check → jsdom row 3; no pending cancel → jsdom row 2 and the 600 ms
  browser row; no `intended()` guard in the task → row 5 variant where the Trigger's close
  lands first.

Docs (`packages/docs/src/pages/PopoverPage.tsx`, technical writer): a short "Hover card
(Chromium)" note under the foreign-invoker material: `interestfor` naming the Popup opens on
interest and dismisses on lost interest in library mode; `details.event` is the `loseinterest`
event; other engines ignore the attribute, so give the button a click path (make it the
Trigger) when the card must open everywhere; point to Tooltip for name/description content.
Release notes: "fix: a library-mode Popover opened by an `interestfor` button now hides on
lost interest (Chromium), and lost interest during a pending open cancels it (#127)."

## Amendment: the library cuts the CSS transition around its own show / hide (#147, 2026-11-24)

As Dialog's amendment of the same date: the consumer rule `html:active-view-transition .popover
{ transition: none; }` (10.2, the Dialog #46 M2 row) is gone from the docs, the docs stylesheet
and the playground. `usePopoverPopup` wraps its own `showPopover()` (`showPopup`), the apply
effect's `hidePopover()` and `reshow()` (one cut around both halves) in `withCssTransitionCut`
when the Popup has `transition`; Menu and Combobox get it through the shared hook. The hides the
library performs as dismissals (a JS-free Close with `action`, Menu's Tab-out, outside press and
drag release, Combobox's focus-leave, a lost interest) are facts and are not cut.

---

# dialog.md: test plan, implementation notes, amendments, review corrections

## 13. Test plan

### 13.1 jsdom facts (jsdom 30.1.3, the version `packages/ui` resolves)

Probed while designing (`memo/architect/dialog-notes.md`):

- `HTMLDialogElement` exists and `open` reflects the attribute, but **`show()`, `showModal()`,
  `close()`, `requestClose()`, `returnValue` and `closedBy` are all missing**.
- `:open` matches the attribute; `:modal` parses and never matches; no `toggle`, `beforetoggle`,
  `cancel` or `close` events are ever fired.
- No `CommandEvent`, no `commandForElement`: a click on `<button commandfor command>` does
  nothing. No close watcher: Escape does nothing.
- `form.method` reflects `"dialog"`; `submitter.formMethod` is undefined.

So the jsdom project needs a **dialog shim**, `src/__tests__/dialog-shim.ts`, loaded from
`vitest.setup.ts` next to the popover shim and installed only where `showModal` is missing:
`show()`, `showModal()` (sets `open`, marks the element modal in a `WeakSet`, dispatches
`beforetoggle` synchronously and queues `toggle`, runs a minimal focusing step: `[autofocus]`
descendant, else first `button, input, …`, else the dialog), `close(v)` (clears `open` and the
modal mark, sets `returnValue`, restores focus to the element focused at open, queues `close`),
`requestClose(v)` (dispatches a cancelable `cancel`, then `close(v)` unless prevented),
`returnValue`, `closedBy` **not** defined (so the flag's feature detection stays false and the JS
baseline is what jsdom tests), `matches(":modal")` overridden to the shim's mark, and a `submit`
listener that closes the dialog for `method="dialog"` forms (and for a submitter with
`formmethod="dialog"`, setting `returnValue` from the submitter's `value`). The shim **also
emulates invoker clicks**: a document-level `click` listener on `button[commandfor]` dispatches a
cancelable `CommandEvent`-shaped `command` event (`command`, `source`) on the target and, unless
prevented, runs `show-modal` / `request-close` / `close`, so tests click Triggers and Close parts
with `user-event` like a user would. Escape is driven by calling `dialog.requestClose()`
directly (no close watcher in jsdom). Exit animations: `getAnimations` is absent in jsdom; the shim
returns `[]` so the deferred-unmount path is a browser-mode test.

### 13.2 Coverage against conventions 10.1

"both" = `describe.each` over uncontrolled and controlled wrappers (controlled follows
update-on-success). Library mode unless stated.

| Row | Dialog tests (jsdom) |
| --- | --- |
| Roles and ARIA | Default elements `button[type=button][commandfor][command=show-modal]`, `dialog[id][aria-labelledby][aria-describedby][data-modal]`, `h2[id]`, `p[id]`, `button[command=request-close]`, `form[method=dialog]`; ids resolve; consumer `aria-describedby="x"` becomes `"x <id>"`; `modal={false}` renders no `command` and no `data-modal`; `experimental_closedBy` renders `closedby="closerequest"`, with `lightDismiss` `"any"`, and nothing without the flag; `role="alertdialog"` passes through; `open` is never rendered, also with `defaultOpen`. |
| Keyboard | Enter/Space on the Trigger (user-event clicks buttons) dispatches; Escape is **not** simulable (no close watcher): the dismiss path is tested through `requestClose()` and the non-modal `keydown` listener is tested with user-event Escape while focus is inside the dialog. |
| Sync action (both) | Trigger click → `openChangeAction(true, details)` with `details.event` the native `MouseEvent`, `reason: "activate"`, `returnValue: undefined`; `details.event.defaultPrevented` is true (the command was cancelled); disabled Trigger never dispatches; a click while optimistically open never dispatches; a `command` event with `command: "show-modal"` on the dialog is cancelled and dispatches with that event. |
| Async action (both) | `deferred()` open: `data-open` + `data-pending` on Trigger, `showModal` spy not called, children not rendered; resolve: `showModal` called once, children rendered, attributes gone. Close notification: `requestClose("x")` → `close` → `openChangeAction(false, { reason: "dismiss", returnValue: "x" })` after... (a `requestClose` from script is a dismiss; the `"activate"` label is asserted through a `command` event with `request-close` and through a `method="dialog"` submit); while pending the Trigger has `data-pending` and no `data-open`. |
| Rejection (both) | Open rejects: `ErrorCatcher` receives it, `showModal` never called, no `data-open`. Close notification rejects uncaught: the catcher above Root receives it and the whole component is replaced (no re-open to assert). Re-open is asserted where the component stays mounted: controlled parent refusing the close, and a controlled action that catches without adopting `false` → `showModal` called again once settled. Caught-inside variants commit. |
| Overlap | Walkthrough 11.8 with two `deferred()`s resolved out of order: `openChangeAction` called twice, final `showModal` call count and `data-open` match the latest dispatch. |
| Superseded rejection (both) | Older dispatch rejects after and while the newer is pending; `reportError` (stubbed) gets it once, `ErrorCatcher` does not; the dialog ends as the newer dispatch left it. |
| Suspending content (both) | Popup children mount `<Suspender>` on open: `showModal` not called, Trigger pending, no fallback from the boundary above; resolve: `showModal` called, content present. `keepMounted`: Suspender mounts hidden at page render inside `<Activity>`. |
| Function props | `className` / `style` / `children` / `render` on every part receive the documented state; JS-free mode passes `open: false`, `pending: false`. |
| `render` element | `render={<dialog className="x" />}` keeps `id`, ARIA and the listeners; `render={<a href />}` on Trigger in library mode dispatches through the click handler and gets no `type`; a non-dialog element warns. |
| Post-await rule | Controlled parent updating after `await` inside `startTransition` end to end. |
| Directive | Every file under `src/dialog/` except `index.ts` begins with `"use client"`. |
| Platform path | Mount with the dialog's `open` attribute already set (pre-hydration open): one dispatch with `reason: "platform"`, `event: undefined`; parent accepts → children mount and `showModal` not called again; parent refuses → `close` called. Controlled `open` flipping `true`/`false` programmatically calls `showModal` / `close` and the resulting `close` event does **not** dispatch (echo). |
| Close part | Without `action`: `command="request-close"`, `value` rendered. **Library mode (both):** the click is default-prevented and goes through the Root: `openChangeAction(false, { reason: "activate", returnValue: value, event: click })` is called **before** `close`, `close(value)` only after it resolves (a `deferred()` action: the dialog is still open and the Trigger `data-pending` meanwhile; the Close button `data-pending` too), the resulting `close` event dispatches nothing more (one call), `dialog.returnValue` is the value. Rejecting `openChangeAction(false)` uncaught: the catcher above Root gets it, `close` was never called (the component is replaced). Controlled parent keeping `open`: `close` never called, the dialog stays open, `data-open` back on the Trigger. With `action`: `data-pending` while the deferred action runs, `openChangeAction(false)` not called until it resolves, nothing on reject (error in the catcher inside the dialog). **JS-free:** without `action` the command runs natively; with `action`, `close(value)` is called directly on resolve. `render={<a href />}` in library mode closes through the click handler. |
| Close part, stale close | A `Dialog.Close` action pending; Escape closes the dialog; the Trigger re-opens it; the action resolves: `openChangeAction` saw `[true, false ("dismiss"), true]` and no fourth call, `close` is not called on the new open (open-generation guard), the action ran once. JS-free variant unchanged (holds `toggle` back). **#81:** the superseded-rejection half of this row is N/A (a Close never has two runs in flight); the Re-entry rows are in `design/components/button.md` 16.4 (one row; it fails without the shared hook). |
| Close part, dismissal during a pending close | `requestClose` pending (deferred `openChangeAction(false)`), then `requestClose()` on the dialog (Escape): one `openChangeAction(false)` in total, the first with `"activate"`; after it resolves `close` is not called again; the dialog ends closed. |
| Close part, dismissal then veto (11.13, review M1) | Controlled: a Close click with a deferred `openChangeAction(false)`, then `requestClose()` on the dialog, then the parent settles without adopting: `openChangeAction` saw `[true ("activate"), false ("activate", value), false ("dismiss", "")]`, the third `event` is the `close` event; `showModal` was called once (never re-opened); the dialog ends closed, content unmounted, Trigger neither `data-pending` nor `data-open`. Variant: the Trigger re-opens between the Escape and the settle: `[true, false ("activate"), true]`, no `"dismiss"`, the dialog ends open. |
| Close part with `action`, controlled veto | The action runs once, `openChangeAction(false)` is called, the parent keeps `open`: `close` never called, `showModal` once (no blink), `data-open` back on the Trigger. |
| Re-open during a pending part close (reviewer P2) | Uncontrolled, non-modal: a Trigger click while `openChangeAction(false)` runs: `[true, false ("activate"), true]`, `close` never called, `data-open` back, the dialog stays open. Uncontrolled only: a controlled harness that adopts in arrival order ends with the superseded `false` (conventions 2.5). With `lightDismiss` (with and without the flag) the click is also a dismissal and ends closed: `[true, false ("activate"), true, false ("dismiss")]`, the last from the `close` event (#116). |
| Walkthrough 11.16 | A controlled `setOpen(false)` while a Close `action` runs: one `openChangeAction(false)`, one `close(value)`, the dialog closed with `returnValue` the Close's value. |
| Submit opt-out on a document root (review M3) | A `document` `submit` listener registered **before** mount that calls `stopPropagation()` (stands for React's root on the document, FUNSTACK Static): the library does not cancel the submit (`cancelBubble`), the shim closes natively, notified `"dismiss"`. Fails without the `cancelBubble` check. |
| Shadow root (review L1) | The Root rendered into a shadow root: a `method="dialog"` submit is intercepted and closes through the Root (the listener sits on `getRootNode()`); with a document listener the submit never arrives and the dialog stays open. |
| Echo by source (review L4) | A re-open that becomes intended between the library's own `close()` and its `close` event (the controlled parent flips `open` back in that gap) is not superseded: the `close` event dispatches nothing. |
| Nested dialogs and the shared submit listener | An inner library-mode Root and, separately, an inner JS-free Root inside an outer library Popup: an inner `method="dialog"` submit closes the inner dialog only (through its own Root, or natively), the outer Popup's listener ignores it (`form.closest("dialog")` is the inner element) and the outer dialog stays open. |
| Form part | `method="dialog"` without `action`. **Library mode:** a submit (user-event click on the submitter) does not close natively: the `submit` event is default-prevented by the library, `openChangeAction(false, { reason: "activate", returnValue: submitterValue, event: SubmitEvent })` is called, `close(submitterValue)` after it resolves; a consumer `onSubmit` that calls `preventDefault()` keeps the dialog open and dispatches nothing; a submitter with `formMethod="dialog"` in a `method="post"`-less form behaves the same; a `method="dialog"` form rendered inside the Popup without `Dialog.Form` is intercepted too. **JS-free:** the shim closes natively, as today. With a function `action`: `method` absent, the action receives `FormData`, the settle close goes through the Root in library mode (`openChangeAction(false)` with the submitter's value, then `close(submitterValue)`; fake the status through a resolved `deferred()`) and through `close()` directly in JS-free mode; not called when it throws. `closeOnSettle`: a plain `Dialog.Form` closes on a `useActionState` validation result by default; with `false` the dialog stays open showing the result and a `Dialog.Close` closes it. Rendered as a `Form.Root` (`form.test.tsx`, #59): a result with errors keeps the dialog open and focuses the field; a clean settle resets and closes with `reason: "activate"` and the submitter's `value`; a hidden stale error neither closes, resets nor focuses; `closeOnSettle={false}` never closes; the reverse orientation (`<Form.Root render={<Dialog.Form />}>`) behaves the same; the composition without a function `action` warns in development. A close since the submit (Escape during the save, then a re-open through the Trigger) blocks the settle close: the dialog ends open, `close` not called again. `method="post"` is kept with a string `action` and replaced by `"dialog"` without one. |
| Foreign close command | A `command` event with `request-close` (and with `close`) dispatched on the dialog in library mode is default-prevented and dispatches `openChangeAction(false)` with `reason: "activate"`, `details.event` the `CommandEvent`, `returnValue` the source's `value`; `close(value)` after it resolves. JS-free: records the intent only (the shim closes). |
| Held content (jsdom) | A controlled close (`open` flipped to `false`) without `transition`: the children are still in the DOM inside the `close` spy (the close commit holds them), and gone after the `close` event with no animations (release is a normal update: assert no `startViewTransition` call with the jsdom stub, 10.1). With `transition="none"`: the children are gone inside the `close` spy. `keepMounted`: the `<Activity>` is visible inside the spy without `transition`. |
| Light dismiss (baseline) | With `lightDismiss`: a `pointerdown` + `click` on the dialog with coordinates outside `getBoundingClientRect()` (mocked) calls `requestClose`; inside, on a descendant, or a `pointerdown` inside followed by a `click` outside (drag out) does not; without the prop nothing. Non-modal: document pointerdown + click outside closes; a press + click on the Trigger closes too, `(false, "dismiss")`, and does not re-open (#116); JS-free mode, with and without the flag: closed, one `close` event, no `show()`; keyboard activation of the Trigger while open does nothing; a press on the Trigger that never became a click swallows no later keyboard open. |
| Focus | `initialFocus` ref/selector: the element has `autofocus=""` when `showModal` is called (spy inspects the DOM) and not afterwards; missing target warns. Opener removed: after `close`, if `activeElement` is inside the dialog the Trigger is focused when connected. |
| Mode guard | Changing Root from JS-free to library mode after mount warns; `transition` / `keepMounted={false}` in JS-free mode warn. |
| `transition` smoke | Popup renders with and without `transition`. **Browser:** a plain open calls `document.startViewTransition` zero times with `transition` absent **and** with `transition="none"` (the children mount under the `<dialog>`, which shields the boundary); a nested `Dialog.Root` mounted by a transition together with outer content, with `transition="none"` on its Popup, calls it once (conventions 10.1). |

### 13.3 Browser mode (`dialog.browser.test.tsx`, Chromium, Firefox, WebKit)

Only what jsdom cannot observe: a real `command="show-modal"` click opens the dialog modally in
JS-free mode and goes through the library in library mode (`details.event` is a `CommandEvent`
only for foreign invokers; the Trigger's own click is a `MouseEvent`); Escape closes and
`openChangeAction(false, { reason: "dismiss" })` fires; focus lands on the `initialFocus` target
through a deferred `showModal()` and returns to the Trigger on close; `aria-modal` is exposed;
nested dialogs need two Escapes; `closedby="any"` light dismiss with the flag where `closedBy`
exists and the JS fallback where it does not (branch on a feature check in `engine.ts`, assert
both); exit animation keeps the children mounted until `getAnimations()` settle in Chromium and
WebKit, and unmounts at once in Firefox (branch on whether `getAnimations()` is non-empty after
`close()`); the CSS scroll lock recipe; `<ViewTransition>` capture of the opening commit (the
unverified row of 10.3; the test may be marked expected-to-differ until confirmed).

ViewTransition rows for #46, modelled on `popover.browser.test.tsx`'s "ViewTransition
(browser)" block (spy on `document.startViewTransition`, record whether the dialog was `open`
at the start, click in-page outside `act`, await `finished` in `afterEach`), all three engines:

- `transition="pop"`: a Trigger open and a `Dialog.Close` close each run **one** view
  transition; the close's call starts with the dialog open and, at `ready`, the document has a
  `::view-transition-old` animation (the old snapshot carries the box out); after `finished` the
  dialog is closed and the content gone. Same for a `method="dialog"` submit and for a
  controlled `open={false}`.
- `transition="pop"`: an Escape runs one view transition only for the notification commit,
  with the dialog already closed at the start.
- `transition="pop"` plus the CSS exit of 10.1, no consumer rule (#147: the library's cut):
  an Escape runs no view transition (a fact, #148); a `Dialog.Close`, a `method="dialog"` submit
  and a controlled `open={false}` each have the dialog `display: none` at `ready`, the old image
  only and no inline `transition` left; the open has the dialog at opacity 1 at `ready` (no CSS
  enter under the view transition's); an Escape's CSS fade keeps running through an unrelated
  view transition. Pseudo-element names come from `document.getAnimations()` at
  `ready` (the dialog's group is `_t_N_`) and are reported in the failure message. In WebKit the
  names are not reliable (it lists the group's animation under `::view-transition-new(_t_N_)`
  while the box has no new image: a mislabel or a stale open animation, worth a look by someone
  with WebKit), so the WebKit branch asserts `display` only.
- The characterisation row without the recipe (a live new image in Chromium) was dropped with
  #147: there is no "without" any more. The rows fail in Chromium with the cut disabled.
- Without `transition`: no view transition for an open, a Close close or an Escape.
- `modal={false}`, `transition="pop"`, default mounting: a `Dialog.Close` activated with Enter
  returns focus to the Trigger (the close commit unmounted the focused button before `close()`;
  the platform restores nothing for a non-modal dialog). Also with `keepMounted`. Modal: the
  same row passes through the platform's restore and guards against a regression.
- A controlled close without `transition` and with the CSS exit: the content stays in the DOM
  through the fade and is not re-mounted (count the content's mounts with a ref callback: one).
- The `showModal()` top-layer capture of the **opening** commit (10.3's remaining check): with
  `transition="pop"`, the open's view transition has a `::view-transition-new` animation at
  `ready`; mark expected-to-differ per engine until confirmed rather than skipping.

---

## 14. Implementation notes

The overlay internals Dialog shares with Popover (`useOverlayRoot`, `renderOverlayContent`,
`useCloseHold`, `useInitialFocusTarget`, `returnFocusToTrigger`, `useOverlayClose`, the content
probe) are specified in popover.md 14; this section names where Dialog differs.

```
packages/ui/src/dialog/
  index.ts                 # no directive: namespace + type re-exports; imports platform-attributes for side effects
  dialog-context.ts        # "use client": DialogContext
  dialog-root.tsx          # "use client": useOverlayRoot<DialogOpenChangeDetails, HTMLDialogElement, [returnValue]> (Popover 14.1), the returnValue ref, context
  dialog-trigger.tsx       # "use client": button, commandfor/command, click interception
  dialog-popup.tsx         # "use client": <dialog>, native listeners, apply effect, mount reconciliation, held (useCloseHold), renderOverlayContent
  dialog-close.tsx         # "use client": useOverlayClose (the Close part shared with Popover.Close) with command "request-close" and the `value` key
  dialog-form.tsx          # "use client": form, method=dialog or action + FormStatusWatcher
  dialog-title.tsx         # "use client"
  dialog-description.tsx   # "use client"
  dialog.test.tsx
  dialog.browser.test.tsx
packages/ui/src/__tests__/dialog-shim.ts   # section 13.1
packages/ui/src/internal/use-overlay-root.ts, overlay-popup.tsx, use-overlay-close.ts, content-focus-probe.tsx   # shared with Popover (popover.md 14)
```

- **Every part file is `"use client"`.** Trigger, Popup, Close, Form, Title and Description read
  context (ids, mode, dispatch); Root creates it. No directive-free part (same reasoning as
  Accordion 12 and Tooltip 2.4). The Directive test row lists all eight modules; `index.ts` is
  directive-free.
- **Context.** `{ mode: "static" | "library", ids: { popup, title, description }, modal,
  committed, optimistic, pending, intended(), requestOpen(event, reason), requestClose(event,
  reason, returnValue), notifyClosed(event, reason, returnValue) (called only for closes the
  library did not cause: the `close` listener returns first on the `libraryClose` echo),
  takeCloseReturnValue(),
  latestInFlight, triggerRef, popupRef (RefObject<HTMLDialogElement | null>),
  recordCloseIntent(intent | undefined), takeCloseIntent(), openGeneration(),
  nextOpenGeneration() }`. `intended()` is `latestInFlight()?.next ?? committedOptimistic`,
  the optimistic value of the last commit kept in a ref written in `useInsertionEffect`
  (Popover 14.1, review L2), so a Close action's continuation after an `await` reads the current
  value. `requestClose` (2.3): library mode and `intended()` → store `returnValue` in the Root's
  pending-return-value ref, `dispatch(false, createActionDetails(event, { reason, returnValue
  }))`. `takeCloseReturnValue()` reads and clears that ref (the apply effect's `close(v)`); the
  insertion effect also clears it whenever `optimistic` is `true` (a veto or a re-open made it
  stale). `openGeneration` reads a counter the Root bumps on every open (3.4); `Dialog.Close`
  passes it to `useActionTrigger`. The object is `DialogContextValue extends
  OverlayRootValue<HTMLDialogElement, [returnValue: string]>` plus `modal`, the recording
  `requestClose` and `takeCloseReturnValue`, memoised on the shared root value and `modal`.
  `popupRef` is how Close and Form reach the dialog element in
  JS-free mode for `close(value)` without a second registry; it is set by the Popup's callback
  ref.
- **Mode detection** once, from the first render's props, in a `useState` initialiser; warn on
  change (Accordion pattern); inside `useOverlayRoot`.
- **Root.** `useOverlayRoot<DialogOpenChangeDetails, HTMLDialogElement, [returnValue: string]>({
  component: "dialog", part: "Dialog.Root", open, defaultOpen, openChangeAction, details:
  dialogDetails, isShown: isDialogOpen })` (Popover 14.1: the shared Root machinery, which calls
  `useControllableAction<boolean, DialogOpenChangeDetails>` with `transitionTypes("dialog", next
  ? "open" : "close")` and `warn: { component: "Dialog.Root", prop: "open" }`).
  `dialogDetails(event, reason, returnValue)` builds `createActionDetails(event, { reason,
  returnValue })` (an open passes no `returnValue`, so the key is own with value `undefined`);
  `isShown` reads `dialog.open` because the hook's default `:popover-open` is wrong for a
  `<dialog>` (the stale close-intent clear of 2.3). In static mode the hook is still called (hooks cannot be conditional) with
  `action: undefined` and never dispatched. The trigger element is kept in a `useRef`, written by
  the Trigger's callback ref (no state, read only in the `close` listener's focus fallback).
- **Trigger.** `libraryProps`: `type` via `rendersButton(render)`, `commandfor: modal ? dialogId
  : undefined`, `command: modal ? "show-modal" : undefined`, `onClick` installed (and owned) only
  when `mode === "library" || !modal`, `disabled` (owned), `data-open`, `data-pending`,
  `data-disabled`. `state.pending` is `root.pending` (4.2). Static non-modal click:
  `popupRef.current?.show()`. The `disabled` prop goes through `disabledButton` (conventions
  1.2; `handlesClick` is whether the click is installed, `invoker` gates `commandfor` / `command`).
- **Popup, listeners.** All native, attached in one effect through the ref (conventions 7.4), each
  filtered on `event.target === dialog` (React still emulates bubbling for `toggle`, and `command`
  / `submit` bubble from descendants by design):
  - `command`: `show-modal` in library mode → `preventDefault()` + `requestOpen(event,
    "activate")`; `request-close` / `close` in library mode → `preventDefault()` +
    `requestClose(event, "activate", source.value ?? "")` (`event.source` is the invoker; the
    jsdom invoker shim sets it); in static mode `request-close` / `close` →
    `recordCloseIntent({ reason: "activate", event })` only.
  - `submit`, **on the dialog's root node, bubble phase** (`dialog.getRootNode()`: the
    document, or the shadow root the dialog lives in, since `submit` is not composed, review L1;
    after React's root `onSubmit`; filtered to a form whose `closest("dialog")` is this dialog):
    if `form.method === "dialog"` or the submitter's `formmethod` attribute is `dialog`: library
    mode → return if `event.defaultPrevented` (the consumer blocked the submission) or if
    `event.cancelBubble` (the consumer's `stopPropagation()`; checked explicitly because React's
    root can be this same node, FUNSTACK Static, where `stopPropagation()` does not stop this
    listener, review M3), else `preventDefault()` + `requestClose(event, "activate",
    submitter?.value ?? "")`; static mode → record the `"activate"` intent as before (a
    dialog-level listener is fine for static mode; one root-node listener serving both keeps the
    code in one place).
  - `beforetoggle` (synchronous): `newState === "closed"` → set `awaitingClose` (the re-open race
    guard, 2.5); `newState === "open"` → `nextOpenGeneration()` (3.4) and clear
    `dismissedWhilePending` (a re-open supersedes a stored dismissal, 11.13). No `cancel` listener:
    stale intents are cleared by the `setTimeout(0)` scheduled at `recordCloseIntent`, which
    clears only while the dialog is still open (2.3).
  - `close`: clear `awaitingClose`, focus fallback (6.2 rule 1), `intent = takeCloseIntent()`,
    `echo = libraryClose.current` (consumed: echo by source, review L4), then in library mode:
    if `!echo || transition === undefined` read `exitAnimations(dialog)` and `holdUntil` /
    `release` (4.4); then, unless `echo`: `takeCloseReturnValue()` (a pending part's value is
    dropped), and `intended()` ? `notifyClosed(intent?.event ?? event, intent?.reason ??
    "dismiss", dialog.returnValue)` : `dismissedWhilePending = { event, returnValue, generation:
    openGeneration() }` (a part's close is in flight, 11.13). In static mode nothing else.
  - `keydown` Escape (non-modal only, no `closedBy` support or flag off) → `preventDefault()` +
    `requestClose()`, unless the Escape belongs to an inner layer (section 9): walking from
    `event.target` up to the dialog finds an open `<dialog>` or an open `auto` / `hint` popover,
    or any `[popover]` inside the dialog is an open `auto` / `hint` one (`:popover-open`; the
    state is read through the `popover` IDL attribute so an engine that maps `hint` to `manual`
    is honoured, with the attribute as the fallback where the IDL is missing). Then the event is
    left untouched for the inner layer's close watcher.
  - `pointerdown` + `click` (`lightDismiss`, no native `closedby`): modal → both on the dialog
    with the point outside its rect (`::backdrop`) → `requestClose()` on the click; the
    `pointerdown` sets a `pressedOutside` flag the `click` consumes. Non-modal → document-level
    capture listeners for both while open, outside meaning "not inside the dialog and not inside
    the Trigger". They are installed and removed from a **native** `toggle` listener on the
    dialog (the React `onToggle` prop never fires after hydration, a native listener does),
    reading `dialog.open` rather than `newState` (coalescing rule) and guarding every decision
    on `dialog.open`, as the Tooltip effect does with `:popover-open`.
- **Popup, refs.** `awaitingClose` (2.5), `libraryClose` (set right before the apply effect's
  own `close()`, consumed by the `close` listener), `dismissedWhilePending` (`{ event,
  returnValue, generation } | null`: a dismissal recorded while a part's close was in flight;
  cleared on `beforetoggle` open, when the close settles as `false`, and when consumed).
- **Popup, effects.** (1) Mount reconciliation layout effect (2.4), once. (2) The apply effect
  (2.5) after every commit: open as before, except that with committed `true`, the dialog closed
  and a `dismissedWhilePending` record of the current open generation, it dispatches
  `notifyClosed(record.event, "dismiss", record.returnValue)` instead of `showModal()` (11.13);
  the close branch sets `libraryClose` and calls `close(takeCloseReturnValue())`; the focus
  return right after `close()` when the content probe fired (6.2 rule 2); the record is dropped
  when committed is `false` with nothing in flight; and the `held` release rule (4.4). (3)
  `initialFocus` write inside (2) right before `show*()`, removal right after. (4) The listener effect above, re-subscribed when the element
  changes. (5) `held` (4.4, `useCloseHold(committed, isLibrary, transition)` over
  `useExitAnimation`, shared with `usePopoverPopup`): `holdDuringRender()` when committed flips
  `true → false` in library mode with `transition === undefined` (the previous-committed
  pattern), `afterClose(dialog, echo)` in the `close` listener, `releaseIfIdle` in the apply
  effect.
- **Popup, rendering.** `<dialog id … aria-labelledby aria-describedby closedby={flag ?
  (lightDismiss ? "any" : "closerequest") : undefined} data-modal
  suppressHydrationWarning>{content}</dialog>`, wrapped in `<ViewTransition default={transition}>`
  only when `isLibrary && transition !== undefined` (conventions 5.1), where `content` is
  `renderOverlayContent({ isLibrary, keepMounted, visible, wrapContent }, () => children)`
  (`internal/overlay-popup.tsx`, shared with `usePopoverPopup`): static mode → children; library
  `keepMounted` → `<Activity mode={committed || held ? "visible" :
  "hidden"}>{wrapContent(children)}</Activity>`; library default → `committed || held ?
  wrapContent(children) : null`, where `wrapContent` is the content probe of
  `useContentFocusProbe(popupRef)` (`src/internal/content-focus-probe.tsx`, 6.2 rule 2), all
  under `<ToolbarContext value={null}>` so the content is outside an enclosing Toolbar. `closedby` is typed in `@types/react` 19.3 (research) and needs no
  augmentation; `commandfor` / `command` on the buttons are already in `platform-attributes.ts`.
- **Close.** Rendered by `useOverlayClose` (`internal/use-overlay-close.ts`, the one Close part
  of Dialog and Popover) with `command: "request-close"`, `ownProps: { value }` and Dialog's
  `close` / `details` callbacks. `libraryProps`: `type`, `disabled` (owned, through
  `disabledButton` with `handlesClick` = `isLibrary || action !== undefined`, conventions 1.2),
  `commandfor: popupId`, `command: "request-close"`, `value`, `onClick` when `isLibrary ||
  action !== undefined`, `aria-disabled` while pending, `data-pending`, `data-disabled`. `const
  { pending, run } = useActionTrigger({ openGeneration: root.openGeneration })` (conventions
  3.4; shared with `Popover.Close` and `Menu.Item`). The click always `preventDefault()`s (library mode, or with `action`) and
  returns when `disabled`. `close(native)` is: library mode → `ctx.requestClose(native,
  "activate", value ?? "")`; static mode (only reachable with `action`) → `if (dialog?.open)
  { recordCloseIntent({ reason: "activate", event: native }); dialog.close(value ?? ""); }`.
  Without `action` the click calls `close(native)` at once; with `action`, `run(() =>
  action(details), () => close(native))`. Errors: the latest click's rejection takes React's
  route to the boundary. A Close has no superseded run since #81 (one run at a time); the hook
  would pass such a rejection to `reportError` (conventions 2.4, #145; until then it was thrown
  from the part's render, ac7064e). `then` is skipped when the open generation changed (3.4) and
  still runs after the part unmounted (`requestClose` finds `false` intended, or the dialog is
  closed: a no-op either way). The non-button dev warning fires only in static mode without
  `action`, as `Popover.Close`.
- **Form.** `libraryProps`: `method: action === undefined ? "dialog" : typeof action ===
  "string" ? method : undefined`, `action`. Renders `<form …>{resolvedChildren}<FormStatusWatcher
  /></form>` (the watcher only with a function `action`); the watcher is a `null`-rendering
  component that calls `useFormStatus()`, keeps the previous `pending` in a ref and, in an effect
  on `true → false`, calls the Form's `onSettled`, which returns early when `closeOnSettle` is
  `false`, when the dialog closed since the last `submit` (a `closedSinceSubmit` ref set by a
  `close` listener on `form.closest("dialog")` and reset by the capture `submit` listener),
  when the result has a field error (#59: the watcher is rendered through a `DialogFormSettle`
  child that reads `use(FormContext)` and passes `clean = form === null ||
  !hasAnyError(form.errors)`; the child is always rendered so it can also issue the dev warning
  for a `Form.Root` composition without a function `action`, and renders the watcher only with
  one), or
  when the dialog is not open, and otherwise closes: library mode → `ctx.requestClose(submitted
  ?.event, "activate", submitted?.returnValue ?? "")`; static mode → records the intent and calls
  `close(submitterValue)`. The submitter's `value` comes from that native `submit` listener on
  the form (capture) set up in the same part. The `method="dialog"` interception lives in the
  Popup, not the Form (8.1): the Form adds nothing for it. `DialogFormState.pending` is read by
  the watcher and lifted through a tiny context for the `className` / `children` functions of
  the Form itself (one extra render when pending changes; acceptable).
- **Title / Description.** `libraryProps: { id }`; `h2` / `p` defaults.
- **Dev warnings** (`useDevWarning`; `useJsFreePropWarnings` for the static-mode props,
  `useElementCheck` for the element, `useShownNameWarning` for the name; each once per instance,
  conventions 7.2): mode change; `transition` / `keepMounted={false}` in static
  mode; wrong `tagName` behind `render`; no name on the dialog; `initialFocus` unresolved or
  outside the dialog; Trigger without a Popup (checked in the Trigger's effect through
  `document.getElementById(dialogId)`); a second Trigger in one Root (once per Root,
  `registerTrigger`, popover.md 14.2 item 7, #113 API3). A part rendered outside a `Dialog.Root` **throws** (no
  context), consistent with Tabs and Tooltip, rather than warning.
- **Implementation checks** (example app, all three engines; resolved: `getAnimations({ subtree:
  true })` lists `::backdrop` in Chromium, 4.4): the top-layer `<ViewTransition>` capture of the
  opening commit (10.3) and of the closing commit after `showModal()` (the browser rows of 13.3
  make the latter a CI assertion); that `setAttribute("autofocus")` immediately before
  `showModal()` is honoured by WebKit (research verified Chromium and Firefox only); that a
  `close` event fired for a removed dialog (unmount while open) is handled without touching a
  disconnected element.

---

## Amendment: library-owned part-initiated closes (2026-10-17, issue #46)

Follow-up from the Popover design (#38, product-owner question 2): Popover made the closes its
parts initiate library-owned so the `<ViewTransition>` exit runs in every engine, and Dialog,
whose close was entirely browser-owned, is brought to the same line. Conventions 3.5 (amended
with this document) names the rule: a component may own the closes its parts initiate where the
platform step it cancels is freely cancelable, and leaves dismissals to the browser.

### What changed, in one table

| | Before (#26 as accepted) | After (#46) |
| --- | --- | --- |
| `Dialog.Close` without `action`, library mode | native `request-close`; `close` event → notification | click cancelled; `openChangeAction(false)` awaited; `close(value)` in the close commit's layout effect; view transition if `transition` is set |
| `Dialog.Close` with `action` | action, then `close(value)`; notification | action, then `requestClose`; as above |
| `Dialog.Form` `method="dialog"`, library mode | native submit closes; notification | `submit` intercepted after the consumer's `onSubmit`; as above with the submitter's `value` |
| `Dialog.Form` function `action`, settle close | watcher `close(value)`; notification | watcher `requestClose`; as above |
| Foreign `request-close` / `close` invoker, library mode | intent recorded; notification `"activate"` | command cancelled; as above (mirrors the foreign `show-modal` interception) |
| Controlled `open={false}` | apply effect `close()`; content unmounted in the commit (empty CSS fade, then a re-mount by `exiting`) | apply effect `close("")`; content held through the fade without `transition`, captured by the view transition with it |
| Escape, back, AT dismiss, light dismiss, script, JS-free mode | browser; notification `"dismiss"` | unchanged |
| Controlled parent keeps `open` after a part's close | re-opens (not a veto) | snap-back, the dialog stays open (a real veto); a refused *dismissal* still re-opens |
| `held` release after a CSS exit | `startTransition` (a second view transition with `transition` set) | normal update (Popover review M1) |
| Focus after a close whose commit unmounted the focused content | n/a | Popover's content probe and 6.2 rule 2 (matters for non-modal dialogs) |

No public prop was added or removed. Changed doc comments: `openChangeAction` (3.1),
`transition` (3.3), `Dialog.Close action` (3.4), `Dialog.Form action` (3.5). Changed context
(14): `intended`, `requestClose`, `takeCloseReturnValue`. The jsdom shim needs nothing new
beyond `event.source` on the emulated `command` event (check `invoker-shim.ts`; the design
expects it set to the invoker).

### Trade-offs stated

- **A Close now waits for `openChangeAction(false)`.** Before, the dialog closed at once and the
  action ran afterwards; now a slow action keeps the dialog open with the Trigger and the Close
  pending. This is the same trade Popover made and the price of an animatable, vetoable close.
  A consumer whose close action is slow and must not delay the close runs it from the
  notification instead: dismiss-style closes are still immediate, and an `openChangeAction`
  that only `setOpen(next)`s in its sync prefix costs one commit.
- **A `method="dialog"` form is intercepted in library mode.** The platform's "submit closes" is
  replaced by the library's close with the same `returnValue`. A consumer who wants the native
  close back has JS-free mode, or `stopPropagation()` in `onSubmit` (documented as the opt-out;
  honoured through `event.cancelBubble`, because React's root may be the same node the listener
  is on, 8.1).
- **Dismissals still animate with CSS only.** In Firefox an Escape closes a dialog instantly,
  as before; only the closes a part asks for get the view transition. The docs say which is
  which, and the `::backdrop` note in 10.3 explains why a backdrop fade needs either the root
  cross-fade or an element backdrop. The CSS exit is kept next to `transition`; the library cuts it
  around its own close while a view transition runs (10.3, #147), so the two never show a double
  image in Chromium.
- **Not changed:** the Trigger stays open-only (no `toggle` command for dialogs, and a modal
  dialog's Trigger is inert while open); `Dialog.Form` keeps `closedSinceSubmit` rather than the
  open-generation guard (it already covers the re-open case and reads the `close` event the Form
  listens to anyway).

### Implementation notes for the developer

Order of work that keeps the test suite green between steps:

1. **Shared internals.** Extract `ContentFocusProbe` + `wrapContent` from
   `use-popover-popup.ts` into `src/internal/content-focus-probe.tsx` (no behaviour change for
   Popover and Menu; today `useContentFocusProbe`). `useExitAnimation` and `exitAnimations` are already shared.
2. **Root** (`dialog-root.tsx`): `committedOptimistic` ref (`useInsertionEffect`), `intended()`
   from it; `requestClose(event, reason, returnValue)`; `closeReturnValue` ref +
   `takeCloseReturnValue()`, cleared in the same insertion effect when `optimistic` is `true`;
   context additions (14). `notifyClosed` unchanged.
3. **Popup** (`dialog-popup.tsx`): replace `exiting` with `useExitAnimation` (`held`,
   `holdDuringRender` during render when `transition === undefined`, `holdUntil` / `release`
   in the `close` listener with the echo check, the release rule and the content-probe focus
   return in the apply effect; `visible = committed || held`); the apply effect's close branch
   passes `takeCloseReturnValue()`; the `command` listener cancels `request-close` / `close` in
   library mode and calls `requestClose` with `event.source?.value`; the `submit` listener moves
   to the document (bubble; since review L1 the dialog's root node) and, in library mode, cancels
   and calls `requestClose` unless `defaultPrevented` (or `cancelBubble`, review M3). Keep
   every `event.target` / `closest("dialog")` filter. Update the `transition` and part doc
   comments.
4. **Close** (`dialog-close.tsx`): `onClick` installed in library mode or with `action`;
   library mode → `requestClose`; static + action → the current direct `close()`. Dev warning
   only in static mode without `action`.
5. **Form** (`dialog-form.tsx`): `onSettled` → `requestClose` in library mode.
6. **Tests**: the rows in 13.2 and 13.3. Existing rows that change expectation: "close:
   request-close from the Close part is 'activate' with the button's value" (now via the
   click handler; assert `openChangeAction` is called before `close`), the Close-part rows
   (`close(value)` only after `openChangeAction` resolved; the Trigger pending meanwhile), the
   Form settle rows, the controlled-close echo row (the `close` spy receives `""`), and the
   browser "exit animation" row (unchanged for Escape; add the controlled-close variant).
7. **Docs and example**: `packages/docs/src/pages/DialogPage.tsx` (the Popup `transition` prop
   row, the `openChangeAction` row, the Close `action` row, the "Enter and exit" prose, the
   "Browser-owned state" summary), `packages/docs/src/pages/BrowserOwnedStatePage.tsx` ("Dialog:
   library-owned open, browser-owned close" → "parts vs dismissals", as the Popover entry),
   `packages/docs/src/examples/DialogOrders.tsx` or a new example with `transition` showing the
   exit (and the `::view-transition-old(.…)` CSS with the reduced-motion block), and the
   playground's `dialog-demo.tsx`. Conventions 3.5 is already amended.

Things to verify in a real engine before calling it done (14, implementation checks): the
closing capture after `showModal()` in all three engines (the 13.3 rows); that `close()` inside
the view transition's update callback restores focus to the Trigger in WebKit as in Chromium
and Firefox; that `event.source` is populated on a `CommandEvent` for a foreign `request-close`
in every engine (Safari 26.5+ per the Popover notes; fall back to `""` when absent).

### For the product owner

1. **The `method="dialog"` interception** (8.1) goes one step beyond Popover's precedent (Popover
   has no Form). The alternative, leaving `method="dialog"` browser-owned, would make an "OK"
   submit button and a `Dialog.Close` differ in animation and vetoability inside the same form.
   Recommendation: intercept, with `stopPropagation()` in `onSubmit` as the documented opt-out.
2. **Foreign `request-close` / `close` invokers are intercepted** (2.3) where Popover leaves a
   foreign `hide-popover` browser-owned. Reason: Dialog already intercepts a foreign
   `show-modal`, and `Dialog.Close` renders exactly that markup, so "same markup, same
   behaviour" wins. Recommendation: intercept; revisit Popover for symmetry when it next changes.
3. **A controlled parent can now veto a part's close** (snap-back) while a refused dismissal
   still re-opens. This is Popover's behaviour and the conventions' rule, but it changes what
   the Dialog docs told controlled consumers ("adopt `false` unconditionally"). Recommendation:
   accept; the docs will phrase it as "adopt a dismissal's `false` unconditionally; a part's
   `false` is yours to refuse".

**Accepted by the product owner (2026-10-17):** all three recommendations as written: intercept `method="dialog"` (opt out with `stopPropagation()`), intercept foreign `request-close` / `close` invokers, and the controlled snap-back veto for part closes. Popover symmetry for foreign `hide-popover` is a later follow-up.

## Review corrections (2026-10-17, from the Menu review)

From `memo/reviewer/menu.md` (review of #41 / #47, which moved the Close part onto the shared
hook); folded into the sections named.

| Item | Correction | Section |
| --- | --- | --- |
| M2 | `Dialog.Close` drops a stale close: the Root carries an open-generation counter (bumped on the open dispatch and on the Popup's native `beforetoggle` to open, synchronous inside `showModal()` / `show()`; `toggle` is queued and arrived too late, 03ab818) and the Close passes it to `useActionTrigger`, as `Popover.Close` does (02f2f42). Load-bearing for JS-free / native re-opens; in library mode React's entanglement already holds the re-open. | 3.4, 13.2, 14 |
| L2 | The Close part runs through the shared `useActionTrigger` (ac7064e); the superseded-rejection gap recorded for v0 is closed. | 3.4, 14 |

## Review corrections (#46, 2026-10-18)

From `memo/reviewer/dialog-46.md` (review of the #46 implementation, commits 4e6b9f2..7258b53)
and the developer's fix notes in `memo/developer/dialog.md` "#46 review fixes"; code and jsdom
rows in 56e1ea8, recipe, docs and browser rows in 5dcce5f, the WebKit correction in bcdb7e1. M1
was decided by the product owner (option a). Each item is folded into the sections named; this
table is the audit trail.

| Item | Correction | Section |
| --- | --- | --- |
| M1 | A dismissal that lands while a part's close is in flight is remembered (`dismissedWhilePending`: event, `returnValue`, open generation) instead of being lost. If that close settles vetoed (committed `true`, the dialog closed, nothing in flight), the apply effect sends the stored dismissal as `openChangeAction(false, { reason: "dismiss" })` instead of re-opening with `showModal()`; the dialog stays closed. A parent that refuses the dismissal too gets the usual re-open; a Trigger re-open in between bumps the generation and supersedes the dismissal. Before: the veto re-opened a dialog the user had dismissed and the parent never heard of the dismissal. | 2.3, 2.5, 11.13, 11.14, 13.2, 14 |
| M2 | With `transition` plus the 10.1 CSS exit, Chromium keeps a closed dialog rendered through its fade and the close's view transition captures it as a live `::view-transition-new` next to the `old` image (a double image), for part closes and for dismissals whose notification commit lands inside the fade. The 10.3 table row "nothing visible to animate" was wrong for a CSS exit. Recipe: keep the CSS exit and add `html:active-view-transition .dialog { transition: none; }`, untyped on purpose (a controlled close carries no types); cost: an unrelated page view transition also cuts a fade. Chromium-only: Firefox has no CSS exit, WebKit has the box `display: none` by `ready`. Replaces "at most a CSS exit for dismissals". Popover's recipe had the same artifact and gets the same rule. | 10.3, 13.3, Amendment trade-offs; popover.md 10.2, 13.3 |
| M3 | The `stopPropagation()` opt-out did nothing when React's root is the document (FUNSTACK Static `hydrateRoot(document, …)`): the library's listener is on the same node, which `stopPropagation()` does not stop. The listener now also returns on `event.cancelBubble`. | 8.1, 14, Amendment trade-offs |
| L1 | The `submit` listener is on `dialog.getRootNode()` (the document, or the shadow root the dialog lives in; `submit` is not composed), still after React's container. | 8.1, 14 |
| L2 | `closeOnSettle` doc: "a submit button in a separate `method="dialog"` form". A `formMethod="dialog"` submitter inside a Form with a function `action` re-runs the action (React prevents every submit of such a form) and never closes. | 3.5, 8.1 |
| L3 | A dismissal during an in-flight part close with `transition` set was treated as an echo and not held; fixed with L4 (the hold is skipped only for a real echo). Moot with the M2 recipe, correct without it. | 4.4 |
| L4 | The library's own `close()` is recognised by source (the `libraryClose` marker set in the apply effect, consumed by the `close` listener), not by `!intended()`, so a re-open that becomes intended in the task between `close()` and its `close` event is not superseded. A browser close drops a pending part's `returnValue` (`takeCloseReturnValue()`), so it cannot be applied to a later close. `notifyClosed` is called only for closes the library did not cause. | 2.3, 2.5, 4.4, 14 |
| L5 | jsdom rows for reviewer P2 (re-open during a pending part close, uncontrolled), walkthrough 11.16, a Close `action` plus a controlled veto, nested library / JS-free inner Roots with the shared submit listener; browser rows assert the pseudo-images (old only with the recipe; the characterisation row pins the double image without it in Chromium). | 13.2, 13.3 |
| WebKit | The 5dcce5f commit message said WebKit also shows the double image; CI showed the box is `display: none` at `ready` there with or without the recipe, and that WebKit's `getAnimations()` pseudo-element names are unreliable (the group's animation listed under `::view-transition-new`). Docs and this design name Chromium only; the WebKit rows assert `display`. | 10.3, 13.3 |

---

## Dialog.Form and Form.Root (#59)

Status: **accepted and implemented** (2026-10-18; accepted in 6d13aa2, implemented in 32611fd
with the docs in 8cbde22, folded into row 9, 3.5, 8.1, 13.2 and 14 the same day; see
"Implementation deviations" at the end of this section). Follow-up from the Field and Form design (#54, product-owner
item 9): now that `Form.Root` exists, should `Dialog.Form` gain `errors` / `autoReset` of its own
and close only on a settle with no errors? Inputs: field-form.md 3.1 to 3.4 and walkthrough 11,
this document's 3.5 and 8.1, `packages/ui/src/dialog/dialog-form.tsx`,
`packages/ui/src/form/form-root.tsx`, `internal/merge-props.ts` (the owned-key rule), and the
`form.test.tsx` rows "Dialog.Form render={<Form.Root errors />}". Notes in
`memo/architect/dialog-form-59.md`.

### Recommendation

**No new props on `Dialog.Form`.** The composition through `render` stays the one shape, and
`Dialog.Form`'s settle close becomes **error-aware**: when the form is rendered as a `Form.Root`,
`closeOnSettle` closes on a settle **with no errors** (the predicate `autoReset` already uses),
and a settle that reports errors keeps the dialog open while the Form focuses the first errored
field. The consumer no longer writes `closeOnSettle={false}` and a close of their own:

```tsx
// Before (#54, walkthrough 11): three things to remember, and "close it yourself on success".
<Dialog.Form action={dispatch} render={<Form.Root errors={state.errors} />} closeOnSettle={false}>

// After: the composition is the whole recipe. Errors keep the dialog open; a clean settle closes it.
const [state, dispatch] = useActionState(saveProfile, {});

<Dialog.Popup>
  <Dialog.Title>Edit profile</Dialog.Title>
  <Dialog.Form action={dispatch} render={<Form.Root errors={state.errors} />}>
    <Field.Root name="email">
      <Field.Label>Email</Field.Label>
      <Field.Control type="email" required />
      <Field.Error />
    </Field.Root>
    <Dialog.Close value="cancel">Cancel</Dialog.Close>
    <Form.Submit value="save">Save</Form.Submit>
  </Dialog.Form>
</Dialog.Popup>
```

Three outcomes of a submission, one rule each:

| The action | What the user sees | Who decides |
| --- | --- | --- |
| throws | the dialog stays open; the nearest Error Boundary shows the error (8.1, unchanged) | React |
| returns errors (`state.errors` has a non-empty entry) | the dialog stays open, the typed values stay, the first errored field is focused, nothing is reset | `Form.Root` (3.2 of field-form.md); `Dialog.Form` skips the close |
| returns no error (a clean settle) | `Form.Root` resets the form (`autoReset`), `Dialog.Form` requests the close through the Root (`openChangeAction(false)` awaited, `reason: "activate"`, `returnValue` = the submitter's `value`, view transition if set) | both, in that order |

### Why not `errors` / `autoReset` on `Dialog.Form`

1. **It would make `Dialog.Form` a second `Form.Root`.** The errors channel is not one prop: it
   is the `FormContext` the Fields register with, the intercepted submit (`Form.Root` runs the
   action itself so React's automatic reset does not wipe a rejected form), the settle effect
   (focus the first errored field, `ariaNotify` when focus is already there, the stale-value
   suppression against the submitted `FormData`) and `autoReset`. Either `Dialog.Form`
   duplicates that, or it renders a `Form.Root` internally and re-declares every `Form.Root`
   prop, today `errors` and `autoReset`, tomorrow whatever #54's "not in v1" list adds. Two
   prop surfaces for one policy is the maintenance cost conventions 1.2 introduced `render` to
   avoid: "this part is also that element" is what `render={<Form.Root />}` says.
2. **The call-site saving is one attribute.** `errors={state.errors}` versus
   `render={<Form.Root errors={state.errors} />}`. What walkthrough 11 actually complained
   about was the rest of the line, `closeOnSettle={false}` plus a hand-written close on success,
   and that is removed by making the settle close error-aware, not by moving `errors`.
3. **Two policies on one form would need a precedence rule.** With both a built-in `errors` and
   a `render={<Form.Root errors />}` the form would have two errors channels; the only honest
   answer is "do not do that", which is a dev warning for a problem the composition does not
   have.
4. **The plain `Dialog.Form` keeps its place.** Without a `Form.Root` it is React's own form
   (React runs the action, React resets, 8.1): the right thing for the confirm dialog, the
   Server Component dialog, and a form with no fields to validate. The `dialog` subpath stays
   free of the Field machinery, and 8.1 does not change.
5. **Prior art composes.** None of Radix, Base UI, React Aria or Ark gives a dialog a form part
   with error routing; the form is composed in. The library's `Form` part exists for the close
   (conventions 1.1), not for validation.

Alternatives considered and rejected:

- **A third `closeOnSettle` value** (`"clean"`, or a rename to `closeOnSuccess`). Toast uses
  `closeOnSettle` for the same "the action resolved" idea, and a third value would exist only
  to describe a composition the part can detect exactly (below). Without a `Form.Root` there is
  no errors channel, so every settle that does not throw *is* clean: the error-aware rule is
  the same rule, not a mode switch.
- **`Form.Root` closing the dialog itself** (a `Form.Root` inside a Popup asking the Dialog
  context to close). It would couple the `form` subpath to Dialog and give the plain
  `<Form.Root>` inside a Popup (not rendered through `Dialog.Form`) a close it never advertised.

### The rule, precisely

`Dialog.Form` detects the composition through the **`FormContext`**: `Form.Root` provides it,
and the `render` composition renders `Dialog.Form`'s children (its status watcher included)
inside the cloned `Form.Root`, so a child of `Dialog.Form` reads the context exactly when the
form is a `Form.Root`. No import of `Form.Root` into the `dialog` subpath, no element-type
check, and the reverse orientation (`<Form.Root render={<Dialog.Form />}>`) is detected the same
way (its children are inside the context too); the documented shape stays
`Dialog.Form render={<Form.Root />}`.

```
settle (useFormStatus true → false, the watcher's edge)
  closeOnSettle === false            → nothing (unchanged)
  closedSinceSubmit                  → nothing (8.1, unchanged)
  form context present
    && hasAnyError(context.errors)   → nothing: Form.Root focuses the first errored field
  otherwise                          → requestClose(submitEvent, "activate", submitter.value)   (library mode)
                                       recordCloseIntent + dialog.close(value)                 (JS-free mode)
```

`hasAnyError` is `Form.Root`'s own predicate (`internal/validity.ts`): any non-empty entry in
`errors` at the settle commit, **hidden stale ones included**. That is deliberate: a result that
flags only a value the user replaced during the flight (field-form.md walkthrough 5) resets
nothing and focuses nothing, and it must not close the dialog either; the user resubmits the new
value. One predicate for "reset" and "close" means the two never disagree.

Both watchers see the same edge in the same commit (verified for #54, walkthrough 11) and read
the same `errors` (the context value of the settle render; `Form.Root` reads it through `latest`
in its own effect). Effect order in that flush: `Dialog.Form`'s watcher runs **before**
`Form.Root`'s (it is among the children `Form.Root` renders ahead of its own watcher), so the
close is requested before the reset. Nothing depends on that order; it is recorded so nobody
starts to.

**Reset before exit.** On a clean settle `Form.Root` calls `form.reset()` in that same effect
flush, and the close commit lands later (after `openChangeAction(false)`), so the exit
animation (CSS or view transition) shows the fields at their defaults, exactly as React's own
path already does for a plain `Dialog.Form` (8.1, "React's automatic form reset after a
successful action runs before the close"). With the default content mounting the next open
mounts fresh fields anyway, so a consumer whose exit is visible passes `autoReset={false}` on
the `Form.Root` element; with `keepMounted` the reset is what makes the next open clean, keep
the default. Not automated: `Dialog.Form` would have to inject a `Form.Root` prop into the
`render` element, Form-specific knowledge in a part that otherwise only reads a context.

**Composition without a function `action`** is a mistake the library now names.
`<Dialog.Form render={<Form.Root />}>` with no `action` loses `method="dialog"`: `Dialog.Form`
passes it to the cloned element, but `Form.Root` owns `method` (except with a string `action`)
and its owned `undefined` removes it (`merge-props.ts`), leaving a GET-navigating form that
reloads the page on submit. A development warning from the same context-reading child:
"`Dialog.Form` rendered as a `Form.Root` needs a function `action`; without one the form
navigates instead of closing the dialog. Render a plain `<Dialog.Form>` for a `method="dialog"`
form." A string `action` is a navigating form in both parts and needs no warning.

What does **not** change: 8.1 for a plain `Dialog.Form` (React's path, every settle closes,
throw to keep open), `closeOnSettle={false}`, `closedSinceSubmit`, the `returnValue` from the
capture `submit` listener (the native event reaches it before `Form.Root`'s `onSubmit`
cancels React's path), the Popup's root-node `submit` listener (the form's method is React's,
not `"dialog"`, so it returns), and the JS-free mode (`Form.Root` intercepts only after
hydration; before it the Server Function posts with progressive enhancement, as today).

### Prop doc, after

```ts
  /**
   * With a function `action`: close the dialog once the action's transition settles without
   * throwing and, when this form is rendered as a `Form.Root`
   * (`render={<Form.Root errors={state.errors} />}`), with no field error: a settle whose
   * `errors` has a non-empty entry (hidden stale ones included, the `autoReset` rule) keeps
   * the dialog open and the Form focuses the first errored field. Default `true`.
   *
   * Without a `Form.Root` the library never sees a result, so any settle that does not throw
   * counts, including a `useActionState` result that reports errors: render the form as a
   * `Form.Root` to route them, throw to keep the dialog open, or set `closeOnSettle={false}`
   * and close it yourself (a `Dialog.Close`, a submit button in a separate `method="dialog"`
   * form, or a controlled `open`). A `formMethod="dialog"` submitter inside this form cannot
   * close it: React prevents every submit of a form with a function `action` and runs the
   * action again.
   *
   * The dialog is not closed either when it was closed (Escape, a Close part) while the action
   * ran, also if the user re-opened it meanwhile.
   */
  closeOnSettle?: boolean;
```

### Implementation notes for the developer

- `dialog-form.tsx`: render the `FormStatusWatcher` through a small child that reads
  `use(FormContext)` (`internal/field-context.ts`) and calls `onSettled` with
  `clean = form === null || !hasAnyError(form.errors)` (`internal/validity.ts`); `onSettled`
  returns early when `!clean`. The same child issues the dev warning when `form !== null &&
  action === undefined` (once per mount). Nothing else in `Dialog.Form` changes;
  `FormStatusWatcher` and `Form.Root` are untouched.
- Tests (`form.test.tsx`, the "Dialog.Form render={<Form.Root errors />}" describe): the row
  "the default closeOnSettle closes the dialog even when the result has errors" flips to "keeps
  the dialog open and focuses the field"; add: a clean settle closes with `reason: "activate"`
  and `returnValue` = the `Form.Submit`'s `value` and the `openChangeAction` sees it; a hidden
  stale error (value edited during the flight) neither closes, resets nor focuses; `closeOnSettle={false}`
  still never closes; the dev warning for the composition without `action`; a plain
  `Dialog.Form` still closes on a settle with errors (8.1 unchanged). jsdom is enough: nothing
  here depends on the browser.
- Docs: Field page "In a Dialog" and the Dialog page's `Dialog.Form` paragraph and props row
  drop the `closeOnSettle={false}` advice and show the recipe above; the `autoReset={false}`
  note for a visible exit; the Dialog page's `closeOnSettle` row takes the new doc comment.
- On acceptance, fold into 3.5 and 8.1, the decisions table row 9, and field-form.md
  walkthrough 11 and PO item 9 (the cross-reference line is already there).

### For the product owner

1. **No `errors` / `autoReset` on `Dialog.Form`; the `render={<Form.Root />}` composition stays
   the one shape.** Alternative: a built-in errors channel (`Dialog.Form` wraps `Form.Root`)
   for one attribute less at the call site. **Recommendation: no new props**, for the five
   reasons above.
2. **`closeOnSettle` becomes error-aware when the form is a `Form.Root`**: close on a settle
   with no errors (`hasAnyError`, hidden stale entries included, the `autoReset` predicate),
   stay open otherwise. A behaviour change for the one documented composition (the dialog no
   longer closes over unseen errors), none for a plain `Dialog.Form`. Alternative: a third
   `closeOnSettle` value or a `closeOnSuccess` rename. **Recommendation: same prop, same name,
   error-aware by detection.**
3. **Detection through `FormContext`**, not an element-type check: no `dialog` → `form`
   subpath dependency beyond two internal helpers, and the reverse orientation works for free.
   **Recommendation: accept.**
4. **Reset before exit is accepted as a documented cosmetic** with the `autoReset={false}`
   recipe for the default (unmounting) content; not automated. Alternative: `Dialog.Form`
   suppresses `Form.Root`'s reset on a closing settle through the context. **Recommendation:
   document, do not automate**; revisit if the exit-animation docs attract the question.
5. **Development warning** for `Dialog.Form render={<Form.Root />}` without a function
   `action` (the composition silently loses `method="dialog"`). **Recommendation: accept.**

**Accepted by the product owner (2026-10-18):** recommendations 1-5 of "Dialog.Form and Form.Root (#59)" are accepted as written.

### Implementation deviations (32611fd, `memo/developer/dialog.md` "#59")

| Item | Deviation | Section |
| --- | --- | --- |
| 1 | The context-reading child (`DialogFormSettle`) is **always** rendered among the form's children, not only with a function `action`, so the development warning for `render={<Form.Root />}` without an `action` can fire (the case it exists for has no action). It renders the `FormStatusWatcher` only with a function `action`, so the settle behaviour is as designed. Agreed: the design's "the same child issues the warning" needed exactly this. | 14 |
| 2 | One extra jsdom row pins the reverse orientation, `<Form.Root action errors render={<Dialog.Form />}>`: `useRender`'s clone hands the Form's `action` to `Dialog.Form`, whose children sit inside the `FormContext` provider, so it is detected the same way. | 13.2 |

## Amendment: a Trigger click dismisses an open non-modal `lightDismiss` dialog on every path (#116, 2026-10-24)

Status: architect decision; a behaviour change in the JS baseline, no API change. Edited in
place: the 13.1 light-dismiss row, the section 13 light-dismiss bullets, the 14 test row.

Finding (#110 review F2): the JS baseline excluded the Trigger from "outside" ("the Trigger
re-opening a non-modal dialog is not a click outside"), native `closedby="any"` does not, so
with `experimental_closedBy` a Trigger click on an open non-modal dialog closed it in Chromium
and Firefox (`(false, "dismiss")`) and left it open on WebKit (no `closedBy`, JS path) and
without the flag, against the `lightDismiss` JSDoc's "behaves the same".

Decision: the platform's shape wins and the JS baseline follows it. The dialog light-dismiss
algorithm has no invoker exemption in the spec or in any engine (and a non-modal dialog's
Trigger is not an invoker: there is no command for `show()`), the flag graduates to native-only
when WebKit ships `closedby`, modal dialogs already dismiss on a Trigger click (it lands on the
`::backdrop`), and the exclusion protected nothing: the Trigger never dispatches while the dialog
is optimistically open, so a re-open from the same click cannot happen either way. The
alternative, keeping the exclusion on every path by rendering `closedby="closerequest"` plus the
JS outside-click listeners for non-modal dialogs under the flag, would diverge from the platform
permanently and keep JS alive past graduation for one case.

Edge noted, same on both paths: with `lightDismiss`, a Trigger click during a pending
part-initiated close (test row "Re-open during a pending part close") is now also a dismissal of
the still-open dialog. The click's `requestOpen` dispatches during the click (optimistic is
`false` during the pending close); the dismissal's `close` event is queued and dispatches
`(false, "dismiss")` after it, so the dismissal is the last intent and the dialog ends closed
(conventions 2.5), as the platform's own outcome. Accepted (PO, #116 review F2). Without
`lightDismiss` that row is unchanged.

Implementation (developer), `packages/ui/src/dialog/dialog-popup.tsx`: in the light-dismiss
effect's `isOutside`, drop the `triggerRef` branch (and its comment); `lightDismiss`'s JSDoc
("behaves the same") is now true as written; `DialogPage` gets a sentence in the `lightDismiss`
row: "a click on the Trigger of an open non-modal dialog counts as outside, as native
`closedby="any"` treats it". Tests: the 14 row above in jsdom (both paths); browser row,
Chromium / Firefox / WebKit, real mouse, non-modal + `lightDismiss`, with and without
`experimental_closedBy`: a Trigger click while open ends with the dialog closed, one
`(false, "dismiss")` whose event is the `close` event, no `true` dispatch; branch on
`supportsDialogClosedBy` only to assert which mechanism closed it (native where supported, JS
elsewhere), the outcome identical.

Review follow-ups (#116 review, PO decisions, 2026-10-24): F1, JS-free mode re-opened the
dialog (the light dismiss closed it, then the Trigger's `!dialog.open` check called `show()`),
on the JS path and natively with the flag. The JS-free Trigger now records `dialog.open` at
`pointerdown` and skips `show()` on a pointer click (`detail > 0`) whose press saw it open; a
keyboard click (no press) is unaffected, and a stale press cannot swallow a later keyboard
open. Owned key `onPointerDown` (non-modal JS-free mode). F2, the pending-close edge ends
closed (corrected above). F5, section 2.6 edited to match.

## Amendment: the library cuts the CSS transition around its own show / hide (#147, 2026-11-24)

User decision 2026-11-24 (option B of `memo/architect/147-reevaluation.md`). The consumer rule
`html:active-view-transition .dialog { transition: none; }` of 10.3 is removed from the docs, the
docs stylesheet and the playground. Instead, when `Dialog.Popup` has `transition` and a view
transition is running at the moment of the library's own `showModal()` / `show()` /
`close(returnValue)`, the call runs inside `withCssTransitionCut` (conventions 5.1): inline
`transition: none !important`, the call, a forced style recalculation, the inline `transition`
restored through CSSOM (never the attribute, which a strict CSP blocks). Effects: no double image on a library close (Chromium), no CSS enter under the view
transition's enter on a library open (every engine), and a dismissal's CSS fade is never cut, not
even by an unrelated page view transition. The `::backdrop` is not cut: its enter fade runs on
open, as with the old rule. 13.3's rows changed with it (see there).

---

# button.md: starting decisions, test plan, docs page, implementation notes, review folds, test rows and docs of 16 to 18

## 0. Product-owner decisions this design starts from

1. A Button **ignores activation while its own action is pending**, by default. It renders
   `aria-disabled="true"` meanwhile and never native `disabled`, so focus stays and a Tooltip
   still works. Conventions 2.5 and 3.6 are amended.
2. **No `aria-busy` by default, no built-in announcement** in v1.
3. **Forms**: default `type="button"`, `"submit"` when `formAction` is given; `formAction` shows
   pending for this button's own submissions only (from its own submission until the form's
   submissions have all finished, a latch since #154, 6.2); `Form.Submit` stays; a plain `type="submit"`
   Button does not read `useFormStatus`.
4. **Composition**: an already-cancelled click does not block the action
   (`Dialog.Trigger render={<Button />}` works); focus and hover listeners keep working while
   pending; the Toolbar question is decided here (section 7.3).
5. The module is `"use client"`; the cost to Server Component callers is documented (section 11).

## 13. Test plan

`packages/ui/src/button/button.test.tsx` (jsdom) and `button.browser.test.tsx` (Chromium,
Firefox, WebKit). Top-of-file comment (conventions 10.1): "Button: no controlled state, so the
controlled-parity, optimistic, platform-path, urgent-action, continuous-control and inside-a-Field
rows are N/A; the **overlap and superseded-rejection rows are N/A because the re-entry guard means
a Button never has two of its own runs in flight** (rows 5 and 6 replace them)."

| # | Area | Project | Test |
| --- | --- | --- | --- |
| 1 | Roles and ARIA | jsdom | Default `<button type="button">`, no `role`; `type="submit"` with a function `formAction`; a consumer `type="submit"` / `"reset"` wins; `render={<a href>}` gets no `type`; `render={<MyButton />}` (a component spreading onto a `<button>`) **gets** `type="button"` and, inside a `<form>`, does not submit on click (review item 2); `render={<button type="submit">}` is overridden by the Button's computed `type` (owned); `disabled` renders native `disabled` + `data-disabled`, no `aria-disabled`; `focusableWhenDisabled` renders `aria-disabled="true"`, no `disabled`, `data-disabled`; `disabled` with `render={<a href>}` and with `render={<MyButton />}` renders `aria-disabled="true"` and **no** `disabled` attribute (review must-fix 1); a consumer `aria-disabled` prop is not accepted (type) and a render element's is removed (owned). |
| 2 | Sync action | jsdom | Click, Enter and Space each call `action` once with `details.event` the native event; disabled (every spelling, the link and component renders included) never dispatches and a disabled `render={<a href>}` click is `defaultPrevented`; a Button without `action` starts no transition (no `data-pending` flicker: assert no `data-pending` after a click, synchronously). |
| 3 | Async action | jsdom | Deferred action: `data-pending`, `aria-disabled="true"`, **no** `data-disabled`, `state.disabled === false` in `children(state)`; `document.activeElement` stays the button from click through resolve; after resolve all three facts invert, focus still on the button. |
| 4 | Rejection | jsdom | Reaches `<ErrorCatcher>` above the Button; pending ended. Caught inside: resolves; the next click runs again (no stuck guard). |
| 5 | Re-entry ★ | jsdom | While a deferred action pends: a second click, an Enter and a Space each leave `action` at one call and are `defaultPrevented`; two `fireEvent.click`s inside one `act` (same task, before any re-render) call it once (the ref); after resolve a click calls it again; `render={<a href>}`: the second click while pending is `defaultPrevented`, the first was not; with `commandfor` / `command` attributes present the second click is `defaultPrevented` (jsdom runs no command; the browser row 22 covers the command itself). |
| 6 | Settled-but-held commit ★ | jsdom | A second, unrelated `useTransition` action (deferred) is pending; the Button's action resolves; the button still shows `data-pending` and `aria-disabled` (entangled commit) and a click in that window **runs the action again** (two calls; the guard is the in-flight counter only); the reviewer's probe as a row: a non-awaiting `action` clicked three times while the unrelated action pends is called three times; when the unrelated action resolves, one commit clears the attributes. |
| 7 | Two Buttons | jsdom | A pending; B clicked: B's action called at once, B `data-pending`; both clear after both resolve. |
| 8 | Suspending content | jsdom | The action sets a value that makes sibling content suspend (`createSuspender`): old content stays, `data-pending` on until it resolves, clicks ignored meanwhile. |
| 9 | Function props, `render` | jsdom | `className` / `style` / `children` receive `{ pending, disabled }` and agree with the attributes; element form merges `className` / `style`, keeps dispatch and the guard, forwards `ref`; function form gets `(props, state)`; `render={<MyButton />}` (a component that spreads props) works; a pass-through `onFocus` / `onPointerEnter` / `onKeyDown` fires while pending. |
| 10 | Consumer state after await | jsdom | `action={async () => { await d.promise; startTransition(() => setCount(c => c + 1)); }}` commits once per accepted click (guards the documented post-await pattern). |
| 11 | `formAction`, per-submitter pending ★ | jsdom | A `<form>` with `Form.Submit` and two `Button formAction` (deferred functions `a`, `b`): click A → A `data-pending` + `aria-disabled`, B neither, `Form.Submit` `data-pending`; `useFormStatus().action === a` observed through a probe; click A again → `a` called once, click `defaultPrevented`; click B while A pends → `b` called, both pending (A stays `aria-disabled`); resolve A → all still pending (React holds the form status); resolve B → all clear. #154 rows: two Buttons with different functions, both settle orders, each pending until both settled, then B alone leaves A idle; the form's own `action` submitted while A runs keeps A pending; `"ignore"` A, B, A again: `a` called once, the third click `defaultPrevented`, also after `b` settled; a click on A cancelled by constraint validation, then B: A never pending. `type` on both is `"submit"`. |
| 12 | `formAction` inside `Form.Root` ★ | jsdom | `Form.Root action={formAction}` with a `Button formAction={mine}`: clicking the Button calls `mine`, not `formAction`; `Form.Root` shows `data-pending` meanwhile (form channel); the button element has a `formaction` attribute (react-dom's URL for a function), which is what `Form.Root`'s submitter check keys on; `Form.Submit` in the same form still runs `formAction`. |
| 13 | `formAction` identity | jsdom | An inline `formAction={(fd) => …}` whose parent re-renders (state change) during the submission keeps the Button `data-pending` until it settles (the `submittedWith` ref); a stable function works without the ref (sanity). |
| 14 | Dev warnings | jsdom | `action` + `formAction` logs an error once; `action` + `type="submit"` and `+ "reset"` warn once; no warning for `formAction` alone, `type="submit"` alone, `commandfor` + `action`. |
| 15 | Trigger-wrapped ★ | jsdom | `Dialog.Trigger render={<Button action={a} />}` in library mode: one click calls `a` (the click arrives `defaultPrevented`) and dispatches the open; with a **deferred** `a` the Trigger shows `data-open` and `data-pending`, `showModal` is not yet called, a second click leaves `a` at one call, and resolving `a` calls `showModal` once (entanglement, review deviation 1); with a **non-awaiting** `a` the dialog opens in the same commit; `Button render={<Dialog.Trigger />}` likewise. |
| 16 | Toolbar ★ | jsdom | Inside `Toolbar.Root`: `Button disabled` renders `aria-disabled="true"` and no `disabled`, is reached by the arrows and never dispatches; `Toolbar` has no `Button` member (type and runtime); `ToolbarEditor`-style mixed children with `<Button>` in place of `Toolbar.Button` still pass the toolbar's row 12; a `Button` with `tabIndex={-1}` is skipped by the arrows (pass-through, as any item). |
| 17 | `details.event` is virtual | jsdom | As Toggle row 21 for `ButtonActionDetails`: `details.event` is the click, `"event" in details`, `Object.keys(details)` is `[]`, a Server-Function-shaped `action` receives it. |
| 18 | Types | jsdom (`expectTypeOf`) | `onClick`, `aria-disabled` not accepted; `type` is the three-way union; `formAction` accepts a `(formData: FormData) => Promise<void>` and a string; `ButtonProps` / `ButtonState` / `ButtonActionDetails` exported from `@funstack/ui/button` and the root. |
| 19 | SSR markup | jsdom | `renderToString`: `type="button"`, no `aria-disabled`, no `data-pending`; with a function `formAction`: `type="submit"` and a `formaction` attribute; `hydrateRoot` over it logs no mismatch. |
| 20 | Directive | script | `dist/button/button.mjs` starts with `"use client"`; `dist/button/index.mjs` does not; `dist/toolbar/toolbar-button.mjs` no longer exists. |
| 21 | Focus retention | browser | All three engines: focus the Button, click (Enter), action pending: `document.activeElement` is the Button after two animation frames (the probe's window in which native `disabled` would have blurred it in Chromium / Firefox), and still after resolve. |
| 22 | Invoker Command + action | browser | `<Button commandfor="p" command="toggle-popover" action={slow}>`: first click runs the action and the popover is `:popover-open`; second click while pending: action still one call and the popover still open (the command did not run); after settle a click closes it. Same engines (Invoker Commands are Baseline on all three). |
| 23 | Tooltip while pending | browser | `Tooltip.Trigger render={<Button action={slow} />}`: hover during pending opens the popup (`:popover-open`), leave closes it; focus during pending opens it. Chromium with `experimental_interestFor` on takes the native path (branch on `src/__tests__/engine.ts`). |
| 24 | Implicit submission | browser | A form with a text field and a `Button formAction={slow}` as its only submit button: Enter in the field submits once; Enter again while pending submits nothing (the guard cancelled the synthetic click); with `Form.Submit` as the default button and a pending `Button formAction` elsewhere in the form, Enter submits the form's action. |
| 25 | ViewTransition | browser | `{show && <Button />}` mounted in a `startTransition`: `document.startViewTransition` called zero times without `transition`, once with `transition="none"` (conventions 10.1 mount row); a settle that swaps `children(state)` calls it **zero** times under `transition="none"` (React starts a document view transition for a `"none"` boundary only on mount / reveal) and **once** under `transition="auto"` (review deviation 2). |
| 26 | Accessibility tree | browser (Chromium, CDP) | The pending Button's name is unchanged and the node has the `disabled`-equivalent state from `aria-disabled` (whatever CDP reports for it; the row records the value, `memo/developer/cross-engine.md`); after settle the state is gone. |

★ rows are the ones this design adds beyond conventions 10.1.

---

## 14. Docs page

`packages/docs/src/pages/ButtonPage.tsx` at `/components/button`, first in `componentNavItems`
(it is the most basic component), routed in `App.tsx`. Sections:

1. Intro: a button whose click is a transition; what it adds over `<button onClick>` (pending
   state, re-entry guard, errors to a boundary, Server Functions as actions).
2. Examples (`src/examples/`, source shown):

   | Example | Directive | Shows |
   | --- | --- | --- |
   | `ButtonSave.tsx` | `"use client"` | 2.1: fake async save (`fake-api.ts`), `children(state)` spinner, the re-entry guard made visible (a call counter), a rejecting variant inside `DemoErrorBoundary`, a caught-inside variant with a toast. |
   | `ButtonFormActions.tsx` | `"use client"` | 2.2: `Form.Root` with `Form.Submit` "Publish" and two `Button formAction` ("Save draft", "Discard"), each with its own pending; the form-channel pending on `Form.Submit` contrasted. |
   | `ButtonCompose.tsx` | `"use client"` | 2.3: `Dialog.Trigger render={<Button />}` and `Tooltip.Trigger render={<Button />}` (hover a pending button). |
   | `ButtonInvoker.tsx` | **none (Server Component)** | 2.5's second button: `commandfor` / `command` opening a Dialog with no JS, plus a `Button` styled by `[data-pending]` CSS only; the page says the file has no directive and which props a Server Component cannot pass. (The docs site has no Server Functions, so `action` from a Server Component is shown as code, not run.) |
   | `button.css` | | 2.6 recipes, reduced motion. |

3. Anatomy (one element), props table (`ButtonProps`, with `type`'s default rule and the
   `formAction` identity note), `ButtonState`, data attributes (and the "pending is not disabled"
   sentence), owned keys.
4. "Pending and re-entry": what is ignored, `aria-disabled`, why not `disabled`, the
   non-awaiting spelling for concurrent clicks, `useActionState` for a queue.
5. "Forms": `type` defaults, `formAction` vs `Form.Submit` (the 6.4 table), implicit submission.
6. "Which button?": the 1. list (`Form.Submit`, `Dialog.Close`, `Menu.Item`, `Toggle`, `Toolbar`),
   as a callout.
7. Keyboard (8.2), "What assistive technology hears" with the outcome pattern (8.3) and the
   `aria-busy` note.
8. Server Components (11), before hydration.
9. The reduced-motion block.

Also: `ToolbarPage.tsx` drops the `Toolbar.Button` props table, uses `<Button>` in its examples
and links here, with a **migration callout** ("`Toolbar.Button` was removed in this release; use
`Button` from `@funstack/ui/button`, which behaves the same inside a toolbar and also ignores a
second click while pending"); `RoadmapPage.tsx`'s changelog entry marks the removal as a
breaking change; `MenuPage.tsx` gains a one-line "a Button inside a Menu
is not an item"; `ActionPropsPage.tsx` / `GettingStartedPage.tsx` may use `<Button action>` as
the first example of an action prop; `ServerComponentsPage.tsx` lists Button under "client
modules you can render from a Server Component" with the Server Function `action` / `formAction`
note; `RoadmapPage.tsx` changelog entry; `packages/example` gets a demo page; `index.ts`,
`tsdown.config.ts` and `package.json` exports gain `button`.

---

## 15. Implementation notes

### 15.1 Files

```
packages/ui/src/button/
  index.ts              # no directive
  button.tsx            # "use client"
  button.test.tsx
  button.browser.test.tsx
packages/ui/src/internal/use-action-trigger.ts   # gains the guard option, `run` returns boolean
packages/ui/src/toolbar/index.ts                 # Toolbar = { Root, Separator } (7.3)
packages/ui/src/toolbar/toolbar-button.tsx       # removed (7.3), with its types and root-entry exports
```

### 15.2 `useActionTrigger` change

```ts
export interface ActionTriggerOptions {
  /** Open generation of the overlay a `then` belongs to (unchanged). */
  readonly openGeneration?: () => number;
  /**
   * Ignore `run` while a run is in flight (conventions 2.5 as amended): `run` returns `false`
   * and starts nothing. In flight means the hook's synchronous in-flight counter is non-zero;
   * the last render's `pending` is **not** consulted (design 5.2). Default `false` until #81
   * flips it.
   */
  readonly ignoreWhilePending?: boolean;
}

export interface ActionTrigger {
  readonly pending: boolean;
  /** Returns `false` when the run was ignored (so the part can `preventDefault()`). */
  readonly run: (work: () => unknown, then?: () => void) => boolean;
}

export function useActionTrigger(options?: ActionTriggerOptions | (() => number)): ActionTrigger;
```

The positional `openGeneration` form may stay accepted for the three existing call sites, or they
may be edited to the object form (three one-line changes); the developer's choice. Inside:
`inFlight` is a `useRef(0)`; `run` does `if (ignoreWhilePending && inFlight.current > 0) return false; inFlight.current++;` before `startOwnTransition`, and decrements in a
`finally` around `await work()`. The superseded-rejection handling stays (it is reachable for the
unguarded parts and stays correct for guarded ones). **Since #145 (2026-11-23)** that handling is
one call: a run that is no longer the latest passes its rejection to `reportError`
(`internal/report-dropped.ts`, conventions 2.4) instead of throwing it from the part's
render; the latest run's rejection is rethrown inside the transition as before, unless the part
unmounted or is hidden by `<Activity>` by then, when it is reported too (#152). The hook's
options are `{ openGeneration?, ignoreWhilePending? }`; the `captureSuperseded` option that #100
added is gone.

### 15.3 `Button` sketch

```tsx
export function Button({ action, formAction, type, disabled = false, focusableWhenDisabled = false,
  transition, className, style, children, render, ...rest }: ButtonProps) {
  const toolbar = useToolbarContext();
  // Not a host <button> (a link, a component): native `disabled` would mean nothing to the
  // browser and hide the state from AT, so the focusable-disabled branch (review must-fix 1).
  const focusable = focusableWhenDisabled || toolbar !== null || !isHostButton(render);
  const { pending: ownPending, run } = useActionTrigger({ ignoreWhilePending: true });
  const status = useFormStatus();
  const submittedWith = useRef<unknown>(undefined);
  // Since #154 `formPending` also holds through a `submitted` latch (6.2).
  const formPending = status.pending && typeof formAction === "function"
    && (status.action === formAction || status.action === submittedWith.current);
  const pending = ownPending || formPending;
  useDevWarning(...); // action + formAction (error), action + submitting type (warn)
  const state: ButtonState = { pending, disabled };
  const element = useRender<ComponentPropsWithRef<"button">, ButtonState>({
    defaultElement: "button", render, state, className, style, children,
    props: { ...rest, formAction },
    libraryProps: {
      ...(rendersButton(render) && { type: type ?? (formAction !== undefined ? "submit" : "button") }),
      disabled: disabled && !focusable ? true : undefined,
      "aria-disabled": pending || (disabled && focusable) ? true : undefined,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      onClick: (event: MouseEvent<HTMLElement>) => {
        if (disabled) { event.preventDefault(); return; }
        if (action === undefined) {
          if (formPending) { event.preventDefault(); return; }
          submittedWith.current = formAction;
          return;
        }
        const details: ButtonActionDetails = createActionDetails(event.nativeEvent, {});
        if (!run(() => action(details))) event.preventDefault();
      },
    },
  });
  return useTransitionBoundary("Button", transition, element);
}
```

`useFormStatus` is imported from `react-dom` as in `form-submit.tsx`. `disabled` is passed as
`undefined` (not `false`) in the focusable case so the owned key removes a render element's
`disabled` (conventions 1.2, owned keys).

`render-element.ts` after review items 1 and 2: `rendersButton(render)` (the `type` predicate,
library-wide) returns `true` for no `render`, the function form, a host `"button"` **and any
component element**, `false` only for a host element of another tag; a new `isHostButton(render)`
keeps today's strict meaning (no `render`, function form, host `"button"`) for the `disabled`
branch. Every part that emits `type="button"` through `rendersButton` (Toggle, Tabs.Tab, the
Menu items, the Close and Trigger parts, …) gains the component case at once, which is the same
footgun fixed everywhere (`<Toggle render={<MyButton />}>` inside a form is the Getting Started
page's own example); the existing "no `type`" assertions all use host `<a>` renders and keep
passing. The other parts' `disabled` on a link render is a separate follow-up (fold, item F3).

### 15.4 Toolbar

`toolbar/index.ts`: `export const Toolbar = { Root: ToolbarRoot, Separator: ToolbarSeparator } as const;`
with the `ToolbarButton*` type exports removed there and in `src/index.ts`. The `toolbar.test.tsx`
rows that test `Toolbar.Button`'s own action (sync / async / rejection / "pending stays until both
overlapping runs settle") move to `button.test.tsx` in their guarded form; the keyboard rows
render `<Button>` from `../button/button.js` instead of `Toolbar.Button` and are otherwise
unchanged. `packages/example` and the docs examples follow the same rename.

---

## Implementation and review fold (#79, 2026-10-22)

Implementation d8136b4 (library, `Toolbar.Button` removed), 465d106 (playground), 0201cec
(docs); review `memo/reviewer/button.md` (c8e09d1, "acceptable with minor fixes"). Decisions on
the review's open items and the developer's deviations, folded into the sections above:

| # | Item | Decision | Where |
| --- | --- | --- | --- |
| F1 | Must-fix 1: `disabled` on `render={<a href>}` outside a Toolbar rendered a meaningless `disabled=""` and no `aria-disabled`. | **Fix in code.** `focusable` includes `!isHostButton(render)`; a link or component render takes the `aria-disabled` branch. | 3 (`disabled` doc), 4, 8.1, 15.3, rows 1 and 2 |
| F2 | Item 2: `render={<MyButton />}` got no `type`, so inside a form it submitted. | **Fix in code, library-wide**: `rendersButton` returns `true` for a component element; `isHostButton` is the new strict predicate for the `disabled` branch. No `nativeButton` prop: host elements are detectable statically, and the "harmless if wrong" rule covers components. Affects every part that emits `type` through `rendersButton` (the same footgun); conventions 1.2 amended. | 4, 15.3, conventions 1.2 |
| F3 | Review's note that other parts (`Dialog.Close`, `Popover.Close`, `Dialog.Trigger`, `Form.Submit`) render native `disabled` on a link `render` too. | **Follow-up issue** (not #79): apply `isHostButton` to their `disabled` branch; `Form.Submit` must stay a submitter anyway. | proposal for the PO |
| F4 | Item 3: the rendered-`pending` guard source dropped clicks under entanglement (probe: three clicks, one call). | **Guard on the in-flight counter only.** The held window accepts a new run; `aria-disabled` may outlast the guard. `formAction` keeps its render-value guard (React's own status). | 5.2, 5.4, walkthroughs 5 and 7, row 6, 15.2, conventions 2.5 / 3.4 / 10.1 |
| F5 | Item 4: row 11 intermediate assertion ("resolve A → only A clears"). | Developer adds it. | row 11 (unchanged) |
| F6 | Item 5: playground `.tb-item[aria-disabled="true"]` styles a pending Button as disabled. | Developer switches to `[data-disabled]` as the docs CSS did. | 2.6 |
| F7 | Minor 6: two Buttons sharing one `formAction` function both show pending. | Documented; inherent to `useFormStatus`. | 6.2 |
| F8 | Minors 7 and 8 (`ButtonInvoker` CSS-only Button, `ButtonSave` counter updates on settle). | Developer's call; optional. | 14 |
| D1 | Trigger-wrapped **awaited** action holds `showModal()` until it settles (entanglement). | **Accepted; the design was wrong.** 2.3 uses a non-awaiting prefetch and names the awaited behaviour; 7.1 and row 15 describe it. | 2.3, 7.1, row 15 |
| D2 | Row 25: a `transition="none"` content swap starts no view transition; `"auto"` starts one. | **Accepted**; row 25 rewritten. | row 25 |
| D3 | Hyphenated `aria-disabled` cannot be type-checked away; `expectTypeOf().not.toHaveProperty` plus the owned-key removal test cover it. | Accepted. | row 18 |
| D4 | Playwright `force: true` for clicks on an `aria-disabled` Button (row 22): Playwright's actionability treats it as disabled; the real pointer click still dispatches. | Accepted. | row 22 |
| D5 | `useDevWarning` (`console.error`, once per instance, in an effect) where the design says "warns". | Accepted; the library's one warning channel. | 6.1 |
| D6 | oxlint disable for reading `submittedWith` in render. | Accepted; written only by the click handler before the submission whose status the render shows (precedent: `progress-root`). | 15.3 |

---

### 16.4 Test rows per part

The old rows named here are rewritten, not deleted, so the suites keep their coverage count.

**`dialog.test.tsx`**

| # | Row | Test |
| --- | --- | --- |
| D1 | Re-entry (library mode, with `action`) | Deferred `action`: a second click, Enter and Space leave it at one call, each is `defaultPrevented`, `aria-disabled="true"` and `data-pending` are on and `data-disabled` is off; the button keeps focus; resolve → one `openChangeAction(false, "activate")`, one `close(value)`, attributes gone (the dialog is closed, so the button is gone with it in the usual harness; assert on the element reference). JS-free variant: one `dialog.close(value)`. |
| D2 | Re-entry, same task | Two synchronous `fireEvent.click`s inside one `act`: one `action` call. |
| D3 | No `action` | A Close without `action` clicked twice while the Root's close is pending: unchanged behaviour (`requestClose` no-op against `intended()`), no `aria-disabled` (no own run). |
| D4 | Superseded rejection → N/A | `dialog.test.tsx:1240` ("with action: a superseded rejection still reaches the boundary") becomes a rejection row: the single run rejects → boundary above the Close, dialog stays open, a click after the boundary resets runs again. Top-of-file comment lists Overlap / Superseded rejection for the Close part as N/A (#79 reason). |
| D5 | Stale close row (design table "Close part, stale close") | Unchanged except its last sentence: drop "a superseded click's rejection reaches the catcher". |
| D6 | Owned `aria-disabled` | A `render` element's `aria-disabled` is removed when the Close is idle (owned `undefined`). |

**`popover.test.tsx`**

| # | Row | Test |
| --- | --- | --- |
| P1 | Re-entry (library mode and JS-free mode, with `action`) | As D1 with `hidePopover` / `requestClose` (one `openChangeAction(false)` / one `hidePopover()`). |
| P2 | Re-entry, same task | As D2. |
| P3 | `popover.test.tsx:1360` ("a superseded rejection still reaches the boundary") | Becomes the single-run rejection row; N/A comment as D4. |
| P4 | Owned `aria-disabled` | As D6. |

**`menu.test.tsx`**

| # | Row | Test |
| --- | --- | --- |
| M1 | `menu.test.tsx:844` ("two activations run the action twice; the close happens once") | Rewritten: a deferred `action` on a `closeOnActivate` Item; a second Enter, Space and click leave it at one call and are `defaultPrevented`; the item has `aria-disabled="true"`, `data-pending`, no `data-disabled`; resolve → one `requestClose`, the menu closes. |
| M2 | Re-entry on a `closeOnActivate={false}` Item | Deferred action: second activation ignored; resolve → attributes gone, menu still open, the next Enter runs again. |
| M3 | Navigation ignores pending (split, wave 9 deviation 1) | Integration half (`menu.test.tsx`): while an Item is pending (`aria-disabled` on it), the arrows, Home, End and typeahead land on it as on any item (they never skipped disabled items). Unit half (`menu-dom.test.ts`): `edgeItem` returns a pending item (`aria-disabled` without `data-disabled`) as the first enabled item and skips a `data-disabled` one; the open-focus rows already cover `edgeItem`'s use. The "re-open while pending" case cannot be observed end to end: the re-open is entangled with the pending item's action and commits after it settles, so the pending state is gone by the time the open focus resolves. |
| M4 | `menu.test.tsx:871` ("a superseded rejection reaches the boundary", Item) | Becomes the single-run rejection row (menu stays open, boundary above the item, the next activation runs after reset); N/A comment. `menu.test.tsx:1350` (RadioItem / CheckboxItem) is **unchanged**: state owners keep overlap and superseded rejection. |
| M5 | Design table "Overlap" row (menu.md 966) | "Two Item clicks: action called twice, `requestClose` once effective" → "Two Item clicks: action called once (the second is ignored), one `requestClose`". The RadioItem half stays. |
| M6 | `menu-dom.ts` unit | `isDisabledItem` is `true` for `data-disabled=""` and `false` for `aria-disabled="true"` without it. |

**`toast.test.tsx`**

| # | Row | Test |
| --- | --- | --- |
| T1 | `toast.test.tsx:852` ("two Undo dispatches resolved out of order close the toast once") | Rewritten: a deferred Undo `action`; a second click leaves it at one call and is `defaultPrevented`; the Action has `aria-disabled="true"` and `data-pending`, the Root `data-pending`, the timer paused (existing assertion); resolve → one close (`"activate"`). |
| T2 | Superseded rejection rows in that `describe` | Become the single-run rejection row (toast stays, boundary above the Viewport, as walkthrough 4); N/A comment for Overlap / Superseded rejection on `Toast.Action`. |
| T3 | `Toast.Close` while Undo pending (walkthrough 6) | Unchanged: Close is not a `useActionTrigger` user. |
| T4 | Owned `aria-disabled` | A `render` element's `aria-disabled` on an idle Action is removed. |

**`use-action-trigger` and the continuous controls**

| # | Row | Test |
| --- | --- | --- |
| H1 | Default | `useActionTrigger()` with no options ignores a second `run` while the first is in flight (`run` returns `false`), and runs it after settle; `{ ignoreWhilePending: false }` runs both. The existing superseded-rejection hook tests move under the `false` option. (Since #145 those rows assert: every superseded rejection of a burst is passed to `reportError` and the latest reaches the boundary; superseded rejections are still reported after unmount and nothing is thrown.) |
| H2 | Slider / NumberField | `slider.test.tsx` and `number-field.test.tsx` step rows (two steps in flight, out-of-order resolution, superseded step rejection) pass unchanged with the explicit `false`; one new assertion per file: a second step dispatched while the first step's action pends is **called** (guards the explicit opt-out). |

### 16.5 Docs

Dialog, Popover, Menu and Toast pages: the sentence "repeated clicks re-run the action" becomes
"a second click while pending is ignored and the button is `aria-disabled` meanwhile", with the
non-awaiting spelling for "close now, work later" (menu.md 2.3 already shows it). Owned-keys
lists gain `aria-disabled`. The "Pending & optimistic state" concept page gets one paragraph:
every pure trigger ignores re-entry; state owners (Toggle, Tabs, Checkbox items) take every
click and the latest intent wins. Changelog entry (behaviour change, not breaking).

---

### 17.3 Test rows per part

One jsdom row per part, in its own suite, plus the regression half:

| Part | Row |
| --- | --- |
| `Dialog.Close`, `Popover.Close` | Library mode, `disabled` with `render={<a href="#x" />}` and with `render={<MyButton />}` (a component spreading onto a `<button>`): `aria-disabled="true"`, no `disabled` attribute, `data-disabled`, click `defaultPrevented` and no `openChangeAction` / `close` / `hidePopover`; `render={<button />}` and no `render`: native `disabled`, no `aria-disabled` (unchanged). JS-free mode without `action`, `render={<MyButton />}` disabled: native `disabled` (the command branch), `aria-disabled` absent. |
| `Dialog.Trigger` | Library mode (modal and non-modal) and JS-free non-modal: link / component renders → `aria-disabled`, click cancelled, nothing opens; JS-free modal with a component render → native `disabled`. |
| `Popover.Trigger` | Library mode: link / component renders → `aria-disabled`, click cancelled, no dispatch; JS-free mode with a component render → native `disabled`. |
| `Menu.Trigger` | Link / component renders → `aria-disabled`; click, Enter, ArrowDown do not open; host button → native `disabled` (unchanged). |
| `Toggle` | `disabled` with `render={<a href>}` / `render={<MyButton />}` → `aria-disabled`, no dispatch, `aria-pressed` still rendered, click `defaultPrevented`; host button unchanged. |
| `ToggleGroup.Item` | Same, plus: a disabled link Item is reached by the arrows (documented), still never dispatches; a disabled host-button Item is skipped (unchanged). |
| `Combobox.Trigger`, `Combobox.Clear` | Component render disabled → `aria-disabled`, `tabIndex` as before, click does nothing (no open / no clear). |
| `NumberField.Increment` / `Decrement` | Component render: disabled by prop, by `readOnly`, and at the bound → `aria-disabled` and no step on click / pointerdown hold; host button → native `disabled` in all three (unchanged). |
| `Form.Submit` | Regression: `disabled` with `render={<MyButton />}` renders native `disabled` and **no** `aria-disabled`; the props-table sentence "always native `disabled`: a submitter has no handler to honour `aria-disabled`" is in the docs. |
| `Button` | Unchanged (#79 rows 1 and 2). |

### 17.4 Docs

Each affected page's `disabled` row gains the sentence "with a link or component `render`,
`aria-disabled="true"` instead (the element stays focusable); native `disabled` on a `<button>`".
Conventions 1.2's "the other `disabled` parts follow in a separate issue" is replaced by the list
above. Changelog entry (behaviour change for link / component renders only).

---

## Implementation and review fold (wave 9, #81 and #83, 2026-10-22)

Implementation 27e64f4 (#81) and f827869 (#83) on `memo/developer/wave9-triggers.md`; review
`memo/reviewer/wave9.md` (a29e3ad, "acceptable with fixes"). All six developer deviations
accepted; the review's items decided as follows and folded into 16 and 17 above.

| # | Item | Decision | Where |
| --- | --- | --- | --- |
| W1 | Review M1: the focusable-disabled branch kept `commandfor` / `command`, so a disabled component render was a live invoker before hydration. | **Fix in code**: own both as `undefined` in that branch (Popover / Menu / Submenu Triggers, library-mode modal Dialog.Trigger, both Close parts); rows per part plus a `renderToString` row for `Menu.Trigger`. | 17.2 |
| W2 | Review M2 / L1: docs, jsdoc, menu.md 2.3 and 16.3 said the arrows, Home / End and typeahead skip disabled items; only `edgeItem` (open focus, Trigger arrows while open) does. | Corrected in menu.md 2.3 and 16.3 here; the developer corrects `MenuPage.tsx`, `menu-item.tsx`'s `disabled` jsdoc and `menu-dom.ts`'s jsdoc to "a pending item is an ordinary item for navigation; only the open focus skips items with the `disabled` prop". | 16.3, menu.md 2.3 |
| W3 | Deviation 1: M3 split into the integration half (arrows / Home / End / typeahead land on a pending item) and an `edgeItem` unit row; the re-open half is unobservable end to end (entanglement). | Accepted; row rewritten. | 16.4 M3 |
| W4 | Deviation 2: D3 asserted as two `openChangeAction` calls (the open and one close), one `close()`, no `aria-disabled`. | Accepted. | 16.4 D3 |
| W5 | Deviation 3: D4 / P3 / M4 also reset the boundary (key bump) and check the next activation runs on the fresh instance. | Accepted; stronger than the design row (the in-flight decrement on reject is not observable through a boundary, which unmounts the part). | 16.4 |
| W6 | Deviation 4: T2 split into "two clicks in one task → one dispatch; rejection reaches the boundary, toast not ending" and the `closeOnSettle={false}` variant (where the guard is visible). | Accepted. | 16.4 T2 |
| W7 | Deviation 5: `aria-disabled` owned only in the focusable branch (and always on the Close parts for pending); host buttons keep a consumer's own `aria-disabled` as pass-through. | Accepted as the rule; recorded in 17.2. | 17.2 |
| W8 | Deviation 6: JS-free non-modal `Dialog.Trigger` rendered `aria-disabled` on a component render but no `data-disabled` (`data-disabled` was library-mode only); `Popover.Trigger` in JS-free mode had the same gap. | **Landed in wave 9 after all (5fc05d5)**: both Triggers emit `data-disabled` whenever disabled, in every mode. The rule is now current in conventions 4.1 (`disabled` row: emitted in every mode in which the part renders `disabled` or `aria-disabled`); dialog.md 1 and popover.md 1 updated. | conventions 4.1; dialog.md, popover.md anatomy tables |
| W9 | Review L2: the NumberField disabled-link `preventDefault()` row clicks with `detail: 0`. | Developer adds a `detail: 1` assertion. | 17.3 |
| W10 | Review L3: a pointer press on a disabled focusable step render takes focus from the input (`pointerdown` returns before `preventDefault()`). | **Accept the suggestion**: cancel the `pointerdown` when disabled too, so a disabled step button never steals focus (Combobox.Trigger / Clear already cancel unconditionally). | 17.1 NumberField row |
| W11 | Review L4: the #81 changelog says "behaviour change"; a consumer counting clicks through `Menu.Item` / `Toast.Action` changes result silently. | Flag it in the alpha.7 release notes as breaking for that pattern, pointing at the non-awaiting spelling; 16.5 amended by this row. | 16.5 |

---

### 18.5 Tests

`button.test.tsx` / `button.browser.test.tsx` (section 13 rows):

| Row | Change |
| --- | --- |
| Top-of-file comment | Overlap and Superseded rejection are no longer N/A for Button: required in `"run"` mode, N/A in `"ignore"` mode. |
| 3 Async action | Default: `data-pending`, **no** `aria-disabled`. With `whilePending="ignore"`: the current assertions. |
| 5 Re-entry | Whole row under `whilePending="ignore"`. |
| 5b Every activation runs (new) | Default and explicit `"run"`: while a deferred action pends, a click, an Enter and a Space make three more calls; none is `defaultPrevented`; two `fireEvent.click`s in one `act` call it twice; no `aria-disabled`; runs resolved out of order: `data-pending` stays until the last; `render={<a href>}`: the second click is not cancelled. |
| 5c Overlap, Superseded rejection (new) | Conventions 10.1 rows for `"run"`: the older run rejects after, and separately while, the newer pends: stubbed `reportError` once, not the catcher; the latest rejects: catcher; a burst of three. |
| 5d Prop change (new) | `"run"` to `"ignore"` while a run pends: `aria-disabled` appears with the re-render and the next click is ignored; back to `"run"`: it runs. |
| 6 Settled-but-held | Under `"ignore"` (unchanged). Under the default the "+1 three times" probe needs no special case: three calls. |
| 8 Suspending content | "clicks ignored meanwhile" is under `"ignore"`; default: a click runs. |
| 10 Consumer state after await | Default: commits once per click. |
| 11 `formAction` per-submitter | Default: click A again: `a` called twice, the click not `defaultPrevented`, no `aria-disabled`. With `"ignore"`: the current assertions. |
| 15 Trigger-wrapped | "a second click leaves `a` at one call" needs `whilePending="ignore"`; default: two calls. |
| 18 Types | `whilePending` accepts `"run"` / `"ignore"`, rejects `true` and other strings; `WhilePending` exported from the root. |
| 22 Invoker Command + action (browser) | `"ignore"`: unchanged. Default: the second click runs the action and the command (the popover toggles closed). |
| 24 Implicit submission (browser) | `"ignore"`: unchanged. Default: the second Enter submits again. |
| 26 Accessibility tree (browser) | Under `"ignore"`; default: no disabled state on the pending Button. |

Other suites (section 16.4 rows), with the decided defaults:

| Suite | Change |
| --- | --- |
| `dialog.test.tsx`, `popover.test.tsx` | D1, D2, D3, P1, P2 unchanged: they now pin the **default**. New D7 / P5, `whilePending="run"` with `action`: a second click calls `action` again, no `aria-disabled`, `data-pending` until both settle, one `openChangeAction(false)` / one `close()` / one `hidePopover()`, the stale-close guard still holds; the older run rejects: `reportError`; the first resolves and closes, the second rejects after the part left: `reportError` (#152). |
| `menu.test.tsx` | M1 unchanged (default, `closeOnActivate`). **M2 flips**: a `closeOnActivate={false}` Item runs every activation by default (two calls, no `aria-disabled`) and ignores with `whilePending="ignore"`. New: a closing Item with `whilePending="run"`: two calls, one close. M3 (navigation over a pending item) under `"ignore"`. Overlap / Superseded rejection rows for the `"run"` cases. If question 2 is answered (b), M2 stays as it is. |
| `toast.test.tsx` | T1 unchanged. The `closeOnSettle={false}` variant (W6) **flips**: two clicks, two calls by default; `whilePending="ignore"` restores one. The timer stays paused and the Root `data-pending` until every run settled. If question 3 is answered (b), it stays. |
| `use-action-trigger.test.tsx` | H1: the default is `false` (runs overlap); the guard rows run under `{ ignoreWhilePending: true }`. |
| `slider.test.tsx`, `number-field.test.tsx` | Unchanged (H2 keeps guarding that steps run). |
| Type tests | `whilePending` on the four parts; absent on `Menu.CheckboxItem`, `Menu.RadioItem`, `Form.Submit`, `Toast.Close`. |

About sixty guard assertions exist today (most in `button.test.tsx` and
`use-action-trigger.test.tsx`); the bulk move under the prop rather than disappear.

### 18.6 Docs

- **Pending & optimistic page** (`PendingOptimisticPage.tsx`, "A second click while pending",
  and the pure-trigger definition that links to it): rewritten around the ownership rule, with
  the counter and the Save examples side by side.
- **Action props page** (`ActionPropsPage.tsx`): the sentence on pure triggers; remove "do not
  await" as the way to count clicks.
- **Button page**: props table row `whilePending` (default `"run"`), the `aria-disabled` text,
  the `formAction` caveat of 18.3; `ButtonSave.tsx` and `ButtonFormActions.tsx` examples gain
  `whilePending="ignore"`; a "+1" example shows the default; check `button.css` and the other
  example stylesheets: a rule that styles pending through `[aria-disabled]` moves to
  `[data-pending]`.
- **Dialog, Popover, Menu, Toast pages**: props table row on Close / Item / Action with the
  default (and its dependency on `closeOnActivate` / `closeOnSettle` if questions 2 and 3 are
  answered (a)); the "second click is ignored" sentences name the prop.
- Toolbar and ToggleGroup pages where they describe a pending `Button`; the Roadmap page; the
  agent skill (`packages/ui/skills/funstack-ui-knowledge/SKILL.md`); JSDoc of the five parts
  and of `useActionTrigger`; the playground (`button-demo.tsx`, `toolbar-demo.tsx`).
- **Release notes: breaking for `Button`** (a pending Button no longer ignores clicks or
  renders `aria-disabled` unless `whilePending="ignore"`), and for keep-open Items / Actions
  (questions 2 and 3 were answered (a)).

### 18.7 Implementation notes (2026-11-24)

- As designed: `WhilePending` in `internal/types.ts`, exported from the root entry only (like
  the other shared types); `useActionTrigger`'s `ignoreWhilePending` defaults to `false`;
  Button, `useOverlayClose` (Dialog.Close, Popover.Close), `Menu.Item` and `Toast.Action`
  compute `ignoring` per render and render `aria-disabled` from `pending && ignoring`. The
  `Menu.CheckboxItem` props type now also omits `whilePending` (it extends `MenuItemProps`; the
  type test caught the leak), so `Menu.RadioItem` does too.
- `ToastActionOptions` gets no `whilePending` (conventions 2.5.1, the sub-question of 3).
- **Closing parts in `"run"` mode (review F1, product-owner decision 2026-11-24):** the first
  implementation ran each resolved run's close. A library-mode close was then held by
  entanglement and committed together with a failed latest run (boundary fallback inside a
  closed overlay); a JS-free Close and a `Toast.Action` closed at the first resolved run while a
  later run could still fail. Now `useActionTrigger` runs the continuation once, when the last
  run in flight settles, and only if the latest run resolved, for every closing part; a
  rejection leaves the overlay, menu or toast open in both modes. Conventions 2.5.1 and 3.4.
- Tests: 18.5 rows in `button.test.tsx` (5b, 5c, 5d added; 3, 5, 6, 9, 10, 11, 15, 18 split by
  mode), `button.browser.test.tsx` (21, 22, 24, 26 split by mode); D7 / P5 as shared rows of
  `src/__tests__/overlay-close-part-suite.tsx` (library and JS-free mode);
  `menu.test.tsx` "whilePending (#146)"; `toast.test.tsx` "whilePending (#146)";
  `use-action-trigger.test.tsx` H1 flipped; type rows in `internal/types.test.ts`.

---

# checkbox.md: test plan, implementation notes, review corrections, decisions

## 11. Test plan (`src/checkbox/checkbox.test.tsx`, `checkbox.browser.test.tsx`)

Every row of the Switch plan (its section 11) is repeated with `role` absent instead of
`"switch"` and the `fsui-checkbox-*` types; rows 1 to 25 there map one to one. Additional rows:

| # | Area | Env | Test |
| --- | --- | --- | --- |
| C1 | Roles and ARIA | jsdom | No `role` attribute by default; `role="menuitemcheckbox"` passes through; `aria-checked="mixed"` through props or a `render` element is removed. |
| C2 | Indeterminate | jsdom | `indeterminate` → after mount `el.indeterminate === true`, `data-indeterminate=""`, `el.checked === false`; `indeterminate={false}` → both absent; toggling the prop updates both. |
| C3 | Indeterminate, SSR | jsdom | `renderToString(<Checkbox indeterminate />)` contains `data-indeterminate=""` and no `aria-checked`; after `hydrateRoot`, `el.indeterminate === true` and no console error. |
| C4 | Indeterminate, click (both) | jsdom | Mixed box, deferred action: click dispatches `(true, …)`; while pending `el.checked === true`, `el.indeterminate === false`, no `data-indeterminate`, `data-pending`. Resolve with the parent setting `indeterminate={false}`: no dash, checked. |
| C5 | Indeterminate, rollback (both) | jsdom | Same, reject (caught inside, parent unchanged): after settle `el.checked === false`, `el.indeterminate === true`, `data-indeterminate=""`. Uncontrolled `checked` with `indeterminate`: commits `true`, dash returns (the prop is still true) — documents that the parent is expected to recompute. |
| C6 | Indeterminate, pseudo-class | browser | `:indeterminate` matches after mount, not while pending after a click, and again after a rollback, in Chromium, Firefox and WebKit (jsdom's selector engine support for `:indeterminate` is not relied on). |
| C7 | Indeterminate, forms | jsdom | A checked + indeterminate box still contributes `name=on` to `FormData`. |
| C8 | Indeterminate, reset | jsdom | Mixed box in a form, reset: dispatch `"platform"`; `el.indeterminate` false while pending and true after settle with the parent's prop unchanged. |
| C9 | Function props | jsdom | `className`/`style`/`render` receive `{ checked, indeterminate, pending, disabled }`; `indeterminate` is `false` in the pending render. |
| C10 | Directive | build | `dist/checkbox/checkbox.mjs` starts with `"use client"`; `dist/checkbox/index.mjs` does not. |

---

## 12. Implementation notes

```
packages/ui/src/checkbox/
  index.ts                 # no directive
  checkbox.tsx             # "use client"
  checkbox.test.tsx
  checkbox.browser.test.tsx
packages/ui/src/internal/use-checkable-input.ts   # "use client": shared with Switch (conventions 3.8)
```

`checkbox.tsx` and `switch.tsx` share `useCheckableInput` (`internal/use-checkable-input.ts`,
conventions 3.8): the Field wiring, the controllable action, `useNativeChecked` and the input's
owned layer; each component keeps its props, state, `useRender` call and transition boundary.
Checkbox's call passes no `role`, passes `indeterminate` (the hook shows `indeterminate &&
!pending`, emits `data-indeterminate` from the same expression and owns `indeterminate:
undefined` on the element to strip a `render` element's prop), `transitionTypes("checkbox", next
? "check" : "uncheck")` and `component: "Checkbox"` (the warning tag; the prop is `checked`).
`useNativeChecked`'s `indeterminate` option is as specified in Switch section 7.

Dev warnings: the shared ones (both/mode switch, `preventDefault()`, wrong element) plus none
specific to `indeterminate` (an uncontrolled `checked` with `indeterminate` is allowed, see
section 3).

Example app: the select-all list of 2.4 against a fake 800 ms API with a failure toggle, so the
rollback-to-mixed path of 6.2 can be seen in real engines; the CSS of 2.6 and 2.7.

---

---

# checkbox-group.md: test plan, implementation notes, review corrections, decisions

## 13. Test plan

`packages/ui/src/checkbox-group/checkbox-group.test.tsx` (jsdom, `user-event`, helpers from
`src/__tests__/helpers.tsx`) and `checkbox-group.browser.test.tsx` for what jsdom cannot observe
(Chromium, Firefox, WebKit; engine differences via `src/__tests__/engine.ts`). Rows marked (both)
run under `describe.each` with the uncontrolled and the "update on success" controlled wrapper
(the controlled wrapper uses the functional update of 2.6). A rejection unmounts the group
through the boundary, so DOM rollback is asserted where the group stays mounted (caught-inside,
controlled veto), as in the RadioGroup and Switch plans.

| # | Area | Env | Test |
| --- | --- | --- | --- |
| 1 | Roles and ARIA | jsdom | `fieldset` with no `role` attribute, accessible name from `Label` (`toHaveAccessibleName`), `aria-label` fallback; every Item `input[type=checkbox]` with the same `name` (`useId` fallback, prop when given) and its `value`; the Parent has **no** `name`, no `required`, no `aria-checked`; `form` attribute on fieldset and Items; `role="menuitemcheckbox"` passes through on an Item. |
| 2 | Keyboard | jsdom | Tab visits every enabled Item and Parent in order (no roving); Space toggles and dispatches once with a native `click`; arrows/Home/End do nothing (`fireEvent.keyDown`, no handler). |
| 3 | Sync action (both) | jsdom | `(next, details)` shape: `next` is a fresh array in document order; `details.reason === "activate"`, `details.added` / `removed` one element, `details.event.type === "click"`; clicking a disabled Item, any Item under `Root disabled`, or a click already `defaultPrevented` by a pass-through `onClick` never dispatches. |
| 4 | Async action (both) | jsdom | While unresolved: `data-pending` on Root and the clicked Item only; its DOM `checked` and `data-checked` flipped; other Items unchanged. After resolve: pending gone, value committed / parent updated. |
| 5 | Rejection (both) | jsdom | Uncaught: `ErrorCatcher` receives the error; uncontrolled internal value unchanged on remount. Controlled, caught inside without updating: DOM `checked` and `data-checked` reverted, no `data-pending`. Uncontrolled caught-inside: commits. |
| 6 | Overlap | jsdom | Click A then B (A slow): `O={a,b}` throughout; final committed `{a,b}` (uncontrolled); controlled functional-update wrapper ends on `{a,b}` with B resolving first; click A twice fast: A not `data-pending` after the second click while Root is, final committed `{}`. Settled changes (#150, uncontrolled): A rejects before / after B resolves: committed `{b}`, A's rejection reported, no boundary. |
| 7 | Superseded rejection (both) | jsdom | A rejects after B resolved, and while B is pending: `reportError` (stubbed) is called once with the error and the boundary is not reached; B's outcome unaffected. |
| 8 | Suspending content (both) | jsdom | Dependent `<Suspender />` keyed on the consumer's state updated in the action: old content stays, no fallback, Root `data-pending`; after resolve, new content. |
| 9 | Value model | jsdom | Duplicates in `value` / `defaultValue` ignored; a value with no Item survives an Item toggle and is absent from `FormData`; `next` order follows DOM order after Items are reordered; set-equal controlled `value` in a different order does not re-base optimistic state. |
| 10 | Parent derivation | jsdom | Over three values: none → unchecked, no dash; one → `el.indeterminate === true`, `data-indeterminate=""`, `el.checked === false`; all → `checked`, no dash; `values={[]}` → unchecked, no dash, click dispatches nothing. Derivation follows an Item click **immediately** (while pending) and reverts on rollback. |
| 11 | Parent cycle (both) | jsdom | mixed → dispatch `added` = missing values; checked → `removed` = all values; unchecked with a committed partial history → `added` = that partial; unchecked without history → `added` = all; a partial state that only ever rolled back is not restored; memory seeded from `defaultValue` at mount. |
| 12 | Parent pending | jsdom | Parent `data-pending` while any of its values differs between optimistic and committed; not when an unrelated Item is pending. |
| 13 | Parent, SSR | jsdom | `renderToString` emits `data-indeterminate=""` and no `aria-checked`; after `hydrateRoot`, `el.indeterminate === true`, no console error. |
| 14 | Parent, pseudo-class | browser | `:indeterminate` matches after mount, flips with an Item click immediately, and matches again after a rollback, in all three engines. |
| 15 | Section parents | jsdom | Two Parents over disjoint subsets derive and dispatch independently; a Parent over the union behaves as a grand-parent. |
| 16 | Group `required` | jsdom | `required` on Root: every Item has `required` while nothing is checked, none once one is; follows optimistic state (pending uncheck of the last box adds it; rollback removes it); never on the Parent; no `aria-required` on the fieldset; `form.checkValidity()` false while empty, true after a check; a disabled group never blocks. |
| 17 | Group `required`, user-facing | browser | After a blocked `requestSubmit()`, every Item matches `:user-invalid` and `validationMessage` is non-empty; after checking one, none matches and the form submits; before hydration (`renderToString` only) a form with one box checked by the user is still blocked by another box. |
| 18 | Forms | jsdom | `FormData.getAll(name)` lists checked values in document order; a `form="ext"` Root posts and resets with the external form; the Parent contributes nothing. |
| 19 | Platform: mount reconciliation | jsdom | `renderToString` with `{a}`, set `.checked` on "c" before `hydrateRoot`: one dispatch `reason: "platform"`, `event === undefined`, `added: ["c"]`; StrictMode still one; a controlled parent that refuses → DOM back on `{a}` after settle; late-mounting Items under a Suspense boundary resolved after hydration: one additional dispatch for the boundary's Items; two such Items in one commit → one. |
| 20 | Platform: pre-hydration Parent click | jsdom | SSR mixed Parent, set its `.checked = true` before `hydrateRoot`: one dispatch with `added` = its missing values (never a dispatch for "one box"); DOM Items checked after the sync flush; SSR checked Parent set to `false` → `removed` = all its values; a Parent mounting late reports through the late path. |
| 21 | Platform: partial hydration works | jsdom | Suspense boundary between Root and some Items, Root hydrated, boundary dehydrated: a click on a hydrated Item dispatches normally and throws nothing; after the boundary hydrates its Items show the right `data-checked` (attribute sync) and no partial-hydration warning is logged. |
| 22 | Platform: form reset | jsdom | Check two, `form.reset()` → one dispatch `([], { reason: "platform", event: reset, added: [], removed: [both] })`; uncontrolled commits; controlled parent that ignores → DOM re-checks after settle; `<form action>` success auto-resets and dispatches the same way; a reset that both checks and unchecks carries `added` and `removed`; cancelled `reset` → nothing; `Root disabled` still dispatches; reset whose target set-equals the base → nothing. |
| 23 | Platform: base comparison and `equals` | jsdom | Two synchronous `form.reset()` while a reset is pending dispatch once; a reset whose `readDefault()` is a *new Set with the same members* as the base dispatches nothing (guards the `equals` option: `Object.is` would dispatch). |
| 24 | Platform: reset target by mode | jsdom | Uncontrolled: after a new `defaultValue` (inside a transition), reset returns to it and dispatches; controlled: reset returns to mount-time values and the parent is notified. Reset inside a burst (#150 review, uncontrolled, `defaultValue=[]`): check A (resolves), uncheck A (pending), check B (resolves), reset (`([], "platform", removed: [b])`, resolves), then A's uncheck rejects: nothing checked, the rejection reported, no boundary. |
| 25 | `preventDefault` warning | jsdom | `details.event.preventDefault()` inside the action logs the dev warning once per element (Item and Parent); the action still ran. |
| 26 | `details` is virtual | jsdom | `JSON.stringify(details) === '{"reason":"activate","added":["a"],"removed":[]}'`; `details.event` is the native event; a fake Server Function receives the same shape. |
| 27 | Function props | jsdom | `className` / `style` on Root, Label, Item, Parent receive the documented state (`value` optimistic on Root, `checked` / `indeterminate` / `pending` per part); `children` on Root and Label receive Root state; Item and Parent have no `children`. |
| 28 | `render` element | jsdom | `render={<input id="x" className="y" />}` on Item keeps `type="checkbox"`, `name`, `checked` and the handler, concatenates `className`, forwards `ref`; on Parent strips `name` / `required` / `indeterminate` / `aria-checked="mixed"`; `render={<fieldset />}` on Root; dev warning when the mounted tag is not `INPUT` / `FIELDSET`. |
| 29 | Post-await rule | jsdom | Controlled wrapper that awaits then `startTransition(setValue)` (functional) works end to end. |
| 30 | `transition` prop | jsdom + browser | Item and Parent render with and without `transition`; Root and Label have none. Browser: an Item mounted in a `startTransition` with `transition` absent calls `document.startViewTransition` zero times. |
| 31 | Transition types | jsdom | Observed through a consumer `<ViewTransition default={{ "fsui-checkbox-group-check": …, "fsui-checkbox-group-uncheck": … }}>` sentinel as in the Accordion tests, or by spying `addTransitionType`: check → `-check`, uncheck → `-uncheck`, mixed reset → both. |
| 32 | Directive | build | `dist/checkbox-group/*.mjs` for Root, Label, Item, Parent and context begin with `"use client"`; `index.mjs` does not. |
| 33 | Dev warnings | jsdom | `value` with `defaultValue`, mode switch (shared hook); Item / Parent / Label outside a Root throw; **no** warning when neither `value` nor `defaultValue` is given; **no** partial-hydration warning. |
| 34 | AX tree | browser (Chromium, CDP) | The fieldset is a `group` named by the legend; the Parent reports `checked: "mixed"` after mount; Items in an empty required group are exposed as `invalid` (Chromium has no `required` property for a checkbox, not even with `aria-required`), after a check not. |
| 36 | Parent and disabled Items (both) | jsdom | From mixed, the Parent checks only the enabled values and a disabled unchecked Item stays unchecked; "uncheck all" keeps a checked disabled Item and the Parent then shows unchecked; the restore memory is over the enabled values; every value disabled → the Parent acts on all; an Item's `disabled` prop changing re-registers; `Root disabled` leaves the derivation unchanged; SSR counts disabled Items and hydration settles without a dispatch or a warning; a Parent checked / unchecked before hydration checks only the enabled values / keeps a checked disabled Item; a late Parent hydrating after a disabled Item registered compares with the server's derivation. |
| 37 | `required` edge cases | jsdom | A checked disabled Item does not satisfy it; a value with no Item does not; the server HTML counts any checked value and hydration corrects it. |
| 38 | Parent `autocomplete` | jsdom | The Parent renders `autocomplete="off"` on the client and in `renderToString`; form-state restoration of the Items only (simulated before `hydrateRoot`) removes just them. |
| 39 | Reset by mode | jsdom | Uncontrolled: a value with no Item returns to `defaultValue` too (Parent over `["a", "ghost"]`, click, `form.reset()` → `removed: ["a", "ghost"]`); controlled: a Parent whose React reset target is stale shows its derivation after a reset. |
| 35 | Engines | browser | Tab order and Space across Chromium, Firefox, WebKit (WebKit: Option+Tab note); `:user-invalid` after a submit attempt in all three. |

jsdom facts to rely on (from the Checkbox and RadioGroup suites): `input.click()` on a checkbox
fires React's `onChange`; `form.reset()` fires `reset` and restores `defaultChecked`; React's
automatic reset after `<form action>` works; jsdom's cancelled activation for checkboxes is buggy
(`memo/developer/switch-checkbox.md`), so the pass-through-cancel row asserts "no dispatch" only
and the DOM state in browser mode.

---

## 14. Implementation notes

### 14.1 Files

```
packages/ui/src/checkbox-group/
  index.ts                     # no directive; namespace + type re-exports; imports platform-attributes
  checkbox-group-context.ts    # "use client"
  checkbox-group-root.tsx      # "use client": fieldset, state, reset listener, reconciliation, required
  checkbox-group-label.tsx     # "use client": <legend>
  checkbox-group-item.tsx      # "use client": <input type="checkbox">
  checkbox-group-parent.tsx    # "use client": the mixed-state <input type="checkbox">
  checkbox-group.test.tsx
  checkbox-group.browser.test.tsx
packages/ui/src/internal/
  use-native-group-reconciliation.ts   # add `equals?: (a: T, b: T) => boolean` (default Object.is)
  sync-presence.ts                     # attribute-presence sync on hydration; shared with RadioGroup (review L5)
  use-fieldset-group.ts                # "use client": the Root's fieldset wiring (conventions 3.8; shared with RadioGroup)
  group-member.ts                      # "use client": groupMemberProps, the Item's owned input layer (shared with RadioGroup)
  use-item-order.ts                    # "use client": the Items' document order in state (shared with ToggleGroup)
  value-set.ts                         # no directive: toSet / setsEqual / applyPatch / sortByOrder / EMPTY_SET (shared with Accordion and ToggleGroup)
```

Also: `src/index.ts` re-export, `tsdown.config.ts` entry, `package.json` `./checkbox-group`,
`directives.test.ts` rows, `transition-types.ts` accepts `"checkbox-group"`.

### 14.2 Context

```ts
interface CheckboxGroupContextValue {
  readonly name: string;
  readonly form: string | undefined;
  /** `required` while no enabled Item's value is checked (`optimistic.size === 0` until the Items registered): rendered as native `required` on every Item. */
  readonly required: boolean;
  /** Values whose every mounted Item has its own `disabled` prop (`Root disabled` not counted); a Parent leaves them alone (6.2). Empty until the Items registered. */
  readonly disabledItems: ReadonlySet<string>;
  /** Stable. Each Item calls it from a layout effect with its value and its own `disabled`; returns the unregister function. */
  readonly registerItem: (value: string, disabled: boolean) => () => void;
  readonly optimistic: ReadonlySet<string>;
  /** For per-part pending only; no part renders it. */
  readonly committed: ReadonlySet<string>;
  readonly pending: boolean;
  readonly disabled: boolean;
  /** The Root state (`CheckboxGroup.Label`'s function props read it). */
  readonly state: CheckboxGroupRootState;
  /** Uncontrolled: the latest `defaultValue` as a set (Items mirror `has(value)` into `defaultChecked`); `undefined` when controlled. */
  readonly defaultValue: ReadonlySet<string> | undefined;
  /** Item click. No-op if `optimistic.has(value) === checked`. Neither checks `disabled` nor `defaultPrevented` (the Item's guard does). */
  readonly toggle: (value: string, checked: boolean, event: Event) => void;
  /** Parent click: a whole patch. No-op if it changes nothing against optimistic. */
  readonly apply: (patch: { added: readonly string[]; removed: readonly string[] }, event: Event) => void;
  /** Wraps `useNativeGroupReconciliation`'s (snapshots late members' `checked` first, 8.1); Items and Parents call it from their mount layout effect. */
  readonly onItemMounted: (element: HTMLInputElement | null) => void;
  /** Parent mount: the DOM differs from the derivation; folded into the next `readCurrent()` (8.1). Call before `onItemMounted`. */
  readonly reportParent: (values: readonly string[], checked: boolean) => void;
}
```

### 14.3 Root

- `useFieldsetGroup({ component: "CheckboxGroup.Root", name, disabled, required })` (conventions
  3.8: the fallback name, the Field defaults, the fieldset ref and `rootRef`); `useMemo` set
  normalisation of `value` and `defaultValue` (`toSet` from `internal/value-set.ts`).
- `useControllableAction<ReadonlySet<string>, CheckboxGroupValueChangeDetails>({ controlled,
  defaultValue, initialValue: EMPTY, action: action && ((next, details) => action(fromSet(next),
  details)), transitionTypes: (_n, _p, d) => […], reducer: the function of 5.2 (`applyPatch`
  from `internal/value-set.ts`, or `next` whole for the form reset),
  warn: { component: "CheckboxGroup.Root", prop: "value" } })`. `fromSet` sorts by the document
  order of the group's Items read from the fieldset at call time (5.1).
- `dispatchPatch` (5.2) and `base()` with the explicit null check.
- Item registry (6.2, 7; the document-order half is `useItemOrder`, `internal/use-item-order.ts`,
  conventions 3.8, shared with ToggleGroup): `registerItem(value, disabled)` (stable; each Item calls it from a
  layout effect, returns the unregister function) writes a `Map<token, { value, disabled }>` ref
  and publishes a `Map<value, hasEnabledItem>` state only when the summary changes; `null` until
  an Item registered. `disabledItems` (context) is the set of values with no enabled Item;
  `required` (context) is `required && (items === null ? optimistic.size === 0 :
  ![...optimistic].some((v) => items.get(v) === true))`.
- `useNativeGroupReconciliation<ReadonlySet<string>>({ element, readCurrent, readDefault, base,
  equals: setsEqual, onPlatformChange: (next, event) => dispatchPatch(diff(base(), next),
  "platform", event) })`. `readCurrent()` = Items' `checked` laid over `base()` (or over the
  late-member snapshot, 8.1), then apply and clear parent reports through `enabledValues(report.values,
  disabledOf(registry))`; `readDefault()` = Items' `defaultChecked` laid over `defaultValue`
  (uncontrolled) or `base()` (controlled). `onItemMounted` wraps the adapter's: when the Root
  has already reconciled, it snapshots `readDom("checked")` once per commit and clears it in a
  microtask.
- Renders `<fieldset disabled form data-pending data-disabled>` through `use-render`; tag warning.

### 14.4 Item

`RadioGroup.Item` with `type: "checkbox"`, `checked = ctx.optimistic.has(value)`, `pending` per
5.3, `required: ctx.required` in `libraryProps`, `aria-checked: undefined`,
`onChange: guardCheckableChange(e, () => ctx.toggle(value, !checked, e), "CheckboxGroup.Item")`,
`defaultChecked: ctx.defaultValue?.has(value)` to the hook, attribute presence sync in
`onItemMounted`. `transitionTypes` are the Root's. After `useNativeChecked`, a layout effect
registers the Item with the Root: `useLayoutEffect(() => registerItem(value, disabledProp),
[registerItem, value, disabledProp])`. Cost: the registrations publish the summary as state, so
a group pays **one extra layout-time render at mount** (one per group, not per Item: the
publish de-duplicates by comparing the summary), and one more whenever an Item's own `disabled`
changes or Items mount or unmount.

### 14.5 Parent

- `effective = hydrating ? values : enabledValues(values, ctx.disabledItems)` (`hydrating` from
  `useSyncExternalStore` with a server snapshot of `true`), memoised; derivation of 6.1 from
  `effective` and `ctx.optimistic`; `pending` from `ctx.committed` over `values`.
- `memory` in a `useRef<readonly string[] | null>`; `useLayoutEffect` on `[ctx.committed,
  effective]` updates it when the committed intersection is partial; initialised in the same
  effect at mount.
- Own `useFormReset(node, …)` on the input: after a reset, if `el.checked !== checked`, write the
  derivation back (8.2).
- `useNativeChecked({ type: "checkbox", component: "CheckboxGroup.Parent", checked, indeterminate,
  group: true, onItemMounted: (el) => { if (el && el.checked !== checked) ctx.reportParent(values, el.checked);
  syncPresence(...); ctx.onItemMounted(el); }, defaultChecked: ctx.defaultValue === undefined ? undefined : derivedOver(effective, ctx.defaultValue) })`.
- `onChange`: `guardCheckableChange(e, () => ctx.apply(cyclePatch(), e), "CheckboxGroup.Parent")`
  where `cyclePatch` is the table of 6.2 over `effective` (`memory ∩ effective` when restoring).
- `libraryProps`: `type: "checkbox"`, `name: undefined`, `value: undefined`, `required: undefined`,
  `autoComplete: "off"`, `checked`, `defaultChecked: undefined`, `indeterminate: undefined` (stripped),
  `aria-checked: undefined`, `disabled`, `form: undefined`, the four `data-*`.

### 14.6 Dev warnings

Shared ones (both props / mode switch, `preventDefault()`, wrong tag); parts outside a Root throw;
duplicate Item `value` within a Root (once, from the Root's layout effect that reads the Items,
dev only). Deliberately
absent: neither `value` nor `defaultValue`; a `value` with no matching Item; a Parent whose
`values` include values with no Item; partial hydration.

### 14.7 Example app and docs site

Example: the toppings group of 2.1 against a fake 800 ms API with a failure toggle, a Parent, and a
form section with group `required` and a submit button, so the restore cycle (10.4), the Parent
rollback to mixed (10.3), the dynamic `required` (10.6) and the automatic reset (10.7) can be seen
in real engines. Docs page: anatomy, props tables for the four parts, the two channels, the
`required` limitation before hydration, the "no `aria-required` on `group`" note with the Label
recipe, and the "`next` is a set" guidance.

---

## Decisions recorded (product owner, 2026-10-17)

All eight questions raised by the proposal were accepted as recommended; the conventions
feedback above was applied to `design/conventions.md` the same day.

1. **`CheckboxGroup.Item` is its own part**; a plain `Checkbox` inside a `Root` is not a member
   (section 1). The context sketch in Checkbox §10 item 2 is withdrawn.
2. **`Parent` is the part name and `values` lives on the Parent** (several Parents per group);
   no `allValues` on the Root.
3. **APG restore cycle by default** (unchecked → last committed partial, section 6.2). No
   `cycle` prop for now; it can be added without a breaking change.
4. **Group `required` is dynamic native `required` on the Items** (section 7, option C), with the
   browser's wording and the pre-hydration over-blocking accepted, and **no `aria-required` on the
   fieldset** (not allowed on role `group`).
5. **`details.added` / `details.removed`** are the details shape (sections 2.6, 3.1).
6. **`next` is in document order of the Items**, set equality everywhere (section 5.1).
7. **No partial-hydration warning** for CheckboxGroup (section 8.3); one Suspense boundary is a
   docs recommendation for simplicity only.
8. **`transition` stays on `Item` and `Parent`** for parity with the other native-input parts.
9. **A Parent ignores disabled Items** (review M2, decided 2026-10-17 after the implementation
   review): a click toggles only the values of enabled Items, and the derived checked / mixed
   state is computed over enabled Items only; when every value has only disabled Items the Parent
   acts on all of them; hydration renders count disabled Items as the server does (section 6.2).
   Folded with the other review corrections: the Parent's `autocomplete="off"` (8.1), the
   uncontrolled reset reading from `defaultValue` (8.2), `required` over enabled Items (7), the
   engine-dependent AT exposure (7), `RootState.value` as of the Root's last render (3.1, 5.1),
   and the duplicate-value warning from the Root's layout effect (14.6).

## Amendment: `aria-controls` on the Parent (#113 A2, 2026-10-24)

Status: architect decision, recorded in section 9; no implementation. The library does not emit
`aria-controls` from `CheckboxGroup.Parent` to its Items. Reasons in section 9: the `<fieldset>` /
`<legend>` grouping already exposes the relationship, AT support for `aria-controls` is thin, and
the attribute would cost per-Item ids plus a post-mount DOM write on the Parent. The prop is not
owned, so a consumer can add it by hand. Nothing to add to the #113 implementation list.

---

# number-field.md: test plan, implementation notes, review corrections, decisions

## 14. Test plan

`packages/ui/src/number-field/number-field-format.test.ts` (pure), `number-field.test.tsx`
(jsdom) and `number-field.browser.test.tsx` (Chromium, Firefox, WebKit). "both" =
`describe.each` over uncontrolled and the two controlled wrappers (adopt steps; update on
commit success). jsdom has full ICU (`Intl.NumberFormat` for every locale in 5.3, probed) and
native constraint validation for `type="number"` (`rangeUnderflow` / `rangeOverflow` /
`stepMismatch` / `valueMissing` / `customError`, `validationMessage` "Constraints not
satisfied", probed), which keeps the validity rows in jsdom; it has no `:user-invalid` (Field's
fallback), no `ariaNotify` (a stub covers the `ariaNotify` branch; without it nothing is
announced), no layout; `setPointerCapture` is polyfilled by `vitest.setup.ts` if absent; the
hold uses fake timers; the wheel row dispatches a `WheelEvent` on the input.

### 14.1 jsdom

| Area | Tests |
| --- | --- |
| Parser and formatter (pure) | The 5.3 matrix: round trips `format(parse(format(n))) === format(n)` for each locale and style; strict grouping (`1,5` `en` → unparsable; `1,234` → `1234`; `1.5` `de` → unparsable; `1.234,5` `de` → `1234.5`; `1 234,5` `fr` with U+202F and with a plain space; `1'234.5` / `1’234.5` `de-CH`; `12,34,567` `en-IN`); digits (`١٢٣` → `123`, `١٢.٥` with an ASCII `.` under `ar`, full-width `１２` → `12`, `२` with `deva`); bidi controls stripped; signs (`-1`, `−1`, `(1)` accounting, trailing minus where the locale formats it, `+1`); percent (`50` and `50%` → `0.5`; `0.5` → `0.005` **with `maximumFractionDigits: 1`**, and `0.01` with the percent default of `0`, per 5.4); affixes at the edges in every display (`€ 1,50`, `1,50 €`, `EUR 1.50`, `eur 1.50`, `1.50 euros`, `1.50 euro`; `12 km`, `12 kilometers`) and **unparsable in the middle** (`1€234` `fr-FR`); rounding to the resolved fraction digits (`1.999` `EUR` → `2`; `JPY` → integers; percent to two more digits); empty / whitespace → `null`; garbage → unparsable; `compact` warns. Stepping (5.5): the platform rows (`1.5` up → `2`, down → `1`; empty with `min 3` up / down → `3`; empty no `min` down → `-1`; at `max` clamps; `0..5` by `2` tops at `4`, End gives `4` and `+` from `4` changes nothing; `0.1` steps round; `largeStep` whole and fractional multiples); a step finer than the format (`step 0.001` in `EUR`) is rounded to the format by the Root. |
| Roles and ARIA | The section 1 HTML: Root `role="group"` with `aria-labelledby` = Label id (+ consumer tokens first); Label `for` = visible input id; visible input `type="text"`, no `role`, no `aria-value*`, no `aria-roledescription`, `inputmode` `numeric` / `decimal` by the 8.5 rule and replaced by a consumer `inputMode`; hidden input after it with `type="number"`, `name`, `min` / `max` / `step` / `required`, `aria-hidden`, `tabindex="-1"`, no `name` on the visible; buttons `type="button"`, `tabindex="-1"`, `aria-controls`, default `aria-label`s and a consumer override; `render={<input type="number" />}` warns; dev warnings for `NaN`, `min > max`, `lang` disagreement (`document.documentElement.lang = "de"` with no `locale`), `aria-label=""` on a button. |
| Typing (both) | `user.type("42")`: the draft per keystroke (DOM value), no dispatch, no `data-pending`; Tab → `valueChangeAction(42, { reason: "activate", source: "input" })` and `valueCommitAction(42, …)` once each with the `focusout` event; Enter → the same with the `keydown`, not `defaultPrevented`; unparsable text reverts the DOM value with no dispatch; empty → `null`; `1.0` in a field holding `1` → no dispatch, re-formatted; a value out of range or off grid dispatches as typed and the hidden input reports `rangeOverflow` / `stepMismatch`; `readOnly` typing is impossible (native) and `disabled` dispatches nothing (a draft "committed" while inert is cleared); Enter with `isComposing` **or `keyCode: 229`** does nothing. |
| Keyboard (both) | Each 4.2 row: ArrowUp / Down, Shift+Arrow, PageUp / Down, Home / End with and without bounds (prevented only when handled; End lands on the largest grid point `≤ max`), from a draft (the draft is parsed first), from empty; each a step + commit with the `keydown` and `source: "keyboard"`; auto-repeat (`repeat: true`) dispatches per event; **Shift+Home / Shift+End with bounds set are not handled and not prevented**; Ctrl / Meta + Arrow not handled; keys on a button do nothing. |
| Hold | Fake timers: `pointerdown` on `+` is `defaultPrevented`, captures, steps once (`event` the `pointerdown`), no commit; at 400 ms a second step, then every 60 ms, each with `event: undefined`; `pointerup` commits once with the final value (`source: "increment"`, the `pointerup` event); `pointercancel`, `lostpointercapture` and window `blur` each end the hold and commit; a hold reaching `max` ends itself and commits with `event: undefined`; `+` then `−` back to the start commits nothing; a second pointer is ignored; `contextmenu` during the hold is prevented; a `click` with `detail: 0` and no preceding `pointerdown` steps and commits once; a `click` after a hold is ignored; `disabled` / `readOnly` / at-bound buttons do nothing and carry `disabled` + `data-disabled`; **the bound follows the draft**: `defaultValue 99, max 99`, type `50` → `+` is enabled and a press steps to `51`; `data-pending` lands on the button whose gesture is pending and not on the other. |
| Wheel | With `stepOnWheel`: a `wheel` with `deltaY: -1` on the focused input steps up, `+1` down, each `defaultPrevented`, each a step + commit with `source: "wheel"`; `deltaY: 0` does nothing and is not prevented; unfocused: nothing and not prevented; without the prop: nothing; the listener is non-passive (`addEventListener` spied with `{ passive: false }`). |
| Hidden input and the mirror | After every path (typed commit, key, hold, reset, rollback, controlled change) `hidden.value === String(shown)` (`""` for `null`) synchronously in the event and after the commit; the visible input's `validationMessage` equals the hidden one's and `validity.customError` tracks it; valid → `""`; a changed `max` prop re-mirrors; the hidden input's `defaultValue` attribute equals the reset target (latest `defaultValue` uncontrolled; mount-time controlled) and it carries `autocomplete="off"`; `invalid` dispatched on the hidden input is `defaultPrevented`, on the visible not (bare); `hiddenInputRef` reaches it. |
| Steps and commits (both) | A step runs inside a transition (a parent `useTransition` probe never reports it urgently; `data-pending` is the only sign); without a `valueChangeAction` a step starts no transition and `stepHeld` holds the text until the commit; a `"dismiss"` step after a rejected commit (uncontrolled) is outside the transition (the `await undefined` yield). |
| Async commit (both) | Deferred `valueCommitAction`: `data-pending` on Root, Input and the source button; the text, the hidden value and `state.value` hold the gesture value; uncontrolled committed state unchanged (a `children` probe) until resolve; then committed. |
| Rejection (both) | The catcher above Root receives it and the field is gone; uncontrolled: `valueChangeAction(prev, { reason: "dismiss", source: null, event: undefined })` once; controlled: no `"dismiss"`; a retry boundary remounts with `defaultValue` / the adopted value; caught-inside commits; **mounted rollback** (update-on-success parent catching inside): `data-pending` leaves, the text and the hidden input return to the parent's value; a draft open at the rollback stays open and commits later. |
| No snap | Between two ticks of a hold with a synchronous `valueChangeAction` (settled), the text still shows the last tick; an adopt-steps parent whose content suspends: after release the text shows the gesture value until the content resolves, never the pre-gesture value; a non-adopting controlled parent: follows during the hold, returns to `value` after release once. |
| Overlap, superseded rejection (both) | Two commits with a slow action (a key press, then typing + blur): `data-pending` stays, the latest wins; the older's rejection is passed to `reportError` (stubbed) once, at once, after and while the newer is pending, never to the catcher. Cross-channel: a superseded commit rejection while a step pends, and a superseded step rejection while a commit pends, are each reported at once (conventions 2.4, #145). |
| Suspending content (both) | A controlled adopt-steps parent's content keyed on the value suspends on a step: old content stays, no fallback above, `data-pending`; then new content (`await act(async …)`). |
| Platform path (both) | Mount reconciliation: `renderToString`, set the visible input's value to `"3"` before `hydrateRoot` → one `"platform"` step + commit (`source: null`, `event: undefined`), hidden written to `3`, StrictMode still one; the input focused at hydration → adopted as the draft, no dispatch, **also when the text is unparsable (`"12,"` stays under the caret, review M1)**; a value formatted by another locale (`"1.234,5"` under `en`) → no dispatch and the text re-synced to `"1,234.5"`. Form reset: `form.reset()`, `<button type=reset>`, automatic reset after `<form action>` → the visible `defaultValue` attribute equals `format(target)` at the `reset` event, the hidden resets natively, one step + commit with the `reset` event, a cancelled reset dispatches nothing, a refusing controlled parent is re-synced; a draft open at reset is cleared. |
| Forms | `FormData` has `name` = `String(value)`, absent when `disabled`, `""` when `null`; `form` attribute honoured; Enter's implicit submission (a `submit` listener) sees the committed value in `FormData`; the text is never posted. |
| Inside a Field | The 7.4 table. |
| Announcements | `ariaNotify` stubbed on `Element.prototype`: called on the visible input once per key press, wheel event, click activation and hold release (not per tick), with `state.text` or the consumer's `announce` string, never when it returns `null`, never for a typed commit; stub removed: the step still happens and no live region is inserted (#113 A1). |
| Function props / `render` | Every part's documented state (`NumberFieldState` on Root / Label / Input, `NumberFieldButtonState` on the buttons with `disabled` true at the bound); `render={<input type="search" />}` keeps the handlers and the hidden sibling; button `render={<a />}` gets no `type`; `className` / `style` merge; `aria-label` on a button replaces the default and `aria-labelledby` removes it; `onCompositionStart` / `onCompositionEnd` on the Input pass through and fire. |
| Post-await rule | A controlled parent updating after its own `await` inside `startTransition` in `valueCommitAction`. |
| Directive | Every file under `src/number-field/` except `index.ts`, `number-field-format.ts` and `number-field-arithmetic.ts` begins with `"use client"`. |
| Types | `value` / `defaultValue` accept `number \| null`; `transition`, `inputValue`, `aria-valuenow`, `required` / `min` on `Input` are not props (type test); `NumberFieldValueChangeDetails.source` union; `hiddenInputRef` typed `Ref<HTMLInputElement>`. |

### 14.2 Browser mode (`number-field.browser.test.tsx`)

| Row | Assertion | Engine branches |
| --- | --- | --- |
| Real keys and typing | Real ArrowUp / ArrowDown / PageUp / PageDown / Home / End on the focused input change the text per 4.2 and leave the caret where it was for unhandled keys (Home / End without bounds move the caret); typing `1,5` under `locale="de-DE"` then Tab commits `1.5` (`hidden.value === "1.5"`), under `en-US` reverts. | none |
| Native report, bare | In a `<form>` with no Field: type `0` with `min={1}`, click submit: the browser focuses the **visible** input (`document.activeElement`), `:user-invalid` matches it, the hidden input never received focus (the proxy for "no 'not focusable' console error", which page JS cannot observe; the CDP `Log` check is #77); the submission did not happen. The row ends by committing a valid value, because Firefox's bubble stays over the page and swallows the next click until the control is valid (6.2). | none; the message text differs per engine and is asserted non-empty |
| Inside a Field | The section 7 browser row. | none |
| Enter submits with the new value | A `Form.Root` with an action spy: type `12`, Enter: the action runs once with `quantity=12`. | all three; document any engine where the sync flush lands after submission (Combobox's row passed on all three) |
| Wheel | With `stepOnWheel` and the input focused, a real wheel over it changes the value and the page does not scroll; unfocused, the page scrolls and the value stays; without the prop the page scrolls either way. | none |
| Real hold | A real pointer press on `+` held for a measured duration: the value advanced by `1 + ceil((held − 400) / 60)` ± 1 ticks (the row measures the press duration rather than assuming it, 5fe8ae6), one commit at release; focus never left the input (`document.activeElement` before and after); no text selection; `:focus-visible` is false on the button. **Not written**: touch emulation (a press opens no keyboard and no context menu); vitest's `userEvent` has no touch hold, CDP `Input.dispatchTouchEvent` can drive it (#77). | touch row `browserName === "chromium"`, when written |
| Announcements | `ariaNotify` spied on the input: one call per key press with the formatted text; one per hold release. | `supportsAriaNotify`; otherwise: the step happens, no live region |
| Accessibility tree (Chromium) | CDP: the input is a `textbox` named "Quantity" with no `valuenow`; the Root a `group` named "Quantity"; the buttons named "Increase" / "Decrease"; the hidden input absent from the tree. | `browserName === "chromium"`; others assert attributes |
| Pre-hydration typing | `renderToString` into an `iframe srcdoc`, type with the real keyboard before `hydrateRoot`: the text survives hydration; blurred before hydration → one `"platform"` step + commit; still focused → adopted as the draft, committed at blur. | WebKit may use the keyboard fallback (Combobox L4 rule) |
| Firefox restoration | **Moot, not written**: both inputs are `autocomplete="off"` (6.1), so Firefox restores neither across a reload; Slider's equivalent row mostly logs "not restored" for `srcdoc` frames anyway. Recorded here instead of a row (review S4). | — |
| IME | **Not written** (#77): composition through CDP `Input.imeSetComposition` / `Input.insertText`, or Combobox's browser pattern: the draft follows the composition; Enter during composition does not commit; `compositionend` then Enter commits; a WebKit-style confirming Enter with `keyCode 229` commits nothing. jsdom covers the `isComposing` and `keyCode 229` guards. | Chromium, when written |
| No `startViewTransition` | Spy before a key press, a hold, a typed commit: zero calls (no boundary exists). The rejected-commit case is not written (#77). | none |

Firefox runs the browser files serially (`fileParallelism: false`, #62); the hold row would
otherwise receive another file's pointer input.

Two test hazards the Field rows work around, recorded because they are properties of the
platform and of every Field control rather than of NumberField: a click on Save right after
typing blurs the input on `mousedown`, the Field shows the error (`:user-invalid` after change +
blur) before `mouseup`, and with no reserved space the button moves away from the pointer so no
click happens (the rows tab out first; the Field docs page now says to reserve the error's
space); and Firefox's validation bubble swallows the next click (6.2). The "parent
`useTransition` probe" row of the design is approximated: the step's awaited action keeps
`data-pending`, and the suspending-content rows prove the step renders in a transition.

---

## 15. Implementation notes

```
packages/ui/src/number-field/
  index.ts                        # no directive; namespace + types; imports platform-attributes
  number-field-context.ts         # "use client": NumberFieldContext (state, bounds, stepBase, pendingSource, ids, visibleRef / hiddenRef, step()/commit()/beginHold()/commitDraft(), syncHidden, onItemMounted, field slice)
  number-field-root.tsx           # "use client": useControllableAction (commit), useActionTrigger (steps), draft / live / hold / stepHeld / pendingSource, stepBase, formatter + parser (memoised), useFieldValueChange, reconciliation + reset (through hiddenRef), announcements, warnings
  number-field-label.tsx          # "use client": registers its id; for=
  number-field-input.tsx          # "use client": visible input (controlled text, handlers, wheel listener) + hidden input (uncontrolled, ref-written, invalid listener, autocomplete=off), syncHidden after every commit, useFieldControl with validityElement, onItemMounted
  number-field-increment.tsx      # "use client": `useStepButtonElement("increment", ...)`
  number-field-decrement.tsx      # "use client"
  use-step-button.ts              # "use client": the hold (timers, capture, release listeners), the click-without-pointer rule; `useStepButtonElement`, the element both buttons render (`disabledButton`, the owned `aria-label`, `data-*`), and the button prop types
  use-number-field-dev-warnings.ts # "use client": the Root's development warnings
  number-field-format.ts          # no directive: createNumberFormatter(locale, options) → { locale, format, parse, round, fractionDigits, allowsFractions, percent, warning }; the cache
  number-field-arithmetic.ts      # no directive: stepValue, stepBy, boundValue, isAtBound, keyStep (the key-to-step mapping of 4.2); unit-tested in number-field-arithmetic.test.ts
  number-field-format.test.ts, number-field.test.tsx, number-field.browser.test.tsx, number-field.types.test.tsx
packages/ui/src/internal/
  decimal.ts                      # no directive: decimalsOf / gridDecimals / roundTo, shared with Slider
  report-dropped.ts               # conventions 2.4: both hooks pass a superseded rejection (and a latest one after unmount) to reportError (the Root does nothing itself)
  announce.ts                     # directive-free (#129): announce(target, message, priority?) and canAnnounce(target): ariaNotify only (the fallback live region was dropped, #113 A1); shared with Combobox, focus-first-invalid and Toast
  field-context.ts                # FieldControlRegistration gains `validityElement?: () => ValidatableElement | null`
  use-field-control.ts            # the option, passed through to registerControl
  ../field/field-root.tsx         # reads validity / writes the slot on the validity element, `:user-invalid` on the element, mirrors after the slot write
```

- **Root.** `useControllableAction<number | null, NumberFieldValueChangeDetails>({ controlled:
  value, defaultValue: defaultValue ?? null, action: wrappedCommit, transitionTypes: () =>
  ["fsui-number-field", "fsui-number-field-commit"], warn: { component: "NumberField", prop:
  "value" } })`; `useActionTrigger({ ignoreWhilePending: false })` for steps. Each hook reports its
  own superseded rejections through `reportError` (conventions 2.4: a superseded commit's
  rejection while a step pends, or a step's while a commit pends, is reported at once; the
  shared `captureSuperseded` capture of #100 and its "before both hooks" order were removed
  with #145); `draft`, `live` (+ `liveSet` ref), `hold`,
  `stepHeld`, `pendingSource` as `useState`; `shownRef`, `liveRef`, `committedRef`,
  `gestureStart`, `commitId`, `lastReason` refs; `formatter = useMemo(() =>
  createNumberFormatter(locale, format), [locale, formatKey])` with `formatKey` a stable
  serialisation of `format`; the context value memoised on `shown`, `text`, `pending`,
  `pendingSource`, `hold`, bounds, flags and the stable functions (#48).
- **Input.** Visible: `value={text}`, `onChange` → `setDraft(e.target.value)`, `onKeyDown` →
  4.2 and Enter (`e.nativeEvent.isComposing` guard), `onBlur` → `commitDraft(e.nativeEvent)`;
  a layout effect adds the non-passive `wheel` listener when `stepOnWheel`. Hidden:
  `defaultValue={resetTarget}` (`String` or `""`), a layout effect with no deps that calls
  `syncHidden(shown)` (writes `.value` when different, then mirrors the validity message); a native `invalid`
  listener that `preventDefault()`s; registration with the Root (`registerHidden(el)` from the
  ref callback, returning the cleanup); `useFieldControl({ …, validityElement: () =>
  hiddenRef.current })` with `field.ref` merged into the visible input's ref; the inline
  `hiddenStyle` constant. `syncHidden` lives on the context so `step()` and the Input's effect share one writer.
- **Buttons.** `useStepButton(direction)`: `onPointerDown` (primary button, not disabled) →
  `preventDefault()`, `setPointerCapture`, `beginHold(direction, event)`; the hold's end
  listeners on the element (`pointerup`, `pointercancel`, `lostpointercapture`) and `blur` on
  `window`, attached at the press and detached at the end; `onClick` → if no pointerdown was
  recorded for this activation, `stepOnce(direction, event)` (step + commit); `onContextMenu`
  → `preventDefault()` while holding; `disabled = prop || ctx.disabled || ctx.readOnly ||
  isAtBound(direction)`, rendered through `disabledButton(render, disabled)` (conventions 1.2:
  native `disabled` on a host button, `aria-disabled` on a link or component render).
- **Reconciliation and reset** through `useNativeGroupReconciliation` as 6.4, `element` the
  registered hidden input; `onResetEvent` writes the visible input's `defaultValue`.
- **Announcements**: the Root calls `announceStep()` in `commit()` for `"activate"` commits
  whose `source` is not `"input"`; `announce.ts` as 8.3.
- **Dev warnings**: both / mode switch (hook), `NaN` / `Infinity` value, `min > max`, `lang`
  disagreement, `compact` / significant digits, `render` of the wrong type, a Thumb-style
  "part outside a Root" throw, `aria-label=""` on a button, a `name` on the Input (omitted from
  the type; a `render` element's `name` is a warning: it would post the text).
- **Field side**: `field-root.tsx`'s `validityElementOf(el)` becomes `registration.validityElement?.()
  ?? validityElementOf(el)` for reads and the slot write; the `:user-invalid` read stays on
  `validityElementOf(el)` (the registered element when it is a control); after
  `setCustomValidity` on a distinct validity element, `el.setCustomValidity(validityEl.validationMessage)`.
  Combobox, Slider and the native controls pass no `validityElement`, so nothing changes for them.
- **Docs site and example app.** Playground: a cart quantity with `+` / `−`, a fake 800 ms save
  and a failure toggle (rollback visible with an update-on-success parent), a euro price under
  `locale="de-DE"` with a locale switcher (`en-US`, `de-DE`, `fr-FR`, `ar-EG`), a percent field,
  a `Form.Root` with `min` / `max` / `step` errors and a server error. Docs page
  `packages/docs/src/pages/NumberFieldPage.tsx` at `/components/number-field` (nav entry after
  Slider in `navigation.ts` and the route in `App.tsx`), examples `NumberFieldQuantity.tsx`,
  `NumberFieldFormats.tsx`, `NumberFieldField.tsx` and `number-field.css` in `src/examples/`,
  with: the two-action table (Slider's, first concept), "typed text is committed on blur and
  Enter, never per keystroke", the parsing rules (strict grouping, percent, the locale
  warning and "pass `locale`"), the no-clamp rule with the hidden input's constraints, the
  keyboard table, the hold timing, the `stepOnWheel` note, the accessibility section (no
  spinbutton, why; the announcements; the two built-in labels and their override), the props
  tables for the five parts (hand-written from the declarations), the CSS recipe of 9.2, and
  the error section's sentences from Slider. `FieldPage.tsx`'s "FUNSTACK controls" list gains
  NumberField with the `validity.stepMismatch` example; `RoadmapPage.tsx` gains the entry.

---

## Review corrections (#67, 2026-10-18)

From `memo/reviewer/number-field.md` (review of c31588b..5fe8ae6, verdict "acceptable with
minor fixes") and the developer's notes in `memo/developer/number-field.md` ("Deviations" and
"Review fixes"); the fixes are in 6742cb0 (code and tests) and 36b48f4 (docs). Each item is
folded into the sections named; this table is the audit trail. The architect agrees with every
deviation the reviewer accepted; none is corrected here.

| Item | Correction | Section |
| --- | --- | --- |
| M1 | **Hydration overwrote a focused partial draft.** `readCurrent` parsed before it checked focus, so a user still typing `12,` or `-` at hydration had the text reset under the caret. Now the focus check comes first: a focused input's differing text is adopted as the draft whatever it parses to, and the blur resolves it. jsdom row added. | 4.5, 12.6, 14.1 |
| S1 | **A WebKit composition-confirming Enter committed the draft**: `compositionend` fires before that keydown, which has `isComposing === false` and `keyCode === 229`. Both are now checked (Combobox's guard). | 4.1, 14.1 |
| S2 | **Shift+Home / Shift+End jumped to the bound** instead of selecting text. Left to the browser when `shiftKey`; Shift+Arrow stays `largeStep`. | Decisions 8, 4.2, 14.1 |
| S3 | **The buttons' `disabled` ignored an open draft** while a press steps from it: `defaultValue 99, max 99`, type `50` → `+` stayed disabled. The Root derives `stepBase` (the parsed draft, else the shown value) and the buttons' bound follows it. | Decisions 9, 2.4, 3.3, 4.3, 14.1 |
| S4 | **Browser rows not written** (touch hold, IME, the Chromium "not focusable" console check through CDP `Log`, the rejected-commit `startViewTransition` case) are tracked in **#77**; the Firefox restoration row is moot (`autocomplete="off"` on both inputs) and is recorded in 6.1 and 14.2 instead. | 6.1, 14.2 |
| N1 | **Stepping did not round to the format**: `step 0.001` in a `EUR` field showed `€1.00` and posted `1.001`. `step()` rounds through `formatter.round`, so 5.4 holds for stepped values too. | Decisions 6, 2.4, 5.4, 5.5, 14.1 |
| N2 | **The hidden input lacked `autocomplete="off"`**: form-state restoration could restore it but not the visible text, posting an unseen value before hydration. Added; the restoration row is moot. | Decisions 11, 14; 6.1, 14.2 |
| N3 | **Affixes were replaced anywhere in the text**, so `1€234` under `fr-FR` became `1234` (the replacement space is a group separator there). Affixes and literals are stripped at the edges only (and inside the sign and parentheses); in the middle the text is unparsable. | Decisions 7, 5.3, 14.1 |
| N4 | **The fallback region was written in the task it was inserted** and a repeated text was not a change. It is cleared, written 100 ms later and cleared after a second. Superseded by #113 A1: the fallback region was dropped. | 8.3, 14.1, 15 |
| N5 | `onCompositionStart` / `onCompositionEnd` pass through `NumberField.Input` (the library installs neither); the details JSDoc and the docs say `event` is `undefined` on hold repeats and at a bound-ended hold. | 1, 2.4, 3.2, 14.1 |
| Deviations 1 to 11 | Accepted by the reviewer and folded: (1) End → the largest grid point `≤ max`; (2) an empty value skips the against-direction rule; (3) the hydration re-sync writes `visible.value` directly; (4) no hidden-input registry, refs through context with `onItemMounted`; (5) the parser's affix-level leniencies and bidi stripping; (6) `event` undefined on hold ticks; (7) Ctrl / Meta combinations not handled; (8) `deltaY === 0` ignored; (9) a consumer `aria-labelledby` omits the default `aria-label`; (10) a commit while `disabled` / `readOnly` clears the draft; (11) the percent test row needs `maximumFractionDigits: 1` for `0.5 → 0.005`. | 4.1, 4.2, 4.3, 4.4, 4.5, 5.3, 5.4, 5.5, 6.1, 8.4, 14.1 |
| Reports | **Firefox's bubble and `:user-invalid` persist while the user types a fix** (validity follows the committed value): recorded as a known difference in 6.2 with an open question below, no change now. **Implicit submission needs a submit button** (the hidden number input is a second field): correct platform behaviour, documented in 4.1 and on the docs page. **The Field layout shift under a click** is a property of every Field control; the Field docs page notes it, the rows tab out first. **Combobox and `focus-first-invalid.ts` keep their own announcements**; migrating them onto `announce.ts` is the optional part of #77 (done at #129). | 4.1, 6.2, 8.3, 14.2 |

---

# progress.md: test plan, implementation notes, review corrections, decisions

## 12. Test plan

`packages/ui/src/progress/progress.test.tsx`, `packages/ui/src/meter/meter.test.tsx` (jsdom),
`progress.browser.test.tsx`, `meter.browser.test.tsx` (Chromium, Firefox, WebKit), and unit
tests next to the pure modules (`range-value.test.ts`, `meter-region.test.ts`). Top-of-file
comment (conventions 10.1): "Progress / Meter: no action props and no library-owned state; the
sync / async / rejection / overlap / superseded-rejection / suspending-content / controlled-parity /
post-await / platform-path / urgent-action rows are N/A." The design replaces them with the rows
marked ★.

### 12.1 jsdom

| Area | Tests |
| --- | --- |
| Roles and ARIA | The section 1 HTML for both components: `role`, `aria-valuemin` / `max` / `now` / `text`, `aria-labelledby` = consumer tokens + `${id}-label` (present without a Label too), `Label`'s `id` matches, `Value` has `aria-hidden="true"` by default and not with `aria-hidden={false}`; `aria-valuenow` / `aria-valuetext` absent while indeterminate, `aria-valuemin` / `max` still present; a consumer `role` / `aria-valuenow` / `aria-valuetext` prop or `render` element does not land (owned keys). |
| Arithmetic (unit) | `clamp` (150 of 100 → 100; −5 → `min`), percentage (0, 50, 100, fractional), degenerate range (`max <= min`: warning, `0`, not complete), non-finite (warning; Progress → indeterminate, Meter → `min`), `complete` at exactly `max` and above, not below. |
| Text | Default `{ style: "percent" }` of the fraction (`40` of `100` → "40%", `2` of `8` → "25%"); a percent `format` with `maximumFractionDigits` formats the fraction; a unit `format` formats the value ("3.2 MB"); `locale="de"` ("40 %"); `getAriaValueText(value, state)` receives the clamped value and a state whose `valueText` is the default, its result lands in `aria-valuetext` and `state.valueText` while `Progress.Value` still shows `formattedValue`; returning `null` omits the attribute; while indeterminate it is called with `null` and can set a text; the `NumberFormat` cache returns the same instance for equal inputs (unit). |
| Regions (unit) ★ | Every row of the 2.4 table at and beside each boundary (`value` equal to `low` / `high` in each of the three cases), the defaults (`low` = `min`, `high` = `max`, `optimum` = midpoint → `optimum` for any value in range), the clamping order (`high < low` → `high = low`; `optimum` outside the range), and `low <= optimum <= high` never yielding `even-less-good`. |
| Data attributes | `data-indeterminate` / `data-complete` on all five Progress parts and `data-region` on all five Meter parts, agreeing with the state passed to each part's function props; never the other component's attributes. |
| Custom properties | `--progress-value: 40%` on the Root's `style`, absent while indeterminate; `--meter-value` / `-low` / `-high` / `-optimum` with the clamped values; a consumer `style={{ "--progress-value": "1%" }}` wins (per-property merge); the Indicator renders no inline size. |
| Function props / `render` | Every part: `className` / `style` / `children` functions receive the documented state; `render` element form merges `className` / `style` and forwards `ref`; function form receives `(props, state)`; `Value` default children and `children(state)`; `Label` as `render={<label />}` keeps the `id`. |
| Lanes ★ | A parent runs `startTransition(async () => { setValue(50); await deferred.promise; setValue(80); })` through `useTransition`'s `start` (no `Button` exists in the library; the same React rule is exercised, review N6): before resolve `aria-valuenow` is `"80"` (the post-await write is urgent) while the sync-prefix `setValue(50)` was **held** (never observable as `aria-valuenow`), and the Progress is mounted from `{pending && …}` in the same tick as the click; the counter-example `startTransition(() => setValue(80))` after the await leaves `aria-valuenow` unchanged until the deferred resolves (guards the documented pitfall of 4.2, so the docs claim stays true across React versions). Each step runs inside `await act(async …)`. |
| Dev warnings | Degenerate range, non-finite value, a part outside its Root (throws), **no** warning for a missing name (documented limitation); each once per element / key. |
| Server render ★ | `renderToString` of both anatomies equals the client's markup attribute for attribute (a pure function of props); the HTML contains `--progress-value`, `aria-valuetext` and the data attributes before any script; `renderToString` with `locale` fixed produces the same string on both sides. |
| Directive | `progress-root.tsx`, `meter-root.tsx`, `meter-region.ts`, `internal/range-value.ts`, `internal/render-element.ts`, `internal/dev-warn.ts` and both `index.ts` start **without** `"use client"`; every other file under `src/progress/` and `src/meter/` starts with it (the directive script over `dist`). Also: the Root modules import nothing from a `"use client"` module except the context (`directives.test.ts` walks the Roots' runtime imports over the sources, ignoring `import type` / `export type`, and asserts the context is the only client module reached, so a refactor cannot quietly pull `useRender` into the Root). |
| Types | `value` optional on `Progress.Root`, required on `Meter.Root`; `transition`, `defaultValue`, `valueChangeAction` are not props (type test); `MeterRegion` exported; `getAriaValueText`'s state parameter is `ProgressState` / `MeterState`. |

### 12.2 Browser mode

| Row | Assertion | Engine branches |
| --- | --- | --- |
| Accessibility tree (Chromium, CDP) | `role` progressbar / meter; `valuemin` / `valuemax` / `valuenow`; **no** `valuenow` while indeterminate; the **name** from `Progress.Label` through `aria-labelledby`, and, with no Label and an `aria-label`, the name is the `aria-label` although a dangling `aria-labelledby` token is present (the load-bearing accname assumption of 6.1); a consumer `aria-labelledby` token plus the Label both contribute, in order. **`valuetext` cannot be read from CDP**: `Accessibility.getFullAXTree` reports `valuetext: ""` for `aria-valuetext` on every role (progressbar, meter, slider, native `<progress>`; only `input type=range` reports its own value), so `aria-valuetext` is asserted on the attribute (`memo/developer/cross-engine.md`). Shared helper `src/__tests__/ax-tree.ts`. | `browserName === "chromium"`; others assert the attributes |
| Native meter oracle ★ | For each row of the 2.4 table: a native `<meter>` with the same `min` / `max` / `low` / `high` / `optimum` / `value` agrees with `meterRegion()`. **Firefox**: `meter.matches(":-moz-meter-optimum" \| ":-moz-meter-sub-optimum" \| ":-moz-meter-sub-sub-optimum")`, compared with **Gecko's** operators (`geckoRegion` in the test: boundaries fall in `suboptimum`, 2.4) while the library's region is asserted as designed. **Chromium**: `getComputedStyle(meter, "::-webkit-meter-*-value")` reports the same width for all three pseudo-elements (useless as an oracle), so the row styles the three value pseudo-elements with distinct colours under `appearance: none`, screenshots the native meter and reads one pixel. | `browserName` branches; **WebKit**: attributes only (no oracle exposed to script; the screenshot oracle could be tried later, since WebKit has the same pseudo-elements), the row asserts the library's region and records the gap |
| Fill transition | With the 7.3 CSS, changing `value` fires exactly one `transitionstart` for `--progress-value` on the Root (registered property) and the Indicator's `inline-size` animates (its box width between the two values mid-transition: the row waits 300 ms into a 1 s linear transition and asserts a wide band); with `prefers-reduced-motion: reduce` emulated through the custom `emulateReducedMotion` browser command (Playwright `page.emulateMedia`, registered in `vitest.config.ts`; `withReducedMotion()` in `src/__tests__/browser-commands.ts` restores it in `finally`; each Vitest session has its own page, so the emulation does not leak into concurrent files), no `transitionstart`. | none expected; `@property` is in all three engines (research table) |
| Indeterminate animation | `[data-indeterminate]` has a running animation (`getAnimations()` on the Indicator non-empty), none after `value` becomes a number; the reduced-motion rendering has none. | none |
| No `startViewTransition` | Spy before mounting from `{pending && …}` in a transition, before a value change in a transition, before unmount: zero calls (no boundary exists). | none |
| RTL and vertical | Under `dir="rtl"` the Indicator's box starts at the inline end; with `writing-mode: vertical-lr` on the Track the fill grows along the block axis (the recipe's logical insets). | none |

---

## 13. Docs pages

Two pages, both Server Components in `packages/docs/src/pages/`, listed in `navigation.ts` after
Field & Form and routed in `App.tsx`:

**`/components/progress` — `ProgressPage.tsx`.** Intro (output-only; the display of someone
else's action; works with no JS). Examples (`src/examples/`, each shown with its source):

| Example | Directive | Shows |
| --- | --- | --- |
| `ProgressUpload.tsx` | `"use client"` | A fake upload action (`fake-api.ts`) driven by `useTransition`: indeterminate until the size is known, then determinate, `Progress.Value` with a unit `format`, `data-complete` styling, the **lane callout** (plain `setState` after each `await`; the `startTransition` pitfall shown as a non-example). The click handler resets `size` / `sent` **urgently before** starting the action (review S2: otherwise a second upload shows the previous run's complete bar for the 600 ms before the first chunk, the sync-prefix rule of 4.2 in action). |
| `ProgressForm.tsx` | `"use client"` | An indeterminate bar while a `Form.Root` submits, from `Form.Root`'s `children(state)`; the `aria-busy` / `aria-describedby` region recipe around the content being replaced. |
| `ProgressJobs.tsx` | **none (Server Component)** | A list of server-side jobs rendered from "server data" with `format`, `locale` and a `getAriaValueText` function passed from the Server Component, plus a `Progress.Root aria-label` spinner with no parts (the indeterminate ring, a fixed arc, review S1). The page says this file has no `"use client"` and that the Root ran on the server; this example is the RSC proof of 8.1. |
| `progress.css` | | The 7.3 recipes: linear, circular, indeterminate, complete, reduced motion. |

Then: props tables (Root, Track, Indicator, Label, Value), the `ProgressState` table, data
attributes, custom properties, the `format` rule (percent → fraction, else value), labelling
(Label / `aria-label`; the dangling token note), inside a Field (6.2), "What AT hears", "Server
Components" (which files are client modules; `locale` under SSR), "Not in v1", and the
reduced-motion block.

**`/components/meter` — `MeterPage.tsx`.** Shorter, linking to Progress for the shared parts.

| Example | Directive | Shows |
| --- | --- | --- |
| `MeterStorage.tsx` | **none (Server Component)** | Storage quota with `low` / `high` / `optimum={0}` (lower is better), zones from `--meter-low` / `--meter-high`, the fill coloured by `data-region`, the visible text ("4.6 GB of 5 GB") formatted in the **Root's `children(state)`** and passed to `Meter.Value` as a string (a `Meter.Value children` function cannot be passed from a Server Component, 8.1; the first draft of this row said otherwise), `getAriaValueText` naming the region ("almost full"). |
| `MeterStrength.tsx` | `"use client"` | A password-strength meter under a `Field.Control` inside a `Field.Root` (the supported sibling layout of 6.2): `optimum={max}` (higher is better), the control's `aria-describedby` → `Meter.Value id`, the meter's own `Meter.Label`. |
| `meter.css` | | The zone and region recipes. |

Then: props tables, `MeterState`, the region table of 2.4 with the defaults and clamping (and
the Firefox boundary note), data attributes, custom properties, the AT note from research §3.3
(support is uneven; always a name and a text: `aria-valuemin` / `max` / `now` always,
`aria-valuetext` unless `getAriaValueText` returns `null`, review N1), the `max <= min` warning
and the non-finite boundaries (N3), and the "format part content in the Root's `children(state)`"
sentence next to the Server Component example (N2).

Also: `RoadmapPage` / changelog entry; the Server Components concept page gains Progress and
Meter as the first components whose Root is itself a Server Component (a row in its table next
to the JS-free Accordion); `packages/ui/src/index.ts` and `tsdown.config.ts` gain the two
entries; the playground (`packages/example/src/progress-meter-demo.tsx`) has a demo of both.

---

## 14. Implementation notes

1. **The directive-free Root and `useRender`.** `internal/use-render.tsx` is `"use client"` for
   one `useMemo` (the merged callback ref's identity). A Root with no library ref does not need
   it. **Taken (6fef197): the split.** `internal/render-element.ts` (directive-free) holds
   `resolveStateValue`, `rendersButton`, `renderElement(options)` taking an already-merged `ref`,
   and `mergeRenderRef(consumerRef, render)`, which merges the consumer's and a `render`
   element's ref unmemoised only when both exist (`mergeRefs` from `merge-props.ts`, which is
   directive-free) and passes a single ref through untouched; a fresh identity per render is
   correct because every merged callback returns a cleanup (it re-attaches, harmless for a node
   with no library ref). `useRender` memoises the merge and calls `renderElement`; it keeps its
   directive and re-exports, so no other part changed. The conventions (f3ab2e4, 7.1) also
   allow the alternative, dropping the directive from `use-render.tsx` on the strength of
   React's `react-server` export list; it was not needed. The Roots pass `ref` into
   `mergeRenderRef` during render, which oxlint's `react/refs` rule flags; both call sites carry
   `// oxlint-disable-next-line react/refs` with the reason (the value is only forwarded to the
   element, never read). Either way the Root must not import from any other `"use client"`
   module than its context (the import-graph test row).
2. **The context provider from the Root.** `<ProgressContext value={{ id, state }}>` with the
   React 19 provider syntax; never `ProgressContext.Provider` (a property access on a client
   reference is not portable across frameworks' proxies). The value is a fresh object per render;
   the parts are cheap and re-render with the Root anyway, so no memoisation (and `useMemo` in
   the Root would raise the directive question again).
3. **`warnOnce`** (`internal/dev-warn.ts`): `isDev && !seen.has(key)` → `console.error`; keys
   include the part name, the condition and the values, not the element (a Server Component has
   no element identity); called during render, so a discarded render may warn. `resetWarnOnce()`
   exists for tests. Existing client parts keep `useDevWarning`.
4. **Formatting cache**: `Map<string, Intl.NumberFormat>` keyed by `locale ?? ""` +
   `JSON.stringify(format ?? PERCENT)`, capped (drop the oldest past 32 entries); the fraction
   rule reads `format.style` (`undefined` means `"percent"` only when `format` is absent; a
   `format` without `style` is `"decimal"` per `Intl` and formats the value).
5. **Attribute values**: `aria-valuenow` renders the clamped number as React stringifies it
   (`String(n)`), not rounded; `--progress-value` is `${percentage}%` with the full float
   (CSS does not care), so `scale` and `inline-size` consumers get the exact fraction.
6. **Owned-key merge** as everywhere (`mergeProps(partProps, elementProps, controlled)`): the
   custom properties go into the part's `style` *before* the consumer's resolved `style` so the
   consumer wins per property (Slider's rule); `aria-labelledby` through the token-merge path.
7. **Tests for the lane row** use the existing `deferred()` helper and `useTransition`'s `start`
   from a plain button (there is no `Button` in the library; the React rule is the same, review
   N6); the assertion between dispatch and resolve runs inside `await act(async …)` (the Slider
   review's L4 rule for anything that may suspend or settle later).

---

## Review corrections (#68, 2026-10-18)

The review (`memo/reviewer/progress-meter.md`, of 6fef197; verdict: acceptable with minor fixes)
found the library code matching the design: ARIA semantics, owned keys, the directive-free Root
with the client context provider, the lane rule, the region algorithm and the formatting. Its
fixes landed in ab22773 and are folded into the sections above. Nothing was must-fix.

| Item | Change | Sections |
| --- | --- | --- |
| S1 | The docs' indeterminate ring was invisible: a registered property with an `initial-value` is never guaranteed-invalid, so a `var(--progress-value, 25%)` fallback was never used and the `conic-gradient` drew 0 %. The ring now draws a fixed arc in its own `[data-indeterminate]` rule; the 7.3 recipe says why. | 7.3, 13 |
| S2 | `ProgressUpload` showed the previous run's complete bar for the 600 ms before a second upload's first chunk: `size` / `sent` are now reset urgently in the click handler before the action starts, which is the sync-prefix rule of 4.2 demonstrated instead of tripped over. | 4.2, 13 |
| S3 | `defaultValue` type-checked on both Roots and was a silent no-op (react-dom drops it on a `div`, so `<Progress.Root defaultValue={40} />`, the spelling every value component teaches, rendered an indeterminate bar with no warning). `defaultValue` and `defaultChecked` are omitted from both props types; the type test asserts it with `@ts-expect-error`. | 3.1, 3.3 |
| N1–N3 | Meter page wording: `aria-valuetext` is absent when `getAriaValueText` returns `null`; the Server Component example formats part content in the Root's `children(state)`; the `max <= min` warning and the non-finite boundaries are documented. | 13 |
| N4 | "A Root with no parts ships only the context module" was unverified (it depends on how the RSC bundler emits client references reachable from the namespace object); softened to "the parts' code is only loaded where they are used". | 8.1 |
| N5 | `emulateReducedMotion` moved above `selectBrowsers`'s doc comment in `vitest.config.ts`. | 12.2 |
| N6 | The lane row uses `useTransition`'s `start` from a plain button; the design said "a `Button` with an `action`", which does not exist. Wording fixed. | 12.1, 14.7 |
| N7 | A degenerate range clamps `aria-valuenow` to `min`, which can exceed `aria-valuemax` when `min > max`; accepted (the call site already warns) and documented. | 2.1 |

Developer deviations (`memo/developer/progress-meter.md`) and the review's verdicts:

| Deviation | Verdict | Sections |
| --- | --- | --- |
| `use-render` split into `internal/render-element.ts` (`mergeRenderRef` unmemoised) | Acceptable, the design's preferred option | 8.1, 14.1 |
| A Server Component may pass function props to the Root only; a function on a part fails with "Functions cannot be passed directly to Client Components" and the docs build still exits 0 | Acceptable, inherent (the parts are client modules); the design's MeterStorage row was wrong and is corrected; the silent build is #72 | 8.1, 13 |
| Firefox `<meter>` puts a value exactly at `low` / `high` in `suboptimum` where Chromium says `optimum` | Acceptable: HTML leaves the boundaries to the implementation; the library follows Chromium as designed, the Firefox oracle asserts Gecko's operators | 2.4, 12.2 |
| Non-finite `low` / `high` / `optimum` count as absent | Acceptable: matches the platform's attribute parser, unit-tested | 2.1 |
| `aria-valuenow` clamped (to `min`) for a degenerate range | Acceptable (N7) | 2.1 |
| `defaultValue` passes through to the div | **Not acceptable**: fixed in ab22773 (S3) | 3.1, 3.3 |
| `// oxlint-disable-next-line react/refs` on `mergeRenderRef(ref, render)` in both Roots | Acceptable: the ref is only forwarded to the element, never read during render; the comment says so | 14.1 |

Other facts recorded by the implementation: the CDP accessibility tree reports `valuetext: ""`
for `aria-valuetext` on every role, so the browser rows assert the attribute (12.2); the
Chromium meter oracle is a screenshot pixel, because the three `::-webkit-meter-*-value`
pseudo-elements report the same computed width (12.2); the provider-from-server pattern is
confirmed with `@funstack/static`, the Next.js check and the screen-reader pass are human tasks
in #73 (5.3, 8.1).
