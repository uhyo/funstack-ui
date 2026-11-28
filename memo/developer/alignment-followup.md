# #199 follow-up: the four rules of 2026-11-28 (implementation)

Source of truth: design/CHANGELOG.md, "2026-11-28, #199 follow-up: four rules the reviews of #201
and #202 left open (design)", implementation checklist. User accepted rule B (1.5: an `on*` key
the part passes to its element in any mode is omitted in every mode) and the explicit separator
role.

## Breaking changes for the alpha.28 release notes

- Dialog, AlertDialog, Drawer: `onPointerDown` on the Trigger is a type error. Migration: a
  handler on the `render` element (runs first), or `ref` + `addEventListener`.
- Menu: `onPointerMove` on `Menu.Trigger` is a type error (the Menubar hover switch owns it).
  Migration: the `render` element's own `onPointerMove` (still runs, first).
- Menu: `role` on `Menu.Separator` is a type error; `Menu.Separator` renders
  `role="separator"` on its `<hr>`, and a `render` element's own `role` no longer wins.
  Migration: remove it; `render={<div />}` needs no role.
- Menu: `focusgroup` on `Menu.Popup` is a type error, and is removed at runtime without
  `experimental_focusGroup`. Migration: `experimental_focusGroup`.
- Form: `onClick` and `aria-disabled` on `Form.Submit` are type errors. Migration: the `render`
  element for a handler, `disabled` for disabling; the submitter's `name` / `value` in the
  `FormData` to tell buttons apart.
- Field: `onClick` on `Field.Label` is a type error. Migration: the `render` element.
- Separator: renders `role="separator"` when not `decorative` (`role="none"` when decorative,
  as before); a `render` element's own `role` no longer wins in either mode. Migration: remove
  the `role` from the `render` element.
- Tabs, Toolbar, ToggleGroup: `focusgroup` on `Tabs.List`, `Toolbar.Root`, `ToggleGroup.Root`
  and `focusgroupstart` on `Tabs.Tab`, `ToggleGroup.Item` are type errors, and are removed at
  runtime without `experimental_focusGroup` (ToggleGroup: also inside a Toolbar). Migration:
  `experimental_focusGroup`.

Not changed: `Toolbar.Separator` (already rendered its role), `Select.Separator` (plain `<hr>`,
no role: the `<select>` parser keeps only `<hr>`).

## Notes

- `mergeProps`: a key present with `undefined` in the owned (library) layer removes the
  consumer's value; that is how "owned as `undefined`" is implemented (`focusgroup: undefined`,
  `focusgroupstart: undefined`).
- Menubar tests that passed `onPointerMove` on `Menu.Trigger` now pass it on the `render`
  element.
- `focusgroup` / `focusgroupstart` are identifier keys (augmented in
  `internal/platform-attributes.ts`), so their type rows are JSX `@ts-expect-error` rows.
