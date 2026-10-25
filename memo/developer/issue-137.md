# Issue #137: JSDoc coverage of the public API

Branch `docs/137-jsdoc` (not merged to master; the PO reviews it first).

## Measuring

Measured on the built `.d.mts` (what agents read), not on `src`: a script on the TypeScript 5
compiler API (the repo's TypeScript 7 has no stable JS API, so it was installed in a scratch
directory) loads `dist/index.d.mts` and every `dist/<component>/index.d.mts`, and counts:

- exports: every exported symbol of every entry point has a JSDoc comment;
- members: every property declared in `dist` (unique declarations, so a shared base interface
  counts once) of an exported interface or type alias, including the State and Details objects;
- component parts: the function behind each `X.Part` of a compound object (and each single
  component), with `@see https://ui.funstack.work/...`;
- `@defaultValue` tags.

| | before | after |
|---|---|---|
| exports | 79/273 (28.9%) | 273/273 |
| members | 534/955 (55.9%) | 955/955 |
| parts documented | 107/107 | 107/107 |
| parts with `@see` | 0/107 | 107/107 |
| `@defaultValue` tags | 0 (4 `@default`) | 164 |

## Conventions used

- `className` / `style` / `children` / `render`: the docs site's `functionProps` / `renderProp`
  wording; `render` names the default element from `ComponentPropsWithRef<"x">`.
- `Props of \`X.Part\`.` + `@see` on each Props interface; `State of \`X.Part\`, passed to the
  function forms of ...` on each State, listing only the props that actually take it.
- `@defaultValue \`literal\`` for literal defaults; prose after the tag for computed ones
  (`@defaultValue the Field's \`name\``). The old "Default `x`." sentence was removed when the tag
  replaced it, without re-wrapping the rest of the comment.
- `@see` URLs: `/components/<dir>`, except Form (`/components/field`), `Menu.ContextTrigger`
  (`/components/context-menu`) and CSPProvider (`/concepts/content-security-policy`).
- Left as prose: `transition` ("Default: no boundary", not a value), Slider `getAriaValueText`
  ("Default: none"), NumberField `format` ("`decimal` (default)"), Button `formAction`.

Most of the edit was a codemod (TS compiler API over `src`, with the docs pages' PropsTables as
the source of defaults) followed by hand edits; discriminated unions (ToggleGroup and Accordion
`exclusive`) needed hand fixes, as the codemod put the default on both variants.

## Docs vs code findings

Fixed on the branch at the PO's request:

- The root entry `@funstack/ui` did not export `MenuContextTriggerProps` /
  `MenuContextTriggerState` (`@funstack/ui/menu` did). Now exported; `MenuContextTriggerProps`
  is also registered in `src/__tests__/action-naming.test.ts`, which lists every root Props type.
- The docs shared one props table between `Select.GroupLabel` and `Select.Separator`, so the
  Separator appeared to take `children` (the row's note did say "Separator takes no children").
  Split into two tables; the Separator's has no `children` row.

Left as they are (PO decision):

- Native attributes with a library default (NumberField.Input `inputMode` / `autoComplete` /
  `autoCorrect` / `spellCheck`, NumberField step buttons' `aria-label`, Toast.Viewport
  `aria-label`, Progress.Value `aria-hidden`) have a default in the docs tables but no
  declaration of their own in the props interfaces, so they carry no `@defaultValue`; adding
  one would mean redeclaring the prop.
