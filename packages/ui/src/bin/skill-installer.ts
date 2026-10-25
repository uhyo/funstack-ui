#!/usr/bin/env node
// `funstack-ui-skill-installer`: copies the funstack-ui-knowledge agent skill into the current
// project, for the AI agent the user picks (`SKILL_INSTALL_PATH` skips the prompt).
import { install } from "@funstack/skill-installer";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file (dist/bin/), so it works both from a local install and through
// npx -p / pnpm dlx / yarn dlx.
const skillDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../skills/funstack-ui-knowledge",
);

console.log("Installing skill from:", skillDir);

await install(skillDir);
