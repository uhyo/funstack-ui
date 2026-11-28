# FRICTION.md: Helpdesk on @funstack/ui 0.1.0-alpha.30

App: FUNSTACK Static 1.3.5 (`entries` mode, `ssr: true`) + FUNSTACK Router 1.6.0 + React 19.3.1, Vite 8.4, TypeScript 7.0.2.
Each entry renders the same `<Router routes ssr={{ path }}>`, so every page is pre-rendered and client navigation goes through the Navigation API.

Severity: **blocker** / **bug** / **docs** / **DX** / **nit**.

## Onboarding

### F1. `npm install @funstack/ui` (no tag) installs a 30-release-old alpha (nit/docs)

- Doing: checking dist-tags before install.
- Found: `latest` → `0.1.0-alpha.0`, `alpha` → `0.1.0-alpha.30`. Getting Started says "there is no `latest` release yet", which is not true on the registry: someone who forgets `@alpha` gets alpha.0 silently, with no warning. Related: `npm view @funstack/ui@alpha readme` prints nothing, because the registry readme is the `latest` one.
- Docs: README and skill both say `@alpha`, which helped. The "no latest" sentence misleads.
- Fix wanted: point `latest` at the newest alpha (or deprecate alpha.0).

### F2. Skill installer worked the first time (pleasant)

- `SKILL_INSTALL_PATH=.claude/skills pnpm dlx --package @funstack/ui@alpha funstack-ui-skill-installer` → `✓ Skill installed`. No friction. It pulls 5 packages into the dlx cache. FUNSTACK Static's installer does the same.

### F3. The source maps ship the full source (nit, isolation)

- Doing: `grep -rn 'type FormErrors' node_modules/@funstack/ui/dist`. That was a type lookup, but it hit `internal/form/validity.mjs.map`, whose `sourcesContent` is the whole TypeScript source, with comments citing `design/components/field-form.md 7.5` and `memo/developer/field-form.md`.
- Not a problem for users, but internal repository paths show up in a user's grep, and the tarball is bigger than it needs to be. From then on I excluded `*.map` from greps.
### F4. The skill is the right length and stopped real mistakes (pleasant)
- 83 lines. I read it first, then opened component pages for the Anatomy section only. "Things agents get wrong" stopped several mistakes I would have made coming from Radix or Base UI: I would have wrapped actions in `startTransition` (rule 2), swallowed errors with try/catch and so committed the failed value (rule 4), left `whilePending` at its default on Save buttons (rule 8), forgotten `details.valid` (rule 5), and pressed Enter in a Combobox expecting it to pick (rule 13).
- What it lacks is covered under F5, F7, F9 and F10 below.

## Platform / integration

### F5. The dev server loads two copies of @funstack/ui: a Link inside a server-rendered panel never closes it (bug, dev only)
- Doing: the header is a Server Component. `NavigationMenu.Root/Item/Trigger/Popup` are rendered there; the links are a small client component (`NavLink`, which uses `useLocation` for `aria-current`) that renders `NavigationMenu.Link`.
- Expected: following a panel link closes the panel, as the docs say (it did in the production build).
- Happened: under `vite` dev, in Chromium and Firefox, the panel **stayed open** over the new page after a client navigation, and after a plain `#hash` link too. The focus-leave close still worked.
- Cause, from the network log: the parts that come from the server payload load from `node_modules/.pnpm/@funstack+ui…/dist/navigation-menu/navigation-menu-popup.mjs` (the vite-rsc "client-in-server-package-proxy"), while my client module's `import { NavigationMenu } from "@funstack/ui/navigation-menu"` resolves to Vite's pre-bundled `/node_modules/.vite/deps/@funstack_ui_navigation-menu.js`. That makes two module instances and two React contexts, so the Link cannot see its Popup. `toolbar-context`, `field-context` and `use-popover-trigger` also showed up in both forms.
- Docs: nothing. The Server Components page says "every part is a client reference, so this works", which is true only after a production build. No warning fired in development.
- Workaround: `optimizeDeps: { exclude: ["@funstack/ui"] }` in `vite.config.ts`. After that the dev suite passes.
- Wanted: a dev-time check ("NavigationMenu.Link rendered inside a Popup it cannot see"), or a module-identity warning, plus a FUNSTACK Static / vite-rsc note in the Server Components page. This mixed server/client composition is exactly what the docs recommend, so every RSC user will hit it.

### F6. Headless Firefox under Playwright fires no `contextmenu` for Shift+F10 or the ContextMenu key (not a library bug)
- A capturing `contextmenu` listener on `document` sees the event in Chromium (`button: -1`) and nothing in Firefox. I could not verify the keyboard open in Firefox end to end. The test asserts that nothing happened and then dispatches a synthetic `contextmenu` on the focused element: the menu opened, focus went to the first item, and Escape returned focus to the row link.
- Worth a line in the docs' testing notes: anyone who writes this test will think the library is broken in Firefox.

### F6b. WebKit could not run
- `playwright install webkit` downloaded the build, but launching fails with ~25 missing system libraries (`libgtk-4.so.1`, `libgstallocators-1.0.so.0`, `libavif.so.13`, …) and installing them needs root. No WebKit results.

## Mistakes the skill and docs didn't prevent

### F7. Popups inside `<p>` produce invalid HTML and a hydration error (docs)
- Doing: an "updated 2026-11-02" Tooltip and a "?" Tooltip inside an article's byline `<p>`, and on the CSP page a Popover (whose Popup is a `<dialog>`) inside a `<p>`.
- Happened: the production build threw `Minified React error #418` (hydration mismatch) on those pages. The HTML parser closes the `<p>` at the `<div popover>` or `<dialog>`, so the DOM no longer matches React's tree.
- Docs: HoverCard's page warns about exactly this ("Inside running text, render a `<span>` card … a `<div>` cannot follow a link inside a `<p>`"). Tooltip's page shows the same rule only for buttons in a toolbar, and Popover's says nothing. The rule is the same for all three: "Render the Popup right after the Trigger" + `Popup` is a `div` or `dialog` ⇒ never inside phrasing content.
- Workaround: `<Tooltip.Popup render={<span />}>` (it worked: popover and role stay), and a `<div>` instead of `<p>` around the Popover.
- Wanted: the same "inside running text" bullet on Tooltip and Popover, and a skill line next to "render the Popup right after the Trigger".

### F8. Test-writing traps from the trigger's changing label (nit)
- `getByRole("button", { name: "Close" })` stops matching while the button reads "Closing…", so an assertion on `data-pending` polls a locator that no longer resolves. That is my own doing, but every demo uses `{({ pending }) => pending ? "Closing…" : "Close"}`. A short testing note ("match pending buttons by a stable label or `aria-label`") would save time.

## Behaviour findings

### F9. An invalid early return (`if (!details.valid) return;`) commits the invalid value as the rollback target (bug or docs, important)
- Doing: an uncontrolled `TextField` (`minLength={3}`, `required`, in a `Field.Root`) with `valueCommitAction={async (next, details) => { if (!details.valid) return; try { await save(next) } catch { setError(); details.reject(); } }}`. This is the exact pattern from skill rule 5 and the Field page.
- Steps: type "ab" + Enter (invalid: the Field shows the error, nothing saved, correct). Then type "Escalation notes" + Enter with the backend failing.
- Expected: `reject()` puts back the **saved** value, "Untitled draft".
- Happened: it rolled back to **"ab"**. The early return resolved the action, so uncontrolled TextField committed "ab" as its value. And because the value is now set by script, `minLength` no longer flags it (`tooShort` only applies to user edits): the field shows "ab", an invalid value that was never saved, with **no error**.
- Docs: "Uncontrolled, the early return keeps the invalid value in the control and saves nothing." That is true for the server, but the component's own committed value changed. The alternative, `return details.reject()`, reverts immediately and hides the error text the user is fixing.
- Workaround: controlled `value` holding the last saved text, or accept it. My test pins the current behaviour (`tests/flows.spec.ts`, "inline save").
- Wanted: either an invalid dispatch should not commit (keep the draft in the input without moving the uncontrolled "saved" value), or the docs should say plainly that the early return moves the rollback target.

### F10. Combobox `multiple` + `allowCustomValue`: typing a prefix and pressing Enter adds the prefix as a tag (DX)
- Typing "bill" + Enter in the tags box gives a custom chip "bill", not "billing". This is APG manual selection plus `allowCustomValue`, documented separately on two pages (skill rule 13, Free text), but the combination is a trap for a tag picker. Users will create typo tags.
- Workaround: `autoHighlight`, which I found later, or ArrowDown first. The `multiple` section's tag example should probably use `autoHighlight`, or explain the interaction.

### F11. The anchored-popup inline style is blocked for good under a fully strict CSP (docs)
- `/secure` uses the docs' recommended policy (`style-src 'self' <STYLE_SHA256 hashes>; style-src-attr 'unsafe-inline'`): zero violations in Chromium and Firefox, the Popover sits under its trigger, and the context menu opens at the pointer (menu-point stylesheet allowed by its hash).
- `/secure-strict` drops `style-src-attr`: 6 violations at load, and the Popover opens at (0,6) in Chromium and at a wrong spot in Firefox, **permanently**. The docs say "placed by your stylesheet only until React updates the attribute", but hydration never re-writes an unchanged `style`, so in practice it is never placed. One of the six blocked styles is `-webkit-touch-callout:none` on the `Menu.ContextTrigger` region, which the CSP page's table does not list.
- CSPProvider: not usable on a static host (no per-response nonce); hashes were the right tool and `STYLE_SHA256` made it a three-liner. Workaround for fully strict: put `position-area` in your own CSS.

### F12. Dangling ARIA references after hydration (bug, minor)
- After hydration I collected every `aria-describedby`, `aria-labelledby` and `aria-controls` that points at a missing id:
  - `Popover.Popup` (JS-free mode, content always mounted) has `aria-describedby="…-description"` although I render no `Popover.Description`. Field's parts drop references to unmounted parts ("hydration drops the ones that are not there"); Popover does not.
  - Closed `Drawer.Popup` and `AlertDialog.Popup` reference their unmounted Title and Description. That is harmless while closed.
  - `Tabs.Tab` `aria-controls` points at inactive panels that are not mounted, and `Combobox.Input` `aria-controls` points at a list that is not mounted. Common in other libraries too.

### F13. Things that just worked (pleasant, recorded so they stay that way)
- **Server Component navigation.** NavigationMenu in a Server Component with `side={null}` mega panels, Popover (theme) and Accordion (FAQ, `exclusive`) all work with JavaScript disabled in Chromium and Firefox (`tests/nojs.spec.ts`). The theme is CSS `:has(input[name=theme][value=dark]:checked)` on a `RadioGroup`, so it switches without JavaScript too.
- **Plain `href` links.** `NavigationMenu.Link href` plus FUNSTACK Router's Navigation API interception means client navigation without `render={<RouterLink/>}`. The panel closes on the click (production).
- **Rejecting failures.** `details.reject()` in a `Menu.Item` (menu stays open, error toast), an `AlertDialog.Action` (dialog stays, inline alert), a `Switch`, a `Slider` commit (9 → 7 days), a `TextField` and a `Toast.Action` Undo all rolled back with no Error Boundary.
- **Form errors.** `Form.Root error` / `Form.Error` versus `errors[name]` behaved exactly as the table says. The form-level error keeps the values and allows the identical retry. The field error focuses the field with `aria-invalid`. The form resets only on success.
- **Context menus in a table.** `Menu.ContextTrigger render={<tr/>}` inside a `CheckboxGroup.Root` `<fieldset>` with a `<table>` worked: right-click at the point, keyboard open, submenus by ArrowRight, and in RTL the menu's right edge is at the pointer (measured within 4 px).
- **Select-all.** `CheckboxGroup.Parent` mixed state and the APG cycle (mixed → all → none) worked.
- **Toasts.** Toasts with Undo, an Error Boundary around `Toast.Action`, and an urgent `toast()` from inside actions.
- **Console.** No console errors, hydration warnings or library warnings in the production or development build, in either engine, across 25 flows (after the F5 and F7 fixes).

## Docs notes (smaller)

### F14. Getting Started's list of shared types omits `Rejectable` (nit)
- The skill (rule 12) and Action props both use `Rejectable` from `@funstack/ui/types` for a `run(details: Rejectable, …)` helper. It is exported, but Getting Started's list of shared types doesn't include it.

### F15. Some examples wrap the action body in `startTransition` (nit)
- The context-menu `ContextMenuFiles` example's `Menu.Item action={() => rename(file.id)}` calls a `rename` that does `startTransition(() => setFiles(...))` synchronously inside the action. That is harmless but contradicts skill rule 2 ("Don't wrap the action in startTransition"). Only updates after an `await` need it.

### F16. The Markdown docs are big (DX)
- 1.2 MB in total; Combobox 70 KB, Field 60 KB, Menu 49 KB. Each page is useful, but an agent cannot read five components' pages in full. "Anatomy first" in the Markdown edition is the right call. I read Anatomy plus one or two named sections, and every example's CSS is included (with `"same file as above"` pointers, which are hard to follow when only part of a page is read).

## Summary

### What was pleasant
- Actions plus `data-pending` plus `reject()` remove a lot of state plumbing: no `isSaving` flags and no manual rollback anywhere in the app.
- The JS-free story is real. The header, FAQ and theme work with JavaScript off, and the Server Component code reads like plain HTML.
- `Form.Root error` vs `errors` is the clearest split of "request failed" vs "value wrong" I have used.
- The docs are precise and honest about engine gaps.

### How the skill felt
- Length: good (83 lines). Clarity: high. The "Things agents get wrong" list is the most valuable part.
- Missing: (a) never put a Popup inside `<p>` (F7); (b) the dev/RSC duplicate-module trap (F5); (c) `autoHighlight` for tag pickers with `allowCustomValue` (F10); (d) that an invalid early return still commits (F9).

### Top 5 before beta
1. Fix or warn about the duplicate module instance under vite-rsc dev (F5): a silent behaviour difference between dev and production.
2. Decide F9: an invalid early return should not move the uncontrolled rollback target, or the docs and skill must say so.
3. "Inside running text" guidance for Tooltip and Popover, plus a dev warning when a Popup's parent is a `<p>` (F7).
4. Drop references to unmounted Description parts in Popover (F12) as Field already does.
5. Point the npm `latest` tag at the newest alpha (F1), and correct the CSP wording to say the placement is blocked permanently, listing `-webkit-touch-callout` (F11).

### Components I didn't get to
Dialog (only AlertDialog), Collapsible, Toggle (alone), MultiSelect, OTPField (deliberately), Progress, Meter, Avatar, Menubar, Menu.CheckboxItem, Tooltip's `experimental_hint` beyond the CSP page, NavigationMenu library mode, `transition` / `<ViewTransition>` on any part, `keepMounted`, `CSPProvider` with a nonce (not possible on a static host).

## Verification log
- `pnpm exec tsc --noEmit` (TypeScript 7.0.2): passes. `pnpm build`: passes; it writes 9 pre-rendered pages (index, 2 articles, tickets, tickets/new, settings, secure, secure-strict).
- Playwright against `vite preview`, Chromium and Firefox: **54/54 passed**. Suites: smoke on every page, 17 flows, 2 JS-disabled, 2 CSP. The only console errors are the 6 expected CSP violations on `/secure-strict`.
- Playwright against the `vite` dev server (flows + smoke), Chromium and Firefox: 46/46 passed after the F5 workaround (2 failed before it). No library dev warnings and no hydration warnings.
- WebKit: could not launch (F6b).
