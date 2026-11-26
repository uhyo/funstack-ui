# Review #166 HoverCard (feat/166-hovercard @ 63349d1e), 2026-11-26

Verdict: merge after fixes (none blocking; one Chromium both-flags focus bug to fix or ticket).

Ran: jsdom + jsdom-isolated 4093/4093 (after `pnpm build`; directives.test needs dist).
Browser Chromium + Firefox: 58 files, 1094 passed / 44 skipped. WebKit does not launch here (WSL);
branch CI green on all three. Could not run an ad-hoc probe file (sandbox refused the write), so
finding 1 is from code + probe output (interest-rules.output.txt, hint intercept=true rows B/C).

## Findings

1. Medium. Both flags (hint + interestFor), focus inside, lost interest: the flagged lost-interest
   hide is use-interest-dismiss.ts:59-67 (hidePopover without blur). A `hint` popover restores
   focus to the element focused at its show (probe hint/intercept=true row B: focus -> inv). For
   a keyboard-opened card (link focused at show) + Tab into card + pointer crosses and leaves, focus
   goes to the Trigger: breaks hover-card.md 6.2 ("lost interest never focuses the Trigger"), and
   focus on an interestfor invoker grants interest (row B2) while `suppressed` is false, so the
   card re-opens after `delay`. handleHidden's `!lostInterest` skip (use-popover-popup.ts:349)
   does not prevent the platform's own restore. Fix: give useInterestDismiss/usePopoverPopup a
   `beforeInterestHide` (or `blurOnDismiss`) option HoverCard sets to blur focus inside the popup
   before that hidePopover(), the same as use-hover-card-interest.ts:337; add a Chromium row to
   hover-card.browser.test.tsx (both flags, Tab in, hover card, hover away: focus not on link,
   card stays closed 600 ms).
2. Low. Non-modal Dialog.Popup containing a shown card: dialog-dismiss.ts:85-91 runs on the
   dialog element (before HoverCard's document bubble listener) and escapeBelongsToInnerLayer
   ignores `manual` popovers (dialog-dismiss.ts:21), so Escape closes the dialog, then the card's
   listener sees defaultPrevented and leaves the card :popover-open inside a closed dialog.
   Contradicts hover-card.md 2.6 "Escape closes the innermost first". Pre-existing class of gap
   (Tooltip manual likely same). Fix: count any open popover inside the dialog that contains the
   target (or one marked by the library) as an inner layer; add a jsdom row. Can be a follow-up
   issue.
3. Low (design text). hover-card.md:229-231 "focus inside the card keeps it open" contradicts
   Decision 6 / 2.1. Replace with "focus moving into the card cancels the close timer (focusin),
   but the latest event wins: a later pointer leave still closes it". hover-card.md:275-280
   "Escape and a press need no state" then "one flag ... set by Escape, a press" - reword to the
   one-flag rule only. hover-card.md:847-848 (section 12) still says "a dismissal can say that it
   returns no focus" as a hook capability; say it is HoverCard's blur, and list quietShow /
   allowOpen / elements.
4. Low (test). Chromium row "Escape with focus inside..." (browser.test.tsx:369) does not spy
   openChangeAction; assert it saw only `true` (no `false` from a loseinterest arriving before the
   toggle). The jsdom suite covers the routing, but the real event order is Chromium-only.
5. Nit. Document listener attach timing (use-hover-card-interest.ts:291-293): on the flagged path
   the listeners attach in the passive effect after the optimistic commit, not at dispatch (the
   JS path calls listenDocument(true) at use-hover-card-interest.ts:410). A sub-frame window where
   Escape only cancels timers. Acceptable; could call listenDocument(true) from a Popup callback
   when allowOpen passes.
6. Process. Decision 6's Chromium 160 re-probe lives only in memo/developer/issue-166.md; file it
   as an issue in this repo so it is not lost. The four Chromium-only rows are correct per the
   engine policy (Firefox/WebKit run the degraded row).

## Checked and fine

- Shared use-popover-popup.ts: quietShow/allowOpen/elements are opt-in; default element message
  unchanged. Intent `event` change: every other recordCloseIntent caller in use-popover-popup's
  path passes a defined Event (popover-trigger, popover-close, popover-popup, interest-dismiss,
  combobox leave); Dialog reads intents in dialog-popup.tsx:348 with its own `??`. No behaviour
  change for Popover, Menu, Select, Combobox, Tooltip, Dialog.
- Deviations: one flag cleared also on pointerenter (sound; 2.4 already lists it); Escape
  prevented only for a shown card (2.2 row updated); blur before hide (needed, else
  focusWasInside is computed at beforetoggle and returnFocus would focus the Trigger); undefined
  event for disabled close (2.5 row).
- Double dismiss: capture listener hides synchronously and marks the event; Trigger listener only
  cancels timers; hiddenBeforeToggle guards a second requestClose before the toggle fact. Correct.
- Requests vs facts per 2.5; transition open, pending, Suspense hold, optimistic rollback, overlap,
  controlled refusal re-show; no aria-describedby/expanded; role=group default; touch ignored;
  :focus-visible gate; Tab into card; Escape focus return only from inside.
- Docs props tables match the TS types; skill line accurate; exports/tsdown/package.json wired.
