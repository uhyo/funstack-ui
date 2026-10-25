import type { ReactNode } from "react";

// A note or warning box in page prose.
export function Callout({
  kind = "note",
  title,
  id,
  children,
}: {
  kind?: "note" | "warning";
  title?: string;
  /** A link target, for a callout that other text refers to. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <aside id={id} className={`callout ${kind}`}>
      {title && <p className="callout-title">{title}</p>}
      {children}
    </aside>
  );
}
