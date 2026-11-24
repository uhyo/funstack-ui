# Review: refactor/157-helpers-followup (#157 follow-ups, #161)

Branch `origin/refactor/157-helpers-followup` at ce06e91, 8 commits on f0a7fac. Reviewed 2026-11-24.

**Verdict: needs one fix before merge (finding 1).** It is a regression in a development warning
only, so production behaviour is unaffected, and the fix is small. Everything else is mergeable.

## Verification

- Scratch worktree at ce06e91. jsdom (toast, menu, select, dialog, form, combobox, number-field,
  internal, tooltip, production-bundle): 48 files / 2017 tests pass. Chromium browser (select, toast,
  menu, combobox, dialog): 6 files, 241 passed, 3 skipped. `tsc --noEmit` is clean. oxlint shows
  only the existing ref warnings.
- CHANGELOG: `git diff master...branch -- design/CHANGELOG.md` only adds lines (3 new entries
  appended; the earlier "left for the branch that splits it" text is kept and superseded in
  the new entry).
- Mutation: dropping `beforeOpen` in `usePopoverTrigger` (line 204) fails 1 of 375 menu jsdom
  tests (the new pointer-open test). Earlier this was pinned only in the browser project.
- #161 leak plants (each reverted):
  - P1: remove the `isDev ?` guard on `firstChildOfSelect` -> **caught** (2 pieces).
  - P2: a top-level `const` message passed unguarded through `useSelectPartRef` -> **caught**.
  - P5: a top-level function called inside `useDevWarning`'s args (`topMsg(x)`) -> **caught**.
  - P3: a message helper **imported from another file** and called in `useDevWarning`'s args ->
    **not caught**. The text is in the bundle (checked by dumping it).
  - P4: a **component-local closure** (`const localMsg = () => "..."`) called in
    `useDevWarning`'s args -> **not caught**. The text is in the bundle.
  - False positives: none today, because the test passes on the branch and a false positive
    would fail it. The name-following is by bare identifier (no scope analysis), so a shadowing
    local or a property key named like a top-level declaration can pull in that declaration's
    strings. A false positive of that kind fails loudly with the file name, which is the safe
    direction.

## Findings (by severity)

### Major

1. **False "another Toast.Viewport" warning on a remount.** `toast/toast-viewport.tsx:448-454`.
   `useDevWarning(rejected, ...)` keys off `rejected`, whose initial state is
   `isTaken(listener)` read during render (line 147). When a Viewport is replaced in one commit
   (a `key` change, or one moved between two parents of a layout), the new instance renders
   while the old one is still subscribed. So `rejected` starts `true`, and the warning effect
   fires in the same passive-effect pass. That happens before the subscription effect's
   `setRejected(false)` takes effect. On master the `console.error` sat inside the subscription
   effect's `unsubscribe === null` branch, so it fired only on a real rejection.
   Reproduced with two probe tests: `rerender` with a new `key`, and a swap between two `<div>`
   parents. Both warn once on the branch and zero times with master's viewport file. Why it
   matters: it is a false positive in a common pattern, and it tells the user they have two
   Viewports when they have one. Fix: drive the warning from the subscription result, not from
   the render-time guess. For example, keep a `duplicate` state set to `true` only in the
   effect's `null` branch, and pass that to `useDevWarning`. The new StrictMode count test still
   holds with that change. Add a keyed-remount no-warning test.

### Minor

2. **#161 collector scope.** `__tests__/production-bundle.test.ts` follows only *same-file
   top-level* declarations. Imported message helpers (P3) and component-local closures (P4)
   still leak silently. The issue's exact class is covered and conventions 7.2 describes the
   scope accurately, so this does not block. Cheap improvement: index every
   `VariableDeclarator`/`FunctionDeclaration` in the file, not only top-level ones; the name-only
   imprecision is already accepted. Cross-file following needs import resolution. It is worth a
   GitHub issue in this repo if message helpers are ever shared across files (none today).

### Nits

3. CHANGELOG (toast entry) and the developer notes say `byDocumentPosition` and
   `compareDocumentOrder` "differ only for unrelated nodes". Per the DOM spec,
   `compareDocumentPosition` on disconnected nodes still sets PRECEDING or FOLLOWING, so for
   distinct nodes the two never differ (same nodes: both 0). The replacement is exactly
   equivalent. My earlier review made the same loose claim about Combobox.
4. `combobox-root.tsx:278`: `required: false` is a placeholder argument to `resolveFieldDefaults`
   whose result is discarded. It is harmless and equivalent: `field.disabled` is `boolean`, so
   `own || field.disabled` equals the old `|| (field?.disabled ?? false)`.

## Items checked

- Item 1: Combobox `name`/`disabled` are the same values. Toast sort order is identical (see 3).
  The Viewport warning still fires for a real duplicate (same-commit mount and later mount,
  including StrictMode once per instance), but see 1.
- Item 3: `warn` is required. All 16 production callers pass it with the public part name
  (`Checkbox`/`Switch` via `useCheckableInput`, overlay `part`, `*.Root`, `Menu.*`, `Toggle`).
  The message templates are unchanged except for the removed "A component" fallback. The new
  Dialog.Form text is accurate, and no stale copy of the old text remains in docs or tests. My
  own scan of `isDev &&` / `console.error|warn(` literals found no message that breaks the
  conventions 7.2 rule.
- Item 5: the Menu test asserts what the design (popover.md / menu.md 6.1) specifies as the
  behaviour: a pointer open does a quiet `focus({ focusVisible: false })` on the first item with
  no `autofocus` write, and a keyboard open does the `autofocus` write. The `focus` spy only makes
  jsdom read the option (the same technique as `menu-context-trigger.test.tsx`), and
  `vitest.setup.ts` resets the cached detection after each test. It is bound to the mechanism, but
  the mechanism is the documented contract, so this is acceptable.
- Item 4 nits (NumberField `resetTarget`, `isDev` move, selector comments, `DEV_ARGUMENTS`): fine.
