import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
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
  // The <details>/<summary> click rule and element checks of Accordion and Collapsible.
  "internal/details-summary.mjs",
  // Every Collapsible part and its context are client modules (design/components/collapsible.md,
  // summary row 8).
  "collapsible/collapsible-context.mjs",
  "collapsible/collapsible-root.mjs",
  "collapsible/collapsible-trigger.mjs",
  "collapsible/collapsible-panel.mjs",
  // Every Tabs part and its context are client modules (design/components/tabs.md, 13.1).
  "tabs/tabs-context.mjs",
  "tabs/tabs-root.mjs",
  "tabs/tabs-list.mjs",
  "tabs/tabs-tab.mjs",
  "tabs/tabs-panel.mjs",
  "tabs/tabs-indicator.mjs",
  "tabs/use-until-found.mjs",
  "internal/action/use-controllable-action.mjs",
  "internal/action/use-connected.mjs",
  "internal/use-dev-warning.mjs",
  "internal/use-render.mjs",
  // Every Tooltip part is a client module (design/components/tooltip.md, 2.4 and 12.1).
  "tooltip/tooltip-context.mjs",
  "tooltip/tooltip-root.mjs",
  "tooltip/tooltip-trigger.mjs",
  "tooltip/tooltip-popup.mjs",
  "tooltip/use-tooltip-interaction.mjs",
  "tooltip/tooltip-arrow.mjs",
  // Every HoverCard part and its context are client modules (design/components/hover-card.md,
  // Decisions 17).
  "hover-card/hover-card-context.mjs",
  "hover-card/hover-card-root.mjs",
  "hover-card/hover-card-trigger.mjs",
  "hover-card/hover-card-popup.mjs",
  "hover-card/use-hover-card-interest.mjs",
  // The resolved-placement observer shared by Tooltip, Popover and Menu (conventions 13.2).
  "internal/overlay/use-resolved-placement.mjs",
  // Switch, Checkbox and the shared native-input machinery (design/components/switch.md row 25,
  // checkbox.md C10, conventions 3.8).
  "switch/switch.mjs",
  "checkbox/checkbox.mjs",
  "internal/form/use-form-reset.mjs",
  "internal/form/use-native-checked.mjs",
  // Every Dialog part and its context are client modules (design/components/dialog.md, 14).
  "dialog/dialog-context.mjs",
  "dialog/dialog-root.mjs",
  "dialog/dialog-trigger.mjs",
  "dialog/dialog-popup.mjs",
  "dialog/dialog-close.mjs",
  "dialog/dialog-form.mjs",
  "dialog/dialog-title.mjs",
  "dialog/dialog-description.mjs",
  // Every AlertDialog part and its context are client modules (alert-dialog.md 8).
  "alert-dialog/alert-dialog-context.mjs",
  "alert-dialog/alert-dialog-root.mjs",
  "alert-dialog/alert-dialog-trigger.mjs",
  "alert-dialog/alert-dialog-popup.mjs",
  "alert-dialog/alert-dialog-title.mjs",
  "alert-dialog/alert-dialog-description.mjs",
  "alert-dialog/alert-dialog-cancel.mjs",
  "alert-dialog/alert-dialog-action.mjs",
  "alert-dialog/alert-dialog-form.mjs",
  "internal/form/use-native-group-reconciliation.mjs",
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
  "internal/overlay/use-overlay-root.mjs",
  "internal/overlay/use-popover-popup.mjs",
  "internal/overlay/use-apply-open-state.mjs",
  "internal/overlay/use-popover-trigger.mjs",
  "internal/overlay/use-exit-animation.mjs",
  // Every Menu part, its context and helpers, and the hooks it shares with Popover, Dialog and
  // Tooltip (design/components/menu.md 13.1, "Directive").
  "menu/menu-context.mjs",
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
  "internal/action/use-action-trigger.mjs",
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
  "internal/form/use-native-select-value.mjs",
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
  "combobox/use-combobox-text.mjs",
  "internal/use-active-option.mjs",
  "combobox/combobox-keyboard.mjs",
  // The listbox machinery Combobox and MultiSelect share (multi-select.md B.15).
  "internal/use-option-registry.mjs",
  "internal/use-deferred-leave.mjs",
  "internal/action/use-multiple-selection.mjs",
  // Every MultiSelect part and its context are client modules (design/components/multi-select.md
  // B.13).
  "multi-select/multi-select-context.mjs",
  "multi-select/multi-select-root.mjs",
  "multi-select/multi-select-label.mjs",
  "multi-select/multi-select-trigger.mjs",
  "multi-select/multi-select-value.mjs",
  "multi-select/multi-select-popup.mjs",
  "multi-select/multi-select-list.mjs",
  "multi-select/multi-select-option.mjs",
  "multi-select/multi-select-group.mjs",
  "multi-select/multi-select-keyboard.mjs",
  // Every Toast part and its context are client modules; the manager is not
  // (design/components/toast.md 13 and 17).
  "toast/toast-context.mjs",
  "toast/toast-viewport.mjs",
  "toast/toast-root.mjs",
  "toast/toast-title.mjs",
  "toast/toast-description.mjs",
  "toast/toast-action.mjs",
  "toast/toast-close.mjs",
  "toast/use-toast-pauses.mjs",
  "toast/use-toast-focus.mjs",
  "toast/use-toast-announcements.mjs",
  "internal/overlay/use-modal-registration.mjs",
  // Every Slider part and its context are client modules (design/components/slider.md,
  // decision 12 and 14.1 "Directive").
  "slider/slider-context.mjs",
  "slider/slider-root.mjs",
  "slider/slider-label.mjs",
  "slider/slider-track.mjs",
  "slider/slider-indicator.mjs",
  "slider/slider-thumb.mjs",
  "slider/slider-value.mjs",
  // Every Field and Form part, their shared contexts and hooks are client modules
  // (design/components/field-form.md, decision 12 and 14).
  "field/field-root.mjs",
  "field/field-label.mjs",
  "field/field-control.mjs",
  "field/field-description.mjs",
  "field/field-error.mjs",
  "form/form-root.mjs",
  "form/form-submit.mjs",
  "internal/form/field-context.mjs",
  "internal/form/use-field-control.mjs",
  "internal/form/use-form-owner-event.mjs",
  "internal/form/form-status-watcher.mjs",
  // Progress and Meter: the contexts and the four parts that read them are client modules; the
  // Roots are not (design/components/progress.md 8.1 and 12.1 "Directive").
  "progress/progress-context.mjs",
  "progress/progress-track.mjs",
  "progress/progress-indicator.mjs",
  "progress/progress-label.mjs",
  "progress/progress-value.mjs",
  "meter/meter-context.mjs",
  "meter/meter-track.mjs",
  "meter/meter-indicator.mjs",
  "meter/meter-label.mjs",
  "meter/meter-value.mjs",
  // Every ToggleGroup and Toolbar part, their contexts and the roving engine
  // (design/components/toggle-group.md section 13).
  "toggle-group/toggle-group-context.mjs",
  "toggle-group/toggle-group-root.mjs",
  "toggle-group/toggle-group-item.mjs",
  "toolbar/toolbar-root.mjs",
  "toolbar/toolbar-separator.mjs",
  "internal/toolbar-context.mjs",
  "internal/use-roving-focus.mjs",
  // Every NumberField part and its context are client modules (design/components/number-field.md
  // 10, 15).
  "number-field/number-field-context.mjs",
  "number-field/number-field-root.mjs",
  "number-field/number-field-label.mjs",
  "number-field/number-field-input.mjs",
  "number-field/number-field-increment.mjs",
  "number-field/number-field-decrement.mjs",
  "number-field/use-step-button.mjs",
  // Every OTPField part and its context are client modules (design/components/otp-field.md 10).
  "otp-field/otp-field-context.mjs",
  "otp-field/otp-field-root.mjs",
  "otp-field/otp-field-input.mjs",
  "otp-field/otp-field-slot.mjs",
  // Button (design/components/button.md 11, row 20).
  "button/button.mjs",
  // The context menu region (design/components/context-menu.md 7, 13.1 "Directive").
  "menu/menu-context-trigger.mjs",
  // The CSP provider and its context (conventions 12, wave 11).
  "csp/csp-provider.mjs",
  "internal/csp-context.mjs",
];

const directiveFreeFiles = [
  "index.mjs",
  // Pure DOM helpers and constants of the overlays (conventions 7.1).
  "menu/menu-dom.mjs",
  "menu/menu-hover.mjs",
  "menu/menu-outside.mjs",
  "menu/menu-gestures.mjs",
  "menu/menu-point.mjs",
  "dialog/dialog-dismiss.mjs",
  "internal/overlay/overlay-show.mjs",
  "toast/toast-queue.mjs",
  "toast/toast-hotkey.mjs",
  "toast/toast-timers.mjs",
  "toggle/index.mjs",
  "accordion/index.mjs",
  "collapsible/index.mjs",
  "internal/action/action-details.mjs",
  "tabs/index.mjs",
  "tabs/tabs-ids.mjs",
  "tooltip/index.mjs",
  "hover-card/index.mjs",
  "switch/index.mjs",
  "checkbox/index.mjs",
  "dialog/index.mjs",
  "alert-dialog/index.mjs",
  "radio-group/index.mjs",
  "checkbox-group/index.mjs",
  "internal/form/sync-presence.mjs",
  "popover/index.mjs",
  "menu/index.mjs",
  "select/index.mjs",
  "combobox/index.mjs",
  "multi-select/index.mjs",
  // Typeahead of Menu and MultiSelect, and the hidden form values of the set-valued Roots.
  "internal/typeahead.mjs",
  "internal/form/hidden-values.mjs",
  "internal/overlay/anchor-position.mjs",
  "toast/index.mjs",
  "toast/toast.mjs",
  "internal/overlay/modal-registry.mjs",
  "internal/overlay/focus-visible.mjs",
  "internal/overlay/invokers.mjs",
  "slider/index.mjs",
  // Pure arithmetic (design 15).
  "slider/slider-arithmetic.mjs",
  "field/index.mjs",
  "form/index.mjs",
  "internal/form/validity.mjs",
  "internal/form/focus-first-invalid.mjs",
  // The announcer: `ariaNotify()` only (number-field.md 8.3).
  "internal/announce.mjs",
  // Directive-free Roots that render their client context's provider, and the pure modules they
  // use (design/components/progress.md 8.1).
  "progress/index.mjs",
  "progress/progress-root.mjs",
  "meter/index.mjs",
  "meter/meter-root.mjs",
  "meter/meter-region.mjs",
  "internal/range-value.mjs",
  "internal/render-element.mjs",
  // The standalone Separator reads no context (design/components/separator.md 7).
  "separator/index.mjs",
  "separator/separator.mjs",
  "internal/dev-warn.mjs",
  // The rejection fallback and the `on*` handler rule (conventions 2.1, 2.4).
  "internal/action/report-dropped.mjs",
  "internal/action/call-urgent-handler.mjs",
  "toggle-group/index.mjs",
  "toolbar/index.mjs",
  "number-field/index.mjs",
  // Pure formatting, parsing and arithmetic (number-field.md 15).
  "number-field/number-field-format.mjs",
  "number-field/number-field-arithmetic.mjs",
  "internal/decimal.mjs",
  // The filter and the charset table (otp-field.md 10).
  "otp-field/index.mjs",
  "otp-field/otp-field-filter.mjs",
  "button/index.mjs",
  // The CSP subpath's entry and data, and Tooltip's skip-delay constants (conventions 12).
  "csp/index.mjs",
  "csp/style-hashes.mjs",
  "tooltip/tooltip-warm.mjs",
];

/** Files a release removed; a stale build must not keep shipping them (button.md row 20). */
const removedFiles = ["toolbar/toolbar-button.mjs", "toolbar/toolbar-button.d.mts"];

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

  it.each(removedFiles)("%s no longer exists", (file) => {
    expect(existsSync(resolve(dist, file))).toBe(false);
  });
});

/**
 * A directive-free Root may render a provider of a context created in a client module
 * (conventions 7.1's second exception) and must import nothing else from a client module, so a
 * refactor cannot quietly pull `useRender` into it (design/components/progress.md 12.1).
 */
const src = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directiveFreeRoots = [
  { root: "progress/progress-root.tsx", context: "progress/progress-context.ts" },
  { root: "meter/meter-root.tsx", context: "meter/meter-context.ts" },
];

function resolveSource(from: string, specifier: string): string {
  const base = resolve(dirname(from), specifier.replace(/\.js$/, ""));
  for (const candidate of [`${base}.ts`, `${base}.tsx`]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`cannot resolve ${specifier} from ${from}`);
}

/** Every relative module `file` reaches through runtime (non-`import type`) imports. */
function runtimeImportGraph(file: string, stopAt: string): Set<string> {
  const seen = new Set<string>();
  const visit = (current: string) => {
    if (seen.has(current)) return;
    seen.add(current);
    if (current === stopAt) return;
    const code = readFileSync(current, "utf8");
    for (const match of code.matchAll(
      /^(?:import|export)\s+(?!type\b)[^;]*?from\s+"(\.[^"]+)";/gms,
    )) {
      visit(resolveSource(current, match[1]!));
    }
    for (const match of code.matchAll(/^import\s+"(\.[^"]+)";/gm)) {
      visit(resolveSource(current, match[1]!));
    }
  };
  visit(file);
  return seen;
}

describe("directive-free Roots", () => {
  it.each(directiveFreeRoots)(
    "$root reaches no client module but its context",
    ({ root, context }) => {
      const graph = runtimeImportGraph(resolve(src, root), resolve(src, context));
      const clients = [...graph]
        .filter((file) => /^"use client";/.test(readFileSync(file, "utf8").trimStart()))
        .map((file) => relative(src, file));
      expect(clients).toEqual([context]);
    },
  );

  // A directive-free part with no context at all (design/components/separator.md 7).
  it.each(["separator/separator.tsx", "separator/index.ts"])(
    "%s reaches no client module",
    (file) => {
      const graph = runtimeImportGraph(resolve(src, file), "");
      const clients = [...graph]
        .filter((path) => /^"use client";/.test(readFileSync(path, "utf8").trimStart()))
        .map((path) => relative(src, path));
      expect(clients).toEqual([]);
    },
  );
});
