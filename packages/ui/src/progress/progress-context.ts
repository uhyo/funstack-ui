"use client";
import { createContext, use } from "react";
import type { ProgressState } from "./progress-root.js";

/**
 * What the directive-free `Progress.Root` provides to its parts: plain serialisable data, so the
 * provider can be rendered by a Root running as a Server Component (design 8.1).
 */
export interface ProgressContextValue {
  /** The Root's `useId`; `Progress.Label` renders `${id}-label`. */
  readonly id: string;
  readonly state: ProgressState;
}

export const ProgressContext = createContext<ProgressContextValue | null>(null);

export function useProgressContext(part: string): ProgressContextValue {
  const context = use(ProgressContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Progress.Root.`);
  }
  return context;
}
