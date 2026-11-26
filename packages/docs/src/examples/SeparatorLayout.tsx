// No "use client": a Server Component, and Separator runs on the server with it (the part is
// directive-free). A semantic separator between two sections of an article, and decorative
// vertical lines between the links of a breadcrumb, where "separator" would only be noise.
import { Separator } from "@funstack/ui/separator";

export function SeparatorLayout() {
  return (
    <div className="demo-separator-card">
      <nav aria-label="Breadcrumb" className="demo-separator-crumbs">
        <a href="/">Docs</a>
        <Separator orientation="vertical" decorative className="demo-separator" />
        <a href="/getting-started">Getting started</a>
        <Separator orientation="vertical" decorative className="demo-separator" />
        <span aria-current="page">Separator</span>
      </nav>
      <section>
        <h4>Release notes</h4>
        <p>Separator is a plain line with a name, an orientation and a decorative mode.</p>
      </section>
      {/* Semantic: a thematic break that a screen reader announces. */}
      <Separator className={(s) => `demo-separator demo-separator-${s.orientation}`} />
      <section>
        <h4>Comments</h4>
        <p>No comments yet.</p>
      </section>
    </div>
  );
}
