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

/** The test frame's document in a `DOM.getDocument({ pierce: true })` tree. */
interface DOMNode {
  nodeId: number;
  documentURL?: string;
  children?: DOMNode[];
  contentDocument?: DOMNode;
}

let probeCount = 0;

/**
 * Chromium's accessibility node for `element` itself: the element is resolved with
 * `DOM.querySelector` in the test's frame and read with `Accessibility.getPartialAXTree`
 * (memo/architect/probes/121-popovertarget/ax-chromium.mjs), so neither its role nor its
 * accessible name matters. A temporary `data-ax-probe` attribute selects it.
 */
export async function axNodeOf(element: Element): Promise<AXNode> {
  const session = cdp();
  const probe = String(++probeCount);
  element.setAttribute("data-ax-probe", probe);
  try {
    const { root } = (await session.send("DOM.getDocument", { depth: -1, pierce: true })) as {
      root: DOMNode;
    };
    let frameDocument: DOMNode | undefined;
    const walk = (node: DOMNode) => {
      if (frameDocument !== undefined) return;
      if (node.documentURL === location.href) {
        frameDocument = node;
        return;
      }
      if (node.contentDocument !== undefined) walk(node.contentDocument);
      node.children?.forEach(walk);
    };
    walk(root);
    if (frameDocument === undefined) throw new Error("axNodeOf: the test frame was not found");
    const { nodeId } = (await session.send("DOM.querySelector", {
      nodeId: frameDocument.nodeId,
      selector: `[data-ax-probe="${probe}"]`,
    })) as { nodeId: number };
    if (nodeId === 0) throw new Error("axNodeOf: the element was not found");
    const { nodes } = (await session.send("Accessibility.getPartialAXTree", {
      nodeId,
      fetchRelatives: false,
    })) as { nodes: AXNode[] };
    return nodes[0]!;
  } finally {
    element.removeAttribute("data-ax-probe");
  }
}

/**
 * The `expanded` state Chromium exposes for `element` (`undefined` when it exposes none). Used for
 * the overlay Triggers, `popovertarget` invokers whose state the browser computes from the popover
 * (#121).
 */
export async function axExpanded(element: Element): Promise<unknown> {
  return axProperty(await axNodeOf(element), "expanded");
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
