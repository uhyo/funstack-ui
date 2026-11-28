# #201: consistency alignment, overlays and menus

Branch `feat/201-align-overlays`. Checklist: `design/CHANGELOG.md` "2026-11-28, #199", section
"#201, overlays and menus".

## The shared `transition` paragraph (fixed here; #200 copies it to the Combobox and MultiSelect Popups)

After each Popup's component-specific first paragraph:

```
   * Static: setting or unsetting it remounts the element. Any value, `"none"` included, makes a
   * mount or `<Activity>` reveal of the Popup inside a transition start a document view
   * transition (a ~250 ms page cross-fade that the next transition waits for); a plain open
   * starts none, as the content mounts under the already-mounted popup element. While a view
   * transition runs, the popup's CSS transitions are cut for the moment of the library's own
   * show or hide (an inline `transition: none !important`, restored right after), so only the
   * view transition animates it; a `@keyframes` animation is not cut, and a dismissal, which
   * runs no view transition, keeps its CSS exit.
```

The docs pages' `transition` rows end with the matching sentence (Popover, Dialog, Menu,
HoverCard, NavigationMenu).

## Notes

- JS-free `data-open` on the Dialog family Trigger: the Trigger's ref finds the `<dialog>` by
  `ids.popup` (the `commandfor` id, also for a non-modal dialog that renders no command) at
  attach time and listens to `toggle`. A Popup mounted after the Trigger (conditionally) is not
  picked up; no library composition does that.
- `Popover.Popup` renders a `<dialog popover>`: `instanceof HTMLDialogElement` does not tell a
  Popover from a Dialog in the shared browser suite; check `hasAttribute("popover")`.
- Owned keys (follow-up, coordinator decision): `Menu.Trigger` `id` / `role` and `Toast.Root`
  `tabIndex` / `inert` are now omitted (the library overwrites them). Kept in the types, said in
  the "Owned keys" JSDoc: the Dialog Trigger's `onPointerDown` (chained after the consumer's) and
  `Toast.Root`'s `aria-labelledby` / `aria-describedby` (token-merged).

## For the alpha.28 release notes (not in the CHANGELOG table; the entry is not edited)

| Component | Change | Migration |
| --- | --- | --- |
| Menu | `id` and `role` on `Menu.Trigger` are type errors (they were overwritten) | remove them; the Trigger's id is generated |
| Toast | `tabIndex` and `inert` on `Toast.Root` are type errors (they were overwritten) | remove them |
