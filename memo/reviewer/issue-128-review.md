# Review: #128 wave 18 docs consolidation (origin/docs/128-wave18)

Commits 9e8e2b5, 8430e57, df97ef2, 997a3c3. Read-only fact check against packages/ui/src, tests,
and release notes 0.1.0-alpha.12/13/14. Line numbers are on the branch.

Verdict: **merge after fixes** (all text edits, S). No component fact contradicts the source except
F1; the rest are precision losses or nits. Anchors: the build's checkLinks.ts verifies fragments and
CI is green; no remaining `#invoker-command` link anywhere in the repo; new ids (popup-triggers,
invoker, foreign-invoker, other-openers, styling, browser-notes, accessibility-rules) are unique per
page.

## Findings

1. (Medium) BrowserOwnedStatePage.tsx:215-217 "A disabled Trigger that stays focusable (it renders
   aria-disabled) is no invoker either". True for Popover/Menu (use-popover-trigger.ts:178,
   render-element.ts:111, overlay-disabled-render-suite.tsx:120-124), false for Combobox.Trigger:
   combobox-trigger.tsx ref writes `popovertarget` whenever the element is a BUTTON, whatever
   `disabled` is, so a disabled component render (aria-disabled) is an invoker after hydration and
   renders no aria-expanded. Harmless in effect (every click is cancelled), and untested (Combobox
   is not in describeOverlayDisabledRenders). Fix the text (scope to Popover/Menu, or "Combobox's
   Trigger keeps popovertarget; its click is always cancelled"), and file a repo issue asking
   whether Combobox should follow the shared invoker rule.

2. (Low) BrowserOwnedStatePage.tsx:43 and :210: "Invoker" is defined as "A `<button>`" and "Only a
   <button> can be an invoker". HTML also makes `<input type=button|reset>` invokers, and the library
   treats them as foreign invokers (#126 release note; combobox.test.tsx:2338). Conversely a
   disabled button or a submit button in a form is not one (#126). Say "Only a <button> can be the
   Trigger's invoker" and widen the term ("a button (or input type=button/reset)").

3. (Low) BrowserOwnedStatePage.tsx:237-238 "A component that keeps focus in its popup does not lose
   it when you press a foreign invoker". The #126 guard is in menu-popup.tsx and combobox-popup.tsx;
   Combobox keeps focus in its Input, not its popup. Say "keeps focus in its popup or input"
   (Menu, Combobox).

4. (Low, lost fact at concept level) BrowserOwnedStatePage.tsx:105-107 and
   PendingOptimisticPage.tsx:188-191: the mirrored read was named as "the Combobox input and
   non-button triggers"; now both link to #popup-triggers, which covers Triggers only. The Combobox
   Input's aria-expanded (from the shown listbox) is no longer named on any concept page (still on
   ComboboxPage). Add one sentence to #popup-triggers or keep "and the Combobox input" in the
   Browser-owned paragraph.

5. (Low, lost fact) "omitted from the props type" dropped from the owned lists: PopoverPage.tsx:260,
   MenuPage.tsx:286, MenuPage.tsx:~509 (SubmenuTrigger), ComboboxPage.tsx:374. Source still omits
   commandfor, command, popoverTarget, popoverTargetAction (and aria-expanded) from all four props
   types; "owned" alone does not imply it (e.g. `disabled` is owned and typed). Suggest "Owned,
   never written and not in the props type: ...".

6. (Low) ComboboxPage.tsx:374 lists `popovertarget` (written) and `popoverTarget` (never written)
   side by side; reads as a contradiction. Source: the attribute is set through the ref after
   hydration, the React prop is forced undefined. Say "never written as a prop" or merge into one
   entry.

7. (Low) RoadmapPage.tsx:45-57 (#121): two release-note facts dropped. (a) "A Trigger rendered as
   some other element through render keeps aria-expanded": a migrating user with link Triggers needs
   it. (b) The `[commandfor]` selector migration: dropping the wrong `[popovertarget]` advice
   (Combobox gets it only after hydration) is right, but give the replacement ("use [data-open] or
   a class").

8. (Low) Roadmap completeness. All listed items match the release notes (#127, #126, #125, #121,
   #110/#112, #118, #116, #115, #113, the three alpha.13 breaking props, #108, #102). Not listed but
   user-noticeable: #123 (a press on the Combobox input while open no longer closes the listbox),
   #105 (Slider/NumberField superseded rejection surfaces at once), #111, #113 Toast arrow keys in a
   text field. The audit memo decided bug fixes are out; fine if intended, but #123 is as
   noticeable as #108, which is listed.

9. (Nit) MenuPage.tsx:512 "renders aria-expanded=\"false\"" for a disabled SubmenuTrigger: source
   renders `ctx.shown` (use-popover-trigger.ts:199), which is false in practice. "renders
   aria-expanded from the shown submenu" is exact. No test asserts that a disabled SubmenuTrigger
   has no popovertarget / has aria-expanded (menu.test.tsx:337 checks aria-disabled only): test gap.

10. (Nit) ContextMenuPage.tsx:436 header is now "Hook / On / Meaning", but rows include props
    (`side`, `align`) and an owned handler (`onContextMenu`), which are not hooks. Pre-existing
    content; header change makes it more visible.

## Checked and correct

- Concept #popup-triggers bullets vs source: popovertarget only on an invoker; no aria-expanded on
  an invoker; non-button library mode renders shown; light dismiss before the click, reported
  "activate", not awaited, no veto, no exit (popover.browser.test.tsx:1195-1250); one Trigger per
  Root dev warning (#113); data-open optimistic in library mode, written from toggle in JS-free.
- Foreign invokers: open routed via beforetoggle -> requestOpen (use-popover-popup.ts:304-320);
  close "activate" via ToggleEvent.source / command (325-385); Dialog awaits (dialog-popup.tsx:351).
- Popover restructure: Foreign invokers and Hover card moved verbatim to #other-openers; styling CSS
  and data-side text moved verbatim to #styling; RTL/Firefox exit/iOS notes moved to
  #browser-notes; JS-free non-button still covered at PopoverPage.tsx:79.
- Dialog modal/lightDismiss rewording and Close/Trigger "command (not on a link or other non-button
  host element)" match use-overlay-close.ts:94-95.
- Menu.Trigger onMouseDown note matches menu-trigger.tsx:137; MenuTriggerProps omits onMouseDown.
- ContextMenu rule links resolve (Callout id).
