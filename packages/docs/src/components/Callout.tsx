import type { ReactNode } from "react";

// A note or warning box in page prose.
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
