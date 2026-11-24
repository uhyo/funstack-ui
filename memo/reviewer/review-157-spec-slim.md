# Review: docs/157-spec-slim (head 8371a4a)

Reviewed 2026-11-24 against master 4be5c5b (the merge base). Method: per-document line diff
against master, every removed line checked against the new body and `design/CHANGELOG.md`
(conventions.md: every hunk read; popover, dialog, button, toast, toggle-group: every hunk
read; the rest by count); old `overlay-open-change.md` 2.x / 9 compared sentence by sentence
with conventions 3.9; the four flagged places compared with the source; every
`<doc>.md N.M` citation in `packages/` resolved by script against the headings.

**Verdict: acceptable with minor fixes.** Mergeable once M1 to M3 and L1 are fixed (all are
small text edits). None of M1 to M3 is a regression against master (the text was already
stale there), but each contradicts the branch's own claim that the #148 sweep and the
`aria-expanded` cleanup are done. L1 is new with the branch.

Note: the branch contains the `feat/157-align` merge (bda96ce). It was not on master when the
review started and was merged to master during it, so merging this branch no longer brings in
code. On the branch, `pnpm --filter @funstack/ui typecheck` and the jsdom tests of accordion,
form, toast, dialog and popover pass (835 tests); I did not run the full `test:run` / browser
suites.

## Medium

**M1. #148 is not fully swept: five places still describe a dismissal as an
`openChangeAction(false)` notification.**
- `design/components/dialog.md:29` (decision 2): "dismissals are browser-owned (...: closed at
  once; `openChangeAction(false)` is a notification from the `close` event)". Should say: a
  fact, committed `false` urgently, reported to `onOpenChange` (2.7). Same row: "Library mode
  (any of the three present)" should be "any of the four" (onOpenChange was added to the
  JS-free list in the same row).
- `design/components/dialog.md:1352` (keyboard table, Escape modal) and
  `design/components/popover.md:1099` (keyboard table, Escape): "`openChangeAction(false, {
  reason: "dismiss" })`" -> "`onOpenChange(false, { reason: "dismiss" })`".
- `design/components/combobox.md:1133` (walkthrough 7) and `:1174` (walkthrough 14):
  "`toggle` -> `openChangeAction(false, { reason: "dismiss" })`" -> `onOpenChange(...)`.
Why it matters: these are the rows a reader (or an agent through the docs' Markdown edition)
looks up first, and they state the pre-#148 contract.

**M2. `design/components/popover.md` 2.5: the pseudo-code is stale** (architect's flag
confirmed). Against `packages/ui/src/internal/use-popover-popup.ts` (`showPopup` 182-216,
apply effect 252-288):
1. No `refusedFact` handling: the code clears it when `!ctx.committed` and, for a refused
   re-show, writes no initial focus and sets `inert` for the call. The pseudo-code always calls
   `applyInitialFocus` (only the prose after it says "no initial focus").
2. The hide comment says "marked as the library's own" but no marker is set; the code sets
   `libraryHide.current = true` before `hidePopover()`.
3. No `withCssTransitionCut` around `showPopover()` / `hidePopover()` when the Popup has
   `transition` (10.2 and conventions 5.1 describe it).
4. `showPopover({ source: triggerRef.current ?? undefined })` -> the code uses
   `options.source()` when given (Combobox: the input) and passes `source` only when connected.
5. Initial focus: the code has the quiet path (`resolveInitialFocus` returning a
   `QuietFocusTarget`, then `focus({ focusVisible: false })` after the show, 6.1), not
   `applyInitialFocus` / `removeInitialFocus`.
6. `contentHadFocus.current = false` -> `contentProbe.forget()`; the `held` release line ->
   `exit.releaseIfIdle(committed, awaitingClose, shown)`.
Suggested fix: replace the block with bullets in the shape of dialog.md 2.5 (show: refused
re-show = no focus + `inert`; cut when `transition`; hide: `libraryHide` marker, cut, focus
return), which is what the architect did for Dialog and stays true longer.

**M3. `design/conventions.md:1927`, the `open` row of 4.1, is stale on `aria-expanded`.** It
says the Popover Trigger's `aria-expanded` is the shown state and that in JS-free mode the
Trigger has "only `aria-expanded`, kept current by a DOM write"; and that Menu `Trigger`,
`SubmenuTrigger` and Combobox `Trigger` carry "shown `aria-expanded`". Current rule (decision
row 7 and 7.4 of the same document; code `use-popover-trigger.ts:227`,
`menu-submenu-trigger.tsx:66`, `combobox-trigger.tsx:150`): a `<button>` Trigger is a
`popovertarget` invoker and renders no `aria-expanded`; only a non-button `render` and the
Combobox `Input` render it from `shown`; JS-free mode DOM-writes `data-open`, not
`aria-expanded`.

## Low

**L1. Text artifacts left by stripping issue references** (new with the branch):
- `design/conventions.md:3072`: line starts with " , both documented:" (was "(review L4), both
  documented:").
- `design/components/popover.md:94`: "from the Root's `shown` mirror /)".
- `design/components/popover.md:130`: "2.7 and)." (was "2.7 and #115").
- `design/components/popover.md:611`: "cannot change;)," and `:616`: "win over it;)."
- `design/components/toast.md:409`: line starts with " . The first shape".
- `design/conventions.md:1429`: "a press on a part outside the popup that is neither a button
  naming the popover hides" (the "nor" half went with `source`; say "that is not a button
  naming the popover").

**L2. `design/components/button.md:877` (17.1, `Form.Submit` row) vs `form-submit.tsx`.** The
"Click handler always installed?" cell says "only for a host element of another tag"; the code
(`form-submit.tsx:106-112`) installs `onClick` whenever `disabled`, for every render. The
submitter test also counts a host `<input>` render (`form-submit.tsx:91`), which the row omits
("a `<button>` or a component render").

**L3. `design/components/dialog.md` 2.5 (architect's flag): accurate**, checked against
`dialog-popup.tsx:269-353`. Guard, show (refused non-modal: no `autofocus`, `inert`), close
(`libraryClose`, `close(returnValue)`, focus return) and the per-commit bullet all match. Two
omissions worth a clause: the open and the close run inside `withCssTransitionCut` when
`transition` is set (10.3 says it, 2.5 does not), and `refusedFact` is cleared by any commit
with committed `false` (3.9.4 says it). "Forget content had focus while the dialog is shown" is
`committed && open` in the code; fine as written.

**L4. `design/components/button.md` 5.1 (architect's flag): matches `button.tsx:220-240`**
exactly, including `submittedWith.current = formAction` and the `ignoring && formPending`
guard. No fix.

**L5. conventions 2.4, hidden-owner rejection: wording correct.** `design/conventions.md:586-598`
matches the code (`useConnected` / `reportDropped` in `internal/report-dropped.ts`, used by
`use-action-trigger.ts:64,96`). The user confirmed report-only (PO status, 2026-11-24 entry:
"Hidden-owner rejection report-only confirmed"), so dropping "pending user confirmation" is
right.

**L6. Citations.** 628 `<doc>.md N.M` citations in `packages/` checked. All resolve to a
heading, except about 60 that cite a subsection of a moved section (`popover.md 14.2`,
`dialog.md 13.1`, `toast.md 16.1`, `select.md 15.2`, `toggle-group.md 16.2`, ...): those land
on the parent stub ("14. Implementation notes: moved to CHANGELOG part ..."), whose
subsections keep their numbers in the changelog. Acceptable. `progress.md 14.1`
(`internal/render-element.ts:118`) was already unresolved on master; it now lands on the
section-14 stub. The one remaining `overlay-open-change.md 2.5` (a test title in
`__tests__/overlay-open-state-suite.tsx:663`) resolves through the stub's section map.
The conventions 3.9 numbering (3.9.1 to 3.9.13) matches the source comments: each cited
3.9.x is the section the comment means (3.9.2 what is a fact, 3.9.3 uncontrolled, 3.9.4
re-open, 3.9.5 in flight, 3.9.7 surfaces, 3.9.8 view transitions, 3.9.11 JS-free, 3.9.13 W1).

**L7. The check script works, with gaps.** On the branch it passes; a planted
`internal/does-not-exist.ts`, `gone-file.tsx` and `src/toggle/nope.tsx` in toggle.md made it
exit 1 with all three named, and `pnpm lint` exit 1 (reverted). `pnpm lint` and
`pnpm format:check` pass on the branch; CI runs `pnpm run lint`. Gaps: paths inside fenced
code blocks and Markdown links are not checked; a bare file name resolves if any file of that
name exists under packages/docs/design/memo; and it does not check section citations from
source comments into design/, which is the more likely way to break things now that sections
move. A follow-up could add that check (the parent-stub rule in L6 is the acceptance rule).

**L8. Remaining inline history** (the architect lists most): `conventions.md:2761` "since
#148"; `toast.md` decision 13 "(accepted and implemented 2026-10-18, ada1cba)"; "wave 9,
5fc05d5" in `popover.md:94` and the `disabled` row of conventions 4.1; "(review M1)" and
"(review L5)" in the conventions 10.1 Placement row. Harmless; a later pass.

**L9. Not decided by the user:** the "Docs page(s)" sections (button 14, progress 13,
toggle-group 15, context-menu 12) moved with the test plans. Reasonable (instructions for
finished waves), but the PO should confirm. CLAUDE.md does not mention `design/CHANGELOG.md`
or the new lint step; that is the user's file.

## Fidelity: what was checked and holds

- conventions.md: every removed or edited line read. Removals are issue numbers, dates,
  decision markers, review references, "before #n" clauses, "what this replaces" paragraphs and
  the moved Status / question logs; rules are kept, several reworded into present tense (2.5.1
  table, decision rows 2, 7, 11, 13; 3.5 light-dismiss bullet restructured into three traps
  without losing a rule; 12 shipped CSS now "placement and interaction timing", matching the
  #21 exception). 3.9 carries every current rule of old overlay-open-change.md 2.1 to 2.12 and
  9 (refused re-open focus with `inert` (#155/#156), late adoption, no heuristic warning,
  four-prop JS-free test, hydration as request, `onOpenChange` only with `false`, Server
  Functions, errors).
- Amendment outcomes present in the bodies: #145 (`reportError` for superseded, conventions
  2.4), #146 (`whilePending`, conventions 2.5.1, button 5 / 16 / 18, each Close / Menu.Item /
  Toast.Action), #147 (library cut, conventions 5.1, popover 10.2, dialog 10.3), #148 (except
  M1), #150 (settled changes, 3.3), #151 (absolute reset joins a burst), #152 (owner gone),
  #153 (burst decision not inferred from `event`), #154 (Button latch, button 6.2 / 18.3),
  #155 / #156 (3.9.4, popover 6.1, dialog 2.3), #157-align (accordion document order,
  toast.md `disabledButton`, field-form Form.Root `reportError`).
- button.md: decisions 3 to 5 now state `whilePending`; 5.4 / 5.5 / 7.3 / 16 / 17 / 18
  rewritten to the current rule; the removed staged-rollout text is superseded.
- dialog.md: the stored dismissal (`dismissedWhilePending`) and its walkthroughs are replaced
  by "reported at once, supersedes the part's close", which matches `dialog-popup.tsx:443`.
- toast.md: `closeAction` -> `onClose` everywhere in the body; `whilePending` section current.
- toggle-group.md: `Toolbar.Button` gone from the contract; 3.4 and 11.5 keep their numbers
  with the `Button` rule; matches `toolbar/index.ts`.
