"use client";
import { useEffect } from "react";

// The duplicate-copy check (design/conventions.md 9.5, #219). Two copies of the library on one
// page each have their own contexts, so a part from one copy cannot see a Root or a Popup from
// the other: it renders, but as if it stood alone (a `NavigationMenu.Link` that never closes its
// Popup). The usual cause is the Vite dev server with React Server Components, where the parts a
// Server Component renders load unbundled from `node_modules` while a client component's import
// of the same subpath gets Vite's pre-bundled copy.
//
// Detection needs state that both copies see, and a copy's own modules are exactly what is
// duplicated, so the registry lives on `globalThis` under a `Symbol.for` key. It only ever
// decides whether to log: no behaviour reads it. It counts mounted parts per copy, not loaded
// copies, so that the server (where the `rsc` and `ssr` graphs of one process each load the
// library, and effects never run), a test that loads modules again, and an HMR update (whose new
// modules mount in the commit that unmounts the old ones) do not warn.

const isDev = process.env.NODE_ENV !== "production";

/**
 * The registry shared by every copy on the page, whatever its version: keep its shape
 * backwards-compatible.
 */
interface CopyRegistry {
  /** Each mounted copy's token, with its number of mounted parts. */
  readonly mounted: Map<object, number>;
  /** Whether a copy has warned already: the warning is once per page. */
  warned: boolean;
}

const REGISTRY_KEY = Symbol.for("@funstack/ui/mounted-copies");

type GlobalWithRegistry = typeof globalThis & { [REGISTRY_KEY]?: CopyRegistry };

/** This module instance's token: one per loaded copy of the library. */
const thisCopy: object = {};

function registry(): CopyRegistry {
  const global = globalThis as GlobalWithRegistry;
  return (global[REGISTRY_KEY] ??= { mounted: new Map(), warned: false });
}

/**
 * Counts one mounted part of the copy `copy`, and logs once per page when parts of two copies
 * are mounted at the same time. Returns the matching unmount. Exported for the tests, which
 * stand in for a second copy with a token of their own.
 */
export function registerMountedCopy(copy: object): () => void {
  const copies = registry();
  copies.mounted.set(copy, (copies.mounted.get(copy) ?? 0) + 1);
  if (isDev && copies.mounted.size > 1 && !copies.warned) {
    copies.warned = true;
    console.error(
      "@funstack/ui: parts from two copies of the library are mounted on this page. A part " +
        "cannot see the Root or Popup of another copy (a NavigationMenu.Link inside a Popup " +
        "rendered by the other copy does not close it). Under the Vite dev server with React " +
        "Server Components (@vitejs/plugin-rsc, FUNSTACK Static), the parts a Server " +
        "Component renders load from node_modules while client components get Vite's " +
        'pre-bundled copy: add `optimizeDeps: { exclude: ["@funstack/ui"] }` to the Vite ' +
        "config. Otherwise, check that only one version of @funstack/ui is installed. " +
        "See https://ui.funstack.work/concepts/server-components#vite-dev",
    );
  }
  return () => {
    const count = (copies.mounted.get(copy) ?? 1) - 1;
    if (count === 0) copies.mounted.delete(copy);
    else copies.mounted.set(copy, count);
  };
}

/** This copy's token, for the tests. */
export function currentCopy(): object {
  return thisCopy;
}

/** Tests only: forget every mounted copy and the warning, so the next pair warns again. */
export function resetCopyCheck(): void {
  delete (globalThis as GlobalWithRegistry)[REGISTRY_KEY];
}

/**
 * Registers this copy while the calling part is mounted (development only; a no-op in
 * production). Called by `useRender`, which nearly every client part renders through.
 */
export const useCopyCheck: () => void = isDev ? useCopyCheckDev : noop;

function useCopyCheckDev(): void {
  useEffect(() => registerMountedCopy(thisCopy), []);
}

function noop(): void {}
