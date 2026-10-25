# Review: branch docs/136-why (#136 Why page + home, #135 SKILL.md + AI guide)

Reviewed at f57302b (includes the move of the AI guide to /concepts/ai-agents).
Verdict: acceptable with fixes. B1-B3 are accuracy problems on the page whose job is to persuade;
fix before merge. M1-M2 should also be fixed (fairness, agent correctness).

## Blocking

B1. WhyPage.tsx "No races between fast clicks" overclaims. The latest-dispatch guard
(internal/use-controllable-action.ts:140-156) only protects *uncontrolled* state. In controlled
mode the parent's own post-await setState (the server-backed pattern ActionPropsPage documents)
still lands in completion order, so a slow older response can overwrite a newer choice. The
concept page says so ("uncontrolled state is committed only for the most recently dispatched
action"); the tests cover only "overlapping actions (uncontrolled)" (value-action-suite.tsx:402).
Fix: "The display always shows the latest click, and uncontrolled state commits only the latest
dispatch." Same qualifier in SKILL.md "Latest intent wins" (point controlled users at
useActionState / their own guard), or an agent will assume controlled mode is race-free.

B2. WhyPage.tsx before/after: "plus rollback on failure" is unfair to the hand-written version.
Its useOptimistic value already reverts when the transition ends, and React 19 sends the error
thrown in a useTransition async transition to the Error Boundary. The real differences are
latest-click-wins (uncontrolled), transition types, ARIA/keyboard/data attributes. The comment
"a slow save from an earlier click can still overwrite a later one" is accurate (post-await
setPressed calls apply in completion order). Fix: drop "rollback on failure" or say "same
rollback".

B3. WhyPage.tsx "No JavaScript copies of the browser": "The browser handles the top layer, Escape,
click outside and focus return." Dialog's click-outside is an opt-in `lightDismiss` with a JS
pointerdown+click baseline (dialog-popup.tsx:64-77, 480+); native `closedby` only behind
experimental_closedBy (no Safari). Dialog also calls returnFocusToTrigger in some paths
(dialog-popup.tsx:314, 400). Fix: "The browser handles the top layer and Escape; popovers
light-dismiss natively."

## Should fix

M1. Comparison table, Animation row: "CSS, plus your own code for exit animations" is unfair.
Typical headless libraries ship presence/exit-state support (data-state with animation-end
detection, ending-style attributes, exiting render props). Suggest: "CSS, with exit-animation
states built in. No ViewTransition integration."

M2. SKILL.md mental model gives the action signature as `(next, details) => unknown` for all
action props. `Button.action` and `Menu.Item.action` take `(details)` only (button.tsx:45,
menu-item.tsx:30). An agent will write `action={(next) => ...}`. Add: "Task actions (`action` on
Button, Menu.Item, Close parts) take only `details`."

## Minor

m1. "No fallback flashes" card and SKILL.md "keeps a dialog/popover closed until it is ready":
true in library mode only (Accordion with value props, Dialog/Popover with open props). In JS-free
mode content is rendered ahead and must not suspend. Add "(with value/open props)" in SKILL.md.
m2. SKILL.md #10 reads "Do not render data-pending styles on panels"; say "Panels never get
data-pending". Dialog/Popover Roots render no DOM, so the selector advice `.tabs[data-pending]`
does not transfer; mention the Trigger for those.
m3. "Every component sets data-pending" -> "Every component with an action".
m4. AI guide SKILL_INSTALL_PATH example: the variable is ignored when stdin is a TTY (verified in
@funstack/skill-installer 1.1.0 dist/index.js:105). The text says "in a script or CI", so OK;
optional `< /dev/null` hint for someone trying it in a terminal.

## Release ordering (not a content defect)

The AI guide and SKILL.md document the `funstack-ui-skill-installer` bin, `skills/` in `files`
and `dist/docs/index.md`. None exist on master yet (dev-134). Do not release (deploy docs) with
this page before #135's developer part lands, or the documented command fails.

## Verified OK

- Every component, part list and subpath in SKILL.md matches packages/ui/src/*/index.ts and
  package.json exports; shared types exported from the root (Action also exists, unlisted: fine).
- Tooltip root props (delay 250, closeDelay 150, disabled, provides; no open props), Tabs.Panel
  keepMounted, Accordion/ToggleGroup `exclusive`, Checkbox controlled-only indeterminate,
  Form.Root errors, Combobox List `query`, toast.update/dismiss/promise, Viewport `{ toasts }`,
  Progress/Meter Root without "use client", `onInputValueChange` the only on* prop,
  `<ViewTransition default={transition}>` (internal/transition-boundary.tsx:28), fsui-tabs-next.
- ChangeReason values match internal/types.ts.
- Installer: agent list (Claude Code, Codex, GitHub Copilot, Cursor, Gemini CLI, Windsurf,
  OpenCode, Antigravity 2, Other) and fs.cp overwrite match @funstack/skill-installer 1.1.0.
- Browser support wording matches docs/vision.md.
- Build (docs, with checkInternalLinks), typecheck, lint, format:check pass at f57302b. No stale
  /guides/ links remain.
- Scannability: intro, 6 cards, one before/after, 6-row table, for/not-for, next. About a minute;
  the table is the heaviest part but rows are short. Home no longer repeats the Why content.
