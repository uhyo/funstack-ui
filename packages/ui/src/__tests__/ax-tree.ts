// Chromium's accessibility tree for the test's frame, through CDP (browser tests, Chromium only).
import { cdp } from "vitest/browser";

export interface AXValue {
  value?: unknown;
}

export interface AXNode {
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
