# #157 safety net: tests before the refactor

Branch `test/157-safety-net` (not merged). Source: memo/reviewer/refactor-test-safety.md (at
c658d0e). Tests only; no library code changed.

## Method

- Mutation runner: copy the source file, apply a `perl -0pi` substitution, run vitest (whole
  jsdom suite, or named files, or the browser project with `FUNSTACK_BROWSERS=chromium,firefox`),
  copy the original back. Every mutation below was reverted; `git diff` on the source is empty.
- A row "kills" a mutation when it fails with the mutation applied and passes without it.
- Mutations are my reconstruction of the reviewer's ids (the audit names them, not the exact
  edit). Where my first guess was already killed by an existing row (RF6), I tried narrower
  variants too.

## Per gap

| Gap | Rows added (file) | Mutation | Killed by |
| --- | --- | --- | --- |
| CTC3 longhand restore | "restores a longhand the consumer set without the shorthand, with its priority" (internal/css-transition-cut-cssom.browser.test.ts) | restore loop for longhands removed | Chromium + Firefox. jsdom cannot: its CSSOM treats `transition` as a plain property (setting it does not touch the longhands), so a jsdom row passes with the mutation |
| CTC6 forced recalc | browser: "a style change made inside the call starts no CSS transition once the cut is restored"; jsdom: "forces a style recalculation of the element after the call, before restoring" (getComputedStyle spy) | `void getComputedStyle(element).opacity` removed | jsdom (spy row) + Chromium + Firefox (behavioural row: a class change inside the cut, `getAnimations()` empty). Note: the reviewer saw Firefox pass the VT rows under CTC6; this direct row fails in Firefox too |
| CTC7 `cutting` cleared | jsdom: "two cuts of the same element in sequence both cut", "a cut after a throwing cut still cuts"; browser: "a second cut of the same element ... starts no transition either" | `cutting.delete(element)` removed | jsdom 2 rows, Chromium + Firefox |
| RF6 observer attributes | use-roving-focus.test.tsx: it.each disabled / hidden / inert written on the node; aria-disabled flip with an entry that skips it; re-enable outside React | (a) `attributes` + `attributeFilter` removed; (b) callback ignores non-childList records; (c) each attribute dropped from the filter | (a) and (b): the new rows plus the existing "re-applies on observer records" row (so in my runs that row already caught the full removal); (c): only the new rows, one per attribute |
| RF single rows | hook rows for RF2 (memory survives a later commit after blur), RF3 (popover items), RF8 (radio Tab), RF9 (alt / ctrl / meta) | RF2 `if (!options.memory)` -> `if (true)`; RF3 popover check removed; RF8 checked-sibling block off; RF9 `altKey` check removed | each now has the hook row plus its component row (Toolbar / itemsOf / Toolbar / ToggleGroup). RF4 had 3 hook rows already, RF11 now 5 |
| UOR8 facts skip onDispatch | menu.test.tsx hover intent: "a dismissal of the submenu cancels a pending hover open", "a dismissal forgets an open cause recorded while the submenu was shown"; use-popover-hooks.test.tsx: "a dismissal calls onDispatch(false, details) before onOpenChange" | `onDispatch?.(false, built)` removed from `notifyClosed` | 3 rows (2 Menu, 1 hook) |
| UPP2 refused re-open + quiet focus | use-popover-hooks.test.tsx: "a refused re-open with a quiet initial focus target leaves focus where the dismissal put it" (jsdom; `HTMLElement.prototype.focus` spy reads `focusVisible`, `resetFocusVisibleOption()` before and after); menu.browser.test.tsx: "a pointer-opened menu whose parent refuses Escape re-opens with focus left on the Trigger (#155)" | `refused ? null : resolveFocusTarget(...)` -> `resolveFocusTarget(...)` | the jsdom hook row. The Menu browser row does NOT kill it (Chromium + Firefox): see below |
| UPP6 sync focus return | use-popover-hooks.test.tsx: "a library close with transition returns focus before the close's toggle task" (fake `setTimeout` only, assert before advancing) | `if (focusWasInside.current) returnFocus(element)` removed from the apply effect | 1 row |
| NGR9 second late batch | use-native-group-reconciliation.test.tsx: "two late boundaries hydrating in separate commits: each pre-hydration click dispatches" (renderBoth) | `lateQueued.current = false` removed | 2 rows (uncontrolled, controlled). Put in the hook test (its minimal radio group), not in native-group-platform-suite: the suite's drivers have no late-boundary hook |
| NC3 equal reset restores checked | use-native-checked.test.tsx: it.each "a reset target equal to the intent (controlled / pending dispatch) writes checked back, without a dispatch" | `else if (el.checked !== base) el.checked = base` removed | 2 rows |
| FC3 change detection | new internal/use-field-control.test.tsx (7 rows) | (a) `Object.is` early return removed (notify every commit); (b) `previous.current === undefined ||` added (never from undefined) | (a) 7 rows, nothing else in the suite; (b) the undefined-first row |
| UAT6 three runs | use-action-trigger.test.tsx: "three overlapping runs: a resolved continuation does not survive a newer run that rejects" + the resolving control row | `resolvedThen.current = null` removed from `run` | 1 row (the control passes either way, by design) |
| Combobox in jsdom suite | combobox.test.tsx: `describeOverlayOpenState` with a Combobox harness (113 rows); driver overrides `openArgs` / `controlledOpenArgs` (the Input is the `source`); the List carries `content` (keepMounted's Activity hides the top-level node) | - | all 113 pass on current code |
| UOR6 / UOR9 / PT1 (Popover-only rows) | overlay-open-state-suite.tsx: "the cause of a fact" (commandfor close keeps its CommandEvent, renderBoth) and "a non-button Trigger pressed while open" (#115), gated on `popoverTarget` | UOR6 `unlessRecorded` off; UOR9 `hiddenBeforeToggle` false; PT1 trigger branch off | UOR6: 8 rows (Popover, Menu, Combobox); UOR9: 4; PT1: 3 (Popover, Menu; Combobox's Trigger has its own path, so its row passes under PT1) |
| Dialog single rows | dialog.test.tsx: refused Escape via the parity harness (non-modal / modal), Escape with a Menu inside, backdrop click with no press; dialog-close.test.tsx: JS-free non-modal script close + `show()`, non-modal controlled close with transition; dialog-form.test.tsx: same-node stopPropagation with a plain form, controlled | DP1, DP14, DP8, DP10, DP11, DP5, DP6 (see dp.sh list in the report) | each now 2 distinct rows. DP2 left at its two twins |

## Findings

- No real bug: every new row passes on current code. UPP2 and UAT6 (the candidates) pass.
- UPP2 is masked for Menu today: `resolveInitialFocus` calls `takeOpenCause()`, which the first
  show already consumed, so a refused re-open gets `DEFAULT_FOCUS` (`pointer: false`), a plain
  `autofocus` target that the `inert` window neutralises. The quiet path is reachable only when
  `openCause` is a pointer cause at the refusal, which no current flow produces (I did not find
  one; the ContextTrigger's right-click in the hidden-before-toggle window sets `openCause`
  directly and is the closest candidate). Hence the hook-level row with a resolver that is always
  quiet.
- NC3's branch is reachable for a single checkbox only if the DOM changes between the reset
  algorithm and the hook's microtask (the algorithm itself writes `checked = defaultChecked`).
  The rows write `checked` synchronously after `reset()`. Two same-name single-control radios do
  not work as a scenario (their two microtasks fight; mount reconciliation reports first).
- Popover now runs the two ported rows twice (its own and the suite's). Kept on purpose.
- The Menu-in-Dialog Escape row must not focus the menu's Trigger: focus leaving the menu is a
  dismissal. The keydown is dispatched on the Trigger without moving focus.

## Not done

- DP2 (re-open while awaiting close) still rests on its renderBoth twins.
- NGR8, NC4, MP4, MP6, UPP7, UPP10, UPP13, OP3, OP4, PT5, FC1, UAT7 single-row guards: not
  touched. OP7 jsdom row and PT4 jsdom row: not added.
- UCA6 / UCA12: the reviewer's own priority 10, not needed unless callers widen.
- WebKit not run locally (no DEPENDENCIES_VALIDATED); the new browser rows need a CI run.
