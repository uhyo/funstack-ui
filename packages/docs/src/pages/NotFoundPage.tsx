import { PageHead } from "../components/PageHead.js";

export function NotFoundPage() {
  return (
    <div className="page not-found-page">
      <PageHead title="Page not found" description="This page does not exist." />
      <h1>Page not found</h1>
      <p>This page does not exist.</p>
      <a href="/" className="button primary">
        Back to the home page
      </a>
    </div>
  );
}
