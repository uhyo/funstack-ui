import { codeToHtml } from "shiki";

interface CodeBlockProps {
  children: string;
  language?: "tsx" | "typescript" | "bash" | "json" | "css" | "html";
  /** Optional file name shown above the code. */
  title?: string;
}

// Server Component: highlighting happens at build time, no highlighter ships to the browser.
export async function CodeBlock({ children, language = "tsx", title }: CodeBlockProps) {
  const code = children.trim();
  const html = await codeToHtml(code, {
    lang: language,
    theme: "github-dark",
  });

  return (
    <div className="code-block">
      {title && <div className="code-block-title">{title}</div>}
      <div className="code-block-wrapper" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
