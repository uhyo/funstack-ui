import { startTransition, useState, useTransition } from "react";
import { Meter } from "@funstack/ui/meter";
import { Progress } from "@funstack/ui/progress";
import "./progress-meter-demo.css";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const FILE_SIZE = 8_400_000;

/** Fake upload: the size is known after 600 ms, then 12 chunks of 150 ms. */
async function* fakeUpload(): AsyncGenerator<number | null> {
  yield null;
  await sleep(600);
  for (let sent = 0; sent <= FILE_SIZE; sent += FILE_SIZE / 12) {
    yield sent;
    await sleep(150);
  }
}

function UploadDemo() {
  const [uploaded, setUploaded] = useState<number | null>(null);
  const [held, setHeld] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [wrongPending, startWrong] = useTransition();
  const format = { style: "unit", unit: "megabyte", maximumFractionDigits: 1 } as const;
  return (
    <section>
      <h3>Upload (a value reported by a pending action)</h3>
      <p>
        Each chunk is written with a plain <code>setState</code> after an <code>await</code>, so it
        renders at once. The second bar wraps the same write in <code>startTransition</code>: React
        holds it until the action settles, so it sits still and then jumps to the end.
      </p>
      <div className="pm-row">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              for await (const sent of fakeUpload()) setUploaded(sent === null ? null : sent / 1e6);
            })
          }
        >
          Upload (urgent writes)
        </button>
        <button
          type="button"
          disabled={wrongPending}
          onClick={() =>
            startWrong(async () => {
              for await (const sent of fakeUpload())
                startTransition(() => setHeld(sent === null ? null : sent / 1e6));
            })
          }
        >
          Upload (startTransition: the pitfall)
        </button>
      </div>
      {[
        { label: "report.pdf", value: uploaded, show: pending || uploaded !== null },
        { label: "held.pdf", value: held, show: wrongPending || held !== null },
      ].map(
        ({ label, value, show }) =>
          show && (
            <Progress.Root
              key={label}
              className="pm-progress"
              value={value}
              max={FILE_SIZE / 1e6}
              format={format}
            >
              <div className="pm-head">
                <Progress.Label>Uploading {label}</Progress.Label>
                <Progress.Value>
                  {({ formattedValue, max }) =>
                    formattedValue === null
                      ? "Waiting for the size…"
                      : `${formattedValue} of ${max.toFixed(1)} MB`
                  }
                </Progress.Value>
              </div>
              <Progress.Track className="pm-track">
                <Progress.Indicator className="pm-fill" />
              </Progress.Track>
            </Progress.Root>
          ),
      )}
    </section>
  );
}

function SpinnerDemo() {
  return (
    <section>
      <h3>Indeterminate, and circular from the same variable</h3>
      <div className="pm-row">
        <Progress.Root aria-label="Loading messages" className="pm-progress pm-inline">
          <Progress.Track className="pm-track">
            <Progress.Indicator className="pm-fill" />
          </Progress.Track>
        </Progress.Root>
        <Progress.Root value={65} aria-label="Sync" className="pm-ring" />
      </div>
    </section>
  );
}

function StorageDemo() {
  const [used, setUsed] = useState(3.1);
  const quota = 5;
  return (
    <section>
      <h3>Meter: storage (lower is better)</h3>
      <label>
        Used{" "}
        <input
          type="range"
          min={0}
          max={quota}
          step={0.1}
          value={used}
          onChange={(e) => setUsed(Number(e.target.value))}
        />
      </label>
      <Meter.Root
        className="pm-meter"
        value={used}
        max={quota}
        low={quota * 0.7}
        high={quota * 0.9}
        optimum={0}
        format={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }}
        getAriaValueText={(_, { formattedValue, region }) =>
          region === "even-less-good" ? `${formattedValue}, almost full` : formattedValue
        }
      >
        <div className="pm-head">
          <Meter.Label>Storage</Meter.Label>
          <Meter.Value>
            {({ formattedValue, max, region }) => `${formattedValue} of ${max} GB (${region})`}
          </Meter.Value>
        </div>
        <Meter.Track className="pm-meter-track">
          <Meter.Indicator className="pm-meter-fill" />
        </Meter.Track>
      </Meter.Root>
    </section>
  );
}

export function ProgressMeterDemo() {
  return (
    <section>
      <h2>Progress and Meter</h2>
      <UploadDemo />
      <SpinnerDemo />
      <StorageDemo />
    </section>
  );
}
