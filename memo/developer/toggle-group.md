# ToggleGroup and Toolbar (#66, wave 6)

Design: `design/components/toggle-group.md` (accepted 2026-10-18).

## Files

- `src/internal/use-roving-focus.ts`: the DOM-written roving engine. `createEngine()` is a plain
  closure object held in `useState`; options are written from an insertion effect (no ref reads
  in render: oxlint `react(refs)` flagged passing refs into the `useState` initializer).
  `itemsOf` and `isTextEntryItem` exported for the unit test.
- `src/internal/toolbar-context.ts`: `ToolbarContext { orientation }`.
- `src/toggle-group/*`, `src/toolbar/*`; `Menu.Trigger` reads `ToolbarContext` (vertical: opens on
  the inline-end arrow, `isRtl` from `menu-dom.ts`).

## Decisions / deviations taken while implementing

- **memory:false semantics.** The design says a standalone group re-derives the stop from
  `entry` on every apply. Taken literally, with focus on Left and Right pressed, Tab from Left
  lands on Right (still inside the group), and Shift+Tab from a rolled-back Item lands on the
  pressed one. Implemented instead: while focus is inside, the focused item is the stop; when it
  leaves (an `onBlur` handler on the container, relatedTarget outside) the stop goes back to
  `entry`. Same as native `nomemory`. So the engine returns `onBlur` too (extra owned key).
- **`enabled` option** on the engine, so ToggleGroup can call the hook unconditionally and turn it
  off inside a Toolbar.
- **Managed set** is a `Set` (not `WeakSet`): elements that stop being items (became `disabled`,
  left the container) get `-1` back or their attribute removed; a stale `0` on a disabled button
  would otherwise come back as a second Tab stop when re-enabled. Pruned when they leave the root.
- **Native switch-over**: the hydration render runs with `native=false` (server snapshot), so the
  first layout effect writes `tabindex`; when `native` turns true the engine removes every
  attribute it wrote (`release`).
- **Item order**: `state.value` order and the `focusgroupstart` value come from a `layout` state
  refreshed in a layout effect (CheckboxGroup's pattern) rather than a ref read during render.
- **`focusgroupstart`** is rendered whenever the flag is on (standalone), not only when native
  (16.2 vs row 16 / section 8 disagree; followed row 16 and Tabs).
- **First entry in a Toolbar** skips `aria-disabled` items (first non-`aria-disabled`, else the
  first item).
- `deselectable?: never` on the multiple variant: TypeScript's union excess-property check does
  not reject `deselectable` on `<ToggleGroup.Root deselectable>` without `exclusive`.
- `isNestedOut` checks the element itself too (a `Menu.Popup` has `tabindex="-1"` and `popover`).

## Known limitations

- A ToggleGroup rendered inside a Popover / Dialog popup that is itself inside a Toolbar reads
  `ToolbarContext` and runs no engine, but the Toolbar's engine excludes popup content. Rare;
  would need the overlays to reset `ToolbarContext`.
- Tooltip's dev check (#57) accepts `tabindex=-1` triggers only under known composite roles;
  `role="group"` (a standalone ToggleGroup) is not in the list. It runs once at mount, before the
  engine writes, so it does not fire in practice.

## Browser tests

- Chromium native `focusgroup="toolbar inline wrap"`: one stop with memory, wrap, Home/End, skips
  `disabled`, reaches `aria-disabled`, input keeps arrows and Shift+Tab / Tab move to previous /
  next item; Shift+Tab from a non-text item leaves the toolbar (both paths). Nested ToggleGroup
  without `focusgroup` adds no stop. All identical to the JS path; no divergence found.
- Standalone group with `nomemory` + `focusgroupstart`: Tab back in lands on the pressed Item.
- Playwright refuses to click an `aria-disabled` button ("element is not enabled"); the click-memory
  row clicks an enabled one.
