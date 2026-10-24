import type { ReactNode } from "react";

/** The frame of one playground demo: an article with the component's name as its heading. */
export function Demo({
  title,
  className,
  children,
}: {
  title: string;
  /** Extra class for the demo's own rules (custom properties and the like). */
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={className === undefined ? "demo" : `demo ${className}`}>
      <h2>{title}</h2>
      {children}
    </article>
  );
}
