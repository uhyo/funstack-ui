// Directive-free: a pure DOM read, used by the Popups' development element checks
// (design/conventions.md 9.5, #221).
//
// A Popup is a `<div>` or a `<dialog>`. Inside a `<p>` the HTML parser closes the paragraph at
// that start tag (HTML "in body" insertion mode: these start tags close a `p` element in button
// scope), so the server HTML parses into a different tree from React's and hydration fails
// (React #418). The check reports exactly that case: the element's tag closes a paragraph and a
// `<p>` is an ancestor in button scope. It is not the content-model rule ("phrasing content
// only"): a `<div>` in a `<span>` or an `<h2>` is invalid too, but parses as written and
// hydrates, so it is left to validators.

/** Start tags that close an open `<p>` in button scope (the HTML parser, "in body"). */
const CLOSES_PARAGRAPH = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "CENTER",
  "DETAILS",
  "DIALOG",
  "DIR",
  "DIV",
  "DL",
  "DD",
  "DT",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HGROUP",
  "HR",
  "LI",
  "LISTING",
  "MAIN",
  "MENU",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SEARCH",
  "SECTION",
  "SUMMARY",
  "TABLE",
  "UL",
  "XMP",
]);

/** The HTML elements that end button scope: the parser does not look for a `<p>` past them. */
const BUTTON_SCOPE_BOUNDARIES = new Set([
  "APPLET",
  "BUTTON",
  "CAPTION",
  "HTML",
  "MARQUEE",
  "OBJECT",
  "TABLE",
  "TD",
  "TEMPLATE",
  "TH",
]);

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/**
 * The `<p>` the HTML parser would close at `element`'s start tag, or `null`: `element`'s tag
 * closes a paragraph and a `<p>` is an ancestor within button scope. An SVG or MathML ancestor
 * ends the search (its integration points have their own scope), so the check never reports a
 * tree that parses as written.
 */
export function paragraphBrokenBy(element: Element): Element | null {
  if (element.namespaceURI !== HTML_NAMESPACE || !CLOSES_PARAGRAPH.has(element.tagName)) {
    return null;
  }
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (node.namespaceURI !== HTML_NAMESPACE) return null;
    if (node.tagName === "P") return node;
    if (BUTTON_SCOPE_BOUNDARIES.has(node.tagName)) return null;
  }
  return null;
}

/**
 * The development message for a Popup inside a `<p>`, or `null`. `span` says whether the part
 * may render a `<span>` (Tooltip and HoverCard), which is the fix inside running text.
 */
export function paragraphBreakMessage(
  part: string,
  element: Element,
  span: boolean,
): string | null {
  if (paragraphBrokenBy(element) === null) return null;
  const tag = element.tagName.toLowerCase();
  return (
    `${part}: rendered inside a <p>. The HTML parser closes the paragraph at a <${tag}>, so the ` +
    "server HTML does not match and hydration fails. " +
    (span
      ? "Inside running text, render it as a <span> (`render={<span />}`), or "
      : "Put the text in a <div> instead of the <p>, or ") +
    "render the Popup after the <p>."
  );
}
