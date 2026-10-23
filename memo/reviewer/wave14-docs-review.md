# Wave 14 docs review (branch wave14-docs): factual accuracy

Scope: 298ebe7 (@funstack/static 1.3.4, #94) and 17e3269 (concept pages, per-component
"Async and platform behaviour" rows, #97). Prose and structure are the technical writer's.
Checked against design/conventions.md, design/components/*.md and packages/ui/src.

Verdict: **acceptable with minor fixes**. One medium factual error (moved, pre-existing),
the rest low.

## Method

- Every transition-type string in the rows checked against `transitionTypes(...)` callers and
  literals in packages/ui/src (all match: accordion expand/collapse, tabs next/prev, toggle
  press/release, toggle-group press/release, checkbox(-group) check/uncheck, switch on/off,
  radio-group bare, select bare, combobox select + open/close via usePopoverRoot, dialog and
  popover open/close, menu open/close/check/uncheck/select, slider and number-field
  change/commit). Parts with a `transition` prop (useTransitionBoundary callers) match the
  "no part takes a transition prop" claims (Select, Slider, NumberField, Toast, Tooltip, Field,
  Meter, Progress, Toolbar).
- Every per-part `data-pending` claim checked against the emitter and its condition (Item pending
  only when optimistic differs from committed; Option/RadioItem when it is the optimistic target;
  Slider thumb by `pendingThumb`; NumberField buttons by `pendingSource`; Combobox Input
  `ctx.pending`, Trigger `popover.pending`, Option `valuePending && selected`; Field parts via
  Field.Root's form-channel state; Toast Root + Action).
- useActionState paragraph: react.dev text re-read, and a throwaway jsdom test (deleted, never
  committed) with a controlled Toggle driven by `useActionState`, three clicks, deferred
  promises. Result: calls run one at a time; `aria-pressed` stays the latest optimistic value
  and `data-pending` stays on until the third call resolves; the hook's state does not change in
  between (batched, per react.dev caveat). A rejection of the first call skipped the two queued
  calls and reached the boundary above the useActionState component. **The paragraph is accurate.**
- Links: built `pnpm --filter docs build` in the worktree and checked every internal href and
  fragment against ids in the built HTML: no missing page, no missing id, no duplicate id
  (the one hit, `@funstack/ui/tooltip-warm`, is a `data-href` on a style tag).
- PO requests: (1) Tabs `until-found` re-hide on a controlled refusal: **verified**.
  tabs-panel.tsx keeps `useUntilFound` inactive only while the panel is the optimistic target;
  a veto reverts optimistic and the layout effect re-asserts `hidden="until-found"`; covered by
  tabs.test.tsx:1108 ("a find the controlled parent vetoes is hidden again") and :1128.
  (2) Toast "its stack is library-owned": **matches the design** (toast.md state table, line 833:
  "library-owned, **urgent**"), but conflicts with the new docs definition of library-owned
  (L1 below). (3) Root definition: see L2.

## Findings

### M1. Tabs "Before hydration" says until-found panels are searchable before hydration
packages/docs/src/pages/TabsPage.tsx:372: "With `keepMounted=\"until-found\"`, hidden panels are in
the HTML and searchable." The server renders a boolean `hidden` (tabs-panel.tsx:124, "Boolean form
for SSR"), upgraded to `"until-found"` only by a layout effect (use-until-found.ts). design
tabs.md 5.3: "Before hydration a server-rendered `"until-found"` panel is `display: none`, not
`content-visibility: hidden`, so find-in-page does not reach it until the page is interactive."
The claim was moved from the old Server Components table, so it predates this branch, but it is
now the per-component source of truth. Fix: "in the HTML (hidden; find-in-page reaches them after
hydration)". Related, pre-existing: TabsPage.tsx:200-201 says "rendered with
`hidden="until-found"` (in server HTML ...)"; the server HTML carries `hidden=""`.

### L1. "Library-owned state" definition is narrower than its uses
BrowserOwnedStatePage terms: "changed only by the library, inside the state owner's transition,
after the user acts on a trigger". Conventions 3.5 says "state that lives in React and that the
library changes in response to the user" (its table adds "inside its transition"), but the design
docs also call urgent state library-owned: Toast's queue (toast.md:833, changed by `toast()`
calls, urgent), Toast pause, Combobox's typed text, Slider's gesture. ToastPage's row "Its stack is
library-owned" therefore contradicts the definition the row's header links to. Fix: define it as
state held in React and changed only by the library (usually in the state owner's transition;
some state, such as typed text or the toast queue, is urgent).

### L2. Getting Started "Root" definition
GettingStartedPage: "The Root is the outermost part of a compound component; it usually holds the
state". Conventions 1.1 (line 116): `Root` "Owns state, context and the transition". "Usually" is
defensible (Tooltip.Root and Toolbar.Root hold little or no state; Menu.CheckboxItem and
Menu.RadioGroup own their own state), but "outermost" is wrong for Toast: `Toast.Viewport` is the
outer part and owns the queue; `Toast.Root` is one toast. Suggest "the part that holds the
component's state and provides it to the other parts through context; usually the outermost".

### L3. "Two modes" generalisation
BrowserOwnedStatePage "Two modes, one anatomy": "Where a native element can do the whole
interaction, a component offers both." Switch, Checkbox, RadioGroup, CheckboxGroup, Select and
Slider are native elements doing the whole interaction and have no JS-free mode (the #19
decision: the JS-free version is the Plain HTML recipe). Only Accordion, Dialog and Popover have
the mode switch. Suggest naming them, or "Some components (Accordion, Dialog, Popover) offer both".

### L4. Combobox "focus leaving" listed as a browser dismissal
ComboboxPage row: "a dismissal (Escape, a click outside, focus leaving) is the browser's". design
combobox.md:694: focus leaving is "library-performed, browser-shaped" (`hidePopover()` from the
Input's focusout), notified as `"dismiss"`. The notification claim is right; the ownership is not.

### L5. "one call of its change action" in Server Components "Before hydration"
ServerComponentsPage list item 3: reconciled "with one call of its change action". Slider and
NumberField reconcile with one step and one commit (their own rows say so), Combobox text goes
through `inputValueChangeAction`. Suggest "one dispatch (for a continuous control, one step and
one commit)".

### L6. Tabs transition types: "Only `fsui-tabs` when there is no committed tab"
tabs-root.tsx:119-126 also returns only `fsui-tabs` when either tab is not found under the root
(an unmounted value) or next === prev. "when the order cannot be determined (no committed tab,
or a value with no rendered Tab)" is exact.

### L7. Term definitions slightly narrow (no change required, note for the writer)
- "Pending ... It is the state owner's `useTransition` pending flag": pure triggers (Button,
  Menu.Item, Dialog.Close, Toast.Action) have their own transition pending, and Field / Form use
  the form channel (`useFormStatus`).
- "Dismissal" lists Escape, Android back, AT dismiss, click outside; Popover, Menu and Combobox
  also treat "another top-layer element opening" as a dismissal (rows say so).
- ServerComponents "a popover shown on interest" as browser behaviour before hydration is
  Chromium-only (`interestfor`); the Tooltip row qualifies it, the concept list does not.
- Combobox row links "the urgent lane" to `/concepts/action-props` without a fragment; the
  "The urgent lane" h3 (ActionPropsPage.tsx:308) has no id. Add `id="urgent-lane"`.

### Design-doc staleness (not this branch, for the architect)
design/conventions.md 7.3 (around line 1691) still describes #94 as a "Known gap" and says the
Progress / Meter docs note the limitation; the docs dropped it after the 1.3.4 verification
(4d5a5a5). Update the conventions text.

## Checked and correct (not exhaustive)
All transition-type rows; Accordion / Dialog / Popover / Menu / ContextMenu optimistic, Suspense,
dismissal and pre-hydration rows; Popover Trigger `aria-expanded`; Dialog controlled close
carries no types (dialog.md:1448); Select, RadioGroup, CheckboxGroup, Checkbox, Switch,
ToggleGroup, Toggle, NumberField, Slider pending rows; Toast urgent commits, Root/Action pending,
`popover="manual"` region, Suspense guard; Field form-channel pending; Toolbar pre-hydration Tab
stops; Meter/Progress server Root; term definitions of trigger, pure trigger (conventions 2.5,
#79), committed, optimistic, rollback, commit, view transition, transition type, invoker command,
JS-free mode (conventions 7.3 "no behaviour JS on the native path").
