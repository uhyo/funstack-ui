// No "use client": this file is a Server Component, and so is Progress.Root, which has no
// directive. The Root ran on the server: `getAriaValueText` below is a plain function passed from
// a Server Component (allowed, because it never crosses to the client), and Intl formatted the
// numbers where the data is. Only the small context module and the parts reach the browser.
import { Progress } from "@funstack/ui/progress";

// "Server data": a job queue as a database would return it.
const jobs = [
  { id: "thumbs", name: "Generate thumbnails", done: 412, total: 1200 },
  { id: "index", name: "Rebuild search index", done: 87_300, total: 87_300 },
  { id: "export", name: "Export invoices", done: 0, total: 3 },
];

export function ProgressJobs() {
  return (
    <div className="demo-stack">
      {jobs.map((job) => (
        <Progress.Root
          key={job.id}
          className="demo-progress"
          value={job.done}
          max={job.total}
          locale="en-US"
          format={{ style: "percent", maximumFractionDigits: 0 }}
          getAriaValueText={(value, { formattedValue, complete }) =>
            complete ? "Finished" : `${formattedValue}, ${value} of ${job.total} items`
          }
        >
          <div className="demo-progress-head">
            <Progress.Label>{job.name}</Progress.Label>
            <Progress.Value />
          </div>
          <Progress.Track className="demo-progress-track">
            <Progress.Indicator className="demo-progress-fill" />
          </Progress.Track>
        </Progress.Root>
      ))}
      <div className="demo-row">
        {/* A spinner: indeterminate, named by aria-label, no parts. */}
        <Progress.Root aria-label="Waiting for the next job" className="demo-progress-ring" />
        <span className="demo-readout" aria-hidden="true">
          Waiting for the next job
        </span>
      </div>
    </div>
  );
}
