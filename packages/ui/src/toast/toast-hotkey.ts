// The Viewport's hotkey (design/components/toast.md 7) and the region name built from it. No
// "use client" directive: pure (conventions 7.1).

export const DEFAULT_HOTKEY: readonly string[] = ["F8"];

const MODIFIER_NAMES: Readonly<Record<string, string>> = {
  altKey: "Alt",
  ctrlKey: "Ctrl",
  metaKey: "Meta",
  shiftKey: "Shift",
};

/** `["altKey", "KeyT"]` → `"Alt+T"`, `["F8"]` → `"F8"`. */
function hotkeyLabel(hotkey: readonly string[]): string {
  return hotkey
    .map((key) => MODIFIER_NAMES[key] ?? key.replace(/^Key(?=[A-Z]$)/, "").replace(/^Digit/, ""))
    .join("+");
}

/** The region's built-in accessible name (conventions 11): `"Notifications (F8)"`. */
export function regionLabel(hotkey: readonly string[] | null): string {
  if (hotkey === null || hotkey.length === 0) return "Notifications";
  return `Notifications (${hotkeyLabel(hotkey)})`;
}

/** The listed keys and modifiers, and no unlisted modifier (Ctrl+F8 is not F8). */
export function matchesHotkey(hotkey: readonly string[], event: KeyboardEvent): boolean {
  const flags = event as unknown as Record<string, unknown>;
  for (const modifier of Object.keys(MODIFIER_NAMES)) {
    if ((flags[modifier] === true) !== hotkey.includes(modifier)) return false;
  }
  return hotkey.every((key) => key in MODIFIER_NAMES || event.code === key);
}
