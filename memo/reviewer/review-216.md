# Review: dev/216 (8600bf7a), NumberField group unnamed, buttons carry the label

Checked against design/components/number-field.md 1, 3.1, 3.3, 8.1, 8.4 and the #216 CHANGELOG
entry (5d57cf6c). jsdom number-field suite: 240/240 pass in a worktree.

Verdict: **acceptable with minor fixes** (all fixes are design/docs wording; the code is right).

## Findings

1. Medium (design drift): SSR. `NumberField.Label` registers from a layout effect
   (number-field-root.tsx:635-640), so the server HTML has `aria-labelledby` only for a Field label;
   a standalone field's buttons are "Increase" until hydration. The 8.4 rule and the test plan's
   "Server render: ids and aria-labelledby in the HTML" claim otherwise. Not fixable without a
   dangling idref (referencing labelId unconditionally), so the right fix is a design amendment
   plus a CHANGELOG entry: pre-hydration name is the short word; the Field token is in the HTML.
   The test (number-field.test.tsx, "server render") already asserts the real behaviour.
2. Medium (design drift): the computed-name browser row runs in Chromium only
   (number-field.browser.test.tsx:564, CDP AX tree). Firefox/WebKit expose no engine AX tree to
   Playwright; jsdom covers the name via dom-accessibility-api. Amend the test plan row.
3. Low (dangling idref): inside a Field with no `Field.Label`, `fieldContext.ids.label` is
   always `${id}-label` (field-root.tsx:196), so the buttons get `"<own> <missing id>"`.
   Pre-existing on the Root before #216 and shared with Combobox/MultiSelect; name still
   resolves to "Increase". Docs say "Not rendered when there is no label" (NumberFieldPage.tsx
   ~354), which is untrue here. Track as an issue (Field label registration) or reword.
4. Low: two `Increment` parts in one Root get the same default id (use-step-button.ts:249);
   duplicate ids, self-reference resolves to the first. Edge case; a sentence in 3.3 suffices.
5. Low (docs): with both labels the name is "Increase Qty Quantity" (design-sanctioned); the
   docs do not mention it. DirectionLocalesPage.tsx:238 still calls "Increase"/"Decrease" "the
   buttons' names"; now they are the words, the label is appended.

## Verified OK

- Consumer `aria-label` keeps the label; consumer `aria-labelledby` replaces all and drops the
  default; consumer `id` used in the self-reference; no label -> no aria-labelledby.
- Label mounted late / unmounted adds and removes the token; Field order part-then-Field.
- Root: no owned aria-labelledby; consumer aria-label/aria-labelledby pass through.
- Hydration test runs without console errors (attribute added post-hydration, no mismatch).
