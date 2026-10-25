# Wave 19: Why page, home page, SKILL.md, AI agents guide (#136, #135)

Branch `docs/136-why`.

## Decisions
- `/why` "Why FUNSTACK UI": first sidebar item (Introduction), header nav "Why", primary hero button.
  Structure: six "No X" cards (each links to its concept page) / before-after Toggle /
  comparison table by approach (no library names) / for, not for / next.
- Home: hero buttons Why + Get started (dropped "Learn the concepts"; the principle cards now link
  to concept pages). "What it is" paragraph folded into "Try it". Browser support moved under Install.
- `/guides/ai-agents`: new `/guides/` prefix. The two older guides still live under `/concepts/`;
  moving them would break links, left as is.
- llms.txt/.md URLs are written as code on absolute https URLs, so checkLinks does not need
  dev-134's outputs to exist on this branch.
- `.principles` CSS renamed to `.card-list` (shared by home and Why).

## Verified facts used
- Installer: @funstack/skill-installer 1.1.0 copies with fs.cp (overwrites, so re-running updates);
  SKILL_INSTALL_PATH is only read when stdin is not a TTY.
- Pure triggers (ignore clicks while pending): Button, Dialog.Close, Menu.Item.
- Tooltip root has no open props (delay, closeDelay, disabled, provides).

## Open
- Bundled docs layout under dist/docs (asked dev-134); SKILL.md only names index.md.
