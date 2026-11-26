# #169 small parts + #180 (developer notes)

Branch `feat/169-small-parts`, from `origin/design/169-small-parts` (d8853cba) + origin/master.

## Built

- `packages/ui/src/separator/` (`separator.tsx`, `index.ts`, jsdom + types tests). Directive-free,
  `renderElement` + `mergeRenderRef` like `Progress.Root`. Owned layer with
  `"aria-orientation": undefined` while decorative removes a render element's own (merge-props
  owned-layer rule).
- `field/field-control.tsx`: `use(FieldContext)` instead of `useFieldContext` (which throws).
  Outside: `libraryProps` undefined, own `id/name/disabled/required` moved into pass-through
  `props` (render element's own win). One `useRender` call either way (no conditional hook).
- #180 fixes: `slider-root.tsx` `beginGesture`, `number-field/use-step-button.ts`
  (`inheritsDisabled`).

## #180 probe (2026-11-26, Chromium + Firefox local; WebKit missing host libs locally)

- Slider in `<fieldset disabled>`: track click at 75% -> input value "75", dispatched. Reproduced.
- Plain `<button>` in `<fieldset disabled>`, Playwright click `{force:true}`: received
  `pointerdown`, `pointerup` only (no mousedown, no click) in both engines.
- NumberField Increment in disabled fieldset, forced click: value 5 -> 6. Reproduced (not in the
  design; same rule applies).
- Playwright `click` waits for "enabled" on a disabled button: tests need `{ force: true }`.
  The Slider track is a span, so no force there.
- WebKit pointer events on disabled buttons: not observed locally. The NumberField browser row
  does not assert the pointerdown count, only that nothing steps.

## Pointer surfaces checked (reading)

- Toast swipe: not implemented (toast.md 9.2).
- Combobox Trigger/Clear/Option, MultiSelect Option, hidden select: pointerdown only
  preventDefault; actions on click (withheld on disabled buttons).
- Option divs in an open popup when the fieldset becomes disabled later: would still take a
  click (div is never disabled). Not reproduced. Possible follow-up: Combobox/MultiSelect option
  click bails when the Input / Trigger matches `:disabled`.
- use-roving-focus pointerdown: moves tab stop only. Dialog.Trigger pointerdown: bookkeeping.
- Menu.ContextTrigger: a region, no native control.
- NumberField wheel: needs focus; a disabled input can't be focused.

## Design notes

- field-form 4.3 said "constant all-false state" outside a Field; implemented as written
  (state.disabled false even with `disabled` prop). Flagged in the report.
- Docs: Separator page under a new "Layout" sidebar group.
