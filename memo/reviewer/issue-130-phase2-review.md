# Review: #130 phase 2 (branch refactor/130-phase2, head 79bbea8 on master d21d3ed)

Verdict: **merge after fixes** (all findings low or nit; no coverage lost). Optionally merge as is
and fold 1-3 into a follow-up.

Scope: T3 (overlay-close-part-suite), T4 (held content in the open-state suite), T5 (`partCloses`),
T7 (foreign-invoker-press-browser-suite), #130 review findings 1 and 3, #133 review gaps 1 and 2.

## Runs (private worktrees under scratchpad/rev-130b/)
- jsdom shuffled (seed 4711): 69 files, 3416 passed. (Needs `pnpm build` first: one file reads dist.)
- Chromium: 522 passed + 6 skipped (528). Firefox: 496 passed + 32 skipped (528).
- Counts match the developer memo (jsdom 3416, browser 528).

## Coverage: removed rows vs replacements
- T3 Dialog (dialog-close.test.tsx) and Popover (popover.test.tsx) Close-with-action rows: every
  pair from the audit (pending then close, rejection inside, rejection + reset, re-entry library,
  re-entry JS-free, two clicks one task, render element aria-disabled owned, stale close after
  dismiss + re-open, disabled Close) has a suite row, now in both modes for both components.
  Assertions kept: details.event.defaultPrevented, returnValue (via `value`), Root not pending,
  close args, `[true,false,true]` after the stale close. Dialog's D6 aria-disabled row moved from
  library to static mode: `use-overlay-close.ts:100` is mode-independent, so no loss.
  Popover's two JS-free rows (re-entry; "hidePopover() after resolve") merged into one suite row
  that asserts everything both did (plus "no close before resolve"): the 2 -> 1 kill count for
  the JS-free hide mutant is that merge, the mutant is still killed (checked below).
- T4: Dialog's 4 + Popover's 5 + Menu's 2 smoke rows -> suite "held content (design 4.4)", per
  part. The read point moved from a spied close()/hidePopover() to the closing `beforetoggle`;
  both shims fire it synchronously inside the call (the no-hold mutant fails Dialog's suite rows,
  so the Dialog read point works).
- T5: Menu's #110 block -> suite rows with `[the Trigger]`. The pending-state checks (popovertarget
  kept, no aria-expanded, not data-open, data-pending, no hide) are in `expectShown` and the
  part-close row; "item keeps focus" became "Trigger not focused, then focused after" (equivalent
  for this mutant set). Menu now also gets the veto / overlap / rejection-caught rows.
- T7 jsdom: removed classifier rows (Menu custom command, another popover, plain button; Combobox
  plain button, input type=button/reset/text) are all in internal/invokers.test.ts. The 13 -> 9
  drop is rows, not mutants: see the table below, every over-matching mutant is still killed.
- T7 browser: Menu and Combobox rows map 1:1 onto the suite (2 kinds + dragged-off). Kept:
  focus at press, single (false,'activate'), event type, ToggleEvent, source, focus after close,
  quiet period, Combobox's text and no value dispatch (`expectUntouched`).

## Mutation spot-checks (all reverted; jsdom unless noted)
| mutant | killed by |
| --- | --- |
| invokers: any `command` | invokers.test (1) |
| invokers: any popovertarget target | invokers.test (1) |
| invokers: plain button is an invoker | invokers.test (3) + combobox focus-loss (1) |
| invokers: any input type | invokers.test (1) |
| invokers: disabled ignored | invokers.test (1) |
| invokers: form-owner submit ignored | invokers.test (1) + combobox submit-in-form (1) |
| invokers: inside-popup ignored | invokers.test (1) |
| invokers: `commandfor` on an input | survives: equivalent (no `commandForElement` on input, in jsdom or browsers) |
| guard listener never prevents | menu (2) + combobox (1) wiring rows |
| Popover.Close JS-free: no hidePopover | 1 suite row |
| Dialog.Close JS-free: no close(value) | 1 suite row + dialog-close:353 |
| no hold without transition (overlay-popup.tsx:76) | 21 rows incl. held-content in all three |
| hold even with transition | 4 "with transition" rows (Dialog, Popover, Menu x2) |
| Menu.Trigger mousedown prevent removed | 3 suite rows (link Trigger) |
| Combobox: relatedTarget-in-popup as leave | gap 2 row 1 only |
| Combobox: deferred check ignores popup | gap 2 row 2 only |
| interest noteOpen always true | 4 jsdom gap rows; Chromium 2 gap rows |
| vitest.setup: no jsdom body clear | setup-teardown row 2 |
| vitest.setup: no browser top-layer close | environment row 2 (Chromium, Firefox) |
| vitest.browser.setup: no releaseHeld | environment row 2 (Chromium, Firefox) |
| setup-teardown without `{ shuffle: false }` | seed 3 fails row 2 (so the option is needed) |

## `{ shuffle: false }`
vitest 5.0.5 resolves a suite's shuffle as `this.shuffle ?? options.shuffle ?? parent ?? config`
(runner run.*.js), so `false` on the describe wins over `sequence.shuffle`; files and sibling
describes still shuffle. Seeds 1-6 keep the order; without the option seed 3 reverses it. Fine.
Known limit (no change asked): row 2 alone (`-t "starts clean"`) throws on the unset `popover` /
`dialog`; the file comment already says the rows depend on their order.

## Gap rows vs design
- Gap 1 (popover.md 2.3, amendment #127 table: "lost interest while shown, but the current open
  was not an interest open ... nothing"): rows open by script showPopover() and a foreign
  show-popover invoker, then interest + lost interest; assert open and no dispatch. jsdom both
  modes, Chromium real interest. Matches. (The design's examples are Trigger click, foreign
  commandfor, pre-hydration; script is "not an interest open" too.)
- Gap 2 (combobox.md 5.4: focus leaving closes only for a target "outside the input and the
  popup"; null relatedTarget -> deferred check of the active element): row 1 relatedTarget inside
  the popup, row 2 null relatedTarget with focus inside; both assert open, text kept, no dispatch.
  Matches, and each row is the only killer of its own mutant.

## Findings
1. Low. dialog-close.test.tsx:353 "JS-free: a Close action closes with close(value) directly when
   it resolves" is Dialog's copy of the Popover row the developer merged into the suite's JS-free
   re-entry row (same steps, same assertions minus the re-entry). Delete it for symmetry, or say
   why Dialog keeps it.
2. Low (comment hygiene). popover.test.tsx:951, popover.browser.test.tsx:1408,
   combobox.test.tsx:1430 cite "#133 review, gap n". The reason is in the sentence, but the label
   points at a reviewer memo, not a lasting source; S9 asks for the design section instead.
   Replace with "popover.md 2.3, amendment #127" (Popover) and drop it from Combobox (it already
   names design 5.4). Popover's jsdom comment also puts the label mid-sentence ("... anyone else
   (#133 review, gap 1) stays"). Same for dialog-close.test.tsx:48 "#81, D3": "D3" was a review row
   label whose siblings D1/D2/D4/D6 are gone from the file; keep "#81" or the design ref.
3. Nit. overlay-open-state-suite.tsx:1195 type map key `"fsui-open"` matches no type the library
   emits (Popover's old row used `fsui-popover-open`; conventions 5.3 `fsui-<component>-open`).
   Still a smoke row, but use a real key (derive from the component, or `default` only with a
   comment) so the row reads as intended.
4. Nit. overlay-close-part-suite.tsx:117 `(notify as unknown as { event?: Event })`: constrain
   `D` to the open-state suite's `OverlayDetailsLike` (it has `event`) and drop the cast.
5. Nit. Describe naming: "open state (shared overlay suite)" vs "Close part with action (shared
   suite)" / ": a press on a foreign invoker while shown (shared suite)". Pick one suffix.
6. Nit. combobox.browser.test.tsx:1671 module-scope `let valueAction` assigned inside `render`
   to feed `expectUntouched`; works (rows are serial), but a closure returned from `render` or a
   `setup` result would keep state per row. Fine to leave.

## Checked, no issue
- New suites read like the existing ones (config interface with JSDoc per field, `renderBoth`,
  same helpers); `partName` only suffixes where a component has two parts.
- Foreign-invoker suite runs outside act for both components now (Menu used act-wrapped mouse);
  green on Chromium and Firefox; CI green on WebKit (run 40159090582).
- environment.browser teardown rows: the file-hook check (`mountedInFileHook`) confirms the hook
  order (file afterEach before the setup's unmount); `finally` removes the raw elements if the
  setup did not.
- number-field titles (finding 1 of the phase 1 review): ids moved to comments.
