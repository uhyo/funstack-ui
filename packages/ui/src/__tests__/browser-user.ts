// `userEvent` from vitest/browser drives the real engine through the test runner and is not
// wrapped in React's `act`, so every state update it causes logs "An update to … was not wrapped
// in act(...)" (Testing Library sets IS_REACT_ACT_ENVIRONMENT). These wrappers run the
// interaction inside an async `act` scope: React queues the updates and flushes them when the
// interaction is done, as with Testing Library's own user-event in jsdom. Browser tests only.
import { act } from "@testing-library/react";
import { userEvent } from "vitest/browser";

type ClickOptions = Parameters<typeof userEvent.click>[1];
type DragAndDropOptions = Parameters<typeof userEvent.dragAndDrop>[2];

export const user = {
  click: (element: Element, options?: ClickOptions) =>
    act(async () => {
      await userEvent.click(element, options);
    }),
  keyboard: (text: string) =>
    act(async () => {
      await userEvent.keyboard(text);
    }),
  /** Tab (or Shift+Tab with `{ shift: true }`) through the real focus order. */
  tab: (options?: { shift?: boolean }) =>
    act(async () => {
      await userEvent.tab(options);
    }),
  /** Moves the real pointer over `element`. */
  hover: (element: Element) =>
    act(async () => {
      await userEvent.hover(element);
    }),
  /** A real press on `source`, a move, and a release on `target` (Playwright `dragAndDrop`). */
  dragAndDrop: (source: Element, target: Element, options?: DragAndDropOptions) =>
    act(async () => {
      await userEvent.dragAndDrop(source, target, options);
    }),
};
