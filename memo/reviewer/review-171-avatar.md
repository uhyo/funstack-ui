# Review: #171 Avatar + Scroll areas recipe (feat/171-avatar @ 27a5ed8f)

Reviewer, 2026-11-26. Verdict: **merge after minor fixes** (no blocker; the fixes are docs/test).

## Ran
- jsdom + jsdom-isolated: 97 files, 4537 tests pass (after `pnpm build`; directives rows need dist).
- Browser (Chromium, Firefox 157; WebKit lacks host libs locally): avatar + scroll recipe, 28 pass / 2 skipped (engine branches).
- Throwaway probe (deleted, not committed): 404 URL -> error, unreachable host -> error, lazy off-screen stays loading,
  loaded -> broken -> back to cached src -> loaded, src swap -> loaded. All pass Chromium + Firefox.
- BCD 8.1.11 (2026-11-26): every number in the two support tables matches. timeline-scope is Chrome 116 (page implies 115).
  `::-webkit-scrollbar` Firefox 153-154 partial (supports() true), removed 155; iOS supports the selector, display:none only.

## Conformance (OK)
- No `onLoad` rendered by the library; native listeners via a stable merged ref; consumer onLoad passes through and the
  browser row shows it disables the commit wait. Matches react-dom maySuspendCommit.
- Status: layout effect reads complete/naturalWidth, decode() for complete+0 width, events gated on img.complete, decode
  result dropped by source, release on unmount/source removal. Urgent setState only. Hydration without mismatch.
- a11y: alt required; role=img + aria-label or aria-hidden; inner img alt="". Owned keys omitted from types.
- Conventions rows 1.1, 2.6, 4.1, 5.1 item 3, 5.3; skill line; props tables match the types.
- Sidebar: Components > Layout is right (precedent "Context menu (Menu)"; Concepts is principles, not recipes).

## Findings
1. (minor, a11y) scroll-area.css:38-54 + 96-99, ScrollAreaNotes.tsx:41-46: the mask fades the focusable scroller's own
   inset focus outline at the edges with content beyond (the ring vanishes over ~2rem top/bottom). Page advises a
   :focus-visible outline (ScrollAreaPage.tsx:148-150) without the caveat. Fix: draw the ring on the frame
   (`.frame:has(> .scroll-area:focus-visible)`) or note it on the page.
2. (minor, docs) AvatarPage.tsx:293-296 / avatar.md 6: the fade-in recipe hides the image while data-status=loading, so a
   src change fades the old picture out to the initials, contradicting avatar.md 4 ("unseen"). Fix: say so, or scope it.
3. (minor, test) scroll-area-recipe.browser.test.tsx:83-91: gutter row passes trivially where bars take no space
   (Playwright Firefox forces none; overlay bars). Fix: assert offsetWidth-clientWidth > 0 where classic bars exist, else
   branch explicitly as the other rows do.
4. (minor, test) avatar.browser.test.tsx:96-102: the only real error is a decode failure (blob). Add a 404 row (network
   error path; probe passes Chromium/Firefox).
5. (nit) ScrollAreaPage.tsx:127-128 "the same engine versions": timeline-scope is Chrome 116. ScrollAreaPage.tsx:139
   "Chrome (since 132)": Chrome 130 release notes say default-on in 130, blog says pushed to 132; cite one.
6. (nit) ScrollAreaPage.tsx:77-80: `@supports not selector(::-webkit-scrollbar)` excludes iOS Safari, where the
   pseudo only takes display:none, so iOS gets neither styling. Mention it.
7. (info) avatar-image.tsx:63-66: an error queued for an old source can be taken for a new source that is synchronously
   complete (memory-cached). Practically unreachable; no change needed.
