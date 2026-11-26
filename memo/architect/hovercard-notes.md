# Architect notes: HoverCard (#166), 2026-11-26

Working notes behind `design/components/hover-card.md`. Not a spec; the design doc is.

## Probe (probes-166/interest-rules.mjs, Playwright Chromium 156.0.8078.4)

Native `interestfor` on `<a href>` + rich `<div popover>`, delays 100 / 100 ms:

- A. Hover open, click a button in the card (focus inside), pointer leaves both: **closes**
  (`loseinterest`), focus ends on `<body>`. `hint` and `manual` alike.
- B. Keyboard open, Tab into the card, Escape: closes. `hint`: focus back on the link
  (platform restore), no re-open. `manual`: focus on `<body>` (manual restores nothing).
- B2. After Escape on the link, a script `after.focus(); inv.focus()` grants interest again
  (the card opens). So a library `focus()` on the Trigger can re-open the card on the flagged
  path in 156; M160's "suppress next focus interest" may cover the platform's own focus return
  only. Hence the library's flag, read at the `beforetoggle` interception.
- C. Keyboard open (focus stays on the link), pointer enters the card and leaves: **closes**,
  although the link still has `:focus-visible` focus.
- E. Click on the invoker while open: stays open. Leaves on pointer leave.

So Chromium's interest is "latest event wins", not "hovered or focused". This contradicts the
one-line summary "focus inside the card keeps it open" if read as a state rule. The design
follows Chromium: Tooltip's timer pair plus `focusin` / `focusout` on the Popup.

Library-mode shape ("intercept": cancel the interest show at `beforetoggle`, re-show with
`showPopover({ source })` a task later):

- `loseinterest` fires, the popup stays (popover.md 2.9 confirmed for `manual` and `hint`).
- `hint`: Escape closes natively (close watcher); `manual`: Escape only fires `loseinterest`
  while the invoker has interest, and nothing once interest was already lost. So the library's
  own document Escape listener is needed on the flagged path too.

Not probed: Firefox / WebKit (JS path only there; nothing engine-specific beyond what Tooltip
and Popover already test), touch long-press, Chromium 160.

## Decisions I went back and forth on

- **One mode vs Tooltip's browser-owned open.** A browser-owned HoverCard (content always
  mounted, `showPopover()` straight from the timers, no React state) would be zero-JS in
  Chromium behind two flags and cost nothing per hover. Rejected: the point of a hover card is
  content loaded on interest, and that is a transition with Suspense. Two modes would double the
  component for a Chromium-only, flag-only benefit. Menu and Combobox already have no JS-free
  mode.
- **Lost interest: fact or held request.** Menu holds the hover close of a submenu (a request
  with reason `"dismiss"`, view-transition exit). Conventions 3.9.2 lists the lost-interest hide
  as a fact. Went with the fact: React entangles async actions, so a held close could wait on an
  unrelated pending action with the card still over the page; in a menu the user is still inside
  the component, here they have left. Cost: no exit animation in Firefox.
- **Trigger press.** Chromium keeps the card open on an invoker click. Tooltip's JS path closes
  on any pointerdown. Chose "press closes and cancels", on both paths: the worst case otherwise
  is a card that appears 600 ms after the user clicked the link, over a page that is changing.
  The flagged path can enforce it because every open passes `beforetoggle`.
- **`aria-details` while shown.** The research offered it; Chromium's native path exposes it.
  Left out: adjacency already gives the reading order (HTML-AAM drops the relation for an
  adjacent `popovertarget` popover for that reason), it needs the `shown` mirror on a part that
  otherwise renders no ARIA, and "has details" on every open mention is verbosity. Passes
  through for consumers. Revisit when w3c/aria #2617 settles.
- **Default role.** None (generic in WebKit, `group` in Chromium), `group`, or `dialog`.
  `dialog` requires a name on every mention card and announces a dialog for what is often an
  avatar and two lines. `group` equals HTML-AAM's minimum role, so the engines agree.
- **`<div>` inside `<p>`.** The primary use (a mention in prose) cannot hold a `<div>` sibling.
  No portal (library rule; nested cards and modal dialogs depend on DOM containment). Documented
  `render={<span />}` with phrasing content, and the hoisted Popup with its Safari keyboard
  degradation. Considered making `<span>` the default element; kept `<div>` for consistency with
  the other popups and because a `<span>` default with `<div>` children is still invalid inside
  a `<p>`.
- **`disabled` on Root** follows Tooltip, including `data-disabled` on the Trigger. Doubt: a
  consumer's generic `[data-disabled]` style would grey out a link that still works. Raise in
  review if it bites; an alternative is to emit it on the Popup only.
- **`interestfor` in the server HTML.** Tooltip renders it (the popup content is static, so a
  pre-hydration open is complete). A HoverCard's content is unmounted, so a pre-hydration
  interest would show an empty box; written through the ref after hydration instead (Combobox's
  Trigger precedent).
- **Delays.** 600 / 300 from Base UI; Chromium's `normal` is 250 / 150 since M157. Longer is
  right for a card that fetches and takes the Tab path. Listed as a user decision.
- **Preload during the delay.** Thought about dispatching at hover start and making `delay` a
  minimum time before the show. Rejected: every pointer pass over a list would fetch. The
  Trigger's own `onPointerEnter` / `onFocus` pass through, which is enough for a recipe.
- **`whilePending`**: nothing to attach it to. No part runs an action on activation.

## For the implementer

- The JS interest tracker is Tooltip's hook minus skip-delay / `data-instant` /
  pointerdown-anywhere, plus Popup `focusin` / `focusout`, the Trigger `pointerdown` rule, the
  drag rule, and outcomes that go through the Root (`requestOpen`, a dismissal, `requestClose`).
  A shared "interest tracker" for Tooltip and HoverCard is tempting; do it only if the two
  hooks end up line-for-line similar.
- `usePopoverPopup` needs: a no-focus show for every open (the `refused` branch of
  `showWithFocus`), and a dismissal entry that can skip the Trigger focus fallback (the
  lost-interest hide has it as `takeLostInterest`). Document listeners live "while intended
  open", which is wider than `whileShown`.
- The Escape stand-down must look for shown popovers inside the Popup by iterating
  `[popover]` and asking `matches(":popover-open")` (the jsdom shim cannot answer the selector
  in `querySelector`; Tooltip's deviation B6).
- Enumerations to extend at implementation are listed in the CHANGELOG entry.
