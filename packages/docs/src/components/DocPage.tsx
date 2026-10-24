import type { ReactNode } from "react";
import { PageHead } from "./PageHead.js";

interface DocPageProps {
  /** The page title: the heading, and the document title as "{title} | FUNSTACK UI". */
  title: string;
  description: string;
  children: ReactNode;
}

// The shell of a documentation page (getting started, concepts, components): metadata and the
// heading. The body, starting with its `page-intro` paragraph, is the page's own.
export function DocPage({ title, description, children }: DocPageProps) {
  return (
    <div className="learn-content">
      <PageHead title={title} description={description} />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
