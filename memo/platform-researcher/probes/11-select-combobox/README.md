# Select / Combobox probes (2026-10-17, wave 4)

Run the `.mjs` files from this directory with `node <probe>.mjs`. Chromium 156.0.8078.4 and
Firefox 157.0 (Playwright 1.64.1); `select-platform.mjs` also runs Firefox with
`dom.select.customizable_select.enabled` + `layout.css.appearance-base.enabled`. WebKit still cannot
launch locally. Each `*.output.txt` is the recorded output.

- `select-platform.mjs` - customizable select: feature detection, parsing (`<button>`, rich options,
  `<legend>`, `<hr>`), validity/FormData/reset, `<selectedcontent>` updates, keyboard (closed/open,
  typeahead, Space, Tab), mouse, select picker inside an auto popover and a modal dialog, `hidden`
  options, interactive content in the picker.
- `select-ax.mjs` - Chromium AX tree (CDP) for base-select closed/open, no-button base-select,
  listbox mode.
- `option-label-and-button-type.mjs` - option `label` attribute vs content in the AX tree; whether
  the select's `<button>` submits.
- `select-open-events.mjs` - no `toggle`/`beforetoggle` on select, `showPicker()` from a click, no
  `hidePicker`, blur does not close the picker.
- `combobox-platform.mjs` - `<input role=combobox>` + `popover=auto` listbox via
  `showPopover({ source })`: typing, geometry with `anchor-size()`, click on input/option, Escape
  (+ preventDefault), Tab, manual mode, inside dialog/popover, Chromium AX.
- `react-select.browser.test.tsx`, `react-select-2.browser.test.tsx` - React 19.3.1: controlled
  select under transitions (with/without `useOptimistic`), Suspense-loaded options, stale
  `<selectedcontent>`, SSR + hydration variants (real parser via iframe `srcdoc`). Copy into
  `packages/ui/src/__tests__/`, run `FUNSTACK_BROWSERS=chromium,firefox pnpm exec vitest run
  --project browser <file>` in `packages/ui`; results are written by `commands.writeFile` to
  `packages/ui/zz-out*-<browser>.txt` (move them here and delete the copies).
