# Review: feat/157-align (#157 B items 2, 5, 8)

Commits 572a80b, ed75e3f, 705be63, 7f88a35. Reviewed 2026-11-24.

**Verdict: acceptable with minor fixes.** Mergeable; the fixes below are documentation and
two test additions, none blocks correctness. Fix M1 and M2 before or right after merge.

## Verification done

- Branch tests (accordion, form, toast; jsdom): 310 pass. `tsc --noEmit` on packages/ui: clean.
- Reverted the five source files to master and kept the branch tests: 12 new tests fail
  (2 Accordion, 4 Form.Root rejection, 2 Form.Submit link, 4 Toast). The ones that still pass on
  master are deliberate guards (latest rejection reaches the boundary, `<input>` stays natively
  disabled) plus one weak test (L1).
- Mutations on form-root.tsx: dropping `connected.current` fails exactly the unmount and
  Activity tests; dropping the `id === latestRun.current` check fails exactly the two superseded
  tests. Switching Form.Submit's component case to aria fails the existing #83 test. Good
  coverage.

## Findings (severity order)

### M1 (medium, docs/spec) conventions 1.2 not amended
design/conventions.md:243-252 still says "a part that relies on the browser (`Form.Submit`, a
JS-free command Trigger / Close) keeps native `disabled`", and the list of parts that take the
aria branch does not name Toast.Action / Toast.Close. Both are now wrong: Form.Submit with a
host non-button element takes the aria branch, and the Toast parts follow `disabledButton`.
Conventions are binding over component docs, so a reader of 1.2 gets the old rule. Also 2.4
(conventions.md:694, "Both hooks ... do this themselves") should name Form.Root as the third
place that applies the superseded / disconnected rule. toast.md:862 and form-submit.tsx /
field-form.md cite "conventions 3.6" for the rule that lives in 1.2.

### M2 (medium, docs) no Roadmap "Behaviour changes" entry
packages/docs/src/pages/RoadmapPage.tsx: all three are upgrade-visible (Accordion multiple
value order for late/inserted Items; Toast.Action/Close `disabled` on a link/component render
now aria-disabled with state/data-disabled; Form.Root rejections that were silently dropped now
reach `reportError`). #145/#150/#151/#152 got entries; these should too. The #83 entry
(RoadmapPage.tsx:279, "Form.Submit keeps native disabled") is history and may stay, but the new
entry should qualify it.

### L1 (low, test) enabled-state test is vacuous for `state.disabled`
toast.test.tsx, "an enabled Action and Close report disabled: false": `states.every((s) =>
!s.disabled)` passes with `undefined` (it passes on master). Use `toBe(false)` per entry.

### L2 (low, test) no Toast component-render case
The Toast tests cover a link render and a host button, not `render={<PlainButton />}`. The
component case is exactly where Toast differs from Form.Submit (aria branch); a mutation that
gave components native `disabled` would pass. Add one `it.each` row with PlainButton
(aria-disabled, no `disabled`, cancelled click, no dispatch).

### L3 (low, merge) concurrent spec slimming
docs/157-spec-slim drops test plans from component docs; this branch edits field-form.md 13.1
rows. Expect a conflict; whoever merges second should drop the test-plan edits rather than
re-add them.

### Nits
- accordion-root.tsx:267: `sortByDocumentOrder([...items.current], ([el]) => el)` from
  dom-order.ts already exists.
- form-submit.tsx owned-keys JSDoc line exceeds the wrapping of its neighbours.

## Correctness notes (no action)

- Accordion: `sortedItems()` reads the DOM only from the action wrapper and the mount effect;
  `sortByOrder` keeps unregistered values at the end as before. Exclusive mount reconcile now
  picks the first opened in document order, matching accordion.md 2.3.
- Toast.Action / Toast.Close match Popover.Close and Button: owned `disabled`, `aria-disabled`
  only in the aria branch (Action owns it always because of pending, as Popover.Close),
  `data-disabled` and `state.disabled` the prop only, click cancelled before dispatch. A
  render element's own onClick still runs first (mergeProps composes handlers), same as Button.
- Form.Root: same rule as `useActionTrigger` (latest and connected rethrows, else
  `reportDropped`). `useActionState` dispatch never rejects into this path, so behaviour there is
  unchanged.
- a11y: `aria-disabled` is supported on role link; the link stays focusable, Enter is the
  click and is cancelled.

## Ruling: Form.Submit (component -> native) vs Button type="submit" (component -> aria)

The inconsistency is real but Form.Submit is the one that is right; Button is the outlier.

Reason. The aria branch is only safe where the part's own click handler is what acts
(conventions 1.2: "the handler is what makes aria-disabled safe"). For a submitter the action
is the browser's activation behaviour (form submission). Before hydration, or with a Server
Function `formAction` that React SSRs as a real form action, an aria-disabled component-rendered
`<button type="submit">` is live and submits. After hydration the cancelled click blocks both a
click and implicit submission (implicit submission fires a click at the default button), so
the gap is pre-hydration, but it is a "disabled control submits" gap. Meanwhile the cost of the
native guess being wrong is nil: a component that renders a link cannot be a submitter anyway,
so `type="submit"` and `disabled` on it are both meaningless and the part already fails at its
job.

Rule to adopt (amend conventions 1.2):
- Native `disabled` when the element is certainly a host `<button>`/`<input>`, OR when the
  click's effect is the browser's own activation (submit, reset, a JS-free invoker) and the
  element may be a button (component, function form). "Harmless if the guess is wrong" picks
  native there.
- `aria-disabled` plus a cancelled click when the element is certainly not natively
  disableable (host `<a>`, `<div>`), or when the part's own handler is the action and the
  element may be a link (component), or when the APG wants a focusable disabled control
  (Toolbar, `focusableWhenDisabled`), which is an explicit opt-in that accepts the
  pre-hydration trade.
- In `disabledButton` terms: Form.Submit's rule is `handlesClick: false` refined so that a
  host non-button tag still takes the aria branch. That refinement should move into the helper
  (for example `handlesClick: false` means "native unless host non-button") so Form.Submit stops
  carrying its own expression.

Follow-up for Button (separate issue in this repo, not this branch): a Button with no `action`
whose resolved `type` is `"submit"` or `"reset"` (including the `formAction` default), with a
component or function render and no Toolbar / `focusableWhenDisabled`, should take native
`disabled`. Its own `aria-disabled` while pending (`whilePending="ignore"`) is unaffected.
