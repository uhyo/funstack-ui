"use client";
import { createContext } from "react";

/** What `<CSPProvider>` gives the parts that render a hoisted `<style>` (conventions 12). */
export interface CSPContextValue {
  /** Forwarded as the `nonce` of every library `<style>`. */
  readonly nonce: string | undefined;
}

export const CSPContext = createContext<CSPContextValue | null>(null);
