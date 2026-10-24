// Document-order helpers. No directive: pure DOM reads (conventions 7.1).

/** A `sort` comparator putting nodes in document order. */
export function compareDocumentOrder(a: Node, b: Node): number {
  if (a === b) return 0;
  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

/** Sorts items into the document order of their elements. */
export function sortByDocumentOrder<T>(items: readonly T[], elementOf: (item: T) => Node): T[] {
  return [...items].sort((a, b) => compareDocumentOrder(elementOf(a), elementOf(b)));
}
