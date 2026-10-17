# Working notes: Popover + Menu research (2026-10-17, issue #37)

Sources that answered things fastest this time:
- BCD 8.1.6 (timestamp 2026-10-15) via unpkg; current stable Chrome 155 / Firefox 158 / Safari 27.
- Chromium flags (branch 8059 = M155, and main): `MenuElements` experimental, `Focusgroup` stable,
  `FocusgroupV2` experimental, `HTMLCommandActionsV2` test, `HTMLInterestForInterestButtonPseudo`
  experimental, `PopoverHintNewBehavior` stable.
- wpt.fyi stable runs (Chrome 155.0.8059.84, Firefox 157.0, Safari 27.0) via POST /api/search with
  `exists: [{pattern: "/html/semantics/popovers/"}]`; per-subtest detail from the run's
  `raw_results_url` report.json (335 MB for Safari; filter with python).
- HTML spec popover.html stripped to text: "focus is returned to the previously-focused element only
  for the first popover in a stack"; popover focusing steps run dialog focusing steps for `<dialog>`.

Things found that other roles should know:
- Tabs bug: `"focusgroup" in HTMLElement.prototype` is false in Chromium 156; the IDL attribute is
  `focusGroup` (DOMTokenList-like). experimental_focusgroup never takes the native path. Filed as a
  repo issue (to be opened by the product owner; my gh issue create was denied). conventions.md 8, tabs.md, survey all repeat the wrong check.
- Chromium 156 exposes `<dialog popover>` as modal=true in the AX tree (also popover=manual, also via
  commandfor). `aria-modal="false"` fixes it. Not found in the Chromium tracker by search. Human task.
- Nested auto popover close (Escape) leaves focus on <body> in Chromium and Firefox. Spec-conformant.
- interestfor on a menu item opens the submenu on keyboard focus, and one Escape then closes the
  whole menu stack; not APG. Hover part works well.
- React VT: wrapping the popover element in <ViewTransition> and toggling showPopover/hidePopover in
  a layout effect of a transition commit animates both enter and exit in Chromium AND Firefox
  (Firefox otherwise cannot exit-animate popovers). Content-only VT inside a closed popover: no
  enter (React does not see the boundary while display:none), exit works.

Re-check later:
- WebKit 302008 (position-try on nested popover hangs) NEW; 317926 (iOS hang, position-try +
  @starting-style) NEW. Both directly hit submenus. Watch first WebKit CI run of Menu.
- Safari 27.0 fails popover-focus-2/-4 (Tab from invoker into a popover elsewhere in the DOM).
- Open UI menu elements: explainer updated 2026-10-01; TAG review #1242; WebKit SP #580 and
  Mozilla SP #1317 have no position. dbaron objects to changing `<menu>`.
