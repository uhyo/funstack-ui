"use client";
import { useState, useTransition } from "react";
import { Progress } from "@funstack/ui/progress";
import { fakeUpload } from "./fake-api.js";

const megabytes = { style: "unit", unit: "megabyte", maximumFractionDigits: 1 } as const;

// An upload driven by useTransition. The bar mounts in the same render that flips `pending`, is
// indeterminate until the size is known, then follows each chunk. Every chunk is written with a
// plain setState AFTER an await, which is urgent and renders at once. Wrapping it in
// startTransition would hold it until the upload ends (0% ... 100%), because React holds
// transition updates made while an async action is pending.
export function ProgressUpload() {
  const [size, setSize] = useState<number | null>(null);
  const [sent, setSent] = useState(0);
  const [pending, startUpload] = useTransition();

  const upload = () => {
    // Reset before the action, outside it: a write in its synchronous prefix would be held.
    setSize(null);
    setSent(0);
    startUpload(async () => {
      for await (const progress of fakeUpload("report.pdf")) {
        setSize(progress.total); // after an await: urgent
        setSent(progress.sent);
        // Not: startTransition(() => setSent(progress.sent)), which is held until the end.
      }
    });
  };

  return (
    <div className="demo-stack">
      <button type="button" className="demo-button demo-primary" onClick={upload}>
        {pending ? "Uploading…" : "Upload report.pdf"}
      </button>
      {(pending || size !== null) && (
        <Progress.Root
          className="demo-progress"
          value={size === null ? null : sent / 1e6}
          max={size === null ? undefined : size / 1e6}
          format={megabytes}
        >
          <div className="demo-progress-head">
            <Progress.Label>Uploading report.pdf</Progress.Label>
            <Progress.Value>
              {({ formattedValue, max, complete }) =>
                formattedValue === null
                  ? "Preparing…"
                  : complete
                    ? "Done"
                    : `${formattedValue} of ${max.toFixed(1)} MB`
              }
            </Progress.Value>
          </div>
          <Progress.Track className="demo-progress-track">
            <Progress.Indicator className="demo-progress-fill" />
          </Progress.Track>
        </Progress.Root>
      )}
    </div>
  );
}
