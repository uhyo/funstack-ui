# Wave 16 source cleanup, phase 1 (#102, tracker #100)

Branch `wave16/source-cleanup`. Mechanical findings of `memo/reviewer/refactor-audit-overlays.md`
and `refactor-audit-controls.md`; structural ones (O1-O7, O10, O19, C1, C2, C5, C6, C9, C11-C13)
are phase 2.

## Done (one commit each)

- O17 + C10 dead code; O18 + C16 types; O8 `internal/popover-open.ts`; O11 `useLatest`;
  O12 `notifyClosed: requestClose`; O13 `internal/menu-point.ts` + `internal/shipped-styles.ts`;
  O14 `internal/use-merged-refs.ts`; O15 + C4 `internal/use-element-check.ts`;
  O9 `internal/use-name-warning.ts`; C3 `internal/value-set.ts` + `internal/dom-order.ts`;
  C7 + C8 `internal/arrow-keys.ts` + `internal/use-native-focusgroup.ts`; C14 (breaking);
  an import-order commit; O16 + C15 comments.
- Non-test lines in `packages/ui/src`: 26859 before, 26706 after.

## Decisions worth remembering

- `useElementCheck(message, deps?)` returns a function that is both a callback ref and a
  `check?.(el)` call for parts whose own ref does more; `undefined` in production. Once per
  instance. It reads `message` through `useLatest`, so `deps` only matter when it is used as a
  ref (re-creates the callback, which re-runs the check, as the old `useCallback` refs did).
- Name checks: two hooks, because the popups check "while shown" in an effect (ids must resolve
  to a mounted Title) and the parts check a microtask after attach (attribute presence).
  Dialog.Popup now warns once (dialog.md 9 says once per instance).
- `useMergedRefs` drops `undefined` and passes a single ref through: Slider.Thumb's and
  NumberField's hidden input may now receive the object ref directly. Same effect.
- `isPopoverOpen` everywhere uses the try/catch form; only differs where `:popover-open` throws.
- O13 required touching three test files' import lines (the constants moved module); C10 removed
  the `decimalsOf` re-export and its duplicate assertions in `slider.test.tsx`.
- Kept issue numbers: #44, #89, #92 (open upstream, human tasks). All closed ones dropped.

## Deferred

- O18's `createActionDetails(...) as unknown as Details` double cast in `use-popover-root.ts`:
  the audit ties it to O1's details builder (phase 2).
- Pattern 3 of O16 (trimming long design-restating blocks) only partly: `useLatest`,
  `useNativeChecked`, `useFormReset`, the apply-effect paragraph and Menu.Popup's owned keys.
  `use-resolved-placement.ts`, the Menu.ContextTrigger gesture docs and the Toast.Viewport header
  stay as they are; pre-existing over-long comment lines in files the audits did not list stay.
- The duplicated "Item order in state" effect (C3 optional follow-up): not done.
- WebKit was not installed locally; CI covers it.
