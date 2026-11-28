# Review: dev/218 (part references only while mounted)

Reviewed `origin/dev/218` at 6b4fcd85 against conventions 1.1.1 and the #218 CHANGELOG entry.

**Verdict: acceptable with minor fixes** (all test or defensive-hardening items; no blocking defect).

Checks run: jsdom projects pass (only `directives.test.ts` fails, which needs `pnpm build`
in a fresh worktree); `tsc --noEmit` clean; `pnpm lint` clean. Probe tests (deleted afterwards):
Popover Title outside the Popup in library mode (referenced closed and open, no Description
token); Drawer and AlertDialog library mode with a Title (no false missing-name warning); Dialog
without a Title still warns exactly once; JS-free Dialog with a Title unmounted in the same task,
both by `flushSync` + `unmount` and by a default-lane `render(null)` (no false warning); nested
submenu Popup labelled by its own SubmenuTrigger, top Popup by its Trigger.

## Findings

1. **Low: the shown-name microtask does not check `isConnected`**
   (`packages/ui/src/internal/use-name-warning.ts:117-130`). The cancellation depends on the
   passive cleanup running before the microtask. That holds for a sync unmount (React flushes
   discrete passive effects synchronously) and a transition unmount lands in a later task. I
   could not produce a false positive. Still, `if (!target.isConnected) return;` costs nothing
   and removes the dependency on React's flush order. The cancel path also has no test.
2. **Low: `TITLE_CASES` mask the warning** (`packages/ui/src/__tests__/part-references.test.tsx:92-133`).
   Every case passes `aria-label="Fallback"`, so the "no warning" checks in the SSR and hydration
   rows cannot catch a missing-name false positive. That false positive is the bug the warning
   change fixes. Only the Dialog library row (`:253`) runs without an `aria-label`. Add
   library-mode rows with a Title and no `aria-label` for Drawer, AlertDialog and Popover.
3. **Low: missing rows.** There is no row for a Popover Title outside the Popup (popover.md
   says it counts; verified manually) and none for a Popover in library mode.
4. **Info: exceptions are justified.** Progress and Meter are Server Components. A combobox needs
   `aria-controls` under ARIA 1.2. For Tabs the APG references the panel. The NumberField target
   is always rendered.
5. **Info: the keepMounted gap is harmless.** The assumed token only dangles for a group without a
   GroupLabel, and only while it is hidden.
6. **Info: cost.** `parts`, and `triggerPresent` in the Menu value, change the Root context, so
   every part re-renders once when presence settles. This is the documented mount-time render.

Docs pages and the design docs match the code.
