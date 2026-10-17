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
  "internal/use-native-group-reconciliation.mjs",
  // Every RadioGroup part and its context are client modules (design/components/radio-group.md,
  // decision 12 and 13.1).
  "radio-group/radio-group-context.mjs",
  "radio-group/radio-group-root.mjs",
  "radio-group/radio-group-label.mjs",
  "radio-group/radio-group-item.mjs",
  // Every CheckboxGroup part and its context are client modules
  // (design/components/checkbox-group.md, decision 13 and 14.1).
  "checkbox-group/checkbox-group-context.mjs",
  "checkbox-group/checkbox-group-root.mjs",
  "checkbox-group/checkbox-group-label.mjs",
  "checkbox-group/checkbox-group-item.mjs",
  "checkbox-group/checkbox-group-parent.mjs",
  // Every Popover part, its context and the hooks Menu shares are client modules
  // (design/components/popover.md, decision 12 and 14).
  "popover/popover-context.mjs",
  "popover/popover-root.mjs",
  "popover/popover-trigger.mjs",
  "popover/popover-popup.mjs",
  "popover/popover-close.mjs",
  "popover/popover-title.mjs",
  "popover/popover-description.mjs",
  "internal/use-popover-root.mjs",
  "internal/use-popover-popup.mjs",
  "internal/use-popover-trigger.mjs",
  "internal/use-exit-animation.mjs",
  // Every Menu part, its context and helpers, and the hooks it shares with Popover, Dialog and
  // Tooltip (design/components/menu.md 13.1, "Directive").
  "menu/menu-context.mjs",
  "menu/menu-dom.mjs",
  "menu/menu-hover.mjs",
  "menu/menu-root.mjs",
  "menu/menu-trigger.mjs",
  "menu/menu-popup.mjs",
  "menu/menu-item.mjs",
  "menu/use-menu-item.mjs",
  "menu/menu-checkbox-item.mjs",
  "menu/menu-radio-group.mjs",
  "menu/menu-radio-item.mjs",
  "menu/menu-group.mjs",
  "menu/menu-submenu-trigger.mjs",
  "internal/use-action-trigger.mjs",
  // Every Select part, its context and helpers, and the select machinery
  // (design/components/select.md decision 16 and 15.1).
  "select/select-context.mjs",
  "select/select-dom.mjs",
  "select/select-root.mjs",
  "select/select-trigger.mjs",
  "select/select-value.mjs",
  "select/select-option.mjs",
  "select/select-group.mjs",
  "select/select-group-label.mjs",
  "select/select-separator.mjs",
  "internal/use-native-select-value.mjs",
  "internal/use-hydrated-mount.mjs",
  "internal/use-delayed-pair.mjs",
  // Every Combobox part and its context are client modules (design/components/combobox.md,
  // decision 15 and 12.1 "Directive").
  "combobox/combobox-context.mjs",
  "combobox/combobox-root.mjs",
  "combobox/combobox-label.mjs",
  "combobox/combobox-input.mjs",
  "combobox/combobox-trigger.mjs",
  "combobox/combobox-clear.mjs",
  "combobox/combobox-popup.mjs",
  "combobox/combobox-list.mjs",
  "combobox/combobox-option.mjs",
  "combobox/combobox-group.mjs",
  // Every Slider part and its context are client modules (design/components/slider.md,
  // decision 12 and 14.1 "Directive").
  "slider/slider-context.mjs",
  "slider/slider-root.mjs",
  "slider/slider-label.mjs",
  "slider/slider-track.mjs",
  "slider/slider-indicator.mjs",
  "slider/slider-thumb.mjs",
  "slider/slider-value.mjs",
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
  "radio-group/index.mjs",
  "checkbox-group/index.mjs",
  "internal/sync-presence.mjs",
  "popover/index.mjs",
  "menu/index.mjs",
  "select/index.mjs",
  "combobox/index.mjs",
  "internal/anchor-position.mjs",
  "slider/index.mjs",
  // Pure arithmetic (design 15).
  "slider/slider-arithmetic.mjs",
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
