# #157 internal/ reorganisation (light variant) — developer notes

Branch `refactor/157-internal-reorg`, from master c4b3b6e. Plan:
`memo/architect/157-internal-reorg.md`. Not merged (merge fast-forward, no squash, so the
per-folder commits survive).

## Commits

1. `refactor(ui): move the overlay helpers to internal/overlay` — codemod `--only overlay`
   (29 files moved, 97 specifiers, 36 path mentions).
2. `refactor(ui): move the native-form helpers to internal/form` — `--only form` (18 files,
   92 specifiers, 16 mentions).
3. `refactor(ui): move the action helpers to internal/action` — `--only action` (13 files,
   60 specifiers, 22 mentions).
4. `refactor(ui): move tooltip-warm and use-until-found to their one consumer` — by hand:
   `tooltip/tooltip-warm.ts`, `tabs/use-until-found.ts`; imports in tooltip-trigger,
   tooltip.test, csp.test, tabs-panel; directives.test.ts paths; placement.md span;
   accordion.md "shared `use-until-found.ts`" -> "`tabs/use-until-found.ts`"; the two index
   lines removed from internal-hooks.md.
5. `chore: check the layering of internal/ in pnpm lint` — `scripts/check-internal-layers.mjs`
   (179 imports in 104 files), appended to the root `lint` script. Negative probe (form/ ->
   overlay/, flat -> form/, unknown subfolder) fails as expected.
6. `docs: internal/ index grouped by folder, layering in conventions 9.1` — index regroup,
   popover.md line 5 and checkbox-group.md line 18 globs, 9.1 bullet, CHANGELOG entry.

Each commit: typecheck, lint, format:check, test:jsdom, build all exit 0 (run after each).
`pnpm format` re-wrapped a few imports after each codemod run, as the plan said.

## Verification

- Build digest (`memo/architect/probes-157/build-digest.mjs`): identical to master after
  commit 3. After commit 4 the 25 bundles are still byte-identical; the dist part differs only
  in the two relocated files' keys (`internal/tooltip-warm.mjs` -> `tooltip/tooltip-warm.mjs`,
  `internal/use-until-found.mjs` -> `tabs/use-until-found.mjs`), same hashes and directive
  status. Raw dist +1,351 bytes after commit 3 (as in the rehearsal), +1,326 after commit 4.
- Renames: 62 of 62 detected (`git diff -M --name-status c4b3b6e`), similarity 92 to 100
  (31 at R100). `git log --follow` crosses the move.
- Remaining non-import diff lines in packages/ui/src: path comments, directives.test.ts
  strings, and import re-wraps from oxfmt.
- jsdom: 81 files, 3,924 tests passed. Browser (chromium, firefox): 54 files, 1,049 passed,
  39 skipped, same as master before the move.
- `pack:check`: OK (820 files, 37 Markdown docs).

## Left alone

- CLAUDE.md's `pnpm lint` line does not mention the new script (not mine to edit without a
  user request); worth adding.
- CHANGELOG entries, memos, docs/research keep old paths (PO decision).
- Other single-consumer candidates not moved.
