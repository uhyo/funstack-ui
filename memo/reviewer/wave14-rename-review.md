# Review: #96 urgent handler rename (branch wave14-rename, commit b58249a)

Verdict: **acceptable with minor fixes**. The rename is complete and behaviour is unchanged; the
guard catches real violations. One gap in the completeness check (M1) should be fixed before merge.

Method: a scratch copy of the worktree (deleted afterwards; the worktree was never modified),
`tsc --noEmit` on packages/ui after each planted mutation, jsdom tests for combobox, types, field,
form, toast and action-naming (297 pass), `tsc` on packages/example (clean).

## Rename

- No `inputValueChangeAction` / `UrgentChangeAction` left in packages/ui, packages/example or
  docs examples except the intentional negative tests (`combobox.test.tsx:2393`,
  `internal/types.test.ts:4,48`) and the guard self-test.
- `index.ts` exports `UrgentChangeHandler`, no alias. The `@funstack/ui/combobox` subpath never
  exported the type, before or after (consistent).
- `combobox-root.tsx`: only the prop name, local variable name and dev-warning text change; logic is
  identical. The warning test now matches the new prop name.

## Mutation results (planted in the scratch copy, tsc)

| Mutation | Caught |
| --- | --- |
| `fooAction?: (n) => void` on Toggle | yes |
| `fooAction?: string` | yes |
| `fooAction?: UrgentChangeHandler<boolean>` | yes |
| `fooAction?: (n) => Promise<void>` | yes (stricter than needed; acceptable: forces the `Action` type) |
| `fooAction?: ChangeAction<boolean> \| ((n) => void)` | **no** (union return collapses to `unknown`) |
| `onFoo?` / `onPressedChange?` on Toggle | yes |
| `onInputValueChange` renamed back to `inputValueChangeAction` | yes (three errors) |
| new `NewWidgetProps` exported from index.ts, not listed | yes (runtime set check) |
| same, added to `listed` but **not** to `PublicProps` | **no** (see M1) |
| `onClose` / `onChange` / `onToggle` / `formAction: () => void` on DOM-less `DialogRootProps` | **no** (see L1) |

## Findings

### M1. Completeness is one-directional: a type in `listed` but missing from `PublicProps` is never checked
`packages/ui/src/__tests__/action-naming.test.ts:322` asserts
`Exclude<keyof PublicProps, listed[number]>` is `never` (PublicProps is a subset of listed) and
the runtime check ties listed to index.ts. Nothing asserts listed is a subset of PublicProps.
Verified: exporting `NewWidgetProps` and appending it only to `listed` passes tsc and the test, and
the new type's props are never guarded. Since the failure message tells the developer to "list" the
type, adding it to the obvious array only is the likely mistake. Fix: assert
`expectTypeOf<keyof PublicProps>().toEqualTypeOf<(typeof listed)[number]>()`, or derive `listed`
from an object `satisfies Record<keyof PublicProps, true>` (then `Object.keys`).

### L1. Pass-through exclusion is by name, globally, so it would hide a library-defined prop that reuses a DOM name
`DomPassThroughKeys` (`action-naming.test.ts:33`) is subtracted from every Props type, including
DOM-less ones (Dialog.Root, Combobox.Root, Menu.Root, ...). A future `onClose` / `onChange` /
`onToggle` / `formAction` declared by the library on a Root would pass (verified). **No current
prop is hidden**: probing every listed type, the only excluded keys outside `HTMLAttributes` are
`formAction` (button/input parts, React's own, including `Button`'s re-declared
`ComponentPropsWithRef<"button">["formAction"]`) and `onCancel` / `onClose` on Dialog.Popup and
Popover.Popup (both extend `ComponentPropsWithRef<"dialog">`). Optional hardening: exclude a key only
when its type equals React's DOM type for it (e.g. `P[K]` is assignable both ways with
`DOMAttributes<Element>[K]` etc.), or check DOM-less Roots with no exclusion at all. Low because it
is a future risk, not a present bug.

### L2. A union function type with a `void`-returning member passes
`FunctionPart<P[K]> extends (...) => infer R` infers the union of returns; `unknown | void` is
`unknown`. `ChangeAction<T> | ((n: T) => void)` would pass. Unlikely to be written; could be
tightened by distributing over the union (`FunctionPart<P[K]> extends infer F ? F extends ... : ...`
in a distributive helper). Note it in the comment if not fixed.

### L3. The guard is by return type, not behaviour
A `fooAction?: (x) => unknown` that the component calls synchronously outside a transition passes.
This is inherent to a type-level check and the design (conventions 10.1) accepts it; the behavioural
side is covered by the per-component pending/transition tests. No action; just do not overstate the
guard in docs.

### N1. The `Offenders` failure message does not name the key
A violation reports `action-naming.test.ts(307,31): error TS2554: Expected 1 arguments, but got 0.`
without the offending key (the `OwnHandlers` failure does name it). Optional: map to
`{ [K in keyof PublicProps]: [K, NonTransitionActionKeys<...>] }` or assert per type so the error
shows the type and key.

### N2. Scope is `*Props` only
Exported non-Props types with callbacks (`ToastOptions.closeAction`, `ToastActionOptions.action`)
are not guarded. They conform today (`Action<...>`); `ToastOptions.action` is an options object, so
naive inclusion would flag it. Fine as designed (the design scopes the guard to Props); worth a
one-line note in the test comment.

### N3. Type-level assertions run only under `tsc`
vitest's `typecheck.enabled` only picks up `*.test-d.ts`, so the three `expectTypeOf` tests pass at
runtime regardless; the guard is enforced by `pnpm typecheck` (required before commit and in CI).
Same pattern as `internal/types.test.ts`; acceptable, but the file header could say so.

## Deviations memo (memo/developer/action-naming-96.md)
All four deviations are justified: `formAction` and the `<dialog>` handlers are real pass-throughs
(verified above); `Extract<..., fn>` is the right handling of `Form.Root`'s `string | fn` `action`;
the self-test is a good addition. The `@ts-expect-error` import plus `toBeAny()` in
`internal/types.test.ts` works (re-adding an alias trips the unused directive).

## Addendum: after rebase (rename now 2f6db8a, `git range-diff` identical to b58249a) and docs commit ec6cb1e

Verdict for ec6cb1e: **acceptable**, one nit.

- Names: no `inputValueChangeAction` / `UrgentChangeAction` left in packages/docs/src except the
  Roadmap Breaking entry, where they are the old names on purpose. ActionProps, Combobox
  (prose, sample, Callout, props table, platform note, optimistic summary) and Roadmap all use
  `onInputValueChange` / `UrgentChangeHandler`; the props-table type matches the declaration.
- Anchors: `<h3 id="urgent-lane">` at ActionPropsPage.tsx:308; the intro links `#urgent-lane`;
  ComboboxPage links `/concepts/action-props#urgent-lane` three times; the route
  `/concepts/action-props` exists (App.tsx:105). The id is unique on the page (the other is
  `overlapping-actions`).
- Rule wording vs vision principle 3: it matches. Both say `fooAction` always means a handler run in
  a transition, the exception is forced by controlled text input, it is named like the plain handler
  it is, and it is the only `on*` prop. The page says "x / defaultX pair" where the old text said
  "triple", which agrees with conventions row 11.
- Roadmap: the Breaking entry follows the `Toolbar.Button` precedent (RoadmapPage.tsx:137) under
  Done, with the #96 link.
- Nit (optional): ActionPropsPage.tsx ~324, "Nothing else in the library is an `on*` prop", next to
  "What about native handlers?", which says DOM `on*` props pass through to parts. Vision says
  "the only `on*` prop form the library **defines**". "Nothing else the library defines is an `on*`
  prop" would make the two sections agree.
