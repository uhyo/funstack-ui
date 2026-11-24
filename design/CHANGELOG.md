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
