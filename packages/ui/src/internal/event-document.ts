/**
 * The document an event target belongs to: a document itself, or a node's owner document;
 * `null` for a window or no target. Read the document of a native event through this, from its
 * `target`, never from `ownerDocument` of its `currentTarget`: the `currentTarget` of an event
 * React hands over (`event.nativeEvent`) is React's root container, which is the document itself
 * under `hydrateRoot(document, ...)` (FUNSTACK Static), and a document's `ownerDocument` is
 * `null` (#215). Duck-typed (`nodeType`), so a node of another realm (an iframe) passes too.
 */
export function documentOf(target: EventTarget | null): Document | null {
  if (target === null || !("nodeType" in target)) return null;
  const node = target as Node;
  if (node.nodeType === 9 /* Node.DOCUMENT_NODE */) return node as Document;
  return node.ownerDocument;
}
