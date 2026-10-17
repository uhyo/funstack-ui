# Slider probes (2026-10-17, wave 5)

Chromium 156.0.8078.4 and Firefox 157.0 (Playwright 1.64.1); jsdom + React 19.3.1 for the React
probes. WebKit cannot launch locally. Run each file with `node`.

- `range-platform.mjs` - native `<input type=range>`: keys (Arrow/Page/Home/End) in LTR, RTL,
  vertical writing modes, with `step=10`, with a datalist; event order for keys, track click and
  drag; vertical geometry; vendor pseudo-element and `appearance: base`/`::slider-*` detection,
  `<rangegroup>`, `step-up` command; FormData/reset; value sanitisation; Chromium AX tree.
- `valuetext-ax.cjs` - CDP's `valuetext` property does not reflect `aria-valuetext` (Chromium
  source does serialise `kAriaValueText`); ARIA `aria-valuemax`/`aria-valuenow` override the
  native values on a range input in Chromium.
- `orientation-ax.cjs` - Chromium ignores `aria-orientation` on a native range (orientation comes
  from `writing-mode`); dynamic native `min` is exposed as `valuemin`.
- `overlay-dual.mjs` - two overlaid native ranges with `pointer-events: none` on the input and
  `auto` on the thumb pseudo: both thumbs drag, track click does nothing; an `opacity: 0` range
  still takes pointer input and focus.
- `react-range.mjs` - controlled range: transition-only state snaps the DOM back for the whole
  pending action (also during a drag); `value={optimistic}` follows; a trailing native `change`
  with an unchanged value fires no React `onChange`.
- `react-range-reset.mjs` - `form.reset()` is a no-op on a React-controlled value input (React
  syncs the `value` attribute to the current value); an uncontrolled `defaultValue` input resets.
