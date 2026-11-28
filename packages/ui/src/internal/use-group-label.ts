"use client";
import { useId, useLayoutEffect, useMemo } from "react";
import { usePartPresence } from "./use-part-presence.js";

/**
 * What a group (`Menu.Group`, `Menu.RadioGroup`, `Combobox.Group`, `MultiSelect.Group`) gives
 * its GroupLabel: the id to render and the registration that makes the group reference it
 * (conventions 1.1.1, #218).
 */
export interface GroupLabelContextValue {
  readonly labelId: string;
  /** Stable. The GroupLabel calls it from a layout effect; returns the unregistration. */
  readonly registerLabel: () => () => void;
}

/**
 * The group's half: the label id, the context value for the GroupLabel, and the group's owned
 * `aria-labelledby`, present only while a GroupLabel is mounted (until the group's first commit
 * it counts as mounted, so the server HTML references it; `usePartPresence`). The key is omitted
 * rather than set to `undefined`, which would remove the consumer's own tokens.
 */
export function useGroupLabel(): {
  readonly context: GroupLabelContextValue;
  readonly labelledBy: { "aria-labelledby"?: string };
} {
  const labelId = `${useId()}-label`;
  const { present, register } = usePartPresence();
  const context = useMemo(() => ({ labelId, registerLabel: register }), [labelId, register]);
  return { context, labelledBy: present ? { "aria-labelledby": labelId } : {} };
}

/** The GroupLabel's half: registers with the enclosing group (if any) and returns its id. */
export function useGroupLabelId(group: GroupLabelContextValue | null): string | undefined {
  const registerLabel = group?.registerLabel;
  useLayoutEffect(() => registerLabel?.(), [registerLabel]);
  return group?.labelId;
}
