# Consistency alignment plan (2026-11-28)

Source audits (on master): memo/reviewer/consistency-value-inputs.md, consistency-overlays.md,
consistency-composites.md, memo/architect/consistency-cross-cutting.md. Finding ids below are
`V-`, `O-`, `C-`, `X-` + the audit's own id (e.g. V-H1 = value-inputs H1).

## User decisions (2026-11-28, all recommended options)

1. Breaking alignments ship cleanly in one alpha, no deprecated aliases.
2. `closeOnActivate` wins: rename Toast.Action's `closeOnSettle`. Dialog.Form keeps `closeOnSettle` (different meaning). (O-M1, X-M1)
3. Accordion details become `{reason, added, removed}`, reporting the implicitly closed item in exclusive mode. (C-H2)
4. `transition` removed from the checkables (Toggle, Checkbox, Switch, RadioGroup.Item, CheckboxGroup.Item/Parent, ToggleGroup.Item): value controls whose attributes are all optimistic take no transition. (V-M2)
5. Disabled is not submitted: Combobox and MultiSelect hidden inputs get `disabled` (also Field.Root disabled). (V-H1)
6. `readOnly` removed from the types of controls that don't honour it (Combobox.Input, Checkbox, Switch). Real readOnly everywhere = separate feature issue. (V-M5)
7. Combobox Escape reverts edited text like TextField/NumberField, per conventions 15. (V-M4)
8. Vocabulary unified: `data-empty`/`state.empty` for "value is empty" (MultiSelect.Value data-placeholder, Combobox.Input data-selected); one view-transition kind per meaning (open/close for every open state incl. Collapsible/Accordion; check/uncheck for Switch). (X-M2, X-M7)

## PO defaults (no user decision needed: alignment to an existing rule or APG)

- Single-or-many naming stays (`exclusive` / `multiple` / MultiSelect); record the rule "the flag names the non-default mode". (X-M6)
- JS-free `state.open` is `false` everywhere (Accordion, Collapsible change from `undefined`). (C-M3)
- Library button-like parts inside a Toolbar are always focusable when disabled (APG). (C-H1)
- `aria-disabled` items are in the arrow/Home/End sequence everywhere (Accordion changes). (C-M1)
- Owned keys removed from prop types everywhere (Popover's rule). (O-M4, C-M5)
- Commit actions take `<C>ValueCommitDetails`; pure triggers `<C>ActionDetails`; every change details type named and carrying `reason`. (V-M6, X-M3, V-L1)
- Every attribute has a same-named state field (state.invalid/required/empty/selected...). (X-H2, V-M3)
- `data-typeahead` → `data-fsui-typeahead`; `experimental_focusgroup` → `experimental_focusGroup`. (X-L7, X-L9)
- Types subpath (X-L1): deferred, separate issue.

## Waves

- A. Conventions + docs (architect, then technical writer): one onOpenChange owner list, 4.1 table
  rule (name+meaning only), 5.3 rows, 1.1 part vocabulary, all decisions above written as rules, skill
  fixes, docs page header/section-id/order unification, Toolbar page Button pending error, MultiSelect
  page reason, menu.md submenu side.
- B. Code, in parallel after A's conventions commit: value inputs; overlays; composites.
- C. Review, merge, release alpha.28 with a Breaking changes list.
