import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards conventions 7.2: the unbundled build keeps each client file's "use client" directive,
 * and directive-free files (index files, JS-free primitives) do not gain one.
 *
 * Runs over `dist`, so `pnpm build` must precede `pnpm test:run` (turbo wires this up).
 */
const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist");

const clientFiles = [
  "toggle/toggle.mjs",
  // Every Accordion part is a client module (design/components/accordion.md, section 12).
  "accordion/accordion-context.mjs",
  "accordion/accordion-root.mjs",
  "accordion/accordion-item.mjs",
  "accordion/accordion-trigger.mjs",
  "accordion/accordion-panel.mjs",
  // Every Tabs part and its context are client modules (design/components/tabs.md, 13.1).
  "tabs/tabs-context.mjs",
  "tabs/tabs-root.mjs",
  "tabs/tabs-list.mjs",
  "tabs/tabs-tab.mjs",
  "tabs/tabs-panel.mjs",
  "tabs/tabs-indicator.mjs",
  "internal/use-until-found.mjs",
  "internal/use-controllable-action.mjs",
  "internal/use-dev-warning.mjs",
  "internal/use-render.mjs",
  // Every Tooltip part is a client module (design/components/tooltip.md, 2.4 and 12.1).
  "tooltip/tooltip-context.mjs",
  "tooltip/tooltip-root.mjs",
  "tooltip/tooltip-trigger.mjs",
  "tooltip/tooltip-popup.mjs",
  "tooltip/use-tooltip-interaction.mjs",
  // Switch, Checkbox and the shared native-input machinery (design/components/switch.md row 25,
  // checkbox.md C10, conventions 3.8).
  "switch/switch.mjs",
  "checkbox/checkbox.mjs",
  "internal/use-form-reset.mjs",
  "internal/use-native-checked.mjs",
  // Every Dialog part and its context are client modules (design/components/dialog.md, 14).
  "dialog/dialog-context.mjs",
  "dialog/dialog-root.mjs",
  "dialog/dialog-trigger.mjs",
  "dialog/dialog-popup.mjs",
  "dialog/dialog-close.mjs",
  "dialog/dialog-form.mjs",
  "dialog/dialog-title.mjs",
  "dialog/dialog-description.mjs",
  // TODO(RadioGroup): add "internal/use-native-group-reconciliation.mjs" once RadioGroup.Root
  // imports it; the unbundled build only emits files reachable from an entry.
];

const directiveFreeFiles = [
  "index.mjs",
  "toggle/index.mjs",
  "accordion/index.mjs",
  "internal/action-details.mjs",
  "tabs/index.mjs",
  "tabs/tabs-ids.mjs",
  "tooltip/index.mjs",
  "switch/index.mjs",
  "checkbox/index.mjs",
  "dialog/index.mjs",
];

function startsWithUseClient(file: string): boolean {
  const path = resolve(dist, file);
  if (!existsSync(path)) {
    throw new Error(`${path} does not exist; run \`pnpm build\` before \`pnpm test:run\`.`);
  }
  return /^"use client";/.test(readFileSync(path, "utf8").trimStart());
}

describe("built files", () => {
  it.each(clientFiles)('%s starts with "use client"', (file) => {
    expect(startsWithUseClient(file)).toBe(true);
  });

  it.each(directiveFreeFiles)('%s does not start with "use client"', (file) => {
    expect(startsWithUseClient(file)).toBe(false);
  });
});
