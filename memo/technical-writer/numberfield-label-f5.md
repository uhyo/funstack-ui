# F5: NumberField label read twice (dogfood run 1, #211)

2026-11-28.

## Verdict: intended

- `design/components/number-field.md` section 1, "Why this shape", bullet "`Root` is a
  `div[role=group]`": the group is named by the Label so browse mode knows what "Increase" changes;
  the buttons keep the short names. "Cost: the label is read twice when the group is entered ...;
  accepted". Code matches (`number-field-root.tsx`, `role: "group"` + `aria-labelledby` from the
  Label or the Field's label id).
- Docs: documented on the NumberField page (Keyboard and ARIA > Accessibility, "The label names
  two elements", with the test query advice), linked from the "Inside a Field" recipe.

## For the PO / architect: the prior-art claim in the design does not hold

The design says "accepted, as React Aria does". Current sources (main branches, read 2026-11-28):

- React Aria `packages/react-aria/src/numberfield/useNumberField.ts`: `groupProps` is
  `{ ...focusWithinProps, role: 'group', 'aria-disabled', 'aria-invalid' }`, **no name**. The
  buttons are named instead: `aria-label: 'Increase'` + `aria-labelledby: '${incrementId} ${labelId}'`
  ("Increase Quantity"). RAC `Group.tsx` adds nothing from the label.
- Base UI `number-field/group/NumberFieldGroup.tsx`: `role: 'group'`, no name.
- Zag (Ark UI) `number-input.connect.ts` `getControlProps`: `role: "group"`, no name.

So none of the three name the group; FUNSTACK UI is alone in naming it. The choice may still be
right (the design's reason is the browse-mode context for short button names), but the cited
precedent is wrong, and the alternative React Aria uses (unnamed group, buttons named
"Increase <label>") avoids the double reading. Not checked: React Aria at exactly 3.53.

APG: the Spinbutton pattern has no group at all (the spinbutton itself carries the name).

Suggested issue: correct the rationale in `design/components/number-field.md` section 1, or
reconsider (unnamed group + concatenated button names). Docs need no change either way beyond
the page note.

## Found on the way (not F5): Combobox focus throws on the docs site

While checking the F13 example (Chromium and Firefox, `vite preview` of the docs build), every
focus of any `Combobox.Input` on /components/combobox throws
`TypeError: Cannot read properties of null (reading 'defaultView')`, unchanged examples included
(ComboboxDrink). Stack: `combobox-input.tsx` `onFocus` -> `ctx.focusIn(event.nativeEvent)` ->
`internal/use-deferred-leave.ts` `focusIn` -> `watchPresses(event.currentTarget)` ->
`element.ownerDocument.defaultView`. Likely cause: the native event's `currentTarget` is React's
root container, which is `document` on a FUNSTACK Static site (`document.ownerDocument` is null),
not the input. The examples still work (selection saved). Library bug; reported to the PO, no
code changed.
