"use client";
import { createContext, use } from "react";
import type { AvatarStatus } from "./avatar-root.js";

/**
 * What `Avatar.Root` provides to its parts (design/components/avatar.md 4): the status and the
 * source it is about, and the stable functions through which `Avatar.Image` reports.
 */
export interface AvatarContextValue {
  readonly status: AvatarStatus;
  /** The source key (`sourceKey`) the status is about; `null` for `"idle"`. */
  readonly source: string | null;
  /** Stable. Writes the status for `source` (an urgent `setState`, conventions 2.6). */
  readonly report: (source: string, status: Exclude<AvatarStatus, "idle">) => void;
  /** Stable. Back to `"idle"` if the status is still about `source` (a source change, unmount). */
  readonly release: (source: string) => void;
  /** Stable. Called from a layout effect of each `Avatar.Image`; returns the unregistration. */
  readonly registerImage: () => () => void;
}

export const AvatarContext = createContext<AvatarContextValue | null>(null);

export function useAvatarContext(part: string): AvatarContextValue {
  const context = use(AvatarContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside an Avatar.Root.`);
  }
  return context;
}

/**
 * Identifies what a report is about: the Image's `src` and `srcSet`, the two props whose change
 * starts a new request (and a new commit wait in react-dom). `null` when neither is given (an
 * empty string is no source either: react-dom's `maySuspendCommit` reads it the same way).
 */
export function sourceKey(src: string | undefined, srcSet: string | undefined): string | null {
  const s = src === "" ? undefined : src;
  const set = srcSet === "" ? undefined : srcSet;
  if (s === undefined && set === undefined) return null;
  return `${s ?? ""}\u0000${set ?? ""}`;
}
