# Review: dev/220 (an invalid typed draft stays a draft)

Reviewed c248bb83 + f3daf107 against conventions 3.3.1, text-field.md 4.2, number-field.md 4.1,
internal-hooks.md 3.4. Verdict: **acceptable with minor fixes** (none blocking the merge).

Ran: jsdom text-field/number-field/field/internal/action (722 pass); full jsdom passes except
`directives.test.ts` (needs a build, environment only); Chromium browser rows for TextField and
NumberField (38 pass).

## Core hook (use-controllable-action.ts)

No regression found. `latest` (error routing) vs `latestWrite` (uncontrolled write) is the
right split; `adoptFact` advances both. A stateless dispatch skips `inFlight`, `burst`,
`setOptimistic`, `settle` consistently (count never incremented, never decremented). `pending`
counts it via `startOwnTransition`. `onReject` runs before the `isHandledRejection` return, so
`details.reject()` reaches it. Set-valued replay is untouched (stateless never makes a burst
entry). Writing dispatches behave exactly as before (`writeId === latestWrite.current` is the
old `id === latest.current` when nothing stateless is dispatched).

## Findings

1. Medium (design gap, question 2). NumberField: a kept draft ended by Escape, `disabled` /
   `readOnly` turning on, or a reset whose target equals the saved number leaves
   `valueChangeAction` holding the typed number although the field shows the saved one. An
   ordinary draft's Escape sends nothing because nothing was heard; the kept draft was heard
   (number-field-root.tsx commitStateless call). Consistency is "the preview channel ends on the
   shown value", so Escape (and the disabled/readOnly/reset drops) should send one `"dismiss"`.
   An edit needs none (an ordinary draft is never previewed); a step reports itself. Needs an
   architect amendment: the `"dismiss"` JSDoc (number-field-root.tsx:57, :142) says it means a
   rejected commit.
2. Low. Possible duplicate `"dismiss"`: writing commit A in flight, then kept draft S; both
   reject. S does not advance `commitSeq`, so both A's dismiss (use-step-commit.ts runCommit
   writing path) and S's `notifyDismiss` fire, two notices of the same number. Spec says one.
   By reading only; worth a test row.
3. Low. `notifyDismiss` runs synchronously in the catch, where the writing path yields once
   (`await undefined`) first. Probably harmless (already past the first await), but the
   asymmetry is undocumented.
4. Low (docs). NumberFieldPage: "Steps have no draft and are written as before; so is a form
   reset." reads as if a reset kept something; say "a form reset's value is written whatever its
   validity" as TextFieldPage does.

## Verdicts on the open choices

1. Rejection `"dismiss"` only when the draft was dropped and no writing commit came after:
   agree (correct and minimal); add the row of finding 2.
2. Escape `"dismiss"`: yes, see finding 1 (also disabled/readOnly, same-value reset).
3. No view-transition types on a stateless dispatch: agree; nothing the commit types describe
   changes.

## Checked, fine

- tooShort: browser row counts `value` writes through the setter and asserts `tooShort` after
  settle; TextField renders `draft ?? optimistic`, unchanged through the stateless settle.
- Ends of a kept draft: edit (`openDraft` / `typed`), Escape, valid commit, step
  (`resolveBase` -> `clearDraft` -> `dropKept`), reset (`readDefault`), disabled/readOnly
  (layout effect, tested both components), own rejection (token check).
- Not dispatched twice: `keptRef` check after `valid` is read, so a lifted constraint commits.
- Controlled: `uncontrolled` gate; tests cover a non-adopting parent.
- Tests: good coverage of overlap, rejection after more typing, boundary route, reportError,
  form submission blocked with FormData, textarea, validate-only, no action prop.
- Skill item 5 and FieldPage / ActionPropsPage text match the rule.
