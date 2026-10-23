# Review: wave 13, zero-JS docs (#19, #94)

Branch `wave13/zero-js-docs`, commit dc98ab5 on 3a3341e, docs only. Reviewed 2026-10-23
against `docs/research/zero-js-variants.md` (summary, sections 1, 4, 5), `design/conventions.md`
7.3 and resolved question 38 (ca93bf7), the component design docs' #19 / #94 notes, and the
component sources for API consistency.

**Verdict: acceptable with minor fixes.** The new Server Components section and the five recipes
are accurate. Remaining problems are pre-existing docs text that the new definition now
contradicts, one recipe missing from the design's list, and one accessibility gap in a recipe.

## Verified accurate

- JS-free definition (`ServerComponentsPage.tsx:56`): "no behaviour JS on the native path; works
  before and without hydration; not 'no client bundle'", matching conventions 7.3 word for word.
  The examples it names exist: Accordion and Dialog both have JS-free modes, and the native
  Tooltip path does too.
- Size figures (`ServerComponentsPage.tsx:67`): 76 KB gzip runtime; +5.1 / +5.0 / +3.8 / +1.9 KB
  rounded to 5 / 5 / 4 / 2; "less each when several share internals" (+10.3 combined). Matches
  research section 1. The other-hosts sentence keeps the research's "not measured" caveat.
- The never-hydrated paragraph (`:74`) matches research summary item 3. The "#19 considered and
  not built" sentence matches question 38. The page links to all five component routes.
- Switch recipe: `role="switch"` on a native checkbox inside a label. The `switch` attribute is
  Safari 17.4+ only and not standards-track (checked: BCD 8.1.7, `html.elements.input.switch`,
  chrome/firefox false, safari 17.4, `standard_track: false`). react-dom drops `true` for an
  unknown attribute, so the `switch=""` advice is right.
- Checkbox recipe: the `indeterminate` explanation is correct, and `aria-checked` is not allowed
  on a native checkbox, so script really is the only route.
- Slider recipe: the pseudo-element claims are correct (only Gecko has `::-moz-range-progress`).
  "No library handling of vertical and RTL arrow keys" matches `slider.md` 7 (the Firefox
  vertical and WebKit RTL normalisations).
- NumberField recipe: "no announcement of each step" matches `number-field.md` 8.3
  (`ariaNotify`). Press-and-hold, `format` and locale parsing are all real component features.
- Progress / Meter #94 notes: the cause (server `useId` restarting per Flight render, no
  `identifierPrefix` in `defer()`) and both links are correct.

## Must-fix

1. **The Progress intro still promises no client bundle.** `packages/docs/src/pages/ProgressPage.tsx:31`
   says "It needs no JavaScript at all: `Progress.Root` has no `"use client"`".
   - Why it is wrong: Track, Indicator, Label and Value are client modules. Research section 1
     measured +1.9 KB gzip for this exact anatomy, on top of the 76 KB runtime.
   - Why it matters: conventions 7.3 (ca93bf7) says the library does not promise "no client
     bundle, and the docs must not either". This sentence conflates "directive-free Root" with
     "no JS", which is the misreading the new Server Components section was written to correct.
     A reader comparing the two pages gets opposite answers.
   - Suggested wording: "No behaviour JavaScript: `Progress.Root` has no `"use client"`, so a
     Server Component renders it on the server (the small parts still ship; see Server
     Components)."

## Should-fix

1. **The Roadmap page still lists #19 as deferred, with the rejected wording.**
   `packages/docs/src/pages/RoadmapPage.tsx:204` reads "Directive-free (truly zero-JS) variants of
   platform-native parts (#19)" under "Deferred".
   - #19 is resolved as "none" (question 38), and "truly zero-JS" is the claim the new definition
     rejects.
   - Fix: remove the item, or replace it with "a directive-free Accordion
     (`@funstack/ui/accordion/native`) is a ready plan, not scheduled". Optionally add
     uhyo/funstack-static#198 to the page's "Upstream" list.

2. **The Select recipe is missing.** Conventions question 38 lists recipe pages for "Switch,
   Checkbox, RadioGroup, Slider, NumberField, Select". `design/components/select.md:55` (row 16)
   says "the JS-free select from a Server Component is a real `<select>`, a recipe on the docs
   page".
   - The commit adds no recipe to `SelectPage.tsx`, and the Server Components paragraph (`:74`)
     lists only five pages.
   - Fix one side. Either add a Plain HTML section to the Select page (a labelled `<select name>`;
     it gives up the action, pending state, Field and Suspense options; research section 4 row
     Select), or drop Select from question 38 and from select.md row 16. Research option A listed
     five pages, so the second is also defensible.

3. **The RadioGroup recipe omits `aria-required` on the group.** `RadioGroupPage.tsx:387`
   renders `<fieldset role="radiogroup">` with `required` on the first radio.
   - The component deliberately adds `aria-required="true"` to the fieldset when `required`
     (`radio-group-root.tsx:94-98`; `radio-group.md:426,440`, citing the APG radiogroup pattern),
     so the group itself is exposed as required.
   - Without it, a screen reader on the group (rather than an individual radio) gets no "required"
     cue. The recipe is presented as equivalent markup minus the library extras, but it is less
     accessible.
   - Fix: `<fieldset role="radiogroup" aria-required="true">`. `aria-required` is allowed on
     `radiogroup`.

## Nits

1. **Progress/Meter notes** (`ProgressPage.tsx:314`, `MeterPage.tsx:227`).
   - "The Root's server-generated label id" applies only when the Root is rendered by a Server
     Component; a Root inside a client component gets a client `useId` (`_R_…`, unaffected).
     Say "a `Progress.Root` rendered by a Server Component inside `defer()`".
   - Two deferred payloads can also collide with each other, not only with the main payload.
   - If a workaround is confirmed (rendering the Root from a client component), add it. Note that
     `aria-label` is **not** a workaround: the Root always references `${id}-label`, and
     `aria-labelledby` wins whenever a colliding element exists.

2. **"Reconciliation ... with your state" listed as a loss** (`SwitchPage.tsx:~305`,
   `CheckboxPage.tsx:291`, `RadioGroupPage.tsx`). A plain input has no React state to reconcile
   with, so this is not something the recipe gives up. Consider "no React state that tracks it
   (pre-hydration clicks and form resets are reflected only in the DOM)".

3. **The Switch recipe's styling hint** (`SwitchPage.tsx:~296`). Styling a checkbox as a switch
   needs `appearance: none` first; worth three words. Also, "so it is not needed here" reads as a
   non sequitur after the support sentence. Suggest "`role="switch"` already gives the semantics;
   the attribute only changes the look".

4. **The Server Components page** (`:58`). "The native Tooltip path" is JS-free only in Chromium
   (`interestfor`). A parenthetical "(Chromium)" keeps the definition honest. Since wave 12 the
   path also has one passive `beforetoggle` listener, which is styling rather than behaviour; that
   fits the definition, but say so if the page ever lists what runs.

5. **The Accordion intro** (`AccordionPage.tsx:22`). "Without value props it needs no JavaScript
   at all" has the same overclaim as must-fix 1, milder: its behaviour needs none, but its parts
   ship (+5.1 KB). Align the wording with the Server Components definition.
