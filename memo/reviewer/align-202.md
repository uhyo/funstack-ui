# Review: #202 alignment, disclosure and composites (feat/202-align-composites)

Commits b7947d78, dc7f5660, 820230bb, 6e85025f on master 23586b44. Reviewed 2026-11-28.
Checks run in a worktree: build, typecheck, lint, format:check, test:jsdom all pass;
test:browser on Chromium + Firefox all pass (WebKit cannot launch here).

Verdict: acceptable with minor fixes.

## Findings

1. Medium. `toggle/toggle.tsx:44-47`: `ToggleProps` does not omit `aria-disabled`, though the
   Toggle writes it (in a Toolbar, or with a link/component `render`) and its own "Owned keys"
   line (`toggle.tsx:92`) lists it. Conventions 1.5 ("aria-disabled on a part that takes
   disabled"; the list equals the Omit). Button and ToggleGroup.Item omit it. The #202
   checklist named the Omit only for ToggleGroup.Item: checklist gap, the rule covers Toggle.
2. Medium (design, architect). `Toolbar.Separator` now owns and renders `role="separator"`
   (checklist C-M5), but `design/components/toggle-group.md` 3.5 (and rows 1, the anatomy
   tree, 855) still says implicit role, Omit without `role`, owned keys `aria-orientation`,
   `data-orientation`. The component doc is the current rule; it needs an amendment +
   changelog entry. Note also the divergence from `Separator`, which does not own `role` when
   not decorative.
3. Low (merge order). `ToolbarPage.tsx` "Disabled controls" table documents the overlay
   Triggers (Menu/Popover/Dialog/AlertDialog/Drawer) as aria-disabled inside a Toolbar; that
   is #201's code (`menu-trigger.tsx:214` here still `alwaysFocusable: inBar`). True only once
   #201 lands; merge #201 first or together.
4. Low (design, architect). Conventions 1.5 "passing it is a type error" is false for
   hyphenated keys in JSX: TS does not check hyphenated JSX attribute names against the props
   type. Verified: `<Tabs.Tab aria-selected aria-disabled>`, `<Accordion.Trigger aria-disabled>`,
   `<Menubar aria-orientation="vertical">`, `<Avatar.Root aria-labelledby>` compile;
   `<Tabs.Tab role="link">` errors. The tests correctly pin these with object literals typed as
   the props. 1.5 needs a qualifier (a type error in an object of the props type and for
   identifier keys in JSX; in JSX a hyphenated key is accepted by TS and overwritten at runtime
   by the library layer).
5. Nit. `accordion-root.tsx:164`: exclusive `valueChangeAction` JSDoc says "See" the multiple
   one, which advises persisting `added`/`removed` over `next`; in exclusive mode latest-wins
   makes `next` the right value to persist (accordion.md 2.2 scopes the advice to multiple).
6. Nit. `toggle/toggle.test.tsx:94` title says "renders no boundary" but asserts only that the
   button renders; the forced-through `transition` now lands on the DOM as an attribute. The
   type error is the real pin; rename the row.
7. Low. `menubar/menubar.tsx:203` now gates menu switching on `isPlainKey`, but
   `menubar.test.tsx` has no modifier row (testing.md 10.1 "Arrow keys between items" lists
   Menubar); the standalone ToggleGroup also has none of its own (covered only by
   `use-roving-focus.test.tsx`).
8. Nit. Owned-keys lines still cite "conventions 1.2" in `toolbar-root.tsx:85`,
   `toggle-group-root.tsx:233`, `tabs-root.tsx:125` (others moved to 1.5).

## Verified correct

- Accordion details: diff against optimistic (trigger) / intended (platform), both sides sorted
  in document order; exclusive switch reports both; reducer is `applyPatch` (same as
  ToggleGroup), mount reconciliation dispatches `whole` with every change; rollback rows in
  the value-action suite use the new detailsFields. Kinds open/close per non-empty side.
- state.value via useItemOrder, `[]` in JS-free mode; `loop` default true.
- isPlainKey shared by Accordion, Tabs.List, roving engine, Menubar; aria-disabled triggers in
  sequence; Home/End to ends; focusWithRing. Tests for each modifier, Shift, preventDefault.
- No `transition`/boundary left on Toggle, ToggleGroup.Item, Tabs.Tab, Accordion.Trigger,
  Collapsible.Trigger; JS-free warning rows updated.
- state.open false in JS-free mode (Accordion Item/Panel, Collapsible Root/Panel).
- Toolbar disabled rows for Button, Toggle, ToggleGroup.Item (own and group) in jsdom.
- NavigationMenu.Item data-open/data-pending library mode only; Tabs Panel/Indicator attrs;
  Menubar aria-/data-orientation; Separator data-decorative; Avatar aria-labelledby owned.
