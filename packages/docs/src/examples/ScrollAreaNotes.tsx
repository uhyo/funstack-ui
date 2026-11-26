// No "use client": a Server Component, and there is no FUNSTACK UI part in it. Two native
// scrollers styled by scroll-area.css. The release notes have no focusable content, so the
// scroller is a Tab stop itself (tabindex="0", a role and a name): without it Safari gives the
// keyboard no way to scroll them. The links list needs none of that: Tab reaches the links, and
// the browser scrolls each into view.
// A pretend product's changelog.
const notes = [
  "Invoices can be exported as CSV.",
  "The search box remembers your last five queries.",
  "Fixed: dates in the calendar view used the wrong week start.",
  "Team owners can transfer a project to another team.",
  "The mobile layout keeps the toolbar visible while scrolling.",
  "Fixed: a long project name no longer overlaps the menu.",
  "Comments can be edited for ten minutes after posting.",
  "Keyboard shortcuts are listed under Help.",
  "Fixed: the dark theme used a light scrollbar in the sidebar.",
  "Archived projects are hidden from the dashboard.",
  "Uploads show their progress in the status bar.",
  "Fixed: pasting a link into a comment kept its formatting.",
];

const pages = [
  "Getting started",
  "Action props",
  "Pending & optimistic state",
  "Transitions & ViewTransition",
  "Suspense",
  "Browser-owned state",
  "Server Components",
  "Replacing the element",
  "Experimental features",
  "Content Security Policy",
];

export function ScrollAreaNotes() {
  return (
    <div className="demo-scroll-area-row">
      <section className="demo-scroll-area-frame" aria-labelledby="demo-scroll-notes-title">
        <h4 id="demo-scroll-notes-title">Release notes</h4>
        <div
          className="demo-scroll-area demo-scroll-fade"
          tabIndex={0}
          role="region"
          aria-label="Release notes, scrollable"
        >
          <ul className="demo-scroll-area-list">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </section>
      <nav className="demo-scroll-area-frame" aria-labelledby="demo-scroll-pages-title">
        <h4 id="demo-scroll-pages-title">Pages</h4>
        <div className="demo-scroll-area demo-scroll-fade">
          <ul className="demo-scroll-area-list">
            {pages.map((page) => (
              <li key={page}>
                <a href="#keyboard">{page}</a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}
