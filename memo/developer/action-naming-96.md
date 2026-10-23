# #96 urgent handler rename (wave 14, branch wave14-rename)

- `inputValueChangeAction` -> `onInputValueChange`, `UrgentChangeAction` -> `UrgentChangeHandler`. No alias.
- Guard: `packages/ui/src/__tests__/action-naming.test.ts` (conventions 10.1 "Action naming").
- Deviations from the design snippet (it did not compile to `never` as written):
  - `formAction` (from `ComponentPropsWithRef<"button" | "input">`, type `string | (formData) => void | Promise<void>`)
    is a DOM pass-through and would be an offender. Excluded together with React's other DOM keys.
  - `<dialog>`'s `onCancel` / `onClose` (Dialog.Popup, Popover.Popup pass-throughs) are not in
    `DOMAttributes<Element>`; they would land in the own-`on*` allow-list. Excluded through
    `DialogHTMLAttributes`.
  - `Form.Root`'s `action` is `string | ((formData) => unknown)`; `NonNullable<P[K]> extends fn` fails
    on the string member. The guard checks only the function part (`Extract<..., fn>`); a key with no
    function part at all is an offender.
  - Added a self-test of the helper types (a planted `inputValueChangeAction: UrgentChangeHandler` is caught).
- `combobox.test.tsx` has no top-of-file row list to rename to "Urgent handler" (the checklist assumed one);
  the describe is `renderBoth("urgent text")`, left as is.
- `UrgentChangeAction` alias guard: `// @ts-expect-error` import in `internal/types.test.ts` plus
  `expectTypeOf<UrgentChangeAction>().toBeAny()` so the import is used.
- Docs pages (ActionProps, Combobox, Roadmap, ServerComponents) deferred until `wave14-docs` merges; only
  `examples/ComboboxDrink.tsx` changed so docs typecheck/build.

## For the later docs step (PO, after wave14-docs merges)

- Action props page: the urgent-lane heading gets `id="urgent-lane"`; Combobox page links point at
  `/concepts/action-props#urgent-lane`.
- wave14-docs deletes the Action props naming table: keep the deletion when rebasing (do not re-add
  the Combobox row from the checklist).
- Done after rebasing onto a290d4a: ActionProps urgent-lane section (`id="urgent-lane"`, intro "with one
  exception, below"), Combobox prose/Callout/props row/platform list/behaviour row link, Roadmap entry +
  "Breaking" item. ServerComponentsPage no longer mentions the prop after wave14-docs: nothing to change.
