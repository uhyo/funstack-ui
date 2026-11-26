# Architect notes: small parts (#169), 2026-11-26

Working notes behind `design/components/separator.md` and the #169 sections of
`design/components/field-form.md` (4.3, 7.4, 11.8, 12). Not a spec.

## What I read

- #169, #162 (wave 24), vision, conventions 1.1, 1.2, 1.4, 2.1, 2.6, 2.7, 3.6, 7.1, 7.3.
- field-form.md (1, 4, 5, 6, 7, 11, 12); toggle-group.md 3.5; menu.md 3.7; select.md 3.5;
  combobox.md (no Separator); radio-group.md and checkbox-group.md (fieldset Root, legend
  Label, `:disabled`), by grep rather than in full.
- Code: `toolbar/toolbar-separator.tsx`, `select/select-separator.tsx`, `menu/menu-group.tsx`,
  `field/field-control.tsx`, `internal/form/field-context.ts`, `slider/slider-root.tsx`
  (`beginGesture`), `progress/progress-root.tsx` (how a directive-free part renders).
- No probes, no web research: prior-art claims are from memory of the six libraries' APIs.

## Findings in the code

- Three separators exist, each one `useRender` call on an `<hr>`. Only Toolbar's has logic
  (perpendicular orientation from context).
- `useRender` is a client module; `renderElement` (`internal/render-element.ts`) is not, and
  `Progress.Root` uses it. A standalone Separator can therefore be directive-free.
- `Field.Control` throws outside a Field only because it reads `ctx.state` through
  `useFieldContext`; `useFieldControl` is documented to return "nothing to merge" outside.
  Making it tolerant should be a few lines. Its props type omits `id`.
- `Slider`'s `beginGesture` checks `latest.current.disabled` (prop or Field) only. Inside
  `<fieldset disabled>` the range inputs are disabled by the browser but the Track and Thumb
  spans still take the pointer. Read from the code, not reproduced in a browser. NumberField's
  wheel / scrub paths were not checked.

## Separator: what I went back and forth on

- Build vs recipe. Conventions 7.3 says a directive-free part that adds nothing over the
  element is a recipe. The part adds `aria-orientation` + `data-orientation` for vertical and
  the `decorative` pair (role none, orientation removed). Thin but not nothing, and 4/6 ship
  it. Recommended build; left as decision 1.
- `decorative` prop vs `role="none"` pass-through. With pass-through the part would have to
  read `role` to know whether `aria-orientation` is valid: two spellings and a hidden rule.
  A prop is the Radix spelling and is explicit. `role` leaves the props type.
- `aria-orientation` always vs only for vertical. Always: one rule with `Toolbar.Separator`.
- Context-aware standalone part (flip inside a Toolbar, replace `Toolbar.Separator`): costs
  the Server Component property. Rejected.
- Listbox: `separator` is not an allowed child, `none` is (the `Status` inside a `List` is the
  precedent). So `decorative` also answers Combobox / MultiSelect.

## Fieldset

- What a part could add: (1) legend naming: native. (2) `disabled`: native for every control
  the library has, since all have a native element. (3) library state following inherited
  disabled: needs a context read in every control; `:disabled` / `:has(:disabled)` select it.
  (4) group description: `aria-describedby`. (5) group error: a third channel, declined.
- Base UI's `Fieldset.Legend` is a `div` with `aria-labelledby`; Headless UI's Fieldset is a
  `disabled` context. Neither is needed with native controls.
- `<fieldset disabled={pending}>` is a common recipe elsewhere; it contradicts conventions 3.6
  (focus loss). Said so in 7.4.

## Input / Textarea

Candidates for "what Async React adds", and why each fell:

| Candidate | Verdict |
| --- | --- |
| `valueChangeAction` per keystroke | Text is a fact (2.6). Rollback deletes typing. The honest prop would be `onValueChange`, sugar over `e.target.value`. |
| pending on the input | Whose? The form's is on the Field parts. Its own needs an action it does not have. |
| `field-sizing: content` | CSS, shipped in all three engines per field-form 6.2; no prop. |
| standalone label wiring | That is Field. |
| commit action | Real. See below. |

### Sketch: a commit-action text field (not designed)

```tsx
<EditableText defaultValue={doc.title} valueCommitAction={renameDocument} aria-label="Title" />
```

- Draft text: browser-owned, urgent, never written while the user types (NumberField's model).
- Commit: the native `change` event (blur after an edit, Enter in an `<input>`), through
  `addEventListener`, since React's `onChange` is `input`. One dispatch in a transition,
  `data-pending` on the input, `value` / `defaultValue` are the committed value.
- Open questions that make it a component and not a prop:
  1. Rejected save: NumberField rolls the text back. For a title that is right; for a long
     textarea it is data loss. Options: roll back; keep the draft and mark it (a `data-dirty`
     or a Field error); let the action decide.
  2. Textarea: Enter is a newline. Commit on blur only, or Ctrl/Cmd+Enter too.
  3. Escape: revert the draft to the committed value (an inline-edit convention).
  4. Controlled `value` changing under a focused, dirty draft (a collaborative edit).
  5. Inside a Form: the same two-channel rule as Checkbox (field-form 7.3).
  6. Name: `Editable` (Ark), `TextField`, or `Input` with the prop.
- Prior art to research first: Ark UI `Editable`, React Aria `TextField` (no commit),
  Atlassian inline edit.

## For the product owner

- Decisions 1 to 5 in the changelog entry.
- Decision 3 should become a GitHub issue in this repository once reproduced.
