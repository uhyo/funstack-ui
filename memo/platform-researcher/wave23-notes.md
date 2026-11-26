# Working notes: wave 23 research (#166 HoverCard, #165 Select multiple), 2026-11-26

Doc: docs/research/wave23-hovercard-select-multiple.md. Probes: probes/21-wave23/.

Sources that answered fastest this time:
- whatwg/html PR #11006 diff (`gh api ... -H 'Accept: application/vnd.github.diff'`) for the
  current interestfor processing model, long-press, author guidance. Commit list shows recent
  changes at a glance.
- Chromium `element.h` per branch head for `kDefaultInterestDelay*Seconds`: loop over
  chromiumdash `fetch_milestones?mstone=N` -> branch.
- Flags file per branch: `InterestForSpecAlignment` only on main (=> M160).
- Safari release notes `.md` moved: now `https://developer.apple.com/documentation/safari-release-notes/safari-27_3-release-notes.md`
  (the old `/tutorials/data/...` URL 301s there).

Gotchas:
- Chromium `interest-delay: normal` was 0.5 s until M156 (Playwright's build) and 0.25 s since
  M157. Probes waiting 400 ms saw nothing; wait >= 800 ms or set explicit delays.
- `CSS.supports("selector(::interest-button)")` is true even though the runtime flag is
  experimental and nothing renders. Do not use it as a feature check. BCD says 149 (wrong).
- Chromium `<select multiple size=1>` is a drop-down with a picker on desktop even with native
  appearance (UpdateUsesMenuList, parity change); not styleable without the flag.
- CDP AX: rich interest target -> `details` on invoker, no `expanded`; card role `group`.

Re-check later:
- Safari 27.3 stable (adds `popover=hint`) -> drop Tooltip/HoverCard hint flag.
- Chromium M160 (2027-01-05) spec alignment: re-run ax-focus.mjs and hovercard.mjs.
- whatwg/html #11006 merge; w3c/aria #2617 (aria-expanded on rich invokers).
- Gecko 1984699 / WebKit 297786 movement; Interop 2027 selection (~Feb 2027) for #1358 / #1393.
- whatwg/html #12069 (multi drop-down) merge and any Chromium intent to ship for
  CustomizableSelectMultiplePopup.
