import type { ReactNode } from "react";
import { inline } from "./Tables.js";

/**
 * One component used to illustrate a concept, set apart from the conceptual text around it.
 * Concept pages explain an idea in general words and then show it on a single component in one
 * of these blocks; per-component facts belong on the component's own page.
 */
export function ConceptExample({
  component,
  href,
  children,
}: {
  /** The component's name, as in the sidebar. */
  component: string;
  /** Its reference page. */
  href: string;
  children: ReactNode;
}) {
  return (
    <section className="concept-example" aria-label={`Example: ${component}`}>
      <p className="concept-example-label">
        Example: <a href={href}>{component}</a>
      </p>
      {children}
    </section>
  );
}

/**
 * The defining occurrence of a term. It gets an id, so other pages can link to the definition
 * (`/concepts/pending-and-optimistic#trigger`).
 */
export function Term({ id, children }: { id: string; children: ReactNode }) {
  return (
    <dfn id={id} className="term">
      {children}
    </dfn>
  );
}

/** A definition list of terms, for the "Terms" section of a concept page. */
export function Terms({ items }: { items: { id: string; term: string; definition: ReactNode }[] }) {
  return (
    <dl className="terms">
      {items.map((item) => (
        <div key={item.id}>
          <dt>
            <Term id={item.id}>{item.term}</Term>
          </dt>
          <dd>{typeof item.definition === "string" ? inline(item.definition) : item.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

type Cell = ReactNode;

/**
 * The "Async and platform behaviour" section every component page has, with the same rows in the
 * same order, each linking to the concept page that explains it. Strings are rendered with
 * {@link inline}.
 */
export function BehaviourSummary({
  name,
  transitionTypes,
  optimistic,
  suspense,
  browserOwned,
  beforeHydration,
}: {
  /** The component's name, for the heading's accessible description. */
  name: string;
  transitionTypes: Cell;
  optimistic: Cell;
  suspense: Cell;
  browserOwned: Cell;
  beforeHydration: Cell;
}) {
  const rows: [string, string, Cell][] = [
    ["Transition types", "/concepts/transitions#transition-types", transitionTypes],
    ["Optimistic and pending", "/concepts/pending-and-optimistic", optimistic],
    ["Suspense", "/concepts/suspense", suspense],
    ["Browser-owned state", "/concepts/browser-owned-state", browserOwned],
    ["Before hydration", "/concepts/server-components#before-hydration", beforeHydration],
  ];
  return (
    <>
      <h3 id="async-and-platform">Async and platform behaviour</h3>
      <p>
        How {name} applies each concept. The first column links to the concept page that explains
        it.
      </p>
      <div className="table-scroll">
        <table className="props-table behaviour-summary">
          <thead>
            <tr>
              <th>Concept</th>
              <th>{name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, href, cell]) => (
              <tr key={label}>
                <th scope="row">
                  <a href={href}>{label}</a>
                </th>
                <td>{typeof cell === "string" ? inline(cell) : cell}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
