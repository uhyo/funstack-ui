"use client";
import { useMemo } from "react";
import { usePartPresence } from "./use-part-presence.js";

/**
 * Which of an owner's Title and Description are mounted (Dialog, AlertDialog, Drawer, Popover,
 * Toast; conventions 1.1.1, #218): the owner's `aria-labelledby` /
 * `aria-describedby` name a part only while it is mounted. Until the owner's first commit both
 * count as mounted (`usePartPresence`), so the server HTML references them.
 */
export interface TitleDescriptionPresence {
  /** The Title id while a Title is mounted, else `undefined`. */
  readonly titleId: string | undefined;
  /** The Description id while a Description is mounted, else `undefined`. */
  readonly descriptionId: string | undefined;
  /** Stable. The Title calls it from a layout effect; returns the unregistration. */
  readonly registerTitle: () => () => void;
  /** Stable. The Description calls it from a layout effect; returns the unregistration. */
  readonly registerDescription: () => () => void;
}

/** The owner's half: one `usePartPresence` per part. Memoised: changes only with the presence. */
export function useTitleDescriptionPresence(ids: {
  readonly title: string;
  readonly description: string;
}): TitleDescriptionPresence {
  const title = usePartPresence();
  const description = usePartPresence();
  const titleId = title.present ? ids.title : undefined;
  const descriptionId = description.present ? ids.description : undefined;
  const registerTitle = title.register;
  const registerDescription = description.register;
  return useMemo(
    () => ({ titleId, descriptionId, registerTitle, registerDescription }),
    [titleId, descriptionId, registerTitle, registerDescription],
  );
}

/**
 * The owner's owned idref props: a key only for a mounted part. An owned `undefined` would remove
 * the consumer's own tokens (conventions 1.2), so an absent part's key is omitted instead.
 */
export function titleDescriptionRefs(presence: TitleDescriptionPresence): {
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
} {
  return {
    ...(presence.titleId !== undefined && { "aria-labelledby": presence.titleId }),
    ...(presence.descriptionId !== undefined && { "aria-describedby": presence.descriptionId }),
  };
}
