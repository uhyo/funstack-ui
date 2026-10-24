"use client";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import {
  getServerTopmostModal,
  getTopmostModal,
  subscribeModals,
} from "../internal/modal-registry.js";

/** No store: `useSyncExternalStore` only tells the hydration render from a client render. */
const subscribeNothing = (): (() => void) => () => {};
const onClient = (): boolean => true;
const onServerOrHydrating = (): boolean => false;

/**
 * The element the region is portalled into for its whole client life. The library moves this
 * element (between its inline anchor and the topmost modal dialog); React never sees the move, so
 * the toasts keep their state (an Undo in flight stays pending). `display: contents`: no box.
 */
function createHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const host = document.createElement("div");
  host.style.display = "contents";
  return host;
}

export interface ModalPortalHost {
  /** `false` for the hydration render (and on the server): render the region inline. */
  readonly portalled: boolean;
  /** Portal into it when `portalled`; `null` without a document. */
  readonly host: HTMLElement | null;
  /** For the inline anchor element the host sits in while no modal is open. */
  readonly anchorRef: RefObject<HTMLDivElement | null>;
}

/**
 * The Viewport's portal host (design/components/toast.md 4.3): in the topmost open modal
 * `Dialog` (a region outside it would be inert), else at its inline anchor. Its layout effect
 * moves the host and must run before the Viewport's region effect: a move hides the popover
 * (removal steps), which that effect shows again in the same commit. `onMove` runs after a move.
 */
export function useModalPortalHost(onMove: () => void): ModalPortalHost {
  const container = useSyncExternalStore(subscribeModals, getTopmostModal, getServerTopmostModal);
  // The hydration render matches the server's inline region; every later render portals into
  // `host`, whose place the library changes without React noticing.
  const portalled = useSyncExternalStore(subscribeNothing, onClient, onServerOrHydrating);
  const [host] = useState(createHost);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (host === null) return;
    return () => host.remove();
  }, [host]);

  useLayoutEffect(() => {
    if (host === null || !portalled) return;
    const target = container ?? anchorRef.current;
    if (target === null || host.parentNode === target) return;
    const moved = host.parentNode !== null;
    target.append(host);
    if (moved) onMove();
  });

  return { portalled, host, anchorRef };
}
