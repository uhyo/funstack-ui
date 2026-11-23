# #146 whilePending (2026-11-24)

Branch `feat/146-while-pending` (not merged; PO merges after review).

## What landed

- `WhilePending = "run" | "ignore"` in `internal/types.ts`, root export only (like `Action`,
  `ChangeReason`; subpaths do not re-export shared types).
- `useActionTrigger`: `ignoreWhilePending` default `false`. Slider / NumberField keep their
  explicit `false`.
- Button: `whilePending` default `"run"`; `ignoring` gates both the counter guard (action) and
  the `formPending` guard (function formAction); `aria-disabled` = `(pending && ignoring) ||
  (disabled && focusable)`.
- `useOverlayClose` takes `whilePending` (default `"ignore"`); Dialog.Close / Popover.Close
  pass it. Library mode still cancels every click (its mechanism).
- Menu.Item: default `closeOnActivate ? "ignore" : "run"`. Toast.Action: `closeOnSettle ? ...`.
- `MenuCheckboxItemProps` omits `whilePending` (it extends `MenuItemProps`; RadioItem inherits
  the omission). The type test in `internal/types.test.ts` caught it.
- `ToastActionOptions`: no field (no `closeOnSettle` there either; part-level behaviour props).

## Finding: entanglement holds the close in "run" mode

Library-mode Close and closing Menu.Item with `whilePending="run"`: run 1 resolves and calls
`requestClose` inside the part's transition; React entangles that with run 2 (still pending),
so the overlay stays open and the part pending until run 2 settles. If run 2 rejects, the part
is still connected: the rejection goes to the boundary (not `reportError`), and the close
commits in the same commit. The design text ("a run that rejects after the part left is
reported, #152") is therefore unreachable there. Toast.Action's close is urgent (not a
transition), so the toast leaves at run 1 and run 2's rejection is reported. Design docs
amended (conventions 2.5.1, button.md 18.7, dialog/popover/menu/toast amendments).

Note for the product owner: after that, the boundary's fallback is rendered inside a closed
overlay (menu content unmounts on close unless keepMounted). That is React's behaviour; not
changed.

## Tests

- button.test.tsx: rows split by mode; new 5b (every activation runs, default and explicit),
  5c (overlap / superseded rejection), 5d (prop change while pending).
- overlay-close-part-suite.tsx: D7 / P5 rows for "run" (library: two calls, no aria-disabled,
  one close after both; stale-close guard; older rejection reported; latest rejection to the
  boundary with the close held), JS-free "run" (one native close).
- menu.test.tsx / toast.test.tsx: "whilePending (#146)" describe blocks; M2 / W6 flipped and
  kept under `whilePending="ignore"`.
- browser: button rows 21, 22, 24, 26 split by mode.

## Docs

Pending & optimistic (second-click section rewritten), Action props, Button (whilePending row,
ButtonCounter example, Save / FormActions with "ignore", Overlapping submissions callout),
Dialog / Popover / Menu / Toast props tables, Roadmap breaking entry, SKILL.md, playground
(button, menu demos), CSS: menu `[aria-disabled]` rules now `:not([data-pending])`.
