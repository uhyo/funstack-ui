import { Suspense, use, useRef, useState } from "react";
import { Slider } from "@funstack/ui/slider";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary";
import { fakeSave, sleep } from "./shared/fake-backend";
import "./slider-demo.css";

function VolumeDemo() {
  const [fail, setFail] = useState(false);
  return (
    <section>
      <h3>Saved on release (uncontrolled)</h3>
      <p>
        The thumb follows the pointer; the save runs once, in <code>valueCommitAction</code>, when
        you let go (or per key press). With failures on, the thumb slides back.
      </p>
      <label>
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make
        the save fail
      </label>
      <DemoErrorBoundary className="sl-error">
        <Slider.Root
          className="sl-root"
          defaultValue={40}
          valueCommitAction={(next) => fakeSave("volume", next, { fail })}
          getAriaValueText={(v) => `${v} percent`}
        >
          <div className="sl-head">
            <Slider.Label className="sl-label">Volume</Slider.Label>
            <Slider.Value>
              {({ value, pending }) => `${value}%${pending ? " (saving)" : ""}`}
            </Slider.Value>
          </div>
          <Slider.Track className="sl-track">
            <Slider.Indicator className="sl-fill" />
            <Slider.Thumb className="sl-thumb" />
          </Slider.Track>
        </Slider.Root>
      </DemoErrorBoundary>
    </section>
  );
}

const products = Array.from({ length: 40 }, (_, i) => ({
  name: `Product ${i + 1}`,
  price: ((i * 37) % 50) * 10,
}));
const cache = new Map<string, Promise<typeof products>>();

/** A suspending "search": each price range loads for 300 ms. */
function search(lo: number, hi: number): Promise<typeof products> {
  const key = `${lo}-${hi}`;
  let promise = cache.get(key);
  if (promise === undefined) {
    promise = sleep(300).then(() => products.filter((p) => p.price >= lo && p.price <= hi));
    cache.set(key, promise);
  }
  return promise;
}

function Results({ range }: { range: readonly number[] }) {
  const found = use(search(range[0] ?? 0, range[1] ?? 0));
  return (
    <ul className="sl-list">
      {found.slice(0, 8).map((p) => (
        <li key={p.name}>
          {p.name}: ${p.price}
        </li>
      ))}
      <li>{found.length} products</li>
    </ul>
  );
}

function PriceFilterDemo() {
  const [price, setPrice] = useState<readonly number[]>([100, 300]);
  return (
    <section>
      <h3>Live filter (controlled, transition by default)</h3>
      <p>
        <code>valueChangeAction</code> adopts every step with <code>setPrice</code>, a transition
        update: the list suspends for each range while the old one stays on screen and the thumbs
        never wait for it.
      </p>
      <Slider.Root
        className="sl-root"
        value={price}
        min={0}
        max={500}
        step={10}
        minStepsBetweenThumbs={1}
        valueChangeAction={(next) => {
          setPrice(next);
        }}
        valueCommitAction={(next) => console.log("[price] committed", next)}
        getAriaValueText={(v) => `${v} dollars`}
      >
        {({ pending }) => (
          <>
            <div className="sl-head">
              <Slider.Label className="sl-label">Price</Slider.Label>
              <Slider.Value>{({ values: [lo, hi] }) => `$${lo} – $${hi}`}</Slider.Value>
            </div>
            <Slider.Track className="sl-track">
              <Slider.Indicator className="sl-fill" />
              <Slider.Thumb index={0} aria-label="Minimum price" className="sl-thumb" />
              <Slider.Thumb index={1} aria-label="Maximum price" className="sl-thumb" />
            </Slider.Track>
            <div data-stale={pending ? "" : undefined} className="sl-list">
              <Suspense fallback={<p>Loading…</p>}>
                <Results range={price} />
              </Suspense>
            </div>
          </>
        )}
      </Slider.Root>
    </section>
  );
}

function VerticalAndRtlDemo() {
  return (
    <section>
      <h3>Vertical and right-to-left</h3>
      <div className="sl-row">
        <Slider.Root className="sl-root" defaultValue={30} orientation="vertical">
          <Slider.Label className="sl-label">Bass</Slider.Label>
          <Slider.Track className="sl-track">
            <Slider.Indicator className="sl-fill" />
            <Slider.Thumb className="sl-thumb" />
          </Slider.Track>
          <Slider.Value />
        </Slider.Root>
        <div dir="rtl">
          <Slider.Root className="sl-root" defaultValue={70}>
            <div className="sl-head">
              <Slider.Label className="sl-label">مستوى الصوت</Slider.Label>
              <Slider.Value />
            </div>
            <Slider.Track className="sl-track">
              <Slider.Indicator className="sl-fill" />
              <Slider.Thumb className="sl-thumb" />
            </Slider.Track>
          </Slider.Root>
        </div>
      </div>
    </section>
  );
}

function FormDemo() {
  const [saved, setSaved] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <section>
      <h3>Form with reset</h3>
      <form
        ref={formRef}
        action={async (data) => {
          await sleep(500);
          setSaved(`brightness=${String(data.get("brightness"))}`);
        }}
      >
        <Slider.Root className="sl-root" name="brightness" defaultValue={60} step={5}>
          <div className="sl-head">
            <Slider.Label className="sl-label">Brightness</Slider.Label>
            <Slider.Value />
          </div>
          <Slider.Track className="sl-track">
            <Slider.Indicator className="sl-fill" />
            <Slider.Thumb className="sl-thumb" />
          </Slider.Track>
        </Slider.Root>
        <button type="submit">Save</button> <button type="reset">Reset</button>
      </form>
      {saved !== null && <p>Posted {saved}; the form reset itself after the action.</p>}
    </section>
  );
}

export function SliderDemo() {
  return (
    <section>
      <h2>Slider</h2>
      <VolumeDemo />
      <PriceFilterDemo />
      <VerticalAndRtlDemo />
      <FormDemo />
    </section>
  );
}
