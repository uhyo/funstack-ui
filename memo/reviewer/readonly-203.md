# Review of #203 (readOnly on every form value control), 2026-11-28

Branch origin/feat/203-readonly at f5bfe8bb (base fa5d832c). Verdict: acceptable with minor fixes.

Gates run in a worktree: typecheck, lint, jsdom (5779 pass) green; browser rows of checkbox,
switch, radio-group, checkbox-group, select, slider green on Chromium + Firefox (WebKit cannot
launch here; CI green on all three).

## Findings

1. Medium. Combobox: readOnly turned on while the Input holds edited text leaves that text
   shown for good (combobox-root.tsx:1093-1094 `if (readOnly) return;` with the comment "the
   text cannot differ from the selection's"; closeForReadOnly at 917-923 does not revert).
   Probe: type "Fra" over "Japan", lock, blur -> Input shows "Fra", FormData country=jp, and
   native readonly means the user cannot fix it. TextField / NumberField clear their draft in the
   same case (text-field.tsx:241-243, number-field-root.tsx:488-492). Fix: revert the text
   (single: label of the selection; multiple: clear the search) with reason "dismiss" when
   readOnly turns on or on leave; add a row.
2. Medium (tests). Rule 5's library-side bar is unpinned for non-text controls. Mutations that
   survive the whole jsdom suite: drop `|| readOnly` at field-root.tsx:305 (validate into the
   slot), drop `readOnly ? "" :` at :317 (server error into the slot), drop the read-only skip
   at :448 and :512 (first-invalid / server-error focus). The Field rows use a text
   Field.Control, which the platform already bars (validationMessage is "" for a barred
   element). Need rows with Checkbox / Select / RadioGroup: validate returning a message and a
   Form server error, both not blocking checkValidity/requestSubmit; server-error focus goes to
   the next non-read-only field.
3. Low. Stale design text: field-form.md:113 (Field.Control part row lacks readOnly and
   data-readonly), combobox.md:1249 and multi-select.md:648 and conventions 3.6.1 rule 8
   ("closes as it does for disabled", which is no behaviour), conventions 3.6.1 rule 14
   ("passes the native attribute through" vs owned inside a Field in field-form 4.3).
4. Low. Read-only Combobox/MultiSelect whose controlled `open` parent refuses the close request:
   Escape is not handled (combobox-keyboard.ts:117; multi-select-root.tsx:368 passes
   disabled||readOnly), so only focus leaving / light dismiss closes it. Consider letting Escape
   (and Alt+ArrowUp) through the read-only filter.
5. Low. No "readOnly turned on while pending" row for Combobox / MultiSelect (rule 12).
6. Nit. design/CHANGELOG.md:16791 heading has no blank line before it.

Mutations that were caught (good): guardCheckableChange read-only branch, useNativeChecked
restore, group reconciliation restore, Select lockedOut, group-member required withheld, Field
onEdit "not an edit", Combobox key filter, MultiSelect close-on-readOnly.

## Gap-fills

- Close request on readOnly-on (requestClose(undefined, "dismiss")): right; write it into rule 8
  and the two component docs, plus the text revert of finding 1.
- Combobox keys while read-only (caret/focus keys only; others unhandled and unprevented, Enter
  submits, Escape reaches an enclosing Dialog): right; make it the rule in combobox.md 11.1,
  with the Escape caveat of finding 4.
- Field.Control readOnly owned inside a Field (own or the Field's): consistent with disabled /
  required; amend rule 14's wording.
- Stale details (3.8 pointer, "five attributes"): fine; the Field.Control row was missed.
