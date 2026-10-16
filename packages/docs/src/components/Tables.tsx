import type { ReactNode } from "react";

/**
 * Renders a tiny subset of Markdown inline syntax: `code`, **bold** and [text](href). Keeps the
 * tables below readable as plain strings.
 */
export function inline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    if (index > last) parts.push(text.slice(last, index));
    const [, code, bold, linkText, href] = match;
    if (code !== undefined) parts.push(<code key={index}>{code}</code>);
    else if (bold !== undefined) parts.push(<strong key={index}>{bold}</strong>);
    else
      parts.push(
        <a key={index} href={href}>
          {linkText}
        </a>,
      );
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export interface PropRow {
  name: string;
  type: string;
  default?: string;
  /** A string is rendered with {@link inline}. */
  description: ReactNode;
}

/** A props table. Types are written by hand from the TypeScript declarations in packages/ui. */
export function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <div className="table-scroll">
      <table className="props-table">
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>
                <code>{row.name}</code>
              </td>
              <td>
                <code>{row.type}</code>
              </td>
              <td>{row.default === undefined ? "–" : <code>{row.default}</code>}</td>
              <td>
                {typeof row.description === "string" ? inline(row.description) : row.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A plain table for data attributes, keyboard interactions and similar reference lists. Cells
 * are strings rendered with {@link inline}.
 */
export function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="table-scroll">
      <table className="props-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((cell, j) => (
                <td key={j}>{inline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
