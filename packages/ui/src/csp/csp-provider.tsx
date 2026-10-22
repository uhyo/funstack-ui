"use client";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { CSPContext } from "../internal/csp-context.js";
import type { CSPContextValue } from "../internal/csp-context.js";

export interface CSPProviderProps {
  /**
   * The per-response nonce of a nonce-based `style-src` policy. Pass the same value as React's
   * `nonce: { style }` render option: during server rendering React drops a hoisted
   * `<style precedence>` whose `nonce` differs from it (a missing provider included), and strips
   * the `nonce` when the option is absent or in its string form.
   */
  nonce?: string;
  children?: ReactNode;
}

/**
 * Hands a Content Security Policy nonce to every library part that renders a hoisted `<style>`
 * (`Menu.Popup`'s point placement rules, `Tooltip.Trigger`'s skip-delay rule with
 * `experimental_interestFor`), which forward it as the element's `nonce` (design/conventions.md
 * 12). The library's only provider; its prop is serialisable, so a Server Component layout that
 * knows the nonce renders it once. Hash-based policies need no provider: use `STYLE_SHA256`.
 */
export function CSPProvider({ nonce, children }: CSPProviderProps) {
  const value = useMemo<CSPContextValue>(() => ({ nonce }), [nonce]);
  return <CSPContext value={value}>{children}</CSPContext>;
}

CSPProvider.displayName = "CSPProvider";
