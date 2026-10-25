# Review: #137 JSDoc for the public API (branch `docs/137-jsdoc`)

Reviewed at 2f5ee32 (5 docs(ui) commits + developer memo). Verdict: **acceptable with minor
fixes**. No blocking items.

## What was checked

- No code change: every non-comment line of `git diff origin/master...` under `packages/` was
  filtered out; none remain. `tsc --noEmit`, `oxlint`, `oxfmt --check` pass on the branch.
- Comments survive the build: `pnpm --filter @funstack/ui build` on the branch; `@defaultValue` /
  `@see` / member comments present in `dist/**/*.d.mts` (63 files carry `@defaultValue`).
- `@see` URLs: 24 distinct, all routes in `packages/docs/src/navigation.ts`
  (`/components/*`, `/components/context-menu`, `/concepts/content-security-policy`).
  Every public `*Props` interface has `@see` except `SliderLabelProps` (nit 3).
- Literal `@defaultValue`s compared with the destructuring defaults / `??` fallbacks in source
  (script): no mismatch; the undetected ones are `undefined`-is-false booleans or computed
  defaults, checked by hand (Popover/Tooltip align `center`, Menu align `start`, Menu
  loop/delay/closeDelay `true`/100/150, Tooltip 250/150/`"description"`, Toast duration 5000 and
  action => persistent in `toast-timers.ts`, NumberField step `0.01` for percent, ToggleGroup
  orientation/loop, Button type `"submit"` with `formAction`).
- State-member claims checked against derivations: Combobox Clear/Trigger (own || Root), Option
  (own only), Input/Label (Root || Field); Tabs.Tab (own || Root), Tabs.List (Root); Accordion
  Panel (Item || Root); ToggleGroup Item orientation (Toolbar's inside one); Slider/NumberField
  disabled and required (prop || Field via `resolveFieldDefaults` / `useFieldControl`); Meter
  min/max are the props (defaults 0/100), low/high/optimum resolved; `MeterRegion` matches the
  HTML meter algorithm; Toast priority resolved to `"normal"`, `data-type`; Tooltip Arrow align
  resolved/requested; FieldValidity.customError (Field writes `validate` and shown server
  errors via `setCustomValidity`).
- "passed to the function forms of ..." lists: checked for the input-based parts (Checkbox,
  Switch, RadioGroup.Item, CheckboxGroup Item/Parent, Combobox.Input, Toolbar.Separator: no
  `children`) and the Roots (children only); correct.
- "must not suspend" on Root `children` functions matches conventions (optimistic render rule).
- Comments are short; the shared className/style/children/render wording is uniform.

## Findings (all minor)

1. `field/field-control.tsx:31,37` `disabled` / `required`: `@defaultValue the Field's
   \`disabled\`` suggests an explicit `false` overrides the Field. `resolveFieldDefaults` ORs
   them (`own.disabled || field.disabled`), so the default is `false` and the Field's value
   always applies, as the prose says. Use `@defaultValue \`false\`` (as Slider / NumberField do).
   `name` (`own.name ?? field.name`) is correct.
2. `toast/toast.ts` `ToastOptions.title` / `description`: "named by `aria-labelledby` on the
   Root" reads backwards: the title names the Root (`Toast.Title`'s id is in the Root's
   `aria-labelledby`); the description describes it.
3. `slider/slider-label.tsx` `SliderLabelProps`: the only public Props interface without
   "Props of `Slider.Label`." and `@see`.
4. Cosmetic: the codemod left some short un-rewrapped lines where "Default ..." was removed
   (e.g. Checkbox/Switch `defaultChecked`, RadioGroup `defaultValue`), and a few state headers
   read "State of `A`, `B`, passed to ..." (no "and"). Not worth a pass on its own.

## Pending at review time

The developer announced two follow-ups (root entry exports `MenuContextTriggerProps` /
`MenuContextTriggerState`; Select docs table drops `Select.Separator` `children`). See the
addendum below for their status.

## Addendum: follow-ups (re-reviewed at 9ce77c8)

- d265aab: root entry exports `MenuContextTriggerProps` / `MenuContextTriggerState` (already
  exported by `menu/index.ts`); `action-naming.test.ts` lists the Props type. Test passes,
  `tsc` clean. This is the only API change on the branch, as intended.
- 3c058ee: Select page splits `Select.Separator` into its own table (`stylingProps` +
  `renderProp("hr")`, "Takes no children"); GroupLabel uses `renderProp("legend")`. Docs
  typecheck and format check pass.
- Findings 1-3 above: fixed in 2bdfedf (comment-only diff, re-reviewed): Field.Control
  `@defaultValue \`false\`` with the "explicit `false` does not override the Field" note; Toast
  title/description wording; `SliderLabelProps` "Props of" + `@see`. Final verdict at 2bdfedf:
  **acceptable**, no open items.
