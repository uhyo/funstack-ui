# Quick reference at the top of component pages? (#212, dogfood F2)

2026-11-29. Recommendation only; nothing implemented.

## The suggestion

F2: the bundled Markdown is 1.3 MB (`combobox.md` 70 KB, `dialog.md` 50 KB, `menu.md` 49 KB). The
agent used "the Anatomy sections plus the first example" and asked for a per-page "Quick reference"
(anatomy plus a minimal example) at the top.

## How pages start today

`page-standards.md` section 1: intro, hero `Example` (full source plus its CSS), `BehaviourIndex`,
then `## Anatomy`. Every component page has an Anatomy except the scroll-area recipe, which has no
component. The Anatomy already is a quick reference: a JSX skeleton with every part, the element
each renders (as comments) and the main props, followed by bullets.

The problem is where it sits in the Markdown edition. The hero's source and CSS come first, so the
Anatomy starts deep in the file (line of `## Anatomy` / total lines):

| Page | Anatomy at | Lines | Bytes |
| --- | --- | --- | --- |
| combobox.md | 316 | 982 | 70 121 |
| context-menu.md | 293 | 523 | 31 805 |
| drawer.md | 280 | 633 | 34 281 |
| alert-dialog.md | 256 | 576 | 33 238 |
| field.md | 250 | 971 | 58 718 |
| multi-select.md | 249 | 623 | 39 994 |
| menu.md | 221 | 673 | 49 316 |

Most of those lines are the hero's demo CSS (combobox: lines 130-314).

## Recommendation

1. **Do not add a new "Quick reference" section.** It would repeat the Anatomy, and two copies of
   the parts list drift apart (rule 2: the reference page owns its facts once).
2. **Move the Anatomy up in the Markdown edition only.** In `src/markdown/`, emit the Anatomy
   section (heading, skeleton, bullets) right after the intro and before the hero example. The
   HTML page keeps its order (a person scans the live demo first; an agent reads top-down and
   stops early). The skill already tells agents that a page "starts with an example and its
   Anatomy"; update that sentence if the order changes.
3. **Keep the Anatomy bullets short.** Some are paragraphs (Combobox "Two states", "No portal, no
   positioner" with a Chromium iframe note). Those belong under How it works or Browser notes;
   the Anatomy bullets should be one or two sentences each, like the skill's component index.
4. **Keep the hero CSS.** The dogfood agent pasted it almost as is (F1 workaround, "What was
   pleasant"). It just should not come before the Anatomy.

Pilot on Combobox, Field and Menu (the largest), measure the Anatomy offset again, then roll out.
This is a converter change plus a page-standards amendment (section 1 gets a note on the Markdown
order), so it needs the PO's go-ahead.
