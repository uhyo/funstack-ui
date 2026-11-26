// No directive: a pure DOM read (conventions 7.1).

/**
 * The text a chip shows, for the removal announcement's last fallback (design 15.7): its text
 * nodes, trimmed, skipping every `[aria-hidden="true"]` subtree and every element `skip` names
 * (the chip's `ChipRemove`), so a "×" in the remove button or in an `aria-hidden` span is not
 * read as part of the label. `textContent` would include both.
 */
export function chipText(chip: Element, skip: (element: Element) => boolean): string {
  let text = "";
  const walk = (node: Node): void => {
    for (let child = node.firstChild; child !== null; child = child.nextSibling) {
      if (child.nodeType === 3) {
        text += child.nodeValue ?? "";
      } else if (child.nodeType === 1) {
        const element = child as Element;
        if (element.getAttribute("aria-hidden") === "true" || skip(element)) continue;
        walk(element);
      }
    }
  };
  walk(chip);
  return text.replace(/\s+/g, " ").trim();
}
