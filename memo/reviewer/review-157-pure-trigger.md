# Review: refactor/157-pure-trigger (#158 + #157 candidate 4)

Commits 5c2cc49 (#158), 6d14c02 (usePureTrigger), 625ad88 (dev notes). Reviewed 2026-11-24.

**Verdict: acceptable with minor fixes.** Mergeable once M1 is fixed (small, local) and the
CHANGELOG conflict is resolved as described in L3. The #158 rule is implemented correctly
in the browser-run cases the user approved. The usePureTrigger refactor changes no behaviour.

## Verification done

- Merged origin/master (eab50e5; master later moved to caf751b, a memo only) into a scratch
  checkout. Conflicts in **design/CHANGELOG.md** and **design/conventions.md** (9.1 file
  listing) only. With both sides kept: build, typecheck, lint, format:check, test:jsdom all
  pass (ui 3845 tests / 75 files, docs 14).
- Browser tests, `FUNSTACK_BROWSERS=chromium,firefox`, for button, dialog, form, menu, popover,
  toast. Merged branch: 14 files, 507 passed, 15 skipped. Master: 507 passed, 15 skipped. The
  skip lists are identical. The branch adds no browser tests (all new tests are jsdom), which is
  fine.
- Mutations on the branch, in a scratch worktree, jsdom for button/dialog/popover/menu/toast/form/
  internal (1582 tests). Each was reverted and the worktree removed:
  - pendingProps ignores `ignoring`: 18 fail
  - runActivation without preventDefault: 9 fail
  - pendingAriaDisabled without "native wins": 8 fail
  - browserRun drops commandfor/popoverTarget: 1 fail
  - host `<input>` counted as not disableable: 3 fail
  - Button passes only its own pending (drops the form channel): 13 fail
  - openGeneration not forwarded: 11 fail
  - defaultWhilePending ignored: 19 fail
  - Button `handlesClick: !browserRun` -> `true` (the master rule): all 7 #158 Button rows fail
- Pre-hydration proof. With the master rule restored and the attribute assertions removed from
  the "never runs" rows, the event assertions alone fail: `[]` expected, `["submit"]` /
  `["reset"]` received. The enabled "control" rows prove that jsdom does submit/reset from
  server HTML. So the tests prove the submission is blocked, not only the attributes.
  hydrateFromServer runs `mutate` on the `renderToString` HTML before `render(..., {hydrate})`.

## Findings (severity order)

### M1 (medium, a11y) JS-free link render: aria-disabled but the click still acts
render-element.ts (disabledButton `handlesClick: false` -> certainlyNotDisableable),
dialog-trigger.tsx `installClick = isLibrary || !modal`, use-popover-trigger.ts
`handlesClick: isLibrary`, use-overlay-close.ts `installClick = isLibrary || action !== undefined`.
A disabled modal JS-free Dialog.Trigger, a JS-free Popover.Trigger, or an action-less JS-free
Close rendered as `<a href>` now has `aria-disabled="true"` but installs no click handler. After
hydration it still navigates. ARIA says an aria-disabled element is not operable, and conventions
1.2 says "the handler is what makes aria-disabled safe". The new docs JSDoc ("only the honest
state") argues against this. Every other aria-disabled link in the library cancels its click
after hydration: Button, Toast.Action/Close, Form.Submit, and non-modal JS-free Dialog.Trigger
("A disabled link must not navigate either"). The state is right, but the behaviour must follow.
Fix: install a cancelling onClick only while `disabled` in the aria branch (`!disabledProps.invoker`),
exactly as Form.Submit installs one only while disabled. An enabled render element keeps its own
onClick, so Accordion's rule holds. Add a cancelled-click assertion to the new row in
overlay-disabled-render-suite.tsx. Before hydration a link navigates regardless, as with every
aria-disabled link render. Update the button.md 17.1 Close row and the CHANGELOG entry ("nothing
cancels its click").

### L1 (low, docs) button.md 4 a11y table, `disabled` row stale
design/components/button.md:673 still says "never on a link or a component element". A
component render without `action` whose click the browser runs now gets native `disabled`. Same
for a host `<input>`.

### L2 (low, rule gap, follow-up question) the `action === undefined` gate
button.tsx `browserRun = action === undefined && (...)`. A disabled
`<Button action={a} type="submit" render={<Comp/>}>` (dev-warned combination only with formAction)
or `<Button action={a} commandfor=... render={<Comp/>}>` is aria-disabled. Its click's effect is
the browser's too (submit / command), so it submits or invokes before hydration. This follows
the issue text ("with no action"), so it is not a defect of this branch. The user's wording
("the part's own handler is the action") is ambiguous here. Record it in #158 or a new issue for
a user decision rather than change it now.

### L3 (low, merge) CHANGELOG format
Master now has a `# Entries` heading with `## <date>: <title>` entries after it. The branch
appends two top-level `# 2026-11-24, ...` entries. When merging, keep master's entries and
append the branch's as `##` entries after them (append-only order). conventions 9.1: keep both
lines (`use-pure-trigger.ts` and master's `use-step-commit.ts`).

### L4 (low, rule edge) Button resolves "browser-run" from its own `type` prop only
`<Button disabled render={<input type="submit" />}>` without a `type` prop: Button does not own
`type` on an `<input>`, so resolvedType is "button", handlesClick is true, and it takes the aria
branch. The input submits before hydration. This is pre-existing and rare. The developer's test
passes `type="submit"` explicitly. Could read `render.props.type` for a host input, or just
document it.

### Nits
- SKILL.md (packages/ui/skills/funstack-ui-knowledge) still says `"ignore"` "renders
  aria-disabled while pending" without the native-wins exception. The concepts page probably
  says the same. Harmless, but the skill is the agent-facing summary.
- usePureTrigger `pendingProps(disabledProps, pending?)`: Menu.Item passes its whole
  `libraryProps` as `disabledProps`. This works structurally, but the parameter name suggests the
  disabledButton result. A one-line comment at that call site would help.

## Correctness against the approved rule (no action)

- Native where the browser runs the click and the element may be a button: Button without
  action and submit/reset/formAction default/commandfor/popoverTarget, no render / function / host
  button / host input / component. Form.Submit gives the same output as before. JS-free
  Trigger/Close on a component stay native, as before.
- aria + cancelled click: host `<a>`/`<div>`, own-handler parts on link/component, Toolbar,
  focusableWhenDisabled, submenu trigger. Button with action, Toolbar and focusableWhenDisabled
  are unchanged (tests pin it; the mutation to the master rule shows only the browser-run rows
  move).
- Pending + disabled: native wins in Button, Close, Toast.Action. In the aria branch it is still
  `true`. Menu.Item is never native, so its output is unchanged.
- Refactor: the aria-disabled expressions of Button/Close/Toast.Action/Menu.Item are equivalent
  to master except for the native-wins case (#158). Close keeps `run` (it cancels every click
  itself). Button keeps `ignoring` for the formPending guard.

## Verdict (a): aria-disabled on a JS-free link
aria-disabled is the right state (`disabled` on `<a>` is meaningless and exposes an enabled
link). But it is acceptable only if the click is cancelled after hydration too: M1.

## Verdict (b): commandfor/popoverTarget as browser-run
Agree. It is the user's "JS-free invoker" and matches JS-free Dialog/Popover Triggers on a
component render, which were already native. The worse guess (an aria-disabled component that
renders a live invoker before hydration) is exactly what #158 removes. Composition: a Button
inside a library-mode Popover.Trigger receives popoverTarget, and with its own `disabled` it is
now native and no longer focusable. That is safe (the invoker is dead before hydration). Inside
a Toolbar it stays aria via alwaysFocusable.

## Interface (usePureTrigger)
Clear and small: `{ pending, run, ignoring, runActivation, pendingProps }`. `runActivation`
vs `run` is well named (run plus the preventDefault). The optional `pending` override in
pendingProps exists for Button's form channel only; that is documented in the JSDoc.

## Docs / Roadmap / CHANGELOG
The Roadmap "Behaviour changes" entry is accurate and complete (Button native, native-wins for
Button/Dialog.Close/Popover.Close/Toast.Action, JS-free host link). Its wording on the link
should follow M1. The CHANGELOG entries are accurate apart from the M1 sentence and the L3
format. Conventions 1.2 / 3.6 are amended and the review-157-align M1 ask (no own expression in
Form.Submit/Button) is met. Docs pages for Button/Dialog/Popover are updated, and the props
tables match the code.
