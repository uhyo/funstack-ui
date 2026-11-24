"use client";
import { useRef } from "react";
import type { RefObject } from "react";
import { announce as speak } from "../internal/announce.js";
import type { ToastItem, ToastPriority } from "./toast.js";
import { plainText } from "./toast-queue.js";
import type { Entry } from "./toast-queue.js";

export interface ToastAnnouncements {
  /** Per toast: the text last announced for it (`null`: nothing). The queue writes forget ids. */
  readonly lastAnnouncedRef: RefObject<Map<string, string | null>>;
  /**
   * Queues a toast's text, unless it is what was last announced for it. The texts queued in one
   * task are spoken together in a microtask, at the highest priority among them.
   */
  readonly queueAnnouncement: (id: string, text: string | null, priority: ToastPriority) => void;
  /**
   * Queued toasts are announced on add (design 5): from their plain-text fields, since they have
   * no DOM yet. `fallback` is the Viewport's `announce`.
   */
  readonly announceQueued: (
    queued: readonly Entry[],
    fallback: ((toast: ToastItem) => string | null) | undefined,
  ) => void;
}

/** `Toast.Viewport`'s announcements through `document.ariaNotify()` (design/components/toast.md 5). */
export function useToastAnnouncements(
  regionRef: RefObject<HTMLElement | null>,
): ToastAnnouncements {
  const lastAnnouncedRef = useRef(new Map<string, string | null>());
  const announceBatch = useRef<{ text: string; priority: ToastPriority }[]>([]);

  const flushAnnouncements = (): void => {
    const batch = announceBatch.current;
    announceBatch.current = [];
    if (batch.length === 0) return;
    const priority = batch.some((a) => a.priority === "high") ? "high" : "normal";
    speak(
      regionRef.current?.ownerDocument ?? document,
      batch.map((a) => a.text).join(" "),
      priority,
    );
  };

  const queueAnnouncement = (id: string, text: string | null, priority: ToastPriority): void => {
    const map = lastAnnouncedRef.current;
    if (map.has(id) && map.get(id) === text) return;
    map.set(id, text);
    if (text === null || text.trim() === "") return;
    if (announceBatch.current.length === 0) queueMicrotask(flushAnnouncements);
    announceBatch.current.push({ text, priority });
  };

  const announceQueued = (
    queued: readonly Entry[],
    fallback: ((toast: ToastItem) => string | null) | undefined,
  ): void => {
    for (const entry of queued) {
      const id = entry.options.id;
      if (lastAnnouncedRef.current.has(id)) continue;
      const resolver = entry.options.announce ?? fallback;
      const text = resolver
        ? resolver(entry.item)
        : [plainText(entry.options.title), plainText(entry.options.description)]
            .filter((t) => t !== "")
            .join(" ");
      queueAnnouncement(id, text, entry.options.priority ?? "normal");
    }
  };

  return { lastAnnouncedRef, queueAnnouncement, announceQueued };
}
