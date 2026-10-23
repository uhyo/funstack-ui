# Wave 15 docs review (branch wave15-docs, head 2b79c7a): factual accuracy

Scope: e7d8822 (one props table per part), 5d64d85 (PartFacts State / Owned lines), 022ca9b
(ConceptExample on Action props), 2b79c7a (concept sweep), #99. Checked against
packages/ui/src (the "Owned keys (conventions 1.2)" comments and, where none or where they
disagree, the actual `libraryProps` passed to `useRender`), the exported `*State` types, and
design/components/accordion.md, combobox.md.

Verdict: **acceptable with minor fixes**. Two medium (one rendering defect, one Owned claim
that contradicts tested behaviour), the rest low.

## Method

- Extracted all 85 PartFacts (State/Owned/Note) with their part heading and diffed each
  Owned line against the source comment and `libraryProps`. Owned = `libraryProps` layer
  (render-element.ts: those win over a `render` element; `props` lose to it).
- All 88 PropsTables: 85 have PartFacts; the 3 without are not parts (CSP `nonce` option,
  Toast `toast()` manager, `ToastOptions`). Fine (the brief's "86" is just a count slip).
- State lines checked against the `*State` interfaces' optimistic/committed doc comments.
- e7d8822: every row in the 4 touched files accounted for (below).
- stylingProps: all 10 call sites checked against the part's prop types.
- Built `@funstack/ui` and `docs` in the worktree (exit 0); scripted check of every internal
  href and #fragment in dist/public (35 pages): no broken links or ids (two false positives:
  a png asset and a `<style data-href>`); no duplicate ids.

## Findings

### M1. Action props code samples render with a stray two-space indent (022ca9b)
`packages/docs/src/pages/ActionPropsPage.tsx:107`, `:205`, `:226`, `:274`, `:302`. When the
CodeBlocks were wrapped in `<ConceptExample>`, every line of the template literal after the
first got two extra spaces. Template contents are literal, so the built page shows e.g.
`<Toggle ...>` then `  <Tabs.Root ...>` (looks nested), `// app/post.tsx` then
`  import { Toggle } ...`, and the `useActionState` body indented 4 under a 0-indent first
line. Verified in dist/public/concepts/action-props.html. Fix: dedent the template contents
(formatters do not touch them, so format:check stays green).

### M2. Toggle and ToggleGroup.Item Owned lines list `type`, which is not owned
`TogglePage.tsx` PartFacts, `ToggleGroupPage.tsx` Item PartFacts. Both parts put
`type: "button"` in the pass-through `props` layer (`toggle.tsx:115`,
`toggle-group-item.tsx:99`), so a `render` element's own `type` wins; toggle.test.tsx:776-791
asserts exactly that ("The element's own `type` wins (design section 3)"). The Getting
Started definition added in this branch says Owned props are ones "a render element cannot
override", so the line is wrong. Tabs.Tab does it the same way and its line correctly omits
`type`. Root cause for ToggleGroup.Item: its source comment (`toggle-group-item.tsx:59`)
also lists `type` as owned while the code comment 40 lines later says the opposite. Record
for the developer (code comment fix), not a docs-only issue.

### L1. Owned lines that list keys the source does not own
- `SelectPage.tsx` Select.Group: `label`, `disabled`. Only `label` is owned
  (`select-group.tsx:29` "Owned key: `label`"; `disabled` is in `props`).
- `DialogPage.tsx` Dialog.Popup: `onToggle`, `onBeforeToggle`. They are omitted from the prop
  type and the listeners are native (`dialog-popup.tsx:500-532`), not `libraryProps`. Say
  "not accepted" as the Popover page does. The owned `suppressHydrationWarning` is missing.
- Checkbox and Switch: `onChange` is listed as owned; the source says handlers are "merged
  rather than owned" (a render element's runs first). CheckboxGroup.Item / RadioGroup.Item
  say "`onChange` is merged"; use the same wording. (The Switch note already says it runs
  first, which contradicts its own Owned line.)
- Tooltip.Popup `data-instant`: not a prop of the part; the Root's effect writes it on the
  DOM (`tooltip-popup.tsx:71-75`). Move to the note.

### L2. Owned lines that omit owned keys
- Combobox.Input: the Field.Root additions (`required`, `aria-describedby` token-merged,
  `aria-invalid`, `data-invalid`) are missing; every other Field-aware part lists them.
- CheckboxGroup.Item: inside a Field also `aria-invalid`.
- Combobox.Trigger: `onPointerCancel`.
- Accordion.Item: `onToggle` is owned only in library mode (accordion-item.tsx:175); also
  `suppressHydrationWarning`.
- Menu.Popup: the context-open inline `top` / `left` (`right` in RTL) and the hoisted
  `@position-try` `<style>` (menu-popup.tsx comment).

### L3. State-line wording
- Dialog.Root: "both are `false` in JS-free mode" after a three-field state
  (`{ open, pending, modal }`); say "`open` and `pending`".
- All optimistic/committed claims match the types: Accordion Item optimistic / Panel committed;
  Dialog, Popover, Menu, Combobox Root optimistic / Popup committed; Tabs Root and Indicator
  optimistic / Panel committed; CheckboxGroup, RadioGroup, Select, ToggleGroup, Toggle,
  Switch, Checkbox (`indeterminate && !pending`), Menu items; CheckboxGroup Item / Parent
  `pending` definitions; NumberField / Slider "shown value". No errors.

### L4. Concept sweep
- SuspensePage Accordion example matches accordion.md 4.4 and walkthrough 5. It holds in
  library mode only (JS-free passes `open: undefined`, so `open && <Comments/>` never mounts);
  the Accordion page's summary has the same omission. Optional: "in library mode".
- SuspensePage Combobox example matches combobox.md row 4 and 6.2 (useDeferredValue, first load
  shows the fallback, data-stale + aria-busy, latest query only). Correct.
- "between 2 and 5 KB gzip per component in the ones measured": supported by
  docs/research/zero-js-variants.md:22,113 and design/conventions.md:1682 ("2 to 5 KB gzip per
  family"; measured +1.9 Progress, rounded). OK.
- BrowserOwnedStatePage "Some components ... offer both (their pages have a Two modes
  section)": no longer overclaims; exactly Accordion, Dialog and Popover have that section.
  Grammar nit: the next sentence's "it runs" has no singular antecedent after "Some
  components".
- ActionPropsPage `ConceptExample component="Toggle and Tabs" href="/components/toggle"`: the
  label names two components but links one. Nit.

## e7d8822 row check
- Menu.RadioGroup: value, defaultValue, valueChangeAction kept; className/style/children/render
  added (correct: MenuRadioGroupState function props exist). Menu.RadioItem: value + itemRows.
  Prose split correctly. No loss.
- Select.Group: label, disabled, functionProps, render (optgroup). GroupLabel/Separator:
  functionProps + render (legend / hr). The old shared render row's "Separator takes no
  children" moved to the children note. Types: all three are `SelectRootState`. No loss.
- Slider.Thumb: "name / form" split into two rows with default "the Root's" (matches
  `name ?? ctx.name`, `form ?? ctx.form`). Label: functionProps + render label with
  SliderRootState; Value: index + functionProps + render span with SliderValueState
  (types match). Correct, and fixes the earlier mixed "SliderRootState / SliderValueState".
- NumberField: only separators changed ("min, max", "name, form"; type
  "string, string, string, boolean" is correct for inputMode/autoComplete/autoCorrect/
  spellCheck).

## stylingProps check
All call sites (Checkbox, CheckboxGroup Item/Parent, Combobox.Input, RadioGroup.Item, Switch,
Field.Control, Field.Error, Select.Value, Toolbar.Separator) declare `className` and `style` as
`StateValue<..., State>` with the state named in the row; the descriptions ("or a function of
the part's state") are right. Nit: the helper's doc says "a part that renders a void element",
but Field.Error (a div with its own `children` row) and Select.Value also use it.

## Pre-existing, not from this branch
- Combobox.Label has no props table / PartFacts (owned `id`, `htmlFor`; state `{ disabled }`).
