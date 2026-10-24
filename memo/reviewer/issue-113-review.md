# Review: #113 small follow-ups (branch fix/113-small-followups, 94ea051)

Verdict: **acceptable with minor fixes** (all findings are minor/nit; none blocks merge).

## Verification done
- typecheck, lint, format:check, test:jsdom (66 files, 3202 tests) pass on the branch tip.
- number-field.browser.test.tsx: Chromium + Firefox pass; WebKit failed to launch locally
  (host deps, environment only).
- BCD 8.1.7 (timestamp 2026-10-22): `api.Element.ariaNotify` and `api.Document.ariaNotify`:
  Chrome 141, Firefox 150, Safari 27 (also Android/iOS counterparts), not experimental.
  Current stable: Chrome 156, Firefox 158, Safari 27. The developer's facts are right.
- API3 false-positive probes (private worktree, StrictMode where relevant), all no warning:
  Activity hide/show of a Trigger; two Triggers swapped between hidden/visible Activities;
  conditional swap of Menu.Trigger at different tree positions; one Trigger element moving
  between two Popover Roots; Suspense re-suspend/resume around Combobox.Input; Menu.Trigger +
  Menu.ContextTrigger + two SubmenuTriggers in their own Roots; Combobox.Input +
  Combobox.Trigger. Reason it holds: React detaches refs (deletion, changed ref, hidden
  Offscreen) in the mutation phase before any layout-phase attach, and StrictMode's
  attach/detach/attach runs the cleanup that clears the ref.
- Production: dist keeps `isDev && ...` (`process.env.NODE_ENV`), same pattern as the other
  dev warnings; the example's Vite production build contains no copy of the message.
- Mutations (each reverted): removing the `ownsArrows` guard in toast-root fails the A3 test;
  dropping the `warned` WeakSet gate fails all 5 "warns once"; making the cleanup a no-op fails
  all 5 StrictMode/replace tests; a wrong `value` in MenuRadioItem state fails the API2 test.

## Findings

M1 (minor) packages/ui/src/__tests__/vitest.setup.ts:24 and :36,
packages/ui/src/internal/announce.ts:24-28 - the setup comment still says it resets "the
announcer's live region (it outlives the unmount, with its pending writes)", and
`resetAnnouncer()` is now an exported no-op kept only for that call. Drop the export, the
import, the call and the comment clause (simplest), or at least fix the comment.

M2 (minor) design/components/number-field.md:1008-1009 - "moving them onto `announce.ts` (which
would give them the fallback region) is the optional follow-up in issue #77" is now a stale
rationale: there is no fallback region to give. Reword (the move is now only a
deduplication). The historical records at :1339 (N4), :1408-1411 (conventions proposal 9) and
:1476 (PO item 12) are fine as history but could take a one-line "superseded by #113 A1"
pointer so a reader does not take them as current.

m3 (nit) design/components/toast.md:496, packages/docs/src/pages/ToastPage.tsx:468 - the list of
arrow-owning elements omits what `ownsArrows` also covers: native `input[type=radio]`,
`range`, date/time and other non-button inputs (anything not in BUTTON_LIKE_INPUTS). The
docs page says "a text field, `select` or slider"; contenteditable and radios are missing.
Pointing at the conventions roving rule (6.3 / 17.2) rather than re-listing would avoid drift.

m4 (nit) packages/ui/src/internal/trigger-ref.ts:27 - the message ends "Render one per Root, or
a Root per trigger", which reads oddly for `Combobox.Input` and the anchor/"outside" wording
is approximate for a modal Dialog (the other Trigger is inert). Acceptable; consider
`a Root per ${part}`.

i5 (info) BCD notes that on ChromeOS `ariaNotify` is exposed but announcements are never
spoken (and VoiceOver can drop one that coincides with another event). The removed fallback
was feature-detected, so it would not have helped there either; no action, but worth one line
in number-field.md 8.3 if the team wants the known gap recorded.

i6 (info) Test gaps, not blocking: trigger-ref.test.tsx does not cover Activity hide/show or a
Trigger moving between Roots (both verified by my probes above); the toast A3 test does not
include a native radio or role=slider target. Optional additions.

## Item-by-item
- A3: correct; `defaultPrevented` early return already lets nested roving widgets win.
  Escape still dismisses from a field (documented).
- A1: correct per vision ("Latest stable ... No fallbacks"); PO reversal recorded in 8.3.
  Leftovers M1, M2.
- API2: `value` added first in both states; design docs, props text and tests updated.
- API3: correct; no false positives found; dev-only.
