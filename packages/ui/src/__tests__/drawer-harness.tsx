// The Drawer test harness, shared by drawer*.test.tsx (jsdom): the Dialog harness's shape with
// Drawer parts, so the shared overlay suites run against it, and synthetic swipe helpers.
import { act, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { Drawer } from "../drawer/index.js";
import type {
  DrawerOpenChangeDetails,
  DrawerPopupProps,
  DrawerTriggerProps,
} from "../drawer/index.js";
import { createOverlayHarness } from "./overlay-open-state-suite.js";
import type { OpenChangeFn } from "./overlay-open-state-suite.js";

export type DrawerActionFn = OpenChangeFn<DrawerOpenChangeDetails>;

interface DrawerHarnessProps {
  modal?: boolean;
  trigger?: Partial<DrawerTriggerProps> | false;
  popup?: Partial<DrawerPopupProps>;
  /** Popup content; default: a span, a Close button with value "x". */
  content?: ReactNode;
}

/**
 * Controlled/uncontrolled parity harness (`createOverlayHarness`): a Trigger, a Popup with a
 * Title and a Description, and the content.
 */
export const DrawerHarness = createOverlayHarness<DrawerOpenChangeDetails, DrawerHarnessProps>(
  (rootProps, { modal, trigger, popup, content }) => (
    <Drawer.Root {...rootProps} modal={modal}>
      {trigger !== false && (
        <Drawer.Trigger data-testid="trigger" {...trigger}>
          Filters
        </Drawer.Trigger>
      )}
      <Drawer.Popup data-testid="popup" {...popup}>
        <Drawer.Title data-testid="title">Filters</Drawer.Title>
        <Drawer.Description data-testid="description">Narrow the list.</Drawer.Description>
        {content ?? (
          <>
            <span data-testid="content">content</span>
            <Drawer.Close data-testid="close" value="x">
              Done
            </Drawer.Close>
          </>
        )}
      </Drawer.Popup>
    </Drawer.Root>
  ),
);

export const drawerPopup = (): HTMLDialogElement =>
  screen.getByTestId("popup") as HTMLDialogElement;

/** The popup's box: a bottom sheet 200 px tall at the bottom of jsdom's 1024 x 768 viewport. */
export const SHEET = { left: 0, top: 568, right: 1024, bottom: 768, width: 1024, height: 200 };

/** Mocks the popup's `getBoundingClientRect` (jsdom lays nothing out). */
export function mockPopupRect(
  element: HTMLElement = drawerPopup(),
  rect: Omit<DOMRectReadOnly, "x" | "y" | "toJSON"> = SHEET,
): void {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    ...rect,
    x: rect.left,
    y: rect.top,
    toJSON: () => rect,
  } as DOMRect);
}

export interface SwipePointerInit {
  pointerId?: number;
  pointerType?: string;
}

/** One synthetic pointer event at (x, y), inside `act`. Returns it. */
export function swipePointer(
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  target: EventTarget,
  x: number,
  y: number,
  init: SwipePointerInit = {},
): PointerEvent {
  const event = new PointerEvent(type, {
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? "mouse",
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

/**
 * Presses on `target` at (500, 600) and moves by `dy` to each offset, `step` ms apart
 * (`Date` must be faked: jsdom's `timeStamp` is `Date.now()`).
 */
export function dragBy(
  target: Element,
  offsets: readonly number[],
  { step = 10, dx = 0, ...init }: SwipePointerInit & { step?: number; dx?: number } = {},
): void {
  swipePointer("pointerdown", target, 500, 600, init);
  for (const offset of offsets) {
    vi.advanceTimersByTime(step);
    swipePointer("pointermove", target, 500 + dx, 600 + offset, init);
  }
}

/** Releases at the last offset after holding still for `hold` ms (`0`: at once). */
export function releaseAt(
  target: Element,
  offset: number,
  { hold = 200, dx = 0, ...init }: SwipePointerInit & { hold?: number; dx?: number } = {},
): PointerEvent {
  vi.advanceTimersByTime(hold);
  return swipePointer("pointerup", target, 500 + dx, 600 + offset, init);
}
