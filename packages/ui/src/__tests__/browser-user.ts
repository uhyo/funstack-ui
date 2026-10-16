// `userEvent` from vitest/browser drives the real engine through the test runner and is not
// wrapped in React's `act`, so every state update it causes logs "An update to … was not wrapped
// in act(...)" (Testing Library sets IS_REACT_ACT_ENVIRONMENT). These wrappers run the
// interaction inside an async `act` scope: React queues the updates and flushes them when the
// interaction is done, as with Testing Library's own user-event in jsdom. Browser tests only.
import { act } from "@testing-library/react";
import { userEvent } from "vitest/browser";

export const user = {
  click: (element: Element) =>
    act(async () => {
      await userEvent.click(element);
    }),
  keyboard: (text: string) =>
    act(async () => {
      await userEvent.keyboard(text);
    }),
};
