# Working notes: Select + Combobox research (2026-10-17, wave 4)

Sources that answered things fastest:
- BCD 8.1.6: `css.properties.appearance.base-select.{single_dropdown,listbox,multiple_dropdown}`,
  `html.elements.selectedcontent`, `css.selectors.{picker,picker-icon,checkmark,open}`.
  BCD `:open` Firefox 136 is not about select; Firefox select `:open` is bug 2048183 (154).
- Chromium flags on main: `CustomizableCombobox`, `CustomizableSelectMultiplePopup`,
  `CustomizableSelectNewUAStyles`, `SelectedcontentelementAttribute`, `SelectedcontentMultiple`,
  `AppearanceBase` all experimental; `SelectedcontentSpec2`, `BaseAppearanceInlineSizing` stable.
  Shipped customizable-select flags have been removed from the file (so absence = shipped).
- Firefox meta 1944403 (29/68 deps open); 2069977 "enable in Nightly" NEW; a11y 2041789 in review.
- wpt.fyi POST /api/search with run_ids + `exists: [{pattern}]` gives per-test pass counts fast.
- React repo is `react/react` on GitHub now; REST search works without gh auth.

Things found that other roles should know:
- React 19.3.1: SSR'd `<selectedcontent>` -> recoverable hydration error + full client re-render in
  Chromium (parser clones before hydration). Clean workaround:
  `<selectedcontent suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "" }} />`.
- React 19.3.1: options revealed by Suspense inside `<select value>` are not re-synced; first option
  wins. Needs a library re-apply (layout effect in Select.Option).
- Remember React's Suspense reveal throttle (~300 ms) when probing: my first run waited 80 ms and
  saw the fallback still mounted.
- Transition-only controlled select reverts DOM (and selectedcontent) until commit; optimistic fixes.
- `<selectedcontent>` does not follow option subtree mutations (spec); `select.value = select.value`
  refreshes in Chromium 156.
- Chromium base-select moves DOM focus to the option while open (select blurs). Firefox pref keeps
  focus on select and uses the native keyboard model; Tab leaves the picker open there.
- Chromium `<button>` in select: `.type === "submit"` (spec says "button"); no submission though.
- Select picker = nested auto popover (invoker = select): fine inside Popover/Dialog; closes an
  unrelated open auto popover.
- Combobox: clicking the `source` input does not light-dismiss; option click steals focus unless
  pointerdown is prevented; Escape keydown preventDefault keeps the popover open (both engines).

Re-check later:
- Firefox shipping of customizable select (2069977); Mozilla `selectedcontent` neutral (#1142).
- iOS presentation of base-select picker (no docs; device check).
- Safari 27.0 WPT failures for picker animations / `@starting-style`.
- WebKit 302008 for selects/comboboxes inside popovers.
- Open UI combobox explainer (2026-08-12) and `CustomizableCombobox`.
