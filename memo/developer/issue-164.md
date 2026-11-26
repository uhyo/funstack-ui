# Developer memo: Combobox `multiple` (#164), 2026-11-26

Branch `feat/164-combobox-multiple` (from `design/164-combobox-multiple`, merged with master).

## Shape of the code

- `combobox-root.tsx`: one Root. `useMountFixed(props.multiple)`; both selection hooks run on
  every render (single `useControllableAction<string | null>` and `useMultipleSelection`), the
  other mode's idle. Branches only in `accept` (acceptSingle / acceptMultiple), `clear`,
  `leave`, the form reset callback, and the hidden inputs. Context gained `multiple`, `values`,
  `isSelected`, `isPending`, `chips` (the chip half: registry, keys, focus, removal).
- `use-multiple-selection.ts`: patch reducer (applyPatch: delete removed, append added; a JS Set
  keeps insertion order = pick order), `change` (filters no-op parts, `removed` in value
  order), `reset` (whole, diff vs intended, CheckboxGroup's #151 rule).
- `combobox-chips.tsx`: Chips / Chip / ChipRemove. Chip registers `{ element, label }` in a
  layout effect (for the keys and the announcement's label fallback).
- Keyboard: Input keys in `combobox-keyboard.ts` (`multiple` option), chip keys in the Root
  (`chipKeyDown`), both need the registry.
- Details key order matters for the value-action suite (`Object.keys` compared):
  `reason, added, removed, custom`.

## Gotchas hit

- `toBeRequired()` (jest-dom) is true for `aria-required="true"`: assert `input.required`.
- The production-bundle test extracts the static text of every dev warning; a helper that
  builds the message from the part name leaked "Combobox.ChipRemove" (also in the thrown
  error). Messages are inline literals now.
- oxlint `react/refs` flags `createComboboxKeyDown(...)` once functions reading `inputRef` are
  passed into it; disabled on that line with a comment (it only builds the handler).
- Browser rows: typing "ja" then ArrowDown+Enter at once can run Enter before the open commit
  (`:popover-open` false) → Enter-closed path clears the text and submits the form (the
  iframe navigated). Wait for the options before ArrowDown. Same accepted corollary as single
  mode (design 8).
- Chip labels: after a pick the text clears, the results for "" mount every option, so every
  selected value learns its label then (the chips show "France", not "fr").

## Verification (unverified points of the design entry)

- Printable key on a chip → Input: Chromium 156 + Firefox 157 OK locally (letter, Shift+letter,
  digit). WebKit: cannot launch locally (missing libsecret-1.so.0); CI dispatch on the branch.
- SR announcement of `aria-selected` toggles, chip position: manual NVDA / JAWS / VoiceOver
  pass needed (human). CDP: listbox `multiselectable: true`, option `selected` true/false,
  chips `list` named "Countries", items `listitem`, `focusable: true`, `level: 1`, no
  `posinset` / `setsize` in CDP.

## Not done / open

- Manual screen-reader pass (above).
