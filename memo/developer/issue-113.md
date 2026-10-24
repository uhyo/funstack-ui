# Issue #113 small follow-ups (branch fix/113-small-followups)

- A3: Toast.Root skips ArrowUp/ArrowDown when `ownsArrows(event.target)` (internal/use-roving-focus.ts):
  text-like input, textarea, select, contenteditable, textbox/combobox/spinbutton/slider roles.
  Escape still dismisses from inside a field. Design toast.md keyboard table amended.
- A1: verified 2026-10-24 against BCD (api/Element.json, api/Document.json `ariaNotify`): Chrome 141,
  Firefox 150, Safari 27; current stable Chrome 156, Firefox 158, Safari 27 (BCD browsers/*.json).
  Fallback region dropped; `resetAnnouncer()` kept as a no-op for vitest.setup.ts.
  Note: the fallback was originally a product-owner request (number-field.md 8.3); dropped per the
  no-fallbacks policy at the team lead's direction. Historical decision records left as they were.
- API3: `internal/trigger-ref.ts` `registerTrigger` (console.error behind isDev, once per Root via a
  WeakSet keyed by triggerRef). Used by usePopoverTrigger (Popover, Menu, SubmenuTrigger),
  Dialog.Trigger (both modes) and
  Combobox.Input. menu-trigger.tsx untouched (#110). A Trigger inside a closed popup is under a
  hidden `<Activity>`, whose refs are detached, so the submenu test opens the outer menu.
  Not warned: Menu.ContextTrigger (does not register triggerRef), Tooltip.
- API2: `value` added first in both state objects.
- A2: architect decided no aria-controls (issue comment); no code.
