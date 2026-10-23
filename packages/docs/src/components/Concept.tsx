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

/** The five behaviour sections every component page has, in page order. */
export const behaviourSections = [
  {
    id: "transition-types",
    title: "Transition types",
    concept: "Transitions & ViewTransition",
    href: "/concepts/transitions#transition-types",
  },
  {
    id: "optimistic-and-pending",
    title: "Optimistic and pending",
    concept: "Pending & optimistic state",
    href: "/concepts/pending-and-optimistic",
  },
  { id: "suspense", title: "Suspense", concept: "Suspense", href: "/concepts/suspense" },
  {
    id: "browser-owned-state",
    title: "Browser-owned state",
    concept: "Browser-owned state",
    href: "/concepts/browser-owned-state",
  },
  {
    id: "before-hydration",
    title: "Before hydration",
    concept: "Server Components",
    href: "/concepts/server-components#before-hydration",
  },
] as const;

export type BehaviourId = (typeof behaviourSections)[number]["id"];

/**
 * The compact index of the five behaviour sections, rendered once near the top of every
 * component page so that a reader (and the concept pages) can jump to them.
 */
export function BehaviourIndex() {
  return (
    <nav
      id="async-and-platform"
      className="behaviour-index"
      aria-label="Async and platform behaviour"
    >
      <span className="behaviour-index-label">Async and platform behaviour:</span>{" "}
      {behaviourSections.map((section, i) => (
        <span key={section.id}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <a href={`#${section.id}`}>{section.title}</a>
        </span>
      ))}
    </nav>
  );
}

/**
 * One of the five behaviour sections: a fixed heading and id, a link to the concept page that
 * explains the idea, a summary paragraph (rendered with {@link inline}) and any longer content.
 */
export function BehaviourSection({
  id,
  summary,
  children,
}: {
  id: BehaviourId;
  /** How this component applies the concept, in one short paragraph. */
  summary: string;
  children?: ReactNode;
}) {
  const section = behaviourSections.find((s) => s.id === id)!;
  return (
    <>
      <h3 id={id}>{section.title}</h3>
      <p className="concept-ref">
        Concept: <a href={section.href}>{section.concept}</a>
      </p>
      <p>{inline(summary)}</p>
      {children}
    </>
  );
}
