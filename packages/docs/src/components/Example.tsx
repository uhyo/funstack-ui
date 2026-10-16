import type { ReactNode } from "react";
import { CodeBlock } from "./CodeBlock.js";

interface ExampleProps {
  /** The live demo: a Client Component that renders the real `@funstack/ui`. */
  children: ReactNode;
  /** The demo's own source, imported with Vite's `?raw` so the code shown is the code running. */
  source: string;
  fileName: string;
  /** The stylesheet the demo uses, also imported with `?raw`. */
  css?: string;
  cssFileName?: string;
}

// A live example followed by its source. The source sits in a native <details>, so it opens
// before hydration and needs no JavaScript.
export function Example({ children, source, fileName, css, cssFileName }: ExampleProps) {
  return (
    <figure className="example">
      <div className="example-preview">{children}</div>
      <details className="example-source">
        <summary>Show code</summary>
        <CodeBlock title={fileName}>{source}</CodeBlock>
        {css !== undefined && (
          <CodeBlock language="css" title={cssFileName}>
            {css}
          </CodeBlock>
        )}
      </details>
    </figure>
  );
}

export function Callout({
  kind = "note",
  title,
  children,
}: {
  kind?: "note" | "warning";
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className={`callout ${kind}`}>
      {title && <p className="callout-title">{title}</p>}
      {children}
    </aside>
  );
}
