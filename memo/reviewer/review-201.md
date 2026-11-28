# Review: #201 consistency alignment, overlays and menus

Branch `feat/201-align-overlays` at 4f44da5c (e8bfc3ec, dfe563c0, 4f44da5c on master 23586b44).
Verdict: acceptable with minor fixes.

## Verified

- Every #201 checklist item in the CHANGELOG entry "2026-11-28, #199" is implemented: Toast
  `closeOnActivate`, JS-free Dialog-family Trigger `data-open`, the listed Omit additions with
  type rows, the details renames (root and subpath exports agree), Toast state types and
  `state.empty`, `data-submenu`, `data-priority`, `data-fsui-typeahead`,
  `experimental_focusGroup` on Menu.Popup, the toast platform-typings import, the Toolbar rule
  on the five overlay Triggers, the shared `transition` paragraph (identical on the five Popups;
  all five go through the CSS-transition cut), Menu.Root rejection route.
- JS-free `data-open`: listener removed on detach, synced on attach, React renders no value
  (`dataAttr(false)`), so re-renders and hydration never touch the DOM-written attribute;
  `state.open` stays false (class-based row).
- Toolbar: aria-disabled, focusable, in the arrow sequence, no invoker, click cancelled
  (modal JS-free via `cancelClick`, non-modal via the disabled guard, Menu keydown guarded).
  Popups reset ToolbarContext (renderOverlayContent), so nested Triggers are not affected.
- typecheck, lint, format:check, jsdom (5529 passed), browser Chromium + Firefox for the
  overlay folders (668 passed) all pass. WebKit not run (cannot launch here).
- Mutations: dropping the `removeEventListener` fails 3 rows; forcing
  `alwaysFocusable: false` on the Dialog Trigger fails 4 rows.

## Findings

1. (medium) Conventions 1.5 says owned keys are omitted "in every part"; #201 parts still type
   overwritten keys: Toast.Action / Toast.Close (`type`, `aria-disabled`), Menu.Item and the
   parts deriving from MenuItemProps (`type`, `role`, `tabIndex`, `aria-disabled`; SubmenuTrigger
   also `id`), Menu.Popup (`tabIndex`). Checklist gap; alpha.28 is the one breaking alpha.
2. (low) Menu.Popup omits `aria-labelledby`, which it token-merges (1.5: such keys stay).
3. (low) `onPointerDown` kept on DialogTriggerProps as "chained" is not one of 1.5's three
   kinds (and `onClick`, also chained by mergeProps, is omitted). Needs a rule amendment or
   omission.
4. (low) Stale "Owned keys" JSDoc: NavigationMenu.Trigger (no `aria-disabled`, not "omitted from
   the props type"), Drawer.Popup / AlertDialog.Popup (no `popover`, `onToggle`,
   `onBeforeToggle`).
5. (low) `instanceof HTMLDialogElement` is realm-bound (iframe portals); `tagName` check is safer.
6. (info) Popover.Trigger disabled in a Toolbar in JS-free mode renders a static
   `aria-expanded="false"` even if the popover is open from elsewhere.
7. (info) ExperimentalPage row still says `experimental_focusgroup` for Menu.Popup (file is
   #202's; transient until #202 lands).
