# Review: #117 real-press browser rows (branch test/117-click-while-open, d4c7c52)

Reviewer, 2026-10-24. Diff `origin/master...origin/test/117-click-while-open`; design docs
popover.md 2.3/7, dialog.md 2.3/2.6/7, menu.md 2.2/2.3/7, combobox.md 5.1/5.4/7.1, select.md 8,
tooltip.md 2.1/2.2/5.2.

## Verdict

**Acceptable with minor fixes.** The rows assert what the designs say, the probe is sound, there
are no engine-name branches, and the touched files were stable 3/3 on Chromium + Firefox. #123 is
real (independently reproduced). M1 should be fixed before merge; the rest can be follow-ups.

## Verification done

- Touched files (popover, dialog, menu, combobox, select, tooltip browser tests) run 3 times with
  `FUNSTACK_BROWSERS=chromium,firefox` in a private worktree: 12/12 files, 489 passed, 2 expected
  fail (the #123 row x 2 engines), 17 skipped, every run. Worktree removed.
- #123 plain-DOM probe (no library), real Playwright press + release on the `source`, then
  `element.click()`:

  | source of `showPopover({ source })` | Chromium real press | Firefox real press | `element.click()` (both) |
  | --- | --- | --- | --- |
  | `<input>` | hidden | hidden | stays open |
  | plain `<button>` | hidden | hidden | stays open |
  | `<span>` | hidden | hidden | stays open |
  | none (`showPopover()`) | hidden | hidden | stays open |
  | `<button commandfor command=toggle-popover>`, click prevented | **open** | **open** | stays open |

  So `source` gives no light-dismiss exemption; only the invoker relationship does, and a
  synthesised click never light-dismisses (consistent with the research having probed with
  `click()`). Matches HTML's "topmost clicked popover" (nearest open popover + nearest target
  popover of an invoker). Claim confirmed.
- The `it.fails` row flipped to `it`: fails in both engines at
  `combobox.browser.test.tsx:1352` (`expect(isOpen()).toBe(true)`), i.e. for the #123 reason.
- No added line branches on `browserName` / `server.browser`; the two touched imports were
  pre-existing.

## Findings

### M1. The `it.fails` row masks the rest of its own contract
`packages/ui/src/combobox/combobox.browser.test.tsx:1324-1328`. `it.fails` passes on *any*
failure. Today it fails at line 1352, so the assertions after it (focus stays in the input, text
stays `"j"`, no value dispatch, no extra open dispatch) never run: a regression in any of them
(e.g. the press reverting the text or moving focus) is invisible. And when #123 is fixed by the
"accept a browser-shaped close" option, the row keeps "passing" as `it.fails` forever, since it
still fails at the same line; only the "make the press a non-dismissal" fixes make it flip loudly.
Fix: replace the `it.fails` with a plain `it` that asserts today's behaviour positively and is
named for #123: at the press open + input focused; after the release hidden, one
`(false, "dismiss", "toggle")`, input still focused, text `"j"`, no value dispatch, and no re-open
through a quiet period. Keep a comment that the expected outcome changes with #123's decision.
That row fails loudly whichever option is chosen, and guards the other parts meanwhile. (If the
team prefers keeping the desired-behaviour row, keep both: the `it.fails` one plus the positive
current-behaviour one.)

### M2. Dialog's foreign `request-close` / `close` invoker has no pending-window row
Inventory says EXISTS for "Foreign request-close invoker", but the existing row
(`packages/ui/src/dialog/dialog.browser.test.tsx:369`) uses a synchronous action and
`user.click`: it checks the reason, `CommandEvent` and `returnValue`, not that the dialog stays
open through a pending `openChangeAction(false)` (dialog.md 2.3: "command cancelled; same
dispatch", a library-owned, awaited close). That is exactly the timing class #117 is about, and
Popover got new foreign-invoker rows (`popover.browser.test.tsx:1105`) while Dialog, where the
foreign close is *library-owned* rather than browser-owned, did not. `command="close"` has no
browser row at all. Add one real-press row per command (an invoker inside the modal popup):
open + focus at the press, one `(false, "activate", "command")` with `defaultPrevented`, shown
through the quiet period, hidden after resolve, `returnValue` the invoker's value.

### L1. Inventory gaps (low)
- Menu: item activation **by pointer** inside a submenu (menu.md 2.2 row 1, 7 "Item activation in
  a submenu") is only covered by Enter (`menu.browser.test.tsx:480`). The pointer path has hover
  focus-follow and a press inside a nested popover; worth one real-press row (root awaited
  `"activate"`, submenu `"dismiss"`, submenu hidden only when the root hides).
- Menu: `CheckboxItem` / `RadioItem` / `Item closeOnActivate={false}` press while open (stays
  open, menu.md 2.3, 4) has keyboard rows only (`menu.browser.test.tsx:819-866`).
- Popover: `Popover.Close` **with `action`** (popover.md 2.3 row 2: Close's own transition,
  `data-pending` on the Close, then the dispatch) has no browser row; Dialog has one.
- Dialog non-modal: outside press **without** `lightDismiss` (dialog.md 7: nothing) has no row;
  the existing "non-modal: a click outside closes it" (`dialog.browser.test.tsx:592`) is the
  `lightDismiss` case and asserts neither reason nor dispatch count. Non-modal Close part press is
  not covered (only the modal suite row).
- Tooltip native path: popup press and outside press (hint light dismiss, tooltip.md 2.1) are
  not covered; only the trigger press is. Chromium-only, low value.

### L2. Pending-window assertions not uniform
The suite asserts `aria-expanded="true"` during the pending close (#118), but the bespoke rows
do not: Combobox option (`combobox.browser.test.tsx:1223`, asserts only the final `"false"`),
Popover nested inner Trigger (`popover.browser.test.tsx:568`, the inner Trigger's
`aria-expanded`), Menu sibling item (`menu.browser.test.tsx:558`). Trigger `data-pending` / no
`data-open` during the window (menu.md 2.2, popover.md 2.3) is asserted nowhere in the new rows.
Cheap to add.

### L3. Menu suite "item" row presses the already-focused item
`menu.browser.test.tsx:216`: `content` is the item the keyboard open focused, so
`focusAtPress: "target"` and `"kept"` are indistinguishable and the focus assertion is vacuous.
Pressing `delete` (not focused) would also check the press moves focus to the pressed item
(6.2) and that it keeps it through the pending close.

### L4. `pressFocusesButtons()` robustness (`packages/ui/src/__tests__/engine.ts:168-183`)
Sound idea, cached (module-level promise, one press per file/module instance), button removed in
`finally`. Two nits:
- It caches the first measurement unconditionally. If anything covers (20, 10) at that moment
  (a top-layer element a previous row left open, a fixed header), the press misses the button and
  `false` is cached for the whole file, silently switching every row to the other branch. Assert
  `document.elementFromPoint(20, 10) === button` before pressing (throw otherwise).
- Residue: the press grants transient user activation and leaves the pointer at (20, 10). Harmless
  for the current rows (the probe runs before render), but worth a sentence in the doc comment,
  since Dialog's `cancel` anti-abuse behaviour depends on activation.
- The `false` branch (Safari macOS) is unexercised. The suite's doc for `focusAtPress: "target"`
  says "else what had focus before"; WebKit on macOS clears focus or focuses the nearest
  mouse-focusable ancestor (here the `<dialog>`) when the pressed button is not mouse-focusable,
  so "what had focus before" is a guess. State it as unverified in the comment
  (`overlay-browser-suite.tsx:106-110`).

### L5. Suite API shape (`overlay-browser-suite.tsx:86-120, 432, 491`)
Clear enough, and the doc comments explain each field. Tightening:
- `focusAfter` is optional but required for `"awaited"` / `"dismissed"` (`focusAfter!` at :491
  throws a TypeError, not a readable failure, if omitted); `eventType` only means something for
  `"awaited"`. A discriminated union on `outcome` would make TypeScript enforce both.
- `"kept"` means two things (`outcome: "kept"` and `focusAtPress: "kept"`); rename one
  (e.g. `focusAtPress: "unchanged"`).
- `hiddenAtPress` silently only applies when `pressFocused` (:432 + the branch after the press);
  the name suggests it always applies. The doc says so, but `hiddenAtPressIfFocused` or folding it
  into the outcome would be clearer.
- `"dismissed"` hard-codes `reason: "dismiss"`, so browser-owned `"activate"` closes (Popover's
  foreign invoker) had to be bespoke. Fine for now; note it if a fourth outcome appears.

### Info
- Flakiness: the press assertions use `mouse.down`/`up` (which wait for the input task plus a
  macrotask) and a short `sleep(20)` before synchronous checks of things that happen in the input
  task itself (focus at `mousedown`, the focusout hide, the click's dispatch); positive waits use
  `expect.poll`, negative ones a quiet period. Act handling is consistent (open inside act,
  `leaveActEnvironment()` for the press, restored in `afterEach` together with
  `mouse.releaseHeld()`). The Select rows press inside `act` instead, which is fine there (no
  React open state). No flake seen in 3 runs x 2 engines.
- #123's "openOnClick blink" is unverified, as the issue says.
