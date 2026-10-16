# Reviewer memo: Tabs (#11), 2026-10-16

Reviewed master at cc5fa30 (Tabs from 5792bfd..de3e58f) against `design/conventions.md` and
`design/components/tabs.md` as of ef83b97 (reason vocabulary `activate`/`platform`, dev warning
decided). `pnpm build`, `pnpm test:run` (285 tests, three uncached runs, no flakes),
`pnpm typecheck`, `pnpm lint` pass. `dist/tabs/{context,root,list,tab,panel,indicator}.mjs` and
`internal/use-until-found.mjs` start with "use client"; `tabs/index.mjs`, `tabs-ids.mjs` do not;
exports map has `./tabs`.

Verdict: **acceptable with minor fixes** (two medium behaviour bugs with small fixes, two
PO-decided items not yet applied, augmentation shipping, test gaps).

## Probes (scratch jsdom + browser-mode tests and a Playwright script; all deleted)

1. until-found + slow action: dispatch `beforematch`, browser removes `hidden`, then any re-render
   while pending re-sets `hidden="until-found"` (browser mode: `["until-found","until-found",
   "until-found",null]`). Cause: `active: untilFound && !selected` ignores optimistic. Fix:
   `active = untilFound && !selected && ctx.optimistic !== value`; rejection still re-hides
   because optimistic reverts. Design 5.3 "re-assert after every render while selected is false"
   is the wrong rule.
2. `value` matching no Tab (controlled, e.g. Tabs-as-links on a sub-route, design 11.5): no tab has
   tabindex 0 and the List has none either, so Tab skips the whole tablist.
3. Controlled veto leaves focus on the unselected tab; a later focusin (window re-activation,
   focus restore) dispatches again. `autoFocus` on an unselected tab dispatches on mount.
4. value=null: clicking empty list area selects the first tab (automatic). Shift+Tab from a tab
   stops on the List once (manual). Not a trap.
5. Rapid arrows, automatic, suspending panels: no fallback, D pending, only a and d ever commit.
6. keepMounted: hidden panel's effects clean up on hide, never run while hidden.
7. SSR: keepMounted panel absent, until-found panel `hidden=""`; hydration upgrades, 0 errors.
8. render `<a>`: owned keys win (element id/aria-disabled/data-selected/tabIndex stripped), but
   `type="button"` lands on the anchor (same pattern in Toggle).
9. No warning without value/defaultValue (PO decision 15 not implemented).
10. Superseded rejection through the platform (`beforematch`) path reaches the boundary.
11. Real Chromium click (automatic): exactly one dispatch, `event.type === "focusin"`.
12. Playwright on the built example: all three sections behave; `startViewTransition` receives
    `types: ["fsui-tabs","fsui-tabs-next"|"-prev"]` (patched to record); emulated find selects
    Changelog. Real text fragment (`#:~:text=zebra` on goto) did not select it: unverified.
13. Augmentation shipping: rename to `internal/platform-attributes.ts` (+ `export {}`) and
    `import "./internal/platform-attributes.js"` from index files. tsdown emits
    `dist/internal/platform-attributes.d.mts` + `import` in `index.d.mts`, no runtime import.
    `import type {}` emits nothing.

## Design / conventions text proven wrong

- tabs.md 5.3: re-assert rule (probe 1) and the "both panels visible" window claim.
- conventions 3.4: direction "from `details.event.currentTarget`" (nativeEvent.currentTarget is
  React's root container); Tabs looks tabs up by id.
- conventions 5.1 first paragraph lists Indicator among parts that render `<ViewTransition>`;
  5.2 mentions an Indicator `transitionName` prop. Both contradict tabs.md 10.1.
- conventions 5.1 code sample `hidden={!selected}` on tabpanel is stale.
- conventions 7.4: a `.d.ts` source file cannot ship via tsdown; must be a `.ts` side-effect import.
- conventions 2.2: devtools example `reason: "click"` uses a non-vocabulary value.
- tabs.test.tsx comment: spec fires `beforematch` before removing `hidden`, not after.
