# #157, last step: reorganising `packages/ui/src/internal/` (plan)

Planning only; no file was moved on master. Written against master 4e3e644. The developer
does the move after #159 (`fix/159-remount-mid-close`) is merged.

## Recommendation in short

Do a **light** reorganisation: three subfolders, `internal/overlay/`, `internal/form/` and
`internal/action/`, and leave everything else flat. Do not build the full taxonomy (`render/`,
`dev/`, `focus/`, `group/`).

- It moves 60 of the 106 files (41 modules, 19 tests) and leaves 46 flat (34 modules, 12
  tests).
- It is fully scripted and was rehearsed in a scratch worktree: three commits, 141 files
  touched, about 320 changed lines, every one an import specifier or a path in a comment / doc.
  Typecheck, lint (with `check-design-refs`), format, build and the jsdom projects (81 files,
  3,907 tests) passed; the browser projects were not run.
- Consumer-visible output did not change: the 25 entry bundles are byte-identical before and
  after.

The pay-off is real but modest (see "Benefit vs cost"). If the user would rather not touch 141
files for it, the fallback is to regroup the file index in `design/internal-hooks.md` under the
same three headings and move nothing.

## What is there now

106 files: 75 modules and 31 test files, flat. Measured on master:

- 627 import lines in 142 files outside `internal/` point into it; 179 import lines are between
  files of `internal/`; 45 go from `internal/` out (`../__tests__/helpers.js`, component
  indexes in tests).
- Three clusters are tight, by imports and by who uses them:
  - **overlay** (19 modules): the open-state and popup machinery of Popover, Menu, Combobox,
    Dialog, plus placement (Tooltip too) and the modal registry (Toast reads it). This is where
    #147 to #159 all landed.
  - **form** (14 modules): the native-input machinery of internal-hooks.md 3.8 and the Field
    helpers.
  - **action** (8 modules): `useControllableAction`, the pure triggers and the rejection /
    `on*` rules (conventions 2, internal-hooks.md 3.4).
- The other 34 modules are small and general (`types.ts`, `use-render.tsx`, `data-attr.ts`,
  `use-latest.ts`, the dev-warning hooks, the roving engine, set arithmetic). They have no
  clear boundaries between them.

The three clusters layer cleanly, which is the main structural argument for these three and no
others:

```
flat helpers  <-  action/  <-  form/
                           <-  overlay/
```

No flat module imports from a subfolder, `action/` imports only flat modules, `form/` and
`overlay/` import `action/` and flat modules and not each other. The plan keeps that true; it
is worth one sentence in conventions 9.1, not a lint rule.

## Grouping: every file and its destination

"Light" is the recommendation. "Full" is the larger variant, listed so the choice is visible;
it is not recommended. A test file moves with the module it is listed beside.

### `internal/action/` (8 modules, 5 tests)

| Module | Tests | Light | Full |
| --- | --- | --- | --- |
| `action-details.ts` | `action-details.test.ts` | `action/` | `action/` |
| `call-urgent-handler.ts` | `call-urgent-handler.test.ts` | `action/` | `action/` |
| `report-dropped.ts` | `report-dropped.test.ts` | `action/` | `action/` |
| `use-action-trigger.ts` | `use-action-trigger.test.tsx` | `action/` | `action/` |
| `use-connected.ts` | - | `action/` | `action/` |
| `use-controllable-action.ts` | `use-controllable-action.test.tsx` | `action/` | `action/` |
| `use-pure-trigger.ts` | - | `action/` | `action/` |
| `use-step-commit.ts` | - | `action/` | `action/` |

### `internal/form/` (14 modules, 4 tests)

| Module | Tests | Light | Full |
| --- | --- | --- | --- |
| `field-context.ts` | - | `form/` | `form/` |
| `focus-first-invalid.ts` | - | `form/` | `form/` |
| `form-status-watcher.tsx` | - | `form/` | `form/` |
| `group-member.ts` | - | `form/` | `form/` |
| `sync-presence.ts` | - | `form/` | `form/` |
| `use-checkable-input.ts` | - | `form/` | `form/` |
| `use-field-control.ts` | `use-field-control.test.tsx` | `form/` | `form/` |
| `use-fieldset-group.ts` | - | `form/` | `form/` |
| `use-form-owner-event.ts` | - | `form/` | `form/` |
| `use-form-reset.ts` | `use-form-reset.test.tsx` | `form/` | `form/` |
| `use-native-checked.ts` | `use-native-checked.test.tsx` | `form/` | `form/` |
| `use-native-group-reconciliation.ts` | `use-native-group-reconciliation.test.tsx` | `form/` | `form/` |
| `use-native-select-value.ts` | - | `form/` | `form/` |
| `validity.ts` | - | `form/` | `form/` |

Name: `internal/form/` sits beside the Form component's `src/form/`. Imports stay readable
(`../internal/form/use-form-reset.js` vs `../form/index.js`), so I kept the short name. The
alternative is `internal/native-form/`.

### `internal/overlay/` (19 modules, 10 tests)

| Module | Tests | Light | Full |
| --- | --- | --- | --- |
| `anchor-position.ts` | `anchor-position.test.ts` | `overlay/` | `overlay/` |
| `content-focus-probe.tsx` | - | `overlay/` | `overlay/` |
| `css-transition-cut.ts` | `css-transition-cut.test.ts`, `css-transition-cut.browser.test.tsx`, `css-transition-cut-cssom.browser.test.ts` | `overlay/` | `overlay/` |
| `focus-visible.ts` | - | `overlay/` | `overlay/` |
| `invokers.ts` | `invokers.test.ts` | `overlay/` | `overlay/` |
| `modal-registry.ts` | - | `overlay/` | `overlay/` |
| `overlay-popup.tsx` | - | `overlay/` | `overlay/` |
| `overlay-show.ts` | `overlay-show.test.ts` | `overlay/` | `overlay/` |
| `popover-open.ts` | - | `overlay/` | `overlay/` |
| `trigger-ref.ts` | `trigger-ref.test.tsx` | `overlay/` | `overlay/` |
| `use-apply-open-state.ts` | - | `overlay/` | `overlay/` |
| `use-exit-animation.ts` | - | `overlay/` | `overlay/` |
| `use-interest-dismiss.ts` | - | `overlay/` | `overlay/` |
| `use-modal-registration.ts` | - | `overlay/` | `overlay/` |
| `use-overlay-close.ts` | - | `overlay/` | `overlay/` |
| `use-overlay-root.ts` | - | `overlay/` | `overlay/` |
| `use-popover-popup.ts` | `use-popover-hooks.test.tsx` | `overlay/` | `overlay/` |
| `use-popover-trigger.ts` | `use-popover-trigger.test.ts` | `overlay/` | `overlay/` |
| `use-resolved-placement.ts` | `use-resolved-placement.test.tsx` | `overlay/` | `overlay/` |

Placement (`anchor-position.ts`, `use-resolved-placement.ts`) goes here and gets no folder of
its own: two modules, used only by overlays.

### Stay flat (34 modules, 12 tests)

| Module | Tests | Light | Full |
| --- | --- | --- | --- |
| `announce.ts` | - | flat | flat |
| `arrow-keys.ts` | `arrow-keys.test.ts` | flat | `group/` |
| `csp-context.ts` | - | flat | `render/` |
| `data-attr.ts` | - | flat | `render/` |
| `decimal.ts` | - | flat | flat |
| `dev-warn.ts` | - | flat | `dev/` |
| `dom-order.ts` | `dom-order.test.ts` | flat | `group/` |
| `merge-props.ts` | `merge-props.test.ts` | flat | `render/` |
| `platform-attributes.ts` | - | flat | `render/` |
| `pointer-capture.ts` | - | flat | flat |
| `range-value.ts` | `range-value.test.ts` | flat | flat |
| `render-element.ts` | `render-element.test.tsx` | flat | `render/` |
| `shipped-styles.ts` | - | flat | `render/` |
| `toolbar-context.ts` | - | flat | `group/` |
| `tooltip-warm.ts` | - | flat | flat |
| `transition-boundary.tsx` | `transition-boundary.test.tsx`, `transition-boundary.browser.test.tsx` | flat | `render/` |
| `transition-types.ts` | - | flat | `action/` |
| `types.ts` | `types.test.ts` | flat | flat |
| `use-delayed-pair.ts` | - | flat | flat |
| `use-dev-warning.ts` | - | flat | `dev/` |
| `use-element-check.ts` | - | flat | `dev/` |
| `use-hydrated-mount.ts` | - | flat | flat |
| `use-item-order.ts` | - | flat | `group/` |
| `use-latest.ts` | - | flat | flat |
| `use-merged-refs.ts` | - | flat | `render/` |
| `use-mount-fixed.ts` | `use-mount-fixed.test.tsx` | flat | `dev/` |
| `use-name-warning.ts` | - | flat | `dev/` |
| `use-native-focusgroup.ts` | - | flat | `group/` |
| `use-register-count.ts` | `use-register-count.test.tsx` | flat | `group/` |
| `use-render.tsx` | - | flat | `render/` |
| `use-roving-focus.ts` | `use-roving-focus.test.tsx` | flat | `group/` |
| `use-until-found.ts` | - | flat | flat |
| `use-value-set.ts` | - | flat | `group/` |
| `value-set.ts` | - | flat | `group/` |

Plus `context-stability.test.tsx`, which tests seven components' contexts and belongs to no
module: flat in both variants.

### Why not the full variant

- It rewrites about 850 specifiers instead of about 250, most of them for `types.ts` (100+ importing
  files) and `use-render.tsx` (about 130), and makes the two most common imports longer for no
  gain in findability.
- The boundaries are arguable file by file: `transition-types.ts` (action or render?),
  `use-mount-fixed.ts` (a real hook that also warns), `toolbar-context.ts` (group or render?).
  Every new helper would then need a folder decision.
- Ten modules fit nowhere and would stay flat or end up in a `util/` drawer.
- A `focus/` folder would cut across the real clusters: `focus-visible.ts` and
  `content-focus-probe.tsx` belong to the overlays, `focus-first-invalid.ts` to Field, the
  roving engine to the groups.

### Optional, by hand: modules with one consumer

Conventions 9.1 already says a helper that one component uses lives in that component's
folder. Two flat modules break it: `tooltip-warm.ts` (Tooltip; `csp/csp.test.tsx` imports it
too) and `use-until-found.ts` (Tabs.Panel). Moving them to `tooltip/` and `tabs/` is a small
separate commit, not part of the script. Two things to know: their `directives.test.ts` entries
change folder, and in a component folder a "design N" comment is checked against that
component's document (`check-design-refs.mjs`, `ownDocuments`). I would leave
`use-native-select-value.ts` in `form/`: it is one of the 3.8 hooks and is documented with
them. Low value; skip it if in doubt.

## Constraints, and what each needs

| Constraint | Finding |
| --- | --- |
| `__tests__/directives.test.ts` | Lists 43 `internal/*.mjs` paths; 29 change (`internal/overlay/use-overlay-root.mjs`, ...). The script rewrites them. tsdown's `unbundle` mirrors the source tree, so `dist/internal/<folder>/` appears and the directive follows the file. The "directive-free Roots" graph walk resolves relative specifiers and needs nothing. |
| `__tests__/production-bundle.test.ts` | No change. `sourceFiles` recurses (skipping only `__tests__`), and the callees are collected by name (`DEV_CALLEES`, `DEV_ARGUMENTS`), not by path. Passed in the rehearsal. |
| `tsdown.config.ts` | No change: no entry is in `internal/`, and the generated `exports` map does not name it. The `dist` layout under `dist/internal/` changes, which is not public. |
| `src/__tests__/isolated-files.ts` | No change: `src/**/*-transition-types.test.tsx` and `src/csp/csp.test.tsx` match no moved file, and `isolation.test.ts` walks recursively. No moved test mocks a module. |
| `vitest.config.ts`, `tsconfig.json` | No change (`src/**` globs). |
| `scripts/check-design-refs.mjs` | The script itself needs no change. Check 1 fails on any code span naming an old path, so the codemod rewrites the spans that name a moved file (40 lines in 12 documents, out of 65 `internal/` path spans in 21 documents, CHANGELOG excluded); bare file names keep resolving. Check 2 is unaffected: the folder it keys on is still `internal`, so "design N" there stays unchecked. |
| `design/internal-hooks.md` file index | A fenced tree of bare names, which no check reads. Regroup it **by hand** under `action/`, `form/`, `overlay/` and the flat rest. Also by hand: two glob mentions the checker skips (`design/components/popover.md` line 5, `src/internal/use-popover-*.ts`; `design/components/checkbox-group.md` line 18, `internal/use-native-*.ts`), and one sentence on the layering in conventions 9.1. |
| Relative `.js` specifiers | About 250 change (240 in one run, 249 over the three per-folder runs): `../internal/x.js` gains a folder, a moved file's `./x.js` becomes `../x.js` for a flat neighbour, and a moved test's `../__tests__/helpers.js` becomes `../../__tests__/helpers.js`. The script recomputes each from the old and new place of both ends, including side-effect imports and `vi.mock`. `tsc` (`nodenext`) catches any miss. |
| Not rewritten, on purpose | `design/CHANGELOG.md`, `memo/`, `docs/research/` (7 mentions): history, and no check reads them. |

## Mechanics

Tools, both in `memo/architect/probes-157/`:

- `reorg-internal.mjs`: the codemod. Dry run by default; `--only <folder>` and `--write`. It
  moves with `git mv`, recomputes specifiers, and rewrites path mentions in the source, in
  `directives.test.ts` and in `design/`. The mapping at its top is the table above.
- `build-digest.mjs`: prints a digest of the build that does not depend on where an internal
  file lives.

Steps:

1. Wait for #159 to be merged; it edits `overlay-show.ts`, its test and `use-popover-popup.ts`.
   Check that no other branch with source changes is open: this conflicts with all of them.
2. Work in a worktree on a branch (`refactor/157-internal-reorg`), so the shared index of the
   main checkout never holds staged renames.
3. Baseline: `pnpm build`, then
   `node memo/architect/probes-157/build-digest.mjs > before.txt`.
4. One commit per folder, in any order (the script gives the same tree either way):
   ```
   node memo/architect/probes-157/reorg-internal.mjs --only overlay --write
   pnpm format            # four imports get re-wrapped over the three runs; nothing is reordered
   pnpm typecheck && pnpm lint
   git add packages/ui/src design
   git commit -m "refactor(ui): move the overlay helpers to internal/overlay (#157)"
   ```
   then `form`, then `action`. Each commit passes the checks on its own, because the paths in
   `directives.test.ts` and `design/` change in the same commit as the files.
5. A fourth commit for the hand edits: the index in `design/internal-hooks.md`, the two glob
   mentions, the 9.1 sentence. Optionally a fifth for the one-consumer modules.
6. Merge fast-forward (no squash), so the per-folder commits survive.

Blame stays readable: git detected all 60 moves as renames, at 92 percent similarity or more,
because only import lines change. `git blame` and `git log --follow` carry on through them.

### Verifying that nothing changed

1. `pnpm build`, `node memo/architect/probes-157/build-digest.mjs > after.txt`,
   `diff before.txt after.txt` must print nothing. The digest has two parts:
   - **Bundle size and content.** Each of the 25 entries bundled as a consumer would (rolldown,
     `NODE_ENV=production`, minified, React external): bytes, gzip bytes, hash. In the
     rehearsal all 25 were byte-identical (root entry 193,531 bytes, 59,789 gzipped).
   - **`dist` equivalence.** Every emitted `.mjs` / `.d.mts`, keyed by its path without the
     subfolder, hashed after relative specifiers are reduced to base names, with its
     `"use client"` status. In the rehearsal all 398 files matched. Raw `dist` size grows by
     1,351 bytes (0.13 percent), which is only the longer specifiers; the script prints it on
     stderr.
2. All of `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:run`, `pnpm build`.
   The browser projects on all three engines are the part I did not run.
3. `pnpm --filter @funstack/ui pack:check` after a docs build: the same number of files in the
   tarball as before.
4. `git diff --stat -M master` shows renames and one-line import edits only; `git diff -M
   master -- packages/ui/src | grep '^[+-]' | grep -v 'import\|from\|^[+-]\{3\}'` should leave
   only comments and the `directives.test.ts` strings.

## Benefit vs cost

Benefit:

- The overlay machinery, the area with the most subtle rules and the most recent bugs, becomes
  one folder of 29 files instead of being spread through 106. The same for the 3.8 machinery.
- The folders match how the design is already written: conventions 2 and internal-hooks.md 3.4
  (`action/`), internal-hooks.md 3.8 (`form/`), conventions 3.9 and `design/placement.md`
  (`overlay/`).
- The layering becomes visible in the paths.

Cost:

- One mechanical change over 141 files. It conflicts with any open source branch, so it needs
  a quiet moment. It is scripted and verified, so the risk to behaviour is close to none.
- Old paths in `design/CHANGELOG.md`, the memos and the research notes go stale. They are
  history, but a reader following one has to look one level deeper.
- A small standing cost: a new helper needs a "which folder, or flat" decision. Three folders
  with clear subjects keep that cheap. The rule: it goes in a folder only if it is about that
  subject; otherwise flat.

Judgement: it pays off, modestly. It does not change what anyone has to understand; it makes
the two hard areas easier to find and to review in isolation. The full taxonomy does not pay
off: three times the churn, for folders whose contents are arguable.

Lighter alternatives, in order:

1. Only `overlay/` (29 files, one commit). Gets the largest single benefit.
2. No move at all: regroup the index in `design/internal-hooks.md` under the three headings.
   Costs nothing, helps a reader of the docs, does nothing for someone browsing the folder.

## For the product owner to decide or escalate

- Light reorganisation (recommended), `overlay/` only, or index only.
- The name `internal/form/` versus `internal/native-form/`.
- Whether to also move `tooltip-warm.ts` and `use-until-found.ts` next to their one consumer.
