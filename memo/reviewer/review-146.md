# Review: #146 whilePending (branch feat/146-while-pending, ca165c2..c48a2bd), 2026-11-24

Verdict: **fix first (small).** Implementation, defaults, a11y and tests match the user decisions.
The blocking items are documentation accuracy for the opt-in `"run"` mode on closing parts
(public pages promise "a rejection leaves the overlay open", which is false there), plus a
product decision on that UX (F1). No code defect in the default paths.

Verified: jsdom suites for button/menu/toast/dialog/popover/internal pass on the branch (1353
tests); typecheck, lint, format:check clean. Mutation runs (each reverted): Button default
-> "ignore" (11 fail), Button aria-disabled without `&& ignoring` (8), formAction guard
unconditional (1), Close default -> "run" (10), Close aria (6), Menu.Item fixed "ignore" (4),
Menu aria (2), Toast.Action fixed "ignore" (4), Toast aria (2), Dialog.Close not forwarding the
prop (9). The new and flipped rows do pin the behaviour.

## Findings

### F1 (medium; UX + docs) "run" on a closing part closes over a failed latest run
`packages/ui/src/internal/use-action-trigger.ts:85-86` runs `then` (the close) for every resolved
run, independent of runs still in flight.
The developer's analysis is right: library-mode Close / closing Menu.Item `then` is a Root
transition, React entangles it with the part's pending async runs, so the close commits only when
every run settled (pinned: overlay-close-part-suite.tsx:416, menu.test.tsx:1323). Consequence:
click Close twice, run 1 resolves, run 2 rejects -> the boundary above the part catches it AND the
overlay closes in the same commit. The fallback renders inside a closed (usually unmounted)
overlay: the user sees a successful close; the failure is visible only to componentDidCatch /
onCaughtError. JS-free mode is the same in effect: native close at run 1, run 2's rejection goes
to a boundary inside the hidden dialog (design dialog.md:803 / popover.md:697 "takes the usual
route" understates this).
Docs contradict it: DialogPage.tsx:313-314 and PopoverPage.tsx:355-356 ("A rejection ... leaves
the dialog/popover open"), MenuPage.tsx:116 and :363 ("A rejection leaves/keeps the menu open");
the whilePending rows (DialogPage.tsx:330, PopoverPage.tsx:368, MenuPage.tsx:371) say only that
the close waits for every run. Not mentioned on Pending & optimistic either.
Suggested (needs PO/architect decision): in "run" mode request the continuation only when the run
is the last in flight and the latest run resolved (track a "latest rejected" flag; skip `then`
while inFlight > 0). That makes "a rejection leaves it open" true in both modes, fixes JS-free,
and is what the user sees anyway (the commit already waits). Minimum: document on the three
pages that in "run" mode a later run's rejection does not keep the overlay open once an earlier
run resolved.

### F2 (low; docs) Toast.Action "run" text wrong with closeOnSettle
`packages/ui/src/toast/toast-action.tsx:52` and `packages/docs/src/pages/ToastPage.tsx:411`:
"the Action and the Root stay data-pending and the timer paused until every run has settled, and
the toast closes once". With `closeOnSettle` (true) + "run" the toast closes at the first resolved
run (toast.test "a closing Action ... first run closes the toast"), so nothing stays pending.
True only with `closeOnSettle={false}`. Say which case.

### F3 (low; test gap) formAction "run" data-pending lifetime not pinned
`packages/ui/src/button/button.test.tsx:962`: resolves submission 1 then 2 without asserting
`data-pending` between them. Add `expectPending` after the first resolves (React's form status
keeps the optimistic pending state until the entangled submissions all finish; that is the
documented lifetime). Browser row 24 also polls only the end.

### F4 (info) Notes, no change required
- aria-disabled per mode is correct in all five parts; a prop change mid-pending flips it on the
  re-render and applies to the next activation (row 5d; counter is incremented in both modes, so
  "run" -> "ignore" blocks correctly). Close parts JS-free without action unchanged.
- Keyboard: Enter/Space and implicit submission covered in both modes (jsdom 5b, browser 24). In
  "run" mode a held Enter on a host button auto-repeats clicks (native), each a run; matches
  React's own button, maybe worth a sentence next to the counter example.
- Two Buttons with different function formActions in "run" (or not): React's status.action is the
  latest submitter's, so the first Button drops data-pending while its submission still runs.
  Pre-existing (6.2), unchanged here.
- Types: CheckboxItem omits `whilePending`, RadioItem inherits; root export only; type tests cover
  absence on FormSubmit/ToastClose/ToastActionOptions. OK.
- Docs otherwise accurate: Action props, Pending & optimistic, Button (ButtonCounter: count jumps
  only when all runs finish, stated), Roadmap breaking entry, SKILL.md, playground. CSS
  `[aria-disabled]:not([data-pending])` in menu.css / menu-demo.css is right (a disabled item never
  pends).
