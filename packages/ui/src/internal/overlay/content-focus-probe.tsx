"use client";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";

/**
 * Records, from its layout-effect cleanup, whether focus is inside the popup when the content
 * goes away: React runs a deleted component's layout cleanups before it detaches the host nodes,
 * so `document.activeElement` still names the focused element there.
 */
function ContentFocusProbe({
  onDetach,
  children,
}: {
  onDetach: () => void;
  children?: ReactNode;
}): ReactNode {
  useLayoutEffect(() => onDetach, [onDetach]);
  return children;
}

export interface ContentFocusProbeHook {
  /**
   * Wraps the library-mode content of a top-layer popup: call it only while the content is
   * shown (`visible ? wrapContent(x) : null`), or inside the `<Activity>` for `keepMounted`.
   */
  readonly wrapContent: (children: ReactNode) => ReactNode;
  /**
   * Whether the wrapped content unmounted (or was hidden by `<Activity>`) while it held focus
   * since the last `forget()`. The owner reads it after its close
   * (design/components/popover.md 6.2 rule 2, design/components/dialog.md 6.2 rule 2).
   * Handlers and effects only.
   */
  readonly hadFocus: () => boolean;
  /**
   * Clear the record: on every open, after the owner used it, and whenever the content went
   * away while the popup stays open (not a close).
   */
  readonly forget: () => void;
}

/**
 * The content probe shared by the popover-like Popups (Popover, Menu) and Dialog.Popup: a
 * library-driven close with `transition` unmounts the content, the focused Close part included,
 * in the close commit, before the layout effect that hides the popup runs, so focus falls to
 * `<body>` and the platform may restore nothing. The probe tells the owner that this happened.
 */
export function useContentFocusProbe(
  popupRef: RefObject<HTMLElement | null>,
): ContentFocusProbeHook {
  const lostFocus = useRef(false);

  const record = useCallback(() => {
    const element = popupRef.current;
    if (element === null) return;
    const active = element.ownerDocument.activeElement;
    if (active !== null && active !== element && element.contains(active)) {
      lostFocus.current = true;
    }
  }, [popupRef]);

  const wrapContent = useCallback(
    (children: ReactNode): ReactNode => (
      <ContentFocusProbe onDetach={record}>{children}</ContentFocusProbe>
    ),
    [record],
  );
  const hadFocus = useCallback(() => lostFocus.current, []);
  const forget = useCallback(() => {
    lostFocus.current = false;
  }, []);

  return { wrapContent, hadFocus, forget };
}
