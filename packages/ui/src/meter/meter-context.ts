"use client";
import { createContext, use } from "react";
import type { MeterState } from "./meter-root.js";

/**
 * What the directive-free `Meter.Root` provides to its parts: plain serialisable data, so the
 * provider can be rendered by a Root running as a Server Component (design/components/progress.md
 * 8.1).
 */
export interface MeterContextValue {
  /** The Root's `useId`; `Meter.Label` renders `${id}-label`. */
  readonly id: string;
  readonly state: MeterState;
}

export const MeterContext = createContext<MeterContextValue | null>(null);

export function useMeterContext(part: string): MeterContextValue {
  const context = use(MeterContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Meter.Root.`);
  }
  return context;
}
