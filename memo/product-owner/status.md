# Product owner status log

## 2026-10-15 — project kickoff
- Vision gathered from user → docs/vision.md (committed bc23920).
- Team defined in .claude/agents: platform-researcher, architect, developer, reviewer.
- Backlog seeded: issues #1–#14 (labels: infra, research, design, component, docs, a11y).
- Wave 1 (running in parallel): #1 scaffold (developer), #2 popover/anchor research, #3 React async APIs research, #4 platform survey.
- Next: when research lands → commit docs/research, then architect for #5 conventions, then #6 Toggle design → #10 implement → reviewer.
- Note: GitHub MCP server fails auth in this session; use `gh` CLI for issues.
- User request: push to GitHub regularly. Policy: push after every commit (PO and developer agents).
- Wave 1 complete: #1 scaffold, #2 popover/anchor, #3 React async APIs, #4 platform survey — all committed & pushed, issues closed.
  - Key outcomes: zero-JS tooltip is Chromium-only (interestfor); positioning/animation JS-free everywhere. Action errors need useTransition (not bare startTransition). Overlapping transitions → last-commit-wins. <details> for Accordion. hidden=until-found needs React workaround (#16).
- Architect running #5 conventions. Next: component designs #6–#9 (can run in parallel once conventions land), then implement Toggle (#10) → review.
- #5 conventions accepted (5b3ecfd + follow-up). User confirmed: <state>ChangeAction triple, on* pass-through, experimental_ props.
  Load-bearing rule: trigger parts render optimistic state, content regions render committed state.
- Dependabot PR #15 merged (user approved). PR merges need user approval in this environment.
- Wave 2 running: #6 toggle, #7 tabs, #8 accordion, #9 tooltip designs (4 architects in parallel); research-react re-verifying transition entanglement.
- Next: review designs → implement Toggle (#10) first as proving ground → reviewer → then Tabs/Accordion/Tooltip.
- All four designs done (#6–#9). User agreed v0 does not target fully-no-JS (#19 deferred).
- User is away (going to bed, 2026-10-15 evening JST). HOLD QUESTIONS until they return; decide autonomously, log decisions here, batch questions for next check-in.
- Plan while away: Toggle impl (#10) → reviewer → fix; then Tabs (#11), Accordion (#12) impls (parallel, separate dirs); #18 browser mode infra; then Tooltip (#13); #17 result → conventions update; docs site (#14) once ≥2 components exist.
- Questions batched for user: (none yet)
- #17 resolved: details.event served via Proxy (virtual, non-own) so Server Functions can be passed directly. Decided autonomously.
- Questions batched for user: (1) confirm the Proxy-based details.event design (alternative: no event in details at all, React-action style; or plain {event} that only works accidentally via temporaryReferences).
- Toggle (#10) implemented & pushed (ed6a1e2..589150b), 50 tests. CI was red on format (design/*.md) → fixed ignore globs (f67f405), gitignored .claude/worktrees.
- Running: review-toggle (reviewer), impl-accordion (#12, worktree), infra-browser-mode (#18, worktree).
- Lesson: never run `pnpm format` at root while agent worktrees exist under .claude/worktrees (it reformatted the worktree's docs; reverted).
- Toggle review: acceptable w/ minor fixes. Notable: (a) Action return type must be `unknown`; (b) React swallows a superseded overlapping action's rejection → PO decision: hook stores & rethrows from render; (c) merge-props had element/pass-through precedence backwards. Fixes dispatched to impl-toggle; doc fixes to architect.
- 2026-10-16: usage limit hit overnight. User: only decision-making agents stay Fable → developer, reviewer, platform-researcher switched to opus. architect + product-owner remain fable.
- 2026-10-16 morning: #18 browser mode merged (c8f848a) and closed; doc corrections from Toggle review committed. Running (opus): toggle-fixes (master), accordion-impl (worktree agent-aa1eb49fd5259ba32). Tabs (#11) starts after toggle-fixes lands to avoid shared-internal churn.
- Accordion (#12) merged c66167e (161 tests total); review-accordion running (opus). tabs-impl running (opus, worktree). Next: Tooltip (#13) after Tabs; docs site (#14).
- Tabs (#11) merged (284 tests total). Accordion review fixes landed (owned keys in mergeProps; latestInFlight() on hook). Next: review Tabs (opus) → fixes; then Tooltip (#13); docs site (#14).
- Decision: reason vocabulary unified — "activate" (user) / "platform" (browser-initiated: find-in-page, pre-hydration). Tabs' "find" → "platform".
- Tabs review: acceptable w/ minor fixes. Decisions: until-found stays revealed while pending; List becomes tab stop when controlled value matches no tab (+dev warning); focus-driven dispatch only when relatedTarget is inside the List; type="button" only on real buttons (Toggle too). tabs-fixes (opus) running on master; tooltip-impl (opus) in worktree; architect patching docs.
- Manual check needed by user (batched): real find-in-page (Ctrl+F) on the Tabs demo's until-found panel and on Accordion — headless Chromium can't exercise it.
- Tabs fixes landed (305 tests). docs-site (#14, opus, worktree) started; tooltip-impl (opus, worktree) running. After Tooltip: review → fixes → merge docs → consider first release prep (version 0.0.x, release-funstack skill like siblings) — ask user.
- Batched for user: (2) release plan / npm publish of @funstack/ui 0.0.1? (3) docs deployment target (Cloudflare like siblings?).
- 2026-10-16 ~10:20 JST MILESTONE: v0 scope complete — Toggle, Tabs, Accordion, Tooltip implemented + reviewed + review-fixed; docs site merged (#14). 409 tests (jsdom + Chromium). Open: #16 upstream, #19/#20/#21 deferred, #23 cross-engine.
- Started #23 (opus, worktree). Batched for user: Proxy details.event confirm; release plan; docs deployment; manual find-in-page check; #16 upstream filing.
- 2026-10-16 user decisions: (1) Proxy-served details.event CONFIRMED — Server Functions passed directly is an important feature. (2) release-funstack skill OK. (3) docs deploy to ui.funstack.work (Cloudflare). (4) Upstream issues (#16) are a HUMAN task — never file autonomously.
- release-setup (opus) running: publish.yml, deploy-docs.yml, wrangler, skill, package metadata.
- #23 merged; CI green on chromium/firefox/webkit (run 38835425057). Release/deploy setup done (user must add secrets, npm trusted publisher, CF custom domain). v0 backlog empty except deferred #19/#20/#21 and human #16.
- Next: propose roadmap for the next component wave to user.
- WAVE 2 approved by user: Dialog + Switch + Checkbox/Radio, fully autonomous pipeline. Issues #24–#32. Research first (opus), then designs (fable architect), impl/review (opus).
- Wave 2 designs accepted: switch.md, checkbox.md, radio-group.md; conventions 3.8 shared native-input machinery (useFormReset / useNativeChecked / useNativeGroupReconciliation). #27/#28 closed; #33 CheckboxGroup deferred.
- switch-checkbox-impl (#30, opus, worktree) running — builds the shared hooks. RadioGroup impl (#31) starts after it merges (hook dependency). design-dialog (fable) running.
- 2026-10-16 ~11:30 JST: USAGE LIMIT reached again. State at stop:
  - Switch/Checkbox (#30) MERGED 62c17da (679 tests), NOT yet reviewed. Dialog design (#26) committed & accepted.
  - No agents running (all finished). Remaining wave 2: review Switch/Checkbox → fixes; implement RadioGroup (#31, hooks ready); implement Dialog (#29); docs pages (#32).
  - Doc follow-ups for architect: conventions 2.2 add reason "dismiss" + details.returnValue (Dialog); 4.2 caveat (Chromium doesn't match :checked when indeterminate); 3.8 rule 3 group clarification (no re-apply in mount commit); switch.md §10 (augmentation lacks `switch`).
  - Human tasks: jsdom checkbox canceled-activation bug (report upstream); find-in-page manual check; release/deploy secrets.
- 2026-10-16 resumed. Running: review-switch-checkbox (opus), radio-group-impl (#31, opus, worktree), dialog-impl (#29, opus, worktree), architect doc follow-ups (dismiss reason etc.). User away; proceed autonomously.
- Dialog (#29) merged aed025c (846 tests). Switch/Checkbox fixes landed (onItemMounted API). Running: review-dialog, radio-group-impl merging master, accordion-flake fix, research-vt-mount (#35), architect doc updates.
- RadioGroup (#31) merged 07f8cc9 (959 tests). All wave-2 components on master. Running: review-dialog, review-radio-group, accordion-flake, research-vt-mount (#35), docs-wave2 (#32, worktree), architect doc updates.
- 2026-10-16 ~17:00 JST: USAGE LIMIT reached. #35 conditional ViewTransition branch merged to master (pushed). In-flight (will stall): dialog-fixes (master, review fixes H1/M1-M3/L1-L4), radio-group-fixes (master, uncommitted hook edits in tree), docs-wave2 (#32, worktree agent-a8f5c68aadcab75ea), architect doc batch (Dialog review corrections; uncommitted design/ edits in tree).
  - Next session: commit/collect those; verify full suite on master; close #35; merge docs; fix Tabs intermittent test ("value matching no tab" — #36 scope); close #32.
- 2026-10-16 ~17:10 JST: USAGE LIMIT (2nd). Committed architect's RadioGroup+Dialog review doc corrections; merged final #35 test commit (a7140ae). Uncommitted in tree: radio-group-fixes' in-progress edits (use-native-checked, use-native-group-reconciliation, radio-group/*). dialog-fixes also in progress on master. docs-wave2 in worktree agent-a8f5c68aadcab75ea. Next: collect those, full suite, close #35, merge docs, #36 Tabs flake.
- 2026-10-16 ~17:20 JST: USAGE LIMIT (3rd). RadioGroup fixes landed (d416152). Docs wave 2 merged (#32 closed). #35 closed. dialog-fixes STILL in progress on master (uncommitted edits in dialog/*, dialog-shim, browser-user). Next: collect dialog fixes, full suite, close #36 Tabs flake, update switch/checkbox/radio-group design status + owned-key text (disabled, form), then consider first release.
- 2026-10-17 resumed. Dialog fixes landed (0ce1e8f..86bfa2c). User: (1) CI keeps failing → fix; (2) after current wave finishes, USER will publish first version as ALPHA and deploy docs to Cloudflare.
  - CI root cause: only `browser (webkit)` fails since RadioGroup merge — 2 radio-group native-keyboard tests expect arrow wrap; WebKit native radios don't wrap at ends. Developer (opus) fixing + #36. Architect (opus... agent def) folding Dialog deviations / wave-2 status into design/.
  - Alpha release plan: when CI green + docs folded, report wave 2 complete; suggest version 0.1.0-alpha.0 (publish.yml → dist-tag "alpha"). Remind one-time setup (npm trusted publisher — package must exist first, so first publish may be manual; CF secrets; custom domain).
- 2026-10-17: CI GREEN on all 4 jobs. WebKit radio fix 4451fe0 (native no-wrap/no-RTL-mirror asserted; docs note). #36 closed b9f92a9 (shared act-wrapped setupUser; browser suites on browser-user.ts; Tabs flake not reproduced — reopen if seen). Design folds fa11e39, 710027b (+ tabs/accordion type alias pending).
- Docs deploy: user set up Cloudflare Workers Builds themselves; deploy-docs.yml removed (b5ea82c). Site live at ui.funstack.work.
- Version bumped to 0.1.0-alpha.0 (6cbe7c1), LICENSE shipped in package (8cf21ac). USER publishes first version by hand (npm trusted publisher can only be set after package exists). After that: optional GitHub release (publish.yml will fail harmlessly as version exists).
- WAVE 2 COMPLETE. Next: propose wave 3 to user. Open: #33 CheckboxGroup, #19/#20/#21 Tooltip deferred, #16/#34 human upstream.
- WAVE 3 approved by user: Popover + Menu (+ CheckboxGroup #33 side item). Issues: #37 research, #38 design Popover, #39 design Menu, #40 impl Popover, #41 impl Menu, #42 roadmap page. Running: research #37 (opus), architect CheckboxGroup design #33, developer roadmap #42. Next: Popover design after research.
- 2026-10-17: USER PUBLISHED @funstack/ui 0.1.0-alpha.0 by hand (dist-tags: latest+alpha → 0.1.0-alpha.0; also an old 0.0.0-stage exists). No GitHub release yet (offered). Trusted publisher setup is the user's next one-time step.
- GitHub release 0.1.0-alpha.0 created (prerelease, target 8cf21ac). Publish run skipped (version exists) → success; OIDC untested until next release. User set up trusted publisher.
- #37 research done (4d39f7c): popover=auto + commandfor/toggle-popover + implicit anchor + <dialog popover aria-modal=false> baseline; focusgroup=menu experimental; interestfor submenus / native menu elements not yet. Filed #43 (focusgroup check bug — dev fixing), #44 (human upstream: Chromium dialog-popover AX modal, WebKit 302008/317926), #45 (context menu deferred).
- CheckboxGroup design accepted (03b595f, 2c2cd02; PO accepted all 8 recommendations). Impl running in worktree. Popover design (#38) running (architect); PO answers: Q6 context menu out; Q4 VT wraps top-layer element (Dialog close-animation = follow-up); Q1/2/3/5 architect decides.
- #43 fixed 253650f (native focusgroup path needed nomemory/focusgroupstart/no tabindex). CheckboxGroup merged (db8299d..f08773f), 1197 tests, CI green incl. webkit; review running.
- Popover design 9f4d928: PO accepted all 8 recommendations; #46 filed (Dialog VT exit for library-driven close). Popover impl (#40) running in worktree; architect accepting popover.md then designing Menu (#39).
- CheckboxGroup review (bb71ce8): H1 Firefox form-restore of Parent → autocomplete=off; M1 uncontrolled reset; M2 PO DECISION: Parent ignores disabled Items (toggle + derived state over enabled Items). Fixes running on master (developer). Design corrections to architect after Menu design.
- Menu design 50d4cee: PO accepted all 11 recommendations (close after action settles; checkable items stay open; always library mode; hover timers; etc.). #47 useActionTrigger follow-up. Menu impl (#41) waits for Popover merge. Architect: accept menu.md, then fold CheckboxGroup review into design.
- CheckboxGroup fixes landed (a58143a, 0cfc3e8, 1bd9430), CI green; design folded f6ac453. Incident: git mv in shared index swept into architect commit → CI red on 50d4cee/d48a743/24c7917; rule added to CLAUDE.md + developer.md (git commit <paths>).
- #33 closed. Popover (#40) merged (670db7b..c9c82db), 1424 tests; CI 39006036945 watching (first WebKit). Running: Popover review; Menu impl (#41+#47) in worktree on top of popover hooks.
- Popover CI green incl. WebKit (dialog popover focus works there). Review af064d8: H1 focus→body on lib close w/ transition (shared hook), M1 double VT on dismissal, M2 superseded rejection (→ #47 Menu dev), L1 dead focus fallback, L3 PO DECISION: stale Close action must not close a re-opened popover (open generation). Fixes running on master; Menu dev briefed. Design corrections → architect after fixes.
- Popover fixes landed 35e57e1..1cb5854 (CI green). Hook API: wrapContent, openGeneration. #38/#39/#40 closed. Menu dev briefed; architect folding popover review into design.
- 14:58 USAGE LIMIT. Menu (#41) + useActionTrigger (#47) MERGED & pushed (1599 tests chromium/firefox; first WebKit CI run pending — watch submenu/H1/div-popover autofocus rows). Next: check CI, review Menu, fixes, architect fold (menu deviations 1-6; dialog.md ~1594 superseded-rejection gap now closed), close #41/#47, then wave 3 done → propose next (e.g. #46 Dialog VT close, 0.1.0-alpha.1 release via skill — first OIDC publish test).

## 2026-10-17 (resumed after usage refill)
- Menu merge CI green on all 3 engines (incl. first WebKit run).
- Reviewer launched on Menu + useActionTrigger (#41/#47), writing memo/reviewer/menu.md, with verdicts on developer deviations 1-6.
- Next: fixes → architect fold → close #41/#47 → wave 3 done → propose next (#46, alpha.1 = first OIDC publish).
- Menu review: H1 (WebKit focus ring after pointer open, CI red) + M1-M3 + L1-L6 fixed (02f2f42, fa4908c, d4deae8). CI green all 3 engines at d4deae8. Architect fold 1783f7f, plus a small follow-up fold in progress (pointer-open quiet focus exception, Q6 settled: WebKit 302008 no hang).
- Closed #41, #47. Filed #48 (stable root hook values), #49 (test leftovers). WAVE 3 DONE.
- Next: ask the user, alpha.1 release (first OIDC publish) vs next wave.
- Flaky Dialog JS-free re-open row was a real race (toggle queued) → count at beforetoggle (03ab818); design 774d1be.
- RELEASED 0.1.0-alpha.1 (98bac72, prerelease). First OIDC publish WORKED (provenance signed). npm: alpha=0.1.0-alpha.1, latest still 0.1.0-alpha.0 (manual first publish set latest). Ask the user whether to move latest or deprecate 0.0.0-stage (human npm action).
- Wave 4 started: #50 Select/Combobox; platform-researcher writing docs/research/select-combobox.md.
- Select: researched (e620cd2), designed + accepted (230086e, 50228e4; PO: no warning without value/defaultValue), implemented + merged (1114850..ba1f6e5), CI green all 3. Review 5a2acad: H1 adopt overwrites a pick, M1 reset target with "" placeholder; fix pass running on master; architect folding the review into select.md.
- Combobox: designed + accepted (c000b43, 7349e2d). USER decided: English default announce string, overridable (first built-in string; conventions §11). Developer implementing in a worktree.
- Issues: #51 (upstream React/Chromium + iOS check), #52 (Chromium selectedcontent reset bug, upstream).
- Select COMPLETE: review fixes e4aab3b..2c8871c (CI green all 3), design fold 79b7393. Combobox implementation still running (worktree).

## 2026-10-17 — Wave 4 COMPLETE (#50 closed)
- Combobox review fixes 5d92f41..bb8db8f; CI green on all 3 engines. Design nits folded in 49687f8 (aria-labelledby types; autoHighlight side effect accepted).
- User went to bed; working decision-free items autonomously: #48 (stable root hooks), #49 (test leftovers) in developer worktrees.
- Pending user decisions: 0.1.0-alpha.2 release (Select + Combobox); next wave (#46 Dialog VT exit, Tooltip #19-21, #45 context menu, #53); human screen-reader pass for Combobox.

## 2026-10-17 — alpha.2 released; wave 5 started
- User: "When Wave 4 is completed, please release a new alpha. For the next wave, new components if possible, otherwise polish."
- 0.1.0-alpha.2 released (69aeb80); the publish workflow succeeded.
- Wave 5 (#54): Toast, Slider, Field/Form. Research #55 is in progress with the platform-researcher.
- In flight: #48 and #49 (developers in worktrees), #46 Dialog VT exit design (architect).

## 2026-10-18 — wave 5 progress
- #48 merged and reviewed (a53bf23); follow-ups merged in 22607ac (the Accordion ItemContext deviation was accepted and folded in 705c40e). #49 and #56 closed. #57 is the Tooltip roving-tabindex false-positive warning.
- #46: the Dialog design amendment (1251efa) was accepted in 1b98656 with all 3 recommendations. A developer is implementing it, together with #48 review items 4 and 5.
- Research #55 is closed. #58 holds the upstream reports, a human task.
- Toast design 3cf4192, accepted in ff840c3 with all 9 recommendations. Amendment: a server-side toast() is a no-op and never buffered. The architect is applying the conventions amendments next.
- The Slider design is in progress with a second architect, who must not edit conventions.md.

## 2026-10-18 — usage limit reached mid-wave
- Done: #46 implemented (97effd1), review fixes 56e1ea8..bcdb7e1 (CI green). Toast merged (03404ef). The Slider design was accepted (d009da0, 40f3511); I made decisions 1, 2 and 8 autonomously and still need to report them to the user.
- In flight when the limit hit:
  - the Slider developer (worktree);
  - the Field/Form architect;
  - the #46 design-fold architect;
  - the Toast reviewer.
  Check their outputs and branches on resume.
- Toast browser row "animates the enter; holds ... data-ending" flaked once under load. The reviewer was asked to assess it.

## 2026-10-18 (after the reset)
- User complaint: CI failures flood GitHub notifications. Policy from now on:
  - Merges must pass the gate in a clean temp worktree before pushing (done for Slider, Field).
  - WebKit-sensitive fixes go to a work branch first: push the branch, `gh workflow run ci.yml --ref <branch>` (workflow_dispatch added in 441eb87), and fast-forward master only when all four jobs are green.
  - Batch doc/memo commits; tell agents to make a single commit per task.
- Docs deploy now matches FUNSTACK repos (2f91ea1): wrangler.toml prod via deploy-docs.yml on release; wrangler-dev.toml for Workers Builds. User must add CLOUDFLARE_API_TOKEN/ACCOUNT_ID secrets and repoint Workers Builds to the dev worker.
- Wave 5 state: Toast (fixes + fallback ada1cba, design folded), Slider (merged, fixes 3b96bcb/8fffbca/330ba8c, WebKit rollback row red -> fix on branch), Field/Form merged e172925 (review running). Issues: #59 Dialog.Form errors, #60 Slider-Field, #62 flakes (Firefox serial fix), #63 Toast leftovers, #64 useExitAnimation baseline.

## 2026-10-18 — alpha.3 released; wave 6 started
- 0.1.0-alpha.3 released: publish run and Deploy Docs succeeded; npm alpha=0.1.0-alpha.3. #54 closed.
- User: "Let's proceed with Wave 6." Tracker #69. Components: ToggleGroup/Toolbar (#66), NumberField (#67), Progress/Meter (#68); research #65.
- Polish in parallel: #57 + #64 (one developer), #63 (one developer). #59 goes to the architect once Field/Form design questions are in hand.
- Every code change goes to a work branch with branch CI green before master (see the CI policy above).
- #59 design accepted (6d13aa2: closeOnSettle error-aware under Form.Root, dev warning); impl running (worktree).
- Research #65 done (497920a). PO answers: (a) aria-pressed for single ToggleGroup; (b) NumberField w/o spinbutton role accepted, roledescription architect's call; (c) Toolbar wrap + Menu.Trigger in toolbar: architect's call; (d) Progress/Meter on divs, not native. Upstream human-task #70.
- Designs running in parallel: toggle-group.md (owns conventions.md), number-field.md, progress.md.
- Polish done: #59 (32611fd, 8cbde22, fold 6f648e6), #63 (94fbcd4, fa2f399; L6/L8 left by decision), #57 (5fc2d4d), #64 (0228d8d). Master CI green.
- Filed an issue for load-sensitive timing flakes (transition-boundary in Firefox, Menu exit in Chromium).

## 2026-10-18 — usage limit hit mid-wave 6, resumed

impl-toolbar, impl-progress, design-toolbar (conventions from Progress) and design-numberfield were interrupted by the session limit; all four resumed via SendMessage after the reset.

## 2026-10-18 — wave 6 done, 0.1.0-alpha.4 released

- Shipped: ToggleGroup/Toolbar (#66), NumberField (#67) and Progress/Meter (#68). Each went through design, implement, review, fixes and design fold.
- Fixed flakes: the Dialog.Form settle test (b2fc473) and the NumberField Firefox wheel test (509c87f).
- Release: 0.1.0-alpha.4 (00cc075). publish.yml and deploy-docs.yml are both green.
- Open follow-ups:
  - #71: browser timing flakes
  - #72: docs build should fail on RSC errors
  - #73: human checks (Next.js, screen readers)
  - #74: Toolbar native radios; direction accepted; probe native Tab from a radio first; next wave
  - #75: Tooltip role=group check
  - #77: NumberField browser rows and announce.ts migration
- Open question: should NumberField validity follow the draft? The Firefox bubble and :user-invalid persist while the user types a fix. The architect says leave it; it was raised with the user.
- Wave 7 candidates: #74, #72 and #77; new components are still to be chosen.

## 2026-10-18 — wave 7 (#78) in progress; usage limit hit

- Done:
  - #72 docs RSC guard (0f12348). The upstream report text is linked from #70.
  - #77 NumberField browser rows (cc0451f). The announce.ts migration was skipped: the directive rule forbids the import, and it would change behaviour.
  - #74/#75 design finalized and accepted (0473012).
- Running at the limit; resume both with SendMessage:
  - impl-toolbar: implementing #74/#75 on branch wave7/toolbar-radios.
  - impl-flakes: #71 on branch wave7/flakes. The Popover exit row was added to its scope.
- Left: finish both, close #78, release 0.1.0-alpha.5.

## 2026-10-18 — wave 7 done, 0.1.0-alpha.5 released
- After the limit reset, both agents were resumed with SendMessage.
  - Fold 0780386.
  - #71 fixed with test-only commits 99a5713 and 9e8a629. Root causes:
    - The wall-clock "not delayed" rows now assert `document.__reactViewTransition` / `activeViewTransition`.
    - The exit-animation rows now hold a 60 s CSS exit and call `finish()` on it.
- Closed: #71, #78. Release 0.1.0-alpha.5 (bump 2669c42); publish and deploy green. The npm dist-tag view lagged right after publishing.
- User suggestion: a Button with an action and pending state → #79 (filed). PO view: yes; reuse internal/use-action-trigger; never disabled while pending (like Form.Submit); type="button". Planned as wave 8 unless the user wants it sooner.
- Next: wave 8 = Button (#79). It needs research (aria-busy, re-entry), an architect design, then the usual pipeline.
- The user asked to file the FUNSTACK Static issue → uhyo/funstack-static#194 (build exits 0 on RSC/prerender errors). Noted on #70. Other upstream items stay human tasks; the FUNSTACK family repos are OK to file in when the user asks.

## 2026-10-18 — wave 8 (#80) Button
- Research af1993f. The architect's draft (design/components/button.md plus conventions edits) is uncommitted in the main checkout; the architect hit the Fable limit.
- User: wait for the Fable reset (don't switch models); remove Toolbar.Button now; include focusableWhenDisabled.
- PO: staged re-entry rollout (follow-up issue for Dialog.Close, Popover.Close, Menu.Item), no opt-out prop.
- On reset: SendMessage design-button with these decisions → commit → implement → review.
