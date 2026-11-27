# Review: #196 (textarea Ctrl/Cmd+Enter commit), #197 (type="search" warning)

Branch `feat/196-197` (0532200f..a0b5ccd8). Verdict: merge after minor fixes (all doc wording).

Checked: keyDown order (isComposingKey first, then input unprevented, then textarea
ctrl/meta -> preventDefault -> commit) matches text-field.md 4.2; prevent-always holds for no
draft / equal draft / disabled / readOnly; no requestSubmit anywhere. jsdom 166 rows pass,
browser rows pass on Chromium + Firefox (WebKit not launchable here). format/lint/typecheck ok.

Mutation results (jsdom text-field.test.tsx):
- IME guard moved inside the input branch: 4 rows fail. Good.
- preventDefault only with a draft: 2 rows fail. Good.
- metaKey ignored: 9 fail. Shift excluded: 4 fail. Good.
- Alt excluded with Ctrl (`|| event.altKey`): 0 fail. Gap: no Ctrl+Alt+Enter row, though the
  design says "Shift or Alt held as well changes nothing".

Findings:
1. Minor. "Alt+Enter is a new line" (text-field.md 4.2 table and bullets, CHANGELOG rule
   paragraph, docs keyboard table row, code comment text-field.tsx:250, jsdom row title)
   contradicts the CHANGELOG's own probe 1: Ctrl, Cmd and Alt+Enter insert nothing in all
   three engines under Playwright. The code is right (Alt alone is not the field's, not
   prevented); the claim should be "not the field's (the engine's)" or drop Alt from "new line".
2. Minor. Form-level snippet (design 7, TextFieldPage, skill) guards only
   `nativeEvent.isComposing`, not keyCode 229 (WebKit's compositionend-before-keydown), so it
   is weaker than the field's own isComposingKey. Rare with Ctrl held; add `|| event.keyCode === 229`
   or say so.
3. Nit. Missing Ctrl+Alt+Enter row (see mutation above). AltGr on Windows is Ctrl+Alt, so
   AltGr+Enter commits; acceptable but unpinned.
4. Nit. TSDoc lines not rewrapped: text-field.tsx:43, :92 (158-161 cols); browser test
   header line 3 (171 cols) also reads as if NumberField had Ctrl+Enter rows ("..., the same
   for NumberField's Input").
