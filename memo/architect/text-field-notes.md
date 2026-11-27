# Architect notes: TextField (#181), 2026-11-27

Working notes behind `design/components/text-field.md`. Not a spec.

## What I read

- #181, `memo/architect/small-parts-notes.md` (the sketch and its six questions).
- vision; conventions 1.5, 2.1 to 2.7, 3.1 to 3.6, 4.1 to 4.3, 11, 15; internal-hooks.md 3.4
  and 3.8; testing.md.
- number-field.md in full; field-form.md 1, 2, 3.3 to 3.6, 4.3, 6, 7, 11.4, 11.8, 12;
  otp-field.md 3, 7 to 12.
- Changelog entries for #185 (`afterDispatch`, both) and #193 (both).
- Code: `number-field-input.tsx`, the draft / key / reset parts of `number-field-root.tsx`,
  `field-control.tsx`, `internal/after-dispatch.ts`, the head of `internal/escape-key.ts`.

## Prior art, and how each claim was checked

| Library | What | Checked how |
| --- | --- | --- |
| Ark UI `Editable` | Parts Root / Label / Area / Input / Preview / Control / EditTrigger / SubmitTrigger / CancelTrigger. `activationMode` `focus` (default) / `dblclick` / `click` / `none`; `submitMode` `both` (default) / `enter` / `blur` / `none`; `onValueChange`, `onValueCommit`, `onValueRevert`, `edit` / `onEditChange`; `selectOnFocus` default true; `autoResize`. Enter saves, Escape discards. | Docs page fetched 2026-11-27 |
| Zag `editable` machine | Preview: `tabIndex 0`, `aria-label` = the "edit" translation, no role, `hidden` while editing; `onFocus` starts editing in `focus` mode. Input: `aria-label` fallback "editable input", `hidden` while not editing. Keydown: bails on `defaultPrevented` and on composing; Escape cancels and prevents; Enter submits an `input` unless Shift or Meta; a textarea submits on Cmd (Apple) or Ctrl + Enter. No pending or async state. | `editable.connect.ts` on main, read through a summarising fetch: not line by line |
| Atlassian `InlineEdit` | Read view and edit view; Enter saves, Escape cancels; confirm / cancel buttons at the end of the field; saved when the user moves away; `keepEditViewOpenOnBlur` recommended for larger text; "don't use inside a form". The page says nothing on what a screen reader is told. | Usage page fetched |
| React Aria | No inline-edit component turned up; `TextField` reports per keystroke. | Search only, plus memory. **Not verified against the component list.** |
| Base UI, Radix | No such primitive. | A third-party page says so for Base UI; Radix from memory. **Not verified against their docs.** |
| HTML | `contenteditable="plaintext-only"`: Chrome 51, Firefox 136, Safari 5. `field-sizing`: Chrome 123, Firefox 152, Safari 26.2. | browser-compat-data `main`, read 2026-11-27 |

The search for accessibility guidance on inline edit found community threads (Fluid 2009,
Drupal, Pega) and no standard. The reasoning in text-field.md 8 is mine, from the Zag markup
and WCAG 4.1.3; it is not a tested claim about screen readers.

## What I went back and forth on

- **Name.** `TextField` (NumberField's and OTPField's family: a text input whose text the
  library manages) against `Editable` (Ark's name, which promises a preview). Risk of
  `TextField`: it reads as "the Input component" the user declined in #169. The doc says in its
  third paragraph that it is not. Left as decision 1.
- **Controlled React draft vs browser-owned draft.** My sketch said browser-owned (uncontrolled
  input, native `change`). Switched to NumberField's `useState` draft: rollback and Escape are
  then a state change, a controlled `value` from outside shows by itself, `state.text` exists,
  and it is the same code shape as NumberField. Cost: the revert and the rollback are script
  writes, which drop the input's undo history. The native `change` event is not used at all
  (NumberField uses `onKeyDown` + `onBlur` with its own comparison).
- **Rejected save.** Wanted "keep the text as a draft". It does not survive contact with the
  conventions: an uncaught rejection replaces the field (boundary), so the only visible case is
  a controlled parent that does not adopt, and non-adoption cannot be told from a parent that
  adopted a trimmed text. Then noticed the conventions already give the consumer both outcomes
  (catch and adopt = keep; do not adopt = roll back). Wrote those as recipes. Decision 2.
- **Validity gate.** A `required` title that autosaves as empty is the case people will hit.
  NumberField commits out-of-range numbers, so the same rule here; listed as not in v1.
- **`autocomplete`.** NumberField and OTPField default it. Not here: a name or an address
  field must stay fillable (WCAG 1.3.5), and restoration then goes through the platform commit.
- **Escape.** Fits conventions 15 as "a part that handles a key on itself". NumberField lists
  it as not in v1: flagged for parity.

## Not verified (no probe was run)

1. The order of `focusout` and the end of an IME composition when a field is blurred mid
   composition. If `compositionend` + `input` come after `focusout`, a draft reopens on an
   unfocused field after the commit. NumberField has the same exposure. Needs a browser row
   (Chromium through CDP at least).
2. `type="search"`: Chromium and WebKit clear the field on Escape natively. With no draft the
   library leaves the Escape alone, the browser clears, and that `input` opens a draft `""`.
   Probably fine; unchecked.
3. That the undo history is dropped by a controlled write in all three engines.
4. That `text-overflow: ellipsis` applies to an unfocused `<input>` in all three engines.
5. That a focused control which becomes `disabled` fires no `blur` (then a draft stays open).
6. Whether `useNativeGroupReconciliation` fits a single text input as it stands, or whether
   the developer calls `useFormReset` and writes the mount read by hand.
