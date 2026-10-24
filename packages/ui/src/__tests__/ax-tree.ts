// Chromium's accessibility tree for the test's frame, through CDP (browser tests, Chromium only).
import { expect } from "vitest";
import { cdp } from "vitest/browser";
import { browserName } from "./engine.js";

export interface AXValue {
  value?: unknown;
}

export interface AXNode {
  ignored?: boolean;
  role?: AXValue;
  name?: AXValue;
  value?: AXValue;
  properties?: { name: string; value: AXValue }[];
}

export async function getAXNodes(): Promise<AXNode[]> {
  const session = cdp();
  type FrameTree = { frame: { id: string; url: string }; childFrames?: FrameTree[] };
  const { frameTree } = (await session.send("Page.getFrameTree")) as { frameTree: FrameTree };
  const frames: FrameTree[] = [];
  const walk = (tree: FrameTree) => {
    frames.push(tree);
    tree.childFrames?.forEach(walk);
  };
  walk(frameTree);
  const frameId = frames.find((f) => f.frame.url === location.href)?.frame.id;
  const { nodes } = (await session.send("Accessibility.getFullAXTree", { frameId })) as {
    nodes: AXNode[];
  };
  return nodes;
}

/** A node property (`valuemin`, `valuetext`, ...) or the node's `value`. */
export function axProperty(node: AXNode | undefined, name: string): unknown {
  if (name === "value") return node?.value?.value;
  return node?.properties?.find((p) => p.name === name)?.value.value;
}

/**
 * The `expanded` state Chromium exposes for `element`, found by its role (`role` attribute, else
 * `button`) and accessible name (`aria-label`, else its text); the pair must be unique in the
 * frame. `undefined` when the node exposes no expanded state. Used for the overlay Triggers,
 * `popovertarget` invokers whose state the browser computes from the popover (#121).
 */
export async function axExpanded(element: Element): Promise<unknown> {
  const role = element.getAttribute("role") ?? "button";
  const name = element.getAttribute("aria-label") ?? element.textContent.trim();
  const matches = (await getAXNodes()).filter(
    (node) => !node.ignored && node.role?.value === role && node.name?.value === name,
  );
  if (matches.length !== 1) {
    throw new Error(`axExpanded: ${matches.length} ${role} nodes named "${name}"`);
  }
  return axProperty(matches[0], "expanded");
}

/**
 * An overlay Trigger that is a `popovertarget` invoker (#121): it names `popup` and renders no
 * `aria-expanded`, and on Chromium the exposed state is `expanded` (polled: the accessibility tree
 * follows the DOM at the next lifecycle update). Firefox and WebKit run the DOM assertions only
 * (`memo/architect/probes/121-popovertarget/ax-firefox.mjs` checks Firefox's tree by hand).
 */
export async function expectInvokerExpanded(
  trigger: Element,
  popup: Element,
  expanded: boolean,
): Promise<void> {
  expect(trigger).toHaveAttribute("popovertarget", popup.id);
  expect(trigger).not.toHaveAttribute("aria-expanded");
  if (browserName !== "chromium") return;
  await expect.poll(() => axExpanded(trigger)).toBe(expanded);
}
