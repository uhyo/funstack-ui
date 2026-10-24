import type { ReactNode } from "react";
import { exampleSource } from "../examples/sources.js";
import { CodeBlock } from "./CodeBlock.js";

interface ExampleProps {
  /** The live demo: a Client Component that renders the real `@funstack/ui`. */
  children: ReactNode;
  /** The demo's file in src/examples; its source is shown under this name. */
  file: string;
  /** The stylesheet the demo uses, also a file in src/examples. */
  css?: string;
}

// A live example followed by its source. The source sits in a native <details>, so it opens
// before hydration and needs no JavaScript.
export function Example({ children, file, css }: ExampleProps) {
  return (
    <figure className="example">
      <div className="example-preview">{children}</div>
      <details className="example-source">
        <summary>Show code</summary>
        <ExampleSource file={file} />
        {css !== undefined && <ExampleSource file={css} />}
      </details>
    </figure>
  );
}

/** The source of a file in src/examples (read with Vite's `?raw`), titled with its file name. */
export function ExampleSource({ file }: { file: string }) {
  return (
    <CodeBlock language={file.endsWith(".css") ? "css" : "tsx"} title={file}>
      {exampleSource(file)}
    </CodeBlock>
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
