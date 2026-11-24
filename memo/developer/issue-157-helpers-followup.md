# refactor/157-helpers-followup (#157 follow-ups, #161)

Branch `refactor/157-helpers-followup` on master f0a7fac. Source: `memo/reviewer/review-157-helpers.md`,
`memo/developer/issue-157-helpers.md`. One commit per item; not merged.

## Items

1. Skipped files: Combobox.Root `resolveFieldDefaults(field, { name, disabled: props.disabled ?? false,
   required: false })`; `useToastFocus` uses `compareDocumentOrder` (exactly equivalent to
   `byDocumentPosition`: for distinct nodes, even disconnected ones, `compareDocumentPosition`
   always sets PRECEDING or FOLLOWING; an earlier version of this note said otherwise);
   Toast.Viewport's second-Viewport warning is `useDevWarning(duplicate, ...)` (first
   `rejected`, which warned falsely for a Viewport replaced in one commit: review major 1; now a
   state set only when the subscription is refused, with keyed-remount and parent-swap tests) (placed before the
   `if (rejected) return null`). New StrictMode test counts it: master warned twice (verified by
   reverting the viewport file), now once. CHANGELOG: new entry only; it states that it supersedes
   the earlier "left for the branch that splits it" remark (an in-place edit was made first, then
   reverted at the coordinator's request: the header says "Never edit an entry").
2. StrictMode count tests: two Selects with a portalled Value -> 2 warnings; two Dialog Roots with
   Trigger only -> 2. Removing `warned.current` in `useElementCheck` gives 4 (killed).
3. Messages fixed, rule unchanged: Dialog.Form -> "Dialog.Form: rendered as a `Form.Root`, it needs
   ..."; `useControllableAction`'s `warn` is required (all components passed it; four internal test
   probes did not). Script scan of every `console.error/warn(`, `isDev &&`, `warnOnce(` first literal:
   no other non-conforming message.
4. Nits: NumberField `resetTarget` is the `useResetTarget(...) ?? null` constant (renamed from
   `resetBase`); `isDev` moved above `toggleFromTrigger` (only change in use-popover-trigger.ts);
   `DEV_ARGUMENTS` map (`useSelectPartRef` index 2) in production-bundle.test.ts (mutating
   select-value's `isDev` to `true` fails it); one comment per focusable selector.
5. jsdom can observe Menu's pointer open cause: spy `focus()` reading `focusVisible` (as
   menu-context-trigger.test.tsx does) so `supportsFocusVisibleOption` is true; a pointer click then
   calls `focus({ focusVisible: false })` on the first item and writes no `autofocus`. Dropping
   `beforeOpen` in `usePopoverTrigger` fails the new test (1 of 375 menu jsdom tests).
6. #161: `isDev ? firstChildOfSelect : undefined` / `firstChildOfGroup`. Test follows Identifiers in
   dev arguments to same-file top-level function / const declarations and to functions at any depth
   (review minor 2; nested non-function variables gave 10 false positives, so they are left out;
   two planted local-closure leaks were reported, then removed), and asserts both Select
   fragments are collected. Before the guard: 3 leaked pieces from the two files; no false positives
   anywhere else. Conventions 7.2 sentence added; CHANGELOG entry.

## Checks

typecheck, lint (3 warnings, same count with master's combobox-root), format:check, test:jsdom
(ui 81 files / 3904, docs 14), build: green. Chromium browser: select, combobox, toast, menu,
menu-context-trigger: 5 files, 185 passed, 3 skipped.
