# Review of dev/217 (839bf9eb): Field references its parts only while mounted

Verdict: **acceptable with minor fixes** (test gaps only; no code defect found).

Checked: typecheck, lint, format:check; jsdom field/form/combobox/multi-select/number-field/
radio-group/checkbox-group/slider (1493 pass); `field.browser.test.tsx` in Chromium (10 pass).

## Verified by probe (scratch tests, not committed)

- Hook ordering: parts register in child layout effects, the owner's `sync` runs after them in
  the same commit; first client commit with no parts drops tokens before paint.
- StrictMode: count 1 -> 0 -> 1, state batches to `true`; no false two-errors warning.
- `<Activity>` hidden around Description/Error: tokens dropped while hidden, restored on show,
  no console error. Consistent with the rule (hidden content is display:none).
- Dehydrated Suspense inside the Field (content suspends on the client) while the Field drops
  a Description token after hydration: the context change did not force the boundary to client
  render; no recoverable error; server HTML of the boundary kept.
- Consumer tokens: `Field.Control aria-describedby="hint"` with no Description keeps `hint`;
  `RadioGroup.Root aria-labelledby="mine" aria-describedby="d2"` with no parts keeps both
  (master appended dangling `-label` / `-description`).
- Bubble cancel and two-errors warning read the same `countRef`; existing tests
  (field.test.tsx:207, :839, :899; field.browser.test.tsx) pass.
- Every consumer of the Field label id goes through `referencedIds` (Combobox List and Chips,
  MultiSelect List, NumberField buttons, groups via use-field-control).

## Findings

1. Minor, tests: the omitted-key path (use-field-control.ts, "A key is omitted rather than set
   to `undefined`") has no test. field.test.tsx:102 covers consumer tokens only with a
   Description mounted. Add a row to field-references.test.tsx: consumer `aria-describedby` on a
   control and `aria-labelledby` on a group, no parts, tokens kept exactly.
2. Minor, tests: no StrictMode, keyed remount, `<Activity>` or Suspense-reveal row, though the
   design text names "revealed by a Suspense boundary". A StrictMode wrapper on the late-mount
   row and one Suspense-reveal case would pin the hook's main risks.
3. Minor, tests: Combobox Chips (`combobox-chips.tsx:127`) also take `fieldLabelId`; the
   Combobox case has no `multiple` + Chips, so that referrer is unchecked.
4. Info, cost: every client-mounted Field missing a part (most lack a Description, all
   non-group Fields lack a label referrer but that one does not change state) pays one extra
   synchronous render of the Field subtree in the mount commit. Acceptable; noted for perf.
5. Info, docs: field-form.md 4.2 could say a part hidden by `<Activity>` or a re-suspended
   boundary loses its token while hidden (layout effects disconnect). Behaviour is fine.

Docs (FieldPage, Combobox/MultiSelect/NumberField pages, number-field.md 8.4, field-form.md)
match the code. CHANGELOG entry is accurate; the audit list of other dangling idrefs is useful.
