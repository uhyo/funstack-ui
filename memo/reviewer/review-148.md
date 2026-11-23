# Review: #148 onOpenChange / requests vs facts (branch feat/148-on-open-change, head c693886)

Scope: packages/ui library + tests (docs site left to the technical writer). Read: vision
principle 3, conventions 2.1/2.6, design/components/overlay-open-change.md, issue #148,
memo/developer/issue-148.md.

Verdict: **merge** (acceptable; the findings are test gaps and a migration/a11y note, no library
defect found). M1 should be fixed soon (before or right after merge), the rest at leisure.

## Verification done

- jsdom + jsdom-isolated: 3568/3568 green (after `pnpm build` for directives.test). Browser
  (Chromium, Firefox): green. typecheck green, lint clean apart from a pre-existing warning.
- Mutation tests (each reverted):
  | Mutation | Result |
  | --- | --- |
  | reducer ignores the epoch (`false ? prev : ...`) | 5 fail (adoptFact unit row, "the fact wins" rows Popover/Menu) |
  | Popover echo = `!ctx.intended()` (the master classification) | 12 fail (fact during pending part close, superseded rejection; Popover + Menu) |
  | adoptFact does not bump `latest` | 12 fail (superseded rejection rows Dialog/Menu/Popover, fact-wins, unit) |
  | `startTransition(() => adoptFact(false))` (fact not urgent) | 57 fail |
  | #115 path disabled (Popover/Menu trigger + Combobox trigger) | 1 jsdom + 4 browser (Chromium, Firefox) fail |
  | `libraryHide` consumed only by a closing toggle | **0 fail** (jsdom, Chromium, Firefox): L2 |
  | Toast `onClose` run in `startTransition(async () => await onClose())` | **0 fail** in the toast suite: M1 |
- Throwaway browser probes (Chromium + Firefox, removed): focus after a refused Escape is back on
  the initial-focus target (Popover with `initialFocus`, modal Dialog, Menu first item);
  un-migrated controlled Menu / Combobox (L3).

## Epoch-in-reducer deviation

Correct. React re-applies pending optimistic updates on every render with that render's reducer
(the reducer mutation proves the drop depends on it). `adoptFact` is only reached from `toggle` /
`close` listeners (async events, discrete priority), so `setEpoch` is a sync-lane update: any
later render (sync or transition) includes it, and a transition render in progress is
interrupted/rebased. `dispatchEpoch` is read from `epochRef`, updated synchronously, so a dispatch
in the same event after the fact keeps its patch. The reducer is pure (StrictMode double-call
fine). Only caveat, already documented in the JSDoc: calling `adoptFact` from inside a transition
would make the epoch a transition update and leave stale patches visible until it commits.

## Findings

### M1. Toast: the "not awaited / not entangled" row asserts nothing
`packages/ui/src/toast/toast.test.tsx:1274`. `startTransition(() => { done = true; })` runs its
callback synchronously in every implementation, so `done === true` holds even when `onClose` is
awaited inside a transition (the master behaviour). Mutation: wrapping `onClose` in
`startTransition(async () => { await onClose(details) })` in `callCloseHandlers` passes all 120
toast rows. The entanglement removal (design 7, the main reason for the rename) is unpinned.
Fix: in the row, start a transition with a `setState` (e.g. a harness counter rendered to the
DOM) while `onClose` is pending, and assert the DOM shows the new value before `slow.resolve()`.

### L1. Toast: "after the toast is marked ending" is vacuous
`toast.test.tsx:1254-1271`. `endingAtCall` is `getAttribute(...)` (string or null), so
`not.toBeUndefined()` only proves the handler ran. Moving `callCloseHandlers` before `write()`
would pass. Either assert the order through something observable at call time (for example
`toast.dismiss(id)` inside `onClose` being a no-op because the entry is already ending, or the
retained queue) or drop "after the toast is marked ending" from the title.

### L2. `libraryHide` "consumed by every toggle" is unpinned
`packages/ui/src/internal/use-popover-popup.ts:306-309`. Consuming the marker only on a closing
toggle passes every jsdom and browser row. The failure it guards: a library `hidePopover()`
coalesced with a show (open -> open toggle) leaves the marker set and the next real dismissal is
taken for an echo: no `onOpenChange`, committed stays `true` (uncontrolled), Trigger keeps
`data-open` for a hidden popup. The code is right; add a jsdom row (hide via the apply effect and
show in the same task, then dismiss: one `onOpenChange`).

### L3. Un-migrated controlled Menu: keyboard cannot dismiss (design consequence, a11y note)
Probe: `<Menu.Root open={open} openChangeAction={setOpen}>` (pre-#148 controlled code, no
`onOpenChange`). Tab out: hidden, re-opened in the fact's commit, focus back on the first item
(3 toggles). Escape: same. The only keyboard ways out are activating an item or the Trigger. Not
a bug (design 2.4 / decision 3: re-open with initial focus; W1 warns in development), but for an
app that misses the warning it is a WCAG 2.1.2-style keyboard trap, while on master the same
code closed normally. Combobox in the same setup re-opens the listbox with focus outside (an
orphan listbox, no trap). Suggest: keep the Roadmap breaking-change item 2 prominent, and the PO
may consider (not required) whether a re-open after a refused **Tab-out** fact should skip
initial focus for Menu. Record only; no change requested in this branch.

### N1. Test title says "(uncontrolled)" for the controlled run
`packages/ui/src/__tests__/overlay-open-state-suite.tsx:1036`, inside `renderBoth(...)`; the
controlled variant is reported as "... (controlled) > the fact wins ... (uncontrolled)". Drop
the suffix (the body already branches on `mode`).

### Info (no action)
- `hiddenBeforeToggle()` (`use-overlay-root.ts:339`, `use-popover-trigger.ts:174`) also catches
  a `<button>` Trigger click that lands between an Escape hide and its `toggle` task: the click is
  swallowed and the fact is labelled `"activate"`. Needs the click task to run before an already
  queued toggle task; theoretical.
- A fact while a hydration-open request (`"platform"`) is in flight supersedes it (the empty
  popup was shown): consistent with 2.5, not covered by a row.
- Two controlled Roots that both refuse facts and are both `auto` popovers ping-pong (each
  re-open hides the other). Consumer misconfiguration, same on master but slower.

## Checked and fine

- Classification: every `hidePopover()` / `close()` outside the apply effects is a fact path
  (Menu Tab-out `menu-popup.tsx:308`, right-click / scroll `menu-outside.ts:57`,
  `menu-gestures.ts:104`, Combobox focus-out `combobox-root.tsx:751`, interest hide
  `use-interest-dismiss.ts:67`, Dialog JS Escape / light dismiss `requestClose()`); hover close,
  pending-interest close, parts and Trigger stay requests; the Menu move (`reshow`) produces an
  open toggle and no fact. Submenu hidden by its parent: own `toggle`, no marker, a fact.
- Dialog: `libraryClose` echo, `dismissedWhilePending` removed cleanly, the apply effect re-opens
  on `committed && !open && !awaitingClose`; `awaitingClose` is cleared before `notifyClosed`, and
  React's sync commit runs after the listener, so the re-open happens in the fact's task.
- call-urgent-handler: throw and rejection reported; Combobox text write and the following
  `requestOpen` still run (row pins it); Toast: other toasts' handlers still run after a throw.
- Toast timing: `onClose` after the queue write and `syncTimers`, synchronously in the click /
  timer / command loop; Toast.Action's "activate" close runs after an `await`, so outside the
  Action's transition (React limitation) as the design requires. Viewport unmount: no call.
- W1, mode detection with `onOpenChange`, action-naming type guard, `UrgentHandler` export.
